import type { ReactNode } from 'react';
import { LANGUAGE_META, type Language } from '@understood/shared';
import type { InstructionRow, InstructionStatus } from './types';
import { Icon } from './icons';
import { fmtDate, navigate, useLocale } from './ui';

export function PageHead({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export const STATUS_KEY: Record<InstructionStatus, string> = {
  draft: 'status.draft',
  processing: 'status.processing',
  partial_failure: 'status.partial',
  ready: 'status.ready',
  shared: 'status.shared',
  archived: 'status.archived',
};

export function StatusChip({ status }: { status: InstructionStatus }) {
  const { t } = useLocale();
  const tone =
    status === 'ready' || status === 'shared'
      ? ' green'
      : status === 'processing' || status === 'partial_failure'
        ? ' amber'
        : '';
  return (
    <span className={`status-chip${tone}`}>
      {status === 'processing' ? <Icon name="loader" className="spin" /> : null}
      {status === 'ready' || status === 'shared' ? <Icon name="check" /> : null}
      {t(STATUS_KEY[status])}
    </span>
  );
}

export function LangCell({ language }: { language: Language }) {
  const meta = LANGUAGE_META[language];
  return (
    <span className="lang-cell">
      <span>{meta.nativeLabel}</span>
      <span className="code">{meta.code}</span>
    </span>
  );
}

export function EmptyState({
  icon = 'doc',
  title,
  children,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="card empty">
      <div className="e-ic">
        <Icon name={icon} />
      </div>
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function InstructionCard({ row }: { row: InstructionRow }) {
  const { t, locale } = useLocale();
  const pct = row.targeted > 0 ? Math.round((row.understood / row.targeted) * 100) : 0;
  const open = () => navigate(`/instructions/${row.id}`);
  const when = row.sharedAt ?? row.updatedAt;

  return (
    <div
      className="instr-row"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
    >
      <div className={`instr-icon${row.status === 'draft' ? ' is-draft' : ''}`}>
        <Icon name="doc" />
      </div>
      <div className="instr-main">
        <div className="instr-title">{row.title ?? t('instr.untitled')}</div>
        <div className="instr-meta">
          <span>{row.crewName ?? '—'}</span>
          <span className="dot" />
          <span>{fmtDate(when, locale, true)}</span>
          {row.helpCount > 0 ? (
            <>
              <span className="dot" />
              <span>
                {t('board.filter.needsHelp')} · {row.helpCount}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="instr-meter">
        {row.status === 'shared' || row.status === 'archived' ? (
          <>
            <div className="meter-line">
              <span>{t('kpi.understood')}</span>
              <strong>{pct}%</strong>
            </div>
            <div className="meter">
              <div className="meter-fill is-green" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <div className="meter-line">
            <span>{t('meta.targeted')}</span>
            <strong>{row.targeted}</strong>
          </div>
        )}
      </div>
      <div className="instr-side">
        <StatusChip status={row.status} />
      </div>
      <Icon name="chevronRight" className="chev" />
    </div>
  );
}

export function reasonKey(reason: string | null): string {
  switch (reason) {
    case 'dont_understand':
      return 'reason.dontUnderstand';
    case 'missing_tools':
      return 'reason.tools';
    case 'safety_concern':
      return 'reason.safety';
    default:
      return 'reason.other';
  }
}
