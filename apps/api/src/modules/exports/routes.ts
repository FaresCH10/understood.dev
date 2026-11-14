import { Router, type Response } from 'express';
import archiver from 'archiver';
import { Types } from 'mongoose';
import { exportQuerySchema } from '@understood/shared';
import { asyncHandler, parseQuery, routeParam } from '../../http.js';
import { AppError } from '../../errors.js';
import { Crew, Delivery, Instruction, Organization, Worker, type DeliveryDoc, type InstructionDoc } from '../../models.js';
import { requireAuth } from '../../auth/middleware.js';
import { rateLimit } from '../../auth/rate-limit.js';
import { buildCsv } from '../workers/csv.js';

export const exportsRouter: Router = Router();
exportsRouter.use(requireAuth);
exportsRouter.use(rateLimit({ bucket: 'exports-org', limit: 5, windowSeconds: 3600, key: (req) => req.auth!.orgId }));

interface ExportOptions {
  includeHelpReasons: boolean;
  includeTimes: boolean;
}

interface DeliveryExportRow {
  instruction: InstructionDoc;
  delivery: DeliveryDoc;
  workerName: string;
  crewName: string;
  orgTimezone: string;
}

function iso(value: Date | null | undefined): string {
  return value ? new Date(value).toISOString() : '';
}

function instructionHeader(options: ExportOptions): unknown[] {
  const header: unknown[] = [
    'instruction_id',
    'title',
    'type',
    'source_language',
    'shared_at',
    'crew',
    'worker_name',
    'language',
    'status',
    'first_attempt_correct',
  ];
  if (options.includeTimes) header.push('opened_at', 'answered_at', 'completed_at');
  if (options.includeHelpReasons) header.push('help_reason', 'help_resolved_at');
  header.push('org_timezone');
  return header;
}

function instructionRow(row: DeliveryExportRow, options: ExportOptions): unknown[] {
  const values: unknown[] = [
    String(row.instruction._id),
    row.instruction.title ?? '',
    row.instruction.type,
    row.instruction.sourceLanguage,
    iso(row.instruction.sharedAt),
    row.crewName,
    row.workerName,
    row.delivery.language,
    row.delivery.status,
    row.delivery.firstAttemptCorrect === null || row.delivery.firstAttemptCorrect === undefined
      ? ''
      : row.delivery.firstAttemptCorrect,
  ];
  if (options.includeTimes) {
    values.push(iso(row.delivery.openedAt), iso(row.delivery.answeredAt), iso(row.delivery.completedAt));
  }
  if (options.includeHelpReasons) {
    values.push(row.delivery.help.reason ?? '', iso(row.delivery.help.resolvedAt));
  }
  values.push(row.orgTimezone);
  return values;
}

async function exportRows(orgId: string, instructions: InstructionDoc[]): Promise<DeliveryExportRow[]> {
  if (instructions.length === 0) return [];

  const org = await Organization.findById(orgId).select('timezone').lean();
  const [deliveries, workers, crews] = await Promise.all([
    Delivery.find({ orgId, instructionId: { $in: instructions.map((instruction) => instruction._id) } }).lean<DeliveryDoc[]>(),
    Worker.find({ orgId })
      .select('_id name crewId')
      .lean(),
    Crew.find({ orgId }).select('_id name').lean(),
  ]);

  const workerById = new Map(workers.map((worker) => [String(worker._id), worker]));
  const crewNames = new Map(crews.map((crew) => [String(crew._id), crew.name]));
  const instructionById = new Map(instructions.map((instruction) => [String(instruction._id), instruction]));
  const orgTimezone = org?.timezone ?? 'Asia/Dubai';

  return deliveries.flatMap((delivery) => {
    const instruction = instructionById.get(String(delivery.instructionId));
    if (!instruction) return [];
    const worker = workerById.get(String(delivery.workerId));
    return [
      {
        instruction,
        delivery,
        workerName: worker?.name ?? '',
        crewName: worker ? crewNames.get(String(worker.crewId)) ?? '' : '',
        orgTimezone,
      },
    ];
  });
}

function instructionCsv(rows: DeliveryExportRow[], options: ExportOptions): string {
  return buildCsv([instructionHeader(options), ...rows.map((row) => instructionRow(row, options))]);
}

function csvResponse(res: Response, filename: string, csv: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadInstruction(orgId: string, id: string): Promise<InstructionDoc> {
  const instruction = await Instruction.findOne({ _id: id, orgId }).lean<InstructionDoc>();
  if (!instruction) throw new AppError('NOT_FOUND');
  return instruction;
}

exportsRouter.get(
  '/exports/instructions/:id',
  asyncHandler(async (req, res) => {
    const options = parseQuery(exportQuerySchema, req);
    const instruction = await loadInstruction(req.auth!.orgId, routeParam(req.params.id).replace(/\.csv$/i, ''));
    const rows = await exportRows(req.auth!.orgId, [instruction]);
    csvResponse(res, `understood_instruction_${dateStamp()}.csv`, instructionCsv(rows, {
      includeHelpReasons: options.includeHelpReasons === 'true',
      includeTimes: options.includeTimes === 'true',
    }));
  }),
);

function parseRangeDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === '' || typeof value !== 'string') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('VALIDATION_FAILED', [{ field, issue: 'must be an ISO-8601 date' }]);
  }
  return date;
}

async function orgInstructions(orgId: string, query: Record<string, unknown>): Promise<InstructionDoc[]> {
  const from = parseRangeDate(query.from, 'from');
  const to = parseRangeDate(query.to, 'to');
  const match: Record<string, unknown> = {
    orgId: new Types.ObjectId(orgId),
    status: { $in: ['shared', 'archived'] },
  };
  if (from || to) {
    match.sharedAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  }
  return Instruction.find(match).sort({ sharedAt: -1 }).lean<InstructionDoc[]>();
}

exportsRouter.get(
  '/exports/org.csv',
  asyncHandler(async (req, res) => {
    const instructions = await orgInstructions(req.auth!.orgId, req.query);
    const rows = await exportRows(req.auth!.orgId, instructions);
    csvResponse(res, `understood_org_${dateStamp()}.csv`, instructionCsv(rows, {
      includeHelpReasons: true,
      includeTimes: true,
    }));
  }),
);

async function workersCsv(orgId: string): Promise<string> {
  const [workers, crews] = await Promise.all([
    Worker.find({ orgId }).sort({ name: 1 }).lean(),
    Crew.find({ orgId }).select('_id name').lean(),
  ]);
  const crewNames = new Map(crews.map((crew) => [String(crew._id), crew.name]));
  return buildCsv([
    ['worker_id', 'name', 'language', 'phone', 'crew', 'status', 'created_at'],
    ...workers.map((worker) => [
      String(worker._id),
      worker.name,
      worker.language,
      worker.phoneE164 ?? '',
      crewNames.get(String(worker.crewId)) ?? '',
      worker.archivedAt ? 'archived' : 'active',
      iso(worker.createdAt),
    ]),
  ]);
}

async function instructionsCsv(orgId: string): Promise<string> {
  const [instructions, crews] = await Promise.all([
    Instruction.find({ orgId, status: { $in: ['shared', 'archived'] } }).sort({ sharedAt: -1 }).lean(),
    Crew.find({ orgId }).select('_id name').lean(),
  ]);
  const crewNames = new Map(crews.map((crew) => [String(crew._id), crew.name]));
  return buildCsv([
    ['instruction_id', 'title', 'type', 'source_language', 'status', 'crew', 'shared_at', 'created_at'],
    ...instructions.map((instruction) => [
      String(instruction._id),
      instruction.title ?? '',
      instruction.type,
      instruction.sourceLanguage,
      instruction.status,
      instruction.crewId ? crewNames.get(String(instruction.crewId)) ?? '' : '',
      iso(instruction.sharedAt),
      iso(instruction.createdAt),
    ]),
  ]);
}

exportsRouter.get(
  '/exports/workers.csv',
  asyncHandler(async (req, res) => {
    csvResponse(res, `understood_workers_${dateStamp()}.csv`, await workersCsv(req.auth!.orgId));
  }),
);

exportsRouter.get(
  '/exports/all.zip',
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.orgId;
    const [workers, instructions, deliveries] = await Promise.all([
      workersCsv(orgId),
      instructionsCsv(orgId),
      (async () => {
        const docs = await orgInstructions(orgId, {});
        const rows = await exportRows(orgId, docs);
        return instructionCsv(rows, { includeHelpReasons: true, includeTimes: true });
      })(),
    ]);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="understood_export_${dateStamp()}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (error) => {
      if (!res.headersSent) {
        res.status(500).json({ error: { code: 'INTERNAL', message: 'Export failed.' } });
      }
      void error;
    });
    archive.pipe(res);
    archive.append(workers, { name: 'workers.csv' });
    archive.append(instructions, { name: 'instructions.csv' });
    archive.append(deliveries, { name: 'deliveries.csv' });
    archive.append(
      [
        'Understood export',
        `Generated: ${new Date().toISOString()}`,
        '',
        'workers.csv — the full roster, including archived workers.',
        'instructions.csv — every shared or archived instruction.',
        'deliveries.csv — one row per worker per instruction with status, first attempt, and help data.',
        '',
        'Timestamps are ISO-8601 UTC. The org_timezone column gives the timezone used in the app.',
        'Values beginning with =, +, -, or @ are prefixed with an apostrophe to prevent spreadsheet formula injection.',
      ].join('\n'),
      { name: 'README.txt' },
    );
    await archive.finalize();
  }),
);
