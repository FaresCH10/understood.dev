import { Router } from 'express';
import { z } from 'zod';
import { Organization, Worker } from '../../models.js';
import { asyncHandler, parseBody, sendData } from '../../http.js';
import { AppError } from '../../errors.js';
import { verifyPassword } from '../../auth/passwords.js';
import { randomToken, tokenHash } from '../../auth/tokens.js';
import { getKv } from '../../stores/kv.js';
import { isProduction } from '../../config.js';
import { rateLimit } from '../../auth/rate-limit.js';
import { requireEntitlement, requireWorkerPortal, WORKER_COOKIE, type WorkerSessionData } from './control.js';
import { Site } from './models.js';

export const workerPortalAuthRouter = Router();
const cookieOptions = { httpOnly: true, secure: isProduction, sameSite: 'lax' as const, path: '/' };
function payload(worker: { _id: unknown; name: string; workerId?: string; language: string; languageSelected?: boolean; requestedLanguage?: string | null }, org: { _id: unknown; name: string; companyId?: string }, sharedDevice: boolean) {
  return { worker: { id: String(worker._id), name: worker.name, workerId: worker.workerId, language: worker.language, languageSelected: worker.languageSelected ?? false, requestedLanguage: worker.requestedLanguage ?? null }, org: { id: String(org._id), name: org.name, companyId: org.companyId }, sharedDevice };
}

workerPortalAuthRouter.post('/login', rateLimit({ bucket: 'worker-login', limit: 20, windowSeconds: 900 }), asyncHandler(async (req, res) => {
  const body = parseBody(z.object({ companyId: z.string().trim().toLowerCase().min(1).max(80), workerId: z.string().trim().toUpperCase().min(1).max(80), password: z.string().min(1).max(128), sharedDevice: z.boolean().default(false) }).strict(), req);
  const org = await Organization.findOne({ companyId: body.companyId, deletingAt: null });
  const worker = org ? await Worker.findOne({ orgId: org._id, workerId: body.workerId }).select('+passwordHash') : null;
  const valid = await verifyPassword(body.password, worker?.passwordHash);
  if (!valid || !worker || !org || worker.archivedAt || worker.accessDisabled) throw new AppError('AUTH_REQUIRED');
  await requireEntitlement(String(org._id));
  if (worker.siteId && !(await Site.exists({ _id: worker.siteId, orgId: org._id, archivedAt: null }))) throw new AppError('FORBIDDEN');
  const token = randomToken(32); const hash = tokenHash(token);
  const ttl = body.sharedDevice ? 8 * 3600 : 30 * 86400;
  const data: WorkerSessionData = { workerId: String(worker._id), orgId: String(org._id), sharedDevice: body.sharedDevice, createdAt: new Date().toISOString() };
  await getKv().set(`worker-sess:${hash}`, JSON.stringify(data), ttl);
  await getKv().sadd(`worker-sessions:${worker._id}`, hash, 30 * 86400);
  res.cookie(WORKER_COOKIE, token, { ...cookieOptions, ...(body.sharedDevice ? {} : { maxAge: ttl * 1000 }) });
  res.setHeader('Cache-Control', 'no-store');
  sendData(res, payload(worker, org, body.sharedDevice));
}));
workerPortalAuthRouter.get('/me', asyncHandler(async (req, res) => {
  const { worker, org, sharedDevice } = await requireWorkerPortal(req);
  res.setHeader('Cache-Control', 'no-store');
  sendData(res, payload(worker, org, sharedDevice));
}));
workerPortalAuthRouter.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies?.[WORKER_COOKIE];
  if (typeof token === 'string') {
    const hash = tokenHash(token); const raw = await getKv().get(`worker-sess:${hash}`);
    await getKv().del(`worker-sess:${hash}`);
    if (raw) { try { const data = JSON.parse(raw) as WorkerSessionData; await getKv().srem(`worker-sessions:${data.workerId}`, hash); } catch { /* invalid session already removed */ } }
  }
  res.clearCookie(WORKER_COOKIE, cookieOptions);
  res.setHeader('Clear-Site-Data', '"cache", "storage"');
  sendData(res, { signedOut: true });
}));
