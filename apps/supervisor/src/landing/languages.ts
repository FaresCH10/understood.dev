import { LANGUAGES, LANGUAGE_META, type Language } from '@understood/shared';

export type WorkerLocaleCode = Language;
export const WORKER_LOCALES = LANGUAGES.map(code => ({
  code,
  name: LANGUAGE_META[code].nativeLabel,
  englishName: LANGUAGE_META[code].englishLabel,
  direction: LANGUAGE_META[code].dir,
}));
