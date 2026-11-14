import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { SupLocale } from './i18n';
import { translate } from './i18n';

export interface LocaleCtxValue {
  locale: SupLocale;
  setLocale: (locale: SupLocale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export const LocaleCtx = createContext<LocaleCtxValue>({
  locale: 'en',
  setLocale: () => undefined,
  t: (key) => key,
});

export const useLocale = () => useContext(LocaleCtx);

export const ToastCtx = createContext<(message: string, error?: boolean) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function usePath(): string {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

export function navigate(to: string): void {
  if (window.location.pathname === to) return;
  window.history.pushState(null, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0)).join('').toUpperCase() || '?';
}

export function fmtDate(iso: string | null | undefined, locale: SupLocale, withTime = false): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function relativeDay(iso: string | null, locale: SupLocale): string {
  if (!iso) return '—';
  return fmtDate(iso, locale, true);
}

export function timeAgo(iso: string | null | undefined, locale: SupLocale): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = (date.getTime() - Date.now()) / 1000;
  const abs = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    numeric: 'auto',
    style: 'short',
  });
  if (abs < 60) return formatter.format(Math.round(seconds), 'second');
  if (abs < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return formatter.format(Math.round(seconds / 3600), 'hour');
  return formatter.format(Math.round(seconds / 86400), 'day');
}

export function useDocumentLocale(locale: SupLocale): void {
  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.title = translate(locale, 'meta.title');
  }, [locale]);
}

export function Sheet({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="scrim is-open" onClick={onClose} />
      <aside className={`drawer is-open${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true">
        {children}
      </aside>
    </>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="scrim is-open" onClick={onClose} />
      <div className="modal is-open" role="dialog" aria-modal="true">
        {children}
      </div>
    </>
  );
}
