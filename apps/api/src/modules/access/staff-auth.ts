import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { emailSchema } from '@understood/shared';
import { Organization, User } from '../../models.js';
import { Site, AccessToken } from './models.js';
import { asyncHandler, parseBody, sendData } from '../../http.js';
import { AppError } from '../../errors.js';
import { hashPassword, verifyPassword } from '../../auth/passwords.js';
import { randomToken, tokenHash } from '../../auth/tokens.js';
import { createSession, setSessionCookie, revokeAllSessions } from '../../auth/sessions.js';
import { sendEmail } from '../../email/mailer.js';
import { config } from '../../config.js';
import { rateLimit } from '../../auth/rate-limit.js';
import { entitlementOf } from './control.js';

export const passwordSchema = z.string().min(12).max(128);
export const timezoneSchema = z.string().max(64).refine((value) => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; } catch { return false; }
}, 'must be an IANA time zone');
const tokenSchema = z.string().min(32).max(200);
export const staffAuthRouter = Router();
staffAuthRouter.use(rateLimit({ bucket: 'staff-auth', limit: 30, windowSeconds: 900 }));

async function emailToken(input: { orgId: Types.ObjectId; userId: Types.ObjectId; email: string; purpose: 'verify' | 'reset' }) {
  const token = randomToken(32);
  await AccessToken.create({ ...input, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + (input.purpose === 'verify' ? 24 * 60 : 30) * 60_000) });
  const query = input.purpose === 'verify' ? 'verify' : 'reset';
  await sendEmail({ to: input.email, orgId: String(input.orgId), template: 'magic_link',
    subject: input.purpose === 'verify' ? 'Verify your Understood email' : 'Reset your Understood password',
    text: `Open ${config.APP_URL}/signin?${query}=${encodeURIComponent(token)}\n\nIf you did not request this, ignore this email.` });
}

staffAuthRouter.post('/register', asyncHandler(async (req, res) => {
  const body = parseBody(z.object({
    companyName: z.string().trim().min(2).max(120), name: z.string().trim().min(1).max(80),
    email: emailSchema, password: passwordSchema, timezone: timezoneSchema.default('Asia/Dubai'),
  }).strict(), req);
  // Uniform reply prevents revealing whether an email already has an account.
  if (await User.exists({ email: body.email })) { sendData(res, { verificationRequired: true }, undefined, 202); return; }
  const passwordHash = await hashPassword(body.password);
  const session = await Organization.startSession();
  let created: { orgId: Types.ObjectId; userId: Types.ObjectId } | undefined;
  try {
    await session.withTransaction(async () => {
      const orgId = new Types.ObjectId();
      const companyId = `${body.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'company'}-${orgId.toHexString().slice(-6)}`;
      const [org] = await Organization.create([{ _id: orgId, name: body.companyName, companyId, timezone: body.timezone, accessStatus: 'pending' }], { session });
      const [site] = await Site.create([{ orgId: org!._id, name: 'Main site', timezone: body.timezone }], { session });
      const [user] = await User.create([{ orgId: org!._id, name: body.name, email: body.email, passwordHash, role: 'owner', siteIds: [site!._id] }], { session });
      created = { orgId: org!._id, userId: user!._id };
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  } finally { await session.endSession(); }
  if (created) await emailToken({ ...created, email: body.email, purpose: 'verify' });
  sendData(res, { verificationRequired: true }, undefined, 202);
}));

staffAuthRouter.post('/verify-email', asyncHandler(async (req, res) => {
  const { token } = parseBody(z.object({ token: tokenSchema }).strict(), req);
  const record = await AccessToken.findOneAndUpdate({ tokenHash: tokenHash(token), purpose: 'verify', usedAt: null, expiresAt: { $gt: new Date() } }, { $set: { usedAt: new Date() } });
  if (!record) throw new AppError('LINK_UNAVAILABLE');
  const user = await User.findOneAndUpdate({ _id: record.userId, orgId: record.orgId, disabledAt: null }, { $set: { emailVerifiedAt: new Date() } });
  if (!user) throw new AppError('LINK_UNAVAILABLE');
  sendData(res, { verified: true });
}));

staffAuthRouter.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = parseBody(z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict(), req);
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!valid || !user || user.disabledAt) throw new AppError('AUTH_REQUIRED');
  if (!user.emailVerifiedAt) throw new AppError('FORBIDDEN', [{ field: 'email', issue: 'verification_required' }]);
  const org = await Organization.findOne({ _id: user.orgId, deletingAt: null });
  if (!org) throw new AppError('AUTH_REQUIRED');
  user.lastLoginAt = new Date(); await user.save();
  setSessionCookie(res, await createSession(user._id, user.orgId));
  sendData(res, { user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
    org: { id: String(org._id), name: org.name, companyId: org.companyId }, entitlement: entitlementOf(org) });
}));

for (const [path, purpose] of [['/forgot-password', 'reset'], ['/resend-verification', 'verify']] as const) {
  staffAuthRouter.post(path, asyncHandler(async (req, res) => {
    const { email } = parseBody(z.object({ email: emailSchema }).strict(), req);
    const user = await User.findOne({ email, disabledAt: null, passwordHash: { $exists: true } });
    if (user && (purpose !== 'verify' || !user.emailVerifiedAt)) await emailToken({ orgId: user.orgId, userId: user._id, email, purpose });
    sendData(res, { sent: true }, undefined, 202);
  }));
}

staffAuthRouter.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = parseBody(z.object({ token: tokenSchema, password: passwordSchema }).strict(), req);
  const passwordHash = await hashPassword(password);
  const record = await AccessToken.findOneAndUpdate({ tokenHash: tokenHash(token), purpose: 'reset', usedAt: null, expiresAt: { $gt: new Date() } }, { $set: { usedAt: new Date() } });
  if (!record) throw new AppError('LINK_UNAVAILABLE');
  const user = await User.findOneAndUpdate({ _id: record.userId, orgId: record.orgId, disabledAt: null }, { $set: { passwordHash } });
  if (!user) throw new AppError('LINK_UNAVAILABLE');
  await revokeAllSessions(String(user._id));
  sendData(res, { reset: true });
}));

staffAuthRouter.post('/accept-invitation', asyncHandler(async (req, res) => {
  const { token, name, password } = parseBody(z.object({ token: tokenSchema, name: z.string().trim().min(1).max(80), password: passwordSchema }).strict(), req);
  const passwordHash = await hashPassword(password);
  const record = await AccessToken.findOneAndUpdate({ tokenHash: tokenHash(token), purpose: 'invite', usedAt: null, expiresAt: { $gt: new Date() } }, { $set: { usedAt: new Date() } });
  if (!record || !record.role) throw new AppError('LINK_UNAVAILABLE');
  if (!(await Organization.exists({ _id: record.orgId, deletingAt: null }))) throw new AppError('LINK_UNAVAILABLE');
  if (await User.exists({ email: record.email })) throw new AppError('CONFLICT_STATE');
  const user = await User.create({ orgId: record.orgId, email: record.email, name, passwordHash, role: record.role, siteIds: record.siteIds, emailVerifiedAt: new Date() });
  setSessionCookie(res, await createSession(user._id, user.orgId));
  sendData(res, { accepted: true }, undefined, 201);
}));
