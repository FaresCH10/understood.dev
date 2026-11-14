import { useCallback, useEffect, useMemo, useState } from 'react';
import { LANGUAGE_META, LANGUAGES, type Language } from '@understood/shared';
import type { ImportResult, WorkerRow } from '../types';
import { ApiError, api, download, errorMessage } from '../api';
import { Modal, fmtDate, initials, navigate, useLocale, useToast } from '../ui';
import { Icon } from '../icons';
import { EmptyState, LangCell, PageHead } from '../components';

interface CrewInfo {
  id: string;
  name: string;
  archived: boolean;
  counts: { workers: number; archivedWorkers: number };
  createdAt: string;
}

function WorkerModal({
  crewId,
  crewName,
  worker,
  onClose,
  onSaved,
}: {
  crewId: string;
  crewName: string;
  worker: WorkerRow | null;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const { t } = useLocale();
  const toast = useToast();
  const [name, setName] = useState(worker?.name ?? '');
  const [language, setLanguage] = useState<Language>(worker?.language ?? 'ar');
  const [phone, setPhone] = useState(worker?.phoneE164 ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        language,
        phoneE164: phone.trim() ? phone.trim() : null,
      };
      if (worker) {
        await api(`/api/v1/workers/${worker.id}`, { method: 'PATCH', body });
        toast(t('crew.workerSaved', { name: name.trim() }));
      } else {
        await api('/api/v1/workers', { method: 'POST', body: { ...body, crewId } });
        toast(t('worker.added', { name: name.trim(), crew: crewName }));
      }
      await onSaved(name.trim());
      onClose();
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!worker) return;
    if (!window.confirm(t('crew.archiveConfirm', { name: worker.name }))) return;
    setBusy(true);
    try {
      await api(`/api/v1/workers/${worker.id}`, { method: 'PATCH', body: { archived: true } });
      toast(t('crew.workerArchived', { name: worker.name }));
      await onSaved(worker.name);
      onClose();
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-head">
        <div>
          <h2>{worker ? t('crew.workerTitle') : t('worker.addTitle')}</h2>
          <p>{worker ? t('crew.workerSub') : t('worker.addSub')}</p>
        </div>
        <button className="icon-btn" type="button" aria-label={t('action.close')} onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <div className="modal-body">
        <div className="field">
          <label>{t('worker.name')}</label>
          <input
            className="input"
            value={name}
            maxLength={80}
            placeholder={t('worker.name')}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="field">
          <label>{t('worker.language')}</label>
          <select className="select" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
            {LANGUAGES.map((code) => (
              <option value={code} key={code}>
                {LANGUAGE_META[code].nativeLabel} · {LANGUAGE_META[code].englishLabel}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t('worker.phone')}</label>
          <input
            className="input"
            value={phone}
            placeholder="+971 50 000 0000"
            onChange={(event) => setPhone(event.target.value)}
          />
          <p className="help">{t('worker.phoneHelp')}</p>
        </div>
        <div className="modal-note">
          <Icon name="shield" />
          <span>{t('csv.snapshot')}</span>
        </div>
      </div>
      <div className="modal-foot">
        {worker ? (
          <button
            className="btn btn-sm btn-ghost"
            type="button"
            style={{ marginInlineEnd: 'auto', color: 'var(--red-ink)' }}
            disabled={busy}
            onClick={() => void archive()}
          >
            <Icon name="lock" />
            {t('crew.archive')}
          </button>
        ) : null}
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          {t('action.cancel')}
        </button>
        <button className="btn btn-primary" type="button" disabled={busy || !name.trim()} onClick={() => void save()}>
          {busy ? <Icon name="loader" className="spin" /> : <Icon name={worker ? 'check' : 'plus'} />}
          {worker ? t('action.save') : t('worker.add')}
        </button>
      </div>
    </Modal>
  );
}

function ImportModal({
  crewId,
  onClose,
  onImported,
}: {
  crewId: string;
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const { t } = useLocale();
  const toast = useToast();
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('crewId', crewId);
      const { data } = await api<ImportResult>('/api/v1/workers/import', { method: 'POST', body: form });
      setPreview(data);
      setFileName(file.name);
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const { data } = await api<{ created: number }>(`/api/v1/imports/${preview.importId}/commit`, {
        method: 'POST',
      });
      toast(t('csv.committed', { n: data.created }));
      await onImported();
      onClose();
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-head">
        <div>
          <h2>{preview ? t('csv.preview') : t('csv.title')}</h2>
          <p>{t('csv.sub')}</p>
        </div>
        <button className="icon-btn" type="button" aria-label={t('action.close')} onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <div className="modal-body">
        {!preview ? (
          <>
            <label className="dropzone" htmlFor="csv-file">
              <span className="dz-ic">{busy ? <Icon name="loader" className="spin" /> : <Icon name="file" />}</span>
              <strong>{busy ? t('csv.uploading') : t('csv.drop')}</strong>
              <span>{t('csv.or')}</span>
            </label>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = '';
              }}
            />
            <div className="helper-line" style={{ marginTop: 10 }}>
              <button
                className="link-btn"
                type="button"
                onClick={() => void download('/api/v1/workers/template.csv', 'understood_workers_template.csv')}
              >
                <Icon name="download" />
                {t('csv.template')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="helper-line">
              <span className={`pill ${preview.errorCount > 0 ? 'pill-red' : 'pill-green'}`}>
                <Icon name={preview.errorCount > 0 ? 'alertCircle' : 'check'} />
                {preview.errorCount > 0
                  ? t('csv.errors', { n: preview.errorCount })
                  : t('csv.valid', { n: preview.validRows })}
              </span>
              <span className="help">{fileName}</span>
            </div>

            {preview.errors.length > 0 ? (
              <div className="csv-errors" style={{ marginTop: 12 }}>
                {preview.errors.slice(0, 12).map((error, index) => (
                  <div className="csv-error" key={`${error.row}-${index}`}>
                    <strong>{t('csv.rowWord', { n: error.row })}</strong>
                    <span>{error.message}</span>
                  </div>
                ))}
                <p className="help">{t('csv.fixFirst')}</p>
              </div>
            ) : null}

            {preview.warnings.length > 0 ? (
              <div className="csv-errors" style={{ marginTop: 12 }}>
                {preview.warnings.slice(0, 8).map((warning, index) => (
                  <div className="csv-error is-warning" key={`${warning.row}-${index}`}>
                    <strong>{t('csv.rowWord', { n: warning.row })}</strong>
                    <span>{warning.message}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="modal-note" style={{ marginTop: 12 }}>
              <Icon name="shield" />
              <span>{t('csv.snapshot')}</span>
            </div>
          </>
        )}
      </div>
      <div className="modal-foot">
        {preview ? (
          <>
            <button className="btn btn-ghost" type="button" onClick={() => setPreview(null)}>
              {t('csv.another')}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy || preview.errorCount > 0 || preview.validRows === 0}
              onClick={() => void commit()}
            >
              {busy ? <Icon name="loader" className="spin" /> : <Icon name="check" />}
              {busy ? t('csv.importing') : t('csv.commit', { n: preview.validRows })}
            </button>
          </>
        ) : (
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            {t('action.cancel')}
          </button>
        )}
      </div>
    </Modal>
  );
}

export default function CrewDetail({ id }: { id: string }) {
  const { t, locale } = useLocale();
  const toast = useToast();
  const [crew, setCrew] = useState<CrewInfo | null>(null);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [missing, setMissing] = useState(false);
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState<'' | Language>('');
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<WorkerRow | null>(null);

  const load = useCallback(async () => {
    try {
      const [crewResult, workerResult] = await Promise.all([
        api<CrewInfo>(`/api/v1/crews/${id}`),
        api<WorkerRow[]>(`/api/v1/crews/${id}/workers?limit=200`),
      ]);
      setCrew(crewResult.data);
      setWorkers(workerResult.data);
      setMissing(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setMissing(true);
      } else {
        toast(errorMessage(error), true);
      }
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const languages = useMemo(() => {
    const set = new Set<Language>();
    for (const worker of workers) set.add(worker.language);
    return LANGUAGES.filter((code) => set.has(code));
  }, [workers]);

  const filtered = workers.filter((worker) => {
    const matchesSearch = !search.trim() || worker.name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesLanguage = !language || worker.language === language;
    return matchesSearch && matchesLanguage;
  });

  if (missing) {
    return (
      <EmptyState icon="users" title={t('crew.notFound')}>
        <button className="btn btn-ghost" type="button" onClick={() => navigate('/crews')}>
          <Icon name="arrowLeft" />
          {t('action.back')}
        </button>
      </EmptyState>
    );
  }

  if (!crew) {
    return (
      <div className="boot" style={{ minHeight: '50vh' }}>
        <span className="sync">
          <span className="pulse" />
          {t('crew.loading')}
        </span>
      </div>
    );
  }

  return (
    <>
      <PageHead
        eyebrow={
          <>
            <a href="/crews" onClick={(event) => { event.preventDefault(); navigate('/crews'); }}>
              {t('nav.crews')}
            </a>
          </>
        }
        title={crew.name}
        sub={
          <>
            {t('meta.workers', { n: crew.counts.workers })} · {t('meta.languages', { n: languages.length })}
          </>
        }
        actions={
          <>
            <button className="btn btn-ghost" type="button" onClick={() => setImportOpen(true)}>
              <Icon name="file" />
              {t('crew.import')}
            </button>
            <button className="btn btn-primary" type="button" onClick={() => setAddOpen(true)}>
              <Icon name="plus" />
              {t('crew.addWorker')}
            </button>
          </>
        }
      />

      <div className="table-card">
        <div className="table-toolbar">
          <div className="search">
            <Icon name="search" />
            <input
              type="search"
              value={search}
              placeholder={t('crew.search')}
              aria-label={t('crew.search')}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="select"
            value={language}
            style={{ width: 'auto', height: 34, fontSize: 11.5 }}
            aria-label={t('crew.allLangs')}
            onChange={(event) => setLanguage(event.target.value as '' | Language)}
          >
            <option value="">{t('crew.allLangs')}</option>
            {languages.map((code) => (
              <option value={code} key={code}>
                {LANGUAGE_META[code].nativeLabel}
              </option>
            ))}
          </select>
          <span className="spacer" />
          <span className="help">{t('meta.workers', { n: filtered.length })}</span>
        </div>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>{t('table.worker')}</th>
                <th>{t('table.language')}</th>
                <th>{t('table.phone')}</th>
                <th>{t('table.added')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((worker) => (
                <tr key={worker.id}>
                  <td>
                    <div className="cell-user">
                      <span className="avatar avatar-sm">{initials(worker.name)}</span>
                      <span className="name">{worker.name}</span>
                    </div>
                  </td>
                  <td>
                    <LangCell language={worker.language} />
                  </td>
                  <td className="tnum">{worker.phoneE164 ?? '—'}</td>
                  <td className="tnum">{fmtDate(worker.createdAt, locale)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        type="button"
                        aria-label={t('crew.editWorker')}
                        onClick={() => setEditing(worker)}
                      >
                        <Icon name="edit" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">
                      <div className="e-ic">
                        <Icon name="users" />
                      </div>
                      <strong>{t('crew.empty')}</strong>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>
            {filtered.length === workers.length
              ? t('meta.workers', { n: workers.length })
              : `${filtered.length} / ${workers.length}`}
          </span>
          <span>
            {t('table.phone')} · {t('worker.phoneHelp')}
          </span>
        </div>
      </div>

      {addOpen ? (
        <WorkerModal
          crewId={crew.id}
          crewName={crew.name}
          worker={null}
          onClose={() => setAddOpen(false)}
          onSaved={async () => {
            await load();
          }}
        />
      ) : null}

      {editing ? (
        <WorkerModal
          crewId={crew.id}
          crewName={crew.name}
          worker={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await load();
          }}
        />
      ) : null}

      {importOpen ? (
        <ImportModal
          crewId={crew.id}
          onClose={() => setImportOpen(false)}
          onImported={async () => {
            await load();
          }}
        />
      ) : null}
    </>
  );
}
