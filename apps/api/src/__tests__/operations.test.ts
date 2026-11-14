import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { Organization, User, Worker, Crew } from '../models.js';
import { Site } from '../modules/access/models.js';
import { hashPassword } from '../auth/passwords.js';
import { Assignment, Operation } from '../modules/operations/models.js';
import { registerPipelineJobs } from '../jobs/register.js';
import { operationsTick } from '../modules/operations/service.js';
import { closeKv } from '../stores/kv.js';

const app=createApp();const owner=request.agent(app);const supervisor=request.agent(app);const auditor=request.agent(app);const worker=request.agent(app);
let memory:import('mongodb-memory-server').MongoMemoryReplSet|undefined;
let orgId:string,siteA:string,siteB:string,crewId:string,workerId:string,otherWorkerId:string,instructionId:string,assignmentId:string;
const password='Correct horse battery staple!';
beforeAll(async()=>{
  if(process.env.TEST_MONGODB_URI)await mongoose.connect(process.env.TEST_MONGODB_URI,{dbName:`understood-ops-${randomUUID()}`});
  else{const {MongoMemoryReplSet}=await import('mongodb-memory-server');memory=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(memory.getUri(),{dbName:'ops-test'});}
  registerPipelineJobs();
  const org=await Organization.create({name:'Operations company',companyId:'operations-test',accessStatus:'active',subscription:'paid',workerLimit:25,siteLimit:2});orgId=String(org._id);
  const sites=await Site.create([{orgId,name:'Warehouse',timezone:'Asia/Dubai'},{orgId,name:'Hotel',timezone:'Asia/Beirut'}]);siteA=String(sites[0]!._id);siteB=String(sites[1]!._id);
  const hash=await hashPassword(password);
  await User.create([{orgId,name:'Owner',email:'ops-owner@test.example',role:'owner',siteIds:[siteA,siteB],passwordHash:hash,emailVerifiedAt:new Date()},
    {orgId,name:'Supervisor',email:'ops-supervisor@test.example',role:'supervisor',siteIds:[siteA],passwordHash:hash,emailVerifiedAt:new Date()},
    {orgId,name:'Auditor',email:'ops-auditor@test.example',role:'auditor',siteIds:[siteA],passwordHash:hash,emailVerifiedAt:new Date()}]);
  await owner.post('/api/v1/auth/login').send({email:'ops-owner@test.example',password}).expect(200);
  await supervisor.post('/api/v1/auth/login').send({email:'ops-supervisor@test.example',password}).expect(200);
  await auditor.post('/api/v1/auth/login').send({email:'ops-auditor@test.example',password}).expect(200);
  // Wait for all unique indexes before exercising concurrent idempotency.
  await Promise.all(Object.values(mongoose.models).map(model=>model.init()));
},180000);
afterAll(async()=>{await closeKv();await mongoose.connection.dropDatabase();await mongoose.disconnect();await memory?.stop();});
const payload=()=>({title:'Move blue boxes',siteId:siteA,sourceLanguage:'en',text:'Move the blue boxes to bay 4.',deliveryMode:'text',questionEnabled:true,question:{text:'Which bay?',options:['Bay 4','Bay 1','Bay 2'],correctIndex:0},workerIds:[workerId],crewIds:[],everyone:false,attachments:[]});
async function prepareAndReview(id:string){
  await supervisor.post(`/api/v1/operations/instructions/${id}/prepare`).send({}).expect(202);
  for(let i=0;i<100;i++){const r=await supervisor.get(`/api/v1/operations/instructions/${id}`).expect(200);if(r.body.data.instruction.status!=='preparing')break;await new Promise(r=>setTimeout(r,25));}
  // The detail payload feeds the language review UI; variants must be plain objects with their fields.
  const detail=await supervisor.get(`/api/v1/operations/instructions/${id}`).expect(200);
  const variants=detail.body.data.instruction.variants as Array<Record<string,unknown>>;
  expect(variants).toHaveLength(1);expect(variants[0]).toMatchObject({language:'en',status:'ready'});expect(typeof variants[0]!.text).toBe('string');expect(variants[0]).not.toHaveProperty('_doc');
  await supervisor.patch(`/api/v1/operations/instructions/${id}/variants/en`).send({reviewed:true}).expect(200);
}
describe('site-scoped operational workflow',()=>{
  it('enforces roles and site access while creating crew and worker credentials',async()=>{
    await auditor.post('/api/v1/operations/crews').send({siteId:siteA,name:'Forbidden'}).expect(403);
    await supervisor.post('/api/v1/operations/crews').send({siteId:siteB,name:'Other site'}).expect(403);
    const crew=await supervisor.post('/api/v1/operations/crews').send({siteId:siteA,name:'Morning crew'}).expect(201);crewId=crew.body.data.id;
    const result=await supervisor.post('/api/v1/operations/workers').send({siteId:siteA,crewId,name:'Asha',workerId:'W001',language:'en',password}).expect(201);workerId=result.body.data.id;
    expect(result.body.data.passwordHash).toBeUndefined();
    const otherCrew=await owner.post('/api/v1/operations/crews').send({siteId:siteB,name:'Hotel crew'}).expect(201);
    const other=await owner.post('/api/v1/operations/workers').send({siteId:siteB,crewId:otherCrew.body.data.id,name:'Other worker',workerId:'W002',language:'en',password}).expect(201);otherWorkerId=other.body.data.id;
    await supervisor.patch(`/api/v1/operations/workers/${otherWorkerId}`).send({name:'Must not change'}).expect(404);
    await worker.post('/api/v1/portal/auth/login').send({companyId:'operations-test',workerId:'W001',password,sharedDevice:true}).expect(200);
  });
  it('requires review before send and does not reveal matching options to workers',async()=>{
    await supervisor.post('/api/v1/operations/instructions').send({...payload(),workerIds:[otherWorkerId]}).expect(400);
    const created=await supervisor.post('/api/v1/operations/instructions').send(payload()).expect(201);instructionId=created.body.data.id;
    await supervisor.post(`/api/v1/operations/instructions/${instructionId}/prepare`).send({}).expect(202);
    for(let i=0;i<100;i++){const r=await supervisor.get(`/api/v1/operations/instructions/${instructionId}`);if(r.body.data.instruction.status==='ready')break;await new Promise(r=>setTimeout(r,25));}
    await supervisor.post(`/api/v1/operations/instructions/${instructionId}/publish`).send({}).expect(409);
    await supervisor.patch(`/api/v1/operations/instructions/${instructionId}/variants/en`).send({reviewed:true}).expect(200);
    await supervisor.post(`/api/v1/operations/instructions/${instructionId}/publish`).send({}).expect(200);
    const inbox=await worker.get('/api/v1/portal/bootstrap').expect(200);assignmentId=inbox.body.data.assignments[0].id;
    expect(inbox.body.data.assignments[0].snapshot.question.correctIndex).toBeUndefined();
    expect(inbox.body.data.assignments[0].snapshot.audience).toBeUndefined();
  });
  it('commits duplicate answers once, creates follow-up and keeps resolution separate from completion',async()=>{
    await worker.get(`/api/v1/portal/assignments/${assignmentId}`).expect(200);
    const key=randomUUID();const path=`/api/v1/portal/assignments/${assignmentId}/respond`;
    const responses=await Promise.all([worker.post(path).set('Idempotency-Key',key).send({optionIndex:1}),worker.post(path).set('Idempotency-Key',key).send({optionIndex:1})]);
    expect(responses.map(r=>r.status)).toEqual([200,200]);expect(responses[0]!.body.data.matched).toBe(false);
    expect((await Assignment.findById(assignmentId))!.attempts).toHaveLength(1);
    await worker.post(path).set('Idempotency-Key',key).send({optionIndex:0}).expect(409);
    await worker.post(`/api/v1/portal/assignments/${assignmentId}/complete`).set('Idempotency-Key',randomUUID()).send({}).expect(409);
    await supervisor.post(`/api/v1/operations/assignments/${assignmentId}/messages`).send({text:'Please use bay 4. Answer again.',requestAnswer:true}).expect(200);
    await worker.post(path).set('Idempotency-Key',randomUUID()).send({optionIndex:0}).expect(200);
    await supervisor.post(`/api/v1/operations/assignments/${assignmentId}/messages`).send({text:'Thanks. Issue resolved.',resolve:true}).expect(200);
    expect((await Assignment.findById(assignmentId))!.completedAt).toBeFalsy();
    await worker.post(`/api/v1/portal/assignments/${assignmentId}/complete`).set('Idempotency-Key',randomUUID()).send({}).expect(200);
    expect((await Assignment.findById(assignmentId))!.attempts).toHaveLength(2);
  });
  it('keeps publication and response history when updating and resending',async()=>{
    await supervisor.patch(`/api/v1/operations/instructions/${instructionId}`).send({...payload(),text:'Move blue boxes to bay 4 after lunch.'}).expect(200);
    expect((await Assignment.findById(assignmentId))!.snapshot.text).toBe('Move the blue boxes to bay 4.');
    await prepareAndReview(instructionId);await supervisor.post(`/api/v1/operations/instructions/${instructionId}/publish`).send({}).expect(200);
    expect(await Assignment.countDocuments({instructionId})).toBe(2);
    expect((await Operation.findById(instructionId))!.publications).toHaveLength(2);
    const reports=await auditor.get('/api/v1/operations/reports').expect(200);expect(reports.body.data.summary.completed).toBe(1);
    expect(reports.body.data.summary.matchingAnswers).toBe(1);
    const languages=reports.body.data.breakdowns.languages as Array<Record<string,unknown>>;
    expect(languages).toEqual([expect.objectContaining({name:'en',assigned:2,responded:1,matchingAnswers:1,completed:1})]);
    expect(reports.body.data.breakdowns.crews[0]).toMatchObject({name:'Morning crew',assigned:2});
  });
  it('treats acknowledgment as receipt and completion as a separate action',async()=>{
    const created=await supervisor.post('/api/v1/operations/instructions').send({...payload(),title:'Acknowledge notice',questionEnabled:false,question:null}).expect(201);const id=created.body.data.id;
    await prepareAndReview(id);await supervisor.post(`/api/v1/operations/instructions/${id}/publish`).send({}).expect(200);
    const a=await Assignment.findOne({instructionId:id});
    await worker.post(`/api/v1/portal/assignments/${a!._id}/acknowledge`).set('Idempotency-Key',randomUUID()).send({}).expect(200);
    expect((await Assignment.findById(a!._id))!.completedAt).toBeFalsy();
    await worker.post(`/api/v1/portal/assignments/${a!._id}/complete`).set('Idempotency-Key',randomUUID()).send({}).expect(200);
  });
  it('publishes due scheduled instructions and prevents cross-worker reads',async()=>{
    const created=await supervisor.post('/api/v1/operations/instructions').send({...payload(),title:'Scheduled notice',scheduledAt:new Date(Date.now()+2000).toISOString()}).expect(201);const id=created.body.data.id;
    await prepareAndReview(id);const r=await supervisor.post(`/api/v1/operations/instructions/${id}/publish`).send({}).expect(200);expect(r.body.data.status).toBe('scheduled');
    await Operation.updateOne({_id:id},{$set:{scheduledAt:new Date(Date.now()-100)}});await operationsTick();expect(await Assignment.countDocuments({instructionId:id})).toBe(1);
    const outsider=request.agent(app);await outsider.post('/api/v1/portal/auth/login').send({companyId:'operations-test',workerId:'W002',password}).expect(200);
    await outsider.get(`/api/v1/portal/assignments/${assignmentId}`).expect(404);
  });
  it('preserves historical audience after crew moves and restricts legacy API bypass',async()=>{
    const crew=await supervisor.post('/api/v1/operations/crews').send({siteId:siteA,name:'Afternoon crew'}).expect(201);
    await supervisor.patch(`/api/v1/operations/workers/${workerId}`).send({crewId:crew.body.data.id}).expect(200);
    expect(String((await Assignment.findById(assignmentId))!.crewId)).toBe(crewId);
    await owner.post('/api/v1/crews').send({name:'Bypass'}).expect(403);
    await supervisor.get(`/api/v1/operations/reports?siteId=${siteB}`).expect(403);
  });
  it('revokes access after disable and enforces pilot expiry on established sessions',async()=>{
    await supervisor.patch(`/api/v1/operations/workers/${workerId}`).send({accessDisabled:true}).expect(200);
    await worker.get('/api/v1/portal/bootstrap').expect(401);
    await Organization.updateOne({_id:orgId},{$set:{expiresAt:new Date(Date.now()-1000)}});
    await supervisor.get('/api/v1/operations/bootstrap').expect(403);
  });
});
