import { Router } from 'express';
import {
  deliveriesQuerySchema,
  instructionListQuerySchema,
  safeRate,
} from '@understood/shared';
import { Types } from 'mongoose';
import { asyncHandler, parseQuery, routeParam, sendData } from '../../http.js';
import { AppError } from '../../errors.js';
import { Crew, Delivery, Instruction, Worker, type DeliveryDoc } from '../../models.js';
import { requireAuth } from '../../auth/middleware.js';
import { decodeCursor, encodeCursor } from '../../domain/cursor.js';
import { canResolveHelp } from '../../domain/lifecycle.js';
import { summarizeInstructions } from './stats.js';

export const boardRouter: Router = Router();
boardRouter.use(requireAuth);

interface ExceptionRow {
  deliveryId: string;
  instructionId: string;
  instructionTitle: string;
  workerName: string;
  language: string;
  status: string;
  helpReason: string | null;
  helpRequestedAt: Date | null;
  sharedAt: Date | null;
  answeredAt: Date | null;
}

async function exceptionRows(deliveries: DeliveryDoc[]): Promise<ExceptionRow[]> {
  const instructionIds = [...new Set(deliveries.map((delivery) => String(delivery.instructionId)))];
  const workerIds = [...new Set(deliveries.map((delivery) => String(delivery.workerId)))];
  const [instructions, workers] = await Promise.all([
    Instruction.find({ _id: { $in: instructionIds } }).select('title sharedAt').lean(),
    Worker.find({ _id: { $in: workerIds } }).select('name').lean(),
  ]);
  const instructionInfo = new Map(
    instructions.map((instruction) => [
      String(instruction._id),
      { title: instruction.title ?? 'Untitled', sharedAt: instruction.sharedAt ?? null },
    ]),
  );
  const names = new Map(workers.map((worker) => [String(worker._id), worker.name]));

  return deliveries.map((delivery) => {
    const info = instructionInfo.get(String(delivery.instructionId));
    return {
      deliveryId: String(delivery._id),
      instructionId: String(delivery.instructionId),
      instructionTitle: info?.title ?? 'Untitled',
      workerName: names.get(String(delivery.workerId)) ?? 'Worker',
      language: delivery.language,
      status: delivery.status,
      helpReason: delivery.help.reason ?? null,
      helpRequestedAt: delivery.help.requestedAt ?? null,
      sharedAt: info?.sharedAt ?? null,
      answeredAt: delivery.answeredAt ?? null,
    };
  });
}

boardRouter.get(
  '/board/overview',
  asyncHandler(async (req, res) => {
    const orgId = new Types.ObjectId(req.auth!.orgId);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [workers, crews, liveInstructions, needsHelp, notOpened, recentInstructions, helpRows, pendingRows, wrongRows] =
      await Promise.all([
        Worker.countDocuments({ orgId, archivedAt: null }),
        Crew.countDocuments({ orgId, archivedAt: null }),
        Instruction.countDocuments({ orgId, status: 'shared' }),
        Delivery.countDocuments({ orgId, 'help.requested': true, 'help.resolvedAt': null }),
        Delivery.countDocuments({ orgId, status: 'pending' }),
        Instruction.find({ orgId, status: { $in: ['shared', 'archived'] }, sharedAt: { $gte: sevenDaysAgo } })
          .select('_id sharedAt')
          .lean(),
        Delivery.find({ orgId, 'help.requested': true, 'help.resolvedAt': null })
          .sort({ 'help.requestedAt': 1 })
          .limit(5)
          .lean<DeliveryDoc[]>(),
        Delivery.find({ orgId, status: 'pending' }).sort({ createdAt: 1 }).limit(5).lean<DeliveryDoc[]>(),
        Delivery.find({ orgId, firstAttemptCorrect: false }).sort({ answeredAt: -1 }).limit(5).lean<DeliveryDoc[]>(),
      ]);

    const summaries = await summarizeInstructions(recentInstructions.map((instruction) => instruction._id));
    let understood = 0;
    let targeted = 0;
    for (const summary of summaries.values()) {
      understood += summary.understood;
      targeted += summary.targeted;
    }

    const [helpExceptions, pendingExceptions, wrongExceptions] = await Promise.all([
      exceptionRows(helpRows),
      exceptionRows(pendingRows),
      exceptionRows(wrongRows),
    ]);

    sendData(res, {
      kpis: {
        workers,
        crews,
        liveInstructions,
        needsHelp,
        notOpened,
        understood7d: { understood, targeted, rate: safeRate(understood, targeted) },
      },
      exceptions: {
        needsHelp: helpExceptions,
        notOpened: pendingExceptions,
        wrong: wrongExceptions,
      },
    });
  }),
);

boardRouter.get(
  '/instructions',
  asyncHandler(async (req, res) => {
    const query = parseQuery(instructionListQuerySchema, req);
    const match: Record<string, unknown> = { orgId: req.auth!.orgId };
    match.status = query.status === 'all' ? { $in: ['shared', 'archived'] } : query.status;

    const cursor = decodeCursor(query.cursor);
    if (cursor) {
      match.$or = [
        { createdAt: { $lt: cursor.at } },
        { createdAt: cursor.at, _id: { $lt: new Types.ObjectId(cursor.id) } },
      ];
    }

    const instructions = await Instruction.find(match)
      .sort({ createdAt: -1, _id: -1 })
      .limit(query.limit + 1)
      .lean();
    const page = instructions.slice(0, query.limit);
    const last = page[page.length - 1];
    const nextCursor =
      instructions.length > query.limit && last ? encodeCursor(last.createdAt, String(last._id)) : null;

    const [crews, summaries] = await Promise.all([
      Crew.find({ _id: { $in: page.flatMap((instruction) => (instruction.crewId ? [instruction.crewId] : [])) } })
        .select('name')
        .lean(),
      summarizeInstructions(page.map((instruction) => instruction._id)),
    ]);
    const crewNames = new Map(crews.map((crew) => [String(crew._id), crew.name]));

    sendData(
      res,
      page.map((instruction) => {
        const summary = summaries.get(String(instruction._id));
        return {
          id: String(instruction._id),
          title: instruction.title ?? null,
          type: instruction.type,
          crewName: instruction.crewId ? crewNames.get(String(instruction.crewId)) ?? null : null,
          sharedAt: instruction.sharedAt ?? null,
          targeted: summary?.targeted ?? 0,
          opened: summary?.opened ?? 0,
          understood: summary?.understood ?? 0,
          helpCount: summary?.helpCount ?? 0,
          status: instruction.status,
          updatedAt: instruction.updatedAt,
        };
      }),
      { nextCursor },
    );
  }),
);

boardRouter.get(
  '/instructions/:id/deliveries',
  asyncHandler(async (req, res) => {
    const query = parseQuery(deliveriesQuerySchema, req);
    const instruction = await Instruction.findOne({ _id: routeParam(req.params.id), orgId: req.auth!.orgId }).lean();
    if (!instruction) throw new AppError('NOT_FOUND');

    const deliveries = await Delivery.find({ instructionId: instruction._id })
      .sort({ createdAt: 1 })
      .lean<DeliveryDoc[]>();
    const workers = await Worker.find({ _id: { $in: deliveries.map((delivery) => delivery.workerId) } })
      .select('name')
      .lean();
    const names = new Map(workers.map((worker) => [String(worker._id), worker.name]));

    const needsHelp = deliveries.filter((delivery) => delivery.help.requested && !delivery.help.resolvedAt).length;
    const notOpened = deliveries.filter((delivery) => delivery.status === 'pending').length;
    const wrong = deliveries.filter((delivery) => delivery.firstAttemptCorrect === false).length;
    const summary = (await summarizeInstructions([instruction._id])).get(String(instruction._id));

    const filtered = deliveries.filter((delivery) => {
      if (query.filter === 'not_opened') return delivery.status === 'pending';
      if (query.filter === 'wrong') return delivery.firstAttemptCorrect === false;
      if (query.filter === 'needs_help') return delivery.help.requested && !delivery.help.resolvedAt;
      return true;
    });

    sendData(
      res,
      filtered.map((delivery) => ({
        deliveryId: String(delivery._id),
        worker: {
          name: names.get(String(delivery.workerId)) ?? 'Worker',
          language: delivery.language,
        },
        status: delivery.status,
        firstAttemptCorrect: delivery.firstAttemptCorrect ?? null,
        help: delivery.help,
        openedAt: delivery.openedAt ?? null,
        answeredAt: delivery.answeredAt ?? null,
        completedAt: delivery.completedAt ?? null,
      })),
      {
        counts: {
          targeted: summary?.targeted ?? deliveries.length,
          opened: summary?.opened ?? 0,
          understood: summary?.understood ?? 0,
          helpCount: summary?.helpCount ?? 0,
          needsHelp,
          notOpened,
          wrong,
        },
      },
    );
  }),
);

boardRouter.post(
  '/deliveries/:id/resolve-help',
  asyncHandler(async (req, res) => {
    const delivery = await Delivery.findOne({ _id: routeParam(req.params.id), orgId: req.auth!.orgId });
    if (!delivery) throw new AppError('NOT_FOUND');
    if (!canResolveHelp(delivery.help.requested)) throw new AppError('CONFLICT_STATE');

    if (!delivery.help.resolvedAt) {
      delivery.help.resolvedAt = new Date();
      delivery.help.resolvedBy = new Types.ObjectId(req.auth!.userId);
      await delivery.save();
    }

    sendData(res, { resolvedAt: delivery.help.resolvedAt });
  }),
);
