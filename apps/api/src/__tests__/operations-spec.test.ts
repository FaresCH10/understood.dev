import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import { Organization, User, Worker, Crew, type WorkerDoc } from '../models.js';
import { Site, PlanRequest } from '../modules/access/models.js';
import { Operation, Assignment, Notification, InstructionTemplate, Glossary, type PreparedVariant } from '../modules/operations/models.js';
import { createSession, SESSION_COOKIE } from '../auth/sessions.js';
import { hashPassword } from '../auth/passwords.js';
import { registerPipelineJobs } from '../jobs/register.js';
import { operationsTick } from '../modules/operations/service.js';
import { getStorage } from '../media/storage.js';
import { closeKv } from '../stores/kv.js';

describe.skipIf(!process.env.TEST_MONGODB_URI)('remaining product capabilities', () => {
  const app = createApp();
  const orgs: string[] = [];
  const password = 'long worker password 12345';
  let passwordHash: string;
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI!, { dbName: `operations-spec-${randomUUID()}`, autoIndex: true });
    await Promise.all(Object.values(mongoose.models).map((entry) => entry.init()));
    passwordHash = await hashPassword(password); registerPipelineJobs();
  });
  afterAll(async () => {
    for (const orgId of orgs) await getStorage().deletePrefix(`orgs/${orgId}/`);
    await closeKv();
    if (mongoose.connection.readyState) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
  });
  async function fixture() {
    const suffix = randomUUID().slice(0, 8);
    const org = await Organization.create({ name: `Spec ${suffix}`, companyId: `spec-${suffix}`, accessStatus: 'active', subscription: 'paid', workerLimit: 100, siteLimit: 5 });
    orgs.push(String(org._id));
    const site = await Site.create({ orgId: org._id, name: 'Main', timezone: 'Asia/Dubai' });
    const crew = await Crew.create({ orgId: org._id, siteId: site._id, name: 'Crew' });
    const owner = await User.create({ orgId: org._id, name: 'Owner', email: `${suffix}@owner.test`, role: 'owner', siteIds: [site._id] });
    const auditor = await User.create({ orgId: org._id, name: 'Auditor', email: `${suffix}@auditor.test`, role: 'auditor', siteIds: [site._id] });
    const cookie = `${SESSION_COOKIE}=${await createSession(owner._id, org._id)}`;
    const auditorCookie = `${SESSION_COOKIE}=${await createSession(auditor._id, org._id)}`;
    return { org, site, crew, owner, cookie, auditorCookie };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  async function makeWorker(f: Fixture, code: string, patch: Partial<WorkerDoc> = {}) {
    return Worker.create({ orgId: f.org._id, siteId: f.site._id, crewId: f.crew._id, name: `Worker ${code}`, normalizedName: `worker ${code}`, workerId: code, language: 'en', languageSelected: true, passwordHash, ...patch });
  }
  async function workerCookie(f: Fixture, code: string, sharedDevice = false) {
    const response = await request(app).post('/api/v1/portal/auth/login').send({ companyId: f.org.companyId, workerId: code, password, sharedDevice }).expect(200);
    const raw: unknown = response.headers['set-cookie'];
    return String(Array.isArray(raw) ? raw[0] : raw).split(';')[0]!;
  }
  function variant(index = 0): PreparedVariant {
    return { language: 'en', text: 'Instruction en', question: { text: 'Question en', options: ['A', 'B', 'C'], correctIndex: index }, status: 'ready', reviewed: true, demo: true };
  }
  async function operation(f: Fixture, workers: Array<mongoose.HydratedDocument<WorkerDoc>>, patch: Record<string, unknown> = {}) {
    return Operation.create({ orgId: f.org._id, siteId: f.site._id, createdBy: f.owner._id, title: 'Instruction', text: 'Move boxes', sourceLanguage: 'en', deliveryMode: 'text', questionEnabled: false, requirePhoto: false,
      workerIds: workers.map((worker) => worker._id), crewIds: [], everyone: false, variants: [variant()], status: 'ready', ...patch });
  }
  function mutate(cookie: string, assignmentId: Types.ObjectId, path: string, body: Record<string, unknown>) {
    return request(app).post(`/api/v1/portal/assignments/${assignmentId}/${path}`).set('Cookie', cookie).set('Idempotency-Key', randomUUID()).send(body);
  }

  it('imports a CSV roster and creates crews in one reviewable batch', async () => {
    const f = await fixture();
    const csv = ['name,workerId,crew,language,password', 'Imported One,IMP1,Day crew,hi,long worker password 12345', 'Imported Two,IMP2,Night crew,ur,long worker password 12345'].join('\n');
    const imported = await request(app).post('/api/v1/operations/workers/import').set('Cookie', f.cookie)
      .field('siteId', String(f.site._id)).attach('file', Buffer.from(csv), 'workers.csv').expect(200);
    expect(imported.body.data.imported).toBe(2);
    expect(await Worker.countDocuments({ orgId: f.org._id, workerId: { $in: ['IMP1', 'IMP2'] } })).toBe(2);
    expect(await Crew.countDocuments({ orgId: f.org._id, name: { $in: ['Day crew', 'Night crew'] } })).toBe(2);
    const duplicate = await request(app).post('/api/v1/operations/workers/import').set('Cookie', f.cookie)
      .field('siteId', String(f.site._id)).attach('file', Buffer.from(csv), 'workers.csv');
    expect(duplicate.status).toBe(400);
    expect(await Worker.countDocuments({ orgId: f.org._id, workerId: 'IMP1' })).toBe(1);
  });

  it('manages templates, glossary, proposed improvements, and plan requests without auto-publishing', async () => {
    const f = await fixture();
    const template = await request(app).post('/api/v1/operations/templates').set('Cookie', f.cookie).send({ name: 'Bay move', text: 'Move boxes to bay 4.', questionEnabled: true, question: { text: 'Which bay?', options: ['Bay 1', 'Bay 2', 'Bay 4'], correctIndex: 2 } }).expect(201);
    const templates = await request(app).get('/api/v1/operations/templates').set('Cookie', f.cookie).expect(200);
    expect(templates.body.data.map((row: { name: string }) => row.name)).toContain('Bay move');
    await request(app).delete(`/api/v1/operations/templates/${template.body.data.id}`).set('Cookie', f.cookie).expect(200);
    expect(await InstructionTemplate.countDocuments({ orgId: f.org._id })).toBe(0);
    await request(app).post('/api/v1/operations/glossary').set('Cookie', f.cookie).send({ term: 'bay', translation: 'मंडी', language: 'hi' }).expect(201);
    await request(app).post('/api/v1/operations/glossary').set('Cookie', f.cookie).send({ term: 'bay', translation: 'गोदाम', language: 'hi' }).expect(201);
    const glossary = await request(app).get('/api/v1/operations/glossary').set('Cookie', f.cookie).expect(200);
    expect(glossary.body.data).toHaveLength(1);
    expect(glossary.body.data[0].translation).toBe('गोदाम');
    const source = await Operation.create({ orgId: f.org._id, siteId: f.site._id, createdBy: f.owner._id, title: 'Source', text: 'Original wording', sourceLanguage: 'en', deliveryMode: 'text', questionEnabled: false, requirePhoto: false, workerIds: [], crewIds: [], everyone: false, status: 'draft' });
    const improvement = await request(app).post(`/api/v1/operations/instructions/${source._id}/improvement`).set('Cookie', f.cookie).send({}).expect(201);
    expect(improvement.body.data.template).toMatchObject({ proposed: true, text: 'Original wording' });
    expect((await Operation.findById(source._id))?.status).toBe(source.status);
    await request(app).post('/api/v1/operations/plan-requests').set('Cookie', f.cookie).send({ plan: 'Growth', message: 'We need 60 workers.' }).expect(201);
    expect(await PlanRequest.countDocuments({ orgId: f.org._id })).toBe(1);
    await request(app).post('/api/v1/operations/plan-requests').set('Cookie', f.auditorCookie).send({ message: 'Auditor cannot request.' }).expect(403);
  });

  it('copies, searches, withdraws, and archives instructions while keeping history', async () => {
    const f = await fixture(); const worker = await makeWorker(f, 'HISTORY');
    const source = await operation(f, [worker], { title: 'Unique bay notice' });
    expect((await request(app).post(`/api/v1/operations/instructions/${source._id}/publish`).set('Cookie', f.cookie).send({})).status).toBe(200);
    const copy = await request(app).post(`/api/v1/operations/instructions/${source._id}/copy`).set('Cookie', f.cookie).send({}).expect(201);
    expect(copy.body.data).toMatchObject({ status: 'draft', version: 0, title: 'Unique bay notice (copy)' });
    const found = await request(app).get('/api/v1/operations/instructions?q=unique').set('Cookie', f.cookie).expect(200);
    expect(found.body.data.map((row: { id: string }) => row.id)).toContain(String(source._id));
    await request(app).post(`/api/v1/operations/instructions/${source._id}/withdraw`).set('Cookie', f.cookie).send({}).expect(200);
    const cookie = await workerCookie(f, 'HISTORY');
    const assignment = await Assignment.findOne({ instructionId: source._id });
    const retained = await request(app).get(`/api/v1/portal/assignments/${assignment!._id}`).set('Cookie', cookie).expect(200);
    expect(retained.body.data.status).toBe('withdrawn');
    expect((await mutate(cookie, assignment!._id, 'acknowledge', {})).status).toBe(409);
    expect((await Operation.findById(source._id))?.publications).toHaveLength(1);
    await request(app).post(`/api/v1/operations/instructions/${source._id}/archive`).set('Cookie', f.cookie).send({}).expect(200);
    expect((await Operation.findById(source._id))?.status).toBe('archived');
  });

  it('reminds overdue workers, lists notifications, and exports precise report evidence', async () => {
    const f = await fixture(); const worker = await makeWorker(f, 'REMIND');
    const instruction = await operation(f, [worker], { title: 'Deadline notice', deadline: new Date(Date.now() - 60_000) });
    expect((await request(app).post(`/api/v1/operations/instructions/${instruction._id}/publish`).set('Cookie', f.cookie).send({})).status).toBe(200);
    await operationsTick();
    const assignment = await Assignment.findOne({ instructionId: instruction._id });
    expect(assignment?.reminderAt).toBeTruthy();
    expect(await Notification.countDocuments({ workerId: worker._id, assignmentId: assignment!._id, body: 'This instruction is past its deadline.' })).toBe(1);
    const cookie = await workerCookie(f, 'REMIND');
    const list = await request(app).get('/api/v1/portal/notifications').set('Cookie', cookie).expect(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    await request(app).post('/api/v1/portal/notifications/read').set('Cookie', cookie).send({}).expect(200);
    expect((await Notification.findOne({ workerId: worker._id }))?.readBy).toContain(String(worker._id));
    const csv = await request(app).get('/api/v1/operations/reports.csv').set('Cookie', f.cookie).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('workerCode');
    expect(csv.text).toContain('REMIND');
    const pushKey = await request(app).get('/api/v1/portal/push-key').set('Cookie', cookie).expect(200);
    expect(pushKey.body.data.enabled).toBe(false);
    const shared = await workerCookie(f, 'REMIND', true);
    await request(app).get('/api/v1/portal/push-key').set('Cookie', shared).expect(403);
  });

  it('accepts a typed free-form response, opens a review case, and keeps completion separate', async () => {
    const f = await fixture(); const worker = await makeWorker(f, 'FREEFORM');
    const instruction = await operation(f, [worker], { questionEnabled: true, variants: [variant()] });
    expect((await request(app).post(`/api/v1/operations/instructions/${instruction._id}/publish`).set('Cookie', f.cookie).send({})).status).toBe(200);
    const assignment = await Assignment.findOne({ instructionId: instruction._id });
    const cookie = await workerCookie(f, 'FREEFORM');
    const answered = await mutate(cookie, assignment!._id, 'respond', { text: 'I moved the boxes next to bay 4.' }).expect(200);
    expect(answered.body.data).toMatchObject({ matched: null, assessment: 'needs_review' });
    const stored = await Assignment.findById(assignment!._id);
    expect(stored?.attempts[0]).toMatchObject({ text: 'I moved the boxes next to bay 4.' });
    expect(stored?.help.open).toBe(true);
    await mutate(cookie, assignment!._id, 'complete', {}).expect(409);
    await request(app).post(`/api/v1/operations/assignments/${assignment!._id}/messages`).set('Cookie', f.cookie).send({ text: 'Thanks, that is correct.', resolve: true }).expect(200);
    await mutate(cookie, assignment!._id, 'complete', {}).expect(200);
    expect((await Assignment.findById(assignment!._id))?.completedAt).toBeTruthy();
  });
});
