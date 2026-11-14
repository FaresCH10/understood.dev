import { Router } from 'express';
import { Types } from 'mongoose';
import { crewCreateSchema, crewPatchSchema } from '@understood/shared';
import { asyncHandler, parseBody, sendData } from '../../http.js';
import { AppError } from '../../errors.js';
import { Crew, Worker } from '../../models.js';
import { requireAuth } from '../../auth/middleware.js';

const crewsRouter: Router = Router();
crewsRouter.use(requireAuth);

async function languageSummary(orgId: Types.ObjectId, crewIds: Types.ObjectId[]) {
  const grouped = await Worker.aggregate<{ _id: { crewId: Types.ObjectId; language: string }; count: number }>([
    { $match: { orgId, crewId: { $in: crewIds }, archivedAt: null } },
    { $group: { _id: { crewId: '$crewId', language: '$language' }, count: { $sum: 1 } } },
  ]);

  const map = new Map<string, Record<string, number>>();
  for (const entry of grouped) {
    const key = String(entry._id.crewId);
    const languages = map.get(key) ?? {};
    languages[entry._id.language] = entry.count;
    map.set(key, languages);
  }
  return map;
}

crewsRouter.get(
  '/crews',
  asyncHandler(async (req, res) => {
    const includeArchived = req.query.includeArchived === 'true';
    const orgId = new Types.ObjectId(req.auth!.orgId);
    const crews = await Crew.find({ orgId, ...(includeArchived ? {} : { archivedAt: null }) })
      .sort({ createdAt: -1 })
      .lean();
    const ids = crews.map((crew) => crew._id);
    const counts = await Worker.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { orgId, crewId: { $in: ids }, archivedAt: null } },
      { $group: { _id: '$crewId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((entry) => [String(entry._id), entry.count]));
    const languages = await languageSummary(orgId, ids);

    sendData(
      res,
      crews.map((crew) => ({
        id: String(crew._id),
        name: crew.name,
        archived: Boolean(crew.archivedAt),
        workerCount: countMap.get(String(crew._id)) ?? 0,
        languages: languages.get(String(crew._id)) ?? {},
        createdAt: crew.createdAt,
      })),
    );
  }),
);

crewsRouter.post(
  '/crews',
  asyncHandler(async (req, res) => {
    const body = parseBody(crewCreateSchema, req);
    const crew = await Crew.create({ orgId: req.auth!.orgId, name: body.name });
    sendData(res, { id: String(crew._id), name: crew.name, archived: false, workerCount: 0 }, undefined, 201);
  }),
);

crewsRouter.patch(
  '/crews/:id',
  asyncHandler(async (req, res) => {
    const body = parseBody(crewPatchSchema, req);
    const crew = await Crew.findOne({ _id: req.params.id, orgId: req.auth!.orgId });
    if (!crew) throw new AppError('NOT_FOUND');

    if (body.name !== undefined) crew.name = body.name;
    if (body.archived !== undefined) crew.archivedAt = body.archived ? crew.archivedAt ?? new Date() : null;
    await crew.save();

    sendData(res, {
      id: String(crew._id),
      name: crew.name,
      archived: Boolean(crew.archivedAt),
      workerCount: await Worker.countDocuments({ orgId: crew.orgId, crewId: crew._id, archivedAt: null }),
    });
  }),
);

crewsRouter.get(
  '/crews/:id',
  asyncHandler(async (req, res) => {
    const crew = await Crew.findOne({ _id: req.params.id, orgId: req.auth!.orgId }).lean();
    if (!crew) throw new AppError('NOT_FOUND');

    const [workers, archivedWorkers] = await Promise.all([
      Worker.countDocuments({ orgId: crew.orgId, crewId: crew._id, archivedAt: null }),
      Worker.countDocuments({ orgId: crew.orgId, crewId: crew._id, archivedAt: { $ne: null } }),
    ]);

    sendData(res, {
      id: String(crew._id),
      name: crew.name,
      archived: Boolean(crew.archivedAt),
      counts: { workers, archivedWorkers },
      createdAt: crew.createdAt,
    });
  }),
);

export default crewsRouter;
