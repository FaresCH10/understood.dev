import { useCallback, useEffect, useState } from 'react';
import type { InstructionRow } from '../types';
import { api, errorMessage } from '../api';
import { navigate, useLocale, useToast } from '../ui';
import { Icon } from '../icons';
import { EmptyState, InstructionCard, PageHead } from '../components';

type Tab = 'shared' | 'all' | 'archived';

export default function Instructions() {
  const { t } = useLocale();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('shared');
  const [rows, setRows] = useState<InstructionRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (status: Tab, nextCursor: string | null, append: boolean) => {
      setLoading(true);
      try {
        const query = new URLSearchParams({ status, limit: '20' });
        if (nextCursor) query.set('cursor', nextCursor);
        const { data, meta } = await api<InstructionRow[]>(`/api/v1/instructions?${query.toString()}`);
        setRows((current) => (append ? [...current, ...data] : data));
        setCursor(typeof meta.nextCursor === 'string' ? meta.nextCursor : null);
      } catch (error) {
        toast(errorMessage(error), true);
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load(tab, null, false);
  }, [tab, load]);

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'shared', label: t('tabs.shared') },
    { key: 'all', label: t('tabs.all') },
    { key: 'archived', label: t('tabs.archived') },
  ];

  return (
    <>
      <PageHead
        eyebrow={t('nav.label')}
        title={t('instructions.title')}
        sub={t('instructions.sub')}
        actions={
          <button className="btn btn-primary" type="button" onClick={() => navigate('/new')}>
            <Icon name="plus" />
            {t('action.new')}
          </button>
        }
      />

      <div className="tabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            className={`tab${tab === item.key ? ' is-active' : ''}`}
            type="button"
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {rows.length > 0 ? (
        <div className="instr-list">
          {rows.map((row) => (
            <InstructionCard key={row.id} row={row} />
          ))}
        </div>
      ) : loading ? (
        <div className="instr-list">
          {[0, 1, 2].map((index) => (
            <div className="instr-row" key={index} style={{ opacity: 0.45 }}>
              <div className="instr-icon is-draft">
                <Icon name="doc" />
              </div>
              <div className="instr-main">
                <div className="instr-title">…</div>
                <div className="instr-meta">…</div>
              </div>
              <div className="instr-meter" />
              <div className="instr-side" />
              <span />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="doc" title={t('instructions.empty')} />
      )}

      {cursor ? (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn btn-ghost" type="button" disabled={loading} onClick={() => void load(tab, cursor, true)}>
            {loading ? t('composer.saving') : t('action.next')}
            <Icon name="chevronRight" />
          </button>
        </div>
      ) : null}
    </>
  );
}
