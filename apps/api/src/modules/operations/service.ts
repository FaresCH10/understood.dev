import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { LANGUAGE_META, type Language } from '@understood/shared';
import { config } from '../../config.js';
import { AppError } from '../../errors.js';
import { logger } from '../../logger.js';
import { Worker, AiUsage, User } from '../../models.js';
import { requireEntitlement } from '../access/control.js';
import { getProviders } from '../pipeline/providers.js';
import { getStorage } from '../../media/storage.js';
import { getQueue } from '../../jobs/queue.js';
import { Assignment, Operation, Notification, Glossary, OperationAudit, type OperationDoc, type PreparedVariant, type Publication, type OpsQuestion } from './models.js';
import { dispatchPush } from './push.js';
import { runRetentionCleanup, drainPrivacyErasures } from './privacy.js';

export async function audit(orgId: string, actorId: string, action: string, subjectId: string, siteId?: string, detail: Record<string, unknown> = {}): Promise<void> {
  await OperationAudit.create({orgId, actorId, action, subjectId, siteId, detail});
}
export async function notify(input: {orgId: string; siteId?: string; workerId?: string; title: string; body: string; assignmentId?: string; eventKey?: string}): Promise<void> {
  if (input.eventKey) await Notification.updateOne({eventKey: input.eventKey}, {$setOnInsert: input}, {upsert: true});
  else await Notification.create(input);
}
export async function audienceFor(operation: Pick<OperationDoc,'orgId'|'siteId'|'workerIds'|'crewIds'|'everyone'>) {
  const selectors: Record<string, unknown>[] = [];
  if (operation.workerIds.length) selectors.push({_id: {$in: operation.workerIds}});
  if (operation.crewIds.length) selectors.push({crewId: {$in: operation.crewIds}});
  return Worker.find({orgId: operation.orgId, siteId: operation.siteId, archivedAt: null, accessDisabled: {$ne: true},
    ...(operation.everyone ? {} : {$or: selectors.length ? selectors : [{_id: null}]}),
  }).sort({_id: 1}).limit(10000).lean();
}
async function mapLimit<T,R>(values: T[], fn: (value: T) => Promise<R>, limit = 3): Promise<R[]> {
  const results = new Array<R>(values.length); let cursor = 0;
  await Promise.all(Array.from({length: Math.min(limit, values.length)}, async () => {
    while (cursor < values.length) {const index = cursor++; results[index] = await fn(values[index]!);}
  })); return results;
}
async function translatedQuestion(question: OpsQuestion, source: Language, language: Language, translate: (text: string) => Promise<string>): Promise<OpsQuestion> {
  if (source === language || config.AI_DRIVER === 'mock') return question;
  return {text: await translate(question.text), options: await mapLimit(question.options, translate), correctIndex: question.correctIndex};
}
export async function prepareVariant(input: {orgId: string; text: string; sourceLanguage: Language; language: Language; deliveryMode: string; questionEnabled: boolean; question?: OpsQuestion | null}): Promise<PreparedVariant> {
  const {language} = input; const demo = config.AI_DRIVER === 'mock';
  try {
    const providers = getProviders();
    const glossary = await Glossary.find({orgId: input.orgId, language}).select('term translation -_id').lean();
    const translate = async (text: string): Promise<string> => {
      if (demo || language === input.sourceLanguage) return text;
      const result = await providers.translation.translate({text, sourceLang: input.sourceLanguage, targetLang: language, glossary});
      if (!result.text.trim()) throw new Error('Translation returned no text.');
      return result.text;
    };
    const text = await translate(input.text);
    let question: OpsQuestion | null = null;
    if (input.questionEnabled) {
      if (input.question) question = await translatedQuestion(input.question, input.sourceLanguage, language, translate);
      else if (demo) throw new Error('Add a multiple-choice question for a demo instruction. Live AI can generate one.');
      else {
        const generated = await providers.question.generate({text, lang: language});
        question = {text: generated.question, options: generated.options, correctIndex: generated.correctIndex};
      }
      if (!question || question.options.length !== 3 || new Set(question.options).size !== 3 || ![0,1,2].includes(question.correctIndex)) throw new Error('Question must have three unique options and one matching answer.');
    }
    let audioKey: string | null = null;
    if (input.deliveryMode !== 'text' && !demo) {
      const meta = LANGUAGE_META[language];
      if (!meta.voiceId) throw new Error('Speech is unavailable for this locale. Choose text delivery.');
      const start = Date.now();
      const result = await providers.tts.synthesize({text, lang: language, voiceId: meta.voiceId});
      audioKey = `orgs/${input.orgId}/operations/${randomUUID()}.mp3`;
      await getStorage().put(audioKey, result.audio, result.mime);
      await AiUsage.create({orgId: input.orgId, stage: 'tts', provider: providers.tts.name, units: text.length, unitType: 'chars', latencyMs: Date.now()-start, costUsd: 0});
    }
    // Demo output remains visibly untranslated; it never pretends synthetic bytes are speech.
    return {language, text, audioKey, question, status: 'ready', reviewed: false, demo};
  } catch (error) {
    return {language, text: '', status: 'failed', error: error instanceof Error ? error.message.slice(0,240) : 'Generation failed', reviewed: false, demo};
  }
}
export async function runPreparation(payload: {instructionId: string; generation: number}): Promise<void> {
  const operation = await Operation.findOne({_id: payload.instructionId, generation: payload.generation, status: 'preparing'}).lean();
  if (!operation) return;
  const workers = await audienceFor(operation);
  const languages = [...new Set(workers.map(worker => worker.language))];
  const variants = await mapLimit(languages, language => prepareVariant({...operation, orgId: String(operation.orgId), language}));
  const status = variants.length && variants.every(v => v.status === 'ready') ? 'ready' : 'partial_failure';
  await Operation.updateOne({_id: operation._id, generation: payload.generation, status: 'preparing'}, {$set: {variants, status, lastError: !workers.length ? 'Choose at least one active recipient.' : null}});
}
export async function publishOperation(id: string, actorId: string, acceptPartial = false, scheduled = false): Promise<OperationDoc> {
  const session = await mongoose.startSession(); let result: OperationDoc | null = null;
  try {
    await session.withTransaction(async () => {
      const operation = await Operation.findOne({_id: id, status: scheduled ? 'scheduled' : {$in: ['ready','partial_failure']}}).session(session);
      if (!operation) throw new AppError('CONFLICT_STATE');
      const entitlement = await requireEntitlement(String(operation.orgId));
      if (!entitlement.active) throw new AppError('FORBIDDEN');
      const workers = await audienceFor(operation);
      if (!workers.length) throw new AppError('VALIDATION_FAILED', [{field: 'recipients', issue: 'Choose active recipients.'}]);
      const available = operation.variants.filter(v => v.status === 'ready');
      if (!available.length || available.some(v => !v.reviewed)) throw new AppError('INSTRUCTION_NOT_READY');
      const languages = new Set(available.map(v => v.language));
      if (!acceptPartial && workers.some(w => !languages.has(w.language))) throw new AppError('INSTRUCTION_NOT_READY');
      if (operation.scheduledAt && operation.scheduledAt.getTime() > Date.now() && !scheduled) {
        operation.status = 'scheduled'; operation.allowPartial=acceptPartial; await operation.save({session}); result = operation.toObject(); return;
      }
      const version = operation.version + 1;
      const snapshot: Publication = {version, publishedAt: new Date(), title: operation.title, text: operation.text,
        sourceLanguage: operation.sourceLanguage, deliveryMode: operation.deliveryMode, questionEnabled: operation.questionEnabled,
        question: operation.question, requirePhoto: operation.requirePhoto, deadline: operation.deadline,
        variants: operation.variants, attachments: operation.attachments,
        audience: workers.map(w => ({workerId: String(w._id), name: w.name, language: w.language, crewId: String(w.crewId)})),
      };
      const assignments = workers.map(w => {
        const variant = operation.variants.find(v => v.language === w.language) ?? {language: w.language, text: '', status: 'failed' as const, reviewed: false, demo: config.AI_DRIVER === 'mock', error: 'Awaiting delivery'};
        return {orgId: operation.orgId, siteId: operation.siteId, instructionId: operation._id, workerId: w._id,
          workerName: w.name, workerCode: w.workerId ?? String(w._id), crewId: w.crewId, version, language: w.language,
          snapshot, variant, status: variant.status === 'ready' ? 'pending' : 'waiting', needsAnswer: operation.questionEnabled,
          help: {open: false, reason: ''},
        };
      });
      const created = await Assignment.insertMany(assignments, {session});
      await Notification.insertMany(created.filter(a => a.status !== 'waiting').map(a => ({orgId: operation.orgId,siteId: operation.siteId,workerId: a.workerId,title: operation.title,body: 'New instruction',assignmentId: a._id,eventKey: `assignment-${a._id}`})), {session});
      operation.publications.push(snapshot); operation.version = version; operation.status = 'published';
      await operation.save({session}); result = operation.toObject();
      await OperationAudit.create([{orgId: operation.orgId, siteId: operation.siteId, actorId, action: 'instruction_published',subjectId: id,detail:{version,recipients: workers.length}}],{session});
    });
  } finally {await session.endSession();}
  if (!result) throw new AppError('CONFLICT_STATE'); return result;
}
export async function retryWaiting(id: string): Promise<number> {
  const pending = await Assignment.find({instructionId: id,status:'waiting'});
  const cache = new Map<string,PreparedVariant>(); let delivered = 0;
  for (const assignment of pending) {
    const worker = await Worker.findOne({_id: assignment.workerId, accessDisabled: {$ne:true}, archivedAt:null});
    if (!worker) continue;
    const key = `${assignment.version}-${assignment.language}`;
    let variant = cache.get(key);
    if (!variant) {
      variant = await prepareVariant({...assignment.snapshot, orgId: String(assignment.orgId),language:assignment.language}); cache.set(key,variant);
    }
    // Repaired translations require a staff review before becoming visible.
    assignment.variant = variant;
    await assignment.save();
    if (variant.status === 'ready') delivered++;
  }
  return delivered;
}
export async function prepareRetainedPresentations(workerId: string, language: Language): Promise<void> {
  const assignments=await Assignment.find({workerId,status:{$nin:['waiting','withdrawn']},language:{$ne:language},'presentations.language':{$ne:language}}).sort({createdAt:-1}).limit(100);
  for(const assignment of assignments){
    const variant=await prepareVariant({orgId:String(assignment.orgId),text:assignment.variant.text,sourceLanguage:assignment.language,
      language,deliveryMode:assignment.snapshot.deliveryMode,questionEnabled:assignment.snapshot.questionEnabled,question:assignment.variant.question});
    assignment.presentations.push(variant);
    // An alternative language is presentation only; do not rewrite any saved answer evidence.
    if(!assignment.completedAt){assignment.help.open=true;assignment.help.reason='Translated view awaits review';}
    await assignment.save();
  }
}
let tickRunning = false;
let lastRetentionRun = 0;
export async function operationsTick(): Promise<void> {
  if (tickRunning) return; tickRunning = true;
  try {
    const due = await Operation.find({status:'scheduled',scheduledAt:{$lte:new Date()}}).limit(50).lean();
    for (const instruction of due) {
      try {await publishOperation(String(instruction._id),String(instruction.createdBy),instruction.allowPartial,true);}
      catch (error) {logger.warn({instructionId:String(instruction._id),err:String(error)},'scheduled publication deferred');}
    }
    // Retrying is generation-fenced and queue IDs deduplicate recovery after crashes.
    const stale = await Operation.find({status:'preparing',updatedAt:{$lt:new Date(Date.now()-10*60_000)}}).limit(20).lean();
    for(const instruction of stale) await getQueue().enqueue('operation',{instructionId:String(instruction._id),generation:instruction.generation},{jobId:`operation-${instruction._id}-${instruction.generation}-recover-${Math.floor(Date.now()/600000)}`});
    const overdue = await Assignment.find({status:{$in:['pending','opened','responded']},'snapshot.deadline':{$lte:new Date()},reminderAt:{$exists:false}}).limit(100);
    for(const assignment of overdue) {
      await notify({orgId:String(assignment.orgId),siteId:String(assignment.siteId),workerId:String(assignment.workerId),title:assignment.snapshot.title,body:'This instruction is past its deadline.',assignmentId:String(assignment._id),eventKey:`deadline-${assignment._id}`});
      await Assignment.updateOne({_id:assignment._id},{$set:{reminderAt:new Date()}});
    }
    await dispatchPush();
    await drainPrivacyErasures();
    if(Date.now()-lastRetentionRun>60*60_000){await runRetentionCleanup();lastRetentionRun=Date.now();}
  } finally {tickRunning=false;}
}
export function startOperationsScheduler(): () => void {
  const run = () => {void operationsTick().catch(error=>logger.error({err:String(error)},'operations scheduler failed'));};
  run(); const timer = setInterval(run,15_000); timer.unref(); return () => clearInterval(timer);
}
