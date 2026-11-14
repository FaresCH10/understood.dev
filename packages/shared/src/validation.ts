import type { HelpReason, Question } from './enums.js';
import type { Language } from './languages.js';

const SCRIPT_PATTERNS: Partial<Record<Language, RegExp>> = {
  ar: /\p{Script=Arabic}/u,
  ur: /\p{Script=Arabic}/u,
  hi: /\p{Script=Devanagari}/u,
  bn: /\p{Script=Bengali}/u,
  ml: /\p{Script=Malayalam}/u,
  en: /[A-Za-z]/,
};

export interface TranslationValidation {
  ok: boolean;
  issues: string[];
}

export function validateTranslation(input: {
  source: string;
  translated: string;
  target: Language;
  sourceLang: Language;
}): TranslationValidation {
  const issues: string[] = [];
  const translated = input.translated.trim();
  if (translated.length === 0) issues.push('empty');
  if (input.target !== input.sourceLang) {
    if (translated === input.source.trim()) issues.push('identical_to_source');
    const ratio = translated.length / Math.max(1, input.source.trim().length);
    if (ratio < 0.5 || ratio > 2.5) issues.push('length_ratio');
    const pattern = SCRIPT_PATTERNS[input.target];
    if (pattern && translated.length > 0 && !pattern.test(translated)) issues.push('target_script');
  }
  return { ok: issues.length === 0, issues };
}

export function validateQuestion(question: Question): TranslationValidation {
  const issues: string[] = [];
  if (!question.text.trim() || question.text.length > 140) issues.push('question_length');
  if (question.options.length !== 3) issues.push('option_count');
  if (question.options.some((option) => !option.trim() || option.length > 60)) issues.push('option_length');
  if (new Set(question.options).size !== question.options.length) issues.push('options_not_unique');
  if (![0, 1, 2].includes(question.correctIndex)) issues.push('correct_index');
  return { ok: issues.length === 0, issues };
}

export const HELP_REASON_LABELS: Record<HelpReason, string> = {
  dont_understand: 'Does not understand',
  missing_tools: 'Missing tools or materials',
  safety_concern: 'Safety concern',
  other: 'Other',
};
