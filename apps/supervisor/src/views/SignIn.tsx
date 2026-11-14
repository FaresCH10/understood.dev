import { useState, type FormEvent } from 'react';
import { useLocale, useToast } from '../ui';
import { BrandMark, Icon } from '../icons';
import { api, ApiError } from '../api';

export default function SignIn() {
  const { t, locale } = useLocale();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const linkError = params.get('error') === 'link_unavailable';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/v1/auth/magic-link', { method: 'POST', body: { email: email.trim() } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('sign.sent'));
      toast(err instanceof ApiError ? err.message : 'Could not send the link.', true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <section className="auth-brand">
        <div className="brand">
          <BrandMark inverse />
          <span className="brand-name">Understood</span>
          <span className="brand-tag">{t('brand.tag')}</span>
        </div>

        <div className="auth-hero">
          <span className="kicker">
            <Icon name="sparkles" />
            {t('sign.heroKicker')}
          </span>
          <h1>{t('sign.hero')}</h1>
          <p>{t('sign.heroSub')}</p>
          <ul className="auth-list">
            <li>
              <span className="tick">
                <Icon name="check" />
              </span>
              {t('sign.point1')}
            </li>
            <li>
              <span className="tick">
                <Icon name="check" />
              </span>
              {t('sign.point2')}
            </li>
            <li>
              <span className="tick">
                <Icon name="check" />
              </span>
              {t('sign.point3')}
            </li>
          </ul>
        </div>

        <div className="auth-quote">
          <span className="quote-mark">“</span>
          <p>
            <strong>{t('sign.quote')}</strong>
            <br />
            {t('sign.quoteSub')}
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-box">
          {sent ? (
            <div className="auth-sent">
              <span className="sent-ic">
                <Icon name="mail" />
              </span>
              <h2>{t('sign.sent')}</h2>
              <p className="auth-sub" style={{ marginTop: 8 }}>
                {t('sign.sentSub', { email })}
              </p>
              <button className="btn btn-ghost" type="button" onClick={() => setSent(false)}>
                {t('sign.back')}
              </button>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)}>
              <h2>{t('sign.title')}</h2>
              <p className="auth-sub">{t('sign.sub')}</p>
              {linkError && <div className="tip-card" style={{ marginBottom: 14 }}>{t('sign.fine')}</div>}
              {error && (
                <div className="tip-card" style={{ marginBottom: 14, background: 'var(--red-bg)', color: 'var(--red-ink)' }}>
                  {error}
                </div>
              )}
              <div className="field">
                <label htmlFor="email">{t('sign.email')}</label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy || !email.trim()}>
                {busy ? <Icon name="loader" className="spin" /> : <Icon name="mail" />}
                {t('sign.send')}
              </button>
              <p className="auth-fine">
                {locale === 'ar' ? t('auth.footer') : 'In development, the sign-in link is printed in the API console.'}
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
