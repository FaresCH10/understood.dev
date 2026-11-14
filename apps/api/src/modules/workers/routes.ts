import { Router } from 'express';
import { Types } from 'mongoose';
import { objectIdSchema, paginationSchema, workerCreateSchema, workerPatchSchema, type Language } from '@understood/shared';
import { asyncHandler, parseBody, sendData } from '../../http.js';
import { AppError } from '../../errors.js';
import { Crew, ImportRecord, Worker } from '../../models.js';
import { requireAuth } from '../../auth/middleware.js';
import { normalizeWorkerName } from '../../domain/names.js';
import { encodeCursor, decodeCursor } from '../../domain/cursor.js';
import { buildCsv, parseWorkerImport } from './csv.js';
import { uploader, CSV_MIME } from '../../http/upload.js';
import { rateLimit } from '../../auth/rate-limit.js';

const workersRouter: Router = Router();
workersRouter.use(requireAuth);

const ACTIVE_WORKER_LIMIT = 1000;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

workersRouter.get(
  '/crews/:id/workers',
  asyncHandler(async (req, res) => {
    const query = paginationSchema.parse({
      limit: req.query.limit,
      cursor: req.query.cursor,
    });
    const crew = await Crew.findOne({ _id: req.params.id, orgId: req.auth!.orgId }).lean();
    if (!crew) throw new AppError('NOT_FOUND');

    const filter: Record<string, unknown> = {
      orgId: req.auth!.orgId,
      crewId: crew._id,
      archivedAt: null,
    };
    if (typeof req.query.language === 'string' && req.query.language) filter.language = req.query.language;
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      filter.normalizedName = { $regex: escapeRegex(normalizeWorkerName(req.query.search)), $options: '' };
    }
    const cursor = decodeCursor(query.cursor);
    if (cursor) {
      filter.$or = [
        { createdAt: { $lt: cursor.at } },
        { createdAt: cursor.at, _id: { $lt: new Types.ObjectId(cursor.id) } },
      ];
    }

    const workers = await Worker.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(query.limit + 1)
      .lean();

    const hasMore = workers.length > query.limit;
    const page = hasMore ? workers.slice(0, query.limit) : workers;
    const last = page[page.length - 1];

    sendData(
      res,
      page.map((worker) => ({
        id: String(worker._id),
        name: worker.name,
        language: worker.language,
        phoneE164: worker.phoneE164 ?? null,
        archived: Boolean(worker.archivedAt),
        createdAt: worker.createdAt,
      })),
      {
        nextCursor: hasMore && last ? encodeCursor(last.createdAt, String(last._id)) : null,
        total: await Worker.countDocuments({ orgId: req.auth!.orgId, crewId: crew._id, archivedAt: null }),
      },
    );
  }),
);

workersRouter.get(
  '/workers/template.csv',
  asyncHandler(async (_req, res) => {
    const csv = buildCsv([
      ['name', 'language', 'phone', 'crew'],
      ['Example Worker', 'ml', '+971501234567', 'Roof crew'],
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="understood_workers_template.csv"');
    res.send(csv);
  }),
);

workersRouter.post(
  '/workers',
  asyncHandler(async (req, res) => {
    const body = parseBody(workerCreateSchema, req);
    const crew = await Crew.findOne({ _id: body.crewId, orgId: req.auth!.orgId }).lean();
    if (!crew) throw new AppError('NOT_FOUND');

    const active = await Worker.countDocuments({ orgId: req.auth!.orgId, archivedAt: null });
    if (active >= ACTIVE_WORKER_LIMIT) throw new AppError('WORKER_LIMIT_REACHED');

    const normalizedName = normalizeWorkerName(body.name);
    const duplicate = await Worker.countDocuments({
      orgId: req.auth!.orgId,
      crewId: crew._id,
      normalizedName,
      archivedAt: null,
    });

    const worker = await Worker.create({
      orgId: req.auth!.orgId,
      crewId: crew._id,
      name: body.name,
      normalizedName,
      language: body.language,
      phoneE164: body.phoneE164 ?? null,
    });

    sendData(
      res,
      {
        id: String(worker._id),
        name: worker.name,
        language: worker.language,
        phoneE164: worker.phoneE164 ?? null,
        archived: false,
        createdAt: worker.createdAt,
      },
      duplicate > 0 ? { warning: 'duplicate_name' } : undefined,
      201,
    );
  }),
);

workersRouter.patch(
  '/workers/:id',
  asyncHandler(async (req, res) => {
    const body = parseBody(workerPatchSchema, req);
    const worker = await Worker.findOne({ _id: req.params.id, orgId: req.auth!.orgId });
    if (!worker) throw new AppError('NOT_FOUND');

    if (body.name !== undefined) {
      worker.name = body.name;
      worker.normalizedName = normalizeWorkerName(body.name);
    }
    if (body.language !== undefined) worker.language = body.language;
    if (body.phoneE164 !== undefined) worker.phoneE164 = body.phoneE164 ?? null;
    if (body.archived !== undefined) worker.archivedAt = body.archived ? worker.archivedAt ?? new Date() : null;
    await worker.save();

    sendData(res, {
      id: String(worker._id),
      name: worker.name,
      language: worker.language,
      phoneE164: worker.phoneE164 ?? null,
      archived: Boolean(worker.archivedAt),
    });
  }),
);

workersRouter.post(
  '/workers/import',
  rateLimit({ bucket: 'import-ip', limit: 20, windowSeconds: 3600 }),
  uploader(CSV_MIME).single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file || !file.originalname.toLowerCase().endsWith('.csv')) throw new AppError('UNSUPPORTED_MEDIA');

    const crewId = typeof req.body.crewId === 'string' && req.body.crewId ? req.body.crewId : null;
    if (crewId) {
      if (!objectIdSchema.safeParse(crewId).success) throw new AppError('NOT_FOUND');
      const crew = await Crew.findOne({ _id: crewId, orgId: req.auth!.orgId }).lean();
      if (!crew) throw new AppError('NOT_FOUND');
    }

    const parsed = parseWorkerImport(file.buffer.toString('utf8'));
    if (!crewId) {
      for (const row of parsed.rows) {
        if (!row.crewName) {
          parsed.errors.push({ row: row.row, field: 'crew', code: 'crew_required', message: 'Provide a crew name or choose a crew.' });
        }
      }
    }

    const existingNames = await Worker.find({
      orgId: req.auth!.orgId,
      archivedAt: null,
      ...(crewId ? { crewId } : {}),
    })
      .select('crewId name')
      .lean();
    const existingByCrew = new Map<string, Set<string>>();
    for (const worker of existingNames) {
      const key = String(worker.crewId);
      const set = existingByCrew.get(key) ?? new Set<string>();
      set.add(normalizeWorkerName(worker.name));
      existingByCrew.set(key, set);
    }

    const crewByName = new Map<string, Types.ObjectId>();
    if (!crewId) {
      const crews = await Crew.find({ orgId: req.auth!.orgId, archivedAt: null }).select('name').lean();
      for (const crew of crews) crewByName.set(crew.name.toLowerCase(), crew._id);
    }

    for (const row of parsed.rows) {
      const key = crewId ?? (row.crewName ? String(crewByName.get(row.crewName.toLowerCase())) : '');
      const set = key ? existingByCrew.get(key) : undefined;
      if (set?.has(row.normalizedName)) {
        parsed.warnings.push({
          row: row.row,
          code: 'duplicate_name',
          message: 'A worker with this name already exists in this crew; both will be kept.',
        });
      }
    }

    const record = await ImportRecord.create({
      orgId: req.auth!.orgId,
      fileName: file.originalname.slice(0, 200),
      status: parsed.errors.length > 0 ? 'invalid' : 'parsed',
      crewId: crewId ? new Types.ObjectId(crewId) : null,
      totalRows: parsed.totalRows,
      validRows: parsed.rows.length,
      errors: parsed.errors,
      warnings: parsed.warnings,
      rows: parsed.rows.map(({ row, name, language, phoneE164, crewName }) => ({
        row,
        name,
        language,
        phoneE164,
        crewName,
      })),
      expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    sendData(res, {
      importId: String(record._id),
      status: record.status,
      totalRows: record.totalRows,
      validRows: record.validRows,
      errorCount: record.errors.length,
      errors: record.errors.slice(0, 50),
      warningCount: record.warnings.length,
      warnings: record.warnings.slice(0, 50),
    });
  }),
);

workersRouter.get(
  '/imports/:id',
  asyncHandler(async (req, res) => {
    const record = await ImportRecord.findOne({ _id: req.params.id, orgId: req.auth!.orgId }).lean();
    if (!record) throw new AppError('NOT_FOUND');
    sendData(res, {
      importId: String(record._id),
      fileName: record.fileName,
      status: record.status,
      totalRows: record.totalRows,
      validRows: record.validRows,
      errors: record.errors,
      warnings: record.warnings,
      rows: record.rows.slice(0, 200),
      committedAt: record.committedAt ?? null,
    });
  }),
);

workersRouter.post(
  '/imports/:id/commit',
  asyncHandler(async (req, res) => {
    const record = await ImportRecord.findOne({ _id: req.params.id, orgId: req.auth!.orgId });
    if (!record) throw new AppError('NOT_FOUND');
    if (record.status === 'committed') throw new AppError('IMPORT_ALREADY_COMMITTED');
    if (record.errors.length > 0) throw new AppError('IMPORT_INVALID');

    const active = await Worker.countDocuments({ orgId: req.auth!.orgId, archivedAt: null });
    if (active + record.rows.length > ACTIVE_WORKER_LIMIT) throw new AppError('WORKER_LIMIT_REACHED');

    const crewCache = new Map<string, Types.ObjectId>();
    if (record.crewId) {
      const crew = await Crew.findOne({ _id: record.crewId, orgId: req.auth!.orgId }).lean();
      if (!crew) throw new AppError('NOT_FOUND');
      crewCache.set('', crew._id);
    } else {
      const crews = await Crew.find({ orgId: req.auth!.orgId, archivedAt: null }).select('name').lean();
      for (const crew of crews) crewCache.set(crew.name.toLowerCase(), crew._id);
    }

    const session = await Worker.startSession();
    try {
      let created = 0;
      await session.withTransaction(async () => {
        const fresh = await ImportRecord.findOne({ _id: record._id, status: { $ne: 'committed' } }).session(session);
        if (!fresh) throw new AppError('IMPORT_ALREADY_COMMITTED');

        for (const row of record.rows) {
          let key = '';
          let crewObjectId: Types.ObjectId;
          if (record.crewId) {
            crewObjectId = record.crewId;
          } else {
            key = (row.crewName ?? '').toLowerCase();
            let found = crewCache.get(key);
            if (!found) {
              const [crew] = await Crew.create(
                [{ orgId: req.auth!.orgId, name: (row.crewName ?? 'Crew').slice(0, 80) }],
                { session },
              );
              found = crew!._id;
              crewCache.set(key, found);
            }
            crewObjectId = found;
          }

          await Worker.create(
            [
              {
                orgId: req.auth!.orgId,
                crewId: crewObjectId,
                name: row.name,
                normalizedName: normalizeWorkerName(row.name),
                language: row.language as Language,
                phoneE164: row.phoneE164 ?? null,
              },
            ],
            { session },
          );
          created += 1;
        }

        await ImportRecord.updateOne(
          { _id: record._id },
          { $set: { status: 'committed', committedAt: new Date() } },
          { session },
        );
      });

      sendData(res, { created }, undefined, 201);
    } finally {
      await session.endSession();
    }
  }),
);

export default workersRouter;
