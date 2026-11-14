import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Organization, User, Worker, Crew } from '../models.js';
import { Site } from '../modules/access/models.js';
import { privacyRouter, workerPrivacyRouter, PrivacyErasure, runRetentionCleanup } from '../modules/operations/privacy.js';
import { Assignment, Operation, OperationAudit, OperationMutation, Notification, Upload, type Publication } from '../modules/operations/models.js';
import { PushSubscription } from '../modules/operations/push.js';
import { createSession, SESSION_COOKIE } from '../auth/sessions.js';
import { attachSession } from '../auth/middleware.js';
import { errorHandler, requestId } from '../http.js';
import { getStorage } from '../media/storage.js';

describe.skipIf(!process.env.TEST_MONGODB_URI)('privacy and response retention integration', () => {
  const app = express(); app.use(express.json()); app.use(cookieParser()); app.use(requestId); app.use(attachSession);
  app.use('/api/v1/operations', privacyRouter); app.use('/api/v1/portal/privacy', workerPrivacyRouter); app.use(errorHandler);
  let orgId: mongoose.Types.ObjectId; let userId: mongoose.Types.ObjectId; let siteId: mongoose.Types.ObjectId;
  let workerId: mongoose.Types.ObjectId; let assignmentId: mongoose.Types.ObjectId; let instructionId: mongoose.Types.ObjectId;
  let ownerCookie: string; let supervisorCookie: string; let privateKey: string; let sharedKey: string;
  const completedAt = new Date('2026-01-02T10:00:00Z');
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI!, { dbName: `privacy-test-${Date.now()}`, autoIndex: true });
    await Promise.all([Organization, User, Worker, Crew, Site, Assignment, Operation, OperationAudit, OperationMutation, Notification, Upload, PrivacyErasure, PushSubscription].map((entry) => entry.init()));
    const org = await Organization.create({ name: 'Privacy Test', companyId: `privacy-${Date.now()}`, accessStatus: 'active', expiresAt: new Date(Date.now() + 86400_000) }); orgId = org._id;
    const site = await Site.create({ orgId, name: 'Site', timezone: 'Asia/Dubai' }); siteId = site._id;
    const user = await User.create({ orgId, email: 'privacy-owner@company.test', role: 'owner', siteIds: [siteId] }); userId = user._id;
    const supervisor = await User.create({ orgId, email: 'privacy-supervisor@company.test', role: 'supervisor', siteIds: [siteId] });
    ownerCookie = `${SESSION_COOKIE}=${await createSession(user._id, orgId)}`;
    supervisorCookie = `${SESSION_COOKIE}=${await createSession(supervisor._id, orgId)}`;
    const crew = await Crew.create({ orgId, siteId, name: 'Crew' });
    const worker = await Worker.create({ orgId, siteId, crewId: crew._id, name: 'Private Worker', normalizedName: 'private worker', workerId: 'PRIVATE001', language: 'en' }); workerId = worker._id;
    privateKey = `orgs/${orgId}/uploads/private-${randomUUID()}.mp3`; sharedKey = `orgs/${orgId}/operations/shared-${randomUUID()}.mp3`;
    await getStorage().put(privateKey, Buffer.from('private voice'), 'audio/mpeg'); await getStorage().put(sharedKey, Buffer.from('shared instruction'), 'audio/mpeg');
    const variant = { language: 'en' as const, text: 'Move boxes', audioKey: sharedKey, status: 'ready' as const, reviewed: true, demo: false };
    const snapshot: Publication = { version: 1, publishedAt: new Date(), title: 'Move boxes', text: 'Move boxes', sourceLanguage: 'en', deliveryMode: 'both', questionEnabled: true, requirePhoto: false, variants: [variant], attachments: [], audience: [{ workerId: String(workerId), name: worker.name, language: 'en', crewId: String(crew._id) }] };
    const operation = await Operation.create({ orgId, siteId, createdBy: userId, title: snapshot.title, text: snapshot.text, sourceLanguage: 'en', status: 'published', variants: [variant], publications: [snapshot], version: 1, workerIds: [workerId] }); instructionId = operation._id;
    const assignment = await Assignment.create({ orgId, siteId, instructionId, workerId, workerName: worker.name, workerCode: worker.workerId, crewId: crew._id, version: 1, language: 'en', snapshot, variant, status: 'completed', completedAt,
      attempts: [{ id: randomUUID(), optionIndex: 0, text: 'My private response', audioKey: privateKey, matched: true, at: completedAt, language: 'en', question: 'Where?' }],
      messages: [{ id: randomUUID(), author: 'worker', authorId: String(workerId), text: 'My private message', at: completedAt, requestAnswer: false }],
    }); assignmentId = assignment._id;
    await Upload.create({ orgId, ownerId: String(workerId), key: privateKey, name: 'private.mp3', mime: 'audio/mpeg' });
    await Notification.create({ orgId, siteId, workerId, assignmentId, title: 'Private activity', body: 'Private details' });
    await OperationMutation.create({ actorId: String(workerId), key: randomUUID(), requestHash: 'hash', result: { private: true }, expireAt: new Date(Date.now() + 86400_000) });
    await PushSubscription.create({ orgId, actorId: String(workerId), worker: true, endpoint: `https://fcm.googleapis.com/${randomUUID()}`, keys: { p256dh: 'abc', auth: 'def' } });
  });
  afterAll(async () => {
    await getStorage().delete(privateKey); await getStorage().delete(sharedKey);
    if (mongoose.connection.readyState) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
  });

  it('restricts policy changes and requires exact worker confirmation', async () => {
    const initial = await request(app).get('/api/v1/operations/privacy').set('Cookie', ownerCookie).expect(200);
    expect(initial.body.data.retentionDays).toBeNull();
    await request(app).patch('/api/v1/operations/privacy').set('Cookie', supervisorCookie).send({ retentionDays: 30 }).expect(403);
    await request(app).delete(`/api/v1/operations/workers/${workerId}`).set('Cookie', ownerCookie).send({ confirmWorkerId: 'wrong' }).expect(400);
    expect(await Worker.exists({ _id: workerId })).not.toBeNull();
  });

  it('anonymizes evidence and removes private recordings without deleting shared instruction media', async () => {
    await request(app).delete(`/api/v1/operations/workers/${workerId}`).set('Cookie', ownerCookie).send({ confirmWorkerId: 'PRIVATE001' }).expect(200);
    expect(await Worker.exists({ _id: workerId })).toBeNull();
    const assignment = await Assignment.findById(assignmentId);
    expect(assignment?.completedAt?.toISOString()).toBe(completedAt.toISOString());
    expect(assignment?.attempts[0]).toMatchObject({ matched: true, optionIndex: 0, text: null, audioKey: null });
    expect(assignment?.attempts[0]?.at.toISOString()).toBe(completedAt.toISOString());
    expect(assignment?.workerName).toBe('Deleted worker'); expect(assignment?.workerCode).toBe('[deleted]');
    expect(assignment?.snapshot.audience[0]?.name).toBe('Deleted worker');
    expect(assignment?.messages[0]?.text).toBe('[Removed with worker profile]');
    expect((await Operation.findById(instructionId))?.publications[0]?.audience[0]?.name).toBe('Deleted worker');
    expect(await OperationMutation.countDocuments({ actorId: String(workerId) })).toBe(0);
    expect(await PushSubscription.countDocuments({ actorId: String(workerId) })).toBe(0);
    expect(await Notification.countDocuments({ workerId })).toBe(0);
    await expect(getStorage().get(privateKey)).rejects.toThrow();
    expect((await getStorage().get(sharedKey)).toString()).toBe('shared instruction');
    const audit = await OperationAudit.findOne({ action: 'worker.profile_deleted' });
    expect(JSON.stringify(audit)).not.toContain('Private Worker');
  });

  it('retains active work and source instructions when expiring old terminal response records', async () => {
    await request(app).patch('/api/v1/operations/privacy').set('Cookie', ownerCookie).send({ retentionDays: 30 }).expect(200);
    const old = new Date(Date.now() - 40 * 86400_000);
    await Assignment.collection.updateOne({ _id: assignmentId }, { $set: { updatedAt: old } });
    const original = await Assignment.findById(assignmentId).lean();
    const { _id: ignoredId, ...pending } = original!;
    const pendingAssignment = await Assignment.create({ ...pending, workerId: new mongoose.Types.ObjectId(), version: 2, status: 'pending' });
    await Assignment.collection.updateOne({ _id: pendingAssignment._id }, { $set: { updatedAt: old } });
    const result = await runRetentionCleanup();
    expect(result.assignmentsRemoved).toBe(1);
    expect(await Assignment.exists({ _id: assignmentId })).toBeNull();
    expect(await Assignment.exists({ _id: pendingAssignment._id })).not.toBeNull();
    expect(await Operation.exists({ _id: instructionId })).not.toBeNull();
    expect((await getStorage().get(sharedKey)).toString()).toBe('shared instruction');
  });
});
