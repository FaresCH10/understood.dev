export const LANGUAGES = ['ar', 'en', 'hi', 'ur', 'ml', 'bn'] as const;

export type Language = (typeof LANGUAGES)[number];

export interface LanguageMeta {
  code: Language;
  nativeLabel: string;
  englishLabel: string;
  dir: 'ltr' | 'rtl';
  ttsLocale: string;
  voiceId: string;
}

export const LANGUAGE_META: Record<Language, LanguageMeta> = {
  ar: { code: 'ar', nativeLabel: 'العربية', englishLabel: 'Arabic', dir: 'rtl', ttsLocale: 'ar-AE', voiceId: 'FatimaNeural' },
  en: { code: 'en', nativeLabel: 'English', englishLabel: 'English', dir: 'ltr', ttsLocale: 'en-US', voiceId: 'JennyNeural' },
  hi: { code: 'hi', nativeLabel: 'हिन्दी', englishLabel: 'Hindi', dir: 'ltr', ttsLocale: 'hi-IN', voiceId: 'SwaraNeural' },
  ur: { code: 'ur', nativeLabel: 'اردو', englishLabel: 'Urdu', dir: 'rtl', ttsLocale: 'ur-PK', voiceId: 'UzmaNeural' },
  ml: { code: 'ml', nativeLabel: 'മലയാളം', englishLabel: 'Malayalam', dir: 'ltr', ttsLocale: 'ml-IN', voiceId: 'SobhanaNeural' },
  bn: { code: 'bn', nativeLabel: 'বাংলা', englishLabel: 'Bengali', dir: 'ltr', ttsLocale: 'bn-IN', voiceId: 'NabanitaNeural' },
};

const ALIASES: Record<string, Language> = {
  ar: 'ar', arabic: 'ar', العربية: 'ar',
  en: 'en', english: 'en',
  hi: 'hi', hindi: 'hi', हिन्दी: 'hi', हिंदी: 'hi',
  ur: 'ur', urdu: 'ur', اردو: 'ur',
  ml: 'ml', malayalam: 'ml', മലയാളം: 'ml',
  bn: 'bn', bengali: 'bn', bangla: 'bn', বাংলা: 'bn',
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function parseLanguage(value: string): Language | null {
  return ALIASES[value.trim().toLowerCase()] ?? null;
}

export function languageDirection(lang: Language): 'ltr' | 'rtl' {
  return LANGUAGE_META[lang].dir;
}
