import { Schema, model, type Types } from 'mongoose';
import { LANGUAGES, type Language } from '@understood/shared';

export interface Attachment { key: string; name: string; mime: string; caption: string }
export interface OpsQuestion { text: string; options: string[]; correctIndex: number }
export interface PreparedVariant {
  language: Language; text: string; audioKey?: string | null; question?: OpsQuestion | null;
  status: 'ready' | 'failed'; error?: string | null; reviewed: boolean; demo: boolean;
}
export interface Publication {
  version: number; publishedAt: Date; title: string; text: string; sourceLanguage: Language;
  deliveryMode: 'text' | 'voice' | 'both'; questionEnabled: boolean; requirePhoto: boolean;
  deadline?: Date | null; question?: OpsQuestion | null; variants: PreparedVariant[]; attachments: Attachment[];
  audience: Array<{ workerId: string; name: string; language: Language; crewId: string }>;
}
export interface OperationDoc {
  _id: Types.ObjectId; orgId: Types.ObjectId; siteId: Types.ObjectId; createdBy: Types.ObjectId;
  title: string; text: string; sourceLanguage: Language; deliveryMode: 'text' | 'voice' | 'both';
  questionEnabled: boolean; question?: OpsQuestion | null; requirePhoto: boolean;
  workerIds: Types.ObjectId[]; crewIds: Types.ObjectId[]; everyone: boolean;
  attachments: Attachment[]; deadline?: Date | null; scheduledAt?: Date | null;
  status: 'draft' | 'preparing' | 'ready' | 'partial_failure' | 'scheduled' | 'published' | 'withdrawn' | 'archived';
  generation: number; variants: PreparedVariant[]; publications: Publication[]; version: number; allowPartial: boolean;
  previousId?: Types.ObjectId | null; lastError?: string | null; createdAt: Date; updatedAt: Date;
}
const question = new Schema<OpsQuestion>({text: String, options: [String], correctIndex: Number}, {_id: false});
const attachment = new Schema<Attachment>({key: String, name: String, mime: String, caption: String}, {_id: false});
const variant = new Schema<PreparedVariant>({
  language: {type: String, enum: LANGUAGES, required: true}, text: String, audioKey: String,
  question: {type: question, default: null}, status: {type: String, enum: ['ready', 'failed']},
  error: String, reviewed: {type: Boolean, default: false}, demo: {type: Boolean, default: false},
}, {_id: false});
const publication = new Schema<Publication>({
  version: Number, publishedAt: Date, title: String, text: String, sourceLanguage: String,
  deliveryMode: String, questionEnabled: Boolean, requirePhoto: Boolean, deadline: Date,
  question: {type: question, default: null}, variants: [variant], attachments: [attachment],
  audience: [{_id: false, workerId: String, name: String, language: String, crewId: String}],
}, {_id: false});
const operationSchema = new Schema<OperationDoc>({
  orgId: {type: Schema.Types.ObjectId, required: true}, siteId: {type: Schema.Types.ObjectId, required: true},
  createdBy: {type: Schema.Types.ObjectId, required: true}, title: {type: String, required: true, maxlength: 120},
  text: {type: String, required: true, maxlength: 4000}, sourceLanguage: {type: String, enum: LANGUAGES, default: 'en'},
  deliveryMode: {type: String, enum: ['text', 'voice', 'both'], default: 'both'},
  questionEnabled: {type: Boolean, default: true}, question: {type: question, default: null},
  requirePhoto: {type: Boolean, default: false}, workerIds: [Schema.Types.ObjectId], crewIds: [Schema.Types.ObjectId],
  everyone: {type: Boolean, default: false}, attachments: [attachment], deadline: Date, scheduledAt: Date,
  status: {type: String, enum: ['draft','preparing','ready','partial_failure','scheduled','published','withdrawn','archived'], default: 'draft'},
  generation: {type: Number, default: 0}, variants: [variant], publications: [publication], version: {type: Number, default: 0}, allowPartial: {type:Boolean,default:false},
  previousId: Schema.Types.ObjectId, lastError: String,
}, {timestamps: true, collection: 'operations'});
operationSchema.index({orgId: 1, siteId: 1, createdAt: -1});
operationSchema.index({status: 1, scheduledAt: 1});

export interface OpsAttempt {
  id: string; optionIndex?: number | null; text?: string | null; audioKey?: string | null;
  matched: boolean | null; at: Date; language: Language; question: string; options?: string[]; expectedIndex?: number;
}
export interface OpsMessage { id: string; author: 'staff' | 'worker'; authorId: string; text: string; at: Date; requestAnswer: boolean }
export interface AssignmentDoc {
  _id: Types.ObjectId; orgId: Types.ObjectId; siteId: Types.ObjectId; instructionId: Types.ObjectId;
  workerId: Types.ObjectId; workerName: string; workerCode: string; crewId: Types.ObjectId;
  version: number; language: Language; snapshot: Publication; variant: PreparedVariant;
  presentations: PreparedVariant[];
  status: 'pending' | 'opened' | 'responded' | 'completed' | 'waiting' | 'withdrawn';
  attempts: OpsAttempt[]; messages: OpsMessage[]; needsAnswer: boolean;
  acknowledgedAt?: Date | null; openedAt?: Date | null; completedAt?: Date | null; photoKey?: string | null;
  help: {open: boolean; reason: string; assigneeId?: string | null; resolvedAt?: Date | null};
  createdAt: Date; updatedAt: Date; reminderAt?: Date | null;
}
const assignmentSchema = new Schema<AssignmentDoc>({
  orgId: {type: Schema.Types.ObjectId, required: true}, siteId: {type: Schema.Types.ObjectId, required: true},
  instructionId: {type: Schema.Types.ObjectId, required: true}, workerId: {type: Schema.Types.ObjectId, required: true},
  workerName: String, workerCode: String, crewId: Schema.Types.ObjectId, version: {type: Number, required: true},
  language: {type: String, enum: LANGUAGES, required: true}, snapshot: {type: publication, required: true},
  variant: {type: variant, required: true},
  presentations: [variant],
  status: {type: String, enum: ['pending','opened','responded','completed','waiting','withdrawn'], default: 'pending'},
  attempts: [{_id: false, id: String, optionIndex: Number, text: String, audioKey: String, matched: {type: Boolean, default: null}, at: Date, language: String, question: String,options:[String],expectedIndex:Number}],
  messages: [{_id: false, id: String, author: String, authorId: String, text: String, at: Date, requestAnswer: Boolean}],
  needsAnswer: {type: Boolean, default: false}, acknowledgedAt: Date, openedAt: Date, completedAt: Date,
  photoKey: String, help: {type: new Schema({open: Boolean, reason: String, assigneeId: String, resolvedAt: Date}, {_id: false}), default: () => ({open: false, reason: ''})},
  reminderAt: Date,
}, {timestamps: true, collection: 'assignments'});
assignmentSchema.index({instructionId: 1, version: 1, workerId: 1}, {unique: true});
assignmentSchema.index({orgId: 1, siteId: 1, 'help.open': 1});
assignmentSchema.index({workerId: 1, createdAt: -1});

export interface NotificationDoc {
  _id: Types.ObjectId; orgId: Types.ObjectId; siteId?: Types.ObjectId | null; workerId?: Types.ObjectId | null;
  title: string; body: string; assignmentId?: Types.ObjectId | null; readBy: string[]; eventKey?: string;
  createdAt: Date;
  pushedAt?: Date;
}
const notificationSchema = new Schema<NotificationDoc>({
  orgId: {type: Schema.Types.ObjectId, required: true}, siteId: Schema.Types.ObjectId,
  workerId: {type: Schema.Types.ObjectId, default: null}, title: String, body: String,
  assignmentId: Schema.Types.ObjectId, readBy: [String], eventKey: String, pushedAt: Date,
}, {timestamps: {createdAt: true, updatedAt: false}, collection: 'notifications'});
notificationSchema.index({orgId: 1, workerId: 1, createdAt: -1});
notificationSchema.index({eventKey: 1}, {unique: true, sparse: true});

const templateSchema = new Schema({
  orgId: {type: Schema.Types.ObjectId, required: true}, name: {type: String, required: true},
  text: {type: String, required: true}, sourceLanguage: {type: String, default: 'en'},
  questionEnabled: {type: Boolean, default: true}, question: {type: question, default: null},
  proposed: {type: Boolean, default: false}, sourceInstructionId: Schema.Types.ObjectId,
}, {timestamps: true, collection: 'instruction_templates'});
templateSchema.index({orgId: 1, createdAt: -1});
const glossarySchema = new Schema({
  orgId: {type: Schema.Types.ObjectId, required: true}, term: {type: String, required: true},
  translation: {type: String, required: true}, language: {type: String, enum: LANGUAGES, required: true},
}, {timestamps: true, collection: 'glossary'});
glossarySchema.index({orgId: 1, term: 1, language: 1}, {unique: true});
const auditSchema = new Schema({
  orgId: {type: Schema.Types.ObjectId, required: true}, siteId: Schema.Types.ObjectId,
  actorId: String, action: String, subjectId: String, detail: {type: Schema.Types.Mixed, default: {}},
}, {timestamps: {createdAt: true, updatedAt: false}, collection: 'operation_audit'});
auditSchema.index({orgId: 1, createdAt: -1});
const uploadSchema = new Schema({
  orgId: {type: Schema.Types.ObjectId, required: true}, ownerId: {type: String, required: true},
  key: {type: String, required: true, unique: true}, name: String, mime: String,
}, {timestamps: true, collection: 'uploads'});
export const Operation = model<OperationDoc>('Operation', operationSchema);
export const Assignment = model<AssignmentDoc>('Assignment', assignmentSchema);
export const Notification = model<NotificationDoc>('Notification', notificationSchema);
export const InstructionTemplate = model('InstructionTemplate', templateSchema);
export const Glossary = model('Glossary', glossarySchema);
export const OperationAudit = model('OperationAudit', auditSchema);
export const Upload = model('Upload', uploadSchema);
const mutationSchema = new Schema({
  actorId: {type: String, required: true}, key: {type: String, required: true}, path: String,
  requestHash: {type: String, required: true}, result: Schema.Types.Mixed,
  expireAt: {type: Date, required: true},
}, {collection: 'operation_mutations'});
mutationSchema.index({actorId: 1, key: 1}, {unique: true});
mutationSchema.index({expireAt: 1}, {expireAfterSeconds: 0});
export const OperationMutation = model('OperationMutation', mutationSchema);
