import { Router, type Request } from 'express';
import {
  answerSchema,
  helpSchema,
  identifySchema,
  languageChangeSchema,
} from '@understood/shared';
import { asyncHandler, parseBody, routeParam, sendData } from '../../http.js';
import { AppError } from '../../errors.js';
import { config } from '../../config.js';
import { Delivery, Variant, Worker, type DeliveryDoc, type InstructionDoc, type VariantDoc } from '../../models.js';
import { rateLimit, byIp } from '../../auth/rate-limit.js';
import { randomToken, sha256Hex, tokenHash } from '../../auth/tokens.js';
import { getStorage } from '../../media/storage.js';
import { getQueue } from '../../jobs/queue.js';
import { canRequestHelp } from '../../domain/lifecycle.js';
import {
  availableVariants,
  buildContent,
  buildMeta,
  deliveryAuth,
  loadVariantForDelivery,
  previewInstruction,
  requireWorkerAuth,
  shareContext,
} from './context.js';
import { beginIdempotent, finishIdempotent } from './idempotency.js';

export const workerRouter: Router = Router();

const shareTokenOf = (req: Request): string => (typeof req.params.token === 'string' ? req.params.token : '');

const metaLimit = rateLimit({
  bucket: 'w-meta',
  limit: 60,
  windowSeconds: 60,
  key: (req) => `${sha256Hex(shareTokenOf(req)).slice(0, 16)}:${req.ip ?? 'unknown'}`,
});
const identifyTokenLimit = rateLimit({
  bucket: 'w-identify-token',
  limit: 10,
  windowSeconds: 60,
  key: (req) => sha256Hex(shareTokenOf(req)).slice(0, 16),
});
const identifyIpLimit = rateLimit({ bucket: 'w-identify-ip', limit: 30, windowSeconds: 60, key: byIp });
const mutationLimit = rateLimit({
  bucket: 'w-mutate',
  limit: 30,
  windowSeconds: 60,
  key: (req) => String(req.workerAuth?.delivery._id ?? req.ip ?? 'unknown'),
});

async function enqueueHelpAlert(orgId: string, instructionId: string): Promise<void> {
  const bucket = Math.floor(Date.now() / (config.HELP_BATCH_SECONDS * 1000));
  await getQueue().enqueue(
    'help_alert',
    { orgId, instructionId },
    { delay: config.HELP_BATCH_SECONDS * 1000, jobId: `help:${instructionId}:${bucket}` },
  );
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

async function pickPreviewVariant(instruction: InstructionDoc): Promise<VariantDoc> {
  const variants = await availableVariants(String(instruction._id));
  if (variants.length === 0) throw new AppError('PIPELINE_FAILED');

  if (instruction.status === 'shared') {
    const first = await Delivery.findOne({ instructionId: instruction._id }).sort({ createdAt: 1 }).lean();
    const match = first ? variants.find((variant) => String(variant._id) === String(first.variantId)) : null;
    if (match) return match;
  }
  return variants[0]!;
}

workerRouter.get(
  '/w/preview/:token/audio/:variantId',
  asyncHandler(async (req, res) => {
    const instruction = await previewInstruction(routeParam(req.params.token));
    const variant = await Variant.findOne({
      _id: routeParam(req.params.variantId),
      instructionId: instruction._id,
    }).lean<VariantDoc>();
    if (!variant) throw new AppError('FORBIDDEN');
    if (!variant.audioKey) throw new AppError('CONFLICT_STATE');
    const signed = await getStorage().signedUrl(variant.audioKey);
    sendData(res, { url: signed.url, expiresAt: signed.expiresAt });
  }),
);

workerRouter.get(
  '/w/preview/:token',
  asyncHandler(async (req, res) => {
    const instruction = await previewInstruction(routeParam(req.params.token));
    const [meta, variant] = await Promise.all([buildMeta(instruction), pickPreviewVariant(instruction)]);
    const content = await buildContent(instruction, variant, { preview: true });
    sendData(res, { ...meta, preview: true, language: variant.language, content });
  }),
);

workerRouter.get(
  '/w/state',
  deliveryAuth,
  asyncHandler(async (req, res) => {
    const { delivery, instruction } = requireWorkerAuth(req);
    const variant = await loadVariantForDelivery(delivery);
    if (!variant) throw new AppError('CONFLICT_STATE');

    const lastAttempt = delivery.attempts[delivery.attempts.length - 1];
    const content = await buildContent(instruction, variant, {
      preview: false,
      revealCorrect: delivery.attempts.length > 0,
      selectedIndex: lastAttempt ? (lastAttempt.optionIndex as 0 | 1 | 2) : null,
    });
    const worker = await Worker.findById(delivery.workerId).select('name').lean();

    sendData(res, {
      delivery: {
        id: String(delivery._id),
        status: delivery.status,
        language: delivery.language,
        attempts: delivery.attempts,
        attemptsCount: delivery.attempts.length,
        help: delivery.help,
        openedAt: delivery.openedAt ?? null,
        answeredAt: delivery.answeredAt ?? null,
        completedAt: delivery.completedAt ?? null,
      },
      worker: { firstName: firstNameOf(worker?.name ?? 'Worker'), language: delivery.language },
      instruction: content,
      alreadyCompleted: delivery.status === 'completed',
    });
  }),
);

workerRouter.get(
  '/w/audio/:variantId',
  deliveryAuth,
  asyncHandler(async (req, res) => {
    const { delivery } = requireWorkerAuth(req);
    const variant = await Variant.findOne({
      _id: routeParam(req.params.variantId),
      instructionId: delivery.instructionId,
    }).lean<VariantDoc>();
    if (!variant) throw new AppError('FORBIDDEN');
    if (!variant.audioKey) throw new AppError('CONFLICT_STATE');
    const signed = await getStorage().signedUrl(variant.audioKey);
    sendData(res, { url: signed.url, expiresAt: signed.expiresAt });
  }),
);

workerRouter.get(
  '/w/photo/:variantId',
  deliveryAuth,
  asyncHandler(async (req, res) => {
    const { delivery, instruction } = requireWorkerAuth(req);
    const variant = await Variant.findOne({
      _id: routeParam(req.params.variantId),
      instructionId: delivery.instructionId,
    })
      .select('_id')
      .lean();
    if (!variant) throw new AppError('FORBIDDEN');
    if (!instruction.content.photoKey) throw new AppError('CONFLICT_STATE');
    const signed = await getStorage().signedUrl(instruction.content.photoKey);
    sendData(res, { url: signed.url, expiresAt: signed.expiresAt });
  }),
);

workerRouter.post(
  '/w/answer',
  deliveryAuth,
  mutationLimit,
  asyncHandler(async (req, res) => {
    const body = parseBody(answerSchema, req);
    const { delivery, instruction } = requireWorkerAuth(req);
    const slot = await beginIdempotent(req, String(delivery._id), body);
    if (slot.cached) {
      res.status(slot.cached.status).json(slot.cached.body);
      return;
    }

    if (delivery.status === 'completed') throw new AppError('DELIVERY_COMPLETED');
    if (delivery.status === 'pending') throw new AppError('CONFLICT_STATE');
    if (delivery.attempts.length >= 2) throw new AppError('ATTEMPTS_EXHAUSTED');

    const variant = await loadVariantForDelivery(delivery);
    if (!variant?.question || variant.questionStatus !== 'ready') throw new AppError('CONFLICT_STATE');

    const now = new Date();
    const firstAttempt = delivery.attempts.length === 0;
    const correct = body.optionIndex === variant.question.correctIndex;

    const updated = await Delivery.findOneAndUpdate(
      { _id: delivery._id, status: { $in: ['opened', 'answered'] }, 'attempts.2': { $exists: false } },
      {
        $push: { attempts: { optionIndex: body.optionIndex, correct, at: now } },
        $set: {
          status: 'answered',
          ...(delivery.answeredAt ? {} : { answeredAt: now }),
          ...(firstAttempt ? { firstAttemptCorrect: correct } : {}),
        },
      },
      { new: true },
    ).lean<DeliveryDoc>();

    if (!updated) {
      const fresh = await Delivery.findById(delivery._id).lean<DeliveryDoc>();
      if (fresh?.status === 'completed') throw new AppError('DELIVERY_COMPLETED');
      if ((fresh?.attempts.length ?? 0) >= 2) throw new AppError('ATTEMPTS_EXHAUSTED');
      throw new AppError('CONFLICT_STATE');
    }

    const attemptsCount = updated.attempts.length;
    if (!correct && attemptsCount >= 2 && !updated.help.requested) {
      const helpUpdate = await Delivery.updateOne(
        { _id: updated._id, 'help.requested': false },
        {
          $set: {
            'help.requested': true,
            'help.reason': 'dont_understand',
            'help.requestedAt': now,
            'help.resolvedAt': null,
            'help.resolvedBy': null,
          },
        },
      );
      if (helpUpdate.modifiedCount > 0) {
        await enqueueHelpAlert(String(instruction.orgId), String(instruction._id));
      }
    }

    const data = {
      correct,
      correctIndex: variant.question.correctIndex,
      firstAttempt,
      attemptsCount,
    };
    await finishIdempotent(slot, 200, { data });
    sendData(res, data);
  }),
);

workerRouter.post(
  '/w/complete',
  deliveryAuth,
  mutationLimit,
  asyncHandler(async (req, res) => {
    const { delivery } = requireWorkerAuth(req);

    if (delivery.status === 'completed') {
      sendData(res, { completedAt: delivery.completedAt });
      return;
    }

    const slot = await beginIdempotent(req, String(delivery._id), {});
    if (slot.cached) {
      res.status(slot.cached.status).json(slot.cached.body);
      return;
    }

    if (delivery.status !== 'answered' || delivery.attempts.length === 0) throw new AppError('CONFLICT_STATE');

    const now = new Date();
    const updated = await Delivery.findOneAndUpdate(
      { _id: delivery._id, status: 'answered', 'attempts.0': { $exists: true } },
      { $set: { status: 'completed', completedAt: now } },
      { new: true },
    ).lean<DeliveryDoc>();

    if (!updated) {
      const fresh = await Delivery.findById(delivery._id).lean<DeliveryDoc>();
      if (fresh?.status === 'completed') {
        sendData(res, { completedAt: fresh.completedAt });
        return;
      }
      throw new AppError('CONFLICT_STATE');
    }

    const data = { completedAt: updated.completedAt };
    await finishIdempotent(slot, 200, { data });
    sendData(res, data);
  }),
);

workerRouter.post(
  '/w/help',
  deliveryAuth,
  mutationLimit,
  asyncHandler(async (req, res) => {
    const body = parseBody(helpSchema, req);
    const { delivery, instruction } = requireWorkerAuth(req);
    if (!canRequestHelp(delivery.status)) throw new AppError('CONFLICT_STATE');

    const slot = await beginIdempotent(req, String(delivery._id), body);
    if (slot.cached) {
      res.status(slot.cached.status).json(slot.cached.body);
      return;
    }

    const now = new Date();
    const freshRequest = !delivery.help.requested || Boolean(delivery.help.resolvedAt);
    const updated = await Delivery.findOneAndUpdate(
      { _id: delivery._id, status: { $in: ['opened', 'answered', 'completed'] } },
      {
        $set: {
          'help.requested': true,
          'help.reason': body.reason,
          ...(freshRequest
            ? { 'help.requestedAt': now, 'help.resolvedAt': null, 'help.resolvedBy': null }
            : {}),
        },
      },
      { new: true },
    ).lean<DeliveryDoc>();

    if (!updated) throw new AppError('CONFLICT_STATE');
    if (freshRequest) await enqueueHelpAlert(String(instruction.orgId), String(instruction._id));

    const data = { requestedAt: updated.help.requestedAt };
    await finishIdempotent(slot, 200, { data });
    sendData(res, data);
  }),
);

workerRouter.post(
  '/w/language',
  deliveryAuth,
  mutationLimit,
  asyncHandler(async (req, res) => {
    const body = parseBody(languageChangeSchema, req);
    const { delivery, instruction } = requireWorkerAuth(req);

    const variants = await availableVariants(String(instruction._id));
    const target = variants.find((variant) => variant.language === body.language);
    if (!target) throw new AppError('LANGUAGE_UNAVAILABLE');

    await Worker.updateOne(
      { _id: delivery.workerId, orgId: instruction.orgId },
      { $set: { language: body.language } },
    );

    let deliveryLanguage = delivery.language;
    let variant = await loadVariantForDelivery(delivery);
    if (delivery.status !== 'completed' && body.language !== delivery.language) {
      await Delivery.updateOne(
        { _id: delivery._id },
        {
          $set: { variantId: target._id, language: body.language },
          $push: { languageChangeHistory: { from: delivery.language, to: body.language, at: new Date() } },
        },
      );
      deliveryLanguage = body.language;
      variant = target;
    }

    const content = await buildContent(instruction, variant, { preview: false });
    sendData(res, {
      language: body.language,
      deliveryLanguage,
      content,
    });
  }),
);

workerRouter.get(
  '/w/:token',
  metaLimit,
  asyncHandler(async (req, res) => {
    const instruction = await shareContext(req);
    const meta = await buildMeta(instruction);
    sendData(res, meta);
  }),
);

workerRouter.post(
  '/w/:token/identify',
  identifyTokenLimit,
  identifyIpLimit,
  asyncHandler(async (req, res) => {
    const body = parseBody(identifySchema, req);
    const instruction = await shareContext(req);

    const delivery = await Delivery.findOne({
      instructionId: instruction._id,
      workerId: body.workerId,
    }).lean<DeliveryDoc>();
    if (!delivery) throw new AppError('WORKER_NOT_IN_AUDIENCE');

    const variants = await availableVariants(String(instruction._id));
    const byLanguage = new Map(variants.map((variant) => [variant.language, variant]));
    let variant = byLanguage.get(delivery.language) ?? null;
    if (!variant) {
      const snapshot = await Variant.findOne({ _id: delivery.variantId, instructionId: instruction._id }).lean<VariantDoc>();
      variant = snapshot && (snapshot.status === 'ready' || snapshot.status === 'text_only') ? snapshot : null;
    }
    if (!variant) throw new AppError('PIPELINE_FAILED');

    let language = delivery.language;
    let switched = false;
    if (body.language) {
      const target = byLanguage.get(body.language);
      if (!target) throw new AppError('LANGUAGE_UNAVAILABLE');
      if (body.language !== delivery.language && delivery.status !== 'completed') {
        language = body.language;
        variant = target;
        switched = true;
      }
      await Worker.updateOne(
        { _id: delivery.workerId, orgId: instruction.orgId },
        { $set: { language: body.language } },
      );
    }

    const worker = await Worker.findById(delivery.workerId).select('name').lean();
    const now = new Date();
    const rawToken = randomToken(32);
    const tokenEntry = { hash: tokenHash(rawToken), createdAt: now, lastSeenAt: now };

    const updated = await Delivery.findOneAndUpdate(
      { _id: delivery._id },
      {
        $set: {
          ...(delivery.openedAt ? {} : { openedAt: now }),
          ...(delivery.status === 'pending' ? { status: 'opened' } : {}),
          ...(switched ? { variantId: variant._id, language } : {}),
        },
        $push: {
          deliveryTokens: { $each: [tokenEntry], $slice: -5 },
          ...(switched
            ? { languageChangeHistory: { from: delivery.language, to: language, at: now } }
            : {}),
        },
      },
      { new: true },
    ).lean<DeliveryDoc>();
    if (!updated) throw new AppError('DELIVERY_TOKEN_INVALID');

    const content = await buildContent(instruction, variant, { preview: false });
    sendData(res, {
      deliveryToken: rawToken,
      deliveryId: String(updated._id),
      worker: { firstName: firstNameOf(worker?.name ?? 'Worker'), language: updated.language },
      instruction: content,
      alreadyCompleted: updated.status === 'completed',
    });
  }),
);

export type { DeliveryDoc };
