import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  LANGUAGES,
  LANGUAGE_META,
  isLanguage,
  type Language,
} from "@understood/shared";
import { portalStrings, helpLabels } from "./portal-i18n";
import "./portal.css";
type Row = Record<string, any>;
const BASE = "/api/v1/portal";
const id = (row: Row) => String(row.id ?? row._id ?? "");
const list = (value: unknown): Row[] => (Array.isArray(value) ? value : []);
const when = (value: unknown, lang: Language) =>
  value ? new Date(String(value)).toLocaleString(lang) : "";
async function request<T = Row>(
  path: string,
  body?: unknown,
  method?: string,
  key?: string,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (!(body instanceof FormData) && body !== undefined)
    headers["Content-Type"] = "application/json";
  if (key) headers["Idempotency-Key"] = key;
  const result = await fetch(`${BASE}${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers,
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(
      data.error?.message ?? `Request failed (${result.status})`,
    ) as Error & { status: number };
    error.status = result.status;
    throw error;
  }
  return data.data as T;
}
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
interface Queued {
  key: string;
  path: string;
  body: unknown;
  workerId: string;
  error?: string;
}
function clearLocal() {
  for (const key of Object.keys(localStorage)) {
    if (
      key.startsWith("understood.portal.") ||
      key.startsWith("understood.worker.")
    )
      localStorage.removeItem(key);
  }
  if ("caches" in window)
    void caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("understood-"))
            .map((key) => caches.delete(key)),
        ),
      );
}
function LanguagePicker({
  value,
  onChange,
  label,
}: {
  value: Language;
  onChange: (value: Language) => void;
  label: string;
}) {
  return (
    <label className="wp-field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Language)}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {LANGUAGE_META[lang].nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
function PushToggle({
  label,
  onNotice,
}: {
  label: string;
  onNotice: (text: string) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  return (
    <button
      className="wp-button secondary"
      disabled={enabled}
      onClick={async () => {
        try {
          if (!("serviceWorker" in navigator) || !("PushManager" in window))
            throw new Error(
              "Browser push is unavailable on this device. In-app notifications remain available.",
            );
          const data = await request<Row>("/push-key");
          if (!data.enabled || !data.publicKey)
            throw new Error(
              "Push is not configured. In-app notifications remain available.",
            );
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;
          const registration = await navigator.serviceWorker.register(
            "/i/sw.js",
            { scope: "/i/" },
          );
          await navigator.serviceWorker.ready;
          const key = data.publicKey.replace(/-/g, "+").replace(/_/g, "/");
          const bytes = Uint8Array.from(
            atob(key + "=".repeat((4 - (key.length % 4)) % 4)),
            (char) => char.charCodeAt(0),
          );
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: bytes,
          });
          await request("/push-subscriptions", {
            subscription: subscription.toJSON(),
          });
          setEnabled(true);
          onNotice("Notifications enabled.");
        } catch (error) {
          onNotice(message(error));
        }
      }}
    >
      {enabled ? "✓ " : ""}
      {label}
    </button>
  );
}
export default function WorkerPortal() {
  const browser = (navigator.language ?? "en").split("-")[0];
  const [language, setLanguage] = useState<Language>(
    isLanguage(browser) ? browser : "en",
  );
  const s = portalStrings(language);
  const meta = LANGUAGE_META[language];
  const [boot, setBoot] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    companyId: "",
    workerId: "",
    password: "",
    sharedDevice: false,
  });
  const [detail, setDetail] = useState<Row | null>(null);
  const [tab, setTab] = useState("instructions");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [firstLanguage, setFirstLanguage] = useState(false);
  const queueRef = useRef<Queued[]>([]);
  const sessionRef = useRef<Row | null>(null);
  const flushing = useRef(false);
  const setPending = (next: Queued[]) => {
    queueRef.current = next;
    setQueue(next);
    const current = sessionRef.current;
    if (current && !current.sharedDevice) {
      localStorage.setItem(
        `understood.portal.queue.${id(current.worker)}`,
        JSON.stringify(next),
      );
    }
  };
  const load = async () => {
    try {
      const data = await request<Row>("/bootstrap");
      sessionRef.current = data;
      setBoot(data);
      if (isLanguage(data.worker?.language)) setLanguage(data.worker.language);
      setFirstLanguage(data.worker?.languageSelected === false);
      if (!data.sharedDevice) {
        try {
          const pending = JSON.parse(
            localStorage.getItem(
              `understood.portal.queue.${id(data.worker)}`,
            ) || "[]",
          );
          setPending(Array.isArray(pending) ? pending : []);
        } catch {
          setPending([]);
        }
      }
      return data;
    } catch (err) {
      if ((err as Row).status === 401) {
        setBoot(null);
        sessionRef.current = null;
      }
      throw err;
    }
  };
  useEffect(() => {
    void (async () => {
      try {
        if (sessionStorage.getItem("understood.portal.locked")) {
          await request("/auth/logout", {});
          sessionStorage.removeItem("understood.portal.locked");
        }
        await load();
      } catch {
        /* sign-in state */
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = meta.dir;
  }, [language]);
  const open = async (assignmentId: string) => {
    setError("");
    try {
      const data = await request<Row>(`/assignments/${assignmentId}`);
      setDetail(data.assignment ?? data);
    } catch (err) {
      const cached =
        sessionRef.current && !sessionRef.current.sharedDevice
          ? localStorage.getItem(
              `understood.portal.content.${id(sessionRef.current.worker)}.${assignmentId}`,
            )
          : null;
      if (cached) {
        try {
          setDetail(JSON.parse(cached));
          setNotice(s.offline);
        } catch {
          setError(message(err));
        }
      } else setError(message(err));
    }
  };
  const flush = async () => {
    if (flushing.current || !navigator.onLine || !sessionRef.current) return;
    flushing.current = true;
    try {
      const pending = [...queueRef.current];
      while (pending.length) {
        const item = pending[0]!;
        if (item.workerId !== id(sessionRef.current.worker)) break;
        try {
          await request(item.path, item.body, "POST", item.key);
          pending.shift();
          setPending([...pending]);
        } catch (err) {
          item.error = message(err);
          setPending([...pending]);
          setError(`${s.pendingSync}: ${item.error}`);
          break;
        }
      }
      if (!pending.length) {
        await load();
        if (detail) await open(id(detail));
      }
    } finally {
      flushing.current = false;
    }
  };
  useEffect(() => {
    const connected = () => {
      setOnline(true);
      setNotice(s.connection);
      void flush();
    };
    const disconnected = () => setOnline(false);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, [boot, detail, language]);
  useEffect(() => {
    if (!boot || !online || !queue.length) return;
    const timer = window.setInterval(() => void flush(), 15000);
    return () => window.clearInterval(timer);
  }, [boot?.worker?.id, online, queue.length]);
  useEffect(() => {
    if (!boot || !online || firstLanguage || tab === 'settings') return;
    const timer=window.setInterval(()=>{
      void load().then(()=>{if(detail) return open(id(detail));}).catch(()=>undefined);
    },20000);
    return ()=>window.clearInterval(timer);
  },[boot?.worker?.id,detail?.id,tab,online,firstLanguage]);
  const login = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/auth/login", form);
      sessionStorage.removeItem("understood.portal.locked");
      clearLocal();
      setForm({ ...form, password: "" });
      await load();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    sessionStorage.setItem("understood.portal.locked", "true");
    clearLocal();
    setPending([]);
    setBoot(null);
    setDetail(null);
    sessionRef.current = null;
    try {
      await request("/auth/logout", {});
      sessionStorage.removeItem("understood.portal.locked");
    } catch {
      setError(s.offline);
    }
  };
  const mutate = async (path: string, body: unknown, queueable = true) => {
    setBusy(true);
    setError("");
    const entry: Queued = {
      key: crypto.randomUUID(),
      path,
      body,
      workerId: id(boot!.worker),
    };
    try {
      await request(path, body, "POST", entry.key);
      await load();
      if (detail) await open(id(detail));
      setNotice(s.requestSent);
      return true;
    } catch (err) {
      const status = (err as Row).status;
      if (queueable && (!status || status >= 500 || status === 429)) {
        setPending([...queueRef.current, entry]);
        setNotice(s.pendingSync);
      } else setError(message(err));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const changeLanguage = async () => {
    setBusy(true);
    try {
      await request("/language", { language });
      await load();
      setFirstLanguage(false);
      setNotice(s.requestSent);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  const saveOffline = () => {
    if (!detail || !boot || boot.sharedDevice) return;
    try {
      localStorage.setItem(
        `understood.portal.content.${id(boot.worker)}.${id(detail)}`,
        JSON.stringify(detail),
      );
      void fetch('/i/').catch(() => undefined);
      setNotice(s.saveOffline + " ✓");
    } catch {
      setError(s.error);
    }
  };
  if (loading)
    return (
      <div className="wp-loading">
        <b>u</b>
        <span>Understood</span>
      </div>
    );
  const alerts = (
    <>
      {!online && (
        <div className="wp-notice offline" role="status">
          ◌ {s.offline}
        </div>
      )}
      {error && (
        <div className="wp-error" role="alert">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {notice && (
        <div className="wp-notice" role="status">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
    </>
  );
  if (!boot)
    return (
      <div className="wp-app wp-login" dir={meta.dir}>
        <div className="wp-brand">
          <b>u</b>Understood
        </div>
        <div className="wp-login-card">
          <h1>{s.signIn}</h1>
          <LanguagePicker
            value={language}
            onChange={setLanguage}
            label={s.language}
          />
          {alerts}
          <form onSubmit={login}>
            <label className="wp-field">
              <span>{s.companyId}</span>
              <input
                autoComplete="organization"
                required
                value={form.companyId}
                onChange={(e) =>
                  setForm({ ...form, companyId: e.target.value })
                }
              />
            </label>
            <label className="wp-field">
              <span>{s.workerId}</span>
              <input
                autoComplete="username"
                required
                value={form.workerId}
                onChange={(e) => setForm({ ...form, workerId: e.target.value })}
              />
            </label>
            <label className="wp-field">
              <span>{s.password}</span>
              <input
                type="password"
                autoComplete={form.sharedDevice ? "off" : "current-password"}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label className="wp-checkbox">
              <input
                type="checkbox"
                checked={form.sharedDevice}
                onChange={(e) =>
                  setForm({ ...form, sharedDevice: e.target.checked })
                }
              />
              {s.sharedDevice}
            </label>
            {form.sharedDevice && <p className="wp-muted">{s.sharedNotice}</p>}
            <button
              className="wp-button"
              disabled={busy || !online}
              type="submit"
            >
              {s.signIn} →
            </button>
          </form>
        </div>
      </div>
    );
  if (firstLanguage)
    return (
      <div className="wp-app wp-first-language" dir={meta.dir}>
        <div className="wp-login-card">
          <div className="wp-brand">
            <b>u</b>Understood
          </div>
          <h1>{s.selectLanguage}</h1>
          <LanguagePicker
            value={language}
            onChange={setLanguage}
            label={s.language}
          />
          {alerts}
          <button
            className="wp-button"
            disabled={busy}
            onClick={() => void changeLanguage()}
          >
            {s.continue} →
          </button>
        </div>
      </div>
    );
  const assignments = list(boot.assignments);
  const filtered = assignments.filter((a) =>
    tab === "history"
      ? Boolean(a.completedAt || ["withdrawn", "archived"].includes(a.status))
      : !a.completedAt && !["withdrawn", "archived"].includes(a.status),
  );
  return (
    <div className="wp-app" dir={meta.dir}>
      <header className="wp-header">
        <div className="wp-brand">
          <b>u</b>Understood
        </div>
        <button
          className="wp-avatar"
          onClick={() => {
            setDetail(null);
            setTab("settings");
          }}
          aria-label={s.language}
        >
          {String(boot.worker?.name || "").slice(0, 2)}
        </button>
      </header>
      <main className="wp-content">
        {alerts}
        {queue.length > 0 && (
          <div className="wp-queue">
            <strong>
              {s.pendingSync} ({queue.length})
            </strong>
            {queue.some((q) => q.error) && (
              <p>{queue.find((q) => q.error)?.error}</p>
            )}
            <button
              className="wp-button secondary"
              disabled={!online || busy}
              onClick={() => void flush()}
            >
              {s.retry}
            </button>
          </div>
        )}
        {detail ? (
          <Assignment
            detail={detail}
            language={language}
            shared={boot.sharedDevice}
            busy={busy}
            mutate={mutate}
            onBack={() => {
              setDetail(null);
              void load();
            }}
            onSave={saveOffline}
            onError={setError}
          />
        ) : (
          <>
            <div className="wp-welcome">
              <p>{boot.org?.name}</p>
              <h1>{boot.worker?.name}</h1>
              <span>
                {boot.worker?.workerId}
                {boot.worker?.crew?.name ? ` · ${boot.worker.crew.name}` : ""}
              </span>
            </div>
            <nav className="wp-tabs">
              {[
                ["instructions", s.instructions],
                ["history", s.history],
                ["notifications", s.notifications],
                ["settings", s.language],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => setTab(key!)}
                >
                  {label}
                </button>
              ))}
            </nav>
            {["instructions", "history"].includes(tab) &&
              (filtered.length ? (
                <div className="wp-assignment-list">
                  {filtered.map((a) => (
                    <button
                      key={id(a)}
                      className="wp-assignment-card"
                      onClick={() => void open(id(a))}
                    >
                      <span className="wp-card-icon">▤</span>
                      <div>
                        <h2>{a.title || s.instructions}</h2>
                        <p>
                          {a.completedAt
                            ? s.complete
                            : a.help?.open
                              ? s.help
                              : a.acknowledgedAt
                                ? s.ackReceipt
                                : a.status === "waiting"
                                  ? s.pending
                                  : a.needsAnswer
                                    ? s.answer
                                    : s.instructions}
                        </p>
                        {a.deadline && (
                          <small>
                            {s.deadline}: {when(a.deadline, language)}
                          </small>
                        )}
                      </div>
                      <span className="wp-arrow">→</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="wp-empty">
                  <span>▤</span>
                  <p>{s.noInstructions}</p>
                </div>
              ))}
            {tab === "notifications" && (
              <>
                <button
                  className="wp-button secondary"
                  onClick={() =>
                    void request("/notifications/read", {})
                      .then(load)
                      .catch((e) => setError(message(e)))
                  }
                >
                  {s.review}
                </button>
                {list(boot.notifications).map((n) => (
                  <article className="wp-card" key={id(n)}>
                    <h2>{n.title || n.type}</h2>
                    <p>{n.body || n.text || n.message}</p>
                    <small>{when(n.createdAt, language)}</small>
                  </article>
                ))}
                <PushToggle label={s.notifications} onNotice={setNotice} />
              </>
            )}
            {tab === "settings" && (
              <section className="wp-card">
                <LanguagePicker
                  value={language}
                  onChange={setLanguage}
                  label={s.language}
                />
                {boot.worker?.requestedLanguage && (
                  <p className="wp-notice">
                    {s.pending}:{" "}
                    {
                      LANGUAGE_META[boot.worker.requestedLanguage as Language]
                        ?.nativeLabel
                    }
                  </p>
                )}
                <button
                  className="wp-button"
                  disabled={busy}
                  onClick={() => void changeLanguage()}
                >
                  {s.requestLanguage}
                </button>
                {boot.sharedDevice && (
                  <p className="wp-muted">{s.sharedNotice}</p>
                )}
                <button
                  className="wp-button secondary"
                  onClick={() => {
                    clearLocal();
                    setPending([]);
                    setNotice(s.clearSaved + " ✓");
                  }}
                >
                  {s.clearSaved}
                </button>
                <button
                  className="wp-button danger"
                  onClick={() => void logout()}
                >
                  {s.signOut}
                </button>
              </section>
            )}
          </>
        )}
        <footer className="wp-footer">{s.completionNote}</footer>
      </main>
    </div>
  );
}
function Assignment({
  detail,
  language,
  shared,
  busy,
  mutate,
  onBack,
  onSave,
  onError,
}: {
  detail: Row;
  language: Language;
  shared: boolean;
  busy: boolean;
  mutate: (
    path: string,
    body: unknown,
    queueable?: boolean,
  ) => Promise<boolean>;
  onBack: () => void;
  onSave: () => void;
  onError: (text: string) => void;
}) {
  const s = portalStrings(language);
  const content = detail.snapshot ?? {};
  const [selected, setSelected] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<Row | null>(null);
  const [uploading, setUploading] = useState(false);
  const [help, setHelp] = useState(false);
  const [reason, setReason] = useState("dont_understand");
  const [responseText, setResponseText] = useState("");
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<Blob | null>(null);
  const [recordUrl, setRecordUrl] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const base = `/assignments/${id(detail)}`;
  useEffect(() => {
    setSelected(null);
    setText("");
    setPhoto(null);
  }, [detail.id]);
  useEffect(
    () => () => {
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
      if (recordUrl) URL.revokeObjectURL(recordUrl);
    },
    [recordUrl],
  );
  const upload = async (file: Blob) => {
    const body = new FormData();
    body.append("file", file, file instanceof File ? file.name : "answer.webm");
    return request<Row>("/uploads", body);
  };
  const photoUpload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      setPhoto(await upload(file));
    } catch (err) {
      onError(message(err));
    } finally {
      setUploading(false);
    }
  };
  const record = async () => {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const privacy = await request<Row>("/privacy");
      if (
        !confirm(
          language === "ar"
            ? privacy.recordingNoticeAr || privacy.recordingNotice
            : privacy.recordingNotice,
        )
      )
        return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const next = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      next.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      next.onstop = () => {
        const blob = new Blob(chunks, { type: next.mimeType });
        setRecorded(blob);
        if (recordUrl) URL.revokeObjectURL(recordUrl);
        setRecordUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.current = next;
      next.start();
      setRecording(true);
    } catch (err) {
      onError(message(err));
    }
  };
  const sendResponse = async () => {
    if (content.question?.options) {
      if (selected !== null)
        await mutate(`${base}/respond`, { optionIndex: selected });
      return;
    }
    if (recorded) {
      setUploading(true);
      try {
        const audio = await upload(recorded);
        if (await mutate(`${base}/respond`, { audioKey: audio.key }, false)) {
          setRecorded(null);
          setRecordUrl("");
        }
      } catch (err) {
        onError(message(err));
      } finally {
        setUploading(false);
      }
    } else await mutate(`${base}/respond`, { text: responseText });
  };
  const canRespond =
    !detail.completedAt &&
    !["withdrawn", "archived", "waiting"].includes(detail.status) &&
    (detail.needsAnswer !== false || !detail.acknowledgedAt);
  const answered = Boolean(
    detail.acknowledgedAt || list(detail.attempts).length,
  );
  return (
    <>
      <button className="wp-back" onClick={onBack}>
        ← {s.back}
      </button>
      <section className="wp-card wp-instruction">
        <p className="wp-caption">
          {s.instructions} · {detail.version ?? 1}
        </p>
        <h1>{content.title || detail.title}</h1>
        {content.deadline && (
          <p className="wp-deadline">
            ◷ {s.deadline}: {when(content.deadline, language)}
          </p>
        )}
        {content.demo && (
          <div className="wp-notice">
            Demo · {LANGUAGE_META[detail.language as Language]?.nativeLabel}
          </div>
        )}
        {detail.translationPending && <p className="wp-notice">{s.pending} · {s.language}</p>}
        {content.text && (
          <p
            className="wp-instruction-text"
            dir={LANGUAGE_META[(detail.language || language) as Language]?.dir}
          >
            {content.text}
          </p>
        )}
        {content.audioUrl && (
          <div className="wp-audio">
            <strong>▶ {s.listen}</strong>
            <audio controls preload="metadata" src={content.audioUrl} />
          </div>
        )}
        {list(content.attachments).length > 0 && (
          <div className="wp-attachments">
            <h3>{s.attachments}</h3>
            {list(content.attachments).map((file) => (
              <a
                key={file.key || file.url}
                href={file.url}
                target="_blank"
                rel="noreferrer"
              >
                <span>↗ {file.name}</span>
                {file.caption && <small>{file.caption}</small>}
              </a>
            ))}
          </div>
        )}
        {!shared && (
          <button className="wp-text-button" onClick={onSave}>
            ↓ {s.saveOffline}
          </button>
        )}
      </section>
      {canRespond && (
        <section className="wp-card">
          <h2>{content.questionEnabled ? s.answer : s.acknowledge}</h2>
          {content.questionEnabled && content.question ? (
            <>
              <p className="wp-question-text">{content.question.text}</p>
              {Array.isArray(content.question.options) ? (
                <div className="wp-options">
                  {content.question.options.map(
                    (option: string, index: number) => (
                      <button
                        key={index}
                        className={selected === index ? "selected" : ""}
                        onClick={() => setSelected(index)}
                      >
                        <span>{String.fromCharCode(65 + index)}</span>
                        {option}
                      </button>
                    ),
                  )}
                </div>
              ) : (
                <>
                  <label className="wp-field">
                    <span>{s.answer}</span>
                    <textarea
                      rows={4}
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                    />
                  </label>
                  <button
                    className="wp-button secondary"
                    onClick={() => void record()}
                  >
                    {recording ? s.stop : s.record}
                  </button>
                  {recordUrl && (
                    <>
                      <p>{s.review}</p>
                      <audio controls src={recordUrl} />
                    </>
                  )}
                </>
              )}
              <button
                className="wp-button"
                disabled={
                  busy ||
                  uploading ||
                  recording ||
                  (Array.isArray(content.question.options)
                    ? selected === null
                    : !responseText.trim() && !recorded)
                }
                onClick={() => void sendResponse()}
              >
                {s.send} →
              </button>
            </>
          ) : (
            <>
              {content.requirePhoto && (
                <label className="wp-field">
                  <span>{s.photo}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => void photoUpload(e.target.files?.[0])}
                  />
                    {photo && <><small>✓ {photo.name}</small>{photo.url&&<img className="wp-photo-preview" src={photo.url} alt={s.photo}/>}</>}
                </label>
              )}
              <button
                className="wp-button"
                disabled={busy || uploading || (content.requirePhoto && !photo)}
                onClick={() =>
                  void mutate(`${base}/acknowledge`, { photoKey: photo?.key })
                }
              >
                ✓ {s.acknowledge}
              </button>
            </>
          )}
        </section>
      )}
      {answered && (
        <section className="wp-card">
          <h2>{detail.completedAt ? `✓ ${s.complete}` : s.complete}</h2>
          <p className="wp-muted">{s.completionNote}</p>
          {!detail.completedAt && (
            <button
              className="wp-button"
              disabled={busy || detail.needsAnswer || detail.help?.open}
              onClick={() => void mutate(`${base}/complete`, {})}
            >
              {s.complete}
            </button>
          )}
          {detail.completedAt && (
            <small>{when(detail.completedAt, language)}</small>
          )}
        </section>
      )}
      <section className="wp-card">
        <button className="wp-button help" onClick={() => setHelp(!help)}>
          ☷ {s.help}
        </button>
        {help && (
          <>
            <label className="wp-field">
              <span>{s.help}</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="dont_understand">{s.clarify}</option>
                <option value="missing_tools">
                  ⚒ {helpLabels(language)[0]}
                </option>
                <option value="safety_concern">
                  ⚠ {helpLabels(language)[1]}
                </option>
                <option value="other">… {helpLabels(language)[2]}</option>
              </select>
            </label>
            <label className="wp-field">
              <span>{s.message}</span>
              <textarea
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <button
              className="wp-button"
              disabled={busy}
              onClick={() =>
                void mutate(`${base}/help`, { reason, text }).then((ok) => {
                  if (ok) {
                    setHelp(false);
                    setText("");
                  }
                })
              }
            >
              {s.send}
            </button>
          </>
        )}
        {detail.help?.open && <p className="wp-notice">{s.requestSent}</p>}
      </section>
      {list(detail.attempts).length > 0 && (
        <section className="wp-card">
          <h2>{s.history}</h2>
          {list(detail.attempts).map((attempt, index) => (
            <div className="wp-attempt" key={index}>
              <strong>
                {attempt.matched === true
                  ? s.matched
                  : attempt.matched === false
                    ? s.clarify
                    : s.notAssessed}
              </strong>
              <p>
                {attempt.text ??
                  content.question?.options?.[attempt.optionIndex]}
              </p>
              {attempt.audioUrl && <audio controls src={attempt.audioUrl} />}
              <small>{when(attempt.at, language)}</small>
            </div>
          ))}
        </section>
      )}
      <section className="wp-card">
        <h2>{s.message}</h2>
        <div className="wp-messages">
          {list(detail.messages).map((item, index) => (
            <article
              key={item.id || index}
              className={item.author === "staff" ? "staff" : ""}
            >
              <strong>
                {item.author === "staff" ? s.supervisor : s.worker}
              </strong>
              <p>{item.text}</p>
              <small>{when(item.at, language)}</small>
            </article>
          ))}
        </div>
        <label className="wp-field">
          <span>{s.message}</span>
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button
          className="wp-button secondary"
          disabled={busy || !text.trim()}
          onClick={() =>
            void mutate(`${base}/messages`, { text }).then((ok) => {
              if (ok) setText("");
            })
          }
        >
          {s.send} →
        </button>
      </section>
    </>
  );
}
