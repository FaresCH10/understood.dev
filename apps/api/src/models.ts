import { Schema, model, type Types } from 'mongoose';
import type {
  ContentKind,
  DeliveryStatus,
  HelpReason,
  InstructionStatus,
  InstructionType,
  Language,
  Locale,
  Plan,
  Question,
  Role,
  StageStatus,
  VariantStatus,
} from '@understood/shared';

export interface OrganizationDoc {
  _id: Types.ObjectId;
  name: string;
  timezone: string;
  locale: Locale;
  plan: Plan;
  features: Record<string, unknown>;
  deletingAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<OrganizationDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    timezone: { type: String, required: true, default: 'Asia/Dubai' },
    locale: { type: String, enum: ['en', 'ar'], required: true, default: 'en' },
    plan: { type: String, enum: ['pilot'], required: true, default: 'pilot' },
    features: { type: Schema.Types.Mixed, default: {} },
    deletingAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'organizations' },
);

export interface UserDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  email: string;
  name?: string;
  role: Role;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, maxlength: 80 },
    role: { type: String, enum: ['owner'], required: true, default: 'owner' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, collection: 'users' },
);
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ orgId: 1 });

export interface MagicLinkDoc {
  _id: Types.ObjectId;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
}

const magicLinkSchema = new Schema<MagicLinkDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'magic_links' },
);
magicLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
magicLinkSchema.index({ tokenHash: 1 });

export interface CrewDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const crewSchema = new Schema<CrewDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'crews' },
);
crewSchema.index({ orgId: 1, archivedAt: 1, createdAt: -1 });

export interface WorkerDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  crewId: Types.ObjectId;
  name: string;
  normalizedName: string;
  language: Language;
  phoneE164?: string | null;
  archivedAt?: Date | null;
  personalTokenHash?: string | null;
  pushEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const workerSchema = new Schema<WorkerDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    crewId: { type: Schema.Types.ObjectId, ref: 'Crew', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    normalizedName: { type: String, required: true },
    language: { type: String, enum: ['ar', 'en', 'hi', 'ur', 'ml', 'bn'], required: true },
    phoneE164: { type: String, default: null },
    archivedAt: { type: Date, default: null },
    personalTokenHash: { type: String, default: null },
    pushEnabled: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'workers' },
);
workerSchema.index({ orgId: 1, crewId: 1, archivedAt: 1 });
workerSchema.index({ orgId: 1, normalizedName: 1 });

export interface InstructionContent {
  kind?: ContentKind;
  text?: string | null;
  audioKey?: string | null;
  audioMime?: string | null;
  durationS?: number | null;
  photoKey?: string | null;
  transcript?: string | null;
  transcriptStatus?: 'pending' | 'ready' | 'failed' | 'confirmed';
  detectedSourceLanguage?: Language | null;
}

export interface InstructionPipeline {
  startedAt?: Date | null;
  finishedAt?: Date | null;
  lastError?: { code: string; message: string; at: Date } | null;
}

export interface InstructionDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  crewId?: Types.ObjectId | null;
  audienceWorkerIds: Types.ObjectId[];
  title?: string | null;
  type: InstructionType;
  content: InstructionContent;
  sourceLanguage: Language;
  status: InstructionStatus;
  generation: number;
  pipeline: InstructionPipeline;
  shareTokenHash?: string | null;
  shareTokenEnc?: string | null;
  shareTokenIssuedAt?: Date | null;
  shareTokenRevokedAt?: Date | null;
  createdBy: Types.ObjectId;
  sharedBy?: Types.ObjectId | null;
  sharedAt?: Date | null;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const contentSchema = new Schema<InstructionContent>(
  {
    kind: { type: String, enum: ['text', 'voice', 'photo'] },
    text: { type: String, maxlength: 2000, default: null },
    audioKey: { type: String, default: null },
    audioMime: { type: String, default: null },
    durationS: { type: Number, default: null },
    photoKey: { type: String, default: null },
    transcript: { type: String, maxlength: 4000, default: null },
    transcriptStatus: { type: String, enum: ['pending', 'ready', 'failed', 'confirmed'] },
    detectedSourceLanguage: { type: String, enum: ['ar', 'en', 'hi', 'ur', 'ml', 'bn'], default: null },
  },
  { _id: false },
);

const pipelineSchema = new Schema<InstructionPipeline>(
  {
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    lastError: {
      type: new Schema(
        { code: String, message: String, at: Date },
        { _id: false },
      ),
      default: null,
    },
  },
  { _id: false },
);

const instructionSchema = new Schema<InstructionDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    crewId: { type: Schema.Types.ObjectId, ref: 'Crew', default: null },
    audienceWorkerIds: { type: [Schema.Types.ObjectId], default: [] },
    title: { type: String, maxlength: 120, default: null },
    type: { type: String, enum: ['task', 'info'], required: true, default: 'task' },
    content: { type: contentSchema, default: () => ({}) },
    sourceLanguage: { type: String, enum: ['ar', 'en', 'hi', 'ur', 'ml', 'bn'], required: true, default: 'en' },
    status: {
      type: String,
      enum: ['draft', 'processing', 'partial_failure', 'ready', 'shared', 'archived'],
      required: true,
      default: 'draft',
    },
    generation: { type: Number, required: true, default: 0 },
    pipeline: { type: pipelineSchema, default: () => ({}) },
    shareTokenHash: { type: String },
    shareTokenEnc: { type: String, default: null },
    shareTokenIssuedAt: { type: Date, default: null },
    shareTokenRevokedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sharedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sharedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'instructions' },
);
instructionSchema.index({ orgId: 1, status: 1, createdAt: -1 });
instructionSchema.index({ orgId: 1, crewId: 1, createdAt: -1 });
instructionSchema.index(
  { shareTokenHash: 1 },
  { unique: true, partialFilterExpression: { shareTokenHash: { $type: 'string' } } },
);

export interface VariantDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  instructionId: Types.ObjectId;
  language: Language;
  title?: string | null;
  text?: string | null;
  audioKey?: string | null;
  audioChars?: number | null;
  audioDurationS?: number | null;
  audioStatus: 'pending' | 'ready' | 'failed' | 'skipped';
  question?: Question | null;
  questionStatus: 'pending' | 'ready' | 'failed' | 'manual_required';
  status: VariantStatus;
  stages: { translate: StageStatus; question: StageStatus; audio: StageStatus };
  revision: number;
  lastError?: { stage: string; code: string; message: string; at: Date } | null;
  editedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<Question>(
  {
    text: { type: String, required: true, maxlength: 140 },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true, min: 0, max: 2 },
    source: { type: String, enum: ['ai', 'manual'], required: true },
  },
  { _id: false },
);

const stagesSchema = new Schema<VariantDoc['stages']>(
  {
    translate: { type: String, enum: ['pending', 'running', 'done', 'failed'], default: 'pending' },
    question: { type: String, enum: ['pending', 'running', 'done', 'failed'], default: 'pending' },
    audio: { type: String, enum: ['pending', 'running', 'done', 'failed'], default: 'pending' },
  },
  { _id: false },
);

const variantSchema = new Schema<VariantDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true },
    instructionId: { type: Schema.Types.ObjectId, ref: 'Instruction', required: true },
    language: { type: String, enum: ['ar', 'en', 'hi', 'ur', 'ml', 'bn'], required: true },
    title: { type: String, maxlength: 120, default: null },
    text: { type: String, maxlength: 2000, default: null },
    audioKey: { type: String, default: null },
    audioChars: { type: Number, default: null },
    audioDurationS: { type: Number, default: null },
    audioStatus: { type: String, enum: ['pending', 'ready', 'failed', 'skipped'], required: true, default: 'pending' },
    question: { type: questionSchema, default: null },
    questionStatus: {
      type: String,
      enum: ['pending', 'ready', 'failed', 'manual_required'],
      required: true,
      default: 'pending',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'text_only', 'failed'],
      required: true,
      default: 'pending',
    },
    stages: { type: stagesSchema, default: () => ({}) },
    revision: { type: Number, required: true, default: 1 },
    lastError: {
      type: new Schema({ stage: String, code: String, message: String, at: Date }, { _id: false }),
      default: null,
    },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'variants' },
);
variantSchema.index({ instructionId: 1, language: 1 }, { unique: true });
variantSchema.index({ orgId: 1, instructionId: 1 });

export interface DeliveryAttemptDoc {
  optionIndex: number;
  correct: boolean;
  at: Date;
}

export interface DeliveryHelp {
  requested: boolean;
  reason: HelpReason | null;
  requestedAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: Types.ObjectId | null;
}

export interface DeliveryTokenEntry {
  hash: string;
  createdAt: Date;
  lastSeenAt: Date;
}

export interface DeliveryDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  instructionId: Types.ObjectId;
  workerId: Types.ObjectId;
  variantId: Types.ObjectId;
  language: Language;
  languageChangeHistory: Array<{ from: Language; to: Language; at: Date }>;
  status: DeliveryStatus;
  firstAttemptCorrect?: boolean | null;
  attempts: DeliveryAttemptDoc[];
  openedAt?: Date | null;
  answeredAt?: Date | null;
  completedAt?: Date | null;
  help: DeliveryHelp;
  deliveryTokens: DeliveryTokenEntry[];
  channel: 'link';
  createdAt: Date;
  updatedAt: Date;
}

const deliverySchema = new Schema<DeliveryDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true },
    instructionId: { type: Schema.Types.ObjectId, ref: 'Instruction', required: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
    language: { type: String, enum: ['ar', 'en', 'hi', 'ur', 'ml', 'bn'], required: true },
    languageChangeHistory: {
      type: [new Schema({ from: String, to: String, at: Date }, { _id: false })],
      default: [],
    },
    status: { type: String, enum: ['pending', 'opened', 'answered', 'completed'], required: true, default: 'pending' },
    firstAttemptCorrect: { type: Boolean, default: null },
    attempts: {
      type: [new Schema({ optionIndex: Number, correct: Boolean, at: Date }, { _id: false })],
      default: [],
    },
    openedAt: { type: Date, default: null },
    answeredAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    help: {
      type: new Schema(
        {
          requested: { type: Boolean, default: false },
          reason: { type: String, enum: ['dont_understand', 'missing_tools', 'safety_concern', 'other'], default: null },
          requestedAt: { type: Date, default: null },
          resolvedAt: { type: Date, default: null },
          resolvedBy: { type: Schema.Types.ObjectId, default: null },
        },
        { _id: false },
      ),
      default: () => ({ requested: false, reason: null, requestedAt: null, resolvedAt: null, resolvedBy: null }),
    },
    deliveryTokens: {
      type: [new Schema({ hash: String, createdAt: Date, lastSeenAt: Date }, { _id: false })],
      default: [],
    },
    channel: { type: String, enum: ['link'], required: true, default: 'link' },
  },
  { timestamps: true, collection: 'deliveries' },
);
deliverySchema.index({ instructionId: 1, workerId: 1 }, { unique: true });
deliverySchema.index({ instructionId: 1, status: 1 });
deliverySchema.index({ orgId: 1, status: 1 });
deliverySchema.index({ 'deliveryTokens.hash': 1 }, { sparse: true });
deliverySchema.index({ orgId: 1, 'help.requested': 1, 'help.resolvedAt': 1 });

export interface AudioAssetDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  cacheKey: string;
  r2Key: string;
  chars: number;
  voiceId: string;
  lastUsedAt: Date;
  createdAt: Date;
}

const audioAssetSchema = new Schema<AudioAssetDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true },
    cacheKey: { type: String, required: true },
    r2Key: { type: String, required: true },
    chars: { type: Number, required: true },
    voiceId: { type: String, required: true },
    lastUsedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'audio_assets' },
);
audioAssetSchema.index({ orgId: 1, cacheKey: 1 }, { unique: true });
audioAssetSchema.index({ lastUsedAt: 1 });

export interface AiUsageDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  instructionId?: Types.ObjectId | null;
  language?: Language | null;
  stage: 'transcribe' | 'translate' | 'question' | 'tts';
  provider: string;
  model?: string | null;
  units: number;
  unitType: 'chars' | 'seconds' | 'tokens';
  costUsd: number;
  latencyMs: number;
  createdAt: Date;
}

const aiUsageSchema = new Schema<AiUsageDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true },
    instructionId: { type: Schema.Types.ObjectId, default: null },
    language: { type: String, enum: ['ar', 'en', 'hi', 'ur', 'ml', 'bn'], default: null },
    stage: { type: String, enum: ['transcribe', 'translate', 'question', 'tts'], required: true },
    provider: { type: String, required: true },
    model: { type: String, default: null },
    units: { type: Number, required: true },
    unitType: { type: String, enum: ['chars', 'seconds', 'tokens'], required: true },
    costUsd: { type: Number, required: true, default: 0 },
    latencyMs: { type: Number, required: true, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'ai_usage' },
);
aiUsageSchema.index({ orgId: 1, createdAt: -1 });
aiUsageSchema.index({ instructionId: 1 });

export interface ImportErrorDoc {
  row: number;
  field: string;
  code: string;
  message: string;
}

export interface ImportWarningDoc {
  row: number;
  code: 'duplicate_name';
  message: string;
}

export interface ImportRecordDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  fileName: string;
  status: 'parsed' | 'invalid' | 'committed';
  crewId?: Types.ObjectId | null;
  totalRows: number;
  validRows: number;
  errors: ImportErrorDoc[];
  warnings: ImportWarningDoc[];
  rows: Array<{ row: number; name: string; language: Language; phoneE164?: string | null; crewName?: string | null }>;
  committedAt?: Date | null;
  createdAt: Date;
  expireAt: Date;
}

const importSchema = new Schema<ImportRecordDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true },
    fileName: { type: String, required: true },
    status: { type: String, enum: ['parsed', 'invalid', 'committed'], required: true },
    crewId: { type: Schema.Types.ObjectId, default: null },
    totalRows: { type: Number, required: true },
    validRows: { type: Number, required: true },
    errors: { type: [new Schema({ row: Number, field: String, code: String, message: String }, { _id: false })], default: [] },
    warnings: { type: [new Schema({ row: Number, code: String, message: String }, { _id: false })], default: [] },
    rows: {
      type: [
        new Schema(
          { row: Number, name: String, language: String, phoneE164: String, crewName: String },
          { _id: false },
        ),
      ],
      default: [],
    },
    committedAt: { type: Date, default: null },
    expireAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'imports' },
);
importSchema.index({ orgId: 1, createdAt: -1 });
importSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export interface EmailLogDoc {
  _id: Types.ObjectId;
  orgId?: Types.ObjectId | null;
  to: string;
  template: 'magic_link' | 'help_alert' | 'org_deletion';
  status: 'sent' | 'failed';
  providerId?: string | null;
  error?: string | null;
  createdAt: Date;
}

const emailLogSchema = new Schema<EmailLogDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, default: null },
    to: { type: String, required: true },
    template: { type: String, enum: ['magic_link', 'help_alert', 'org_deletion'], required: true },
    status: { type: String, enum: ['sent', 'failed'], required: true },
    providerId: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'email_log' },
);
emailLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Organization = model<OrganizationDoc>('Organization', organizationSchema);
export const User = model<UserDoc>('User', userSchema);
export const MagicLink = model<MagicLinkDoc>('MagicLink', magicLinkSchema);
export const Crew = model<CrewDoc>('Crew', crewSchema);
export const Worker = model<WorkerDoc>('Worker', workerSchema);
export const Instruction = model<InstructionDoc>('Instruction', instructionSchema);
export const Variant = model<VariantDoc>('Variant', variantSchema);
export const Delivery = model<DeliveryDoc>('Delivery', deliverySchema);
export const AudioAsset = model<AudioAssetDoc>('AudioAsset', audioAssetSchema);
export const AiUsage = model<AiUsageDoc>('AiUsage', aiUsageSchema);
export const ImportRecord = model<ImportRecordDoc>('ImportRecord', importSchema);
export const EmailLog = model<EmailLogDoc>('EmailLog', emailLogSchema);
