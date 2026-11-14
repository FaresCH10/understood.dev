import mongoose, { Types } from 'mongoose';
import { logger } from '../../logger.js';
import { getStorage } from '../../media/storage.js';
import { revokeWorkerSessions } from '../access/control.js';
import { revokeAllSessions } from '../../auth/sessions.js';
import { OperationMutation } from '../operations/models.js';
import {
  AiUsage,
  AudioAsset,
  Crew,
  Delivery,
  EmailLog,
  ImportRecord,
  Instruction,
  MagicLink,
  Organization,
  User,
  Variant,
  Worker,
} from '../../models.js';

export interface OrgDeletionPayload {
  orgId: string;
}

export async function runOrgDeletionJob(payload: OrgDeletionPayload): Promise<void> {
  const orgId = new Types.ObjectId(payload.orgId);
  const org = await Organization.findById(orgId).lean();
  if (!org) return;

  const users = await User.find({ orgId }).select('email').lean();
  const emails = users.map((user) => user.email);
  const workers = await Worker.find({ orgId }).select('_id').lean();
  await Promise.all(users.map((user) => revokeAllSessions(String(user._id))));
  await Promise.all(workers.map((worker) => revokeWorkerSessions(String(worker._id))));
  await OperationMutation.deleteMany({ actorId: { $in: workers.map((worker) => String(worker._id)) } });

  await Delivery.deleteMany({ orgId });
  await Variant.deleteMany({ orgId });
  await Instruction.deleteMany({ orgId });
  await ImportRecord.deleteMany({ orgId });
  await AiUsage.deleteMany({ orgId });
  await AudioAsset.deleteMany({ orgId });
  await EmailLog.deleteMany({ orgId });
  await Crew.deleteMany({ orgId });
  await Worker.deleteMany({ orgId });
  await User.deleteMany({ orgId });
  // Include registered access/operations collections so newly introduced org data
  // cannot outlive its workspace. Models without orgId (such as magic links) are
  // handled explicitly above/below.
  for (const entry of Object.values(mongoose.models)) {
    if (entry.schema.path('orgId')) await entry.deleteMany({ orgId });
  }
  if (emails.length > 0) await MagicLink.deleteMany({ email: { $in: emails } });

  await getStorage().deletePrefix(`orgs/${payload.orgId}/`);

  await Organization.deleteOne({ _id: orgId });
  logger.info({ orgId: payload.orgId }, 'org deletion completed');
}
