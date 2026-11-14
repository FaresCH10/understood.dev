import { Router } from 'express';
import { Schema, model, Types } from 'mongoose';
import { z } from 'zod';
import { Organization, User, Worker, Delivery, ImportRecord } from '../../models.js';
import { requireStaff, requireWorkerPortal, revokeWorkerSessions, WORKER_COOKIE } from '../access/control.js';
import { revokeAllSessions, clearSessionCookie } from '../../auth/sessions.js';
import { asyncHandler, parseBody, routeParam, sendData } from '../../http.js';
import { AppError } from '../../errors.js';
import { getQueue } from '../../jobs/queue.js';
import { getStorage } from '../../media/storage.js';
import { logger } from '../../logger.js';
import { isProduction } from '../../config.js';
import { Assignment, Operation, Notification, OperationAudit, OperationMutation, Upload } from './models.js';
import { PushSubscription } from './push.js';

const erasureSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, required: true },
  keys: { type: [String], default: [] },
  attempts: { type: Number, default: 0 },
}, { timestamps: true, collection: 'privacy_erasures' });
erasureSchema.index({ orgId: 1, createdAt: 1 });
export const PrivacyErasure = model('PrivacyErasure', erasureSchema);

export const privacyRouter = Router();
export const workerPrivacyRouter = Router();
const DEFAULT_NOTICE = 'Record only work-related information. Recordings and photos are shared with authorized company staff. Do not include personal documents or private conversations.';
const DEFAULT_NOTICE_AR = 'سجّل المعلومات المتعلقة بالعمل فقط. تُشارك التسجيلات والصور مع موظفي الشركة المخولين. لا تُدرج وثائق شخصية أو محادثات خاصة.';
interface PrivacyPolicy { recordingNotice?: string; recordingNoticeAr?: string; retentionDays?: number | null; lastCleanupAt?: string | null }
export function privacyOf(features: Record<string, unknown> = {}) {
  const privacy = (features.privacy ?? {}) as PrivacyPolicy;
  return {
    recordingNotice: privacy.recordingNotice ?? DEFAULT_NOTICE,
    recordingNoticeAr: privacy.recordingNoticeAr ?? DEFAULT_NOTICE_AR,
    retentionDays: privacy.retentionDays ?? null,
    lastCleanupAt: privacy.lastCleanupAt ?? null,
    retentionScope: 'Completed or withdrawn response records; current roster and source instructions remain until separately deleted.',
  };
}

privacyRouter.get('/privacy', asyncHandler(async (req, res) => {
  const { org } = await requireStaff(req);
  sendData(res, privacyOf(org.features));
}));
privacyRouter.patch('/privacy', asyncHandler(async (req, res) => {
  const { org, user } = await requireStaff(req, ['owner']);
  const body = parseBody(z.object({ recordingNotice: z.string().trim().min(20).max(2000).optional(), recordingNoticeAr: z.string().trim().min(20).max(2000).optional(), retentionDays: z.number().int().min(30).max(3650).nullable().optional() }).strict(), req);
  const previous = (org.features.privacy ?? {}) as PrivacyPolicy;
  await Organization.updateOne({ _id: org._id }, { $set: { 'features.privacy': { ...previous, ...body } } });
  await OperationAudit.create({ orgId: org._id, actorId: String(user._id), action: 'privacy.updated', subjectId: String(org._id), detail: { fields: Object.keys(body), retentionDays: body.retentionDays } });
  sendData(res, privacyOf({ privacy: { ...previous, ...body } }));
}));
workerPrivacyRouter.get('/', asyncHandler(async (req, res) => {
  const { org } = await requireWorkerPortal(req);
  res.setHeader('Cache-Control', 'no-store');
  sendData(res, privacyOf(org.features));
}));

async function referenced(key: string, orgId: Types.ObjectId) {
  const [assignment, operation] = await Promise.all([
    Assignment.exists({ orgId, $or: [{ photoKey: key }, { 'attempts.audioKey': key }, { 'variant.audioKey': key }, { 'presentations.audioKey': key }, { 'snapshot.variants.audioKey': key }, { 'snapshot.attachments.key': key }] }),
    Operation.exists({ orgId, $or: [{ 'attachments.key': key }, { 'variants.audioKey': key }, { 'publications.variants.audioKey': key }, { 'publications.attachments.key': key }] }),
  ]);
  return Boolean(assignment || operation);
}

export async function drainPrivacyErasures(orgId?: string): Promise<number> {
  let removed = 0;
  const records = await PrivacyErasure.find(orgId ? { orgId } : {}).sort({ createdAt: 1 }).limit(100);
  for (const record of records) {
    const remaining: string[] = [];
    for (const key of record.keys) {
      if (!key.startsWith(`orgs/${record.orgId}/`)) continue;
      if (await referenced(key, record.orgId)) continue; // Never remove a shared instruction asset.
      try { await getStorage().delete(key); removed += 1; }
      catch { remaining.push(key); }
    }
    if (remaining.length) await PrivacyErasure.updateOne({ _id: record._id }, { $set: { keys: remaining }, $inc: { attempts: 1 } });
    else await PrivacyErasure.deleteOne({ _id: record._id });
  }
  return removed;
}

privacyRouter.delete('/workers/:id', asyncHandler(async (req, res) => {
  const { org, user, siteIds } = await requireStaff(req, ['owner']);
  const { confirmWorkerId } = parseBody(z.object({ confirmWorkerId: z.string().trim().min(1).max(80) }).strict(), req);
  const workerId = new Types.ObjectId(z.string().regex(/^[a-f\d]{24}$/i).parse(routeParam(req.params.id)));
  const session = await Worker.startSession();
  let deletedAssignments = 0;
  try {
    await session.withTransaction(async () => {
      const worker = await Worker.findOne({ _id: workerId, orgId: org._id, siteId: { $in: siteIds } }).session(session);
      if (!worker) throw new AppError('NOT_FOUND');
      if (!worker.workerId || worker.workerId !== confirmWorkerId) throw new AppError('VALIDATION_FAILED', [{ field: 'confirmWorkerId', issue: 'must_match_worker_id' }]);
      const assignments = await Assignment.find({ orgId: org._id, workerId }).session(session);
      const uploads = await Upload.find({ orgId: org._id, ownerId: String(workerId) }).session(session);
      const keys = new Set(uploads.map((upload) => upload.key));
      for (const assignment of assignments) {
        if (assignment.photoKey) keys.add(assignment.photoKey);
        for (const attempt of assignment.attempts) if (attempt.audioKey) keys.add(attempt.audioKey);
        for (const presentation of assignment.presentations ?? []) if (presentation.audioKey) keys.add(presentation.audioKey);
        assignment.workerName = 'Deleted worker'; assignment.workerCode = '[deleted]'; assignment.photoKey = null;
        assignment.presentations = [];
        // Keep fact-matching evidence and its original timestamps; remove private content.
        for (const attempt of assignment.attempts) { attempt.text = null; attempt.audioKey = null; }
        for (const message of assignment.messages) { message.text = '[Removed with worker profile]'; if (message.author === 'worker') message.authorId = 'deleted-worker'; }
        assignment.help.open = false; assignment.help.reason = 'Worker profile removed';
        assignment.needsAnswer = false;
        if (assignment.status !== 'completed') assignment.status = 'withdrawn';
        await assignment.save({ session });
      }
      const audienceFilter = [{ 'member.workerId': String(workerId) }];
      await Assignment.updateMany({ orgId: org._id, 'snapshot.audience.workerId': String(workerId) }, { $set: { 'snapshot.audience.$[member].name': 'Deleted worker' } }, { session, arrayFilters: audienceFilter });
      await Operation.updateMany({ orgId: org._id, 'publications.audience.workerId': String(workerId) }, { $set: { 'publications.$[].audience.$[member].name': 'Deleted worker' } }, { session, arrayFilters: audienceFilter });
      await Operation.updateMany({ orgId: org._id, workerIds: workerId }, { $pull: { workerIds: workerId } }, { session });
      await Notification.deleteMany({ orgId: org._id, $or: [{ workerId }, { assignmentId: { $in: assignments.map((assignment) => assignment._id) } }, { title: worker.name, body: 'Language change requested.' }] }).session(session);
      await OperationMutation.deleteMany({ actorId: String(workerId) }).session(session);
      await PushSubscription.deleteMany({ orgId: org._id, actorId: String(workerId) }).session(session);
      await Delivery.updateMany({ orgId: org._id, workerId }, { $set: { deliveryTokens: [] } }, { session });
      await ImportRecord.deleteMany({ orgId: org._id, 'rows.name': worker.name }).session(session);
      await Upload.deleteMany({ orgId: org._id, ownerId: String(workerId) }).session(session);
      if (keys.size) await PrivacyErasure.create([{ orgId: org._id, keys: [...keys] }], { session });
      await Worker.deleteOne({ _id: workerId, orgId: org._id }).session(session);
      await OperationAudit.create([{ orgId: org._id, siteId: worker.siteId, actorId: String(user._id), action: 'worker.profile_deleted', subjectId: String(workerId), detail: { assignmentsRetained: assignments.length } }], { session });
      deletedAssignments = assignments.length;
    });
  } finally { await session.endSession(); }
  await revokeWorkerSessions(String(workerId));
  await drainPrivacyErasures(String(org._id)).catch((error) => logger.error({ err: String(error), orgId: String(org._id) }, 'privacy media erasure pending'));
  sendData(res, { deleted: true, assignmentsAnonymized: deletedAssignments, history: 'Timestamps and fact-matching outcomes retained; private text and recordings removed.' });
}));

privacyRouter.post('/workspace/delete', asyncHandler(async (req, res) => {
  const { org, user } = await requireStaff(req, ['owner']);
  const { confirmName } = parseBody(z.object({ confirmName: z.string().min(1).max(120) }).strict(), req);
  if (org.name !== confirmName) throw new AppError('VALIDATION_FAILED', [{ field: 'confirmName', issue: 'must_match_company_name' }]);
  const updated = await Organization.updateOne({ _id: org._id, deletingAt: null }, { $set: { deletingAt: new Date() } });
  if (!updated.modifiedCount) throw new AppError('CONFLICT_STATE');
  try {
    await getQueue().enqueue('cleanup', { orgId: String(org._id) }, { jobId: `org_delete_${org._id}`, delay: 2000 });
  } catch (error) {
    await Organization.updateOne({ _id: org._id }, { $set: { deletingAt: null } });
    throw error;
  }
  await OperationAudit.create({ orgId: org._id, actorId: String(user._id), action: 'workspace.deletion_requested', subjectId: String(org._id) });
  const [users, workers] = await Promise.all([User.find({ orgId: org._id }).select('_id'), Worker.find({ orgId: org._id }).select('_id')]);
  await Promise.all([...users.map((staff) => revokeAllSessions(String(staff._id))), ...workers.map((worker) => revokeWorkerSessions(String(worker._id)))]);
  clearSessionCookie(res); res.clearCookie(WORKER_COOKIE, { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' });
  res.setHeader('Clear-Site-Data', '"cache", "storage"');
  sendData(res, { deletionQueued: true }, undefined, 202);
}));

/** Deletes only terminal response records; source instruction assets remain intact. */
export async function runRetentionCleanup(): Promise<{ assignmentsRemoved: number; mediaRemoved: number }> {
  let assignmentsRemoved = 0;
  const organizations = await Organization.find({ deletingAt: null, 'features.privacy.retentionDays': { $type: 'number', $gte: 30 } }).limit(1000);
  for (const org of organizations) {
    const days = privacyOf(org.features).retentionDays;
    if (!days || !Number.isFinite(days)) continue;
    const cutoff = new Date(Date.now() - days * 86400_000);
    const session = await Assignment.startSession();
    let removedForOrg = 0;
    try {
      await session.withTransaction(async () => {
        const assignments = await Assignment.find({ orgId: org._id, status: { $in: ['completed', 'withdrawn'] }, updatedAt: { $lt: cutoff } }).limit(500).session(session);
        const ids = assignments.map((assignment) => assignment._id);
        const keys = new Set<string>();
        for (const assignment of assignments) {
          if (assignment.photoKey) keys.add(assignment.photoKey);
          for (const attempt of assignment.attempts) if (attempt.audioKey) keys.add(attempt.audioKey);
          for (const presentation of assignment.presentations ?? []) if (presentation.audioKey) keys.add(presentation.audioKey);
        }
        if (keys.size) await PrivacyErasure.create([{ orgId: org._id, keys: [...keys] }], { session });
        await Assignment.deleteMany({ _id: { $in: ids }, orgId: org._id }).session(session);
        await Notification.deleteMany({ orgId: org._id, assignmentId: { $in: ids } }).session(session);
        await Upload.deleteMany({ orgId: org._id, key: { $in: [...keys] } }).session(session);
        await Organization.updateOne({ _id: org._id }, { $set: { 'features.privacy.lastCleanupAt': new Date().toISOString() } }, { session });
        if (ids.length) await OperationAudit.create([{ orgId: org._id, actorId: 'retention-policy', action: 'retention.responses_deleted', subjectId: String(org._id), detail: { count: ids.length, retentionDays: days } }], { session });
        removedForOrg = ids.length;
      });
    } finally { await session.endSession(); }
    assignmentsRemoved += removedForOrg;
  }
  return { assignmentsRemoved, mediaRemoved: await drainPrivacyErasures() };
}
