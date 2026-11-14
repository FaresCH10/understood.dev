import { useEffect, useMemo, useState } from 'react';
import type { SupLocale } from './i18n';
import { translate } from './i18n';
import { LocaleCtx, ToastCtx, useDocumentLocale, usePath, navigate } from './ui';
import { BrandMark, Icon } from './icons';
import { api } from './api';
import type { Me } from './types';
import SignIn from './views/SignIn';
import Home from './views/Home';
import Instructions from './views/Instructions';
import InstructionDetail from './views/InstructionDetail';
import Composer from './views/Composer';
import Crews from './views/Crews';
import CrewDetail from './views/CrewDetail';
import Settings from './views/Settings';

interface ToastItem {
  id: number;
  message: string;
  error: boolean;
}

function readLocale(me: Me | null): SupLocale {
  const stored = localStorage.getItem('understood.sup.lang');
  if (stored === 'ar' || stored === 'en') return stored;
  return me?.user.locale === 'ar' ? 'ar' : 'en';
}

export default function App() {
  const path = usePath();
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [locale, setLocaleState] = useState<SupLocale>(readLocale(null));
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useDocumentLocale(locale);

  useEffect(() => {
    let live = true;
    api<Me>('/api/v1/auth/me')
      .then(({ data }) => {
        if (!live) return;
        setMe(data);
        setLocaleState(readLocale(data));
      })
      .catch(() => {
        if (live) setMe(null);
      })
      .finally(() => {
        if (live) setAuthChecked(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const t = useMemo(
    () => (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const setLocale = (next: SupLocale) => {
    localStorage.setItem('understood.sup.lang', next);
    setLocaleState(next);
  };

  const toast = (message: string, error = false) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, message, error }]);
    setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 3400);
  };

  const ctx = { locale, setLocale, t };

  if (path === '/signin') {
    return (
      <LocaleCtx.Provider value={ctx}>
        <ToastCtx.Provider value={toast}>
          <SignIn />
          <div className="toasts">
            {toasts.map((item) => (
              <div key={item.id} className={`toast${item.error ? ' is-error' : ''}`}>
                <Icon name={item.error ? 'alertCircle' : 'checkCircle'} />
                <span>{item.message}</span>
              </div>
            ))}
          </div>
        </ToastCtx.Provider>
      </LocaleCtx.Provider>
    );
  }

  if (!authChecked) {
    return (
      <div className="boot">
        <BrandMark size={40} />
      </div>
    );
  }

  if (!me) {
    return (
      <LocaleCtx.Provider value={ctx}>
        <ToastCtx.Provider value={toast}>
          <SignIn />
          <div className="toasts">
            {toasts.map((item) => (
              <div key={item.id} className={`toast${item.error ? ' is-error' : ''}`}>
                <Icon name={item.error ? 'alertCircle' : 'checkCircle'} />
                <span>{item.message}</span>
              </div>
            ))}
          </div>
        </ToastCtx.Provider>
      </LocaleCtx.Provider>
    );
  }

  const signOut = async () => {
    try {
      await api('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // cookie may already be gone
    }
    setMe(null);
    navigate('/signin');
  };

  const segments = path.split('/').filter(Boolean);
  let page = <Home me={me} />;
  if (segments[0] === 'instructions' && segments[1]) page = <InstructionDetail id={segments[1]} />;
  else if (segments[0] === 'instructions') page = <Instructions />;
  else if (segments[0] === 'new') page = <Composer me={me} />;
  else if (segments[0] === 'crews' && segments[1]) page = <CrewDetail id={segments[1]} />;
  else if (segments[0] === 'crews') page = <Crews />;
  else if (segments[0] === 'settings') page = <Settings me={me} onMe={setMe} onSignOut={signOut} />;

  const crumbKey =
    segments[0] === 'new'
      ? 'composer.title'
      : segments[0] === 'instructions'
        ? 'nav.instructions'
        : segments[0] === 'crews'
          ? 'nav.crews'
          : segments[0] === 'settings'
            ? 'nav.settings'
            : 'nav.home';

  return (
    <LocaleCtx.Provider value={ctx}>
      <ToastCtx.Provider value={toast}>
        <div className="app">
          <aside className="sidebar">
            <div className="brand">
              <BrandMark />
              <span className="brand-name">Understood</span>
              <span className="brand-tag">{t('brand.tag')}</span>
            </div>

            <button className="org-switch" type="button" onClick={() => navigate('/settings')}>
              <span className="avatar avatar-org">{me.org.name.slice(0, 2)}</span>
              <span className="org-meta">
                <strong>{me.org.name}</strong>
                <span>{t('org.meta')}</span>
              </span>
              <Icon name="chevronDown" />
            </button>

            <nav className="nav">
              <div className="nav-label">{t('nav.label')}</div>
              <a
                className={segments.length === 0 || segments[0] === 'home' ? 'is-active' : ''}
                href="/home"
                onClick={(event) => {
                  event.preventDefault();
                  navigate('/home');
                }}
              >
                <Icon name="home" />
                {t('nav.home')}
              </a>
              <a
                className={segments[0] === 'instructions' || segments[0] === 'new' ? 'is-active' : ''}
                href="/instructions"
                onClick={(event) => {
                  event.preventDefault();
                  navigate('/instructions');
                }}
              >
                <Icon name="doc" />
                {t('nav.instructions')}
              </a>
              <a
                className={segments[0] === 'crews' ? 'is-active' : ''}
                href="/crews"
                onClick={(event) => {
                  event.preventDefault();
                  navigate('/crews');
                }}
              >
                <Icon name="users" />
                {t('nav.crews')}
              </a>
              <a
                className={segments[0] === 'settings' ? 'is-active' : ''}
                href="/settings"
                onClick={(event) => {
                  event.preventDefault();
                  navigate('/settings');
                }}
              >
                <Icon name="settings" />
                {t('nav.settings')}
              </a>
            </nav>

            <div className="sidebar-note">
              <div className="note-top">
                <Icon name="globe" />
                {t('sidebar.langs')}
              </div>
              <div className="lang-note-list">
                <span>العربية</span>
                <span>English</span>
                <span>हिन्दी</span>
                <span>اردو</span>
                <span>മലയാളം</span>
                <span>বাংলা</span>
              </div>
            </div>

            <div className="sidebar-foot">
              <div className="lang-switch" role="group" aria-label="Interface language">
                <button className={locale === 'en' ? 'is-active' : ''} type="button" onClick={() => setLocale('en')}>
                  English
                </button>
                <button className={locale === 'ar' ? 'is-active' : ''} type="button" onClick={() => setLocale('ar')}>
                  العربية
                </button>
              </div>
              <div className="user">
                <span className="avatar">{me.user.name.slice(0, 2)}</span>
                <span className="user-meta">
                  <strong>{me.user.name}</strong>
                  <span>{me.user.email}</span>
                </span>
                <button className="icon-btn" type="button" aria-label={t('settings.signout')} onClick={() => void signOut()}>
                  <Icon name="arrowLeft" />
                </button>
              </div>
            </div>
          </aside>

          <div className="main">
            <header className="topbar">
              <div className="crumbs">
                <span>{t('nav.label')}</span>
                <span className="sep">/</span>
                <strong>{t(crumbKey)}</strong>
              </div>
              <div className="topbar-actions">
                <span className="sync">
                  <span className="pulse" />
                  {t('sync.live')}
                </span>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => navigate('/new')}>
                  <Icon name="plus" />
                  {t('action.new')}
                </button>
              </div>
            </header>
            <div className="content">{page}</div>
          </div>
        </div>

        <div className="toasts">
          {toasts.map((item) => (
            <div key={item.id} className={`toast${item.error ? ' is-error' : ''}`}>
              <Icon name={item.error ? 'alertCircle' : 'checkCircle'} />
              <span>{item.message}</span>
            </div>
          ))}
        </div>
      </ToastCtx.Provider>
    </LocaleCtx.Provider>
  );
}
