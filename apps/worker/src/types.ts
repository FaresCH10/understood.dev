import type { Language } from '@understood/shared';

export interface AudienceEntry {
  id: string;
  displayName: string;
  firstName: string;
  lastInitial: string;
  language: Language;
}

export interface MetaResponse {
  org: { name: string };
  instruction: { title: string | null; titleVariants: Partial<Record<Language, string | null>>; type: string };
  availableLanguages: Language[];
  audience: AudienceEntry[];
  preview: boolean;
}

export interface Content {
  title: string | null;
  type: string;
  text: string | null;
  audioUrl: string | null;
  audioExpiresAt: string | null;
  photoUrl: string | null;
  photoExpiresAt: string | null;
  question: { text: string; options: string[]; correctIndex?: 0 | 1 | 2; selectedIndex?: 0 | 1 | 2 } | null;
  preview: boolean;
}

export interface Attempt {
  optionIndex: number;
  correct: boolean;
  at: string;
}

export interface HelpState {
  requested: boolean;
  reason: string | null;
  requestedAt: string | null;
  resolvedAt: string | null;
}

export interface DeliveryState {
  id: string;
  status: 'pending' | 'opened' | 'answered' | 'completed';
  language: Language;
  attempts: Attempt[];
  attemptsCount: number;
  help: HelpState;
  openedAt: string | null;
  answeredAt: string | null;
  completedAt: string | null;
}

export interface StateResponse {
  delivery: DeliveryState;
  worker: { firstName: string; language: Language };
  instruction: Content;
  alreadyCompleted: boolean;
}

export interface IdentifyResponse {
  deliveryToken: string;
  deliveryId: string;
  worker: { firstName: string; language: Language };
  instruction: Content;
  alreadyCompleted: boolean;
}

export interface AnswerResponse {
  correct: boolean;
  correctIndex: 0 | 1 | 2;
  firstAttempt: boolean;
  attemptsCount: number;
}

export interface SavedSession {
  workerId: string;
  name: string;
  language: Language;
  deliveryToken: string;
}
