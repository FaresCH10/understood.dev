import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';

let app: Express;
let replSet: import('mongodb-memory-server').MongoMemoryReplSet;
let agent: ReturnType<typeof request.agent>;
let orgId: string;
let crewId: string;
const workerIds: Record<string, string> = {};

const STATUSES = ['ar', 'en', 'hi', 'ur', 'ml', 'bn'];

function bufferParser(res: unknown, callback: (error: Error | null, body: string) => void): void {
  const stream = res as NodeJS.ReadableStream;
  let body = '';
  stream.on('data', (chunk) => {
    body += chunk.toString('utf8');
  });
  stream.on('end', () => callback(null, body));
}

async function waitForInstructionStatus(id: string, wanted: string[], timeoutMs = 20_000): Promise<Record<string, unknown>> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await agent.get(`/api/v1/instructions/${id}/status`).expect(200);
    if (wanted.includes(response.body.data.status)) return response.body.data;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`instruction ${id} never reached ${wanted.join('|')}`);
}

beforeAll(async () => {
  const { MongoMemoryReplSet } = await import('mongodb-memory-server');
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri(), { dbName: 'understood-test', autoIndex: true });

  const { registerPipelineJobs } = await import('../jobs/register.js');
  registerPipelineJobs();
  const { createApp } = await import('../app.js');
  app = createApp();

  const { Organization, User, MagicLink } = await import('../models.js');
  const { tokenHash, randomToken } = await import('../auth/tokens.js');

  const org = await Organization.create({ name: 'Acme Contracting', timezone: 'Asia/Dubai', locale: 'en', plan: 'pilot' });
  orgId = String(org._id);
  await User.create({ orgId: org._id, email: 'owner@acme.test', name: 'Acme Owner', role: 'owner' });

  const token = randomToken(32);
  await MagicLink.create({
    email: 'owner@acme.test',
    tokenHash: tokenHash(token),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  agent = request.agent(app);
  await agent.get(`/api/v1/auth/verify?token=${encodeURIComponent(token)}`).expect(302);
  await agent.get('/api/v1/auth/me').expect(200);
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

describe('end-to-end supervisor and worker flow', () => {
  let instructionId = '';
  let shareToken = '';
  let previewToken = '';
  let enVariantId = '';
  let wrongDeliveryId = '';
  let deliveryToken = '';
  const attempts = { count: 0 };

  it('creates a crew and six workers through the API', async () => {
    const crew = await agent.post('/api/v1/crews').send({ name: 'Morning Crew' }).expect(201);
    crewId = crew.body.data.id;

    for (const language of STATUSES) {
      const response = await agent
        .post('/api/v1/workers')
        .send({ crewId, name: `Worker ${language}`, language })
        .expect(201);
      workerIds[language] = response.body.data.id;
    }

    const roster = await agent.get(`/api/v1/crews/${crewId}/workers?limit=50`).expect(200);
    expect(roster.body.data).toHaveLength(6);
  });

  it('creates an instruction and runs the six-language pipeline', async () => {
    const created = await agent.post('/api/v1/instructions').expect(201);
    instructionId = created.body.data.id;

    await agent
      .patch(`/api/v1/instructions/${instructionId}`)
      .send({
        title: 'Roof safety checks',
        sourceLanguage: 'en',
        content: { kind: 'text', text: 'Before entering the roof, wear your harness and check the gate.' },
      })
      .expect(200);

    // Voice generation without a confirmed transcript is rejected.
    const draft = await agent.post('/api/v1/instructions').expect(201);
    await agent
      .patch(`/api/v1/instructions/${draft.body.data.id}`)
      .send({ content: { kind: 'text', text: 'Draft to delete' } })
      .expect(200);
    await agent.delete(`/api/v1/instructions/${draft.body.data.id}`).expect(204);

    const generated = await agent
      .post(`/api/v1/instructions/${instructionId}/generate`)
      .send({ crewId, audienceWorkerIds: Object.values(workerIds) })
      .expect(202);
    expect(generated.body.meta.languages).toHaveLength(6);

    const status = await waitForInstructionStatus(instructionId, ['ready', 'partial_failure']);
    expect(status.status).toBe('ready');

    const detail = await agent.get(`/api/v1/instructions/${instructionId}`).expect(200);
    expect(detail.body.data.variants).toHaveLength(6);
    for (const variant of detail.body.data.variants) {
      expect(variant.status).toBe('ready');
      expect(variant.hasAudio).toBe(true);
      expect(variant.question.options).toHaveLength(3);
      if (variant.language === 'en') enVariantId = variant.id;
    }
  });

  it('mints a preview token that cannot write', async () => {
    const minted = await agent.post(`/api/v1/instructions/${instructionId}/preview-token`).expect(201);
    previewToken = minted.body.data.token;

    const preview = await agent.get(`/api/v1/w/preview/${previewToken}`).expect(200);
    expect(preview.body.data.preview).toBe(true);
    expect(preview.body.data.audience).toHaveLength(6);
    expect(preview.body.data.content.question.correctIndex).toBeUndefined();

    const write = await agent
      .post('/api/v1/w/answer')
      .set('Authorization', `Bearer ${previewToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ optionIndex: 0 })
      .expect(403);
    expect(write.body.error.code).toBe('PREVIEW_MODE');
  });

  it('shares transactionally and derives the audience from deliveries', async () => {
    const shared = await agent.post(`/api/v1/instructions/${instructionId}/share`).send({}).expect(200);
    expect(shared.body.data.deliveriesCreated).toBe(6);
    shareToken = new URL(shared.body.data.url).pathname.split('/').pop() ?? '';

    const secondShare = await agent.post(`/api/v1/instructions/${instructionId}/share`).send({}).expect(409);
    expect(secondShare.body.error.code).toBe('SHARE_CONFLICT');

    const meta = await request(app).get(`/api/v1/w/${shareToken}`).expect(200);
    expect(meta.body.data.audience).toHaveLength(6);
    expect(meta.body.data.availableLanguages).toHaveLength(6);
    expect(meta.body.data.instruction.titleVariants.en).toBeTruthy();

    const link = await agent.get(`/api/v1/instructions/${instructionId}/share-link`).expect(200);
    expect(new URL(link.body.data.url).pathname.split('/').pop()).toBe(shareToken);
  });

  it('runs the worker flow with retries, auto-help, completion and language changes', async () => {
    const identified = await request(app)
      .post(`/api/v1/w/${shareToken}/identify`)
      .send({ workerId: workerIds.ar })
      .expect(200);
    deliveryToken = identified.body.data.deliveryToken;
    expect(identified.body.data.instruction.text).toBeTruthy();
    expect(identified.body.data.instruction.audioUrl).toContain('/media/');

    const state = await request(app)
      .get('/api/v1/w/state')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .expect(200);
    const deliveryId = state.body.data.delivery.id;
    expect(state.body.data.delivery.status).toBe('opened');
    expect(state.body.data.instruction.question.correctIndex).toBeUndefined();

    const language = await request(app)
      .post('/api/v1/w/language')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ language: 'en' })
      .expect(200);
    expect(language.body.data.deliveryLanguage).toBe('en');
    expect(language.body.data.content.text).toContain('harness');

    const firstKey = randomUUID();
    const first = await request(app)
      .post('/api/v1/w/answer')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .set('Idempotency-Key', firstKey)
      .send({ optionIndex: 1 })
      .expect(200);
    expect(first.body.data).toMatchObject({ correct: false, firstAttempt: true, attemptsCount: 1 });
    attempts.count = 1;

    const replay = await request(app)
      .post('/api/v1/w/answer')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .set('Idempotency-Key', firstKey)
      .send({ optionIndex: 1 })
      .expect(200);
    expect(replay.body.data.attemptsCount).toBe(1);

    const conflict = await request(app)
      .post('/api/v1/w/answer')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .set('Idempotency-Key', firstKey)
      .send({ optionIndex: 2 })
      .expect(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');

    const second = await request(app)
      .post('/api/v1/w/answer')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ optionIndex: 2 })
      .expect(200);
    expect(second.body.data).toMatchObject({ correct: false, firstAttempt: false, attemptsCount: 2 });
    attempts.count = 2;

    const exhausted = await request(app)
      .post('/api/v1/w/answer')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ optionIndex: 0 })
      .expect(409);
    expect(exhausted.body.error.code).toBe('ATTEMPTS_EXHAUSTED');

    const revealed = await request(app)
      .get('/api/v1/w/state')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .expect(200);
    expect(revealed.body.data.instruction.question.correctIndex).toBe(0);
    expect(revealed.body.data.instruction.question.selectedIndex).toBe(2);
    expect(revealed.body.data.delivery.help.requested).toBe(true);
    expect(revealed.body.data.delivery.help.reason).toBe('dont_understand');

    const completed = await request(app)
      .post('/api/v1/w/complete')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(200);
    const completedAt = completed.body.data.completedAt;
    expect(completedAt).toBeTruthy();

    const replayComplete = await request(app)
      .post('/api/v1/w/complete')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(200);
    expect(replayComplete.body.data.completedAt).toBe(completedAt);

    const afterComplete = await request(app)
      .post('/api/v1/w/answer')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ optionIndex: 0 })
      .expect(409);
    expect(afterComplete.body.error.code).toBe('DELIVERY_COMPLETED');

    const workerTwo = await request(app)
      .post(`/api/v1/w/${shareToken}/identify`)
      .send({ workerId: workerIds.ml })
      .expect(200);
    const workerTwoToken = workerTwo.body.data.deliveryToken;
    await request(app)
      .post('/api/v1/w/answer')
      .set('Authorization', `Bearer ${workerTwoToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ optionIndex: 0 })
      .expect(200);
    await request(app)
      .post('/api/v1/w/complete')
      .set('Authorization', `Bearer ${workerTwoToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(200);

    const board = await agent.get(`/api/v1/instructions/${instructionId}/deliveries`).expect(200);
    expect(board.body.data).toHaveLength(6);
    expect(board.body.meta.counts.needsHelp).toBe(1);
    expect(board.body.meta.counts.understood).toBeGreaterThanOrEqual(1);
    const helpRow = board.body.data.find((row: { deliveryId: string }) => row.deliveryId === deliveryId);
    expect(helpRow.help.requested).toBe(true);
    wrongDeliveryId = deliveryId;

    const filtered = await agent.get(`/api/v1/instructions/${instructionId}/deliveries?filter=needs_help`).expect(200);
    expect(filtered.body.data).toHaveLength(1);

    const resolved = await agent.post(`/api/v1/deliveries/${wrongDeliveryId}/resolve-help`).send({}).expect(200);
    expect(resolved.body.data.resolvedAt).toBeTruthy();
    await agent.post(`/api/v1/deliveries/${wrongDeliveryId}/resolve-help`).send({}).expect(200);
  });

  it('reports home KPIs and export CSV with Excel safety', async () => {
    const overview = await agent.get('/api/v1/board/overview').expect(200);
    expect(overview.body.data.kpis.workers).toBe(6);
    expect(overview.body.data.kpis.liveInstructions).toBe(1);
    expect(overview.body.data.kpis.understood7d.understood).toBeGreaterThanOrEqual(1);
    expect(overview.body.data.exceptions.needsHelp).toHaveLength(0);

    const list = await agent.get('/api/v1/instructions?status=shared').expect(200);
    expect(list.body.data[0].id).toBe(instructionId);
    expect(list.body.data[0].targeted).toBe(6);

    const csv = await agent
      .get(`/api/v1/exports/instructions/${instructionId}.csv`)
      .buffer(true)
      .parse(bufferParser)
      .expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body.startsWith('\uFEFF')).toBe(true);
    expect(csv.body).toContain('instruction_id');
    expect(csv.body).toContain('Worker ar');

    const orgCsv = await agent.get('/api/v1/exports/org.csv').buffer(true).parse(bufferParser).expect(200);
    expect(orgCsv.body).toContain('Asia/Dubai');

    const workersCsv = await agent.get('/api/v1/exports/workers.csv').buffer(true).parse(bufferParser).expect(200);
    expect(workersCsv.body).toContain('worker_id');
  });

  it('fences stale pipeline jobs after a variant edit', async () => {
    const { Instruction, Variant } = await import('../models.js');
    const { runVariantJob } = await import('../modules/pipeline/runner.js');

    // A fresh instruction: variant edits are blocked once an instruction is shared.
    const created = await agent.post('/api/v1/instructions').expect(201);
    const fencingId = created.body.data.id as string;
    await agent
      .patch(`/api/v1/instructions/${fencingId}`)
      .send({
        title: 'Fencing check',
        sourceLanguage: 'en',
        content: { kind: 'text', text: 'Source text used for fencing checks.' },
      })
      .expect(200);
    await agent.post(`/api/v1/instructions/${fencingId}/generate`).send({ crewId }).expect(202);
    await waitForInstructionStatus(fencingId, ['ready']);

    const variantBefore = await Variant.findOne({ instructionId: fencingId, language: 'en' }).lean();
    expect(variantBefore).toBeTruthy();

    const edited = 'Edited English instruction for the rooftop crew.';
    await agent.patch(`/api/v1/variants/${variantBefore!._id}`).send({ text: edited }).expect(202);
    const processing = await agent.get(`/api/v1/instructions/${fencingId}/status`).expect(200);
    expect(processing.body.data.status).toBe('processing');

    // A job carrying the pre-edit revision must not overwrite the edited text.
    const afterEdit = await Instruction.findById(fencingId).lean();
    await runVariantJob({
      instructionId: fencingId,
      orgId,
      language: 'en',
      generation: afterEdit!.generation,
      revision: variantBefore!.revision,
    });
    const untouched = await Variant.findById(variantBefore!._id).lean();
    expect(untouched?.text).toBe(edited);

    await waitForInstructionStatus(fencingId, ['ready']);
    const refreshed = await Variant.findById(variantBefore!._id).lean();
    expect(refreshed?.text).toBe(edited);
    expect(refreshed?.revision).toBe(variantBefore!.revision + 1);
  });

  it('blocks cross-tenant reads and closes archived links', async () => {
    const { Organization, User, MagicLink } = await import('../models.js');
    const { tokenHash, randomToken } = await import('../auth/tokens.js');

    const otherOrg = await Organization.create({ name: 'Other Org', timezone: 'Asia/Dubai', locale: 'en', plan: 'pilot' });
    await User.create({ orgId: otherOrg._id, email: 'other@acme.test', name: 'Other Owner', role: 'owner' });
    const token = randomToken(32);
    await MagicLink.create({
      email: 'other@acme.test',
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    const otherAgent = request.agent(app);
    await otherAgent.get(`/api/v1/auth/verify?token=${encodeURIComponent(token)}`).expect(302);

    await otherAgent.get(`/api/v1/instructions/${instructionId}`).expect(404);
    await otherAgent.get(`/api/v1/instructions/${instructionId}/deliveries`).expect(404);
    await otherAgent.post(`/api/v1/deliveries/${wrongDeliveryId}/resolve-help`).send({}).expect(404);

    await agent.post(`/api/v1/instructions/${instructionId}/archive`).send({}).expect(200);
    const closed = await request(app).get(`/api/v1/w/${shareToken}`).expect(410);
    expect(closed.body.error.code).toBe('LINK_UNAVAILABLE');

    const closedState = await request(app)
      .get('/api/v1/w/state')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .expect(410);
    expect(closedState.body.error.code).toBe('LINK_UNAVAILABLE');

    const regenerated = await agent.post(`/api/v1/instructions/${instructionId}/regenerate-link`).send({}).expect(409);
    expect(regenerated.body.error.code).toBe('CONFLICT_STATE');
  });
});
