import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../app.js';
import { Organization, User, Worker, Crew, type WorkerDoc } from '../models.js';
import { Site } from '../modules/access/models.js';
import { Operation, Assignment, type Publication, type PreparedVariant } from '../modules/operations/models.js';
import { createSession, SESSION_COOKIE } from '../auth/sessions.js';
import { hashPassword } from '../auth/passwords.js';
import { registerPipelineJobs } from '../jobs/register.js';
import { getStorage } from '../media/storage.js';

describe.skipIf(!process.env.TEST_MONGODB_URI)('operations edge cases and tenant boundaries', () => {
  const app = createApp();
  const orgs: string[] = [];
  const password = 'long worker password 12345';
  let passwordHash: string;
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI!, { dbName: `operations-edge-${Date.now()}`, autoIndex: true });
    await Promise.all(Object.values(mongoose.models).map((entry) => entry.init()));
    passwordHash = await hashPassword(password); registerPipelineJobs();
  });
  afterAll(async () => {
    for (const orgId of orgs) await getStorage().deletePrefix(`orgs/${orgId}/`);
    if (mongoose.connection.readyState) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
  });
  async function fixture(workerLimit = 100) {
    const suffix = randomUUID().slice(0, 8);
    const org = await Organization.create({ name: `Edge ${suffix}`, companyId: `edge-${suffix}`, accessStatus: 'active', subscription: 'paid', workerLimit, siteLimit: 5 });
    orgs.push(String(org._id));
    const site = await Site.create({ orgId: org._id, name: 'Main', timezone: 'Asia/Dubai' });
    const crew = await Crew.create({ orgId: org._id, siteId: site._id, name: 'Crew' });
    const owner = await User.create({ orgId: org._id, name: 'Owner', email: `${suffix}@owner.test`, role: 'owner', siteIds: [site._id] });
    const cookie = `${SESSION_COOKIE}=${await createSession(owner._id, org._id)}`;
    return { org, site, crew, owner, cookie };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  async function makeWorker(f: Fixture, code: string, patch: Partial<WorkerDoc> = {}) {
    return Worker.create({ orgId: f.org._id, siteId: f.site._id, crewId: f.crew._id, name: `Worker ${code}`, normalizedName: `worker ${code}`, workerId: code, language: 'en', languageSelected: true, passwordHash, ...patch });
  }
  async function workerCookie(f: Fixture, code: string) {
    const response = await request(app).post('/api/v1/portal/auth/login').send({ companyId: f.org.companyId, workerId: code, password, sharedDevice: false }).expect(200);
    const raw: unknown = response.headers['set-cookie'];
    return String(Array.isArray(raw) ? raw[0] : raw).split(';')[0]!;
  }
  function variant(language: PreparedVariant['language'] = 'en', index = 0): PreparedVariant {
    return { language, text: `Instruction ${language}`, question: { text: `Question ${language}`, options: ['A', 'B', 'C'], correctIndex: index }, status: 'ready', reviewed: true, demo: true };
  }
  async function operation(f: Fixture, workers: Array<mongoose.HydratedDocument<WorkerDoc>>, patch: Record<string, unknown> = {}) {
    return Operation.create({ orgId: f.org._id, siteId: f.site._id, createdBy: f.owner._id, title: 'Instruction', text: 'Move boxes', sourceLanguage: 'en', deliveryMode: 'text', questionEnabled: false, requirePhoto: false,
      workerIds: workers.map((worker) => worker._id), crewIds: [], everyone: false, variants: [variant()], status: 'ready', ...patch });
  }
  async function publish(f: Fixture, operationId: Types.ObjectId, acceptPartial = false) {
    return request(app).post(`/api/v1/operations/instructions/${operationId}/publish`).set('Cookie', f.cookie).send({ acceptPartial });
  }
  async function mutate(cookie: string, assignmentId: Types.ObjectId, path: string, body: Record<string, unknown>) {
    return request(app).post(`/api/v1/portal/assignments/${assignmentId}/${path}`).set('Cookie', cookie).set('Idempotency-Key', randomUUID()).send(body);
  }

  it('serializes concurrent worker additions and reactivations against the company quota', async () => {
    const f = await fixture(1);
    const body = (code: string) => ({ name: code, workerId: code, crewId: String(f.crew._id), siteId: String(f.site._id), language: 'en', password });
    const added = await Promise.all(['A001', 'A002'].map((code) => request(app).post('/api/v1/operations/workers').set('Cookie', f.cookie).send(body(code))));
    expect(added.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await Worker.countDocuments({ orgId: f.org._id, accessDisabled: { $ne: true } })).toBe(1);
    await Worker.updateMany({ orgId: f.org._id }, { $set: { accessDisabled: true } });
    const disabled = await makeWorker(f, 'DISABLED', { accessDisabled: true });
    const existing = await Worker.findOne({ orgId: f.org._id, _id: { $ne: disabled._id } });
    const activated = await Promise.all([existing!, disabled].map((worker) => request(app).patch(`/api/v1/operations/workers/${worker._id}`).set('Cookie', f.cookie).send({ accessDisabled: false })));
    expect(activated.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await Worker.countDocuments({ orgId: f.org._id, accessDisabled: { $ne: true } })).toBe(1);
    await Worker.updateMany({ orgId: f.org._id }, { $set: { accessDisabled: true } });
    const aliasActivated = await Promise.all([existing!, disabled].map((worker) => request(app).patch(`/api/v1/access/workers/${worker._id}/access`).set('Cookie', f.cookie).send({ disabled: false })));
    expect(aliasActivated.map((response) => response.status).sort()).toEqual([200, 409]);
  });

  it('isolates instruction/report reads and operational staff options by tenant and authorized site', async () => {
    const f = await fixture(); const other = await fixture();
    const worker = await makeWorker(f, 'SITEA'); const otherWorker = await makeWorker(other, 'OTHER');
    const instruction = await operation(f, [worker]); const otherInstruction = await operation(other, [otherWorker]);
    expect((await publish(f, instruction._id)).status).toBe(200); expect((await publish(other, otherInstruction._id)).status).toBe(200);
    const privateSite = await Site.create({ orgId: f.org._id, name: 'Private site', timezone: 'Asia/Dubai' });
    const privateInstruction = await operation(f, [worker], { siteId: privateSite._id, title: 'Private content' });
    const supervisor = await User.create({ orgId: f.org._id, name: 'Scoped supervisor', email: `${randomUUID()}@supervisor.test`, role: 'supervisor', siteIds: [f.site._id] });
    const cookie = `${SESSION_COOKIE}=${await createSession(supervisor._id, f.org._id)}`;
    await request(app).get(`/api/v1/operations/instructions/${otherInstruction._id}`).set('Cookie', cookie).expect(404);
    await request(app).get(`/api/v1/operations/instructions/${privateInstruction._id}`).set('Cookie', cookie).expect(404);
    await request(app).get(`/api/v1/operations/reports?siteId=${privateSite._id}`).set('Cookie', cookie).expect(403);
    const reports = await request(app).get('/api/v1/operations/reports').set('Cookie', cookie).expect(200);
    expect(reports.body.data.rows).toHaveLength(1);
    expect(reports.body.data.rows[0].workerCode).toBe('SITEA');
    const people = await request(app).get(`/api/v1/access/operational-staff?siteId=${f.site._id}`).set('Cookie', cookie).expect(200);
    expect(people.body.data.map((person: { id: string }) => person.id)).toContain(String(f.owner._id));
    expect(JSON.stringify(people.body.data)).not.toContain('@');
    await request(app).get(`/api/v1/access/operational-staff?siteId=${privateSite._id}`).set('Cookie', cookie).expect(403);
  });

  it('delivers ready recipients while failed versions wait for retry and staff review', async () => {
    const f = await fixture(); const english = await makeWorker(f, 'ENGLISH'); const arabic = await makeWorker(f, 'ARABIC', { language: 'ar' });
    const instruction = await operation(f, [english, arabic], { status: 'partial_failure', variants: [variant('en'), { language: 'ar', text: '', status: 'failed', reviewed: false, demo: true, error: 'Provider unavailable' }] });
    expect((await publish(f, instruction._id)).status).toBe(409);
    expect((await publish(f, instruction._id, true)).status).toBe(200);
    const en = await Assignment.findOne({ instructionId: instruction._id, workerId: english._id });
    const ar = await Assignment.findOne({ instructionId: instruction._id, workerId: arabic._id });
    expect(en?.status).toBe('pending'); expect(ar?.status).toBe('waiting');
    const cookie = await workerCookie(f, 'ARABIC');
    await request(app).get(`/api/v1/portal/assignments/${ar!._id}`).set('Cookie', cookie).expect(409);
    await request(app).post(`/api/v1/operations/instructions/${instruction._id}/retry`).set('Cookie', f.cookie).send({}).expect(200);
    expect((await Assignment.findById(ar!._id))?.status).toBe('waiting');
    await request(app).post(`/api/v1/operations/assignments/${ar!._id}/release`).set('Cookie', f.cookie).send({}).expect(200);
    await request(app).get(`/api/v1/portal/assignments/${ar!._id}`).set('Cookie', cookie).expect(200);
  });

  it('requires acknowledgment-only photo evidence and checks photo ownership', async () => {
    const f = await fixture(); const first = await makeWorker(f, 'PHOTO1'); const second = await makeWorker(f, 'PHOTO2');
    await request(app).post('/api/v1/operations/instructions').set('Cookie', f.cookie).send({ title: 'Invalid', siteId: String(f.site._id), text: 'Move boxes', questionEnabled: true, requirePhoto: true, workerIds: [String(first._id)] }).expect(400);
    const instruction = await operation(f, [first], { requirePhoto: true }); expect((await publish(f, instruction._id)).status).toBe(200);
    const assignment = await Assignment.findOne({ instructionId: instruction._id });
    const ownCookie = await workerCookie(f, 'PHOTO1'); const secondCookie = await workerCookie(f, 'PHOTO2');
    expect((await mutate(ownCookie, assignment!._id, 'acknowledge', {})).status).toBe(400);
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } }).png().toBuffer();
    const foreign = await request(app).post('/api/v1/portal/uploads').set('Cookie', secondCookie).attach('file', png, { filename: 'proof.png', contentType: 'image/png' }).expect(201);
    expect((await mutate(ownCookie, assignment!._id, 'acknowledge', { photoKey: foreign.body.data.key })).status).toBe(403);
    const own = await request(app).post('/api/v1/portal/uploads').set('Cookie', ownCookie).attach('file', png, { filename: 'proof.png', contentType: 'image/png' }).expect(201);
    expect((await mutate(ownCookie, assignment!._id, 'acknowledge', { photoKey: own.body.data.key })).status).toBe(200);
    expect((await Assignment.findById(assignment!._id))?.completedAt).toBeUndefined();
    expect((await mutate(ownCookie, assignment!._id, 'complete', {})).status).toBe(200);
  });

  it('grades the displayed approved language question and retains historical answer evidence after a language change', async () => {
    const f = await fixture(); const worker = await makeWorker(f, 'LANGUAGE', { language: 'ar' });
    const instruction = await operation(f, [worker], { questionEnabled: true, question: variant('en').question, variants: [variant('en'), variant('ar', 2)] });
    // Construct a retained English delivery with an approved alternative Arabic view.
    const snapshot: Publication = { version: 1, publishedAt: new Date(), title: 'Language instruction', text: 'Move boxes', sourceLanguage: 'en', deliveryMode: 'text', questionEnabled: true, requirePhoto: false, variants: [variant('en'), variant('ar', 2)], question: variant('en').question, attachments: [], audience: [{ workerId: String(worker._id), name: worker.name, language: 'en', crewId: String(f.crew._id) }] };
    const assignment = await Assignment.create({ orgId: f.org._id, siteId: f.site._id, instructionId: instruction._id, workerId: worker._id, workerName: worker.name, workerCode: worker.workerId, crewId: f.crew._id, version: 1, language: 'en', snapshot, variant: variant('en'), needsAnswer: true });
    const cookie = await workerCookie(f, 'LANGUAGE');
    const displayed = await request(app).get(`/api/v1/portal/assignments/${assignment._id}`).set('Cookie', cookie).expect(200);
    expect(displayed.body.data.snapshot.question.text).toBe('Question ar');
    expect(displayed.body.data.snapshot.question.correctIndex).toBeUndefined();
    const response = await mutate(cookie, assignment._id, 'respond', { optionIndex: 2 });
    expect(response.status).toBe(200); expect(response.body.data.matched).toBe(true);
    const before = (await Assignment.findById(assignment._id))!.attempts[0]!;
    expect(before).toMatchObject({ language: 'ar', question: 'Question ar', matched: true });
    await request(app).post('/api/v1/portal/language').set('Cookie', cookie).send({ language: 'ur' }).expect(200);
    expect((await Worker.findById(worker._id))?.language).toBe('ar');
    await request(app).post(`/api/v1/operations/workers/${worker._id}/language`).set('Cookie', f.cookie).send({ approve: true }).expect(200);
    expect((await Worker.findById(worker._id))?.language).toBe('ur');
    const after = (await Assignment.findById(assignment._id))!.attempts[0]!;
    expect(after).toMatchObject({ language: 'ar', question: 'Question ar', matched: true }); expect(after.at.toISOString()).toBe(before.at.toISOString());
  });
});
