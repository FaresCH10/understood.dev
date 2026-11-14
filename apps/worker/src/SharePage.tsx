import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { Language } from '@understood/shared';
import { ApiError, NetworkError, api, bearer } from './api';
import { AudioPlayer } from './AudioPlayer';
import { FONT_CLASS, LANG_ORDER, LETTERS, metaOf, t } from './i18n';
import { Icon } from './icons';
import { enqueueMutation, flushQueue, queuedCount } from './queue';
import { clearSession, loadSession, preferredLanguage, rememberLanguage, saveSession } from './storage';
import type {
  AnswerResponse,
  AudienceEntry,
  Content,
  DeliveryState,
  IdentifyResponse,
  MetaResponse,
  SavedSession,
  StateResponse,
} from './types';

type Phase = 'loading' | 'picker' | 'instruction' | 'completed' | 'help-sent' | 'closed' | 'missing' | 'fatal';
type Sheet = 'lang' | 'help' | null;
type HelpReason = 'dont_understand' | 'missing_tools' | 'safety_concern' | 'other';

const HELP_REASONS: Array<{ key: HelpReason; label: string }> = [
  { key: 'dont_understand', label: 'dontUnderstand' },
  { key: 'missing_tools', label: 'tools' },
  { key: 'safety_concern', label: 'safety' },
  { key: 'other', label: 'other' },
];

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');
}

function clockLabel(iso: string | null, lang: Language): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function SharePage({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [session, setSession] = useState<SavedSession | null>(null);
  const [content, setContent] = useState<Content | null>(null);
  const [delivery, setDelivery] = useState<DeliveryState | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lang, setLang] = useState<Language>(preferredLanguage());
  const [pickedLanguage, setPickedLanguage] = useState<Language | null>(null);
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [draftLang, setDraftLang] = useState<Language>(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [recap, setRecap] = useState(false);
  const [listenSignal, setListenSignal] = useState(0);
  const [autoHelpSent, setAutoHelpSent] = useState(false);
  const [draftReason, setDraftReason] = useState<HelpReason | null>(null);

  const strings = t(lang);
  const dir = metaOf(lang).dir;
  const available = meta?.availableLanguages ?? [];
  const uiLang = available.includes(lang) ? lang : (available[0] ?? lang);

  useEffect(() => {
    document.documentElement.lang = uiLang;
    document.documentElement.dir = metaOf(uiLang).dir;
    const title = content?.title ?? meta?.instruction.titleVariants[uiLang] ?? meta?.instruction.title;
    document.title = title ? `${title} — Understood` : 'Understood';
  }, [uiLang, content, meta]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const metaResponse = await api<MetaResponse>(`/api/v1/w/${encodeURIComponent(token)}`);
        if (cancelled) return;
        setMeta(metaResponse);
        const metaLanguage = metaResponse.availableLanguages.includes(preferredLanguage())
          ? preferredLanguage()
          : (metaResponse.availableLanguages[0] ?? preferredLanguage());
        setLang(metaLanguage);
        setDraftLang(metaLanguage);

        const saved = loadSession(token);
        if (!saved) {
          setPhase('picker');
          return;
        }

        try {
          const state = await api<StateResponse>('/api/v1/w/state', { headers: bearer(saved.deliveryToken) });
          if (cancelled) return;
          setSession(saved);
          applyState(state);
          if (queuedCount() > 0) {
            const remaining = await flushQueue();
            if (remaining === 0) {
              const fresh = await api<StateResponse>('/api/v1/w/state', { headers: bearer(saved.deliveryToken) });
              if (!cancelled) applyState(fresh);
            }
          }
        } catch (resumeError) {
          if (cancelled) return;
          if (resumeError instanceof ApiError && resumeError.code === 'LINK_UNAVAILABLE') {
            setPhase('closed');
          } else if (
            resumeError instanceof ApiError &&
            ['DELIVERY_TOKEN_INVALID', 'FORBIDDEN'].includes(resumeError.code)
          ) {
            clearSession(token);
            setPhase('picker');
          } else if (resumeError instanceof NetworkError) {
            setPhase('fatal');
          } else {
            setPhase('picker');
          }
        }
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof ApiError && loadError.code === 'LINK_UNAVAILABLE') setPhase('closed');
        else setPhase('fatal');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    function goOnline() {
      setOffline(false);
      void flushQueue().then((remaining) => {
        setOffline(!navigator.onLine);
        if (remaining === 0) void refreshState();
      });
    }
    function goOffline() {
      setOffline(true);
    }
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function applyState(state: StateResponse) {
    setDelivery(state.delivery);
    setContent(state.instruction);
    setFirstName(state.worker.firstName);
    setLang(state.delivery.language);
    setDraftLang(state.delivery.language);
    setCompletedAt(state.delivery.completedAt);
    setPhase(state.alreadyCompleted || state.delivery.status === 'completed' ? 'completed' : 'instruction');
  }

  async function refreshState() {
    if (!session) return;
    try {
      const state = await api<StateResponse>('/api/v1/w/state', { headers: bearer(session.deliveryToken) });
      applyState(state);
    } catch (refreshError) {
      if (refreshError instanceof ApiError && refreshError.code === 'LINK_UNAVAILABLE') setPhase('closed');
    }
  }

  async function identify(entry: AudienceEntry) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api<IdentifyResponse>(`/api/v1/w/${encodeURIComponent(token)}/identify`, {
        method: 'POST',
        body: JSON.stringify({ workerId: entry.id, ...(pickedLanguage ? { language: pickedLanguage } : {}) }),
      });
      const saved: SavedSession = {
        workerId: entry.id,
        name: entry.displayName,
        language: response.worker.language,
        deliveryToken: response.deliveryToken,
      };
      const state = await api<StateResponse>('/api/v1/w/state', { headers: bearer(response.deliveryToken) });
      saveSession(token, saved);
      rememberLanguage(response.worker.language);
      setSession(saved);
      setAutoHelpSent(false);
      applyState(state);
    } catch (identifyError) {
      if (identifyError instanceof NetworkError) {
        setOffline(true);
        setError(strings.offline);
      } else if (identifyError instanceof ApiError && identifyError.code === 'WORKER_NOT_IN_AUDIENCE') {
        setPhase('missing');
      } else if (identifyError instanceof ApiError && identifyError.code === 'LINK_UNAVAILABLE') {
        setPhase('closed');
      } else {
        setError(identifyError instanceof Error ? identifyError.message : 'Something went wrong');
      }
    } finally {
      setBusy(false);
    }
  }

  async function answer(optionIndex: 0 | 1 | 2) {
    if (!session || !delivery || busy) return;
    const key = crypto.randomUUID();
    setBusy(true);
    setError(null);
    try {
      const response = await api<AnswerResponse>('/api/v1/w/answer', {
        method: 'POST',
        headers: { ...bearer(session.deliveryToken), 'Idempotency-Key': key },
        body: JSON.stringify({ optionIndex }),
      });
      const now = new Date().toISOString();
      const autoHelp = !response.correct && response.attemptsCount >= 2;
      if (autoHelp) setAutoHelpSent(true);
      setDelivery((current) => {
        if (!current) return current;
        const attempts = [...current.attempts, { optionIndex, correct: response.correct, at: now }];
        return {
          ...current,
          status: 'answered',
          attempts,
          attemptsCount: response.attemptsCount,
          answeredAt: current.answeredAt ?? now,
          help: autoHelp
            ? { ...current.help, requested: true, reason: 'dont_understand', requestedAt: now }
            : current.help,
        };
      });
      setContent((current) =>
        current?.question ? { ...current, question: { ...current.question, correctIndex: response.correctIndex } } : current,
      );
    } catch (answerError) {
      if (answerError instanceof NetworkError) {
        enqueueMutation({ key, path: '/api/v1/w/answer', body: { optionIndex }, deliveryToken: session.deliveryToken });
        setOffline(true);
        setError(strings.offline);
      } else if (answerError instanceof ApiError && answerError.code === 'LINK_UNAVAILABLE') {
        setPhase('closed');
      } else if (answerError instanceof ApiError && answerError.code === 'ATTEMPTS_EXHAUSTED') {
        await refreshState();
      } else {
        setError(answerError instanceof Error ? answerError.message : 'Something went wrong');
      }
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!session || busy) return;
    const key = crypto.randomUUID();
    setBusy(true);
    setError(null);
    try {
      const response = await api<{ completedAt: string }>('/api/v1/w/complete', {
        method: 'POST',
        headers: { ...bearer(session.deliveryToken), 'Idempotency-Key': key },
        body: JSON.stringify({}),
      });
      rememberLanguage(lang);
      setCompletedAt(response.completedAt);
      setPhase('completed');
      setSheet(null);
    } catch (completeError) {
      if (completeError instanceof NetworkError) {
        enqueueMutation({ key, path: '/api/v1/w/complete', body: {}, deliveryToken: session.deliveryToken });
        setOffline(true);
        setError(strings.offline);
      } else if (completeError instanceof ApiError && completeError.code === 'LINK_UNAVAILABLE') {
        setPhase('closed');
      } else {
        setError(completeError instanceof Error ? completeError.message : 'Something went wrong');
      }
    } finally {
      setBusy(false);
    }
  }

  async function requestHelp(reason: HelpReason) {
    if (!session || busy) return;
    const key = crypto.randomUUID();
    setBusy(true);
    setError(null);
    try {
      const response = await api<{ requestedAt: string }>('/api/v1/w/help', {
        method: 'POST',
        headers: { ...bearer(session.deliveryToken), 'Idempotency-Key': key },
        body: JSON.stringify({ reason }),
      });
      setDelivery((current) =>
        current
          ? {
              ...current,
              help: { ...current.help, requested: true, reason, requestedAt: response.requestedAt },
            }
          : current,
      );
      setSheet(null);
      setPhase('help-sent');
    } catch (helpError) {
      if (helpError instanceof NetworkError) {
        enqueueMutation({ key, path: '/api/v1/w/help', body: { reason }, deliveryToken: session.deliveryToken });
        setOffline(true);
        setError(strings.offline);
      } else if (helpError instanceof ApiError && helpError.code === 'LINK_UNAVAILABLE') {
        setPhase('closed');
      } else {
        setError(helpError instanceof Error ? helpError.message : 'Something went wrong');
      }
    } finally {
      setBusy(false);
    }
  }

  async function changeLanguage(next: Language) {
    setError(null);
    if (!session) {
      setLang(next);
      setDraftLang(next);
      setPickedLanguage(next);
      rememberLanguage(next);
      setSheet(null);
      return;
    }
    if (next === lang) {
      setSheet(null);
      return;
    }
    setBusy(true);
    try {
      const response = await api<{ language: Language; deliveryLanguage: Language; content: Content }>('/api/v1/w/language', {
        method: 'POST',
        headers: bearer(session.deliveryToken),
        body: JSON.stringify({ language: next }),
      });
      setContent(response.content);
      setLang(response.language);
      setDraftLang(response.language);
      rememberLanguage(response.language);
      setDelivery((current) => (current ? { ...current, language: response.deliveryLanguage } : current));
      const saved = { ...session, language: response.language };
      saveSession(token, saved);
      setSession(saved);
      setSheet(null);
    } catch (languageError) {
      if (languageError instanceof ApiError && languageError.code === 'LINK_UNAVAILABLE') setPhase('closed');
      else setError(languageError instanceof Error ? languageError.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const title = useMemo(() => {
    if (!meta) return '';
    return meta.instruction.titleVariants[uiLang] ?? meta.instruction.title ?? '';
  }, [meta, uiLang]);

  const filteredAudience = useMemo(() => {
    if (!meta) return [];
    const query = search.trim().toLocaleLowerCase();
    if (!query) return meta.audience;
    return meta.audience.filter((entry) => entry.displayName.toLocaleLowerCase().includes(query));
  }, [meta, search]);

  const attempts = delivery?.attempts ?? [];
  const attemptsCount = delivery?.attemptsCount ?? attempts.length;
  const lastAttempt = attempts[attempts.length - 1];
  const answeredCorrect = attempts.some((attempt) => attempt.correct);
  const finished = answeredCorrect || attemptsCount >= 2;
  const helpRequested = Boolean(delivery?.help.requested) || autoHelpSent;
  const doneEnabled = answeredCorrect || attemptsCount >= 2;
  const wrongFeedback = attemptsCount === 1 && lastAttempt && !lastAttempt.correct;

  function renderHeader() {
    if (!meta) return null;
    return (
      <header className="w-head">
        <span className="w-org">{meta.org.name}</span>
        <button
          className="w-lang-chip"
          type="button"
          onClick={() => {
            setDraftLang(uiLang);
            setSheet('lang');
          }}
          aria-label={strings.langTitle}
        >
          <Icon name="globe" />
          <bdi>{metaOf(uiLang).nativeLabel}</bdi>
        </button>
      </header>
    );
  }

  function renderBanners() {
    return (
      <>
        {offline ? (
          <div className="w-banner amber">
            <Icon name="wifiOff" />
            <span>{strings.offline}</span>
          </div>
        ) : null}
        {error ? (
          <div className="w-banner red">
            <Icon name="alertCircle" />
            <span>{error}</span>
          </div>
        ) : null}
      </>
    );
  }

  function renderPicker() {
    if (!meta) return null;
    return (
      <div className="w-main w-picker">
        <h1 className={`w-title ${FONT_CLASS[uiLang]}`} lang={uiLang}>
          {title}
        </h1>
        <p className="w-sub">{strings.selectName}</p>
        {meta.audience.length > 8 ? (
          <div className="w-search">
            <Icon name="search" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={strings.search}
              aria-label={strings.search}
              autoComplete="off"
            />
          </div>
        ) : null}
        <div className="w-names">
          {filteredAudience.map((entry) => (
            <button
              key={entry.id}
              className="name-tile"
              type="button"
              disabled={busy}
              onClick={() => void identify(entry)}
            >
              <span className="n-av" aria-hidden="true">
                {initials(entry.displayName)}
              </span>
              <span className="n-meta">
                <span className={`n-name ${FONT_CLASS[entry.language]}`} lang={entry.language}>
                  {entry.displayName}
                </span>
                <span className="n-lang">{metaOf(entry.language).nativeLabel}</span>
              </span>
            </button>
          ))}
          {filteredAudience.length === 0 ? <div className="w-empty-search">{strings.noMatch}</div> : null}
        </div>
        <div className="w-picker-foot">
          <button className="linklike" type="button" onClick={() => setPhase('missing')}>
            <Icon name="help" />
            {strings.notHere}
          </button>
        </div>
      </div>
    );
  }

  function renderQuestion() {
    if (!content?.question) return null;
    const question = content.question;
    return (
      <section className="w-question" aria-labelledby="q-title">
        <div className="q-head" id="q-title">
          <Icon name="help" />
          {strings.quickCheck}
        </div>
        <p className={`q-text ${FONT_CLASS[uiLang]}`} lang={uiLang}>
          {question.text}
        </p>
        <p className="q-hint">{strings.questionHint}</p>
        <div className="q-options">
          {question.options.map((option, index) => {
            let className = 'q-option';
            const correctIndex = question.correctIndex;
            if (finished && correctIndex !== undefined) {
              if (index === correctIndex) className += ' is-correct';
              else if (index === lastAttempt?.optionIndex && lastAttempt && !lastAttempt.correct) className += ' is-wrong';
              else className += ' is-dim';
            } else if (wrongFeedback && index === lastAttempt?.optionIndex) {
              className += ' is-wrong';
            }
            return (
              <button
                key={index}
                className={className}
                type="button"
                disabled={finished || busy || offline}
                onClick={() => void answer(index as 0 | 1 | 2)}
              >
                <span className="letter" aria-hidden="true">
                  {LETTERS[uiLang][index] ?? LETTERS[uiLang][0]}
                </span>
                <span className={FONT_CLASS[uiLang]} lang={uiLang}>
                  {option}
                </span>
                {finished && index === question.correctIndex ? (
                  <span className="checkmark">
                    <Icon name="check" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div>
          {answeredCorrect ? (
            <div className="q-feedback ok">
              <Icon name="checkCircle" />
              <span>{strings.correct}</span>
            </div>
          ) : attemptsCount >= 2 ? (
            <div className="q-feedback bad">
              <Icon name="alertCircle" />
              <span>{strings.wrong2}</span>
            </div>
          ) : wrongFeedback ? (
            <div className="q-feedback bad">
              <Icon name="alertCircle" />
              <span className="fb-body">
                {strings.wrong1}
                <br />
                <button
                  className="listen-again-btn"
                  type="button"
                  onClick={() => {
                    document.querySelector('.w-audio')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    setListenSignal((value) => value + 1);
                  }}
                >
                  <Icon name="volume" />
                  {strings.listenAgain}
                </button>
              </span>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  function renderInstruction() {
    if (!content) return null;
    return (
      <>
        <div className="w-main w-instruction">
          <h1 className={`w-instr-title ${FONT_CLASS[uiLang]}`} lang={uiLang}>
            {content.title ?? title}
          </h1>
          {content.audioUrl ? <AudioPlayer src={content.audioUrl} lang={uiLang} playSignal={listenSignal} /> : null}
          {content.photoUrl ? (
            <figure className="w-photo-card">
              <img src={content.photoUrl} alt={content.title ?? ''} />
            </figure>
          ) : null}
          {content.text ? (
            <div className="w-text-card">
              <p className={`w-instruction-text ${FONT_CLASS[uiLang]}`} dir={dir} lang={uiLang}>
                {content.text}
              </p>
              <div className="w-disclaimer">
                <Icon name="shield" />
                <span>{strings.disclaimer}</span>
              </div>
            </div>
          ) : null}
          {renderQuestion()}
        </div>
        <div className="w-actionbar">
          <button className="w-btn w-btn-primary" type="button" disabled={!doneEnabled || busy} onClick={() => void complete()}>
            {content.type === 'info' ? strings.gotIt : strings.done}
          </button>
          <button
            className="help-link"
            type="button"
            disabled={helpRequested || busy}
            onClick={() => {
              setSheet('help');
            }}
          >
            <Icon name={helpRequested ? 'check' : 'message'} />
            {helpRequested ? strings.helpRequested : strings.helpCta}
          </button>
        </div>
      </>
    );
  }

  function renderCompleted() {
    if (!content) return null;
    return (
      <div className="w-center">
        <span className="t-orb green">
          <Icon name="checkCircle" />
        </span>
        <h1 className="t-title">{strings.completedTitle}</h1>
        <p className="t-sub">
          {strings.completedSub}
          {firstName ? ` · ${firstName}` : ''}
        </p>
        <div className="t-time">{clockLabel(completedAt, uiLang)}</div>
        <div className="t-actions">
          <button className="w-btn w-btn-ghost" type="button" onClick={() => setRecap((value) => !value)}>
            <Icon name={recap ? 'chevronDown' : 'headphones'} />
            {strings.listenAgain}
          </button>
        </div>
        {recap ? (
          <div className="t-recap">
            {content.audioUrl ? <AudioPlayer src={content.audioUrl} lang={uiLang} /> : null}
            <div className="w-text-card">
              <p className={`w-instruction-text ${FONT_CLASS[uiLang]}`} dir={dir} lang={uiLang}>
                {content.text}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderHelpSent() {
    return (
      <div className="w-center">
        <span className="t-orb green">
          <Icon name="checkCircle" />
        </span>
        <h1 className="t-title">{strings.helpSent}</h1>
        <p className="t-sub">{strings.helpSentSub}</p>
        <div className="t-actions">
          <button
            className="w-btn w-btn-primary"
            type="button"
            onClick={() => setPhase(delivery?.status === 'completed' ? 'completed' : 'instruction')}
          >
            {strings.close}
          </button>
        </div>
      </div>
    );
  }

  function renderClosed() {
    return (
      <div className="w-center">
        <span className="t-orb slate">
          <Icon name="lock" />
        </span>
        <h1 className="t-title">{strings.closedTitle}</h1>
        <p className="t-sub">{strings.closedSub}</p>
      </div>
    );
  }

  function renderMissing() {
    return (
      <div className="w-center">
        <span className="t-orb blue">
          <Icon name="userX" />
        </span>
        <h1 className="t-title">{strings.notHere}</h1>
        <p className="t-sub">{strings.notHereBody}</p>
        <div className="t-actions">
          <button className="w-btn w-btn-ghost" type="button" onClick={() => setPhase('picker')}>
            <Icon name="arrowLeft" />
            {strings.backToNames}
          </button>
        </div>
      </div>
    );
  }

  function renderFatal() {
    return (
      <div className="w-center">
        <span className="t-orb slate">
          <Icon name="wifiOff" />
        </span>
        <h1 className="t-title">{strings.closedTitle}</h1>
        <p className="t-sub">{strings.offline}</p>
        <div className="t-actions">
          <button className="w-btn w-btn-ghost" type="button" onClick={() => window.location.reload()}>
            <Icon name="refresh" />
            {strings.retry}
          </button>
        </div>
      </div>
    );
  }

  function renderSheets() {
    if (!meta) return null;
    if (sheet === 'help') {
      return (
        <div
          className="sheet-scrim"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSheet(null);
          }}
        >
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            <div className="sheet-handle" aria-hidden="true" />
            <h2 id="sheet-title">{strings.helpTitle}</h2>
            <p className="sheet-sub">{strings.helpSub}</p>
            <div className="reason-list">
              {HELP_REASONS.map((reason) => (
                <button
                  key={reason.key}
                  className={`reason${draftReason === reason.key ? ' is-selected' : ''}`}
                  type="button"
                  onClick={() => setDraftReason(reason.key)}
                >
                  <span className="radio" aria-hidden="true" />
                  <span>{strings.reasons[reason.label as keyof typeof strings.reasons]}</span>
                </button>
              ))}
            </div>
            <div className="sheet-actions">
              <button className="w-btn w-btn-ghost" type="button" onClick={() => setSheet(null)}>
                {strings.cancel}
              </button>
              <button
                className="w-btn w-btn-primary"
                type="button"
                disabled={!draftReason || busy}
                onClick={() => {
                  if (draftReason) void requestHelp(draftReason);
                }}
              >
                <Icon name="message" />
                {strings.send}
              </button>
            </div>
          </div>
        </div>
      );
    }
    if (sheet === 'lang') {
      return (
        <div
          className="sheet-scrim"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSheet(null);
          }}
        >
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-lang-title">
            <div className="sheet-handle" aria-hidden="true" />
            <h2 id="sheet-lang-title">{strings.langTitle}</h2>
            <div className="lang-list">
              {LANG_ORDER.filter((code) => available.includes(code)).map((code) => (
                <button
                  key={code}
                  className={`lang-row${draftLang === code ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => setDraftLang(code)}
                >
                  <span className={`lang-native ${FONT_CLASS[code]}`} lang={code}>
                    {metaOf(code).nativeLabel}
                  </span>
                  <span className="lang-en">{metaOf(code).englishLabel}</span>
                  <span className="lang-check">
                    <Icon name="check" />
                  </span>
                </button>
              ))}
            </div>
            <div className="lang-note">
              <Icon name="globe" />
              <span>{strings.langNote}</span>
            </div>
            <div className="sheet-actions">
              <button className="w-btn w-btn-ghost" type="button" onClick={() => setSheet(null)}>
                {strings.cancel}
              </button>
              <button className="w-btn w-btn-primary" type="button" disabled={busy} onClick={() => void changeLanguage(draftLang)}>
                {strings.save}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  let screen: ReactElement | null;
  if (phase === 'loading') {
    screen = (
      <div className="w-center">
        <span className="t-orb slate">
          <Icon name="refresh" />
        </span>
        <p className="t-sub">Loading…</p>
      </div>
    );
  } else if (phase === 'closed') {
    screen = renderClosed();
  } else if (phase === 'fatal') {
    screen = renderFatal();
  } else if (phase === 'missing') {
    screen = renderMissing();
  } else if (phase === 'picker') {
    screen = renderPicker();
  } else if (phase === 'instruction') {
    screen = renderInstruction();
  } else if (phase === 'completed') {
    screen = renderCompleted();
  } else {
    screen = renderHelpSent();
  }

  return (
    <div className={`w-app ${FONT_CLASS[uiLang]}`} dir={dir} lang={uiLang}>
      {renderHeader()}
      {renderBanners()}
      {screen}
      {renderSheets()}
    </div>
  );
}
