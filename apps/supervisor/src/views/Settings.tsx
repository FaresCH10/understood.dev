import { useEffect, useState } from 'react';
import { LANGUAGE_META, LANGUAGES } from '@understood/shared';
import type { Me } from '../types';
import { api, download, errorMessage } from '../api';
import { useLocale, useToast } from '../ui';
import { Icon } from '../icons';
import { PageHead } from '../components';

interface OrgInfo {
  id: string;
  name: string;
  timezone: string;
  locale: 'en' | 'ar';
  plan: string;
  counts: { crews: number; workers: number };
  createdAt: string;
}

interface Usage {
  ttsChars: number;
  ttsMinutes: number;
  capMinutes: number;
  instructionsSent: number;
  deliveries: number;
}

const TIMEZONES = [
  ['Asia/Dubai', 'Dubai · GMT+4'],
  ['Asia/Riyadh', 'Riyadh · GMT+3'],
  ['Asia/Qatar', 'Doha · GMT+3'],
  ['Asia/Kuwait', 'Kuwait · GMT+3'],
  ['Asia/Muscat', 'Muscat · GMT+4'],
  ['Asia/Kolkata', 'India · GMT+5:30'],
  ['Asia/Karachi', 'Pakistan · GMT+5'],
  ['Asia/Dhaka', 'Dhaka · GMT+6'],
] as const;

export default function Settings({
  me,
  onMe,
  onSignOut,
}: {
  me: Me;
  onMe: (me: Me) => void;
  onSignOut: () => Promise<void>;
}) {
  const { t, locale, setLocale } = useLocale();
  const toast = useToast();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [name, setName] = useState(me.org.name);
  const [timezone, setTimezone] = useState(me.org.timezone);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [orgResult, usageResult] = await Promise.all([
          api<OrgInfo>('/api/v1/org'),
          api<Usage>('/api/v1/org/usage'),
        ]);
        if (!live) return;
        setOrg(orgResult.data);
        setUsage(usageResult.data);
        setName(orgResult.data.name);
        setTimezone(orgResult.data.timezone);
      } catch (error) {
        toast(errorMessage(error), true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { data } = await api<{ id: string; name: string; timezone: string; locale: 'en' | 'ar'; plan: string }>(
        '/api/v1/org',
        { method: 'PATCH', body: { name: name.trim(), timezone, locale } },
      );
      onMe({ ...me, org: { ...me.org, name: data.name, timezone: data.timezone } });
      toast(t('settings.saved'));
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };

  const exportOrg = async () => {
    try {
      await download('/api/v1/exports/org.csv', `understood_org_${new Date().toISOString().slice(0, 10)}.csv`);
      toast(t('toast.exported'));
    } catch (error) {
      toast(errorMessage(error), true);
    }
  };

  const exportWorkers = async () => {
    try {
      await download('/api/v1/exports/workers.csv', `understood_workers_${new Date().toISOString().slice(0, 10)}.csv`);
      toast(t('toast.exported'));
    } catch (error) {
      toast(errorMessage(error), true);
    }
  };

  const exportAll = async () => {
    try {
      await download('/api/v1/exports/all.zip', `understood_export_${new Date().toISOString().slice(0, 10)}.zip`);
      toast(t('toast.exported'));
    } catch (error) {
      toast(errorMessage(error), true);
    }
  };

  const timezoneList = TIMEZONES.some(([value]) => value === timezone)
    ? TIMEZONES
    : [[timezone, timezone] as const, ...TIMEZONES];
  const usagePct = usage && usage.capMinutes > 0 ? Math.min(100, Math.round((usage.ttsMinutes / usage.capMinutes) * 100)) : 0;

  return (
    <>
      <PageHead
        eyebrow={t('settings.pilot')}
        title={t('settings.title')}
        sub={t('settings.sub')}
        actions={
          <button className="btn btn-primary" type="button" disabled={busy || !name.trim()} onClick={() => void save()}>
            {busy ? <Icon name="loader" className="spin" /> : <Icon name="check" />}
            {t('action.save')}
          </button>
        }
      />

      <div className="settings-grid">
        <div className="card settings-card">
          <h2>{t('settings.org')}</h2>
          <p className="cap">{t('settings.plan', { n: org?.counts.workers ?? 0 })}</p>
          <div className="field">
            <label>{t('settings.name')}</label>
            <input className="input" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="field">
            <label>{t('settings.timezone')}</label>
            <select className="select" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
              {timezoneList.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('settings.defaultLang')}</label>
            <div className="segmented">
              <button className={locale === 'en' ? 'is-active' : ''} type="button" onClick={() => setLocale('en')}>
                English
              </button>
              <button className={locale === 'ar' ? 'is-active' : ''} type="button" onClick={() => setLocale('ar')}>
                العربية
              </button>
            </div>
            <p className="help" style={{ marginTop: 6 }}>
              {t('settings.languageNote')}
            </p>
          </div>
        </div>

        <div className="card settings-card">
          <h2>{t('settings.usage')}</h2>
          <p className="cap">{t('settings.usageNote')}</p>
          <div className="settings-row">
            <div>
              <div className="sr-label">{t('processing.audio')}</div>
              <div className="sr-sub">
                {usage ? t('settings.usageCap', { used: usage.ttsMinutes, cap: usage.capMinutes }) : '—'}
              </div>
            </div>
          </div>
          <div className="meter" style={{ marginTop: -4 }}>
            <div className="meter-fill" style={{ width: `${usagePct}%` }} />
          </div>
          <div className="settings-row">
            <div>
              <div className="sr-label">{t('settings.instructionsSent')}</div>
            </div>
            <strong className="tnum">{usage?.instructionsSent ?? 0}</strong>
          </div>
          <div className="settings-row">
            <div>
              <div className="sr-label">{t('settings.deliveries')}</div>
            </div>
            <strong className="tnum">{usage?.deliveries ?? 0}</strong>
          </div>
          <div className="settings-row">
            <div>
              <div className="sr-label">{t('nav.crews')}</div>
              <div className="sr-sub">{t('meta.workers', { n: org?.counts.workers ?? 0 })}</div>
            </div>
            <strong className="tnum">{org?.counts.crews ?? 0}</strong>
          </div>
        </div>

        <div className="card settings-card">
          <h2>{t('settings.workers')}</h2>
          <p className="cap">{t('settings.workersCap')}</p>
          {LANGUAGES.map((language) => (
            <div className="settings-row" key={language}>
              <span className="sr-label" style={{ fontSize: 13 }}>
                {LANGUAGE_META[language].nativeLabel}
              </span>
              <span className="pill pill-green">
                <Icon name="check" />
                {t('settings.active')}
              </span>
            </div>
          ))}
        </div>

        <div className="card settings-card">
          <h2>{t('settings.data')}</h2>
          <p className="cap">{t('settings.retention')}</p>
          <div className="settings-row">
            <div>
              <div className="sr-label">{t('settings.exportAll')}</div>
              <div className="sr-sub">{t('settings.exportNote')}</div>
            </div>
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => void exportOrg()}>
              <Icon name="download" />
              {t('board.export')}
            </button>
          </div>
          <div className="settings-row">
            <div>
              <div className="sr-label">{t('settings.exportWorkers')}</div>
              <div className="sr-sub">{t('settings.exportNote')}</div>
            </div>
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => void exportWorkers()}>
              <Icon name="download" />
              CSV
            </button>
          </div>
          <div className="settings-row">
            <div>
              <div className="sr-label">{t('settings.exportData')}</div>
              <div className="sr-sub">{t('settings.exportNote')}</div>
            </div>
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => void exportAll()}>
              <Icon name="download" />
              ZIP
            </button>
          </div>
          <div className="settings-row">
            <div>
              <div className="sr-label">{t('settings.signout')}</div>
              <div className="sr-sub">{me.user.email}</div>
            </div>
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => void onSignOut()}>
              {t('settings.signout')}
            </button>
          </div>
        </div>

        <div className="card settings-card danger-zone">
          <h2>{t('settings.danger')}</h2>
          <p className="cap">{t('settings.deleteNote')}</p>
          <div className="settings-row">
            <div>
              <div className="sr-label">{t('settings.delete')}</div>
              <div className="sr-sub">{t('settings.deleteSub')}</div>
            </div>
            <button className="btn btn-sm btn-danger" type="button" disabled>
              {t('settings.delete')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
