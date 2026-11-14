import type { Language } from '@understood/shared';

export type Locale = 'en' | 'ar';
export type Bilingual = { en: string; ar: string };
export type InstructionStatus = 'draft' | 'processing' | 'partial_failure' | 'ready' | 'shared' | 'archived';
export type StageStatus = 'pending' | 'running' | 'done' | 'failed';
export type VariantStatus = 'pending' | 'processing' | 'ready' | 'text_only' | 'failed';

export interface Me {
  user: { id: string; name: string; email: string; role: string; locale: Locale };
  org: { id: string; name: string; timezone: string; plan: string };
}

export interface Question {
  text: string;
  options: [string, string, string];
  correctIndex: 0 | 1 | 2;
  source: 'ai' | 'manual';
}

export interface VariantView {
  id: string;
  language: Language;
  title: string | null;
  text: string | null;
  hasAudio: boolean;
  audioDurationS: number | null;
  audioStatus: string;
  question: Question | null;
  questionStatus: string;
  status: VariantStatus;
  stages: { translate: StageStatus; question: StageStatus; audio: StageStatus };
  revision: number;
  lastError: { stage: string; code: string; message: string; at: string } | null;
}

export interface InstructionDetail {
  id: string;
  title: string | null;
  type: 'task' | 'info';
  status: InstructionStatus;
  sourceLanguage: Language;
  crewId: string | null;
  audienceCount: number;
  content: {
    kind: 'text' | 'voice' | 'photo' | null;
    text: string | null;
    transcript: string | null;
    transcriptStatus: 'pending' | 'ready' | 'failed' | 'confirmed' | null;
    detectedSourceLanguage: Language | null;
    durationS: number | null;
    hasAudio: boolean;
    hasPhoto: boolean;
  };
  share: { sharedAt: string | null; shareTokenIssuedAt: string | null; canShare: boolean; canPreview: boolean };
  variants: VariantView[];
  createdAt: string;
  updatedAt: string;
}

export interface InstructionStatusPayload {
  status: InstructionStatus;
  transcript: { status: string; language: Language | null; text: string | null } | null;
  stages: Record<'translate' | 'question' | 'audio', Record<string, StageStatus>>;
  error: { code: string; message: string; at: string } | null;
}

export interface InstructionRow {
  id: string;
  title: string | null;
  type: 'task' | 'info';
  crewName: string | null;
  sharedAt: string | null;
  targeted: number;
  opened: number;
  understood: number;
  helpCount: number;
  status: InstructionStatus;
  updatedAt: string;
}

export interface ExceptionRow {
  deliveryId: string;
  instructionId: string;
  instructionTitle: string;
  workerName: string;
  language: string;
  status: string;
  helpReason: string | null;
  helpRequestedAt: string | null;
  sharedAt: string | null;
  answeredAt: string | null;
}

export interface Overview {
  kpis: {
    workers: number;
    crews: number;
    liveInstructions: number;
    needsHelp: number;
    notOpened: number;
    understood7d: { understood: number; targeted: number; rate: number };
  };
  exceptions: { needsHelp: ExceptionRow[]; notOpened: ExceptionRow[]; wrong: ExceptionRow[] };
}

export interface CrewRow {
  id: string;
  name: string;
  archived: boolean;
  workerCount: number;
  languages: Record<string, number>;
  createdAt: string;
}

export interface WorkerRow {
  id: string;
  name: string;
  language: Language;
  phoneE164: string | null;
  archived: boolean;
  createdAt: string;
}

export interface DeliveryRow {
  deliveryId: string;
  worker: { name: string; language: Language };
  status: string;
  firstAttemptCorrect: boolean | null;
  help: {
    requested: boolean;
    reason: string | null;
    requestedAt: string | null;
    resolvedAt: string | null;
  };
  openedAt: string | null;
  answeredAt: string | null;
  completedAt: string | null;
}

export interface DeliveryCounts {
  targeted: number;
  opened: number;
  understood: number;
  helpCount: number;
  needsHelp: number;
  notOpened: number;
  wrong: number;
}

export interface ImportPreview {
  importId: string;
  fileName: string;
  status: string;
  totalRows: number;
  validRows: number;
  errors: Array<{ row: number; field: string; code: string; message: string }>;
  warnings: Array<{ row: number; code: string; message: string }>;
  rows: Array<{ row: number; name: string; language: string; phoneE164: string | null; crewName: string | null }>;
  committedAt: string | null;
}

export interface ImportResult {
  importId: string;
  status: string;
  totalRows: number;
  validRows: number;
  errorCount: number;
  errors: Array<{ row: number; field: string; code: string; message: string }>;
  warningCount: number;
  warnings: Array<{ row: number; code: string; message: string }>;
}
