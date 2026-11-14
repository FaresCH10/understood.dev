import type { Request } from 'express';
import { Organization, User, Worker, type StaffRole, type OrganizationDoc } from '../../models.js';
import { AppError } from '../../errors.js';
import { Site } from './models.js';
import { getKv } from '../../stores/kv.js';
import { tokenHash } from '../../auth/tokens.js';
import { isProduction } from '../../config.js';

export const STAFF_ROLES = ['owner', 'supervisor', 'administrator', 'auditor'] as const;
export const WORKER_COOKIE = isProduction ? '__Host-u_worker' : 'u_worker';

export function entitlementOf(org: OrganizationDoc) {
  const expired = Boolean(org.expiresAt && org.expiresAt.getTime() <= Date.now());
  return {
    status: expired ? 'expired' : org.accessStatus ?? 'pending',
    active: org.accessStatus === 'active' && !expired && !org.deletingAt,
    subscription: org.subscription ?? 'pilot',
    workerLimit: org.subscription === 'paid' ? org.workerLimit ?? 25 : 25,
    siteLimit: org.subscription === 'paid' ? org.siteLimit ?? 1 : 1,
    activatedAt: org.activatedAt ?? null,
    expiresAt: org.expiresAt ?? null,
  };
}

export async function requireEntitlement(orgId: string) {
  const org = await Organization.findById(orgId);
  if (!org) throw new AppError('AUTH_REQUIRED');
  const entitlement = entitlementOf(org);
  if (!entitlement.active) throw new AppError('FORBIDDEN', [{ field: 'entitlement', issue: entitlement.status }]);
  return entitlement;
}

export async function requireStaff(req: Request, roles: readonly StaffRole[] = STAFF_ROLES) {
  if (!req.auth) throw new AppError('AUTH_REQUIRED');
  const user = await User.findOne({ _id: req.auth.userId, orgId: req.auth.orgId });
  const org = await Organization.findById(req.auth.orgId);
  if (!user || !org || user.disabledAt || org.deletingAt) throw new AppError('AUTH_REQUIRED');
  // Legacy seeded magic-link users have no password; new password identities must verify.
  const hasPassword = await User.exists({ _id: user._id, passwordHash: { $exists: true } });
  if (hasPassword && !user.emailVerifiedAt) throw new AppError('FORBIDDEN', [{ field: 'email', issue: 'verification_required' }]);
  if (!roles.includes(user.role)) throw new AppError('FORBIDDEN');
  const sites = await Site.find({ orgId: org._id, archivedAt: null, ...(user.role === 'owner' ? {} : { _id: { $in: user.siteIds } }) }).select('_id');
  return { user, org, siteIds: sites.map((site) => String(site._id)), role: user.role };
}

export async function requireSite(req: Request, siteId: string, roles: readonly StaffRole[] = STAFF_ROLES) {
  const context = await requireStaff(req, roles);
  if (!context.siteIds.includes(siteId)) throw new AppError('FORBIDDEN');
  return context;
}

export interface WorkerSessionData { workerId: string; orgId: string; sharedDevice: boolean; createdAt: string }
export async function requireWorkerPortal(req: Request) {
  const token = req.cookies?.[WORKER_COOKIE];
  if (typeof token !== 'string' || token.length < 20) throw new AppError('AUTH_REQUIRED');
  const sessionHash = tokenHash(token);
  const raw = await getKv().get(`worker-sess:${sessionHash}`);
  if (!raw) throw new AppError('AUTH_REQUIRED');
  let session: WorkerSessionData;
  try { session = JSON.parse(raw) as WorkerSessionData; } catch { throw new AppError('AUTH_REQUIRED'); }
  const worker = await Worker.findOne({ _id: session.workerId, orgId: session.orgId, archivedAt: null, accessDisabled: { $ne: true } });
  const org = await Organization.findById(session.orgId);
  if (!worker || !org) throw new AppError('AUTH_REQUIRED');
  await requireEntitlement(session.orgId);
  if (worker.siteId && !(await Site.exists({ _id: worker.siteId, orgId: org._id, archivedAt: null }))) throw new AppError('FORBIDDEN');
  return { worker, org, sharedDevice: session.sharedDevice, sessionHash };
}

export async function revokeWorkerSessions(workerId: string) {
  const kv = getKv();
  const hashes = await kv.smembers(`worker-sessions:${workerId}`);
  await Promise.all(hashes.map((hash) => kv.del(`worker-sess:${hash}`)));
  await kv.del(`worker-sessions:${workerId}`);
}
