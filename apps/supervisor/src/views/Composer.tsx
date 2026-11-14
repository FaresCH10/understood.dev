import { useEffect, useRef, useState } from 'react';
import { LANGUAGE_META, LANGUAGES, type Language } from '@understood/shared';
import type {
  CrewRow,
  InstructionDetail,
  InstructionStatus,
  InstructionStatusPayload,
  Me,
  WorkerRow,
} from '../types';
import { ApiError, api, errorMessage } from '../api';
import { Modal, navigate, useLocale, useToast } from '../ui';
import { Icon } from '../icons';
import { PageHead } from '../components';

type Mode = 'text' | 'voice' | 'photo';
type TranscriptStatus = 'pending' | 'ready' | 'failed' | 'confirmed' | null;

const MAX_SECONDS = 180;

export default function Composer({ me }: { me: Me }) {
  const { t } = useLocale();
  const toast = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [type, setType] = useState<'task' | 'info'>('task');
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<Mode>('voice');
  const [text, setText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [transcriptStatus, setTranscriptStatus] = useState<TranscriptStatus>(null);
  const [durationS, setDurationS] = useState<number | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoName, setPhotoName] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const [crews, setCrews] = useState<CrewRow[]>([]);
  const [crewId, setCrewId] = useState('');
  const [roster, setRoster] = useState<WorkerRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [subsetOpen, setSubsetOpen] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [jobLangs, setJobLangs] = useState<Language[]>([]);
  const [jobStatus, setJobStatus] = useState<InstructionStatus | null>(null);
  const [jobStages, setJobStages] = useState<InstructionStatusPayload['stages'] | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  const draftIdRef = useRef<string | null>(null);
  draftIdRef.current = draftId;
  const initRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<number | null>(null);
  const transcriptPollRef = useRef<number | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    void (async () => {
      try {
        const resumeId = new URLSearchParams(window.location.search).get('id');
        if (resumeId) {
          const { data } = await api<InstructionDetail>(`/api/v1/instructions/${resumeId}`);
          if (data.status !== 'draft') {
            navigate(`/instructions/${resumeId}`);
            return;
          }
          setDraftId(resumeId);
          setTitle(data.title ?? '');
          setType(data.type);
          const kind = (data.content.kind ?? 'text') as Mode;
          setMode(kind);
          setText(data.content.text ?? '');
          setTranscript(data.content.transcript ?? '');
          setTranscriptStatus(data.content.transcriptStatus ?? null);
          setHasAudio(data.content.hasAudio);
          setDurationS(data.content.durationS);
          setHasPhoto(data.content.hasPhoto);
          if (data.crewId) setCrewId(data.crewId);
          if (data.content.kind === 'voice' && data.content.transcriptStatus === 'pending') {
            setTranscribing(true);
            pollTranscript(resumeId);
          }
        } else {
          const { data } = await api<{ id: string }>('/api/v1/instructions', { method: 'POST', body: {} });
          setDraftId(data.id);
        }

        const { data: crewList } = await api<CrewRow[]>('/api/v1/crews');
        const active = crewList.filter((crew) => !crew.archived);
        setCrews(active);
        setCrewId((current) => current || active[0]?.id || '');
      } catch (error) {
        toast(errorMessage(error), true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!crewId) {
      setRoster([]);
      setSelected([]);
      return;
    }
    let live = true;
    api<WorkerRow[]>(`/api/v1/crews/${crewId}/workers?limit=200`)
      .then(({ data }) => {
        if (!live) return;
        setRoster(data);
        setSelected(data.map((worker) => worker.id));
      })
      .catch((error) => toast(errorMessage(error), true));
    return () => {
      live = false;
    };
  }, [crewId]);

  useEffect(() => {
    if (!draftId || step === 3) return;
    const handle = window.setTimeout(() => {
      void patchDraft();
    }, 900);
    return () => window.clearTimeout(handle);
  }, [draftId, step, title, type, mode, text, transcript, hasPhoto]);

  useEffect(() => {
    if (step !== 3 || !draftId) return;
    let live = true;

    const tick = async () => {
      try {
        const { data } = await api<InstructionStatusPayload>(`/api/v1/instructions/${draftId}/status`);
        if (!live) return;
        setJobStatus(data.status);
        setJobStages(data.stages);
        if (data.error) setJobError(data.error.message);
        if (data.status === 'ready' || data.status === 'partial_failure') {
          window.clearInterval(handle);
          setGenerating(false);
          window.setTimeout(() => {
            if (live) navigate(`/instructions/${draftId}`);
          }, 1400);
        }
      } catch {
        // transient poll failure
      }
    };

    const handle = window.setInterval(() => void tick(), 1500);
    void tick();
    return () => {
      live = false;
      window.clearInterval(handle);
    };
  }, [step, draftId]);

  const buildPatch = (): Record<string, unknown> | null => {
    const body: Record<string, unknown> = { type };
    if (title.trim()) body.title = title.trim();
    if (mode === 'text' || mode === 'photo') {
      body.content = { kind: mode, text: text.trim() ? text : null };
    } else if (transcript.trim() && transcriptStatus !== 'confirmed') {
      body.content = { transcript };
    }
    return body;
  };

  const patchDraft = async (): Promise<void> => {
    const id = draftIdRef.current;
    if (!id) return;
    try {
      await api(`/api/v1/instructions/${id}`, { method: 'PATCH', body: buildPatch() });
    } catch {
      // autosave is best-effort; explicit saves surface errors
    }
  };

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      await patchDraft();
      toast(t('toast.draftSaved'));
    } finally {
      setSavingDraft(false);
    }
  };

  const stopRecording = () => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    if (!draftId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 0) void uploadVoice(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      tickRef.current = window.setInterval(() => {
        setRecordSeconds((seconds) => {
          const next = seconds + 1;
          if (next >= MAX_SECONDS) stopRecording();
          return next;
        });
      }, 1000);
    } catch {
      toast(t('composer.micDenied'), true);
    }
  };

  const pollTranscript = (id: string) => {
    if (transcriptPollRef.current) window.clearInterval(transcriptPollRef.current);
    let attempts = 0;
    transcriptPollRef.current = window.setInterval(() => {
      void (async () => {
        attempts += 1;
        try {
          const { data } = await api<InstructionStatusPayload>(`/api/v1/instructions/${id}/status`);
          const state = data.transcript;
          if (state && state.status !== 'pending') {
            if (transcriptPollRef.current) window.clearInterval(transcriptPollRef.current);
            setTranscribing(false);
            setTranscriptStatus(state.status as TranscriptStatus);
            if (state.text) setTranscript(state.text);
          }
        } catch {
          // keep polling
        }
        if (attempts > 80 && transcriptPollRef.current) {
          window.clearInterval(transcriptPollRef.current);
          setTranscribing(false);
        }
      })();
    }, 1500);
  };

  const uploadVoice = async (blob: Blob) => {
    const id = draftIdRef.current;
    if (!id) return;
    setUploading(true);
    try {
      const form = new FormData();
      const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      form.append('file', blob, `voice.${ext}`);
      const { data } = await api<{ durationS: number }>(`/api/v1/instructions/${id}/voice`, {
        method: 'POST',
        body: form,
      });
      setHasAudio(true);
      setDurationS(data.durationS);
      setHasPhoto(false);
      setTranscript('');
      setTranscriptStatus('pending');
      setTranscribing(true);
      pollTranscript(id);
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setUploading(false);
    }
  };

  const uploadPhoto = async (file: File) => {
    const id = draftIdRef.current;
    if (!id) return;
    setPhotoUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api(`/api/v1/instructions/${id}/photo`, { method: 'POST', body: form });
      setHasPhoto(true);
      setHasAudio(false);
      setPhotoName(file.name);
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setPhotoUploading(false);
    }
  };

  const confirmTranscript = async () => {
    const id = draftIdRef.current;
    if (!id || !transcript.trim()) return;
    setSaving(true);
    try {
      await api(`/api/v1/instructions/${id}`, {
        method: 'PATCH',
        body: { content: { transcript, transcriptStatus: 'confirmed' } },
      });
      setTranscriptStatus('confirmed');
    } catch (error) {
      toast(errorMessage(error), true);
    } finally {
      setSaving(false);
    }
  };

  const goAudience = async () => {
    if (mode === 'voice') {
      if (!hasAudio) return toast(t('composer.voiceRequired'), true);
      if (transcriptStatus !== 'confirmed') return toast(t('composer.voiceRequired'), true);
    } else if (mode === 'photo') {
      if (!hasPhoto) return toast(t('composer.photoRequired'), true);
      if (!text.trim()) return toast(t('composer.textRequired'), true);
    } else if (!text.trim()) {
      return toast(t('composer.textRequired'), true);
    }
    await patchDraft();
    setStep(2);
  };

  const generate = async () => {
    const id = draftIdRef.current;
    if (!id) return;
    if (!crewId) return toast(t('composer.crewRequired'), true);
    if (selected.length === 0) return toast(t('composer.audienceRequired'), true);
    setGenerating(true);
    setJobError(null);
    try {
      await patchDraft();
      const audience = selected.length === roster.length ? undefined : selected;
      const { meta } = await api<{ status: string }>(`/api/v1/instructions/${id}/generate`, {
        method: 'POST',
        body: { crewId, ...(audience ? { audienceWorkerIds: audience } : {}) },
      });
      const languages = Array.isArray(meta.languages) ? (meta.languages as Language[]) : [];
      setJobLangs(languages);
      setJobStatus('processing');
      setStep(3);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TRANSCRIPT_UNCONFIRMED') {
        toast(t('composer.voiceRequired'), true);
        setStep(1);
      } else {
        toast(errorMessage(error), true);
      }
      setGenerating(false);
    }
  };

  const selectedWorkers = roster.filter((worker) => selected.includes(worker.id));
  const counts: Partial<Record<Language, number>> = {};
  for (const worker of selectedWorkers) counts[worker.language] = (counts[worker.language] ?? 0) + 1;
  const activeLangs = LANGUAGES.filter((language) => (counts[language] ?? 0) > 0);
  const crew = crews.find((entry) => entry.id === crewId) ?? null;

  const stepper = (
    <div className="stepper">
      <span className={`step ${step === 1 ? 'is-active' : step > 1 ? 'is-done' : ''}`}>
        <span className="step-n">{step > 1 ? <Icon name="check" /> : 1}</span>
        {t('composer.step1')}
      </span>
      <span className="step-line" />
      <span className={`step ${step === 2 ? 'is-active' : step > 2 ? 'is-done' : ''}`}>
        <span className="step-n">{step > 2 ? <Icon name="check" /> : 2}</span>
        {t('composer.step2')}
      </span>
      <span className="step-line" />
      <span className={`step ${step === 3 ? 'is-active' : ''}`}>
        <span className="step-n">3</span>
        {t('composer.step3')}
      </span>
    </div>
  );

  if (step === 3) {
    const langs = jobLangs.length > 0 ? jobLangs : activeLangs;
    const ready = (jobStages
      ? langs.filter((language) =>
          jobStages.translate[language] === 'done' &&
          jobStages.question[language] === 'done' &&
          (jobStages.audio[language] === 'done' || jobStages.audio[language] === 'failed'),
        ).length
      : 0);
    const pct = langs.length > 0 ? Math.round((ready / langs.length) * 100) : 0;
    const finished = jobStatus === 'ready' || jobStatus === 'partial_failure';

    return (
      <>
        <PageHead eyebrow={`${t('nav.instructions')} · ${t('composer.title')}`} title={t('composer.title')} sub={t('composer.sub')} actions={stepper} />
        <div className="proc-wrap">
          <div className="proc-head">
            <div className="proc-orb">
              <Icon name="sparkles" />
            </div>
            <h2>{t('processing.title', { n: langs.length })}</h2>
            <p>{finished && jobStatus === 'partial_failure' ? t('detail.generateFailed') : t('processing.sub')}</p>
          </div>
          <div className="card proc-card">
            <div className="proc-bar">
              <span style={{ width: `${pct}%` }} />
            </div>
            <div className="proc-meta">
              <span>
                {ready} / {langs.length} {t('processing.ready')}
              </span>
              <span>{title || t('instr.untitled')}</span>
            </div>
            {langs.map((language) => {
              const stages = jobStages;
              const stage = (name: keyof InstructionStatusPayload['stages']) =>
                stages?.[name]?.[language] ?? 'pending';
              return (
                <div className="proc-lang" key={language}>
                  <div className="proc-name">
                    <span className="script">{LANGUAGE_META[language].nativeLabel.charAt(0)}</span>
                    {LANGUAGE_META[language].nativeLabel}
                  </div>
                  <div className="stages">
                    <span className={`stage ${stage('translate') === 'done' ? 'is-done' : stage('translate') === 'running' ? 'is-active' : stage('translate') === 'failed' ? 'is-failed' : ''}`}>
                      <i className="dot" />
                      {t('processing.translate')}
                    </span>
                    <span className={`stage ${stage('question') === 'done' ? 'is-done' : stage('question') === 'running' ? 'is-active' : stage('question') === 'failed' ? 'is-failed' : ''}`}>
                      <i className="dot" />
                      {t('processing.question')}
                    </span>
                    <span className={`stage ${stage('audio') === 'done' ? 'is-done' : stage('audio') === 'running' ? 'is-active' : stage('audio') === 'failed' ? 'is-failed' : ''}`}>
                      <i className="dot" />
                      {t('processing.audio')}
                    </span>
                  </div>
                  <span className={`proc-status${stage('audio') === 'done' ? ' ready' : ''}`}>
                    {stage('audio') === 'done'
                      ? t('processing.ready')
                      : stage('audio') === 'failed'
                        ? t('processing.ready')
                        : t('processing.queued')}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="proc-foot">
            <span className="safe">
              <Icon name="shield" />
              {t('processing.safe')}
            </span>
            {finished ? (
              <button className="btn btn-primary" type="button" onClick={() => navigate(`/instructions/${draftId}`)}>
                <Icon name="checkCircle" />
                {t('processing.review')}
              </button>
            ) : (
              <button className="link-btn" type="button" onClick={() => navigate(`/instructions/${draftId}`)}>
                {t('processing.skip')}
                <Icon name="chevronRight" />
              </button>
            )}
          </div>
          {jobError ? <p className="help" style={{ textAlign: 'center', marginTop: 10 }}>{jobError}</p> : null}
        </div>
      </>
    );
  }

  if (step === 2) {
    return (
      <>
        <PageHead eyebrow={`${t('nav.instructions')} · ${t('composer.title')}`} title={t('composer.title')} sub={t('composer.sub')} actions={stepper} />
        <div className="audience-grid">
          <div className="card card-pad">
            <div className="field">
              <label>
                {t('composer.audience')}
                <span className="opt">{t('composer.audienceHint')}</span>
              </label>
              {crews.length === 0 ? (
                <div className="card empty" style={{ padding: 20 }}>
                  <strong>{t('composer.noCrews')}</strong>
                  <button className="btn btn-primary btn-sm" type="button" onClick={() => navigate('/crews')}>
                    {t('composer.createCrew')}
                  </button>
                </div>
              ) : (
                crews.map((entry) => (
                  <button
                    key={entry.id}
                    className={`crew-option ${entry.id === crewId ? 'is-selected' : ''}`}
                    type="button"
                    onClick={() => setCrewId(entry.id)}
                  >
                    <span className="radio">{entry.id === crewId ? <Icon name="check" /> : null}</span>
                    <span className="co-main">
                      <strong>{entry.name}</strong>
                      <span>{t('meta.workers', { n: entry.workerCount })}</span>
                    </span>
                  </button>
                ))
              )}
            </div>

            {crew ? (
              <div className="field">
                <label>{t('composer.who')}</label>
                <div className="segmented">
                  <button
                    className={selected.length === roster.length ? 'is-active' : ''}
                    type="button"
                    onClick={() => setSelected(roster.map((worker) => worker.id))}
                  >
                    {t('composer.everyone', { n: roster.length })}
                  </button>
                  <button
                    className={selected.length !== roster.length ? 'is-active' : ''}
                    type="button"
                    onClick={() => setSubsetOpen(true)}
                  >
                    {t('composer.subset')}
                  </button>
                </div>
                <p className="help" style={{ marginTop: 7 }}>
                  {t('composer.subsetSub')}
                </p>
                <div className="helper-line" style={{ marginTop: 10 }}>
                  <span className="pill pill-teal">
                    <Icon name="users" />
                    {t('composer.selected', { n: selected.length })}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="card langs-panel">
            <h3>{t('composer.langs')}</h3>
            <p className="cap">{t('composer.langsCap')}</p>
            <div className="lang-rows">
              {activeLangs.map((language) => (
                <div className="lang-row" key={language}>
                  <span className="script">{LANGUAGE_META[language].nativeLabel.charAt(0)}</span>
                  <span className="lname">{LANGUAGE_META[language].nativeLabel}</span>
                  <span className="lcount">{counts[language] ?? 0}</span>
                </div>
              ))}
              {activeLangs.length === 0 ? <p className="help">{t('composer.audienceRequired')}</p> : null}
            </div>
            <p className="help" style={{ marginTop: 10 }}>
              {t('composer.langsNote')}
            </p>
            <div className="tip-card" style={{ marginTop: 12 }}>
              <Icon name="sparkles" />
              <span>{t('composer.generateNote')}</span>
            </div>
          </aside>
        </div>

        <div className="compose-actions">
          <button className="btn btn-subtle" type="button" onClick={() => setStep(1)}>
            <Icon name="arrowLeft" />
            {t('composer.backCompose')}
          </button>
          <button
            className="btn btn-primary btn-lg"
            type="button"
            disabled={generating || selected.length === 0 || !crewId}
            onClick={() => void generate()}
          >
            {generating ? <Icon name="loader" className="spin" /> : <Icon name="sparkles" />}
            {generating ? t('composer.saving') : t('composer.generate')}
          </button>
        </div>

        {subsetOpen ? (
          <Modal onClose={() => setSubsetOpen(false)}>
            <div className="modal-head">
              <div>
                <h2>{t('composer.subsetTitle')}</h2>
                <p>{t('composer.subsetSub')}</p>
              </div>
              <button className="icon-btn" type="button" aria-label={t('action.close')} onClick={() => setSubsetOpen(false)}>
                <Icon name="x" />
              </button>
            </div>
            <div className="modal-body">
              <div className="checks-grid">
                {roster.map((worker) => (
                  <label className="worker-check" key={worker.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(worker.id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked ? [...current, worker.id] : current.filter((id) => id !== worker.id),
                        )
                      }
                    />
                    <span>{worker.name}</span>
                    <span className="lang-tag">{LANGUAGE_META[worker.language].nativeLabel}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <span className="left">{t('composer.selected', { n: selected.length })}</span>
              <button className="btn btn-primary" type="button" onClick={() => setSubsetOpen(false)}>
                {t('composer.subsetApply')}
              </button>
            </div>
          </Modal>
        ) : null}
      </>
    );
  }

  return (
    <>
      <PageHead eyebrow={`${t('nav.instructions')} · ${t('composer.title')}`} title={t('composer.title')} sub={t('composer.sub')} actions={stepper} />

      <div className="composer-grid">
        <div className="compose-main">
          <div className="card card-pad">
            <div className="field">
              <label>{t('composer.type')}</label>
              <div className="segmented">
                <button className={type === 'task' ? 'is-active' : ''} type="button" onClick={() => setType('task')}>
                  <Icon name="checkCircle" />
                  {t('composer.type.task')}
                </button>
                <button className={type === 'info' ? 'is-active' : ''} type="button" onClick={() => setType('info')}>
                  <Icon name="eye" />
                  {t('composer.type.info')}
                </button>
              </div>
              <p className="type-note">{type === 'task' ? t('composer.type.taskNote') : t('composer.type.infoNote')}</p>
            </div>

            <div className="field">
              <label>
                {t('composer.titleField')}
                <span className="opt">{t('composer.optional')}</span>
              </label>
              <input
                className="input"
                value={title}
                maxLength={120}
                placeholder={t('composer.titleField')}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="field">
              <label>{t('composer.message')}</label>
              <div className="segmented" style={{ marginBottom: 9 }}>
                <button className={mode === 'voice' ? 'is-active' : ''} type="button" onClick={() => setMode('voice')}>
                  <Icon name="mic" />
                  {t('composer.voice')}
                </button>
                <button className={mode === 'text' ? 'is-active' : ''} type="button" onClick={() => setMode('text')}>
                  <Icon name="doc" />
                  {t('composer.text')}
                </button>
                <button className={mode === 'photo' ? 'is-active' : ''} type="button" onClick={() => setMode('photo')}>
                  <Icon name="file" />
                  {t('composer.photo')}
                </button>
              </div>

              {mode === 'voice' ? (
                <>
                  <div className="record-card">
                    <button
                      className={`mic${recording ? ' is-recording' : ''}`}
                      type="button"
                      aria-label={recording ? t('composer.stop') : t('composer.tapRecord')}
                      disabled={uploading}
                      onClick={() => (recording ? stopRecording() : void startRecording())}
                    >
                      <Icon name={recording ? 'pause' : 'mic'} />
                    </button>
                    <div className="rec-body">
                      <div className="rec-time">
                        {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}
                        {hasAudio && durationS ? ` / ${Math.floor(durationS / 60)}:${String(Math.round(durationS % 60)).padStart(2, '0')}` : ''}
                      </div>
                      <div className="rec-state">
                        {uploading
                          ? t('composer.uploading')
                          : transcribing
                            ? t('composer.transcribing')
                            : recording
                              ? t('composer.recording')
                              : t('composer.rerecord')}
                      </div>
                    </div>
                    <div className="wave">
                      {[9, 16, 24, 13, 20, 30, 18, 25, 12, 22, 32, 16, 26, 19, 11, 23, 29, 15, 21, 12, 25, 18, 30, 14].map(
                        (height, index) => (
                          <i key={index} className={recording || hasAudio ? 'on' : ''} style={{ ['--h' as string]: `${height}px`, ['--d' as string]: index % 7 }} />
                        ),
                      )}
                    </div>
                  </div>
                  <div className="transcript" style={{ marginTop: 10 }}>
                    <div className="transcript-head">
                      <span>{t('composer.transcript')}</span>
                      {transcriptStatus === 'confirmed' ? (
                        <span className="chip chip-green">
                          <Icon name="check" />
                          {t('composer.confirmed')}
                        </span>
                      ) : transcriptStatus === 'ready' ? (
                        <span className="chip">{t('composer.detected')}</span>
                      ) : transcribing ? (
                        <span className="chip">
                          <Icon name="loader" className="spin" />
                          {t('detail.transcribing')}
                        </span>
                      ) : null}
                    </div>
                    <textarea
                      aria-label={t('composer.transcript')}
                      value={transcript}
                      maxLength={4000}
                      placeholder={t('composer.transcript')}
                      onChange={(event) => {
                        setTranscript(event.target.value);
                        if (transcriptStatus === 'confirmed') setTranscriptStatus('ready');
                      }}
                    />
                    <div className="transcript-foot">
                      <span>{transcriptStatus === 'failed' ? t('detail.transcriptFailed') : t('composer.transcriptHelp')}</span>
                      <button
                        className={`btn btn-sm ${transcriptStatus === 'confirmed' ? 'btn-subtle' : 'btn-ghost'}`}
                        type="button"
                        disabled={saving || !transcript.trim() || transcribing || transcriptStatus === 'confirmed'}
                        onClick={() => void confirmTranscript()}
                      >
                        <Icon name="check" />
                        {transcriptStatus === 'confirmed' ? t('composer.confirmed') : t('composer.confirm')}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}

              {mode === 'text' ? (
                <div className="transcript">
                  <div className="transcript-head">
                    <span>{t('composer.text')}</span>
                  </div>
                  <textarea
                    aria-label={t('composer.text')}
                    style={{ minHeight: 170 }}
                    value={text}
                    maxLength={2000}
                    onChange={(event) => setText(event.target.value)}
                  />
                  <div className="transcript-foot">
                    <span>{t('composer.transcriptHelp')}</span>
                  </div>
                </div>
              ) : null}

              {mode === 'photo' ? (
                <>
                  <label className="dropzone" htmlFor="instruction-photo">
                    <span className="dz-ic">
                      {photoUploading ? <Icon name="loader" className="spin" /> : <Icon name="file" />}
                    </span>
                    <strong>{hasPhoto ? t('composer.photoAdded') : t('composer.photoPick')}</strong>
                    <span>{photoName ?? 'JPG · PNG · WEBP · compressed to 1,600px'}</span>
                  </label>
                  <input
                    id="instruction-photo"
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadPhoto(file);
                      event.target.value = '';
                    }}
                  />
                  <div className="field" style={{ marginTop: 12 }}>
                    <label>{t('composer.message')}</label>
                    <textarea
                      className="textarea"
                      value={text}
                      maxLength={2000}
                      placeholder={t('composer.message')}
                      onChange={(event) => setText(event.target.value)}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="compose-actions">
            <button className="btn btn-subtle" type="button" disabled={savingDraft} onClick={() => void saveDraft()}>
              {savingDraft ? t('composer.saving') : t('composer.saveDraft')}
            </button>
            <button className="btn btn-primary" type="button" onClick={() => void goAudience()}>
              {t('composer.nextAudience')}
              <Icon name="arrowRight" />
            </button>
          </div>
        </div>

        <aside className="compose-side">
          <div className="card side-card">
            <h3>{t('composer.audience')}</h3>
            <div className="audience-box">
              <span className="a-ic">
                <Icon name="users" />
              </span>
              <div>
                <strong>{crew?.name ?? t('composer.chooseCrew')}</strong>
                <span>
                  {crew ? t('detail.audienceCount', { n: crew.workerCount }) : me.org.name}
                </span>
              </div>
            </div>
            <div className="side-langs">
              {LANGUAGES.map((language) => (
                <span className="lang-dot" key={language}>
                  <i />
                  {LANGUAGE_META[language].nativeLabel}
                </span>
              ))}
            </div>
          </div>
          <div className="tip-card">
            <Icon name="sparkles" />
            <span>{t('composer.tip')}</span>
          </div>
        </aside>
      </div>
    </>
  );
}
