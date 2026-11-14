import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { LANGUAGES, LANGUAGE_META, type Language } from "@understood/shared";
import { api, download, errorMessage } from "./api";
import "./workspace.css";

type Row = Record<string, any>;
const idOf = (row: Row) => String(row.id ?? row._id ?? "");
const array = (value: unknown): Row[] => (Array.isArray(value) ? value : []);
const date = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString() : "—";
const OPS = "/api/v1/operations";
const ACCESS = "/api/v1/access";
const FIELD_TIMEZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dubai";
const nav: Array<[string, string, string, string]> = [
  ["today", "Today", "اليوم", "◉"],
  ["instructions", "Instructions", "التعليمات", "▤"],
  ["calendar", "Calendar", "التقويم", "▦"],
  ["workers", "Workers & crews", "العمال والفرق", "♙"],
  ["cases", "Follow-up", "المتابعة", "☷"],
  ["reports", "Reports", "التقارير", "↗"],
  ["resources", "Templates & glossary", "القوالب والمصطلحات", "▧"],
  ["notifications", "Notifications", "الإشعارات", "◌"],
  ["settings", "Workspace settings", "إعدادات المساحة", "⚙"],
];

function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={`ws-btn${secondary ? " secondary" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="ws-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Badge({ children }: { children: ReactNode }) {
  return <span className="ws-badge">{children}</span>;
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="ws-empty">{children}</div>;
}

function StaffAuth({
  onSignedIn,
  ar,
}: {
  onSignedIn: () => void;
  ar: boolean;
}) {
  const params = new URLSearchParams(location.search);
  const token = params.get("token") || params.get("verify") || params.get("reset") || params.get("invite") || "";
  const initialMode = location.pathname.includes("reset-password") || params.has("reset")
    ? "reset"
    : location.pathname.includes("verify-email") || params.has("verify")
      ? "verify"
      : location.pathname.includes("invitation") || params.has("invite")
        ? "invitation"
        : "login";
  const [mode, setMode] = useState(initialMode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    companyName: "",
    name: "",
    token,
  });
  const set = (key: string, value: string) =>
    setForm({ ...form, [key]: value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "login") {
        await api("/api/v1/auth/login", {
          method: "POST",
          body: { email: form.email, password: form.password },
        });
        history.replaceState(null, "", "/");
        onSignedIn();
      }
      if (mode === "register") {
        await api("/api/v1/auth/register", {
          method: "POST",
          body: {
            companyName: form.companyName,
            name: form.name,
            email: form.email,
            password: form.password,
            timezone: FIELD_TIMEZONE,
          },
        });
        setMessage(
          ar
            ? "تحقق من بريدك الإلكتروني لتفعيل الحساب."
            : "Check your email to verify your account.",
        );
      }
      if (mode === "forgot") {
        await api("/api/v1/auth/forgot-password", {
          method: "POST",
          body: { email: form.email },
        });
        setMessage(
          ar
            ? "إذا كان الحساب موجوداً، ستصلك رسالة استعادة."
            : "If an account exists, a recovery email is on its way.",
        );
      }
      if (mode === "reset") {
        await api("/api/v1/auth/reset-password", {
          method: "POST",
          body: { token: form.token, password: form.password },
        });
        setMode("login");
        setMessage("Password updated. Sign in with your new password.");
      }
      if (mode === "verify") {
        await api("/api/v1/auth/verify-email", {
          method: "POST",
          body: { token: form.token },
        });
        setMode("login");
        setMessage("Email verified. You can now sign in.");
      }
      if (mode === "invitation") {
        await api("/api/v1/auth/accept-invitation", {
          method: "POST",
          body: { token: form.token, name: form.name, password: form.password },
        });
        setMode("login");
        setMessage("Invitation accepted. Sign in to your workspace.");
      }
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const text =
    mode === "register"
      ? ["Create your company workspace", "أنشئ مساحة شركتك"]
      : mode === "forgot"
        ? ["Recover your account", "استعادة الحساب"]
        : mode === "reset"
          ? ["Set a new password", "كلمة مرور جديدة"]
          : mode === "verify"
            ? ["Verify your email", "تحقق من بريدك"]
            : mode === "invitation"
              ? ["Join your team", "انضم إلى فريقك"]
              : ["Welcome back", "مرحباً بعودتك"];
  return (
    <div className="ws-auth">
      <section className="ws-auth-story">
        <div className="ws-brand">
          u<span>Understood</span>
        </div>
        <Badge>
          {ar
            ? "تواصل واضح. فرق متصلة."
            : "Clear communication. Connected teams."}
        </Badge>
        <h1>
          {ar ? "تعليمات واضحة، بكل لغة." : "One instruction. Every language."}
        </h1>
        <p>
          {ar
            ? "أرسل التعليمات، تابع الردود، وساعد من يحتاج إلى توضيح."
            : "Give your team clear instructions, see their responses, and follow up where it matters."}
        </p>
        <div className="ws-language-cloud">
          {[
            "العربية",
            "English",
            "हिन्दी",
            "اردو",
            "বাংলা",
            "தமிழ்",
            "Filipino",
            "Bahasa Indonesia",
          ].map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <small>
          {ar
            ? "التواصل والاستجابة وإنجاز العمل مراحل منفصلة."
            : "Communication, response, and actual work completion—tracked separately."}
        </small>
      </section>
      <section className="ws-auth-panel">
        <div>
          <p className="ws-eyebrow">UNDERSTOOD WORKSPACE</p>
          <h2>{text[ar ? 1 : 0]}</h2>
          <p className="ws-muted">
            {ar
              ? "حسابات الموظفين للشركات والفرق."
              : "A focused workspace for your company and crew."}
          </p>
          <form onSubmit={submit}>
            {mode === "register" && (
              <Field label={ar ? "اسم الشركة" : "Company name"}>
                <input
                  value={form.companyName}
                  required
                  onChange={(e) => set("companyName", e.target.value)}
                />
              </Field>
            )}
            {(mode === "register" || mode === "invitation") && (
              <Field label={ar ? "اسمك" : "Your name"}>
                <input
                  value={form.name}
                  required
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
            )}
            {["login", "register", "forgot"].includes(mode) && (
              <Field label={ar ? "بريد العمل الإلكتروني" : "Work email"}>
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  required
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
            )}
            {["login", "register", "reset", "invitation"].includes(mode) && (
              <Field label={ar ? "كلمة المرور" : "Password"}>
                <input
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={mode === "login" ? 1 : 12}
                  value={form.password}
                  required
                  onChange={(e) => set("password", e.target.value)}
                />
              </Field>
            )}
            {["verify", "reset", "invitation"].includes(mode) && !token && (
              <Field label="Token from your email">
                <input
                  value={form.token}
                  required
                  onChange={(e) => set("token", e.target.value)}
                />
              </Field>
            )}
            {message && (
              <p role="status" className="ws-notice">
                {message}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy
                ? ar
                  ? "جارٍ الإرسال…"
                  : "Please wait…"
                : mode === "login"
                  ? ar
                    ? "تسجيل الدخول"
                    : "Sign in"
                  : mode === "register"
                    ? ar
                      ? "إنشاء الحساب"
                      : "Create workspace"
                    : ar
                      ? "متابعة"
                      : "Continue"}
            </Button>
          </form>
          <div className="ws-auth-links">
            <button
              onClick={() => {
                setMode(mode === "register" ? "login" : "register");
                setMessage("");
              }}
            >
              {mode === "register"
                ? "Already registered? Sign in"
                : "Create a company workspace"}
            </button>
            <button onClick={() => setMode("forgot")}>Forgot password?</button>
          </div>
          <a className="ws-worker-link" href="/i/">
            {ar ? "أنا عامل ←" : "I’m a worker →"}
          </a>
        </div>
      </section>
    </div>
  );
}

export default function WorkspaceApp() {
  const [workspace, setWorkspace] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("today");
  const [site, setSite] = useState("");
  const [ar, setAr] = useState(
    localStorage.getItem("understood.staff.locale") === "ar",
  );
  const [data, setData] = useState<Row>({});
  const [detail, setDetail] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const tr = (en: string, arabic: string) => (ar ? arabic : en);
  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 5000);
  };
  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const { data: result } = await api<Row>(`${ACCESS}/workspace`);
      setWorkspace(result);
      setDetail(null);
      setData({});
      setPage(result.entitlement?.active === false || result.user?.role === 'administrator' ? 'settings' : 'today');
      if (result.user?.role === "administrator") setPage("settings");
      setSite(
        (old) => old || array(result.sites).find((s) => !s.archived)?.id || "",
      );
    } catch {
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void loadWorkspace();
  }, []);
  useEffect(() => {
    document.documentElement.dir = ar ? "rtl" : "ltr";
    document.documentElement.lang = ar ? "ar" : "en";
    localStorage.setItem("understood.staff.locale", ar ? "ar" : "en");
  }, [ar]);
  const siteQuery = `siteId=${encodeURIComponent(site)}`;
  const load = async () => {
    if (!workspace) return;
    setError("");
    try {
      if (
        workspace.user.role !== "administrator" &&
        workspace.entitlement?.active !== false
      ) {
        const { data: bootstrap } = await api<Row>(
          `${OPS}/bootstrap?${siteQuery}`,
        );
        setData(bootstrap);
      }
      if (page === "settings") {
        const staff = ["owner", "administrator"].includes(workspace.user.role)
          ? (await api<Row>(`${ACCESS}/staff`)).data.users
          : [];
        const requests =
          ["owner", "supervisor"].includes(workspace.user.role) &&
          workspace.entitlement?.active !== false
            ? (await api<Row[]>(`${OPS}/workers?${siteQuery}`)).data
            : [];
        const privacy =
          workspace.user.role === "owner"
            ? (await api<Row>(`${OPS}/privacy`)).data
            : null;
        const invoices =
          workspace.user.role === "owner"
            ? (await api<Row[]>(`${ACCESS}/invoices`)).data
            : [];
        setData((old) => ({
          ...old,
          staff,
          languageRequests: array(requests).filter((w) => w.requestedLanguage),
          privacy,
          invoices,
        }));
      }
      if (page === "resources") {
        const [templates, glossary] = await Promise.all([
          api<Row[]>(`${OPS}/templates`),
          api<Row[]>(`${OPS}/glossary`),
        ]);
        setData((old) => ({
          ...old,
          templates: templates.data,
          glossary: glossary.data,
        }));
      }
      if (page === "cases") {
        const cases = await api<Row[]>(`${OPS}/cases?${siteQuery}`);
        const operationalStaff = ['owner','supervisor'].includes(workspace.user.role) ? (await api<Row[]>(`${ACCESS}/operational-staff?${siteQuery}`)).data : [];
        setData((old) => ({ ...old, cases: cases.data, operationalStaff }));
      }
      if (page === "reports") {
        const report = await api<Row>(`${OPS}/reports?${siteQuery}`);
        setData((old) => ({ ...old, report: report.data }));
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  useEffect(() => {
    void load();
  }, [page, site, workspace]);
  useEffect(() => {
    if (!workspace) return;
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [workspace, page, site]);
  const act = async (path: string, body: unknown = {}, method = "POST") => {
    setBusy(true);
    setError("");
    try {
      const result = await api<Row>(path, { method, body });
      notify(tr("Saved successfully", "تم الحفظ"));
      await load();
      return result.data;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  };
  const open = async (id: string) => {
    setError("");
    try {
      const { data: result } = await api<Row>(`${OPS}/instructions/${id}`);
      setDetail(result);
      setPage("detail");
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const signout = async () => {
    try {
      await api("/api/v1/auth/logout", { method: "POST" });
      setWorkspace(null);
      setData({});setDetail(null);setSite('');setPage('today');
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  if (loading)
    return (
      <div className="ws-loading">
        Understood<span>Preparing your workspace…</span>
      </div>
    );
  if (!workspace)
    return (
      <>
        <div className="ws-language-toggle">
          <Button secondary onClick={() => setAr(!ar)}>
            {ar ? "English" : "العربية"}
          </Button>
        </div>
        <StaffAuth onSignedIn={() => void loadWorkspace()} ar={ar} />
      </>
    );
  const role = workspace.user?.role ?? "owner";
  const canWrite = ["owner", "supervisor"].includes(role);
  const canAdmin = ["owner", "administrator"].includes(role);
  const active = workspace.entitlement?.active !== false;
  const instructions = array(data.instructions).filter((row) =>
    `${row.title} ${row.text}`.toLowerCase().includes(query.toLowerCase()),
  );
  const workers = array(data.workers);
  const crews = array(data.crews);
  const currentTitle =
    nav.find((n) => n[0] === page)?.[ar ? 2 : 1] ??
    (page === "compose"
      ? tr("New instruction", "تعليمات جديدة")
      : tr("Instruction details", "تفاصيل التعليمات"));
  const instructionList = (rows: Row[]) =>
    rows.length ? (
      <div className="ws-list">
        {rows.map((row) => (
          <button
            key={idOf(row)}
            className="ws-instruction-row"
            onClick={() => void open(idOf(row))}
          >
            <span className="ws-doc-icon">▤</span>
            <span>
              <strong>
                {row.title || tr("Untitled instruction", "تعليمات دون عنوان")}
              </strong>
              <small>
                {date(row.publishedAt || row.scheduledAt || row.createdAt)}
                {row.deadline
                  ? ` · ${tr("Due", "الموعد")} ${date(row.deadline)}`
                  : ""}
              </small>
            </span>
            <Badge>{row.status}</Badge>
            <span className="ws-row-arrow">↗</span>
          </button>
        ))}
      </div>
    ) : (
      <Empty>
        {tr(
          "No instructions yet. Create the first one for your team.",
          "لا توجد تعليمات بعد. أنشئ أول تعليمات لفريقك.",
        )}
      </Empty>
    );
  return (
    <div className="ws-shell">
      <aside className="ws-sidebar">
        <div className="ws-brand">
          u<span>Understood</span>
        </div>
        <div className="ws-company">
          <span>
            {String(workspace.org?.name ?? "U")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div>
            <strong>{workspace.org?.name}</strong>
            <small>{role}</small>
          </div>
        </div>
        <nav>
          {nav
            .filter(([key]) =>
              role === "administrator"
                ? key === "settings"
                : active || key === "settings",
            )
            .map(([key, en, arabic, icon]) => (
              <button
                key={key}
                className={page === key ? "active" : ""}
                onClick={() => {
                  setPage(key);
                  setDetail(null);
                  setQuery("");
                }}
              >
                <span>{icon}</span>
                {ar ? arabic : en}
                {key === "cases" && data.stats?.openCases ? (
                  <b>{data.stats.openCases}</b>
                ) : null}
              </button>
            ))}
        </nav>
        <div className="ws-sidebar-bottom">
          <p>{tr("Your team, in every language.", "فريقك، بكل اللغات.")}</p>
          <button onClick={() => setAr(!ar)}>
            {ar ? "English" : "العربية"}
          </button>
          <button onClick={() => void signout()}>
            {tr("Sign out", "تسجيل الخروج")}
          </button>
        </div>
      </aside>
      <main className="ws-main">
        <header className="ws-topbar">
          <div>
            <small>{tr("WORKSPACE", "مساحة العمل")}</small>
            <span>{currentTitle}</span>
          </div>
          <div className="ws-topbar-actions">
            <select
              aria-label="Site"
              value={site}
              onChange={(e) => setSite(e.target.value)}
            >
              <option value="">
                {tr("All authorized sites", "كل المواقع المصرح بها")}
              </option>
              {array(workspace.sites)
                .filter((s) => !s.archived)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <a href="/i/">{tr("Worker portal", "بوابة العامل")} ↗</a>
            {canWrite && (
              <Button
                onClick={() => {
                  setDetail(null);
                  setPage("compose");
                }}
                disabled={!active}
              >
                + {tr("New instruction", "تعليمات جديدة")}
              </Button>
            )}
          </div>
        </header>
        <div className="ws-content">
          {!active && (
            <div className="ws-entitlement">
              <strong>
                {tr("Workspace access: ", "وصول المساحة: ")}
                {workspace.entitlement?.status ?? "pending"}
              </strong>
              <p>
                {tr(
                  "Your pilot begins after operator approval and lasts 30 days, for one site and up to 25 active workers. Contact the operator to activate or renew access.",
                  "تبدأ الفترة التجريبية بعد موافقة المشغل وتستمر ٣٠ يوماً، لموقع واحد و٢٥ عاملاً نشطاً كحد أقصى. تواصل مع المشغل للتفعيل أو التجديد.",
                )}
              </p>
            </div>
          )}
          {error && (
            <div role="alert" className="ws-error">
              {error}
              <button onClick={() => setError("")}>×</button>
            </div>
          )}
          {page === "today" && (
            <>
              <div className="ws-page-heading">
                <div>
                  <p className="ws-eyebrow">
                    {new Date().toLocaleDateString(ar ? "ar" : "en", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <h1>
                    {tr(
                      `Good to see you, ${String(workspace.user?.name || "").split(" ")[0]}`,
                      `مرحباً، ${String(workspace.user?.name || "").split(" ")[0]}`,
                    )}
                  </h1>
                  <p>
                    {tr(
                      "Here’s where your team needs you today.",
                      "إليك ما يحتاجه فريقك اليوم.",
                    )}
                  </p>
                </div>
                <Badge>
                  {tr("Responses ≠ work completion", "الردود ≠ إنجاز العمل")}
                </Badge>
              </div>
              <div className="ws-stats">
                {[
                  ["instructions", "Instructions", "التعليمات", "▤"],
                  ["workers", "Active workers", "العمال النشطون", "♙"],
                  ["openCases", "Need follow-up", "بحاجة للمتابعة", "☷"],
                  ["deliveryProblems", "Delivery issues", "مشاكل التسليم", "!"],
                ].map(([key, en, arabic, icon]) => (
                  <div className="ws-stat" key={key}>
                    <span>{icon}</span>
                    <small>{ar ? arabic : en}</small>
                    <strong>{data.stats?.[key!] ?? 0}</strong>
                  </div>
                ))}
              </div>
              <section className="ws-card">
                <div className="ws-card-title">
                  <div>
                    <h2>{tr("Recent instructions", "آخر التعليمات")}</h2>
                    <p>
                      {tr(
                        "A clear view of what was sent and what happens next.",
                        "عرض واضح لما أُرسل وما يأتي بعده.",
                      )}
                    </p>
                  </div>
                  <Button secondary onClick={() => setPage("instructions")}>
                    {tr("View all", "عرض الكل")} →
                  </Button>
                </div>
                {instructionList(instructions.slice(0, 6))}
              </section>
              <div className="ws-bottom-note">
                ◉{" "}
                {tr(
                  "A matching answer records a response. It does not certify understanding or safe performance.",
                  "الإجابة المطابقة تسجل رداً، ولا تثبت الفهم الكامل أو الأداء الآمن.",
                )}
              </div>
            </>
          )}
          {page === "instructions" && (
            <>
              <PageHeading
                title={tr("Instructions", "التعليمات")}
                subtitle={tr(
                  "Draft, review, send, and follow through.",
                  "اكتب وراجع وأرسل وتابع.",
                )}
              />
              <input
                className="ws-search"
                aria-label="Search instructions"
                placeholder={tr("Search instructions…", "ابحث في التعليمات…")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <section className="ws-card">
                {instructionList(instructions)}
              </section>
            </>
          )}
          {page === "calendar" && (
            <>
              <PageHeading
                title={tr("Instruction calendar", "تقويم التعليمات")}
                subtitle={tr(
                  "Scheduled sends and upcoming deadlines, shown in your browser’s time zone.",
                  "المواعيد المجدولة والنهائية حسب المنطقة الزمنية للمتصفح.",
                )}
              />
              <CalendarView instructions={instructions} ar={ar} open={open}/>
            </>
          )}
          {page === "compose" && (
            <Composer
              site={site}
              workers={workers}
              crews={crews}
              existing={detail?.instruction}
              ar={ar}
              busy={busy}
              act={act}
              onSaved={(row) => void open(idOf(row))}
            />
          )}
          {page === "detail" && detail && (
            <InstructionPage
              detail={detail}
              ar={ar}
              busy={busy}
              canWrite={canWrite && active}
              act={act}
              refresh={() => void open(idOf(detail.instruction))}
              onEdit={() => setPage("compose")}
              onCopied={(row) => void open(idOf(row))}
            />
          )}
          {page === "workers" && (
            <Roster
              workers={workers}
              crews={crews}
              site={site}
              ar={ar}
              canWrite={canWrite && active}
              act={act}
              busy={busy}
            />
          )}
          {page === "cases" && (
            <>
              <PageHeading
                title={tr("Follow-up", "المتابعة")}
                subtitle={tr(
                  "Clarify a response, request another answer, or resolve a case. Resolution does not complete the worker’s task.",
                  "وضّح الرد أو اطلب إجابة أخرى أو أغلق الحالة. إغلاق الحالة لا يعني إنجاز المهمة.",
                )}
              />
              <CaseList
                cases={array(data.cases)}
                ar={ar}
                act={act}
                canWrite={canWrite && active}
                staff={array(data.operationalStaff)}
                propose={(row) => {setDetail({instruction:{title:row.snapshot?.title??row.title,text:row.originalText??row.snapshot?.text,sourceLanguage:row.sourceLanguage??'en',siteId:row.siteId,questionEnabled:row.snapshot?.questionEnabled??true}});setPage('compose');}}
              />
            </>
          )}
          {page === "reports" && (
            <>
              <PageHeading
                title={tr(
                  "Response & completion reports",
                  "تقارير الردود والإنجاز",
                )}
                subtitle={tr(
                  "Describe the evidence precisely. Responses and worker-marked completion remain separate.",
                  "صف الأدلة بدقة. الردود وإنجاز العمل المسجل من العامل أمران منفصلان.",
                )}
              />
              <section className="ws-card ws-pad">
                <div className="ws-inline">
                  <Button
                    onClick={() =>
                      void download(
                        `${OPS}/reports.csv?${siteQuery}`,
                        "understood-report.csv",
                      ).catch((e) => setError(errorMessage(e)))
                    }
                  >
                    {tr("Export CSV", "تصدير CSV")}
                  </Button>
                </div>
                <div className="ws-report-summary">
                  {Object.entries(data.report?.summary ?? {}).map(
                    ([key, value]) => (
                      <div key={key}>
                        <small>{key.replace(/([A-Z])/g, " $1")}</small>
                        <strong>{String(value)}</strong>
                      </div>
                    ),
                  )}
                </div>
                <div className="ws-report-columns">
                  <div>
                    <h3>{tr("By language", "حسب اللغة")}</h3>
                    <DataTable
                      rows={array(data.report?.breakdowns?.languages)}
                      columns={[
                        "name",
                        "assigned",
                        "responded",
                        "matchingAnswers",
                        "completed",
                      ]}
                    />
                  </div>
                  <div>
                    <h3>{tr("By crew", "حسب الفريق")}</h3>
                    <DataTable
                      rows={array(data.report?.breakdowns?.crews)}
                      columns={[
                        "name",
                        "assigned",
                        "responded",
                        "matchingAnswers",
                        "completed",
                      ]}
                    />
                  </div>
                </div>
                <DataTable
                  rows={array(data.report?.rows)}
                  columns={[
                    "workerName",
                    "title",
                    "language",
                    "status",
                    "acknowledgedAt",
                    "matchingAnswer",
                    "completedAt",
                  ]}
                />
              </section>
            </>
          )}
          {page === "notifications" && (
            <>
              <StaffPush ar={ar} notify={notify} />
              <PageHeading
                title={tr("Notifications", "الإشعارات")}
                subtitle={tr(
                  "Updates from your team and workspace.",
                  "تحديثات الفريق ومساحة العمل.",
                )}
              />
              <Button
                secondary
                onClick={() => void act(`${OPS}/notifications/read`)}
              >
                {tr("Mark all read", "تعليم الكل كمقروء")}
              </Button>
              <section className="ws-card ws-pad">
                {array(data.notifications).length ? (
                  array(data.notifications).map((n) => (
                    <article className="ws-notification" key={idOf(n)}>
                      <Badge>{n.type || "update"}</Badge>
                      <div>
                        <strong>{n.title || n.text}</strong>
                        <p>{n.body || n.message}</p>
                        <small>{date(n.createdAt)}</small>
                      </div>
                    </article>
                  ))
                ) : (
                  <Empty>
                    {tr("You’re all caught up.", "لا توجد إشعارات جديدة.")}
                  </Empty>
                )}
              </section>
            </>
          )}
          {page === "resources" && (
            <Resources
              data={data}
              ar={ar}
              act={act}
              canWrite={canWrite && active}
              useTemplate={(row) => {
                setDetail({
                  instruction: {
                    ...row,
                    id: undefined,
                    _id: undefined,
                    siteId: site,
                  },
                });
                setPage("compose");
              }}
            />
          )}
          {page === "settings" && (
            <Settings
              workspace={workspace}
              data={data}
              ar={ar}
              act={act}
              canAdmin={canAdmin}
              onChanged={() => void loadWorkspace()}
            />
          )}
        </div>
      </main>
      {toast && (
        <div className="ws-toast" role="status">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="ws-page-heading">
      <div>
        <p className="ws-eyebrow">UNDERSTOOD</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
function DataTable({ rows, columns }: { rows: Row[]; columns: string[] }) {
  return rows.length ? (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <thead>
          <tr>
            {columns.map((key) => (
              <th key={key}>{key.replace(/([A-Z])/g, " $1")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={idOf(row) || index}>
              {columns.map((key) => (
                <td key={key}>
                  {typeof row[key] === "object"
                    ? JSON.stringify(row[key])
                    : String(row[key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>No records yet.</Empty>
  );
}
type Action = (
  path: string,
  body?: unknown,
  method?: string,
) => Promise<Row | null>;
function Composer({
  site,
  workers,
  crews,
  existing,
  ar,
  busy,
  act,
  onSaved,
}: {
  site: string;
  workers: Row[];
  crews: Row[];
  existing?: Row;
  ar: boolean;
  busy: boolean;
  act: Action;
  onSaved: (row: Row) => void;
}) {
  const tr = (en: string, arabic: string) => (ar ? arabic : en);
  const blank = {
    title: "",
    text: "",
    sourceLanguage: "en",
    deliveryMode: "both",
    questionEnabled: true,
    question: { text: "", options: ["", "", ""], correctIndex: 0 },
    workerIds: [] as string[],
    crewIds: [] as string[],
    everyone: false,
    deadline: "",
    scheduledAt: "",
    requirePhoto: false,
    attachments: [] as Row[],
    siteId: site,
  };
  const [form, setForm] = useState<Row>(() => {
    if (existing)
      return {
        ...blank,
        ...existing,
        deadline: existing.deadline
          ? new Date(existing.deadline).toISOString().slice(0, 16)
          : "",
        scheduledAt: existing.scheduledAt
          ? new Date(existing.scheduledAt).toISOString().slice(0, 16)
          : "",
      };
    try {
      return {
        ...blank,
        ...JSON.parse(
          localStorage.getItem(`understood.staff.draft.${site}`) || "{}",
        ),
      };
    } catch {
      return blank;
    }
  });
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  useEffect(() => {
    if (!idOf(existing ?? {}))
      localStorage.setItem(
        `understood.staff.draft.${site}`,
        JSON.stringify(form),
      );
  }, [form, site]);
  useEffect(
    () => () => {
      recorder?.stream.getTracks().forEach((t) => t.stop());
      if (recorder?.state === "recording") recorder.stop();
    },
    [recorder],
  );
  const patch = (values: Row) => setForm((old) => ({ ...old, ...values }));
  const transcribe = async (file: Blob) => {
    setUploading(true);
    setNotice("");
    try {
      const body = new FormData();
      body.append(
        "file",
        file,
        file instanceof File ? file.name : "recording.webm",
      );
      const { data } = await api<Row>(`${OPS}/transcribe`, {
        method: "POST",
        body,
      });
      patch({
        text: data.text,
        sourceLanguage: data.sourceLanguage || form.sourceLanguage,
      });
      setNotice(
        tr(
          "Transcription added. Review it before continuing.",
          "تمت إضافة النص. راجعه قبل المتابعة.",
        ),
      );
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };
  const record = async () => {
    if (recording) {
      recorder?.stop();
      setRecording(false);
      return;
    }
    try {
      const privacy = (await api<Row>(`${OPS}/privacy`)).data;
      if (
        !confirm(
          ar
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
        stream.getTracks().forEach((t) => t.stop());
        void transcribe(new Blob(chunks, { type: next.mimeType }));
      };
      next.start();
      setRecorder(next);
      setRecording(true);
    } catch (err) {
      setNotice(errorMessage(err));
    }
  };
  const upload = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    try {
      const attachments = [...form.attachments];
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("file", file);
        const { data } = await api<Row>(`${OPS}/uploads`, {
          method: "POST",
          body,
        });
        attachments.push({ ...data, caption: "" });
      }
      patch({ attachments });
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };
  const toggle = (key: "workerIds" | "crewIds", id: string) =>
    patch({
      [key]: form[key].includes(id)
        ? form[key].filter((value: string) => value !== id)
        : [...form[key], id],
    });
  const save = async () => {
    setNotice("");
    if (!form.title.trim() || !(form.siteId || site)) {
      setNotice(tr("Add a title and select a site first.", "أضف عنواناً واختر موقعاً أولاً."));
      return;
    }
    const body: Row = {
      title: form.title,
      text: form.text,
      sourceLanguage: form.sourceLanguage,
      deliveryMode: form.deliveryMode,
      questionEnabled: form.questionEnabled,
      requirePhoto: form.requirePhoto,
      workerIds: form.workerIds,
      crewIds: form.crewIds,
      everyone: form.everyone,
      attachments: form.attachments.map(
        ({ key, name, mime, caption }: Row) => ({ key, name, mime, caption }),
      ),
      siteId: form.siteId || site,
      question:
        form.questionEnabled && form.question?.text ? form.question : undefined,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      scheduledAt: form.scheduledAt
        ? new Date(form.scheduledAt).toISOString()
        : null,
    };
    delete body.id;
    delete body._id;
    delete body.createdAt;
    delete body.updatedAt;
    delete body.variants;
    delete body.publications;
    delete body.status;
    delete body.version;
    const row = await act(
      `${OPS}/instructions${idOf(existing ?? {}) ? `/${idOf(existing!)}` : ""}`,
      body,
      idOf(existing ?? {}) ? "PATCH" : "POST",
    );
    if (row) {
      localStorage.removeItem(`understood.staff.draft.${site}`);
      if (step === 2) await act(`${OPS}/instructions/${idOf(row)}/prepare`);
      onSaved(row);
    }
  };
  const recipientIds = new Set(
    workers
      .filter(
        (w) =>
          form.everyone ||
          form.workerIds.includes(idOf(w)) ||
          form.crewIds.includes(String(w.crewId)),
      )
      .map(idOf),
  );
  return (
    <>
      <PageHeading
        title={
          idOf(existing ?? {})
            ? tr("Update instruction", "تحديث التعليمات")
            : tr("Create an instruction", "إنشاء تعليمات")
        }
        subtitle={tr(
          "Say it clearly. Choose the right people. Review before sending.",
          "وضّح المحتوى وحدد الأشخاص وراجع قبل الإرسال.",
        )}
      />
      <div className="ws-stepper">
        {[
          tr("Content", "المحتوى"),
          tr("Recipients", "المستلمون"),
          tr("Review & send", "المراجعة والإرسال"),
        ].map((label, index) => (
          <button
            key={label}
            className={step === index ? "active" : step > index ? "done" : ""}
            onClick={() => setStep(index)}
          >
            <span>{index + 1}</span>
            {label}
          </button>
        ))}
      </div>
      <section className="ws-card ws-pad ws-composer">
        {notice && (
          <p role="status" className="ws-notice">
            {notice}
          </p>
        )}
        {step === 0 && (
          <>
            <div className="ws-form-grid">
              <Field label={tr("Instruction title", "عنوان التعليمات")}>
                <input
                  required
                  value={form.title}
                  maxLength={120}
                  placeholder={tr(
                    "e.g. Prepare the loading area",
                    "مثال: تجهيز منطقة التحميل",
                  )}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </Field>
              <Field label={tr("Source language", "لغة المصدر")}>
                <select
                  value={form.sourceLanguage}
                  onChange={(e) => patch({ sourceLanguage: e.target.value })}
                >
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </Field>
            </div>
            <Field
              label={tr(
                "What does your team need to do?",
                "ما المطلوب من الفريق؟",
              )}
            >
              <textarea
                rows={7}
                value={form.text}
                maxLength={4000}
                placeholder={tr(
                  "Use short sentences. Include important times, places, and details.",
                  "استخدم جملاً قصيرة وأضف الأوقات والأماكن والتفاصيل المهمة.",
                )}
                onChange={(e) => patch({ text: e.target.value })}
              />
            </Field>
            <div className="ws-inline">
              <Button
                secondary
                onClick={() => void record()}
                disabled={uploading}
              >
                {recording ? "■ Stop recording" : "● Record voice"}
              </Button>
              <label className="ws-file-btn">
                {tr("Upload audio", "رفع تسجيل صوتي")}
                <input
                  type="file"
                  accept="audio/*"
                  disabled={uploading || recording}
                  onChange={(e) => void transcribe(e.target.files?.[0] as File)}
                />
              </label>
              <small>
                {uploading
                  ? tr("Preparing…", "جارٍ التحضير…")
                  : tr(
                      "Recordings are sent for transcription.",
                      "يتم إرسال التسجيل لتحويله إلى نص.",
                    )}
              </small>
            </div>
            <div className="ws-divider" />
            <div className="ws-form-grid">
              <Field label={tr("Delivery format", "طريقة التسليم")}>
                <select
                  value={form.deliveryMode}
                  onChange={(e) => patch({ deliveryMode: e.target.value })}
                >
                  <option value="both">
                    {tr("Text and voice", "نص وصوت")}
                  </option>
                  <option value="text">{tr("Text only", "نص فقط")}</option>
                  <option value="voice">{tr("Voice", "صوت")}</option>
                </select>
              </Field>
              <Field label={tr("Response requirement", "الرد المطلوب")}>
                <select
                  value={String(form.questionEnabled)}
                  onChange={(e) =>
                    patch({
                      questionEnabled: e.target.value === "true",
                      requirePhoto: false,
                    })
                  }
                >
                  <option value="true">
                    {tr("Multiple-choice question", "سؤال متعدد الخيارات")}
                  </option>
                  <option value="false">
                    {tr("Acknowledge receipt", "تأكيد الاستلام")}
                  </option>
                </select>
              </Field>
            </div>
            {form.questionEnabled ? (
              <details className="ws-details">
                <summary>
                  {tr(
                    "Write your own question (optional)",
                    "اكتب سؤالك (اختياري)",
                  )}
                </summary>
                <p className="ws-muted">
                  {tr(
                    "Leave blank to generate a question for human review.",
                    "اتركه فارغاً لإنشاء سؤال ثم مراجعته.",
                  )}
                </p>
                <Field label={tr("Question", "السؤال")}>
                  <input
                    value={form.question.text}
                    maxLength={140}
                    onChange={(e) =>
                      patch({
                        question: { ...form.question, text: e.target.value },
                      })
                    }
                  />
                </Field>
                {form.question.options.map((option: string, index: number) => (
                  <div className="ws-option-edit" key={index}>
                    <input
                      type="radio"
                      aria-label={`Correct option ${index + 1}`}
                      checked={form.question.correctIndex === index}
                      onChange={() =>
                        patch({
                          question: { ...form.question, correctIndex: index },
                        })
                      }
                    />
                    <input
                      aria-label={`Option ${index + 1}`}
                      value={option}
                      maxLength={60}
                      placeholder={`${tr("Option", "الخيار")} ${index + 1}`}
                      onChange={(e) =>
                        patch({
                          question: {
                            ...form.question,
                            options: form.question.options.map(
                              (v: string, i: number) =>
                                i === index ? e.target.value : v,
                            ),
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </details>
            ) : (
              <label className="ws-check">
                <input
                  type="checkbox"
                  checked={form.requirePhoto}
                  onChange={(e) => patch({ requirePhoto: e.target.checked })}
                />
                {tr(
                  "Require photo evidence with acknowledgment",
                  "طلب صورة مع تأكيد الاستلام",
                )}
              </label>
            )}
            <Field label={tr("Attachments", "المرفقات")}>
              <input
                type="file"
                multiple
                disabled={uploading}
                onChange={(e) => void upload(e.target.files)}
              />
            </Field>
            {form.attachments.map((file: Row, index: number) => (
              <div className="ws-attachment-edit" key={file.key}>
                <strong>{file.name}</strong>
                <input
                  aria-label="Attachment caption"
                  placeholder={tr("Caption (optional)", "شرح المرفق (اختياري)")}
                  value={file.caption || ""}
                  onChange={(e) =>
                    patch({
                      attachments: form.attachments.map((v: Row, i: number) =>
                        i === index ? { ...v, caption: e.target.value } : v,
                      ),
                    })
                  }
                />
                <button
                  onClick={() =>
                    patch({
                      attachments: form.attachments.filter(
                        (_: Row, i: number) => i !== index,
                      ),
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </>
        )}
        {step === 1 && (
          <>
            <h2>
              {tr("Who needs this instruction?", "من يحتاج هذه التعليمات؟")}
            </h2>
            <p className="ws-muted">
              {tr(
                "The audience is saved when you publish. Later crew changes do not rewrite historical recipients.",
                "يُحفظ الجمهور عند النشر. تغيير عضوية الفرق لاحقاً لا يغير المستلمين السابقين.",
              )}
            </p>
            <label className="ws-recipient ws-check">
              <input
                type="checkbox"
                checked={form.everyone}
                onChange={(e) => patch({ everyone: e.target.checked })}
              />
              <strong>
                {tr(
                  "Everyone eligible at this site",
                  "كل العمال المؤهلين في هذا الموقع",
                )}
              </strong>
            </label>
            <div className="ws-recipient-columns">
              <div>
                <h3>{tr("Crews", "الفرق")}</h3>
                {crews.map((c) => (
                  <label key={idOf(c)} className="ws-recipient ws-check">
                    <input
                      type="checkbox"
                      disabled={form.everyone}
                      checked={form.crewIds.includes(idOf(c))}
                      onChange={() => toggle("crewIds", idOf(c))}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
              <div>
                <h3>{tr("Individual workers", "عمال محددون")}</h3>
                {workers.map((w) => (
                  <label key={idOf(w)} className="ws-recipient ws-check">
                    <input
                      type="checkbox"
                      disabled={form.everyone}
                      checked={form.workerIds.includes(idOf(w))}
                      onChange={() => toggle("workerIds", idOf(w))}
                    />
                    <span>
                      {w.name}
                      <small>
                        {w.workerId} ·{" "}
                        {LANGUAGE_META[w.language as Language]?.nativeLabel}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <Badge>
              {recipientIds.size} {tr("selected workers", "عامل محدد")}
            </Badge>
          </>
        )}
        {step === 2 && (
          <>
            <h2>{tr("Review your instruction", "مراجعة التعليمات")}</h2>
            <div className="ws-review-content">
              <Badge>
                {form.sourceLanguage === "ar" ? "العربية" : "English"}
              </Badge>
              <h3>{form.title || tr("Untitled", "دون عنوان")}</h3>
              <p dir={form.sourceLanguage === "ar" ? "rtl" : "ltr"}>
                {form.text}
              </p>
            </div>
            <div className="ws-review-grid">
              <div>
                <small>{tr("Recipients", "المستلمون")}</small>
                <strong>
                  {recipientIds.size} {tr("workers", "عمال")}
                </strong>
              </div>
              <div>
                <small>{tr("Delivery", "التسليم")}</small>
                <strong>{form.deliveryMode}</strong>
              </div>
              <div>
                <small>{tr("Response", "الرد")}</small>
                <strong>
                  {form.questionEnabled
                    ? tr("Multiple choice", "اختيار متعدد")
                    : tr("Acknowledgment", "تأكيد استلام")}
                </strong>
              </div>
            </div>
            <div className="ws-form-grid">
              <Field label={tr("Send on (optional)", "موعد الإرسال (اختياري)")}>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => patch({ scheduledAt: e.target.value })}
                />
              </Field>
              <Field
                label={tr("Deadline (optional)", "الموعد النهائي (اختياري)")}
              >
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) => patch({ deadline: e.target.value })}
                />
              </Field>
            </div>
            <p className="ws-notice">
              {tr(
                "Save the draft, prepare the language versions, and approve each ready version before publishing.",
                "احفظ المسودة وجهّز النسخ اللغوية واعتمد كل نسخة جاهزة قبل النشر.",
              )}
            </p>
          </>
        )}
        <div className="ws-composer-footer">
          <Button
            secondary
            onClick={() => void save()}
            disabled={busy || uploading || recording || !form.text.trim()}
          >
            {tr("Save draft", "حفظ المسودة")}
          </Button>
          <div className="ws-inline">
            {step > 0 && (
              <Button secondary onClick={() => setStep(step - 1)}>
                {tr("Back", "السابق")}
              </Button>
            )}
            {step < 2 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 0 && !form.text.trim()}
              >
                {tr("Continue", "متابعة")} →
              </Button>
            ) : (
              <Button
                onClick={() => void save()}
                disabled={busy || !recipientIds.size || !form.text.trim()}
              >
                {busy
                  ? tr("Saving…", "جارٍ الحفظ…")
                  : tr("Save & prepare for review", "حفظ وتجهيز للمراجعة")}
              </Button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
function InstructionPage({
  detail,
  ar,
  busy,
  canWrite,
  act,
  refresh,
  onEdit,
  onCopied,
}: {
  detail: Row;
  ar: boolean;
  busy: boolean;
  canWrite: boolean;
  act: Action;
  refresh: () => void;
  onEdit: () => void;
  onCopied: (row: Row) => void;
}) {
  const instruction = detail.instruction ?? {};
  const tr = (en: string, arabic: string) => (ar ? arabic : en);
  const [partial, setPartial] = useState(false);
  const [variantEdits, setVariantEdits] = useState<Record<string, string>>({});
  const [questionEdits, setQuestionEdits] = useState<Record<string, Row>>({});
  const action = async (name: string, body: Row = {}) => {
    const result = await act(`${OPS}/instructions/${idOf(instruction)}/${name}`, body);
    if (result) name === "copy" ? onCopied(result) : refresh();
  };
  useEffect(() => {
    if (!["preparing", "scheduled"].includes(instruction.status)) return;
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [instruction.status]);
  return (
    <>
      <PageHeading
        title={instruction.title || tr("Instruction", "تعليمات")}
        subtitle={`${tr("Version", "النسخة")} ${instruction.version ?? 1} · ${instruction.status} · ${date(instruction.createdAt)}`}
      />
      <div className="ws-inline ws-toolbar">
        {canWrite && (
          <>
            {["ready", "partial_failure", "published"].includes(instruction.status) && <Button secondary onClick={onEdit}>{tr("Update as a new version", "تحديث كنسخة جديدة")}</Button>}
            {instruction.status === "published" && <Button secondary disabled={busy} onClick={() => void action("retry")}>{tr("Retry waiting deliveries", "إعادة تجهيز التسليمات المنتظرة")}</Button>}
            {instruction.status === "draft" && (
              <>
                <Button secondary onClick={onEdit}>
                  {tr("Edit content", "تعديل المحتوى")}
                </Button>
                <Button disabled={busy} onClick={() => void action("prepare")}>
                  {tr("Prepare languages", "تجهيز اللغات")}
                </Button>
              </>
            )}
            {["partial_failure", "ready"].includes(instruction.status) && (
              <>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void action("publish", { acceptPartial: partial })
                  }
                >
                  {instruction.scheduledAt
                    ? tr("Schedule publication", "جدولة النشر")
                    : tr("Publish instruction", "نشر التعليمات")}
                </Button>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => void action("retry")}
                >
                  {tr(
                    "Retry unavailable versions",
                    "إعادة تجهيز النسخ غير المتاحة",
                  )}
                </Button>
                {instruction.status === "partial_failure" && (
                  <label className="ws-check">
                    <input
                      type="checkbox"
                      checked={partial}
                      onChange={(e) => setPartial(e.target.checked)}
                    />
                    {tr(
                      "Deliver ready versions; retain waiting recipients",
                      "إرسال النسخ الجاهزة وإبقاء المستلمين المنتظرين",
                    )}
                  </label>
                )}
              </>
            )}
            {["published", "scheduled"].includes(instruction.status) && (
              <Button
                secondary
                onClick={() => {
                  if (
                    confirm(
                      tr("Withdraw this instruction?", "سحب هذه التعليمات؟"),
                    )
                  )
                    void action("withdraw");
                }}
              >
                {tr("Withdraw", "سحب")}
              </Button>
            )}
            <Button secondary onClick={() => void action("copy")}>
              {tr("Copy to a new draft", "نسخ إلى مسودة جديدة")}
            </Button>
            <Button secondary onClick={() => void action("archive")}>
              {tr("Archive", "أرشفة")}
            </Button>
          </>
        )}
      </div>
      <section className="ws-card ws-pad">
        <h2>{tr("Original instruction", "التعليمات الأصلية")}</h2>
        <p
          className="ws-preserve"
          dir={instruction.sourceLanguage === "ar" ? "rtl" : "ltr"}
        >
          {instruction.text}
        </p>
        {instruction.deadline && (
          <p>
            {tr("Deadline", "الموعد النهائي")}: {date(instruction.deadline)}
          </p>
        )}
      </section>
      <h2 className="ws-section-title">
        {tr("Language review", "مراجعة اللغات")}
      </h2>
      <div className="ws-variants">
        {array(instruction.variants).map((v) => (
          <section key={v.language} className="ws-card ws-pad">
            <div className="ws-card-title">
              <h3>
                {LANGUAGE_META[v.language as Language]?.nativeLabel ??
                  v.language}
              </h3>
              <Badge>{v.status}</Badge>
            </div>
            {v.demo && (
              <p className="ws-notice">
                {tr(
                  "Demo mode: source content is retained. This is not a live translation.",
                  "وضع تجريبي: المحتوى الأصلي محفوظ. هذه ليست ترجمة فعلية.",
                )}
              </p>
            )}
            {v.error && <p className="ws-error">{v.error}</p>}
            <textarea
              rows={5}
              aria-label={`Translation ${v.language}`}
              dir={LANGUAGE_META[v.language as Language]?.dir}
              value={variantEdits[v.language] ?? v.text ?? ""}
              disabled={
                !canWrite ||
                !["ready", "partial_failure"].includes(instruction.status)
              }
              onChange={(e) =>
                setVariantEdits((old) => ({
                  ...old,
                  [v.language]: e.target.value,
                }))
              }
            />
            {v.audioUrl && <audio controls src={v.audioUrl} />}{" "}
            {v.question && !canWrite && (
              <div className="ws-question-review">
                <strong>{v.question.text}</strong>
                {(v.question.options as string[]).map((option, index) => (
                  <p key={index}>
                    {v.question.correctIndex === index ? "✓" : "○"} {option}
                  </p>
                ))}
              </div>
            )}
            {instruction.questionEnabled && canWrite && ["ready", "partial_failure"].includes(instruction.status) && <QuestionFields value={questionEdits[v.language] ?? v.question ?? {text:"",options:["","",""],correctIndex:0}} onChange={value=>setQuestionEdits(old=>({...old,[v.language]:value}))} ar={ar}/>}
            {canWrite &&
              ["ready", "partial_failure"].includes(instruction.status) &&
              (variantEdits[v.language] ?? v.text) && (
                <Button
                  secondary
                  disabled={busy}
                  onClick={async () => {
                    await act(
                      `${OPS}/instructions/${idOf(instruction)}/variants/${v.language}`,
                      {
                        text: variantEdits[v.language] ?? v.text,
                        ...(instruction.questionEnabled ? {question: questionEdits[v.language] ?? v.question} : {}),
                        reviewed: true,
                      },
                      "PATCH",
                    );
                    refresh();
                  }}
                >
                  {v.reviewed
                    ? tr("✓ Approved — save changes", "✓ معتمدة — حفظ التعديل")
                    : tr("Approve this version", "اعتماد هذه النسخة")}
                </Button>
              )}
          </section>
        ))}
      </div>
      <section className="ws-card ws-pad">
        <h2>{tr("Recipients and responses", "المستلمون والردود")}</h2>
        {array(detail.assignments).filter(a=>a.status === "waiting").map(a=><div key={idOf(a)} className="ws-review-content"><h3>{a.workerName} · {LANGUAGE_META[a.language as Language]?.nativeLabel}</h3><p>{a.snapshot?.text}</p>{a.snapshot?.audioUrl&&<audio controls src={a.snapshot.audioUrl}/>} {a.snapshot?.question&&<p>{a.snapshot.question.text}</p>}{canWrite&&<Button secondary disabled={busy||!a.snapshot?.text} onClick={async()=>{await act(`${OPS}/assignments/${idOf(a)}/release`);refresh();}}>{tr("Approve and deliver", "اعتماد وتسليم")}</Button>}</div>)}
        <DataTable
          rows={array(detail.assignments)}
          columns={[
            "workerName",
            "workerCode",
            "language",
            "status",
            "acknowledgedAt",
            "completedAt",
          ]}
        />
      </section>
      <section className="ws-card ws-pad">
        <h2>{tr("Sent-version history", "سجل النسخ المنشورة")}</h2>
        {array(detail.versions ?? instruction.publications).length ? (
          <DataTable
            rows={array(detail.versions ?? instruction.publications)}
            columns={["version", "publishedAt", "publishedBy"]}
          />
        ) : (
          <p className="ws-muted">
            {tr("No published versions yet.", "لم تنشر أي نسخة بعد.")}
          </p>
        )}
      </section>
    </>
  );
}
function Roster({
  workers,
  crews,
  site,
  ar,
  canWrite,
  act,
  busy,
}: {
  workers: Row[];
  crews: Row[];
  site: string;
  ar: boolean;
  canWrite: boolean;
  act: Action;
  busy: boolean;
}) {
  const tr = (en: string, arabic: string) => (ar ? arabic : en);
  const [query, setQuery] = useState("");
  const [worker, setWorker] = useState<Row>({
    name: "",
    workerId: "",
    language: "en",
    crewId: "",
    password: "",
  });
  const [crewName, setCrewName] = useState("");
  const [editing, setEditing] = useState("");
  const [notice, setNotice] = useState("");
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const body: Row = {
      name: worker.name,
      workerId: worker.workerId,
      language: worker.language,
      crewId: worker.crewId || null,
      ...(!editing ? { password: worker.password, siteId: site } : {}),
    };
    const result = await act(
      `${OPS}/workers${editing ? `/${editing}` : ""}`,
      body,
      editing ? "PATCH" : "POST",
    );
    if (result) {
      setWorker({
        name: "",
        workerId: "",
        language: "en",
        crewId: "",
        password: "",
      });
      setEditing("");
    }
  };
  const importCsv = async (file?: File) => {
    if (!file) return;
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("siteId", site);
      const result = await act(`${OPS}/workers/import`, body);
      if (result)
        setNotice(
          `${result.imported ?? result.created ?? 0} workers imported. ${JSON.stringify(result.errors ?? [])}`,
        );
    } catch (err) {
      setNotice(errorMessage(err));
    }
  };
  return (
    <>
      <PageHeading
        title={tr("Workers & crews", "العمال والفرق")}
        subtitle={tr(
          "Manage current memberships without changing historical instruction audiences.",
          "إدارة العضويات الحالية دون تغيير مستلمي التعليمات السابقة.",
        )}
      />
      <div className="ws-roster-layout">
        <section className="ws-card ws-pad">
          <input
            className="ws-search"
            aria-label="Search workers"
            value={query}
            placeholder={tr(
              "Search name or worker ID…",
              "ابحث بالاسم أو الرقم…",
            )}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="ws-roster-list">
            {workers
              .filter((w) =>
                `${w.name} ${w.workerId}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((w) => (
                <div className="ws-worker-row" key={idOf(w)}>
                  <span className="ws-avatar">{w.name?.slice(0, 2)}</span>
                  <div>
                    <strong>{w.name}</strong>
                    <small>
                      {w.workerId} ·{" "}
                      {LANGUAGE_META[w.language as Language]?.nativeLabel} ·{" "}
                      {crews.find((c) => idOf(c) === String(w.crewId))?.name ||
                        tr("No crew", "دون فريق")}
                    </small>
                  </div>
                  <Badge>
                    {w.accessDisabled || w.disabled || w.archivedAt
                      ? tr("Disabled", "معطل")
                      : tr("Active", "نشط")}
                  </Badge>
                  {canWrite && (
                    <details>
                      <summary>•••</summary>
                      <button
                        onClick={() => {
                          setEditing(idOf(w));
                          setWorker({ ...w, password: "" });
                        }}
                      >
                        {tr("Edit profile", "تعديل الملف")}
                      </button>
                      <button
                        onClick={() =>
                          void act(
                            `${ACCESS}/workers/${idOf(w)}/access`,
                            { disabled: !(w.accessDisabled || w.disabled) },
                            "PATCH",
                          )
                        }
                      >
                        {w.accessDisabled || w.disabled
                          ? tr("Reactivate", "إعادة التفعيل")
                          : tr("Disable access", "تعطيل الوصول")}
                      </button>
                      <button
                        onClick={() => {
                          const password = prompt(
                            tr(
                              "New password (at least 12 characters)",
                              "كلمة المرور الجديدة (١٢ حرفاً على الأقل)",
                            ),
                          );
                          if (password)
                            void act(
                              `${ACCESS}/workers/${idOf(w)}/reset-password`,
                              { password },
                            );
                        }}
                      >
                        {tr("Reset password", "إعادة تعيين كلمة المرور")}
                      </button>
                    </details>
                  )}
                </div>
              ))}
          </div>
          {!workers.length && (
            <Empty>
              {tr(
                "Add your first worker to get started.",
                "أضف أول عامل للبدء.",
              )}
            </Empty>
          )}
          {canWrite && (
            <div className="ws-import-box">
              <strong>
                {tr("Import your roster", "استيراد قائمة العمال")}
              </strong>
              <p>
                {tr(
                  "CSV columns: name, workerId, crew, language, password.",
                  "أعمدة CSV: name, workerId, crew, language, password.",
                )}
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={!site || busy}
                onChange={(e) => void importCsv(e.target.files?.[0])}
              />
              {notice && <p role="status">{notice}</p>}
            </div>
          )}
        </section>
        <div>
          {canWrite && (
            <section className="ws-card ws-pad">
              <h2>
                {editing
                  ? tr("Edit worker", "تعديل العامل")
                  : tr("Add a worker", "إضافة عامل")}
              </h2>
              {!site && (
                <p className="ws-notice">
                  {tr(
                    "Select a site in the top bar first.",
                    "اختر موقعاً من الشريط العلوي أولاً.",
                  )}
                </p>
              )}
              <form onSubmit={save}>
                <Field label={tr("Full name", "الاسم الكامل")}>
                  <input
                    required
                    value={worker.name}
                    onChange={(e) =>
                      setWorker({ ...worker, name: e.target.value })
                    }
                  />
                </Field>
                <Field label={tr("Worker ID", "رقم العامل")}>
                  <input
                    required
                    value={worker.workerId}
                    readOnly={Boolean(editing)}
                    onChange={(e) =>
                      setWorker({ ...worker, workerId: e.target.value })
                    }
                  />
                </Field>
                <Field label={tr("Language", "اللغة")}>
                  <select
                    value={worker.language}
                    onChange={(e) =>
                      setWorker({ ...worker, language: e.target.value })
                    }
                  >
                    {LANGUAGES.map((l) => (
                      <option value={l} key={l}>
                        {LANGUAGE_META[l].nativeLabel}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={tr("Crew", "الفريق")}>
                  <select
                    required
                    value={worker.crewId || ""}
                    onChange={(e) =>
                      setWorker({ ...worker, crewId: e.target.value })
                    }
                  >
                    <option value="">{tr("Choose a crew", "اختر فريقاً")}</option>
                    {crews.map((c) => (
                      <option key={idOf(c)} value={idOf(c)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {!editing && (
                  <Field label={tr("Initial password", "كلمة المرور الأولية")}>
                    <input
                      required
                      minLength={12}
                      type="password"
                      autoComplete="new-password"
                      value={worker.password}
                      onChange={(e) =>
                        setWorker({ ...worker, password: e.target.value })
                      }
                    />
                  </Field>
                )}
                <Button type="submit" disabled={!site || busy}>
                  {tr("Save worker", "حفظ العامل")}
                </Button>
                {editing && (
                  <Button
                    secondary
                    onClick={() => {
                      setEditing("");
                      setWorker({
                        name: "",
                        workerId: "",
                        language: "en",
                        crewId: "",
                        password: "",
                      });
                    }}
                  >
                    {tr("Cancel", "إلغاء")}
                  </Button>
                )}
              </form>
            </section>
          )}
          <section className="ws-card ws-pad">
            <h2>{tr("Crews", "الفرق")}</h2>
            {crews.map((c) => (
              <div className="ws-settings-row" key={idOf(c)}>
                <strong>{c.name}</strong>
                <small>
                  {workers.filter((w) => String(w.crewId) === idOf(c)).length}{" "}
                  {tr("workers", "عمال")}
                </small>
                {canWrite && (
                  <button
                    onClick={() => {
                      const name = prompt(
                        tr("Crew name", "اسم الفريق"),
                        c.name,
                      );
                      if (name)
                        void act(`${OPS}/crews/${idOf(c)}`, { name }, "PATCH");
                    }}
                  >
                    {tr("Rename", "تغيير الاسم")}
                  </button>
                )}
              </div>
            ))}
            {canWrite && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(`${OPS}/crews`, {
                    name: crewName,
                    siteId: site,
                  }).then((r) => {
                    if (r) setCrewName("");
                  });
                }}
              >
                <Field label={tr("New crew", "فريق جديد")}>
                  <input
                    required
                    value={crewName}
                    onChange={(e) => setCrewName(e.target.value)}
                  />
                </Field>
                <Button type="submit" disabled={!site || busy}>
                  {tr("Create crew", "إنشاء فريق")}
                </Button>
              </form>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
function CaseList({
  cases,
  ar,
  act,
  canWrite,
  staff,
  propose,
}: {
  cases: Row[];
  ar: boolean;
  act: Action;
  canWrite: boolean;
  staff: Row[];
  propose: (row: Row) => void;
}) {
  const [messages, setMessages] = useState<Record<string, string>>({});
  const tr = (en: string, arabic: string) => (ar ? arabic : en);
  return cases.length ? (
    <div className="ws-cases">
      {cases.map((c) => (
        <section key={idOf(c)} className="ws-card ws-pad">
          <div className="ws-card-title">
            <div>
              <h2>{c.workerName}</h2>
              <p>
                {c.title || c.snapshot?.title} · {c.workerCode}
              </p>
            </div>
            <Badge>{c.help?.reason || c.status}</Badge>
          </div>
          {c.snapshot?.text && (
            <details>
              <summary>
                {tr("Original instruction", "التعليمات الأصلية")}
              </summary>
              <p>{c.snapshot.text}</p>
            </details>
          )}
          {c.snapshot?.question && (
            <div className="ws-question-review">
              <strong>{c.snapshot.question.text}</strong>
            </div>
          )}
          {c.photoUrl && <figure className="ws-evidence"><img src={c.photoUrl} alt={tr("Worker-submitted photo evidence", "صورة إثبات مقدمة من العامل")}/><figcaption>{tr("Submitted evidence; quality and safety require human review.", "صورة مقدمة؛ تتطلب الجودة والسلامة مراجعة بشرية.")}</figcaption></figure>}
          {array(c.presentations).filter(v=>!v.reviewed).map(v=><div key={v.language} className="ws-review-content"><h3>{tr("Translated view for review", "نسخة مترجمة للمراجعة")} · {LANGUAGE_META[v.language as Language]?.nativeLabel}</h3><p dir={LANGUAGE_META[v.language as Language]?.dir}>{v.text}</p>{v.audioUrl&&<audio controls src={v.audioUrl}/>} {v.question&&<p>{v.question.text}</p>}{v.error&&<p className="ws-error">{v.error}</p>}{canWrite&&v.status==='ready'&&<Button secondary onClick={()=>void act(`${OPS}/assignments/${idOf(c)}/presentation`,{language:v.language,reviewed:true})}>{tr("Approve translated view", "اعتماد النسخة المترجمة")}</Button>}</div>)}
          {array(c.attempts).map((a, index) => (
            <div className="ws-attempt" key={index}>
              <Badge>
                {a.matched === true
                  ? tr("Matching answer", "إجابة مطابقة")
                  : a.matched === false
                    ? tr("Needs clarification", "تحتاج توضيحاً")
                    : tr("Not assessed", "غير مقيمة")}
              </Badge>
              <p>
                {a.text ??
                  (a.optionIndex !== undefined
                    ? c.snapshot?.question?.options?.[a.optionIndex]
                    : "")}
              </p>
              {a.audioUrl && <audio controls src={a.audioUrl} />}
              <small>{date(a.at)}</small>
            </div>
          ))}
          <div className="ws-conversation">
            {array(c.messages).map((m, index) => (
              <div
                key={m.id || index}
                className={`ws-message ${m.author === "staff" ? "staff" : ""}`}
              >
                <strong>
                  {m.author === "staff"
                    ? tr("Staff", "الموظف")
                    : tr("Worker", "العامل")}
                </strong>
                <p>{m.text}</p>
                <small>{date(m.at)}</small>
              </div>
            ))}
          </div>
          {canWrite && (
            <>
              <Field label={tr("Case assigned to", "مسؤول الحالة")}><select value={c.help?.assigneeId??''} onChange={e=>void act(`${OPS}/assignments/${idOf(c)}/messages`,{assigneeId:e.target.value||null})}><option value="">{tr("Unassigned", "غير مسندة")}</option>{staff.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></Field>
              <Button secondary onClick={()=>propose(c)}>{tr("Create an improvement draft", "إنشاء مسودة تحسين")}</Button>
              <Field label={tr("Clarification", "توضيح")}>
                <textarea
                  rows={3}
                  value={messages[idOf(c)] ?? ""}
                  onChange={(e) =>
                    setMessages((old) => ({
                      ...old,
                      [idOf(c)]: e.target.value,
                    }))
                  }
                />
              </Field>
              <div className="ws-inline">
                <Button
                  disabled={!messages[idOf(c)]?.trim()}
                  onClick={() =>
                    void act(`${OPS}/assignments/${idOf(c)}/messages`, {
                      text: messages[idOf(c)],
                      requestAnswer: false,
                    }).then(() =>
                      setMessages((old) => ({ ...old, [idOf(c)]: "" })),
                    )
                  }
                >
                  {tr("Send clarification", "إرسال التوضيح")}
                </Button>
                <Button
                  secondary
                  disabled={!messages[idOf(c)]?.trim()}
                  onClick={() =>
                    void act(`${OPS}/assignments/${idOf(c)}/messages`, {
                      text: messages[idOf(c)],
                      requestAnswer: true,
                    }).then(() =>
                      setMessages((old) => ({ ...old, [idOf(c)]: "" })),
                    )
                  }
                >
                  {tr("Request another answer", "طلب إجابة أخرى")}
                </Button>
                <Button
                  secondary
                  onClick={() =>
                    void act(`${OPS}/assignments/${idOf(c)}/messages`, {
                      text:
                        messages[idOf(c)] ||
                        tr("Follow-up resolved.", "تمت معالجة المتابعة."),
                      resolve: true,
                    })
                  }
                >
                  {tr("Resolve case", "حل الحالة")}
                </Button>
              </div>
            </>
          )}
        </section>
      ))}
    </div>
  ) : (
    <Empty>
      {tr("No open follow-up cases.", "لا توجد حالات متابعة مفتوحة.")}
    </Empty>
  );
}
function Resources({
  data,
  ar,
  act,
  canWrite,
  useTemplate,
}: {
  data: Row;
  ar: boolean;
  act: Action;
  canWrite: boolean;
  useTemplate: (row: Row) => void;
}) {
  const tr = (en: string, arabic: string) => (ar ? arabic : en);
  const [template, setTemplate] = useState({
    name: "",
    text: "",
    sourceLanguage: "en",
    questionEnabled: true,
  });
  const [glossary, setGlossary] = useState({
    term: "",
    translation: "",
    language: "ar",
  });
  return (
    <>
      <PageHeading
        title={tr("Reuse what works", "إعادة استخدام المحتوى الناجح")}
        subtitle={tr(
          "Keep useful instructions and approved terminology in one place.",
          "احتفظ بالتعليمات المفيدة والمصطلحات المعتمدة في مكان واحد.",
        )}
      />
      <div className="ws-two-column">
        <section className="ws-card ws-pad">
          <h2>{tr("Instruction templates", "قوالب التعليمات")}</h2>
          {array(data.templates).map((t) => (
            <article className="ws-template" key={idOf(t)}>
              <h3>{t.name}</h3>
              <p>{t.text}</p>
              <Button
                secondary
                onClick={() => useTemplate({ ...t, title: t.name })}
              >
                {tr("Use as a draft", "استخدام كمسودة")}
              </Button>
            </article>
          ))}
          {canWrite && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act(`${OPS}/templates`, template).then((row) => {
                  if (row) setTemplate({ ...template, name: "", text: "" });
                });
              }}
            >
              <Field label={tr("Template name", "اسم القالب")}>
                <input
                  required
                  value={template.name}
                  onChange={(e) =>
                    setTemplate({ ...template, name: e.target.value })
                  }
                />
              </Field>
              <Field label={tr("Text", "النص")}>
                <textarea
                  required
                  rows={4}
                  value={template.text}
                  onChange={(e) =>
                    setTemplate({ ...template, text: e.target.value })
                  }
                />
              </Field>
              <Field label={tr("Source language", "لغة المصدر")}>
                <select
                  value={template.sourceLanguage}
                  onChange={(e) =>
                    setTemplate({ ...template, sourceLanguage: e.target.value })
                  }
                >
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </Field>
              <Button type="submit">{tr("Save template", "حفظ القالب")}</Button>
            </form>
          )}
        </section>
        <section className="ws-card ws-pad">
          <h2>{tr("Company glossary", "مصطلحات الشركة")}</h2>
          <p className="ws-muted">
            {tr(
              "Approved terms are supplied to language processing. Human review remains necessary.",
              "تُرسل المصطلحات المعتمدة إلى خدمة اللغة. تظل المراجعة البشرية ضرورية.",
            )}
          </p>
          {array(data.glossary).map((g) => (
            <div className="ws-settings-row" key={idOf(g)}>
              <div>
                <strong>{g.term}</strong>
                <small>
                  {g.translation} ·{" "}
                  {LANGUAGE_META[g.language as Language]?.nativeLabel}
                </small>
              </div>
              {canWrite && (
                <button
                  onClick={() =>
                    void act(`${OPS}/glossary/${idOf(g)}`, undefined, "DELETE")
                  }
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {canWrite && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act(`${OPS}/glossary`, glossary).then((row) => {
                  if (row)
                    setGlossary({ ...glossary, term: "", translation: "" });
                });
              }}
            >
              <Field label={tr("Source term", "المصطلح الأصلي")}>
                <input
                  required
                  value={glossary.term}
                  onChange={(e) =>
                    setGlossary({ ...glossary, term: e.target.value })
                  }
                />
              </Field>
              <Field label={tr("Approved translation", "الترجمة المعتمدة")}>
                <input
                  required
                  value={glossary.translation}
                  onChange={(e) =>
                    setGlossary({ ...glossary, translation: e.target.value })
                  }
                />
              </Field>
              <Field label={tr("Language", "اللغة")}>
                <select
                  value={glossary.language}
                  onChange={(e) =>
                    setGlossary({ ...glossary, language: e.target.value })
                  }
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {LANGUAGE_META[l].nativeLabel}
                    </option>
                  ))}
                </select>
              </Field>
              <Button type="submit">{tr("Add term", "إضافة مصطلح")}</Button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
function Settings({
  workspace,
  data,
  ar,
  act,
  canAdmin,
  onChanged,
}: {
  workspace: Row;
  data: Row;
  ar: boolean;
  act: Action;
  canAdmin: boolean;
  onChanged: () => void;
}) {
  const tr = (en: string, arabic: string) => (ar ? arabic : en);
  const [siteName, setSiteName] = useState("");
  const [siteTimezone, setSiteTimezone] = useState(FIELD_TIMEZONE);
  const [invite, setInvite] = useState({
    email: "",
    role: "supervisor",
    siteIds: [] as string[],
  });
  const [request, setRequest] = useState("");
  return (
    <>
      <PageHeading
        title={tr("Workspace settings", "إعدادات مساحة العمل")}
        subtitle={tr(
          "People, sites, access, and the company workspace.",
          "الأشخاص والمواقع والصلاحيات ومساحة الشركة.",
        )}
      />
      <div className="ws-two-column">
        <div>
          <section className="ws-card ws-pad">
            <h2>{workspace.org?.name}</h2>
            <div className="ws-settings-row">
              <span>{tr("Company identifier", "معرف الشركة")}</span>
              <strong className="ws-code">{workspace.org?.companyId}</strong>
            </div>
            <p className="ws-muted">
              {tr(
                "Give this identifier to workers together with their worker ID and initial password.",
                "شارك هذا المعرف مع العمال مع رقم العامل وكلمة المرور الأولية.",
              )}
            </p>
            <div className="ws-settings-row">
              <span>{tr("Access status", "حالة الوصول")}</span>
              <Badge>{workspace.entitlement?.status}</Badge>
            </div>
            <div className="ws-settings-row">
              <span>{tr("Expires", "تاريخ الانتهاء")}</span>
              <span>{date(workspace.entitlement?.expiresAt)}</span>
            </div>
            <div className="ws-settings-row">
              <span>{tr("Active worker limit", "حد العمال النشطين")}</span>
              <span>{workspace.entitlement?.workerLimit ?? 25}</span>
            </div>
            {workspace.user.role === "owner" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(`${OPS}/plan-requests`, {
                    message: request,
                    plan: "paid",
                  }).then((r) => {
                    if (r) setRequest("");
                  });
                }}
              >
                <Field
                  label={tr(
                    "Request activation, renewal, or a paid plan",
                    "طلب التفعيل أو التجديد أو خطة مدفوعة",
                  )}
                >
                  <textarea
                    required
                    rows={3}
                    value={request}
                    onChange={(e) => setRequest(e.target.value)}
                  />
                </Field>
                <Button type="submit">
                  {tr("Send request", "إرسال الطلب")}
                </Button>
              </form>
            )}
          </section>
          <section className="ws-card ws-pad">
            <h2>{tr("Sites", "المواقع")}</h2>
            {array(workspace.sites).map((s) => (
              <div className="ws-settings-row" key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <small>{s.timezone}</small>
                </div>
                <Badge>
                  {s.archived ? tr("Archived", "مؤرشف") : tr("Active", "نشط")}
                </Badge>
                {workspace.user.role === "owner" && (
                  <button
                    onClick={() =>
                      void act(
                        `${ACCESS}/sites/${s.id}`,
                        { archived: !s.archived },
                        "PATCH",
                      ).then(onChanged)
                    }
                  >
                    {s.archived
                      ? tr("Restore", "استعادة")
                      : tr("Archive", "أرشفة")}
                  </button>
                )}
              </div>
            ))}
            {workspace.user.role === "owner" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(`${ACCESS}/sites`, {
                    name: siteName,
                    timezone: siteTimezone,
                  }).then((r) => {
                    if (r) {
                      setSiteName("");
                      onChanged();
                    }
                  });
                }}
              >
                <Field label={tr("New site name", "اسم الموقع الجديد")}>
                  <input
                    required
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                  />
                </Field>
                <Field label={tr("Time zone", "المنطقة الزمنية")}>
                  <input
                    required
                    placeholder="Asia/Dubai"
                    value={siteTimezone}
                    onChange={(e) => setSiteTimezone(e.target.value)}
                  />
                </Field>
                <Button type="submit">{tr("Add site", "إضافة موقع")}</Button>
              </form>
            )}
          </section>
        </div>
        <div>
          {canAdmin && (
            <section className="ws-card ws-pad">
              <h2>{tr("Staff access", "وصول الموظفين")}</h2>
              {array(data.staff).map((s) => (
                <div className="ws-settings-row" key={idOf(s)}>
                  <div>
                    <strong>{s.name || s.email}</strong>
                    <small>
                      {s.email} · {s.role}
                    </small>
                  </div>
                  {s.role !== "owner" && (
                    <button
                      onClick={() =>
                        void act(
                          `${ACCESS}/staff/${idOf(s)}`,
                          { disabled: !s.disabled },
                          "PATCH",
                        )
                      }
                    >
                      {s.disabled
                        ? tr("Enable", "تفعيل")
                        : tr("Disable", "تعطيل")}
                    </button>
                  )}
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(`${ACCESS}/invitations`, invite).then((r) => {
                    if (r) setInvite({ ...invite, email: "" });
                  });
                }}
              >
                <Field label={tr("Invite staff by email", "دعوة موظف بالبريد")}>
                  <input
                    type="email"
                    required
                    value={invite.email}
                    onChange={(e) =>
                      setInvite({ ...invite, email: e.target.value })
                    }
                  />
                </Field>
                <Field label={tr("Role", "الدور")}>
                  <select
                    value={invite.role}
                    onChange={(e) =>
                      setInvite({ ...invite, role: e.target.value })
                    }
                  >
                    <option value="supervisor">Supervisor</option>
                    <option value="administrator">Administrator</option>
                    <option value="auditor">Auditor</option>
                  </select>
                </Field>
                <p>{tr("Authorized sites", "المواقع المصرح بها")}</p>
                {array(workspace.sites).map((s) => (
                  <label className="ws-check" key={s.id}>
                    <input
                      type="checkbox"
                      checked={invite.siteIds.includes(s.id)}
                      onChange={() =>
                        setInvite({
                          ...invite,
                          siteIds: invite.siteIds.includes(s.id)
                            ? invite.siteIds.filter((id) => id !== s.id)
                            : [...invite.siteIds, s.id],
                        })
                      }
                    />
                    {s.name}
                  </label>
                ))}
                <Button type="submit">
                  {tr("Send invitation", "إرسال الدعوة")}
                </Button>
              </form>
            </section>
          )}
          <section className="ws-card ws-pad">
            <h2>{tr("Language change requests", "طلبات تغيير اللغة")}</h2>
            {array(data.languageRequests).length ? (
              array(data.languageRequests).map((w) => (
                <div className="ws-settings-row" key={idOf(w)}>
                  <div>
                    <strong>{w.name}</strong>
                    <small>
                      {
                        LANGUAGE_META[
                          (w.requestedLanguage ||
                            w.languageRequested) as Language
                        ]?.nativeLabel
                      }
                    </small>
                  </div>
                  <div className="ws-inline">
                    <Button
                      secondary
                      onClick={() =>
                        void act(`${OPS}/workers/${idOf(w)}/language`, {
                          approve: true,
                        })
                      }
                    >
                      {tr("Approve", "موافقة")}
                    </Button>
                    <Button
                      secondary
                      onClick={() =>
                        void act(`${OPS}/workers/${idOf(w)}/language`, {
                          approve: false,
                        })
                      }
                    >
                      {tr("Decline", "رفض")}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="ws-muted">
                {tr("No pending requests.", "لا توجد طلبات معلقة.")}
              </p>
            )}
          </section>
          {workspace.user.role === "owner" && data.privacy && (
            <PrivacySettings
              privacy={data.privacy}
              orgName={workspace.org.name}
              ar={ar}
              act={act}
            />
          )}{" "}
          {workspace.user.role === "owner" && (
            <section className="ws-card ws-pad">
              <h2>{tr("Invoices & payments", "الفواتير والمدفوعات")}</h2>
              <DataTable
                rows={array(data.invoices)}
                columns={[
                  "number",
                  "amount",
                  "currency",
                  "status",
                  "createdAt",
                ]}
              />
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function PrivacySettings({
  privacy,
  orgName,
  ar,
  act,
}: {
  privacy: Row;
  orgName: string;
  ar: boolean;
  act: Action;
}) {
  const [form, setForm] = useState({
    recordingNotice: privacy.recordingNotice ?? "",
    recordingNoticeAr: privacy.recordingNoticeAr ?? "",
    retentionDays: privacy.retentionDays ? String(privacy.retentionDays) : "",
  });
  const [confirmName, setConfirmName] = useState("");
  const tr = (en: string, arabic: string) => (ar ? arabic : en);
  return (
    <>
      <section className="ws-card ws-pad">
        <h2>{tr("Privacy & retention", "الخصوصية والاحتفاظ")}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              `${OPS}/privacy`,
              {
                ...form,
                retentionDays: form.retentionDays
                  ? Number(form.retentionDays)
                  : null,
              },
              "PATCH",
            );
          }}
        >
          <Field
            label={tr(
              "Recording notice (English)",
              "إشعار التسجيل (الإنجليزية)",
            )}
          >
            <textarea
              required
              rows={3}
              value={form.recordingNotice}
              onChange={(e) =>
                setForm({ ...form, recordingNotice: e.target.value })
              }
            />
          </Field>
          <Field
            label={tr("Recording notice (Arabic)", "إشعار التسجيل (العربية)")}
          >
            <textarea
              dir="rtl"
              rows={3}
              value={form.recordingNoticeAr}
              onChange={(e) =>
                setForm({ ...form, recordingNoticeAr: e.target.value })
              }
            />
          </Field>
          <Field
            label={tr(
              "Retention days (blank keeps records for account lifetime)",
              "أيام الاحتفاظ (فارغ للاحتفاظ طوال عمر الحساب)",
            )}
          >
            <input
              type="number"
              min={30}
              max={3650}
              value={form.retentionDays}
              onChange={(e) =>
                setForm({ ...form, retentionDays: e.target.value })
              }
            />
          </Field>
          <p className="ws-muted">
            {tr(
              "Changing retention can permanently remove older records during the next cleanup.",
              "قد يؤدي تغيير مدة الاحتفاظ إلى حذف السجلات الأقدم نهائياً عند التنظيف القادم.",
            )}
          </p>
          <Button type="submit">
            {tr("Save privacy settings", "حفظ إعدادات الخصوصية")}
          </Button>
        </form>
      </section>
      <section className="ws-card ws-pad">
        <h2>{tr("Delete company workspace", "حذف مساحة الشركة")}</h2>
        <p className="ws-muted">
          {tr(
            "This permanently deletes the company, staff, workers, instructions, and stored files. Export required records first.",
            "يؤدي هذا إلى حذف الشركة والموظفين والعمال والتعليمات والملفات نهائياً. صدّر السجلات المطلوبة أولاً.",
          )}
        </p>
        <Field
          label={`${tr("Type company name to confirm", "اكتب اسم الشركة للتأكيد")}: ${orgName}`}
        >
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
          />
        </Field>
        <Button
          secondary
          disabled={confirmName !== orgName}
          onClick={() => {
            if (
              confirm(
                tr(
                  "Permanently delete this workspace?",
                  "حذف هذه المساحة نهائياً؟",
                ),
              )
            )
              void act(`${OPS}/workspace/delete`, { confirmName }).then(
                (row) => {
                  if (row) location.reload();
                },
              );
          }}
        >
          {tr("Permanently delete workspace", "حذف المساحة نهائياً")}
        </Button>
      </section>
    </>
  );
}
function StaffPush({
  ar,
  notify,
}: {
  ar: boolean;
  notify: (text: string) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  return (
    <Button
      secondary
      disabled={enabled}
      onClick={async () => {
        try {
          if (!("PushManager" in window) || !("serviceWorker" in navigator))
            throw new Error(
              "Browser push is unavailable; in-app notifications remain available.",
            );
          const { data } = await api<Row>(`${OPS}/push-key`);
          if (!data.enabled || !data.publicKey)
            throw new Error(
              "Push is not configured; in-app notifications remain available.",
            );
          if ((await Notification.requestPermission()) !== "granted") return;
          const registration = await navigator.serviceWorker.register("/sw.js");
          await navigator.serviceWorker.ready;
          const key = String(data.publicKey)
            .replace(/-/g, "+")
            .replace(/_/g, "/");
          const bytes = Uint8Array.from(
            atob(key + "=".repeat((4 - (key.length % 4)) % 4)),
            (c) => c.charCodeAt(0),
          );
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: bytes,
          });
          await api(`${OPS}/push-subscriptions`, {
            method: "POST",
            body: { subscription: subscription.toJSON() },
          });
          setEnabled(true);
          notify(ar ? "تم تفعيل الإشعارات" : "Notifications enabled.");
        } catch (error) {
          notify(errorMessage(error));
        }
      }}
    >
      {enabled ? "✓ " : ""}
      {ar ? "تفعيل إشعارات المتصفح" : "Enable browser notifications"}
    </Button>
  );
}
function QuestionFields({value,onChange,ar}:{value:Row;onChange:(value:Row)=>void;ar:boolean}){
 const tr=(en:string,arabic:string)=>ar?arabic:en;
 return <div className="ws-question-review"><Field label={tr('Question','السؤال')}><input value={value.text||''} maxLength={500} onChange={e=>onChange({...value,text:e.target.value})}/></Field>{(value.options??['','','']).map((option:string,index:number)=><div className="ws-option-edit" key={index}><input type="radio" aria-label={`${tr('Correct answer','الإجابة الصحيحة')} ${index+1}`} checked={value.correctIndex===index} onChange={()=>onChange({...value,correctIndex:index})}/><input aria-label={`${tr('Option','الخيار')} ${index+1}`} maxLength={200} value={option} onChange={e=>onChange({...value,options:value.options.map((v:string,i:number)=>i===index?e.target.value:v)})}/></div>)}</div>;
}
function CalendarView({instructions,ar,open}:{instructions:Row[];ar:boolean;open:(id:string)=>Promise<void>}){
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));const offset=month.getDay();const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();const cells=Array.from({length:Math.ceil((days+offset)/7)*7},(_,i)=>i-offset+1);const tr=(en:string,arabic:string)=>ar?arabic:en;
 return <section className="ws-card ws-pad"><div className="ws-card-title"><Button secondary onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>←</Button><h2>{month.toLocaleDateString(ar?'ar':'en',{month:'long',year:'numeric'})}</h2><Button secondary onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>→</Button></div><div className="ws-calendar-grid">{Array.from({length:7},(_,i)=><strong className="ws-calendar-day" key={i}>{new Date(2026,10,1+i).toLocaleDateString(ar?'ar':'en',{weekday:'short'})}</strong>)}{cells.map((day,index)=><div key={index} className={`ws-calendar-cell ${day<1||day>days?'outside':''}`}><small>{day>=1&&day<=days?day:''}</small>{day>=1&&day<=days&&instructions.filter(row=>{const value=row.scheduledAt||row.deadline||row.publishedAt||row.createdAt;if(!value)return false;const d=new Date(value);return d.getFullYear()===month.getFullYear()&&d.getMonth()===month.getMonth()&&d.getDate()===day;}).map(row=><button key={idOf(row)} onClick={()=>void open(idOf(row))} title={row.title}><span>{row.scheduledAt?'◷':row.deadline?'!':'▤'}</span>{row.title}</button>)}</div>)}</div><p className="ws-muted">{tr('Select an instruction to review its schedule or deadline.','اختر تعليمة لمراجعة موعدها المجدول أو النهائي.')}</p></section>;
}
