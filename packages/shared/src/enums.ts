import type { Language } from './languages.js';

export const INSTRUCTION_TYPES = ['task', 'info'] as const;
export type InstructionType = (typeof INSTRUCTION_TYPES)[number];

export const CONTENT_KINDS = ['text', 'voice', 'photo'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const INSTRUCTION_STATUSES = ['draft', 'processing', 'partial_failure', 'ready', 'shared', 'archived'] as const;
export type InstructionStatus = (typeof INSTRUCTION_STATUSES)[number];

export const TERMINAL_VARIANT_STATUSES = ['ready', 'failed', 'text_only'] as const;
export type TerminalVariantStatus = (typeof TERMINAL_VARIANT_STATUSES)[number];

export const VARIANT_STATUSES = ['pending', 'processing', 'ready', 'text_only', 'failed'] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];

export const STAGE_STATUSES = ['pending', 'running', 'done', 'failed'] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export const DELIVERY_STATUSES = ['pending', 'opened', 'answered', 'completed'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const HELP_REASONS = ['dont_understand', 'missing_tools', 'safety_concern', 'other'] as const;
export type HelpReason = (typeof HELP_REASONS)[number];

export type Role = 'owner';
export type Plan = 'pilot';
export type Locale = 'en' | 'ar';

export interface Question {
  text: string;
  options: [string, string, string];
  correctIndex: 0 | 1 | 2;
  source: 'ai' | 'manual';
}

export interface VariantStages {
  translate: StageStatus;
  question: StageStatus;
  audio: StageStatus;
}

export interface DeliveryAttempt {
  optionIndex: number;
  correct: boolean;
  at: Date;
}

export interface HelpState {
  requested: boolean;
  reason: HelpReason | null;
  requestedAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

export interface WorkerRef {
  id: string;
  name: string;
  language: Language;
}
