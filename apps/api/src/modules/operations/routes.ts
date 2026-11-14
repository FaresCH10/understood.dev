import { randomUUID, createHash } from 'node:crypto';
import mongoose, { Types, type ClientSession } from 'mongoose';
import { Router, type Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { LANGUAGES, LANGUAGE_META, parseLanguage, type Language } from '@understood/shared';
import { asyncHandler, parseBody, sendData, routeParam } from '../../http.js';
import { AppError } from '../../errors.js';
import { config } from '../../config.js';
import { Worker, Crew, Organization, User, type StaffRole, type WorkerDoc } from '../../models.js';
import { requireStaff, requireSite, requireEntitlement, requireWorkerPortal, revokeWorkerSessions } from '../access/control.js';
import { Site, PlanRequest } from '../access/models.js';
import { hashPassword } from '../../auth/passwords.js';
import { getStorage } from '../../media/storage.js';
import { reencodePhoto, probeAudio } from '../../media/probe.js';
import { getProviders, getLanguageCapabilities } from '../pipeline/providers.js';
import { getQueue } from '../../jobs/queue.js';
import { parseCsv, buildCsv } from '../workers/csv.js';
import { Assignment, Operation, Notification, InstructionTemplate, Glossary, OperationAudit, OperationMutation, Upload, type AssignmentDoc, type OperationDoc, type PreparedVariant } from './models.js';
import { audienceFor, audit, notify, publishOperation, retryWaiting, prepareVariant, prepareRetainedPresentations } from './service.js';

export const operationsRouter = Router();
export const portalRouter = Router();
const READ: readonly StaffRole[] = ['owner','supervisor','auditor'];
const WRITE: readonly StaffRole[] = ['owner','supervisor'];
const id = z.string().regex(/^[a-f\d]{24}$/i);
const locale = z.enum(LANGUAGES);
const question = z.object({text:z.string().trim().min(1).max(500),options:z.array(z.string().trim().min(1).max(200)).length(3),correctIndex:z.number().int().min(0).max(2)}).refine(q=>new Set(q.options).size===3,{message:'Use three different answer options.'});
const attachments = z.array(z.object({key:z.string().max(500),name:z.string().max(200),mime:z.string().max(100),caption:z.string().max(500).default('')})).max(10);
const operationBody = z.object({
  title:z.string().trim().min(1).max(120),siteId:id,sourceLanguage:z.enum(['en','ar']).default('en'),
  text:z.string().trim().min(1).max(4000),deliveryMode:z.enum(['text','voice','both']).default('both'),
  questionEnabled:z.boolean().default(true),question:question.nullish(),requirePhoto:z.boolean().default(false),
  workerIds:z.array(id).max(10000).default([]),crewIds:z.array(id).max(1000).default([]),everyone:z.boolean().default(false),
  attachments:attachments.default([]),deadline:z.string().datetime().nullish(),scheduledAt:z.string().datetime().nullish(),
}).strict().superRefine((v,ctx)=>{
  if(v.requirePhoto && v.questionEnabled) ctx.addIssue({code:'custom',path:['requirePhoto'],message:'Photo evidence is available for acknowledgment-only instructions.'});
  if(v.deadline && v.scheduledAt && new Date(v.deadline)<=new Date(v.scheduledAt)) ctx.addIssue({code:'custom',path:['deadline'],message:'Deadline must follow scheduled delivery.'});
});
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024,files:1}}).single('file');

function out<T extends {_id: unknown}>(value: T) {return {...value,id:String(value._id)};}
function dateFields(body: z.infer<typeof operationBody>) {return {...body,deadline:body.deadline?new Date(body.deadline):null,scheduledAt:body.scheduledAt?new Date(body.scheduledAt):null};}
function fail(field: string, issue: string): never {throw new AppError('VALIDATION_FAILED',[{field,issue}]);}
async function staffScope(req: Request, roles = READ) {
  const ctx = await requireStaff(req,roles); await requireEntitlement(String(ctx.org._id));
  const wanted = typeof req.query.siteId==='string'?req.query.siteId:null;
  if(wanted && !ctx.siteIds.includes(wanted)) throw new AppError('FORBIDDEN');
  return {...ctx,filter:{orgId:ctx.org._id,siteId:{$in:(wanted?[wanted]:ctx.siteIds).map(s=>new Types.ObjectId(s))}}};
}
async function instructionFor(req: Request, roles = READ) {
  const ctx = await staffScope(req,roles);
  const instruction = await Operation.findOne({_id:routeParam(req.params.id),...ctx.filter});
  if(!instruction) throw new AppError('NOT_FOUND'); return {...ctx,instruction};
}
async function validateAudience(body: z.infer<typeof operationBody>, orgId: string) {
  if(body.workerIds.length && await Worker.countDocuments({_id:{$in:body.workerIds},orgId,siteId:body.siteId,archivedAt:null,accessDisabled:{$ne:true}})!==new Set(body.workerIds).size) fail('workerIds','Choose active workers within this site.');
  if(body.crewIds.length && await Crew.countDocuments({_id:{$in:body.crewIds},orgId,siteId:body.siteId,archivedAt:null})!==new Set(body.crewIds).size) fail('crewIds','Choose active crews within this site.');
  if(!body.everyone&&!body.workerIds.length&&!body.crewIds.length) fail('recipients','Choose workers, crews, or everyone.');
}
async function validateFiles(files: Array<{key:string}>, orgId: string, ownerId: string) {
  if(files.length && await Upload.countDocuments({orgId,ownerId,key:{$in:files.map(f=>f.key)}})!==new Set(files.map(f=>f.key)).size) throw new AppError('FORBIDDEN');
}
async function media(key?: string|null) {return key?(await getStorage().signedUrl(key)).url:null;}
function retainedPresentation(a: AssignmentDoc, language: Language): PreparedVariant | null {
  const approved = (v: PreparedVariant) => v.language === language && v.status === 'ready' && v.reviewed;
  return a.presentations.find(approved) ?? a.snapshot.variants.find(approved) ?? null;
}
async function serializedAssignment(a: AssignmentDoc, worker = false) {
  const variant = a.variant;
  const q = variant.question;
  const snapshot = {title:a.snapshot.title,text:variant.text,deliveryMode:a.snapshot.deliveryMode,questionEnabled:a.snapshot.questionEnabled,
    question:q?{text:q.text,options:q.options,...(!worker?{correctIndex:q.correctIndex}:{})}:null,
    requirePhoto:a.snapshot.requirePhoto,deadline:a.snapshot.deadline,language:a.language,demo:variant.demo,
    audioUrl:await media(variant.audioKey),attachments:await Promise.all(a.snapshot.attachments.map(async f=>({...f,url:await media(f.key)}))),
  };
  return {id:String(a._id),_id:String(a._id),instructionId:String(a.instructionId),workerId:String(a.workerId),workerName:a.workerName,workerCode:a.workerCode,
    siteId:String(a.siteId),crewId:String(a.crewId),version:a.version,language:a.language,title:a.snapshot.title,status:a.status,
    questionEnabled:a.snapshot.questionEnabled,deadline:a.snapshot.deadline,createdAt:a.createdAt,openedAt:a.openedAt,
    acknowledgedAt:a.acknowledgedAt,completedAt:a.completedAt,needsAnswer:a.needsAnswer,help:a.help,snapshot,
    attempts:await Promise.all(a.attempts.map(async attempt=>{const {expectedIndex,...safe}=attempt;return {...safe,...(!worker?{expectedIndex}:{}),audioUrl:await media(attempt.audioKey)};})),
    messages:a.messages,photoUrl:await media(a.photoKey),
    ...(!worker?{originalText:a.snapshot.text,sourceLanguage:a.snapshot.sourceLanguage,presentations:await Promise.all((a.presentations??[]).map(async v=>({...v,audioUrl:await media(v.audioKey)})))}:{}),
  };
}

operationsRouter.get('/bootstrap',asyncHandler(async(req,res)=>{
  const ctx=await staffScope(req); const [instructions,workers,crews,notifications,openCases,waiting]=await Promise.all([
    Operation.find(ctx.filter).sort({updatedAt:-1}).limit(30).lean(),Worker.find({...ctx.filter,archivedAt:null}).select('-passwordHash').sort({name:1}).lean(),
    Crew.find({...ctx.filter,archivedAt:null}).lean(),Notification.find({...ctx.filter,workerId:null}).sort({createdAt:-1}).limit(50).lean(),
    Assignment.countDocuments({...ctx.filter,'help.open':true}),Assignment.countDocuments({...ctx.filter,status:'waiting'}),
  ]);
  sendData(res,{instructions:instructions.map(out),workers:workers.map(out),crews:crews.map(out),notifications:notifications.map(out),languages:getLanguageCapabilities(),demo:config.AI_DRIVER==='mock',stats:{instructions:instructions.length,workers:workers.length,openCases,deliveryProblems:waiting}});
}));
operationsRouter.get('/instructions',asyncHandler(async(req,res)=>{
  const ctx=await staffScope(req); const q=typeof req.query.q==='string'?req.query.q.slice(0,120):'';
  const status=typeof req.query.status==='string'&&req.query.status!=='all'?req.query.status:null;
  sendData(res,(await Operation.find({...ctx.filter,...(q?{title:{$regex:q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'}}:{}),...(status?{status}:{})}).sort({updatedAt:-1}).limit(200).lean()).map(out));
}));
operationsRouter.post('/instructions',asyncHandler(async(req,res)=>{
  const body=parseBody(operationBody,req); const ctx=await requireSite(req,body.siteId,WRITE);await requireEntitlement(String(ctx.org._id));
  await validateAudience(body,String(ctx.org._id));await validateFiles(body.attachments,String(ctx.org._id),String(ctx.user._id));
  const instruction=await Operation.create({...dateFields(body),orgId:ctx.org._id,createdBy:ctx.user._id});
  await audit(String(ctx.org._id),String(ctx.user._id),'instruction_created',String(instruction._id),body.siteId);
  sendData(res,out(instruction.toObject()),undefined,201);
}));
operationsRouter.get('/instructions/:id',asyncHandler(async(req,res)=>{
  const {instruction}=await instructionFor(req);
  const assignments=await Assignment.find({instructionId:instruction._id}).sort({version:-1,workerName:1}).lean();
  const plain=instruction.toObject();
  const hydrated={...plain,variants:await Promise.all(plain.variants.map(async v=>({...v,audioUrl:await media(v.audioKey)})))};
  sendData(res,{instruction:out(hydrated),assignments:await Promise.all(assignments.map(a=>serializedAssignment(a))),versions:instruction.publications});
}));
operationsRouter.patch('/instructions/:id',asyncHandler(async(req,res)=>{
  const {instruction,user,org}=await instructionFor(req,WRITE); const body=parseBody(operationBody,req);
  if(['preparing','scheduled','withdrawn','archived'].includes(instruction.status)) throw new AppError('CONFLICT_STATE');
  if(body.siteId!==String(instruction.siteId)) fail('siteId','Create a separate instruction to change sites.');
  await validateAudience(body,String(org._id));await validateFiles(body.attachments,String(org._id),String(user._id));
  instruction.set({...dateFields(body),status:'draft',variants:[],generation:instruction.generation+1});await instruction.save();
  await audit(String(org._id),String(user._id),'instruction_draft_updated',String(instruction._id),body.siteId,{previousVersion:instruction.version});
  sendData(res,out(instruction.toObject()));
}));
operationsRouter.post('/instructions/:id/prepare',asyncHandler(async(req,res)=>{
  const {instruction}=await instructionFor(req,WRITE);
  if(!['draft','ready','partial_failure'].includes(instruction.status)) throw new AppError('CONFLICT_STATE');
  if(!(await audienceFor(instruction)).length) fail('recipients','Choose at least one active recipient.');
  instruction.status='preparing';instruction.generation++;instruction.variants=[];await instruction.save();
  await getQueue().enqueue('operation',{instructionId:String(instruction._id),generation:instruction.generation},{jobId:`operation-${instruction._id}-${instruction.generation}`});
  sendData(res,out(instruction.toObject()),undefined,202);
}));
operationsRouter.patch('/instructions/:id/variants/:language',asyncHandler(async(req,res)=>{
  const {instruction,user,org}=await instructionFor(req,WRITE);
  if(!['ready','partial_failure'].includes(instruction.status)) throw new AppError('CONFLICT_STATE');
  const language=locale.parse(req.params.language);const body=parseBody(z.object({text:z.string().trim().min(1).max(4000).optional(),question:question.optional(),reviewed:z.boolean().optional()}).strict(),req);
  const variant=instruction.variants.find(v=>v.language===language);if(!variant) throw new AppError('NOT_FOUND');
  if(body.text!==undefined&&body.text!==variant.text){
    variant.text=body.text;variant.audioKey=null;variant.reviewed=false;
    if(instruction.deliveryMode!=='text'&&config.AI_DRIVER!=='mock'){
      const meta=LANGUAGE_META[language];const audio=await getProviders().tts.synthesize({text:body.text,lang:language,voiceId:meta.voiceId});
      variant.audioKey=`orgs/${org._id}/operations/${randomUUID()}.mp3`;await getStorage().put(variant.audioKey,audio.audio,audio.mime);
    }
  }
  if(body.question) variant.question=body.question;
  if(instruction.questionEnabled&&!variant.question) fail('question','Add a question before approving this language.');
  if(!variant.text) fail('text','Add translated text before approving this language.');
  variant.status='ready';variant.error=null;variant.reviewed=body.reviewed??false;
  instruction.markModified('variants');instruction.status=instruction.variants.every(v=>v.status==='ready')?'ready':'partial_failure';await instruction.save();
  await audit(String(org._id),String(user._id),'variant_reviewed',String(instruction._id),String(instruction.siteId),{language,reviewed:variant.reviewed});
  sendData(res,out(instruction.toObject()));
}));
operationsRouter.post('/instructions/:id/publish',asyncHandler(async(req,res)=>{
  const {instruction,user}=await instructionFor(req,WRITE);const body=parseBody(z.object({acceptPartial:z.boolean().default(false)}),req);
  sendData(res,out(await publishOperation(String(instruction._id),String(user._id),body.acceptPartial)));
}));
operationsRouter.post('/instructions/:id/retry',asyncHandler(async(req,res)=>{
  const {instruction}=await instructionFor(req,WRITE);
  if(instruction.status==='published'){sendData(res,{prepared:await retryWaiting(String(instruction._id)),reviewRequired:true});return;}
  if(instruction.status!=='partial_failure') throw new AppError('CONFLICT_STATE');
  instruction.status='preparing';instruction.generation++;await instruction.save();
  await getQueue().enqueue('operation',{instructionId:String(instruction._id),generation:instruction.generation},{jobId:`operation-${instruction._id}-${instruction.generation}`});
  sendData(res,out(instruction.toObject()),undefined,202);
}));
operationsRouter.post('/assignments/:id/release',asyncHandler(async(req,res)=>{
  const ctx=await staffScope(req,WRITE);const a=await Assignment.findOne({_id:routeParam(req.params.id),...ctx.filter,status:'waiting'});
  if(!a||a.variant.status!=='ready') throw new AppError('INSTRUCTION_NOT_READY');
  a.variant.reviewed=true;a.status='pending';await a.save();
  await notify({orgId:String(a.orgId),siteId:String(a.siteId),workerId:String(a.workerId),assignmentId:String(a._id),title:a.snapshot.title,body:'Your instruction is ready.',eventKey:`assignment-${a._id}`});
  await audit(String(a.orgId),String(ctx.user._id),'delivery_reviewed_released',String(a._id),String(a.siteId));sendData(res,await serializedAssignment(a.toObject()));
}));
for(const action of ['withdraw','archive'] as const) operationsRouter.post(`/instructions/:id/${action}`,asyncHandler(async(req,res)=>{
  const {instruction,user,org}=await instructionFor(req,WRITE);instruction.status=action==='withdraw'?'withdrawn':'archived';instruction.generation++;await instruction.save();
  if(action==='withdraw') await Assignment.updateMany({instructionId:instruction._id,status:{$ne:'completed'}},{$set:{status:'withdrawn'}});
  await audit(String(org._id),String(user._id),`instruction_${action}`,String(instruction._id),String(instruction.siteId));sendData(res,out(instruction.toObject()));
}));
operationsRouter.post('/instructions/:id/copy',asyncHandler(async(req,res)=>{
  const {instruction,user}=await instructionFor(req,WRITE); const {publications,variants,_id,createdAt,updatedAt,...fields}=instruction.toObject();
  const copy=await Operation.create({...fields,title:`${instruction.title.slice(0,110)} (copy)`,createdBy:user._id,status:'draft',version:0,generation:0,publications:[],variants:[],scheduledAt:null,deadline:null,previousId:instruction._id});
  sendData(res,out(copy.toObject()),undefined,201);
}));

operationsRouter.get('/workers',asyncHandler(async(req,res)=>{const ctx=await staffScope(req);sendData(res,(await Worker.find({...ctx.filter,archivedAt:null}).sort({name:1}).lean()).map(out));}));
operationsRouter.get('/crews',asyncHandler(async(req,res)=>{const ctx=await staffScope(req);sendData(res,(await Crew.find({...ctx.filter,archivedAt:null}).sort({name:1}).lean()).map(out));}));
operationsRouter.post('/crews',asyncHandler(async(req,res)=>{
  const body=parseBody(z.object({name:z.string().trim().min(1).max(80),siteId:id}),req);const ctx=await requireSite(req,body.siteId,WRITE);await requireEntitlement(String(ctx.org._id));
  const crew=await Crew.create({...body,orgId:ctx.org._id});sendData(res,out(crew.toObject()),undefined,201);
}));
operationsRouter.patch('/crews/:id',asyncHandler(async(req,res)=>{
  const ctx=await staffScope(req,WRITE);const body=parseBody(z.object({name:z.string().trim().min(1).max(80).optional(),archived:z.boolean().optional()}),req);
  const crew=await Crew.findOne({_id:routeParam(req.params.id),...ctx.filter});if(!crew)throw new AppError('NOT_FOUND');
  if(body.name)crew.name=body.name;if(body.archived!==undefined)crew.archivedAt=body.archived?new Date():null;await crew.save();sendData(res,out(crew.toObject()));
}));
const workerBody=z.object({name:z.string().trim().min(1).max(80),workerId:z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/).transform(v=>v.toUpperCase()),crewId:id,siteId:id,language:locale,password:z.string().min(10).max(128)});
operationsRouter.post('/workers',asyncHandler(async(req,res)=>{
  const body=parseBody(workerBody,req);const ctx=await requireSite(req,body.siteId,WRITE);const entitlement=await requireEntitlement(String(ctx.org._id));
  if(!await Crew.exists({_id:body.crewId,orgId:ctx.org._id,siteId:body.siteId,archivedAt:null}))fail('crewId','Choose an active crew within this site.');
  const passwordHash=await hashPassword(body.password);const session=await mongoose.startSession();let created:unknown;
  try{await session.withTransaction(async()=>{
    await Organization.updateOne({_id:ctx.org._id},{$inc:{'features.rosterRevision':1}},{session});
    if(await Worker.countDocuments({orgId:ctx.org._id,archivedAt:null,accessDisabled:{$ne:true}}).session(session)>=entitlement.workerLimit)throw new AppError('WORKER_LIMIT_REACHED');
    const {password,...fields}=body;const docs=await Worker.create([{...fields,orgId:ctx.org._id,normalizedName:body.name.trim().toLowerCase(),passwordHash}],{session});
    const raw=docs[0]!.toObject();delete raw.passwordHash;created=out(raw);
  });}catch(error){if((error as {code?:number}).code===11000)fail('workerId','This worker ID already exists.');throw error;}finally{await session.endSession();}
  await audit(String(ctx.org._id),String(ctx.user._id),'worker_created',String((created as {id:string}).id),body.siteId);sendData(res,created,undefined,201);
}));
operationsRouter.patch('/workers/:id',asyncHandler(async(req,res)=>{
  const ctx=await staffScope(req,WRITE);const body=parseBody(z.object({name:z.string().trim().min(1).max(80).optional(),crewId:id.optional(),language:locale.optional(),accessDisabled:z.boolean().optional()}),req);
  const workerId=routeParam(req.params.id);
  const worker=await (async():Promise<mongoose.HydratedDocument<WorkerDoc>|null>=>{
    const session=await mongoose.startSession();let updated:mongoose.HydratedDocument<WorkerDoc>|null=null;
    try{await session.withTransaction(async()=>{
      // The roster revision write serializes concurrent quota checks on the same workspace.
      await Organization.updateOne({_id:ctx.org._id},{$inc:{'features.rosterRevision':1}},{session});
      updated=await Worker.findOne({_id:workerId,...ctx.filter,archivedAt:null}).session(session);
      if(!updated)throw new AppError('NOT_FOUND');
      if(body.crewId&&!await Crew.exists({_id:body.crewId,orgId:ctx.org._id,siteId:updated.siteId,archivedAt:null}).session(session))fail('crewId','Choose a crew within this site.');
      if(body.accessDisabled===false&&updated.accessDisabled){const cap=await requireEntitlement(String(ctx.org._id));if(await Worker.countDocuments({orgId:ctx.org._id,archivedAt:null,accessDisabled:{$ne:true}}).session(session)>=cap.workerLimit)throw new AppError('WORKER_LIMIT_REACHED');}
      updated.set(body);if(body.name)updated.normalizedName=body.name.trim().toLowerCase();if(body.language){updated.requestedLanguage=null;updated.languageSelected=true;}
      await updated.save({session});
    });}finally{await session.endSession();}
    return updated;
  })();
  if(!worker)throw new AppError('NOT_FOUND');
  if(body.accessDisabled)await revokeWorkerSessions(workerId);
  if(body.language)await prepareRetainedPresentations(workerId,body.language);
  await audit(String(ctx.org._id),String(ctx.user._id),'worker_updated',workerId,String(worker.siteId),{fields:Object.keys(body)});sendData(res,out(worker.toObject()));
}));
operationsRouter.post('/workers/:id/language',asyncHandler(async(req,res)=>{
  const ctx=await staffScope(req,WRITE);const body=parseBody(z.object({approve:z.boolean()}),req);
  const worker=await Worker.findOne({_id:routeParam(req.params.id),...ctx.filter});if(!worker||!worker.requestedLanguage)throw new AppError('NOT_FOUND');
  const requested=worker.requestedLanguage;if(body.approve)worker.language=requested;worker.requestedLanguage=null;await worker.save();
  if(body.approve)await prepareRetainedPresentations(String(worker._id),requested);
  await audit(String(ctx.org._id),String(ctx.user._id),'language_request_reviewed',String(worker._id),String(worker.siteId),{approved:body.approve,language:requested});
  sendData(res,out(worker.toObject()));
}));
operationsRouter.post('/workers/import',upload,asyncHandler(async(req,res)=>{
  const siteId=id.parse(req.body.siteId);const ctx=await requireSite(req,siteId,WRITE);const cap=await requireEntitlement(String(ctx.org._id));
  if(!req.file)fail('file','Choose a CSV file.');
  const rows=parseCsv(req.file.buffer.toString('utf8'));const headers=(rows.shift()??[]).map(x=>x.trim().toLowerCase());
  const required=['name','workerid','crew','language','password'];if(required.some(h=>!headers.includes(h)))fail('file','CSV requires name, workerId, crew, language, password columns.');
  if(rows.length>1000)fail('file','Import at most 1000 workers at a time.');
  const parsed=rows.filter(row=>row.some(c=>c.trim())).map((row,i)=>{
    const col=(key:string)=>row[headers.indexOf(key)]?.trim()??'';const language=parseLanguage(col('language'));
    if(!language)fail(`row ${i+2}`,'Unsupported language.');
    const data=workerBody.omit({crewId:true}).safeParse({name:col('name'),workerId:col('workerid'),siteId,language,password:col('password')});
    if(!data.success||!col('crew'))fail(`row ${i+2}`,'Check name, worker ID, crew and password (10+ characters).');return {...data.data,crewName:col('crew')};
  });
  if(new Set(parsed.map(w=>w.workerId)).size!==parsed.length)fail('workerId','Duplicate worker IDs in CSV.');
  if(await Worker.exists({orgId:ctx.org._id,workerId:{$in:parsed.map(w=>w.workerId)}}))fail('workerId','One or more IDs already exist. No workers were imported.');
  const prepared=await Promise.all(parsed.map(async w=>({...w,passwordHash:await hashPassword(w.password)})));
  const session=await mongoose.startSession();try{await session.withTransaction(async()=>{
    await Organization.updateOne({_id:ctx.org._id},{$inc:{'features.rosterRevision':1}},{session});
    if(await Worker.countDocuments({orgId:ctx.org._id,archivedAt:null,accessDisabled:{$ne:true}}).session(session)+prepared.length>cap.workerLimit)throw new AppError('WORKER_LIMIT_REACHED');
    for(const row of prepared){let crew=await Crew.findOne({orgId:ctx.org._id,siteId,name:row.crewName,archivedAt:null}).session(session);if(!crew)crew=(await Crew.create([{orgId:ctx.org._id,siteId,name:row.crewName}],{session}))[0]!;
      await Worker.create([{orgId:ctx.org._id,siteId,crewId:crew._id,name:row.name,normalizedName:row.name.toLowerCase(),workerId:row.workerId,language:row.language,passwordHash:row.passwordHash}],{session});}
  });}finally{await session.endSession();}
  await audit(String(ctx.org._id),String(ctx.user._id),'workers_imported',siteId,siteId,{count:parsed.length});sendData(res,{imported:parsed.length});
}));

async function uploadFile(req:Request,orgId:string,ownerId:string){
  const file=req.file;if(!file)fail('file','Choose a file.');let buffer=file.buffer;let mime=file.mimetype;let suffix='bin';
  if(mime.startsWith('image/')){buffer=await reencodePhoto(buffer);mime='image/jpeg';suffix='jpg';}
  else if(mime==='application/pdf'){if(buffer.subarray(0,5).toString()!=='%PDF-')throw new AppError('UNSUPPORTED_MEDIA');suffix='pdf';}
  else if(mime==='text/plain'){if(buffer.includes(0))throw new AppError('UNSUPPORTED_MEDIA');suffix='txt';}
  else if(['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-m4a','audio/aac'].includes(mime)){suffix=mime.split('/')[1]!.replace('x-','');if(!await probeAudio(buffer,suffix))fail('file','Audio could not be read.');}
  else throw new AppError('UNSUPPORTED_MEDIA');
  const key=`orgs/${orgId}/uploads/${ownerId}/${randomUUID()}.${suffix}`;
  await getStorage().put(key,buffer,mime);const name=file.originalname.replace(/[\\/\x00-\x1f]/g,'').slice(0,200);
  await Upload.create({orgId,ownerId,key,name,mime});return {key,name,mime,caption:'',url:await media(key)};
}
operationsRouter.post('/uploads',upload,asyncHandler(async(req,res)=>{const ctx=await staffScope(req,WRITE);sendData(res,await uploadFile(req,String(ctx.org._id),String(ctx.user._id)),undefined,201);}));
operationsRouter.post('/transcribe',upload,asyncHandler(async(req,res)=>{
  await staffScope(req,WRITE);if(!req.file)fail('file','Choose an audio recording.');
  if(config.AI_DRIVER==='mock')fail('file','Transcription requires live speech services. Type the instruction in demo mode.');
  const result=await getProviders().transcription.transcribe({audio:req.file.buffer,mime:req.file.mimetype});sendData(res,{text:result.text,sourceLanguage:result.detectedLanguage??'en'});
}));

operationsRouter.get('/cases',asyncHandler(async(req,res)=>{const ctx=await staffScope(req);sendData(res,await Promise.all((await Assignment.find({...ctx.filter,$or:[{'help.open':true},{status:'waiting'}]}).sort({updatedAt:-1}).limit(200).lean()).map(a=>serializedAssignment(a))));}));
operationsRouter.post('/assignments/:id/messages',asyncHandler(async(req,res)=>{
  const ctx=await staffScope(req,WRITE);const body=parseBody(z.object({text:z.string().trim().max(4000).default(''),requestAnswer:z.boolean().default(false),resolve:z.boolean().default(false),assigneeId:id.nullish()}),req);
  const assignment=await Assignment.findOne({_id:routeParam(req.params.id),...ctx.filter});if(!assignment)throw new AppError('NOT_FOUND');
  if(body.assigneeId&&!await User.exists({_id:body.assigneeId,orgId:ctx.org._id,role:{$in:WRITE},disabledAt:null,$or:[{role:'owner'},{siteIds:assignment.siteId}]}))fail('assigneeId','Assign to an authorized supervisor.');
  if(body.text)assignment.messages.push({id:randomUUID(),author:'staff',authorId:String(ctx.user._id),text:body.text,at:new Date(),requestAnswer:body.requestAnswer});
  if(body.requestAnswer){if(!assignment.snapshot.questionEnabled)fail('requestAnswer','Acknowledgment-only instructions have no answer question.');assignment.needsAnswer=true;assignment.help.open=true;assignment.help.reason='Another answer requested';}
  if(body.resolve){assignment.help.open=false;assignment.help.resolvedAt=new Date();}
  if(body.assigneeId!==undefined)assignment.help.assigneeId=body.assigneeId;
  await assignment.save();await audit(String(ctx.org._id),String(ctx.user._id),'followup_updated',String(assignment._id),String(assignment.siteId),{requestAnswer:body.requestAnswer,resolved:body.resolve});
  await notify({orgId:String(ctx.org._id),siteId:String(assignment.siteId),workerId:String(assignment.workerId),title:assignment.snapshot.title,body:body.requestAnswer?'Your supervisor requested another answer.':'Your supervisor updated your instruction.',assignmentId:String(assignment._id)});
  sendData(res,await serializedAssignment(assignment.toObject()));
}));
operationsRouter.post('/assignments/:id/presentation',asyncHandler(async(req,res)=>{
  const ctx=await staffScope(req,WRITE);const body=parseBody(z.object({language:locale,reviewed:z.literal(true)}),req);
  const assignment=await Assignment.findOne({_id:routeParam(req.params.id),...ctx.filter});if(!assignment)throw new AppError('NOT_FOUND');
  const presentation=assignment.presentations.find(v=>v.language===body.language);if(!presentation||presentation.status!=='ready')throw new AppError('INSTRUCTION_NOT_READY');
  presentation.reviewed=true;assignment.markModified('presentations');
  if(assignment.help.reason==='Translated view awaits review'){assignment.help.open=false;assignment.help.resolvedAt=new Date();}
  await assignment.save();await audit(String(ctx.org._id),String(ctx.user._id),'presentation_reviewed',String(assignment._id),String(assignment.siteId),{language:body.language});
  sendData(res,await serializedAssignment(assignment.toObject()));
}));
operationsRouter.get('/notifications',asyncHandler(async(req,res)=>{const ctx=await staffScope(req);sendData(res,(await Notification.find({...ctx.filter,workerId:null}).sort({createdAt:-1}).limit(100).lean()).map(out));}));
operationsRouter.post('/notifications/read',asyncHandler(async(req,res)=>{const ctx=await staffScope(req);await Notification.updateMany({...ctx.filter,workerId:null},{$addToSet:{readBy:String(ctx.user._id)}});sendData(res,{read:true});}));
operationsRouter.get('/templates',asyncHandler(async(req,res)=>{const ctx=await staffScope(req);sendData(res,(await InstructionTemplate.find({orgId:ctx.org._id}).sort({updatedAt:-1}).lean()).map(out));}));
operationsRouter.post('/templates',asyncHandler(async(req,res)=>{const ctx=await staffScope(req,WRITE);const body=parseBody(z.object({name:z.string().trim().min(1).max(120),text:z.string().trim().min(1).max(4000),sourceLanguage:z.enum(['en','ar']).default('en'),questionEnabled:z.boolean().default(true),question:question.nullish()}),req);sendData(res,out((await InstructionTemplate.create({...body,orgId:ctx.org._id})).toObject()),undefined,201);}));
operationsRouter.delete('/templates/:id',asyncHandler(async(req,res)=>{const ctx=await staffScope(req,WRITE);await InstructionTemplate.deleteOne({_id:routeParam(req.params.id),orgId:ctx.org._id});sendData(res,{deleted:true});}));
operationsRouter.post('/instructions/:id/improvement',asyncHandler(async(req,res)=>{
  const {instruction,org}=await instructionFor(req,WRITE);const cases=await Assignment.countDocuments({instructionId:instruction._id,'help.open':true});
  const template=await InstructionTemplate.create({orgId:org._id,name:`Review: ${instruction.title}`.slice(0,120),text:instruction.text,sourceLanguage:instruction.sourceLanguage,questionEnabled:instruction.questionEnabled,question:instruction.question,proposed:true,sourceInstructionId:instruction._id});
  sendData(res,{template:out(template.toObject()),openCases:cases,note:'Review this copy and clarify the steps before publishing. The original instruction is unchanged.'},undefined,201);
}));
operationsRouter.get('/glossary',asyncHandler(async(req,res)=>{const ctx=await staffScope(req);sendData(res,(await Glossary.find({orgId:ctx.org._id}).sort({term:1}).lean()).map(out));}));
operationsRouter.post('/glossary',asyncHandler(async(req,res)=>{const ctx=await staffScope(req,WRITE);const body=parseBody(z.object({term:z.string().trim().min(1).max(200),translation:z.string().trim().min(1).max(300),language:locale}),req);const entry=await Glossary.findOneAndUpdate({orgId:ctx.org._id,term:body.term,language:body.language},{$set:body},{upsert:true,new:true});sendData(res,out(entry!.toObject()),undefined,201);}));
operationsRouter.delete('/glossary/:id',asyncHandler(async(req,res)=>{const ctx=await staffScope(req,WRITE);await Glossary.deleteOne({_id:routeParam(req.params.id),orgId:ctx.org._id});sendData(res,{deleted:true});}));
operationsRouter.post('/plan-requests',asyncHandler(async(req,res)=>{const ctx=await requireStaff(req,['owner']);const body=parseBody(z.object({message:z.string().trim().min(1).max(2000),plan:z.string().max(80).optional()}),req);sendData(res,out((await PlanRequest.create({orgId:ctx.org._id,requestedBy:ctx.user._id,message:`${body.plan??'Plan request'}: ${body.message}`})).toObject()),undefined,201);}));
operationsRouter.get('/audit',asyncHandler(async(req,res)=>{const ctx=await staffScope(req);sendData(res,(await OperationAudit.find(ctx.filter).sort({createdAt:-1}).limit(200).lean()).map(out));}));

async function reports(req:Request){
  const ctx=await staffScope(req);const assignments=await Assignment.find(ctx.filter).sort({createdAt:-1}).limit(10000).lean();
  const rows=assignments.map(a=>({instructionId:String(a.instructionId),title:a.snapshot.title,version:a.version,workerName:a.workerName,workerCode:a.workerCode,language:a.language,status:a.status,
    acknowledgedAt:a.acknowledgedAt??null,completedAt:a.completedAt??null,matchingAnswer:a.attempts.at(-1)?.matched??null,helpOpen:a.help.open,createdAt:a.createdAt}));
  const crewIds=[...new Set(assignments.map(a=>String(a.crewId)))];
  const crews=await Crew.find({orgId:ctx.org._id,_id:{$in:crewIds}}).lean();
  const crewName=new Map(crews.map(c=>[String(c._id),c.name]));
  const group=(keyOf:(a:(typeof assignments)[number])=>string,nameOf:(key:string)=>string)=>{
    const map=new Map<string,{key:string;name:string;assigned:number;responded:number;matchingAnswers:number;acknowledged:number;completed:number;openCases:number}>();
    for(const a of assignments){const key=keyOf(a);const entry=map.get(key)??{key,name:nameOf(key),assigned:0,responded:0,matchingAnswers:0,acknowledged:0,completed:0,openCases:0};
      entry.assigned+=1;if(a.attempts.length)entry.responded+=1;if(a.attempts.at(-1)?.matched===true)entry.matchingAnswers+=1;if(a.acknowledgedAt)entry.acknowledged+=1;if(a.completedAt)entry.completed+=1;if(a.help.open)entry.openCases+=1;map.set(key,entry);}
    return [...map.values()].sort((a,b)=>b.assigned-a.assigned);
  };
  return {summary:{assigned:rows.length,responded:assignments.filter(a=>a.attempts.length).length,acknowledged:assignments.filter(a=>a.acknowledgedAt).length,matchingAnswers:rows.filter(a=>a.matchingAnswer===true).length,completed:assignments.filter(a=>a.completedAt).length,openCases:rows.filter(a=>a.helpOpen).length,waiting:rows.filter(a=>a.status==='waiting').length},
    breakdowns:{languages:group(a=>a.language,key=>key),crews:group(a=>String(a.crewId),key=>crewName.get(key)??'Unassigned')},rows};
}
operationsRouter.get('/reports',asyncHandler(async(req,res)=>sendData(res,await reports(req))));
operationsRouter.get('/reports.csv',asyncHandler(async(req,res)=>{
  const {rows}=await reports(req);const columns=['title','version','workerName','workerCode','language','status','matchingAnswer','acknowledgedAt','completedAt','helpOpen'] as const;
  const csv=buildCsv([[...columns],...rows.map(row=>columns.map(key=>row[key] instanceof Date?(row[key] as Date).toISOString():row[key]))]);
  res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="understood-responses.csv"');res.send(csv);
}));

// A transaction commits each worker mutation and its idempotency receipt together.
async function mutate(req:Request, fn:(a:mongoose.HydratedDocument<AssignmentDoc>,session:ClientSession,actor:string)=>Promise<unknown>){
  const ctx=await requireWorkerPortal(req);const key=z.string().uuid().parse(req.header('idempotency-key'));const actor=String(ctx.worker._id);
  const hash=createHash('sha256').update(JSON.stringify({path:req.path,body:req.body})).digest('hex');
  const session=await mongoose.startSession();let result:unknown;
  try{await session.withTransaction(async()=>{
    const previous=await OperationMutation.findOne({actorId:actor,key}).session(session);
    if(previous){if(previous.requestHash!==hash)throw new AppError('IDEMPOTENCY_CONFLICT');result=previous.result;return;}
    const assignment=await Assignment.findOne({_id:routeParam(req.params.id),workerId:ctx.worker._id,orgId:ctx.org._id}).session(session);
    if(!assignment)throw new AppError('NOT_FOUND');if(['withdrawn','waiting'].includes(assignment.status))throw new AppError('CONFLICT_STATE');
    // Serialize privacy deletion and credential disabling against in-flight mutations.
    if(!(await Worker.updateOne({_id:ctx.worker._id,orgId:ctx.org._id,archivedAt:null,accessDisabled:{$ne:true}},{$set:{updatedAt:new Date()}},{session})).matchedCount)throw new AppError('AUTH_REQUIRED');
    result=await fn(assignment,session,actor);await assignment.save({session});
    await OperationMutation.create([{actorId:actor,key,path:req.path,requestHash:hash,result,expireAt:new Date(Date.now()+7*86400000)}],{session});
  });}catch(error){
    if((error as {code?:number}).code===11000){const previous=await OperationMutation.findOne({actorId:actor,key});if(previous?.requestHash===hash)return previous.result;}
    throw error;
  }finally{await session.endSession();}return result;
}
async function portalAssignment(req:Request){const ctx=await requireWorkerPortal(req);const assignment=await Assignment.findOne({_id:routeParam(req.params.id),workerId:ctx.worker._id,orgId:ctx.org._id});if(!assignment)throw new AppError('NOT_FOUND');return {...ctx,assignment};}
portalRouter.get('/bootstrap',asyncHandler(async(req,res)=>{
  const ctx=await requireWorkerPortal(req);const [crew,assignments,notifications]=await Promise.all([Crew.findOne({_id:ctx.worker.crewId,orgId:ctx.org._id}).lean(),Assignment.find({workerId:ctx.worker._id,orgId:ctx.org._id,status:{$ne:'waiting'}}).sort({createdAt:-1}).limit(200).lean(),Notification.find({workerId:ctx.worker._id,orgId:ctx.org._id}).sort({createdAt:-1}).limit(100).lean()]);
  sendData(res,{worker:{id:String(ctx.worker._id),name:ctx.worker.name,workerId:ctx.worker.workerId,language:ctx.worker.language,languageSelected:ctx.worker.languageSelected,requestedLanguage:ctx.worker.requestedLanguage,crew:crew?{id:String(crew._id),name:crew.name}:null},org:{name:ctx.org.name,companyIdentifier:ctx.org.companyId,companyId:ctx.org.companyId},sharedDevice:ctx.sharedDevice,
    assignments:await Promise.all(assignments.map(a=>serializedAssignment(a,true))),notifications:notifications.map(out),languages:getLanguageCapabilities()});
}));
portalRouter.get('/assignments/:id',asyncHandler(async(req,res)=>{
  const {assignment,worker,org}=await portalAssignment(req);
  if(assignment.status==='waiting')throw new AppError('INSTRUCTION_NOT_READY');
  if(assignment.status==='pending'){assignment.status='opened';assignment.openedAt=new Date();await assignment.save();}
  // Approved language changes may change presentation, never the recorded attempts.
  let displayed=assignment.toObject();
  if(worker.language!==assignment.language&&assignment.status!=='withdrawn'){
    const retained=retainedPresentation(assignment,worker.language);
    if(retained){displayed={...displayed,language:worker.language,variant:retained};}
  }
  sendData(res,{...await serializedAssignment(displayed,true),preferredLanguage:worker.language,translationPending:displayed.language!==worker.language});
}));
portalRouter.post('/assignments/:id/respond',asyncHandler(async(req,res)=>{
  const body=parseBody(z.object({optionIndex:z.number().int().min(0).max(2).optional(),text:z.string().trim().min(1).max(4000).optional(),audioKey:z.string().max(500).optional()}).strict(),req);
  sendData(res,await mutate(req,async(a,session,actor)=>{
    if(a.completedAt||!a.snapshot.questionEnabled||(!a.needsAnswer&&a.attempts.length))throw new AppError('CONFLICT_STATE');
    if(a.attempts.length>=20)throw new AppError('ATTEMPTS_EXHAUSTED');
    if(body.optionIndex===undefined&&!body.text&&!body.audioKey)fail('response','Choose an answer.');
    if(body.audioKey)await validateFiles([{key:body.audioKey}],String(a.orgId),actor);
    const currentWorker=await Worker.findById(actor).session(session);const presentation=(currentWorker?retainedPresentation(a,currentWorker.language):null)??a.variant;
    const matched=body.optionIndex!==undefined&&presentation.question?body.optionIndex===presentation.question.correctIndex:null;
    a.attempts.push({id:randomUUID(),...body,matched,at:new Date(),language:presentation.language,question:presentation.question?.text??'',options:presentation.question?.options??[],expectedIndex:presentation.question?.correctIndex});a.needsAnswer=false;a.status='responded';
    if(matched!==true){a.help.open=true;a.help.reason=matched===false?'Answer needs clarification':'Response requires supervisor review';
      await Notification.create([{orgId:a.orgId,siteId:a.siteId,title:a.snapshot.title,body:a.help.reason,assignmentId:a._id}],{session});}
    return {submitted:true,matched,assessment:matched===null?'needs_review':matched?'matching':'needs_clarification'};
  }));
}));
portalRouter.post('/assignments/:id/acknowledge',asyncHandler(async(req,res)=>{
  const body=parseBody(z.object({photoKey:z.string().max(500).optional()}).strict(),req);
  sendData(res,await mutate(req,async(a,_session,actor)=>{
    if(a.snapshot.questionEnabled||a.completedAt)throw new AppError('CONFLICT_STATE');
    if(a.snapshot.requirePhoto&&!body.photoKey)fail('photoKey','Attach a photo before acknowledging.');
    if(body.photoKey){const file=await Upload.findOne({orgId:a.orgId,ownerId:actor,key:body.photoKey,mime:'image/jpeg'});if(!file)throw new AppError('FORBIDDEN');a.photoKey=body.photoKey;}
    a.acknowledgedAt??=new Date();a.status='responded';return {acknowledged:true};
  }));
}));
portalRouter.post('/assignments/:id/complete',asyncHandler(async(req,res)=>{
  sendData(res,await mutate(req,async(a)=>{
    if(a.help.open||a.needsAnswer)throw new AppError('CONFLICT_STATE');
    if(a.snapshot.questionEnabled?!a.attempts.length:!a.acknowledgedAt)throw new AppError('CONFLICT_STATE');
    a.completedAt??=new Date();a.status='completed';return {completed:true,completedAt:a.completedAt};
  }));
}));
portalRouter.post('/assignments/:id/help',asyncHandler(async(req,res)=>{
  const body=parseBody(z.object({reason:z.string().trim().min(1).max(200),text:z.string().trim().max(4000).optional()}),req);
  sendData(res,await mutate(req,async(a,session,actor)=>{
    a.help.open=true;a.help.reason=body.reason;a.help.resolvedAt=null;
    if(body.text)a.messages.push({id:randomUUID(),author:'worker',authorId:actor,text:body.text,at:new Date(),requestAnswer:false});
    await Notification.create([{orgId:a.orgId,siteId:a.siteId,title:a.snapshot.title,body:'A worker requested help.',assignmentId:a._id}],{session});return {requested:true};
  }));
}));
portalRouter.post('/assignments/:id/messages',asyncHandler(async(req,res)=>{
  const body=parseBody(z.object({text:z.string().trim().min(1).max(4000)}),req);
  sendData(res,await mutate(req,async(a,session,actor)=>{
    a.messages.push({id:randomUUID(),author:'worker',authorId:actor,text:body.text,at:new Date(),requestAnswer:false});
    a.help.open=true;a.help.reason='Worker replied';await Notification.create([{orgId:a.orgId,siteId:a.siteId,title:a.snapshot.title,body:'A worker replied.',assignmentId:a._id}],{session});return {sent:true};
  }));
}));
portalRouter.post('/language',asyncHandler(async(req,res)=>{
  const ctx=await requireWorkerPortal(req);const body=parseBody(z.object({language:locale}),req);
  if(!ctx.worker.languageSelected){ctx.worker.language=body.language;ctx.worker.languageSelected=true;}else if(body.language!==ctx.worker.language)ctx.worker.requestedLanguage=body.language;
  await ctx.worker.save();if(ctx.worker.requestedLanguage)await notify({orgId:String(ctx.org._id),siteId:String(ctx.worker.siteId),title:ctx.worker.name,body:'Language change requested.'});
  else await prepareRetainedPresentations(String(ctx.worker._id),ctx.worker.language);
  sendData(res,{language:ctx.worker.language,requestedLanguage:ctx.worker.requestedLanguage});
}));
portalRouter.post('/uploads',upload,asyncHandler(async(req,res)=>{const ctx=await requireWorkerPortal(req);sendData(res,await uploadFile(req,String(ctx.org._id),String(ctx.worker._id)),undefined,201);}));
portalRouter.get('/notifications',asyncHandler(async(req,res)=>{const ctx=await requireWorkerPortal(req);sendData(res,(await Notification.find({workerId:ctx.worker._id,orgId:ctx.org._id}).sort({createdAt:-1}).limit(100).lean()).map(out));}));
portalRouter.post('/notifications/read',asyncHandler(async(req,res)=>{const ctx=await requireWorkerPortal(req);await Notification.updateMany({workerId:ctx.worker._id,orgId:ctx.org._id},{$addToSet:{readBy:String(ctx.worker._id)}});sendData(res,{read:true});}));
