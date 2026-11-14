import { Router } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import { z } from 'zod';
import { emailSchema, objectIdSchema } from '@understood/shared';
import { Organization, User, Worker } from '../../models.js';
import { AccessToken, AuditEvent, Invoice, PlanRequest, Site } from './models.js';
import { entitlementOf, requireEntitlement, requireSite, requireStaff, revokeWorkerSessions } from './control.js';
import { asyncHandler, parseBody, routeParam, sendData } from '../../http.js';
import { AppError } from '../../errors.js';
import { randomToken, tokenHash } from '../../auth/tokens.js';
import { hashPassword } from '../../auth/passwords.js';
import { revokeAllSessions } from '../../auth/sessions.js';
import { sendEmail } from '../../email/mailer.js';
import { config } from '../../config.js';
import { passwordSchema, timezoneSchema } from './staff-auth.js';
import { rateLimit } from '../../auth/rate-limit.js';

export const accessRouter = Router();
const adminRoles = ['owner', 'administrator'] as const;
const operator = (authorization?: string) => {
  const expected = process.env.PLATFORM_OPERATOR_TOKEN;
  const provided = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || expected.length < 32 || !provided || !timingSafeEqual(createHash('sha256').update(expected).digest(), createHash('sha256').update(provided).digest())) throw new AppError('FORBIDDEN');
};
const staffView = (user: { _id: unknown; name?: string; email: string; role: string; siteIds: Types.ObjectId[]; disabledAt?: Date | null }) => ({ id: String(user._id), name: user.name, email: user.email, role: user.role, siteIds: user.siteIds.map(String), disabled: Boolean(user.disabledAt) });
const siteView = (site: { _id: unknown; name: string; timezone: string; archivedAt?: Date | null }) => ({ id: String(site._id), name: site.name, timezone: site.timezone, archived: Boolean(site.archivedAt) });

accessRouter.get('/workspace', asyncHandler(async (req, res) => {
  const context = await requireStaff(req);
  const sites = await Site.find({ orgId: context.org._id, _id: { $in: context.siteIds } }).sort({ name: 1 });
  sendData(res, { user: staffView(context.user), org: { id: String(context.org._id), name: context.org.name, companyId: context.org.companyId, timezone: context.org.timezone }, sites: sites.map(siteView), entitlement: entitlementOf(context.org) });
}));

accessRouter.patch('/workspace', asyncHandler(async (req, res) => {
  const { org, user } = await requireStaff(req, ['owner']);
  const body = parseBody(z.object({ name: z.string().trim().min(2).max(120).optional(), timezone: timezoneSchema.optional(), locale: z.enum(['en', 'ar']).optional() }).strict(), req);
  if (body.name !== undefined) org.name = body.name;
  if (body.timezone !== undefined) org.timezone = body.timezone;
  if (body.locale !== undefined) org.locale = body.locale;
  await org.save();
  await AuditEvent.create({ orgId: org._id, actorId: String(user._id), action: 'workspace.updated', subjectId: String(org._id) });
  sendData(res, { id: String(org._id), name: org.name, companyId: org.companyId, timezone: org.timezone, locale: org.locale });
}));

accessRouter.get('/sites', asyncHandler(async (req, res) => {
  const { org, user } = await requireStaff(req);
  const sites = await Site.find({ orgId: org._id, ...(user.role === 'owner' ? {} : { _id: { $in: user.siteIds } }) }).sort({ name: 1 });
  sendData(res, sites.map(siteView));
}));

accessRouter.get('/operational-staff', asyncHandler(async (req, res) => {
  const { org, siteIds } = await requireStaff(req, ['owner', 'supervisor']);
  await requireEntitlement(String(org._id));
  const wanted = typeof req.query.siteId === 'string' ? objectIdSchema.parse(req.query.siteId) : null;
  if (wanted && !siteIds.includes(wanted)) throw new AppError('FORBIDDEN');
  const authorizedSites = wanted ? [wanted] : siteIds;
  const users = await User.find({ orgId: org._id, disabledAt: null, role: { $in: ['owner', 'supervisor'] },
    $and: [{ $or: [{ role: 'owner' }, { siteIds: { $in: authorizedSites } }] }, { $or: [{ passwordHash: { $exists: false } }, { emailVerifiedAt: { $ne: null } }] }],
  }).select('_id name role siteIds').sort({ name: 1 });
  sendData(res, users.map((user) => ({ id: String(user._id), name: user.name ?? (user.role === 'owner' ? 'Owner' : 'Supervisor'), role: user.role,
    siteIds: user.role === 'owner' ? authorizedSites : user.siteIds.map(String).filter((id) => authorizedSites.includes(id)) })));
}));

accessRouter.post('/sites', asyncHandler(async (req, res) => {
  const { org, user } = await requireStaff(req, ['owner']);
  await requireEntitlement(String(org._id));
  const body = parseBody(z.object({ name: z.string().trim().min(1).max(120), timezone: timezoneSchema }).strict(), req);
  const session = await Organization.startSession();
  let site;
  try {
    await session.withTransaction(async () => {
      await Organization.updateOne({ _id: org._id }, { $inc: { 'features.quotaVersion': 1 } }, { session });
      const current = await Organization.findById(org._id).session(session);
      if (!current) throw new AppError('NOT_FOUND');
      const count = await Site.countDocuments({ orgId: org._id, archivedAt: null }).session(session);
      if (count >= entitlementOf(current).siteLimit) throw new AppError('FORBIDDEN', [{ field: 'site', issue: 'site_limit_reached' }]);
      [site] = await Site.create([{ orgId: org._id, ...body }], { session });
    });
  } finally { await session.endSession(); }
  await AuditEvent.create({ orgId: org._id, actorId: String(user._id), action: 'site.created', subjectId: String(site!._id) });
  sendData(res, siteView(site!), undefined, 201);
}));

accessRouter.patch('/sites/:id', asyncHandler(async (req, res) => {
  const { org, user } = await requireStaff(req, ['owner']);
  const body = parseBody(z.object({ name: z.string().trim().min(1).max(120).optional(), timezone: timezoneSchema.optional(), archived: z.boolean().optional() }).strict(), req);
  const id = objectIdSchema.parse(routeParam(req.params.id));
  const session = await Organization.startSession();
  let site;
  try {
    await session.withTransaction(async () => {
      await Organization.updateOne({ _id: org._id }, { $inc: { 'features.quotaVersion': 1 } }, { session });
      site = await Site.findOne({ _id: id, orgId: org._id }).session(session);
      if (!site) throw new AppError('NOT_FOUND');
      if (body.archived === false && site.archivedAt) {
        const current = await Organization.findById(org._id).session(session);
        const count = await Site.countDocuments({ orgId: org._id, archivedAt: null }).session(session);
        if (!current || count >= entitlementOf(current).siteLimit) throw new AppError('FORBIDDEN');
      }
      if (body.name !== undefined) site.name = body.name;
      if (body.timezone !== undefined) site.timezone = body.timezone;
      if (body.archived !== undefined) site.archivedAt = body.archived ? new Date() : null;
      await site.save({ session });
    });
  } finally { await session.endSession(); }
  await AuditEvent.create({ orgId: org._id, actorId: String(user._id), action: 'site.updated', subjectId: id });
  sendData(res, siteView(site!));
}));

accessRouter.get('/staff', asyncHandler(async (req, res) => {
  const { org, user } = await requireStaff(req, adminRoles);
  const users = await User.find({ orgId: org._id }).sort({ createdAt: 1 });
  const invitations = await AccessToken.find({ orgId: org._id, purpose: 'invite', usedAt: null, expiresAt: { $gt: new Date() } }).select('email role siteIds expiresAt').sort({ createdAt: -1 });
  const authorized = (siteIds: Types.ObjectId[]) => user.role === 'owner' || siteIds.every((id) => user.siteIds.map(String).includes(String(id)));
  sendData(res, { users: users.filter((target) => target._id.equals(user._id) || authorized(target.siteIds)).map(staffView), invitations: invitations.filter((invite) => authorized(invite.siteIds)).map((invite) => ({ id: String(invite._id), email: invite.email, role: invite.role, siteIds: invite.siteIds.map(String), expiresAt: invite.expiresAt })) });
}));

accessRouter.post('/invitations', rateLimit({ bucket: 'staff-invites', limit: 20, windowSeconds: 3600 }), asyncHandler(async (req, res) => {
  const { org, user } = await requireStaff(req, adminRoles);
  const body = parseBody(z.object({ email: emailSchema, role: z.enum(['supervisor', 'administrator', 'auditor']), siteIds: z.array(objectIdSchema).min(1).max(100) }).strict(), req);
  if (user.role !== 'owner' && body.role === 'administrator') throw new AppError('FORBIDDEN');
  const siteIds = [...new Set(body.siteIds)];
  const count = await Site.countDocuments({ orgId: org._id, _id: { $in: siteIds }, archivedAt: null });
  if (count !== siteIds.length || (user.role !== 'owner' && siteIds.some((siteId) => !user.siteIds.map(String).includes(siteId)))) throw new AppError('FORBIDDEN');
  if (await User.exists({ email: body.email })) throw new AppError('CONFLICT_STATE');
  const token = randomToken(32);
  const invite = await AccessToken.create({ orgId: org._id, email: body.email, purpose: 'invite', role: body.role, siteIds, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 7 * 86400_000) });
  await sendEmail({ to: body.email, orgId: String(org._id), template: 'magic_link', subject: `Join ${org.name} on Understood`, text: `Accept your invitation: ${config.APP_URL}/signin?invite=${encodeURIComponent(token)}\nThis link expires in 7 days.` });
  await AuditEvent.create({ orgId: org._id, actorId: String(user._id), action: 'staff.invited', subjectId: String(invite._id), details: { role: body.role, siteIds } });
  sendData(res, { sent: true }, undefined, 201);
}));

accessRouter.patch('/staff/:id', asyncHandler(async (req, res) => {
  const { org, user } = await requireStaff(req, adminRoles);
  const body = parseBody(z.object({ role: z.enum(['supervisor', 'administrator', 'auditor']).optional(), siteIds: z.array(objectIdSchema).min(1).max(100).optional(), disabled: z.boolean().optional() }).strict(), req);
  const target = await User.findOne({ _id: routeParam(req.params.id), orgId: org._id });
  if (!target) throw new AppError('NOT_FOUND');
  if (target.role === 'owner' || target._id.equals(user._id)) throw new AppError('FORBIDDEN');
  if (user.role !== 'owner' && (target.role === 'administrator' || body.role === 'administrator')) throw new AppError('FORBIDDEN');
  if (user.role !== 'owner' && target.siteIds.some((id) => !user.siteIds.map(String).includes(String(id)))) throw new AppError('FORBIDDEN');
  if (body.siteIds) {
    const ids = [...new Set(body.siteIds)];
    const count = await Site.countDocuments({ orgId: org._id, _id: { $in: ids }, archivedAt: null });
    if (count !== ids.length || (user.role !== 'owner' && ids.some((id) => !user.siteIds.map(String).includes(id)))) throw new AppError('FORBIDDEN');
    target.siteIds = ids.map((id) => new Types.ObjectId(id));
  }
  if (body.role !== undefined) target.role = body.role;
  if (body.disabled !== undefined) target.disabledAt = body.disabled ? new Date() : null;
  await target.save();
  await revokeAllSessions(String(target._id));
  await AuditEvent.create({ orgId: org._id, actorId: String(user._id), action: 'staff.updated', subjectId: String(target._id) });
  sendData(res, staffView(target));
}));

accessRouter.post('/workers/:id/reset-password', asyncHandler(async (req, res) => {
  const body = parseBody(z.object({ password: passwordSchema }).strict(), req);
  const { org, user, siteIds } = await requireStaff(req, ['owner', 'supervisor']);
  const worker = await Worker.findOne({ _id: routeParam(req.params.id), orgId: org._id, siteId: { $in: siteIds } });
  if (!worker) throw new AppError('NOT_FOUND');
  worker.passwordHash = await hashPassword(body.password); await worker.save();
  await revokeWorkerSessions(String(worker._id));
  await AuditEvent.create({ orgId: org._id, actorId: String(user._id), action: 'worker.credentials_reset', subjectId: String(worker._id) });
  sendData(res, { reset: true });
}));

accessRouter.patch('/workers/:id/access', asyncHandler(async (req, res) => {
  const { disabled } = parseBody(z.object({ disabled: z.boolean() }).strict(), req);
  const { org, user, siteIds } = await requireStaff(req, ['owner', 'supervisor']);
  const workerId = objectIdSchema.parse(routeParam(req.params.id));
  const session = await Organization.startSession();
  try {
    await session.withTransaction(async () => {
      await Organization.updateOne({ _id: org._id }, { $inc: { 'features.rosterRevision': 1 } }, { session });
      const currentOrg = await Organization.findById(org._id).session(session);
      const worker = await Worker.findOne({ _id: workerId, orgId: org._id, siteId: { $in: siteIds } }).session(session);
      if (!worker || !currentOrg) throw new AppError('NOT_FOUND');
      if (!disabled && worker.accessDisabled) {
        const entitlement = entitlementOf(currentOrg);
        if (!entitlement.active) throw new AppError('FORBIDDEN');
        const count = await Worker.countDocuments({ orgId: org._id, archivedAt: null, accessDisabled: { $ne: true } }).session(session);
        if (count >= entitlement.workerLimit) throw new AppError('WORKER_LIMIT_REACHED');
      }
      worker.accessDisabled = disabled; await worker.save({ session });
    });
  } finally { await session.endSession(); }
  await revokeWorkerSessions(workerId);
  await AuditEvent.create({ orgId: org._id, actorId: String(user._id), action: disabled ? 'worker.disabled' : 'worker.reactivated', subjectId: workerId });
  sendData(res, { id: workerId, disabled });
}));

accessRouter.get('/invoices', asyncHandler(async (req, res) => {
  const { org } = await requireStaff(req, ['owner']);
  sendData(res, await Invoice.find({ orgId: org._id }).select('-orgId -__v').sort({ createdAt: -1 }).limit(100));
}));
accessRouter.post('/plan-requests', asyncHandler(async (req, res) => {
  const { org, user } = await requireStaff(req, ['owner']);
  const { message } = parseBody(z.object({ message: z.string().trim().min(1).max(2000) }).strict(), req);
  const request = await PlanRequest.create({ orgId: org._id, requestedBy: user._id, message });
  sendData(res, { id: String(request._id), status: request.status }, undefined, 201);
}));
accessRouter.get('/audit', asyncHandler(async (req, res) => {
  const { org, user, siteIds } = await requireStaff(req, ['owner', 'auditor', 'administrator']);
  sendData(res, await AuditEvent.find({ orgId: org._id, ...(user.role === 'owner' ? {} : { $or: [{ siteId: { $in: siteIds } }, { actorId: String(user._id) }] }) }).sort({ createdAt: -1 }).limit(200).select('-__v'));
}));

// Platform operations use a separately configured credential, never a staff role.
accessRouter.get('/operator/workspaces', rateLimit({ bucket: 'operator', limit: 30, windowSeconds: 900 }), asyncHandler(async (req, res) => {
  operator(req.header('authorization'));
  sendData(res, await Organization.find({ deletingAt: null }).select('name companyId accessStatus subscription activatedAt expiresAt workerLimit siteLimit').sort({ createdAt: -1 }).limit(200));
}));
accessRouter.post('/operator/workspaces/:id/activate', asyncHandler(async (req, res) => {
  operator(req.header('authorization'));
  const body = parseBody(z.object({ subscription: z.enum(['pilot', 'paid']).default('pilot'), expiresAt: z.string().datetime().optional(), workerLimit: z.number().int().min(1).max(100000).optional(), siteLimit: z.number().int().min(1).max(1000).optional() }).strict(), req);
  const org = await Organization.findById(routeParam(req.params.id));
  if (!org) throw new AppError('NOT_FOUND');
  const now = new Date();
  if (body.subscription === 'pilot' && org.activatedAt) throw new AppError('CONFLICT_STATE', [{ field: 'pilot', issue: 'pilot_already_activated' }]);
  org.subscription = body.subscription; org.accessStatus = 'active'; org.activatedAt = org.activatedAt ?? now;
  org.expiresAt = body.subscription === 'pilot' ? new Date(now.getTime() + 30 * 86400_000) : body.expiresAt ? new Date(body.expiresAt) : null;
  if (org.expiresAt && org.expiresAt <= now) throw new AppError('VALIDATION_FAILED');
  org.workerLimit = body.subscription === 'pilot' ? 25 : body.workerLimit ?? 100;
  org.siteLimit = body.subscription === 'pilot' ? 1 : body.siteLimit ?? 5;
  await org.save();
  await AuditEvent.create({ orgId: org._id, actorId: 'platform-operator', action: 'subscription.activated', subjectId: String(org._id), details: { subscription: body.subscription } });
  sendData(res, entitlementOf(org));
}));
accessRouter.post('/operator/workspaces/:id/suspend', asyncHandler(async (req, res) => {
  operator(req.header('authorization'));
  const org = await Organization.findByIdAndUpdate(routeParam(req.params.id), { $set: { accessStatus: 'suspended' } }, { new: true });
  if (!org) throw new AppError('NOT_FOUND');
  await AuditEvent.create({ orgId: org._id, actorId: 'platform-operator', action: 'subscription.suspended', subjectId: String(org._id) });
  sendData(res, entitlementOf(org));
}));
accessRouter.post('/operator/workspaces/:id/invoices', asyncHandler(async (req, res) => {
  operator(req.header('authorization'));
  const body = parseBody(z.object({ number: z.string().trim().min(1).max(80), amountMinor: z.number().int().min(0), currency: z.string().regex(/^[A-Z]{3}$/).default('USD'), status: z.enum(['issued', 'paid', 'void']).default('issued'), note: z.string().max(500).optional() }).strict(), req);
  const org = await Organization.findById(routeParam(req.params.id));
  if (!org) throw new AppError('NOT_FOUND');
  const invoice = await Invoice.create({ orgId: org._id, ...body, paidAt: body.status === 'paid' ? new Date() : null });
  sendData(res, invoice, undefined, 201);
}));

accessRouter.patch('/operator/invoices/:id', asyncHandler(async (req, res) => {
  operator(req.header('authorization'));
  const body = parseBody(z.object({ status: z.enum(['issued', 'paid', 'void']), note: z.string().max(500).optional() }).strict(), req);
  const invoice = await Invoice.findById(routeParam(req.params.id));
  if (!invoice) throw new AppError('NOT_FOUND');
  invoice.status = body.status; invoice.paidAt = body.status === 'paid' ? new Date() : null;
  if (body.note !== undefined) invoice.note = body.note;
  await invoice.save();
  await AuditEvent.create({ orgId: invoice.orgId, actorId: 'platform-operator', action: 'invoice.updated', subjectId: String(invoice._id), details: { status: body.status } });
  sendData(res, invoice);
}));
