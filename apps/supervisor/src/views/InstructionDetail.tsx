import { useCallback, useEffect, useState } from 'react';
import { LANGUAGE_META, type Language } from '@understood/shared';
import type {
  Bilingual,
  DeliveryCounts,
  DeliveryRow,
  InstructionDetail as DetailType,
  InstructionStatusPayload,
  Question,
  VariantView,
} from '../types';
import { ApiError, api, download, errorMessage } from '../api';
import { Modal, Sheet, fmtDate, initials, navigate, timeAgo, useLocale, useToast } from '../ui';
import { Icon } from '../icons';
import { LangCell, PageHead, StatusChip, reasonKey } from '../components';

const STAGES = ['translate', 'question', 'audio'] as const;

function clock(seconds: number | null): string {
  if (seconds == null) return '';
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function DeliveryPill({ status }: { status: string }) {
  const { t } = useLocale();
  const map: Record<string, { tone: string; icon: string; key: string }> = {
    pending: { tone: 'pill-slate', icon: 'clock', key: 'status.pending' },
    opened: { tone: 'pill-blue', icon: 'eye', key: 'status.opened' },
    answered: { tone: 'pill-blue', icon: 'check', key: 'status.answered' },
    completed: { tone: 'pill-green', icon: 'checkCircle', key: 'status.completed' },
  };
  const entry = map[status] ?? map.pending!;
  return (
    <span className={`pill ${entry.tone}`}>
      <Icon name={entry.icon} />
      {t(entry.key)}
    </span>
  );
}

function ShareDrawer({
  detail,
  onClose,
  onChanged,
}: {
  detail: DetailType;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { t, locale } = useLocale();
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<Bilingual | null>(null);
  const [reminder, setReminder] = useState<Bilingual | null>(null);
  const [acceptTextOnly, setAcceptTextOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const shared = detail.status === 'shared' || detail.status === 'archived';

  useEffect(() => {
    if (!shared) return;
    let live = true;
    void (async () => {
      try {
        const { data } = await api<{ url: string; whatsappMessage: Bilingual; reminderMessage: Bilingual }>(
          `/api/v1/instructions/${detail.id}/share-link`,
        );
        if (!live) return;
        setLink(data.url);
        setMessage(data.whatsappMessage);
        setReminder(data.reminderMessage);
      } catch (error) {
        toast(errorMessage(error), true);
      }
    })();
    return () => {
      live = false;
    };
  }, [shared, detail.id]);

  const copy = async (value: string, successKey: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(t(successKey));
    } catch {
      toast(t('action.copied'));
    }
  };

  const shareNow = async () => {
    setBusy(true);
    try {
      const { data } = await api<{ url: string; whatsappMessage: Bilingual; deliveriesCreated: number }>(
        `/api/v1/instructions/${detail.id}/share`,
        {
          method: 'POST',
          body: detail.status === 'partial_failure' ? { acceptTextOnly } : {},
        },
      );
      setLink(data.url);
      setMessage(data.whatsappMessage);
      setReminder(null);
      toast(t('share.live', { n: data.deliveriesCreated }));
      await onChanged();
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    if (!window.confirm(t('board.regenerateConfirm'))) return;
    setBusy(true);
    try {
      const { data } = await api<{ url: string }>(`/api/v1/instructions/${detail.id}/regenerate-link`, {
        method: 'POST',
      });
      setLink(data.url);
      toast(t('toast.newLink'));
      await onChanged();
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };

  const openWorker = async () => {
    if (link) {
      window.open(link, '_blank', 'noopener');
      return;
    }
    try {
      const { data } = await api<{ url: string }>(`/api/v1/instructions/${detail.id}/preview-token`, {
        method: 'POST',
      });
      window.open(data.url, '_blank', 'noopener');
    } catch (error) {
      toast(errorMessage(error), true);
    }
  };

  return (
    <Sheet onClose={onClose}>
      <div className="drawer-head">
        <div>
          <h2>{t('preview.shareDrawer')}</h2>
          <p>{t('preview.shareSub')}</p>
        </div>
        <button className="icon-btn" type="button" aria-label={t('action.close')} onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <div className="drawer-body">
        {shared ? (
          <div className="link-live">
            <Icon name="checkCircle" />
            <span>
              <strong>{t('status.shared')}</strong> · {t('preview.linkLive', { n: detail.audienceCount })}
            </span>
          </div>
        ) : null}

        <div>
          <div className="label" style={{ marginBottom: 7 }}>
            {t('preview.link')}
          </div>
          {link ? (
            <div className="link-box">
              <span className="link">{link.replace(/^https?:\/\//, '')}</span>
              <button className="btn btn-sm btn-ghost" type="button" onClick={() => void copy(link, 'share.copiedLink')}>
                <Icon name="copy" />
                {t('action.copy')}
              </button>
            </div>
          ) : (
            <p className="help">{t('preview.notShared')}</p>
          )}
        </div>

        {message ? (
          <div>
            <div className="label" style={{ marginBottom: 7 }}>
              {t('preview.whatsapp')}
            </div>
            <div className="wa-preview">
              <div className="wa-head">
                <Icon name="message" />
                WhatsApp
              </div>
              <div className="wa-msg" dir="ltr">
                {message[locale]}
              </div>
              <div className="wa-foot">
                <button
                  className="btn btn-sm btn-ghost"
                  type="button"
                  style={{ marginInlineStart: 'auto' }}
                  onClick={() => void copy(message[locale], 'share.copiedMsg')}
                >
                  <Icon name="copy" />
                  {t('preview.copyMsg')}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {reminder ? (
          <button className="btn btn-ghost btn-full" type="button" onClick={() => void copy(reminder[locale], 'board.reminderCopied')}>
            <Icon name="message" />
            {t('board.reminder')}
          </button>
        ) : null}

        <div className="audience-summary">
          <Icon name="users" />
          <span>
            {t('detail.audienceCount', { n: detail.audienceCount })} · {t('meta.languages', { n: detail.variants.length })}
          </span>
        </div>
      </div>

      <div className="drawer-foot">
        {!shared ? (
          <>
            {detail.status === 'partial_failure' ? (
              <label className="worker-check">
                <input
                  type="checkbox"
                  checked={acceptTextOnly}
                  onChange={(event) => setAcceptTextOnly(event.target.checked)}
                />
                <span>{t('detail.acceptTextOnly')}</span>
              </label>
            ) : null}
            <button
              className="btn btn-primary btn-full btn-lg"
              type="button"
              disabled={busy || (detail.status === 'partial_failure' && !acceptTextOnly)}
              onClick={() => void shareNow()}
            >
              {busy ? <Icon name="loader" className="spin" /> : <Icon name="share" />}
              {t('preview.shareNow')}
            </button>
            <button className="btn btn-ghost btn-full" type="button" onClick={() => void openWorker()}>
              <Icon name="external" />
              {t('preview.openWorker')}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primary btn-full" type="button" onClick={() => void openWorker()}>
              <Icon name="external" />
              {t('detail.workerView')}
            </button>
            <button className="btn btn-ghost btn-full" type="button" disabled={busy} onClick={() => void regenerate()}>
              <Icon name="refresh" />
              {t('preview.regenerateLink')}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function QuestionEditor({
  variant,
  onClose,
  onSaved,
}: {
  variant: VariantView;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useLocale();
  const toast = useToast();
  const existing = variant.question;
  const [question, setQuestion] = useState(existing?.text ?? '');
  const [options, setOptions] = useState<[string, string, string]>(
    existing ? [...existing.options] : ['', '', ''],
  );
  const [correctIndex, setCorrectIndex] = useState<0 | 1 | 2>(existing?.correctIndex ?? 0);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const payload: Question = {
        text: question.trim(),
        options: options.map((option) => option.trim()) as [string, string, string],
        correctIndex,
        source: 'manual',
      };
      await api(`/api/v1/variants/${variant.id}`, { method: 'PATCH', body: { question: payload } });
      toast(t('detail.questionSaved'));
      await onSaved();
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
          <h2>{t('detail.questionTitle')}</h2>
          <p>{t('detail.questionSub')}</p>
        </div>
        <button className="icon-btn" type="button" aria-label={t('action.close')} onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <div className="modal-body">
        <div className="field">
          <label>{t('detail.questionText')}</label>
          <input
            className="input"
            value={question}
            maxLength={140}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </div>
        {options.map((option, index) => (
          <div className="field" key={index}>
            <label>{t('detail.option', { n: index + 1 })}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="input"
                value={option}
                maxLength={60}
                onChange={(event) =>
                  setOptions((current) => {
                    const next = [...current] as [string, string, string];
                    next[index] = event.target.value;
                    return next;
                  })
                }
              />
              <label className="worker-check" style={{ flex: 'none' }}>
                <input
                  type="radio"
                  name="correct-option"
                  checked={correctIndex === index}
                  onChange={() => setCorrectIndex(index as 0 | 1 | 2)}
                />
                <span>{t('detail.correctOption')}</span>
              </label>
            </div>
          </div>
        ))}
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          {t('action.cancel')}
        </button>
        <button
          className="btn btn-primary"
          type="button"
          disabled={busy || !question.trim() || options.some((option) => !option.trim())}
          onClick={() => void save()}
        >
          {busy ? <Icon name="loader" className="spin" /> : null}
          {t('action.save')}
        </button>
      </div>
    </Modal>
  );
}

export default function InstructionDetail({ id }: { id: string }) {
  const { t, locale } = useLocale();
  const toast = useToast();
  const [detail, setDetail] = useState<DetailType | null>(null);
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState<InstructionStatusPayload | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [counts, setCounts] = useState<DeliveryCounts | null>(null);
  const [filter, setFilter] = useState<'all' | 'not_opened' | 'wrong' | 'needs_help'>('all');
  const [view, setView] = useState<'board' | 'preview'>('preview');
  const [shareOpen, setShareOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<VariantView | null>(null);
  const [editText, setEditText] = useState('');
  const [questionVariant, setQuestionVariant] = useState<VariantView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadDetail = useCallback(async (): Promise<DetailType | null> => {
    try {
      const { data } = await api<DetailType>(`/api/v1/instructions/${id}`);
      setDetail(data);
      setMissing(false);
      if (data.status === 'shared' || data.status === 'archived') setView('board');
      return data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setMissing(true);
      } else {
        toast(errorMessage(error), true);
      }
      return null;
    }
  }, [id]);

  const loadDeliveries = useCallback(
    async (nextFilter: 'all' | 'not_opened' | 'wrong' | 'needs_help') => {
      try {
        const { data, meta } = await api<DeliveryRow[]>(
          `/api/v1/instructions/${id}/deliveries?filter=${nextFilter}`,
        );
        setDeliveries(data);
        const summary = (meta as { counts?: DeliveryCounts }).counts;
        if (summary) setCounts(summary);
      } catch {
        // transient
      }
    },
    [id],
  );

  useEffect(() => {
    setDetail(null);
    setMissing(false);
    setDeliveries([]);
    setCounts(null);
    setStatus(null);
    setFilter('all');
    void loadDetail().then((data) => {
      if (data && (data.status === 'shared' || data.status === 'archived')) void loadDeliveries('all');
    });
  }, [id, loadDetail, loadDeliveries]);

  useEffect(() => {
    if (!detail || (detail.status !== 'shared' && detail.status !== 'archived')) return;
    void loadDeliveries(filter);
  }, [filter, detail?.status, loadDeliveries]);

  useEffect(() => {
    if (!detail) return;
    const poll =
      detail.status === 'processing' ||
      (detail.content.kind === 'voice' && detail.content.transcriptStatus === 'pending');
    if (!poll) return;
    let live = true;
    const handle = window.setInterval(() => {
      void (async () => {
        try {
          const { data } = await api<InstructionStatusPayload>(`/api/v1/instructions/${id}/status`);
          if (!live) return;
          setStatus(data);
          if (data.status !== 'processing' && data.status !== 'draft') {
            const fresh = await loadDetail();
            if (fresh && (fresh.status === 'shared' || fresh.status === 'archived')) void loadDeliveries(filter);
          }
        } catch {
          // keep polling
        }
      })();
    }, 1800);
    return () => {
      live = false;
      window.clearInterval(handle);
    };
  }, [detail?.status, detail?.content.kind, detail?.content.transcriptStatus, id]);

  useEffect(() => {
    if (!detail || (detail.status !== 'shared' && detail.status !== 'archived')) return;
    const handle = window.setInterval(() => {
      void loadDeliveries(filter);
    }, 15000);
    return () => window.clearInterval(handle);
  }, [detail?.status, filter, loadDeliveries]);

  const resolveHelp = async (delivery: DeliveryRow) => {
    setBusy(delivery.deliveryId);
    try {
      await api(`/api/v1/deliveries/${delivery.deliveryId}/resolve-help`, { method: 'POST' });
      toast(t('board.resolvedToast', { name: delivery.worker.name }));
      await loadDeliveries(filter);
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    try {
      const { data } = await api<{ url: string }>(`/api/v1/instructions/${id}/share-link`);
      await navigator.clipboard.writeText(data.url);
      toast(t('share.copiedLink'));
    } catch (error) {
      toast(errorMessage(error), true);
    }
  };

  const copyReminder = async () => {
    try {
      const { data } = await api<{ reminderMessage: Bilingual; whatsappMessage: Bilingual }>(
        `/api/v1/instructions/${id}/share-link`,
      );
      await navigator.clipboard.writeText(data.reminderMessage[locale] || data.whatsappMessage[locale]);
      toast(t('board.reminderCopied'));
    } catch (error) {
      toast(errorMessage(error), true);
    }
  };

  const exportInstruction = async () => {
    try {
      await download(
        `/api/v1/exports/instructions/${id}.csv?includeHelpReasons=true&includeTimes=true`,
        `understood_instruction_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      toast(t('toast.exported'));
    } catch (error) {
      toast(errorMessage(error), true);
    }
  };

  const archive = async () => {
    if (!window.confirm(t('detail.archiveConfirm'))) return;
    try {
      await api(`/api/v1/instructions/${id}/archive`, { method: 'POST' });
      toast(t('board.archivedToast'));
      await loadDetail();
    } catch (error) {
      toast(errorMessage(error), true);
    }
  };

  const deleteDraft = async () => {
    if (!window.confirm(t('detail.deleteDraftConfirm'))) return;
    try {
      await api(`/api/v1/instructions/${id}`, { method: 'DELETE' });
      toast(t('detail.deleted'));
      navigate('/instructions');
    } catch (error) {
      toast(errorMessage(error), true);
    }
  };

  const saveVariant = async (variant: VariantView) => {
    if (!editText.trim()) return;
    setBusy(variant.id);
    try {
      await api(`/api/v1/variants/${variant.id}`, { method: 'PATCH', body: { text: editText.trim() } });
      setEditingVariant(null);
      toast(t('detail.variantSaved'));
      await loadDetail();
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setBusy(null);
    }
  };

  const regenerateVariant = async (variant: VariantView) => {
    if (!window.confirm(t('detail.regenerateConfirm'))) return;
    setBusy(variant.id);
    try {
      await api(`/api/v1/variants/${variant.id}/regenerate`, { method: 'POST' });
      await loadDetail();
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setBusy(null);
    }
  };

  if (missing) {
    return (
      <div className="card empty">
        <div className="e-ic">
          <Icon name="doc" />
        </div>
        <strong>{t('detail.notFound')}</strong>
        <button className="btn btn-ghost" type="button" onClick={() => navigate('/instructions')}>
          <Icon name="arrowLeft" />
          {t('action.back')}
        </button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="boot" style={{ minHeight: '50vh' }}>
        <span className="sync">
          <span className="pulse" />
          {t('detail.loading')}
        </span>
      </div>
    );
  }

  const isBoard = detail.status === 'shared' || detail.status === 'archived';
  const isEditable = detail.status === 'ready' || detail.status === 'partial_failure';
  const languages = detail.variants.map((variant) => variant.language);

  const actions = (
    <>
      <button className="btn btn-ghost" type="button" onClick={() => navigate('/instructions')}>
        <Icon name="arrowLeft" />
        {t('action.back')}
      </button>
      {detail.status === 'draft' ? (
        <>
          <button className="btn btn-primary" type="button" onClick={() => navigate(`/new?id=${detail.id}`)}>
            <Icon name="edit" />
            {t('detail.resume')}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => void deleteDraft()}>
            <Icon name="x" />
            {t('detail.deleteDraft')}
          </button>
        </>
      ) : null}
      {isEditable ? (
        <button className="btn btn-primary" type="button" onClick={() => setShareOpen(true)}>
          <Icon name="share" />
          {t('detail.shareReady')}
        </button>
      ) : null}
      {isBoard ? (
        <>
          <button className="btn btn-ghost" type="button" onClick={() => void copyLink()}>
            <Icon name="copy" />
            {t('board.copyLink')}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => void copyReminder()}>
            <Icon name="message" />
            {t('board.reminder')}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => void exportInstruction()}>
            <Icon name="download" />
            {t('board.export')}
          </button>
          {detail.status === 'shared' ? (
            <button className="btn btn-ghost" type="button" onClick={() => void archive()}>
              <Icon name="lock" />
              {t('board.archive')}
            </button>
          ) : null}
        </>
      ) : null}
    </>
  );

  const stageOf = (language: Language, stage: (typeof STAGES)[number]) => {
    if (status?.stages?.[stage]?.[language]) return status.stages[stage][language];
    const variant = detail.variants.find((entry) => entry.language === language);
    return variant?.stages[stage] ?? 'pending';
  };

  const editable = view === 'preview' || !isBoard;
  const showBoard = isBoard && view === 'board';

  return (
    <>
      <PageHead
        eyebrow={
          <>
            {t('nav.instructions')} · <StatusChip status={detail.status} />
          </>
        }
        title={detail.title ?? t('instr.untitled')}
        sub={
          <>
            {t('detail.audienceCount', { n: detail.audienceCount })} · {t('meta.languages', { n: detail.variants.length })}
            {detail.share.sharedAt ? ` · ${fmtDate(detail.share.sharedAt, locale, true)}` : ''}
            {detail.status === 'archived' ? ` · ${t('detail.readonly')}` : ''}
          </>
        }
        actions={actions}
      />

      {isBoard ? (
        <div className="tabs">
          <button
            className={`tab${view === 'board' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setView('board')}
          >
            {t('detail.board')}
          </button>
          <button
            className={`tab${view === 'preview' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setView('preview')}
          >
            {t('detail.preview')}
          </button>
        </div>
      ) : null}

      {detail.status === 'draft' ? (
        <div className="card card-pad" style={{ maxWidth: 760 }}>
          <p className="sub" style={{ marginTop: 0 }}>
            {t('detail.draftNote')}
          </p>
          {detail.content.kind === 'voice' ? (
            <div className="q-recap">
              <strong>
                <Icon name="mic" /> {t('detail.voiceNote')} {detail.content.durationS ? `· ${clock(detail.content.durationS)}` : ''}
              </strong>
              {detail.content.transcriptStatus === 'pending' ? (
                <p className="help">{t('detail.transcribing')}</p>
              ) : null}
              {detail.content.transcriptStatus === 'failed' ? (
                <p className="help">{t('detail.transcriptFailed')}</p>
              ) : null}
              <p className="variant-text" style={{ marginTop: 8 }}>
                {detail.content.transcript ?? detail.content.text ?? '—'}
              </p>
            </div>
          ) : detail.content.kind === 'photo' ? (
            <div className="q-recap">
              <strong>
                <Icon name="file" /> {t('detail.photo')}
              </strong>
              <p className="variant-text" style={{ marginTop: 8 }}>
                {detail.content.text ?? '—'}
              </p>
            </div>
          ) : (
            <p className="variant-text">{detail.content.text ?? '—'}</p>
          )}
        </div>
      ) : null}

      {detail.status === 'processing' ? (
        <div className="card card-pad">
          <div className="proc-head" style={{ marginBottom: 14 }}>
            <div className="proc-orb">
              <Icon name="sparkles" />
            </div>
            <h2>{t('processing.title', { n: Math.max(languages.length, 1) })}</h2>
            <p>{t('processing.sub')}</p>
          </div>
          {detail.content.kind === 'voice' && detail.content.transcriptStatus === 'pending' ? (
            <div className="helper-line" style={{ marginBottom: 12 }}>
              <span className="chip">
                <Icon name="loader" className="spin" />
                {t('detail.transcribing')}
              </span>
            </div>
          ) : null}
          <div className="stage-grid">
            {languages.map((language) => (
              <div className="stage-row" key={language}>
                <strong style={{ fontSize: 12 }}>{LANGUAGE_META[language].nativeLabel}</strong>
                {STAGES.map((stage) => {
                  const value = stageOf(language, stage);
                  return (
                    <span className={`stage-pill ${value}`} key={stage}>
                      {t(`processing.${stage}`)}
                    </span>
                  );
                })}
              </div>
            ))}
            {languages.length === 0 ? <p className="help">{t('detail.noVariants')}</p> : null}
          </div>
          {status?.error ? <p className="help" style={{ marginTop: 12 }}>{status.error.message}</p> : null}
        </div>
      ) : null}

      {detail.status === 'ready' || detail.status === 'partial_failure' || (isBoard && view === 'preview') ? (
        <>
          <div className="card original-card">
            <div className="original-head">
              <h3>{t('preview.original')}</h3>
              <span className="chip">
                <Icon name={detail.content.kind === 'voice' ? 'mic' : detail.content.kind === 'photo' ? 'file' : 'doc'} />
                {detail.content.kind === 'voice'
                  ? t('detail.voiceNote')
                  : detail.content.kind === 'photo'
                    ? t('detail.photo')
                    : t('composer.text')}
              </span>
            </div>
            <p className="original-text">{detail.content.text ?? detail.content.transcript ?? '—'}</p>
          </div>

          {detail.variants.length === 0 ? (
            <p className="help">{t('detail.noVariants')}</p>
          ) : (
            <div className={`variant-grid${editable && isEditable ? '' : ' is-readonly'}`}>
              {detail.variants.map((variant) => {
                const meta = LANGUAGE_META[variant.language];
                const editing = editingVariant?.id === variant.id;
                return (
                  <article className="variant" key={variant.id}>
                    <div className="var-head">
                      <span className="var-script">{meta.nativeLabel.charAt(0)}</span>
                      <span>
                        <span className="var-name">{meta.nativeLabel}</span>
                        <span className="var-sub">
                          {meta.dir === 'rtl' ? 'RTL' : 'LTR'}
                          {variant.audioDurationS ? ` · ${clock(variant.audioDurationS)}` : ''}
                        </span>
                      </span>
                      <span className={`pill ${variant.status === 'ready' ? 'pill-green' : variant.status === 'failed' ? 'pill-red' : variant.status === 'text_only' ? 'pill-amber' : 'pill-slate'}`}>
                        <Icon
                          name={
                            variant.status === 'ready'
                              ? 'check'
                              : variant.status === 'failed'
                                ? 'alertCircle'
                                : variant.status === 'text_only'
                                  ? 'alertTriangle'
                                  : 'loader'
                          }
                          className={variant.status === 'processing' || variant.status === 'pending' ? 'spin' : undefined}
                        />
                        {variant.status === 'ready'
                          ? t('status.ready')
                          : variant.status === 'failed'
                            ? t('status.partial')
                            : variant.status === 'text_only'
                              ? t('status.ready')
                              : t('status.processing')}
                      </span>
                    </div>
                    <div className="var-body">
                      {variant.hasAudio ? (
                        <audio
                          controls
                          preload="none"
                          src={`/api/v1/variants/${variant.id}/audio`}
                          style={{ width: '100%', marginBottom: 12 }}
                        />
                      ) : variant.audioStatus === 'failed' ? (
                        <span className="pill pill-red" style={{ marginBottom: 12 }}>
                          <Icon name="alertCircle" />
                          {t('processing.audio')}
                        </span>
                      ) : null}
                      <div className={`var-text lang-${meta.code}`} dir={meta.dir} lang={variant.language}>
                        {variant.text ?? '—'}
                      </div>
                      {variant.question ? (
                        <div className="q-block">
                          <div className="q-label">
                            <Icon name="help" />
                            {t('preview.question')}
                          </div>
                          <div className="q-text">{variant.question.text}</div>
                          <div className="q-opts">
                            {variant.question.options.map((option, index) => {
                              const correct = index === variant.question!.correctIndex;
                              return (
                                <div className={`q-opt${correct ? ' is-correct' : ''}`} key={index}>
                                  <span className="letter">{index + 1}</span>
                                  <span>{option}</span>
                                  {correct ? <span className="correct-flag">{t('preview.correct')}</span> : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="help">{t('status.processing')}</p>
                      )}
                      {variant.lastError ? <p className="help">{variant.lastError.message}</p> : null}
                    </div>

                    {editing ? (
                      <div className="var-edit">
                        <textarea
                          dir={meta.dir}
                          className="transcript-edit"
                          value={editText}
                          maxLength={2000}
                          onChange={(event) => setEditText(event.target.value)}
                        />
                        <div className="row">
                          <button className="btn btn-sm btn-ghost" type="button" onClick={() => setEditingVariant(null)}>
                            {t('action.cancel')}
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            type="button"
                            disabled={busy === variant.id || !editText.trim()}
                            onClick={() => void saveVariant(variant)}
                          >
                            {busy === variant.id ? <Icon name="loader" className="spin" /> : null}
                            {t('action.save')}
                          </button>
                        </div>
                        <p className="help">{t('preview.audioUpdated', { lang: meta.nativeLabel })}</p>
                      </div>
                    ) : null}

                    {isEditable ? (
                      <div className="var-foot">
                        <span className="spacer" />
                        <button
                          className="btn btn-sm btn-ghost"
                          type="button"
                          onClick={() => {
                            setEditingVariant(variant);
                            setEditText(variant.text ?? '');
                          }}
                        >
                          <Icon name="edit" />
                          {t('preview.edit')}
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          type="button"
                          onClick={() => setQuestionVariant(variant)}
                        >
                          <Icon name="help" />
                          {t('preview.editQ')}
                        </button>
                        <button
                          className="btn btn-sm btn-subtle"
                          type="button"
                          disabled={busy === variant.id}
                          onClick={() => void regenerateVariant(variant)}
                        >
                          <Icon name="refresh" />
                          {t('preview.regenerate')}
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {showBoard ? (
        <>
          {detail.status === 'archived' ? <div className="banner-note">{t('detail.readonly')}</div> : null}

          <div className="board-kpis">
            <div className="board-kpi">
              <div className="bk-label">
                <Icon name="users" />
                {t('board.kpi.targeted')}
              </div>
              <div className="bk-val">{counts?.targeted ?? detail.audienceCount}</div>
              <div className="bk-sub">{t('detail.languages')} · {detail.variants.length}</div>
            </div>
            <div className="board-kpi">
              <div className="bk-label">
                <Icon name="eye" />
                {t('board.kpi.opened')}
              </div>
              <div className="bk-val">
                {counts?.opened ?? 0} <small>/ {counts?.targeted ?? detail.audienceCount}</small>
              </div>
              <div className="meter">
                <div
                  className="meter-fill"
                  style={{
                    width: `${
                      counts && counts.targeted > 0 ? Math.round((counts.opened / counts.targeted) * 100) : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div className="board-kpi">
              <div className="bk-label">
                <Icon name="checkCircle" />
                {t('board.kpi.understood')}
              </div>
              <div className="bk-val">
                {counts && counts.targeted > 0 ? Math.round((counts.understood / counts.targeted) * 100) : 0}%
              </div>
              <div className="bk-sub">
                {counts?.understood ?? 0} {t('kpi.of')} {counts?.targeted ?? detail.audienceCount} · {t('board.kpi.understoodSub')}
              </div>
              <div className="meter">
                <div
                  className="meter-fill is-green"
                  style={{
                    width: `${
                      counts && counts.targeted > 0 ? Math.round((counts.understood / counts.targeted) * 100) : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div className="board-kpi">
              <div className="bk-label">
                <Icon name="alertCircle" />
                {t('board.kpi.needsHelp')}
              </div>
              <div className="bk-val">{counts?.needsHelp ?? 0}</div>
              <div className="bk-sub">{t('board.kpi.helpSub', { n: counts?.needsHelp ?? 0 })}</div>
            </div>
          </div>

          <div className="board-section-head">
            <h2>
              <Icon name="alertTriangle" />
              {t('board.attention')}
            </h2>
            <span className="help">{t('board.attentionSub')}</span>
          </div>

          {deliveries.some((delivery) => delivery.help.requested && !delivery.help.resolvedAt) ||
          deliveries.some((delivery) => delivery.status === 'pending') ||
          deliveries.some((delivery) => delivery.firstAttemptCorrect === false) ? (
            <div className="board-exceptions">
              {deliveries
                .filter((delivery) => delivery.help.requested && !delivery.help.resolvedAt)
                .map((delivery) => (
                  <div className="bex" key={delivery.deliveryId}>
                    <span className="avatar avatar-sm">{initials(delivery.worker.name)}</span>
                    <div className="bex-main">
                      <strong>
                        {delivery.worker.name}{' '}
                        <span className="pill pill-amber">
                          <Icon name="alertCircle" />
                          {t('status.help')}
                        </span>
                      </strong>
                      <p>
                        {t(reasonKey(delivery.help.reason))}
                        {delivery.help.requestedAt ? ` · ${fmtDate(delivery.help.requestedAt, locale, true)}` : ''}
                      </p>
                      <div className="bex-foot">
                        <button
                          className="btn btn-sm btn-ghost"
                          type="button"
                          disabled={busy === delivery.deliveryId}
                          onClick={() => void resolveHelp(delivery)}
                        >
                          <Icon name="check" />
                          {t('action.markResolved')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              {deliveries
                .filter((delivery) => delivery.status === 'pending')
                .map((delivery) => (
                  <div className="bex blue" key={delivery.deliveryId}>
                    <span className="avatar avatar-sm">{initials(delivery.worker.name)}</span>
                    <div className="bex-main">
                      <strong>
                        {delivery.worker.name}{' '}
                        <span className="pill pill-blue">
                          <Icon name="clock" />
                          {t('status.pending')}
                        </span>
                      </strong>
                      <p>{t('board.pendingSince', { when: timeAgo(detail.share.sharedAt, locale) })}</p>
                      <div className="bex-foot">
                        <button className="btn btn-sm btn-ghost" type="button" onClick={() => void copyReminder()}>
                          <Icon name="message" />
                          {t('action.reminder')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              {deliveries
                .filter((delivery) => delivery.firstAttemptCorrect === false)
                .map((delivery) => (
                  <div className="bex red" key={delivery.deliveryId}>
                    <span className="avatar avatar-sm">{initials(delivery.worker.name)}</span>
                    <div className="bex-main">
                      <strong>
                        {delivery.worker.name}{' '}
                        <span className="pill pill-red">
                          <Icon name="x" />
                          {t('board.wrong')}
                        </span>
                      </strong>
                      <p>
                        {t('board.firstAttempt')}
                        {delivery.answeredAt ? ` · ${fmtDate(delivery.answeredAt, locale, true)}` : ''}
                      </p>
                      <div className="bex-foot">
                        <button className="btn btn-sm btn-ghost" type="button" onClick={() => setFilter('wrong')}>
                          <Icon name="filter" />
                          {t('board.filter.wrong')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="card empty">
              <Icon name="checkCircle" />
              <strong>{t('board.noExceptions')}</strong>
            </div>
          )}

          <div className="table-card">
            <div className="table-toolbar">
              <h3 style={{ fontSize: 13, fontWeight: 650, marginInlineEnd: 6 }}>{t('board.workers')}</h3>
              <div className="filter-chips">
                {(
                  [
                    ['all', t('board.filter.all'), counts?.targeted ?? deliveries.length],
                    ['not_opened', t('board.filter.notOpened'), counts?.notOpened ?? 0],
                    ['wrong', t('board.filter.wrong'), counts?.wrong ?? 0],
                    ['needs_help', t('board.filter.needsHelp'), counts?.needsHelp ?? 0],
                  ] as const
                ).map(([key, label, count]) => (
                  <button
                    className={`filter-chip${filter === key ? ' is-active' : ''}`}
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                  >
                    {label}
                    <span className="n">{count}</span>
                  </button>
                ))}
              </div>
              <span className="spacer" />
              <span className="help">
                <Icon name="refresh" /> {t('detail.refreshing')}
              </span>
            </div>
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('table.worker')}</th>
                    <th>{t('table.language')}</th>
                    <th>{t('table.status')}</th>
                    <th>{t('table.first')}</th>
                    <th>{t('table.help')}</th>
                    <th>{t('table.opened')}</th>
                    <th>{t('table.completed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr key={delivery.deliveryId}>
                      <td>
                        <div className="cell-user">
                          <span className="avatar avatar-sm">{initials(delivery.worker.name)}</span>
                          <span className="name">{delivery.worker.name}</span>
                        </div>
                      </td>
                      <td>
                        <LangCell language={delivery.worker.language} />
                      </td>
                      <td>
                        <DeliveryPill status={delivery.status} />
                      </td>
                      <td>
                        {delivery.firstAttemptCorrect === true ? (
                          <span className="attempt ok">
                            <Icon name="check" />
                            {t('board.correct')}
                          </span>
                        ) : delivery.firstAttemptCorrect === false ? (
                          <span className="attempt bad">
                            <Icon name="x" />
                            {t('board.wrong')}
                          </span>
                        ) : (
                          <span className="attempt none">{t('board.dash')}</span>
                        )}
                      </td>
                      <td>
                        {delivery.help.requested ? (
                          delivery.help.resolvedAt ? (
                            <span className="pill pill-slate">
                              <Icon name="check" />
                              {t('status.resolved')}
                            </span>
                          ) : (
                            <span className="pill pill-amber">
                              <Icon name="alertCircle" />
                              {t('status.help')}
                            </span>
                          )
                        ) : (
                          <span className="attempt none">{t('board.dash')}</span>
                        )}
                      </td>
                      <td className="tnum">{fmtDate(delivery.openedAt, locale, true)}</td>
                      <td className="tnum">{fmtDate(delivery.completedAt, locale, true)}</td>
                    </tr>
                  ))}
                  {deliveries.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty">
                          <div className="e-ic">
                            <Icon name="search" />
                          </div>
                          <strong>{t('board.empty')}</strong>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="table-foot">
              <span>{t('board.footCount', { shown: deliveries.length, total: counts?.targeted ?? deliveries.length })}</span>
              <span className="live">
                <span className="dot" />
                {t('board.auto')}
              </span>
            </div>
          </div>
        </>
      ) : null}

      {shareOpen ? (
        <ShareDrawer
          detail={detail}
          onClose={() => setShareOpen(false)}
          onChanged={async () => {
            const fresh = await loadDetail();
            if (fresh && (fresh.status === 'shared' || fresh.status === 'archived')) await loadDeliveries('all');
          }}
        />
      ) : null}

      {questionVariant ? (
        <QuestionEditor
          variant={questionVariant}
          onClose={() => setQuestionVariant(null)}
          onSaved={async () => {
            await loadDetail();
          }}
        />
      ) : null}
    </>
  );
}
