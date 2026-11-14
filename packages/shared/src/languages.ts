export const LANGUAGES = [
  "ar",
  "en",
  "hi",
  "ur",
  "ml",
  "bn",
  "ta",
  "te",
  "ne",
  "fil",
  "si",
  "ru",
  "pa-Guru",
  "pa-Arab",
  "id",
] as const;
export type Language = (typeof LANGUAGES)[number];
export interface LanguageMeta {
  code: Language;
  nativeLabel: string;
  englishLabel: string;
  dir: "ltr" | "rtl";
  ttsLocale: string;
  voiceId: string;
  audioSupported?: boolean;
}
export const LANGUAGE_META: Record<Language, LanguageMeta> = {
  ar: {
    code: "ar",
    nativeLabel: "العربية",
    englishLabel: "Arabic",
    dir: "rtl",
    ttsLocale: "ar-AE",
    voiceId: "FatimaNeural",
  },
  en: {
    code: "en",
    nativeLabel: "English",
    englishLabel: "English",
    dir: "ltr",
    ttsLocale: "en-US",
    voiceId: "JennyNeural",
  },
  hi: {
    code: "hi",
    nativeLabel: "हिन्दी",
    englishLabel: "Hindi",
    dir: "ltr",
    ttsLocale: "hi-IN",
    voiceId: "SwaraNeural",
  },
  ur: {
    code: "ur",
    nativeLabel: "اردو",
    englishLabel: "Urdu",
    dir: "rtl",
    ttsLocale: "ur-PK",
    voiceId: "UzmaNeural",
  },
  ml: {
    code: "ml",
    nativeLabel: "മലയാളം",
    englishLabel: "Malayalam",
    dir: "ltr",
    ttsLocale: "ml-IN",
    voiceId: "SobhanaNeural",
  },
  bn: {
    code: "bn",
    nativeLabel: "বাংলা",
    englishLabel: "Bengali",
    dir: "ltr",
    ttsLocale: "bn-IN",
    voiceId: "NabanitaNeural",
  },
  ta: {
    code: "ta",
    nativeLabel: "தமிழ்",
    englishLabel: "Tamil",
    dir: "ltr",
    ttsLocale: "ta-IN",
    voiceId: "PallaviNeural",
  },
  te: {
    code: "te",
    nativeLabel: "తెలుగు",
    englishLabel: "Telugu",
    dir: "ltr",
    ttsLocale: "te-IN",
    voiceId: "ShrutiNeural",
  },
  ne: {
    code: "ne",
    nativeLabel: "नेपाली",
    englishLabel: "Nepali",
    dir: "ltr",
    ttsLocale: "ne-NP",
    voiceId: "HemkalaNeural",
  },
  fil: {
    code: "fil",
    nativeLabel: "Filipino",
    englishLabel: "Filipino",
    dir: "ltr",
    ttsLocale: "fil-PH",
    voiceId: "BlessicaNeural",
  },
  si: {
    code: "si",
    nativeLabel: "සිංහල",
    englishLabel: "Sinhala",
    dir: "ltr",
    ttsLocale: "si-LK",
    voiceId: "ThiliniNeural",
  },
  ru: {
    code: "ru",
    nativeLabel: "Русский",
    englishLabel: "Russian",
    dir: "ltr",
    ttsLocale: "ru-RU",
    voiceId: "SvetlanaNeural",
  },
  "pa-Guru": {
    code: "pa-Guru",
    nativeLabel: "ਪੰਜਾਬੀ (ਗੁਰਮੁਖੀ)",
    englishLabel: "Punjabi (Gurmukhi)",
    dir: "ltr",
    ttsLocale: "pa-IN",
    voiceId: "VaaniNeural",
  },
  "pa-Arab": {
    code: "pa-Arab",
    nativeLabel: "پنجابی (شاہ مکھی)",
    englishLabel: "Punjabi (Shahmukhi)",
    dir: "rtl",
    ttsLocale: "",
    voiceId: "",
    audioSupported: false,
  },
  id: {
    code: "id",
    nativeLabel: "Bahasa Indonesia",
    englishLabel: "Indonesian",
    dir: "ltr",
    ttsLocale: "id-ID",
    voiceId: "GadisNeural",
  },
};
const ALIASES: Record<string, Language> = {
  ar: "ar",
  arabic: "ar",
  العربية: "ar",
  en: "en",
  english: "en",
  hi: "hi",
  hindi: "hi",
  हिन्दी: "hi",
  हिंदी: "hi",
  ur: "ur",
  urdu: "ur",
  اردو: "ur",
  ml: "ml",
  malayalam: "ml",
  മലയാളം: "ml",
  bn: "bn",
  bengali: "bn",
  bangla: "bn",
  বাংলা: "bn",
  ta: "ta",
  tamil: "ta",
  தமிழ்: "ta",
  te: "te",
  telugu: "te",
  తెలుగు: "te",
  ne: "ne",
  nepali: "ne",
  नेपाली: "ne",
  fil: "fil",
  tl: "fil",
  filipino: "fil",
  tagalog: "fil",
  si: "si",
  sinhala: "si",
  සිංහල: "si",
  ru: "ru",
  russian: "ru",
  русский: "ru",
  pa: "pa-Guru",
  "pa-guru": "pa-Guru",
  punjabi: "pa-Guru",
  "punjabi (gurmukhi)": "pa-Guru",
  ਪੰਜਾਬੀ: "pa-Guru",
  "pa-arab": "pa-Arab",
  "punjabi (shahmukhi)": "pa-Arab",
  پنجابی: "pa-Arab",
  id: "id",
  indonesian: "id",
  "bahasa indonesia": "id",
};
export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" &&
    (LANGUAGES as readonly string[]).includes(value)
  );
}
export function parseLanguage(value: string): Language | null {
  return ALIASES[value.trim().toLowerCase()] ?? null;
}
export function languageDirection(lang: Language): "ltr" | "rtl" {
  return LANGUAGE_META[lang].dir;
}
