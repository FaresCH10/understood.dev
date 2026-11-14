import { useCallback, useEffect, useState } from 'react';
import { LANGUAGE_META, type Language } from '@understood/shared';
import type { CrewRow } from '../types';
import { api, errorMessage } from '../api';
import { Modal, navigate, useLocale, useToast } from '../ui';
import { Icon } from '../icons';
import { EmptyState, PageHead } from '../components';

export default function Crews() {
  const { t } = useLocale();
  const toast = useToast();
  const [crews, setCrews] = useState<CrewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api<CrewRow[]>('/api/v1/crews');
      setCrews(data.filter((crew) => !crew.archived));
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api('/api/v1/crews', { method: 'POST', body: { name: name.trim() } });
      toast(t('crew.created', { name: name.trim() }));
      setName('');
      setNewOpen(false);
      await load();
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        eyebrow={t('nav.label')}
        title={t('crews.title')}
        sub={t('crews.sub')}
        actions={
          <button className="btn btn-ghost" type="button" onClick={() => setNewOpen(true)}>
            <Icon name="plus" />
            {t('crews.new')}
          </button>
        }
      />

      {crews.length > 0 ? (
        <div className="crew-grid">
          {crews.map((crew) => {
            const languages = Object.keys(crew.languages) as Language[];
            return (
              <button className="crew-card" key={crew.id} type="button" onClick={() => navigate(`/crews/${crew.id}`)}>
                <div className="crew-top">
                  <span className="crew-ic">
                    <Icon name="users" />
                  </span>
                  <span className="crew-name">{crew.name}</span>
                  <Icon name="chevronRight" className="chev" />
                </div>
                <div className="crew-stats">
                  <span>
                    <strong>{crew.workerCount}</strong> {t('meta.workers', { n: crew.workerCount }).replace(String(crew.workerCount), '').trim()}
                  </span>
                  <span>
                    <strong>{languages.length}</strong> {t('detail.languages')}
                  </span>
                </div>
                <div className="crew-langs">
                  {languages.slice(0, 6).map((language) => (
                    <span className="lang-dot" key={language}>
                      <i />
                      {LANGUAGE_META[language].nativeLabel}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
          <button className="new-crew" type="button" onClick={() => setNewOpen(true)}>
            <span className="plus-circle">
              <Icon name="plus" />
            </span>
            {t('crews.new')}
          </button>
        </div>
      ) : loading ? (
        <div className="boot" style={{ minHeight: '40vh' }}>
          <span className="sync">
            <span className="pulse" />
            …
          </span>
        </div>
      ) : (
        <EmptyState icon="users" title={t('crew.empty')}>
          <button className="btn btn-primary" type="button" onClick={() => setNewOpen(true)}>
            <Icon name="plus" />
            {t('crews.new')}
          </button>
        </EmptyState>
      )}

      {newOpen ? (
        <Modal onClose={() => setNewOpen(false)}>
          <div className="modal-head">
            <div>
              <h2>{t('crew.newTitle')}</h2>
              <p>{t('crew.newSub')}</p>
            </div>
            <button className="icon-btn" type="button" aria-label={t('action.close')} onClick={() => setNewOpen(false)}>
              <Icon name="x" />
            </button>
          </div>
          <div className="modal-body">
            <div className="field">
              <label>{t('crew.name')}</label>
              <input
                className="input"
                value={name}
                maxLength={80}
                placeholder={t('crew.name')}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void create();
                }}
              />
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn btn-ghost" type="button" onClick={() => setNewOpen(false)}>
              {t('action.cancel')}
            </button>
            <button className="btn btn-primary" type="button" disabled={busy || !name.trim()} onClick={() => void create()}>
              {busy ? <Icon name="loader" className="spin" /> : null}
              {t('crew.create')}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
