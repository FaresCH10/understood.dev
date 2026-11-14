import type { Language } from '@understood/shared';
import type { SavedSession } from './types';
import { isLanguage } from './i18n';

const SESSION_PREFIX = 'understood.worker.session.';
const LANG_KEY = 'understood.worker.lang';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode); the flow still works in-memory
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function loadSession(shareToken: string): SavedSession | null {
  const raw = read(SESSION_PREFIX + shareToken);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedSession>;
    if (!parsed.workerId || !parsed.deliveryToken || !isLanguage(parsed.language)) return null;
    return {
      workerId: parsed.workerId,
      name: typeof parsed.name === 'string' ? parsed.name : '',
      language: parsed.language,
      deliveryToken: parsed.deliveryToken,
    };
  } catch {
    return null;
  }
}

export function saveSession(shareToken: string, session: SavedSession): void {
  write(SESSION_PREFIX + shareToken, JSON.stringify(session));
}

export function clearSession(shareToken: string): void {
  remove(SESSION_PREFIX + shareToken);
}

export function preferredLanguage(): Language {
  const stored = read(LANG_KEY);
  if (isLanguage(stored)) return stored;
  const browser = (navigator.languages?.[0] ?? navigator.language ?? '').slice(0, 2).toLowerCase();
  if (isLanguage(browser)) return browser;
  return 'en';
}

export function rememberLanguage(language: Language): void {
  write(LANG_KEY, language);
}
