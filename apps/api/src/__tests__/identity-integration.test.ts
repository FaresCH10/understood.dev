import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import mongoose from 'mongoose';
import { Organization, User, Worker, Crew } from '../models.js';
import { AccessToken, AuditEvent, Site } from '../modules/access/models.js';
import { authRouter } from '../modules/auth/routes.js';
import { accessRouter } from '../modules/access/routes.js';
import { workerPortalAuthRouter } from '../modules/access/worker-auth.js';
import { attachSession, requireSameOrigin } from '../auth/middleware.js';
import { requestId, errorHandler, notFoundHandler } from '../http.js';
import { getMailer, type EmailMessage } from '../email/mailer.js';
import { hashPassword } from '../auth/passwords.js';
import { portalRouter } from '../modules/operations/routes.js';

const mongoUri = process.env.TEST_MONGODB_URI;
describe.skipIf(!mongoUri)('company and worker authentication integration', () => {
  const password = 'a long test password 123';
  const email = `identity-${Date.now()}@company.test`;
  const messages: EmailMessage[] = [];
  const app = express();
  app.use(express.json()); app.use(cookieParser()); app.use(requestId); app.use(requireSameOrigin); app.use(attachSession);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/access', accessRouter);
  app.use('/api/v1/portal/auth', workerPortalAuthRouter);
  app.use('/api/v1/portal', portalRouter);
  app.use(notFoundHandler); app.use(errorHandler);
  const owner = request.agent(app);
  const employee = request.agent(app);
  const workerAgent = request.agent(app);
  let orgId: string;
  let siteId: string;
  let workerId: string;
  let companyId: string;
  const operatorToken = 'operator-integration-test-credential-0123456789';
  const previousOperatorToken = process.env.PLATFORM_OPERATOR_TOKEN;

  beforeAll(async () => {
    await mongoose.connect(mongoUri!, { dbName: `identity-test-${Date.now()}`, autoIndex: true });
    await Promise.all([Organization.init(), User.init(), Worker.init(), Crew.init(), AccessToken.init(), Site.init(), AuditEvent.init()]);
    vi.spyOn(getMailer(), 'send').mockImplementation(async (message) => { messages.push(message); });
    process.env.PLATFORM_OPERATOR_TOKEN = operatorToken;
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    if (previousOperatorToken === undefined) delete process.env.PLATFORM_OPERATOR_TOKEN; else process.env.PLATFORM_OPERATOR_TOKEN = previousOperatorToken;
    if (mongoose.connection.readyState) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
  });

  it('registers a pending company and cannot sign in before verifying email', async () => {
    await owner.post('/api/v1/auth/register').send({ companyName: 'Identity Test', name: 'Owner', email, password, timezone: 'Asia/Dubai' }).expect(202);
    const user = await User.findOne({ email });
    expect(user?.emailVerifiedAt).toBeNull();
    const org = await Organization.findById(user!.orgId);
    orgId = String(org!._id); companyId = org!.companyId!;
    expect(org?.accessStatus).toBe('pending');
    await owner.post('/api/v1/auth/login').send({ email, password }).expect(403);
    const token = new URL(messages[0]!.text.match(/https?:\/\/\S+/)![0]).searchParams.get('verify');
    await owner.post('/api/v1/auth/verify-email').send({ token }).expect(200);
    await owner.post('/api/v1/auth/verify-email').send({ token }).expect(410);
    const login = await owner.post('/api/v1/auth/login').send({ email, password }).expect(200);
    expect(login.body.data.entitlement.active).toBe(false);
    const workspace = await owner.get('/api/v1/access/workspace').expect(200);
    siteId = workspace.body.data.sites[0].id;
  });

  it('does not permit password-account or unknown-email magic-link bypasses', async () => {
    const before = messages.length;
    await owner.post('/api/v1/auth/magic-link').send({ email }).expect(202);
    await owner.post('/api/v1/auth/magic-link').send({ email: 'unknown@company.test' }).expect(202);
    expect(messages.length).toBe(before);
    expect(await User.exists({ email: 'unknown@company.test' })).toBeNull();
  });

  it('requires platform credentials and activates one non-renewable 30-day pilot', async () => {
    await owner.post(`/api/v1/access/operator/workspaces/${orgId}/activate`).send({}).expect(403);
    const activated = await request(app).post(`/api/v1/access/operator/workspaces/${orgId}/activate`).set('Authorization', `Bearer ${operatorToken}`).send({ subscription: 'pilot' }).expect(200);
    expect(activated.body.data).toMatchObject({ active: true, workerLimit: 25, siteLimit: 1 });
    const difference = new Date(activated.body.data.expiresAt).getTime() - new Date(activated.body.data.activatedAt).getTime();
    expect(difference).toBe(30 * 86400_000);
    await request(app).post(`/api/v1/access/operator/workspaces/${orgId}/activate`).set('Authorization', `Bearer ${operatorToken}`).send({ subscription: 'pilot' }).expect(409);
    await owner.post('/api/v1/access/sites').send({ name: 'Over quota', timezone: 'Asia/Dubai' }).expect(403);
  });

  it('accepts a scoped invitation and rejects supervisor staff administration', async () => {
    await owner.post('/api/v1/access/invitations').send({ email: `supervisor-${email}`, role: 'supervisor', siteIds: [siteId] }).expect(201);
    const token = new URL(messages.at(-1)!.text.match(/https?:\/\/\S+/)![0]).searchParams.get('invite');
    await employee.post('/api/v1/auth/accept-invitation').send({ token, name: 'Supervisor', password }).expect(201);
    const workspace = await employee.get('/api/v1/access/workspace').expect(200);
    expect(workspace.body.data.sites.map((site: { id: string }) => site.id)).toEqual([siteId]);
    await employee.get('/api/v1/access/staff').expect(403);
    await employee.post('/api/v1/access/invitations').send({ email: 'other@company.test', role: 'auditor', siteIds: [siteId] }).expect(403);
  });

  it('authenticates a worker separately and preserves approved language until review', async () => {
    const crew = await Crew.create({ orgId, siteId, name: 'Crew' });
    const worker = await Worker.create({ orgId, siteId, crewId: crew._id, name: 'Worker', normalizedName: 'worker', workerId: 'W001', language: 'en', passwordHash: await hashPassword(password) });
    workerId = String(worker._id);
    await owner.get('/api/v1/portal/auth/me').expect(401);
    const login = await workerAgent.post('/api/v1/portal/auth/login').send({ companyId, workerId: 'w001', password, sharedDevice: true }).expect(200);
    expect(String(login.headers['set-cookie'])).not.toMatch(/Max-Age|Expires=/i);
    expect(JSON.stringify(login.body)).not.toContain('passwordHash');
    await workerAgent.post('/api/v1/portal/language').send({ language: 'ar' }).expect(200);
    const initial = await workerAgent.get('/api/v1/portal/auth/me').expect(200);
    expect(initial.body.data.worker).toMatchObject({ language: 'ar', languageSelected: true });
    await workerAgent.post('/api/v1/portal/language').send({ language: 'ur' }).expect(200);
    const requestLanguage = await workerAgent.get('/api/v1/portal/auth/me').expect(200);
    expect(requestLanguage.body.data.worker).toMatchObject({ language: 'ar', requestedLanguage: 'ur' });
    await workerAgent.get('/api/v1/auth/me').expect(401);
  });

  it('revokes worker sessions when credentials reset and forbids cross-site reset', async () => {
    const foreignSite = await Site.create({ orgId, name: 'Restricted', timezone: 'Asia/Dubai' });
    const crew = await Crew.create({ orgId, siteId: foreignSite._id, name: 'Restricted Crew' });
    const foreignWorker = await Worker.create({ orgId, siteId: foreignSite._id, crewId: crew._id, name: 'Other', normalizedName: 'other', workerId: 'W002', language: 'en' });
    await employee.post(`/api/v1/access/workers/${foreignWorker._id}/reset-password`).send({ password }).expect(404);
    await owner.post(`/api/v1/access/workers/${workerId}/reset-password`).send({ password: 'a replacement password 456' }).expect(200);
    await workerAgent.get('/api/v1/portal/auth/me').expect(401);
    await workerAgent.post('/api/v1/portal/auth/login').send({ companyId, workerId: 'W001', password }).expect(401);
    await workerAgent.post('/api/v1/portal/auth/login').send({ companyId, workerId: 'W001', password: 'a replacement password 456' }).expect(200);
    await owner.patch(`/api/v1/access/workers/${workerId}/access`).send({ disabled: true }).expect(200);
    await workerAgent.get('/api/v1/portal/auth/me').expect(401);
  });

  it('revokes staff sessions on reset and refuses expired workspace worker access', async () => {
    await owner.post('/api/v1/auth/forgot-password').send({ email }).expect(202);
    const token = new URL(messages.at(-1)!.text.match(/https?:\/\/\S+/)![0]).searchParams.get('reset');
    await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'a changed owner password 789' }).expect(200);
    await owner.get('/api/v1/auth/me').expect(401);
    await request(app).post('/api/v1/auth/reset-password').send({ token, password }).expect(410);
    await Organization.updateOne({ _id: orgId }, { $set: { expiresAt: new Date(Date.now() - 1) } });
    await Worker.updateOne({ _id: workerId }, { $set: { accessDisabled: false } });
    await workerAgent.post('/api/v1/portal/auth/login').send({ companyId, workerId: 'W001', password: 'a replacement password 456' }).expect(403);
  });
});
