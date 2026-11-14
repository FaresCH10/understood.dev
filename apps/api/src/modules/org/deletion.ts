import { Types } from 'mongoose';
import { logger } from '../../logger.js';
import { getStorage } from '../../media/storage.js';
import {
  AiUsage,
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

  await Delivery.deleteMany({ orgId });
  await Variant.deleteMany({ orgId });
  await Instruction.deleteMany({ orgId });
  await ImportRecord.deleteMany({ orgId });
  await AiUsage.deleteMany({ orgId });
  await EmailLog.deleteMany({ orgId });
  await Crew.deleteMany({ orgId });
  await Worker.deleteMany({ orgId });
  await User.deleteMany({ orgId });
  if (emails.length > 0) await MagicLink.deleteMany({ email: { $in: emails } });

  await getStorage().deletePrefix(`orgs/${payload.orgId}/`);

  await Organization.deleteOne({ _id: orgId });
  logger.info({ orgId: payload.orgId }, 'org deletion completed');
}
