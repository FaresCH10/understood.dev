import { useCallback, useEffect, useState } from 'react';
import type { Bilingual, ExceptionRow, InstructionRow, Me, Overview } from '../types';
import { api, download, errorMessage } from '../api';
import { fmtDate, initials, navigate, timeAgo, useLocale, useToast } from '../ui';
import { Icon } from '../icons';
import { EmptyState, InstructionCard, PageHead, reasonKey } from '../components';

export default function Home({ me }: { me: Me }) {
  const { t, locale } = useLocale();
  const toast = useToast();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [recent, setRecent] = useState<InstructionRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [board, list] = await Promise.all([
        api<Overview>('/api/v1/board/overview'),
        api<InstructionRow[]>('/api/v1/instructions?status=all&limit=5'),
      ]);
      setOverview(board.data);
      setRecent(list.data);
    } catch (error) {
      toast(errorMessage(error), true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolveHelp = async (row: ExceptionRow) => {
    setBusyId(row.deliveryId);
    try {
      await api(`/api/v1/deliveries/${row.deliveryId}/resolve-help`, { method: 'POST' });
      toast(t('board.resolvedToast', { name: row.workerName }));
      await load();
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setBusyId(null);
    }
  };

  const copyReminder = async (instructionId: string) => {
    setBusyId(instructionId);
    try {
      const { data } = await api<{ reminderMessage: Bilingual; whatsappMessage: Bilingual }>(
        `/api/v1/instructions/${instructionId}/share-link`,
      );
      await navigator.clipboard.writeText(data.reminderMessage[locale] || data.whatsappMessage[locale]);
      toast(t('board.reminderCopied'));
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setBusyId(null);
    }
  };

  const exportWeek = async () => {
    try {
      await download('/api/v1/exports/org.csv', `understood_org_${new Date().toISOString().slice(0, 10)}.csv`);
      toast(t('toast.exported'));
    } catch (error) {
      toast(errorMessage(error), true);
    }
  };

  const dateLabel = (() => {
    try {
      return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date());
    } catch {
      return '';
    }
  })();

  const kpis = overview?.kpis;
  const understood = kpis?.understood7d;
  const understoodPct = understood && understood.rate !== null ? Math.round(understood.rate * 100) : 0;

  const needsHelp = overview?.exceptions.needsHelp ?? [];
  const notOpened = overview?.exceptions.notOpened ?? [];
  const wrong = overview?.exceptions.wrong ?? [];
  const hasExceptions = needsHelp.length + notOpened.length + wrong.length > 0;
  const firstName = me.user.name.trim().split(/\s+/)[0] ?? me.user.name;

  return (
    <>
      <PageHead
        eyebrow={dateLabel}
        title={t('home.greetingName', { name: firstName })}
        sub={t('home.sub')}
        actions={
          <button className="btn btn-primary btn-lg" type="button" onClick={() => navigate('/new')}>
            <Icon name="plus" />
            {t('action.new')}
          </button>
        }
      />

      {overview && kpis && kpis.workers === 0 && kpis.crews === 0 ? (
        <div className="card card-pad" style={{ marginBottom: 18 }}>
          <div className="section-head" style={{ marginTop: 0 }}>
            <h2>{t('home.start')}</h2>
          </div>
          <p className="sub" style={{ marginTop: 0 }}>
            {t('home.startSub')}
          </p>
          <div className="quick-actions" style={{ marginTop: 4 }}>
            <button className="quick-action" type="button" onClick={() => navigate('/crews')}>
              <span className="q-ic">
                <Icon name="users" />
              </span>
              <span>
                <strong>{t('crews.new')}</strong>
                <span>{t('crew.newSub')}</span>
              </span>
            </button>
            <button className="quick-action" type="button" onClick={() => navigate('/crews')}>
              <span className="q-ic">
                <Icon name="plus" />
              </span>
              <span>
                <strong>{t('crew.addWorker')}</strong>
                <span>{t('worker.addSub')}</span>
              </span>
            </button>
            <button className="quick-action" type="button" onClick={() => navigate('/new')}>
              <span className="q-ic">
                <Icon name="mic" />
              </span>
              <span>
                <strong>{t('composer.title')}</strong>
                <span>{t('composer.sub')}</span>
              </span>
            </button>
          </div>
        </div>
      ) : null}

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-icon green">
              <Icon name="checkCircle" />
            </span>
            <span className="kpi-label">{t('kpi.understood')}</span>
          </div>
          <div className="kpi-val">{understoodPct}%</div>
          <div className="kpi-sub">
            {understood?.understood ?? 0} {t('kpi.of')} {understood?.targeted ?? 0} · {t('kpi.understoodSub')}
          </div>
          <div className="meter">
            <div className="meter-fill is-green" style={{ width: `${understoodPct}%` }} />
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-icon slate">
              <Icon name="share" />
            </span>
            <span className="kpi-label">{t('home.live')}</span>
          </div>
          <div className="kpi-val">{kpis?.liveInstructions ?? 0}</div>
          <div className="kpi-sub">{t('home.liveSub', { n: kpis?.liveInstructions ?? 0 })}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-icon amber">
              <Icon name="alertCircle" />
            </span>
            <span className="kpi-label">{t('kpi.needsHelp')}</span>
          </div>
          <div className="kpi-val">{kpis?.needsHelp ?? 0}</div>
          <div className="kpi-sub">{t('kpi.helpSub')}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-icon slate">
              <Icon name="clock" />
            </span>
            <span className="kpi-label">{t('kpi.pending')}</span>
          </div>
          <div className="kpi-val">{kpis?.notOpened ?? 0}</div>
          <div className="kpi-sub">{t('kpi.pendingSub')}</div>
        </div>
      </div>

      <div className="section-head">
        <h2>{t('home.attention')}</h2>
        <button className="link-btn" type="button" onClick={() => navigate('/instructions')}>
          {t('action.viewBoard')}
          <Icon name="chevronRight" />
        </button>
      </div>

      {hasExceptions ? (
        <div className="exception-grid">
          {needsHelp.slice(0, 2).map((row) => (
            <div className="ex-card" key={row.deliveryId}>
              <div className="ex-top">
                <Icon name="alertTriangle" />
                {t('status.help')}
              </div>
              <div className="ex-name">
                <span className="avatar avatar-sm">{initials(row.workerName)}</span>
                {row.workerName}
              </div>
              <div className="ex-reason">
                {t(reasonKey(row.helpReason))}
                {row.helpRequestedAt ? ` · ${fmtDate(row.helpRequestedAt, locale, true)}` : ''}
              </div>
              <div className="ex-foot">
                <button
                  className="btn btn-sm btn-ghost"
                  type="button"
                  disabled={busyId === row.deliveryId}
                  onClick={() => void resolveHelp(row)}
                >
                  <Icon name="check" />
                  {t('action.markResolved')}
                </button>
              </div>
            </div>
          ))}
          {notOpened.slice(0, Math.max(0, 3 - needsHelp.length)).map((row) => (
            <div className="ex-card is-slate" key={row.deliveryId}>
              <div className="ex-top">
                <Icon name="clock" />
                {t('status.pending')}
              </div>
              <div className="ex-name">
                <span className="avatar avatar-sm">{initials(row.workerName)}</span>
                {row.workerName}
              </div>
              <div className="ex-reason">{t('board.pendingSince', { when: timeAgo(row.sharedAt, locale) })}</div>
              <div className="ex-foot">
                <button
                  className="btn btn-sm btn-ghost"
                  type="button"
                  disabled={busyId === row.instructionId}
                  onClick={() => void copyReminder(row.instructionId)}
                >
                  <Icon name="message" />
                  {t('action.reminder')}
                </button>
              </div>
            </div>
          ))}
          {wrong.slice(0, Math.max(0, 3 - needsHelp.length - notOpened.length)).map((row) => (
            <div className="ex-card is-red" key={row.deliveryId}>
              <div className="ex-top">
                <Icon name="x" />
                {t('board.exceptions.wrong')}
              </div>
              <div className="ex-name">
                <span className="avatar avatar-sm">{initials(row.workerName)}</span>
                {row.workerName}
              </div>
              <div className="ex-reason">
                {t('board.wrong')}
                {row.answeredAt ? ` · ${fmtDate(row.answeredAt, locale, true)}` : ''}
              </div>
              <div className="ex-foot">
                <button
                  className="btn btn-sm btn-ghost"
                  type="button"
                  onClick={() => navigate(`/instructions/${row.instructionId}`)}
                >
                  <Icon name="arrowRight" />
                  {t('board.workers')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="checkCircle" title={t('board.noExceptions')} />
      )}

      <div className="section-head">
        <h2>{t('home.recent')}</h2>
        <button className="link-btn" type="button" onClick={() => navigate('/instructions')}>
          {t('action.seeAll')}
          <Icon name="chevronRight" />
        </button>
      </div>
      {recent.length > 0 ? (
        <div className="instr-list">
          {recent.map((row) => (
            <InstructionCard key={row.id} row={row} />
          ))}
        </div>
      ) : (
        <EmptyState icon="doc" title={t('instructions.empty')} />
      )}

      <div className="section-head">
        <h2>{t('home.quick')}</h2>
      </div>
      <div className="quick-actions">
        <button className="quick-action" type="button" onClick={() => navigate('/instructions')}>
          <span className="q-ic">
            <Icon name="alertCircle" />
          </span>
          <span>
            <strong>{t('home.quick.review')}</strong>
            <span>{t('home.quick.reviewSub')}</span>
          </span>
        </button>
        <button className="quick-action" type="button" onClick={() => navigate('/new')}>
          <span className="q-ic">
            <Icon name="mic" />
          </span>
          <span>
            <strong>{t('home.quick.share')}</strong>
            <span>{t('home.quick.shareSub')}</span>
          </span>
        </button>
        <button className="quick-action" type="button" onClick={() => void exportWeek()}>
          <span className="q-ic">
            <Icon name="download" />
          </span>
          <span>
            <strong>{t('home.quick.export')}</strong>
            <span>{t('home.quick.exportSub')}</span>
          </span>
        </button>
      </div>
    </>
  );
}
