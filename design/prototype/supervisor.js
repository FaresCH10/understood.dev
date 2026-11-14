/* Understood — supervisor prototype (S-01…S-16)
   Vanilla JS. No build step. Deep-linkable views via hash. */

(function () {
  "use strict";

  window.__supLang = localStorage.getItem("understood.sup.lang") || "en";

  var state = {
    lang: window.__supLang,
    view: "home",
    crewId: "tb",
    workers: clone(DEMO.workers),
    roster: clone(DEMO.workers),
    otherCrews: {
      villa: clone(DEMO.crews[1].extra),
      office: clone(DEMO.crews[2].extra)
    },
    composer: {
      step: 1,
      type: "task",
      mode: "voice",
      title: DEMO.instruction.title.en,
      textBody: DEMO.instruction.original,
      transcriptConfirmed: true,
      selected: DEMO.workers.map(function (w) { return w.id; }),
      recording: false
    },
    jobLangs: null,
    editingVariant: null,
    previewTexts: {},
    previewQuestions: {},
    shareMsgLang: "en",
    instructionShared: false,
    link: DEMO.instruction.link,
    filter: "all",
    boardSearch: "",
    tab: "all",
    authSent: false,
    authEmail: "yusuf@alnoor.ae",
    procToken: 0,
    procTimers: [],
    audioStops: [],
    recTimer: null
  };

  var root = document.getElementById("view-root");
  var scrim = document.getElementById("scrim");
  var drawer = document.getElementById("drawer");
  var modal = document.getElementById("modal");
  var toasts = document.getElementById("toasts");

  /* ── Utilities ─────────────────────────────────────────── */

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function initials(name) {
    var t = String(name || "?").trim();
    return t.charAt(0).toUpperCase();
  }
  function fmtClock(sec) {
    sec = Math.max(0, Math.round(sec));
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  }
  function demoToday() {
    return "13 Nov 2026";
  }
  function dateStr() {
    try {
      return new Intl.DateTimeFormat(state.lang === "ar" ? "ar-AE-u-nu-latn" : "en-GB", {
        weekday: "long", day: "numeric", month: "long"
      }).format(new Date());
    } catch (e) { return "Wednesday, 13 November"; }
  }
  function crewById(id) {
    return DEMO.crews.find(function (c) { return c.id === id; });
  }
  function crewName(id) {
    var c = crewById(id);
    return c ? c.name[state.lang === "ar" ? "ar" : "en"] : id;
  }
  function rosterFor(id) {
    if (id === "tb") return state.roster;
    return state.otherCrews[id] || [];
  }
  function workerById(id) {
    return state.workers.find(function (w) { return w.id === id; });
  }
  function langNative(k) { return LANGS[k] ? LANGS[k].native : k; }

  function ic(name, cls) {
    var body = ICONS[name] || "";
    return '<svg class="ic ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + body + "</svg>";
  }

  function logoSvg(inverse) {
    var bg = inverse ? "#ECFDF5" : "#0F766E";
    var fg = inverse ? "#0F766E" : "#FFFFFF";
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="' + bg + '"/>' +
      '<path d="M9.5 20v-8M16 22V10M22.5 18v-4" stroke="' + fg + '" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>';
  }

  function toast(msg) {
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = ic("checkCircle") + "<span>" + esc(msg) + "</span>";
    toasts.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
      el.style.transition = "opacity .25s, transform .25s";
      setTimeout(function () { el.remove(); }, 260);
    }, 3000);
  }

  function copyText(text, msg) {
    function done() { toast(msg || t("action.copied")); }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) { /* noop */ }
      document.body.removeChild(ta);
      done();
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 100);
  }

  function stopAudio() {
    state.audioStops.forEach(function (fn) { try { fn(); } catch (e) {} });
    state.audioStops = [];
  }

  function clearJobTimers() {
    state.procToken++;
    state.procTimers.forEach(function (id) { clearTimeout(id); });
    state.procTimers = [];
    if (state.recTimer) {
      clearInterval(state.recTimer);
      state.recTimer = null;
    }
  }

  function lockScroll(lock) {
    document.body.style.overflow = lock ? "hidden" : "";
  }

  function showScrim() { scrim.hidden = false; lockScroll(true); }

  function maybeHideScrim() {
    if (drawer.hidden && modal.hidden) {
      scrim.hidden = true;
      lockScroll(false);
    }
  }

  function closeDrawer() {
    drawer.hidden = true;
    drawer.innerHTML = "";
    maybeHideScrim();
  }

  function closeModal() {
    modal.hidden = true;
    modal.innerHTML = "";
    maybeHideScrim();
  }

  function closeOverlays() {
    closeDrawer();
    closeModal();
  }

  function openModal(html, after) {
    closeDrawer();
    modal.innerHTML = html;
    modal.hidden = false;
    showScrim();
    if (typeof after === "function") after();
  }

  function openDrawer(html) {
    closeModal();
    drawer.innerHTML = html;
    drawer.hidden = false;
    showScrim();
    var btn = drawer.querySelector(".drawer-head .icon-btn");
    if (btn) btn.focus();
  }

  /* ── Icons ─────────────────────────────────────────────── */

  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alertTriangle: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    alertCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/>',
    play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
    share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M12 16V3"/><path d="m7 8 5-5 5 5"/>',
    message: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M20 14h1M14 20h1M20 20h1"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    dots: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    sparkles: '<path d="m12 3 1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7z"/><path d="M19 15.5 20 18l2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    external: '<path d="M14 3h7v7"/><path d="M21 3 10 14"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    wifiOff: '<path d="m2 2 20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.5a10 10 0 0 1 4-2.3"/><path d="M2 8.8a15 15 0 0 1 5-3"/><path d="M15 5.8a15 15 0 0 1 7 3"/><path d="M19 12.5a10 10 0 0 0-2-1.3"/><path d="M12 20h.01"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 0 1 4.8 1c0 1.6-2.4 2-2.4 3.6"/><path d="M12 17h.01"/>'
  };

  /* ── Language & chrome ─────────────────────────────────── */

  function applyStatic() {
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
    window.__supLang = state.lang;
    document.title = t("meta.title");
    var els = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < els.length; i++) els[i].textContent = t(els[i].getAttribute("data-i18n"));
    var arias = document.querySelectorAll("[data-i18n-aria]");
    for (var k = 0; k < arias.length; k++) arias[k].setAttribute("aria-label", t(arias[k].getAttribute("data-i18n-aria")));
    var switchBtns = document.querySelectorAll("[data-set-lang]");
    for (var j = 0; j < switchBtns.length; j++) {
      switchBtns[j].classList.toggle("is-active", switchBtns[j].getAttribute("data-set-lang") === state.lang);
    }
    var org = document.querySelector(".org-switch strong");
    if (org) org.textContent = DEMO.org[state.lang === "ar" ? "ar" : "en"];
    var userName = document.querySelector(".user-meta strong");
    if (userName) userName.textContent = DEMO.supervisor[state.lang === "ar" ? "ar" : "en"];
  }

  function setLang(lang) {
    if (lang !== "en" && lang !== "ar") return;
    state.lang = lang;
    try { localStorage.setItem("understood.sup.lang", lang); } catch (e) {}
    applyStatic();
    renderView();
    updateNav();
    updateCrumbs();
  }

  function updateNav() {
    var navs = document.querySelectorAll("[data-nav]");
    var active = state.view === "board" ? "instructions" : state.view;
    if (state.view === "crew") active = "crews";
    for (var i = 0; i < navs.length; i++) {
      navs[i].classList.toggle("is-active", navs[i].getAttribute("data-nav") === active);
    }
  }

  function updateCrumbs() {
    var crumbs = document.getElementById("crumbs");
    var home = '<a href="#home">' + esc(t("nav.home")) + "</a>";
    var sep = '<span class="sep">/</span>';
    var html = "";
    if (state.view === "home") html = "<strong>" + esc(t("nav.home")) + "</strong>";
    else if (state.view === "instructions") html = "<strong>" + esc(t("nav.instructions")) + "</strong>";
    else if (state.view === "crews") html = "<strong>" + esc(t("nav.crews")) + "</strong>";
    else if (state.view === "crew") html = '<a href="#crews">' + esc(t("nav.crews")) + "</a>" + sep + "<strong>" + esc(crewName(state.crewId)) + "</strong>";
    else if (state.view === "settings") html = "<strong>" + esc(t("nav.settings")) + "</strong>";
    else if (state.view === "composer") html = '<a href="#instructions">' + esc(t("nav.instructions")) + "</a>" + sep + "<strong>" + esc(t("composer.title")) + "</strong>";
    else {
      var title = DEMO.instruction.title[state.lang === "ar" ? "ar" : "en"];
      html = '<a href="#instructions">' + esc(t("nav.instructions")) + "</a>" + sep + "<strong>" + esc(title) + "</strong>";
    }
    crumbs.innerHTML = html;
  }

  /* ── Shared fragments ──────────────────────────────────── */

  function statusPill(w) {
    var map = {
      pending: ["pill-slate", "clock", t("status.pending")],
      opened: ["pill-blue", "eye", t("status.opened")],
      answered: ["pill-blue", "check", t("status.answered")],
      completed: ["pill-green", "checkCircle", t("status.completed")]
    };
    var m = map[w.status] || map.pending;
    return '<span class="pill ' + m[0] + '">' + ic(m[1]) + esc(m[2]) + "</span>";
  }

  function attemptCell(w) {
    if (w.first === true) return '<span class="attempt ok">' + ic("check") + t("board.correct") + "</span>";
    if (w.first === false) return '<span class="attempt bad">' + ic("x") + t("board.wrong") + "</span>";
    return '<span class="attempt none">' + t("board.dash") + "</span>";
  }

  function langCell(lang) {
    var L = LANGS[lang];
    return '<span class="lang-cell"><span>' + esc(L.native) + '</span><span class="code">' + L.code + "</span></span>";
  }

  function helpCell(w) {
    if (!w.help) return '<span class="attempt none">' + t("board.dash") + "</span>";
    if (w.help.resolved) return '<span class="pill pill-slate">' + ic("check") + esc(t("status.resolved")) + "</span>";
    return '<span class="pill pill-amber" title="' + esc(t("reason." + w.help.reason)) + '">' + ic("alertCircle") + esc(t("status.help")) + "</span>";
  }

  function instrRow(item) {
    var title = item.title[state.lang === "ar" ? "ar" : "en"];
    var crew = item.crew[state.lang === "ar" ? "ar" : "en"];
    var time = item.time[state.lang === "ar" ? "ar" : "en"];
    var pill = "";
    if (item.status === "shared") pill = '<span class="pill pill-green">' + ic("share") + esc(t("status.shared")) + "</span>";
    else if (item.status === "draft") pill = '<span class="pill pill-slate">' + ic("edit") + esc(t("status.draft")) + "</span>";
    else pill = '<span class="pill pill-slate">' + ic("lock") + esc(t("status.archived")) + "</span>";
    var meter = item.understood == null
      ? '<div class="meter-line"><span>' + esc(t("status.draft")) + "</span><strong>—</strong></div><div class=\"meter\"></div>"
      : '<div class="meter-line"><span>' + esc(t("kpi.understood")) + "</span><strong>" + item.understood + "%</strong></div><div class=\"meter\"><div class=\"meter-fill is-green\" style=\"width:" + item.understood + "%\"></div></div>";
    return '<div class="instr-row" data-open-instruction="' + item.id + '" role="button" tabindex="0">' +
      '<div class="instr-icon ' + (item.status === "draft" ? "is-draft" : "") + '">' + ic("doc") + '<span class="lang-badge">' + item.langs + "L</span></div>" +
      '<div class="instr-main"><div class="instr-title">' + esc(title) + '</div><div class="instr-meta"><span>' + esc(crew) + '</span><span class="dot"></span><span>' + esc(time) + '</span><span class="dot"></span><span>' + esc(t("meta.languages", { n: item.langs })) + "</span></div></div>" +
      '<div class="instr-meter">' + meter + "</div>" +
      '<div class="instr-side">' + pill + "</div>" +
      ic("chevronRight", "chev") +
      "</div>";
  }

  function kpi(icon, tint, label, value, sub, extra) {
    return '<div class="kpi"><div class="kpi-top"><span class="kpi-icon ' + tint + '">' + ic(icon) + "</span><span class=\"kpi-label\">" + esc(label) + "</span></div>" +
      '<div class="kpi-val">' + value + "</div><div class=\"kpi-sub\">" + esc(sub) + "</div>" + (extra || "") + "</div>";
  }

  function stepper(step) {
    function cls(n) { return n === step ? "is-active" : (n < step ? "is-done" : ""); }
    function num(n) { return n < step ? ic("check") : n; }
    return '<div class="stepper">' +
      '<span class="step ' + cls(1) + '"><span class="step-n">' + num(1) + "</span>" + esc(t("composer.step1")) + "</span>" +
      '<span class="step-line"></span>' +
      '<span class="step ' + cls(2) + '"><span class="step-n">' + num(2) + "</span>" + esc(t("composer.step2")) + "</span>" +
      '<span class="step-line"></span>' +
      '<span class="step ' + cls(3) + '"><span class="step-n">' + num(3) + "</span>" + esc(t("composer.step3")) + "</span>" +
      "</div>";
  }

  /* ── Composer helpers ──────────────────────────────────── */

  function composerSelectedWorkers() {
    return state.roster.filter(function (w) { return state.composer.selected.indexOf(w.id) !== -1; });
  }
  function composerLangCounts() {
    var counts = {};
    composerSelectedWorkers().forEach(function (w) { counts[w.lang] = (counts[w.lang] || 0) + 1; });
    return counts;
  }
  function composerLangs() {
    var counts = composerLangCounts();
    return LANG_ORDER.filter(function (l) { return counts[l]; });
  }
  function syncComposerFields() {
    var title = document.getElementById("compose-title");
    if (title) state.composer.title = title.value;
    var tr = document.getElementById("transcript-text");
    if (tr) state.composer.textBody = tr.value;
    var body = document.getElementById("body-text");
    if (body) state.composer.textBody = body.value;
    var cap = document.getElementById("photo-caption");
    if (cap) state.composer.textBody = cap.value;
  }

  /* ── Views ─────────────────────────────────────────────── */

  function renderView() {
    stopAudio();
    clearJobTimers();
    if (state.view === "home") renderHome();
    else if (state.view === "instructions") renderInstructions();
    else if (state.view === "crews") renderCrews();
    else if (state.view === "crew") renderCrew();
    else if (state.view === "composer") renderComposer();
    else if (state.view === "processing") renderProcessing();
    else if (state.view === "preview") renderPreview();
    else if (state.view === "board") renderBoard();
    else if (state.view === "settings") renderSettings();
    else if (state.view === "signin") renderSignin();
    else renderHome();
    updateNav();
    updateCrumbs();
  }

  function renderHome() {
    var w = state.workers;
    var total = w.length;
    var understood = w.filter(function (x) { return x.status === "completed" && x.first; }).length;
    var opened = w.filter(function (x) { return x.status !== "pending"; }).length;
    var helpOpen = w.filter(function (x) { return x.help && !x.help.resolved; });
    var pending = w.filter(function (x) { return x.status === "pending"; });
    var wrong = w.filter(function (x) { return x.first === false && x.status !== "opened" && x.status !== "pending"; });
    var pct = Math.round((understood / total) * 100);
    var openPct = Math.round((opened / total) * 100);

    var kpiHtml =
      kpi("checkCircle", "green", t("kpi.understood"), pct + "%", understood + " " + t("kpi.of") + " " + total + " · " + t("kpi.understoodSub"),
        '<div class="meter"><div class="meter-fill is-green" style="width:' + pct + '%"></div></div>') +
      kpi("eye", "", t("kpi.opened"), opened, opened + " " + t("kpi.of") + " " + total + " · " + openPct + "%",
        '<div class="meter"><div class="meter-fill" style="width:' + openPct + '%"></div></div>') +
      kpi("alertCircle", "amber", t("kpi.needsHelp"), helpOpen.length, t("kpi.helpSub")) +
      kpi("clock", "slate", t("kpi.pending"), pending.length, t("kpi.pendingSub"));

    var cards = [];
    helpOpen.slice(0, 2).forEach(function (x) {
      cards.push('<div class="ex-card"><div class="ex-top">' + ic("alertTriangle") + esc(t("status.help")) + "</div>" +
        '<div class="ex-name"><span class="avatar avatar-sm">' + esc(initials(x.name)) + "</span>" + esc(x.name) + "</div>" +
        '<div class="ex-reason">' + esc(t("reason." + x.help.reason)) + " · " + esc(t("board.openedAt", { time: x.openedAt })) + "</div>" +
        '<div class="ex-foot"><span class="ex-time">' + esc(x.openedAt) + '</span><button class="btn btn-sm btn-ghost" data-action="mark-resolved" data-id="' + x.id + '">' + ic("check") + esc(t("action.markResolved")) + "</button></div></div>");
    });
    pending.slice(0, 3 - cards.length).forEach(function (x) {
      cards.push('<div class="ex-card is-slate"><div class="ex-top">' + ic("clock") + esc(t("status.pending")) + "</div>" +
        '<div class="ex-name"><span class="avatar avatar-sm">' + esc(initials(x.name)) + "</span>" + esc(x.name) + "</div>" +
        '<div class="ex-reason">' + esc(t("board.pendingSince")) + "</div>" +
        '<div class="ex-foot"><span class="ex-time">—</span><button class="btn btn-sm btn-ghost" data-action="copy-reminder">' + ic("message") + esc(t("action.reminder")) + "</button></div></div>");
    });
    wrong.slice(0, Math.max(0, 3 - cards.length)).forEach(function (x) {
      cards.push('<div class="ex-card is-red"><div class="ex-top">' + ic("x") + esc(t("board.exceptions.wrong")) + "</div>" +
        '<div class="ex-name"><span class="avatar avatar-sm">' + esc(initials(x.name)) + "</span>" + esc(x.name) + "</div>" +
        '<div class="ex-reason">' + esc(t("board.wrong")) + " · " + esc(t("status.completed")) + " " + esc(x.completedAt || x.answeredAt || "") + "</div>" +
        '<div class="ex-foot"><span class="ex-time">' + esc(x.completedAt || x.answeredAt || "") + '</span><button class="btn btn-sm btn-ghost" data-action="view-wrong">' + ic("arrowRight") + esc(t("board.workers")) + "</button></div></div>");
    });

    var quick =
      '<button class="quick-action" data-action="goto-board"><span class="q-ic">' + ic("alertCircle") + "</span><span><strong>" + esc(t("home.quick.review")) + "</strong><span>" + esc(t("home.quick.reviewSub")) + "</span></span></button>" +
      '<button class="quick-action" data-action="new-instruction"><span class="q-ic">' + ic("mic") + "</span><span><strong>" + esc(t("home.quick.share")) + "</strong><span>" + esc(t("home.quick.shareSub")) + "</span></span></button>" +
      '<button class="quick-action" data-action="export-open"><span class="q-ic">' + ic("download") + "</span><span><strong>" + esc(t("home.quick.export")) + "</strong><span>" + esc(t("home.quick.exportSub")) + "</span></span></button>";

    root.innerHTML =
      '<div class="page-head"><div><p class="eyebrow">' + esc(dateStr()) + "</p><h1>" + esc(t("home.greeting")) + "</h1><p class=\"sub\">" + esc(t("home.sub")) + "</p></div>" +
      '<div class="page-actions"><button class="btn btn-primary btn-lg" data-action="new-instruction">' + ic("plus") + esc(t("action.new")) + "</button></div></div>" +
      '<div class="kpis">' + kpiHtml + "</div>" +
      '<div class="section-head"><h2>' + esc(t("home.attention")) + '</h2><a class="link-btn" href="#board">' + esc(t("action.viewBoard")) + ic("chevronRight") + "</a></div>" +
      (cards.length ? '<div class="exception-grid">' + cards.join("") + "</div>" : '<div class="card empty">' + ic("checkCircle") + "<strong>" + esc(t("board.noExceptions")) + "</strong></div>") +
      '<div class="section-head"><h2>' + esc(t("home.recent")) + '</h2><a class="link-btn" href="#instructions">' + esc(t("action.seeAll")) + ic("chevronRight") + "</a></div>" +
      '<div class="instr-list">' + DEMO.recent.map(instrRow).join("") + "</div>" +
      '<div class="section-head"><h2>' + esc(t("home.quick")) + "</h2></div>" +
      '<div class="quick-actions">' + quick + "</div>";

    // Home attention is derived from the board; resolve buttons should keep you on home.
    state._homeAttention = true;
  }

  function renderInstructions() {
    var tabs = [
      { key: "all", label: t("tabs.all"), match: function () { return true; } },
      { key: "shared", label: t("tabs.shared"), match: function (i) { return i.status === "shared"; } },
      { key: "drafts", label: t("tabs.drafts"), match: function (i) { return i.status === "draft"; } },
      { key: "archived", label: t("tabs.archived"), match: function (i) { return i.status === "archived"; } }
    ];
    var tabsHtml = tabs.map(function (tb) {
      var n = DEMO.recent.filter(tb.match).length;
      return '<button class="tab ' + (state.tab === tb.key ? "is-active" : "") + '" data-action="set-tab" data-tab="' + tb.key + '">' + esc(tb.label) + '<span class="count">' + n + "</span></button>";
    }).join("");
    var rows = DEMO.recent.filter((tabs.find(function (x) { return x.key === state.tab; }) || tabs[0]).match);
    root.innerHTML =
      '<div class="page-head"><div><p class="eyebrow">' + esc(t("nav.label")) + "</p><h1>" + esc(t("instructions.title")) + '</h1><p class="sub">' + esc(t("instructions.sub")) + "</p></div>" +
      '<div class="page-actions"><button class="btn btn-primary" data-action="new-instruction">' + ic("plus") + esc(t("action.new")) + "</button></div></div>" +
      '<div class="tabs">' + tabsHtml + "</div>" +
      (rows.length ? '<div class="instr-list">' + rows.map(instrRow).join("") + "</div>" : '<div class="card empty"><div class="e-ic">' + ic("doc") + "</div><strong>" + esc(t("instructions.empty")) + "</strong></div>");
  }

  function renderCrews() {
    var cards = DEMO.crews.map(function (c) {
      var list = rosterFor(c.id);
      var langs = {};
      list.forEach(function (w) { langs[w.lang] = true; });
      var langKeys = LANG_ORDER.filter(function (l) { return langs[l]; });
      return '<button class="crew-card" data-action="open-crew" data-crew="' + c.id + '">' +
        '<div class="crew-top"><span class="crew-ic">' + ic("users") + '</span><span class="crew-name">' + esc(c.name[state.lang === "ar" ? "ar" : "en"]) + '<span class="crew-site">' + esc(c.site[state.lang === "ar" ? "ar" : "en"]) + "</span></span>" + ic("chevronRight", "chev") + "</div>" +
        '<div class="crew-stats"><span><strong>' + list.length + "</strong> " + esc(t("nav.crews").length ? "workers" : "workers") + "</span><span><strong>" + langKeys.length + "</strong> languages</span></div>" +
        '<div class="crew-langs">' + langKeys.map(function (l) { return '<span class="lang-dot"><i></i>' + esc(LANGS[l].native) + "</span>"; }).join("") + "</div>" +
        "</button>";
    }).join("");
    root.innerHTML =
      '<div class="page-head"><div><p class="eyebrow">' + esc(t("nav.label")) + "</p><h1>" + esc(t("crews.title")) + '</h1><p class="sub">' + esc(t("crews.sub")) + "</p></div>" +
      '<div class="page-actions"><button class="btn btn-ghost" data-action="new-crew">' + ic("plus") + esc(t("crews.new")) + "</button></div></div>" +
      '<div class="crew-grid">' + cards + '<button class="new-crew" data-action="new-crew"><span class="plus-circle">' + ic("plus") + "</span>" + esc(t("crews.new")) + "</button></div>";
  }

  function renderCrew() {
    var c = crewById(state.crewId);
    if (!c) { navigate("crews"); return; }
    var list = rosterFor(c.id);
    var langs = {};
    list.forEach(function (w) { langs[w.lang] = true; });
    var langKeys = LANG_ORDER.filter(function (l) { return langs[l]; });
    var name = c.name[state.lang === "ar" ? "ar" : "en"];
    var site = c.site[state.lang === "ar" ? "ar" : "en"];

    var rows = list.map(function (w) {
      return '<tr data-crew-row data-name="' + esc((w.name + " " + LANGS[w.lang].en + " " + LANGS[w.lang].native).toLowerCase()) + '" data-lang="' + w.lang + '">' +
        '<td><div class="cell-user"><span class="avatar avatar-sm">' + esc(initials(w.name)) + '</span><span class="name">' + esc(w.name) + "</span></div></td>" +
        "<td>" + langCell(w.lang) + "</td>" +
        '<td class="tnum">' + esc(w.phone || "—") + "</td>" +
        '<td class="tnum">' + esc(w.since || "—") + "</td></tr>";
    }).join("");

    root.innerHTML =
      '<div class="page-head"><div><p class="eyebrow"><a href="#crews">' + esc(t("nav.crews")) + "</a> · " + esc(site) + "</p><h1>" + esc(name) + '</h1><p class="sub">' + list.length + " " + esc(t("meta.workers", { n: "" }).replace(/^\s+/, "")) + " · " + langKeys.length + " " + esc(t("meta.languages", { n: "" }).replace(/^\s+/, "")) + "</p></div>" +
      '<div class="page-actions"><button class="btn btn-ghost" data-action="import-csv" data-crew="' + c.id + '">' + ic("file") + esc(t("crew.import")) + '</button><button class="btn btn-primary" data-action="add-worker" data-crew="' + c.id + '">' + ic("plus") + esc(t("crew.addWorker")) + "</button></div></div>" +
      '<div class="table-card"><div class="table-toolbar">' +
      '<div class="search">' + ic("search") + '<input id="crew-search" type="search" placeholder="' + esc(t("crew.search")) + '" aria-label="' + esc(t("crew.search")) + '"></div>' +
      '<select class="select" id="crew-lang-filter" style="width:auto;height:34px;font-size:11.5px" aria-label="' + esc(t("crew.allLangs")) + '"><option value="">' + esc(t("crew.allLangs")) + "</option>" +
      langKeys.map(function (l) { return '<option value="' + l + '">' + esc(LANGS[l].native) + "</option>"; }).join("") + "</select>" +
      '<span class="spacer"></span><span class="help" id="crew-count">' + list.length + " " + esc(t("meta.workers", { n: list.length })) + "</span></div>" +
      '<div class="table-scroll"><table class="data"><thead><tr><th>' + esc(t("table.worker")) + "</th><th>" + esc(t("table.language")) + "</th><th>" + esc(t("table.phone")) + "</th><th>" + esc(t("table.added")) + "</th></tr></thead><tbody id=\"crew-tbody\">" + rows + "</tbody></table></div>" +
      '<div class="table-foot"><span id="crew-foot">' + list.length + " " + esc(t("meta.workers", { n: list.length })) + '</span><span>' + esc(t("table.phone")) + " · " + esc(t("worker.phoneHelp")) + "</span></div></div>";

    setupCrewFilters();
  }

  function setupCrewFilters() {
    var q = document.getElementById("crew-search");
    var sel = document.getElementById("crew-lang-filter");
    if (!q || !sel) return;
    function apply() {
      var term = q.value.trim().toLowerCase();
      var lang = sel.value;
      var rows = document.querySelectorAll("[data-crew-row]");
      var shown = 0;
      rows.forEach(function (r) {
        var match = (!term || r.getAttribute("data-name").indexOf(term) !== -1) && (!lang || r.getAttribute("data-lang") === lang);
        r.hidden = !match;
        if (match) shown++;
      });
      var count = document.getElementById("crew-count");
      if (count) count.textContent = shown + " " + t("meta.workers", { n: shown });
      var foot = document.getElementById("crew-foot");
      if (foot) foot.textContent = shown + " / " + rows.length + " " + t("meta.workers", { n: rows.length });
    }
    q.addEventListener("input", apply);
    sel.addEventListener("change", apply);
  }

  function renderComposer() {
    state.composer.recording = false;
    var step = state.composer.step;
    var pageHead =
      '<div class="page-head"><div><p class="eyebrow">' + esc(t("nav.instructions")) + " · " + esc(t("composer.title")) + '</p><h1>' + esc(t("composer.title")) + '</h1><p class="sub">' + esc(t("composer.sub")) + "</p></div>" + stepper(step) + "</div>";

    var html = pageHead + '<div class="tip-card" style="margin-bottom:14px">' + ic("sparkles") + "<span>" + esc(t("composer.prototypeNote")) + "</span></div>";

    if (step === 1) {
      var typeTask = state.composer.type === "task";
      var modeVoice = state.composer.mode === "voice";
      var modeText = state.composer.mode === "text";
      var modePhoto = state.composer.mode === "photo";
      var m = state.composer.mode;

      var modeBody = "";
      if (modeVoice) {
        modeBody =
          '<div class="record-card"><button class="mic" id="mic-btn" data-action="toggle-record" aria-label="' + esc(t("composer.tapRecord")) + '">' + ic("mic") + "</button>" +
          '<div class="rec-body"><div class="rec-time" id="rec-time">' + fmtClock(DEMO.instruction.duration) + '</div><div class="rec-state" id="rec-state">' + esc(t("composer.rerecord")) + "</div></div>" +
          '<div class="wave" id="rec-wave">' + waveBars() + "</div></div>" +
          '<div class="transcript" style="margin-top:10px"><div class="transcript-head"><span>' + esc(t("composer.transcript")) + '</span><span class="chip chip-green">' + ic("check") + esc(t("composer.detected")) + "</span></div>" +
          '<textarea id="transcript-text" aria-label="' + esc(t("composer.transcript")) + '">' + esc(state.composer.textBody) + "</textarea>" +
          '<div class="transcript-foot"><span>' + esc(t("composer.transcriptHelp")) + '</span><button class="btn btn-sm ' + (state.composer.transcriptConfirmed ? "btn-subtle" : "btn-ghost") + '" data-action="confirm-transcript">' + ic("check") + esc(state.composer.transcriptConfirmed ? t("composer.confirmed") : t("composer.confirm")) + "</button></div></div>";
      } else if (modeText) {
        modeBody =
          '<div class="transcript"><div class="transcript-head"><span>' + esc(t("composer.text")) + '</span><span class="chip">' + esc(t("composer.detected")) + "</span></div>" +
          '<textarea id="body-text" style="min-height:170px" aria-label="' + esc(t("composer.text")) + '">' + esc(state.composer.textBody) + "</textarea>" +
          '<div class="transcript-foot"><span>' + esc(t("composer.transcriptHelp")) + "</span></div></div>";
      } else {
        modeBody =
          '<label class="dropzone" for="photo-file">' + '<span class="dz-ic">' + ic("file") + "</span><strong>" + esc(t("composer.photo")) + "</strong><span>JPG · PNG · WEBP · compressed to 1,600px</span></label>" +
          '<input type="file" id="photo-file" accept="image/*" hidden>' +
          '<div class="field" style="margin-top:12px"><label>' + esc(t("composer.message")) + "</label><textarea class=\"textarea\" id=\"photo-caption\" placeholder=\"Add the instruction text…\">" + esc(state.composer.textBody) + "</textarea></div>";
      }

      html +=
        '<div class="composer-grid"><div class="compose-main">' +
        '<div class="card card-pad">' +
        '<div class="field"><label>' + esc(t("composer.type")) + '</label><div class="segmented"><button class="' + (typeTask ? "is-active" : "") + '" data-action="set-type" data-type="task">' + ic("checkCircle") + esc(t("composer.type.task")) + '</button><button class="' + (!typeTask ? "is-active" : "") + '" data-action="set-type" data-type="info">' + ic("eye") + esc(t("composer.type.info")) + "</button></div>" +
        '<p class="type-note">' + esc(typeTask ? t("composer.type.taskNote") : t("composer.type.infoNote")) + "</p></div>" +
        '<div class="field"><label>' + esc(t("composer.titleField")) + '<span class="opt">' + esc(t("composer.optional")) + '</span></label><input class="input" id="compose-title" value="' + esc(state.composer.title) + '" placeholder="' + esc(t("composer.titleField")) + '"></div>' +
        '<div class="field"><label>' + esc(t("composer.message")) + "</label>" +
        '<div class="segmented" style="margin-bottom:9px"><button class="' + (modeVoice ? "is-active" : "") + '" data-action="set-mode" data-mode="voice">' + ic("mic") + esc(t("composer.voice")) + '</button><button class="' + (modeText ? "is-active" : "") + '" data-action="set-mode" data-mode="text">' + ic("doc") + esc(t("composer.text")) + '</button><button class="' + (modePhoto ? "is-active" : "") + '" data-action="set-mode" data-mode="photo">' + ic("file") + esc(t("composer.photo")) + "</button></div>" +
        modeBody + "</div></div>" +

        '<div class="compose-actions"><button class="btn btn-subtle" data-action="save-draft">' + esc(t("composer.saveDraft")) + '</button><button class="btn btn-primary" data-action="compose-next">' + esc(t("composer.nextAudience")) + ic("arrowRight") + "</button></div>" +
        "</div>" +

        '<aside class="compose-side">' +
        '<div class="card side-card"><h3>' + esc(t("composer.audience")) + '</h3><div class="audience-box"><span class="a-ic">' + ic("users") + '</span><div><strong>' + esc(crewName("tb")) + '</strong><span>' + composerSelectedWorkers().length + " " + esc(t("meta.workers", { n: "" }).trim()) + "</span></div></div>" +
        '<div class="side-langs">' + LANG_ORDER.map(function (l) { return '<span class="lang-dot"><i></i>' + esc(LANGS[l].native) + "</span>"; }).join("") + "</div></div>" +
        '<div class="tip-card">' + ic("sparkles") + "<span>" + esc(t("composer.tip")) + "</span></div>" +
        "</aside></div>";
    } else {
      var selected = composerSelectedWorkers();
      var counts = composerLangCounts();
      var langKeys = LANG_ORDER.filter(function (l) { return counts[l]; });
      html +=
        '<div class="audience-grid"><div class="card card-pad">' +
        '<div class="field"><label>' + esc(t("composer.audience")) + '<span class="opt">' + esc(t("composer.audienceHint")) + "</span></label>" +
        DEMO.crews.map(function (c) {
          var locked = c.id !== "tb";
          return '<button class="crew-option ' + (c.id === "tb" ? "is-selected" : "is-disabled") + '" ' + (locked ? "disabled" : 'data-action="select-crew" data-crew="tb"') + '>' +
            '<span class="radio">' + (c.id === "tb" ? ic("check") : "") + '</span><span class="co-main"><strong>' + esc(c.name[state.lang === "ar" ? "ar" : "en"]) + '</strong><span>' + rosterFor(c.id).length + " " + esc(t("meta.workers", { n: "" }).trim()) + " · " + esc(c.site[state.lang === "ar" ? "ar" : "en"]) + "</span></span>" +
            (locked ? '<span class="pill pill-slate">' + esc(t("brand.tag")) + "</span>" : "") + "</button>";
        }).join("") +
        "</div>" +
        '<div class="field"><label>' + esc(t("composer.who")) + '</label><div class="segmented"><button class="' + (state.composer.selected.length === state.roster.length ? "is-active" : "") + '" data-action="audience-all">' + esc(t("composer.everyone", { n: state.roster.length })) + '</button><button class="' + (state.composer.selected.length !== state.roster.length ? "is-active" : "") + '" data-action="open-subset">' + esc(t("composer.subset")) + "</button></div>" +
        '<p class="help" style="margin-top:7px">' + esc(t("composer.subsetSub")) + "</p></div>" +
        '<div class="helper-line"><span class="pill pill-teal">' + ic("users") + esc(t("composer.selected", { n: selected.length })) + "</span></div>" +
        "</div>" +
        '<aside class="card langs-panel"><h3>' + esc(t("composer.langs")) + '</h3><p class="cap">' + esc(t("composer.langsCap")) + '</p><div class="lang-rows">' +
        langKeys.map(function (l) { return '<div class="lang-row"><span class="script">' + esc(LANGS[l].native.charAt(0)) + '</span><span class="lname">' + esc(LANGS[l].native) + '</span><span class="lcount">' + counts[l] + " " + esc(t("meta.workers", { n: "" }).trim()) + "</span></div>"; }).join("") +
        "</div><p class=\"help\" style=\"margin-top:10px\">" + esc(t("composer.langsNote")) + "</p>" +
        '<div class="tip-card" style="margin-top:12px">' + ic("sparkles") + "<span>" + esc(t("composer.generateNote")) + "</span></div></aside></div>" +
        '<div class="compose-actions"><button class="btn btn-subtle" data-action="compose-back">' + ic("arrowLeft") + esc(t("action.back")) + '</button><button class="btn btn-primary btn-lg" data-action="generate" ' + (selected.length ? "" : "disabled") + ">" + ic("sparkles") + esc(t("composer.generate")) + "</button></div>";
    }

    root.innerHTML = html;

    var photo = document.getElementById("photo-file");
    if (photo) {
      photo.addEventListener("change", function () {
        var f = photo.files && photo.files[0];
        if (f) {
          var dz = document.querySelector(".dropzone strong");
          if (dz) dz.textContent = f.name;
        }
      });
    }
  }

  function waveBars() {
    var out = "";
    var heights = [9, 16, 24, 13, 20, 30, 18, 25, 12, 22, 32, 16, 26, 19, 11, 23, 29, 15, 21, 12, 25, 18, 30, 14, 22, 17, 27, 11, 19, 24, 13, 20];
    heights.forEach(function (h, i) {
      out += '<i class="' + (i < 20 ? "on" : "") + '" style="--h:' + h + "px;--d:" + (i % 7) + '"></i>';
    });
    return out;
  }

  function renderProcessing() {
    if (!state.jobLangs || !state.jobLangs.length) state.jobLangs = composerLangs();
    var langs = state.jobLangs;
    var title = DEMO.instruction.title[state.lang === "ar" ? "ar" : "en"];
    var rows = langs.map(function (l) {
      return '<div class="proc-lang" id="proc-' + l + '"><div class="proc-name"><span class="script">' + esc(LANGS[l].native.charAt(0)) + "</span>" + esc(LANGS[l].native) + "</div>" +
        '<div class="stages">' +
        '<span class="stage" data-stage="0"><i class="dot"></i>' + esc(t("processing.translate")) + "</span>" +
        '<span class="stage" data-stage="1"><i class="dot"></i>' + esc(t("processing.question")) + "</span>" +
        '<span class="stage" data-stage="2"><i class="dot"></i>' + esc(t("processing.audio")) + "</span></div>" +
        '<span class="proc-status">' + esc(t("processing.queued")) + "</span></div>";
    }).join("");

    root.innerHTML =
      '<div class="proc-wrap"><div class="proc-head"><div class="proc-orb">' + ic("sparkles") + "</div><h2>" + esc(t("processing.title", { n: langs.length })) + "</h2><p>" + esc(t("processing.sub")) + "</p></div>" +
      '<div class="card proc-card"><div class="proc-bar"><span id="proc-progress"></span></div><div class="proc-meta"><span id="proc-count">0 / ' + langs.length + " " + esc(t("processing.ready")) + "</span><span>" + esc(title) + '</span></div>' + rows + "</div>" +
      '<div class="proc-foot"><span class="safe">' + ic("shield") + esc(t("processing.safe")) + '</span><button class="link-btn" data-action="skip-processing">' + esc(t("processing.skip")) + ic("chevronRight") + "</button></div>" +
      '<div id="proc-done" hidden style="text-align:center;margin-top:18px"><button class="btn btn-primary btn-lg" data-action="review-preview">' + ic("checkCircle") + esc(t("processing.review")) + '</button><p class="help" style="margin-top:8px">' + esc(t("processing.auto")) + "</p></div></div>";

    startProcessing(langs);
  }

  function startProcessing(langs) {
    var token = ++state.procToken;
    var progress = document.getElementById("proc-progress");
    var countEl = document.getElementById("proc-count");
    var done = 0;
    var starts = { 0: "processing.translate", 1: "processing.question", 2: "processing.audio" };
    langs.forEach(function (lang, i) {
      var row = document.getElementById("proc-" + lang);
      if (!row) return;
      var stageEls = row.querySelectorAll(".stage");
      var statusEl = row.querySelector(".proc-status");
      [0, 1, 2].forEach(function (j) {
        var id = setTimeout(function () {
          if (token !== state.procToken) return;
          Array.prototype.forEach.call(stageEls, function (el, k) {
            el.classList.toggle("is-done", k < j);
            el.classList.toggle("is-active", k === j);
          });
          statusEl.textContent = t(starts[j]);
        }, i * 280 + j * 440);
        state.procTimers.push(id);
      });
      var fin = setTimeout(function () {
        if (token !== state.procToken) return;
        Array.prototype.forEach.call(stageEls, function (el) {
          el.classList.remove("is-active");
          el.classList.add("is-done");
        });
        statusEl.className = "proc-status ready";
        statusEl.innerHTML = ic("check") + " " + t("processing.ready");
        done++;
        if (progress) progress.style.width = Math.round((done / langs.length) * 100) + "%";
        if (countEl) countEl.textContent = done + " / " + langs.length + " " + t("processing.ready");
        if (done === langs.length) {
          var finish = document.getElementById("proc-done");
          if (finish) finish.hidden = false;
          var auto = setTimeout(function () {
            if (token === state.procToken) navigate("preview");
          }, 2200);
          state.procTimers.push(auto);
        }
      }, i * 280 + 3 * 440);
      state.procTimers.push(fin);
    });
  }

  function variantQuestion(lang) {
    var v = DEMO.instruction.variants[lang];
    var edited = state.previewQuestions[lang];
    if (edited) return edited;
    return { question: v.question, options: v.options.slice(), correct: v.correct };
  }

  function renderPreview() {
    if (!state.jobLangs || !state.jobLangs.length) state.jobLangs = composerLangs();
    var langs = state.jobLangs;
    var title = DEMO.instruction.title[state.lang === "ar" ? "ar" : "en"];
    var variants = langs.map(function (lang) {
      var v = DEMO.instruction.variants[lang];
      var L = LANGS[lang];
      var text = state.previewTexts[lang] || v.text;
      var q = variantQuestion(lang);
      var editing = state.editingVariant === lang;
      var opts = q.options.map(function (o, i) {
        var correct = i === q.correct;
        return '<div class="q-opt ' + (correct ? "is-correct" : "") + '"><span class="letter">' + esc(L.letters[i] || (i + 1)) + "</span><span>" + esc(o) + "</span>" + (correct ? '<span class="correct-flag">' + esc(t("preview.correct")) + "</span>" : "") + "</div>";
      }).join("");
      return '<article class="variant"><div class="var-head"><span class="var-script">' + esc(L.native.charAt(0)) + '</span><span><span class="var-name">' + esc(L.native) + '</span><span class="var-sub">' + (L.dir === "rtl" ? "RTL" : "LTR") + " · " + fmtClock(v.duration) + '</span></span><span class="pill pill-green">' + ic("check") + esc(t("status.ready")) + "</span></div>" +
        '<div class="var-body">' +
        '<div class="audio" data-audio-duration="' + v.duration + '"><button class="audio-btn" data-audio-play aria-label="' + esc(t("audio.play")) + '">' + ic("play") + '</button><div class="audio-body"><div class="audio-top"><span>' + esc(t("processing.audio")) + '</span><span class="time">0:00 / ' + fmtClock(v.duration) + '</span></div><div class="audio-track"><div class="audio-fill"></div></div></div></div>' +
        '<div class="var-text lang-' + L.font + '" dir="' + v.dir + '" lang="' + lang + '">' + esc(text) + "</div>" +
        '<div class="q-block"><div class="q-label">' + ic("help") + esc(t("preview.question")) + '</div><div class="q-text">' + esc(q.question) + '</div><div class="q-opts">' + opts + "</div></div>" +
        "</div>" +
        (editing ? '<div class="var-edit"><textarea id="variant-text-' + lang + '" dir="' + v.dir + '">' + esc(text) + '</textarea><div class="row"><button class="btn btn-sm btn-ghost" data-action="cancel-variant">' + esc(t("action.cancel")) + '</button><button class="btn btn-sm btn-primary" data-action="save-variant" data-lang="' + lang + '">' + esc(t("action.save")) + "</button></div><p class=\"help\">" + esc(t("preview.audioUpdated", { lang: L.native })) + "</p></div>" : "") +
        '<div class="var-foot">' + (state.previewTexts[lang] ? '<span class="edited">' + ic("edit") + esc(t("preview.saved")) + "</span>" : "") + '<span class="spacer"></span><button class="btn btn-sm btn-ghost" data-action="edit-variant" data-lang="' + lang + '">' + ic("edit") + esc(t("preview.edit")) + '</button><button class="btn btn-sm btn-ghost" data-action="edit-question" data-lang="' + lang + '">' + ic("help") + esc(t("preview.editQ")) + '</button><button class="btn btn-sm btn-subtle" data-action="regenerate-variant" data-lang="' + lang + '">' + ic("refresh") + esc(t("preview.regenerate")) + "</button></div></article>";
    }).join("");

    root.innerHTML =
      '<div class="page-head"><div><p class="eyebrow">' + esc(t("nav.instructions")) + " · " + esc(title) + '</p><h1>' + esc(t("preview.title")) + '</h1><p class="sub">' + esc(t("preview.sub")) + '</p><div class="preview-meta"><span class="pill pill-green">' + ic("checkCircle") + esc(t("status.ready")) + '</span><span class="chip">' + ic("users") + esc(t("meta.workers", { n: 24 })) + '</span><span class="chip">' + ic("globe") + esc(t("meta.languages", { n: langs.length })) + "</span></div></div>" +
      '<div class="page-actions"><button class="btn btn-ghost" data-action="compose-back">' + ic("arrowLeft") + esc(t("action.back")) + '</button><button class="btn btn-primary" data-action="open-share">' + ic("share") + esc(t("preview.share")) + "</button></div></div>" +
      '<div class="card original-card"><div class="original-head"><h3>' + esc(t("preview.original")) + '</h3><span class="chip">' + ic("mic") + esc(t("preview.source")) + '</span></div><p class="original-text">' + esc(state.previewTexts.en || DEMO.instruction.original) + "</p></div>" +
      '<div class="variant-grid">' + variants + "</div>";

    initAudio(root);
  }

  function shareMessage(lang) {
    var title = DEMO.instruction.title[lang];
    var org = DEMO.org[lang];
    if (lang === "ar") {
      return "تعليمات الصباح — " + title + "\n\nيرجى فتح الرابط وتأكيد فهمك:\n" + state.link + "\n\nشكرًا — " + org;
    }
    return "Morning briefing — " + title + "\n\nPlease open the link and confirm you understood:\n" + state.link + "\n\nThank you — " + org;
  }

  function qrSvg(seedStr) {
    var n = 21;
    var seed = 0;
    for (var i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) & 0x7fffffff;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function finder(x, y, ox, oy) {
      if (x < ox || x > ox + 6 || y < oy || y > oy + 6) return null;
      var dx = x - ox, dy = y - oy;
      var edge = dx === 0 || dx === 6 || dy === 0 || dy === 6;
      var center = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      return edge || center;
    }
    var cells = "";
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        var f = finder(x, y, 0, 0);
        if (f === null) f = finder(x, y, n - 7, 0);
        if (f === null) f = finder(x, y, 0, n - 7);
        var on = f === null ? rnd() > 0.56 : f;
        if (on) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="#0F172A"/>';
      }
    }
    return '<svg viewBox="0 0 21 21" aria-hidden="true"><rect width="21" height="21" fill="#fff"/>' + cells + "</svg>";
  }

  function renderShareDrawer() {
    drawer.innerHTML =
      '<div class="drawer-head"><div><h2>' + esc(t("preview.shareDrawer")) + "</h2><p>" + esc(t("preview.shareSub")) + '</p></div><button class="icon-btn" data-action="close-drawer" aria-label="' + esc(t("action.close")) + '">' + ic("x") + "</button></div>" +
      '<div class="drawer-body">' +
      (state.instructionShared ? '<div class="link-live">' + ic("checkCircle") + "<span><strong>" + esc(t("status.shared")) + "</strong> · " + esc(t("preview.linkLive", { n: 24 })) + "</span></div>" : "") +
      '<div><div class="label" style="margin-bottom:7px">' + esc(t("preview.link")) + '</div><div class="link-box"><span class="link">' + esc(state.link.replace(/^https?:\/\//, "")) + '</span><button class="btn btn-sm btn-ghost" data-action="copy-link">' + ic("copy") + esc(t("action.copy")) + "</button></div><p class=\"help\" style=\"margin-top:6px\">" + (state.instructionShared ? esc(t("preview.linkLive", { n: 24 })) : esc(t("preview.notShared"))) + "</p></div>" +
      '<div><div class="label" style="margin-bottom:7px">' + esc(t("preview.whatsapp")) + '</div><div class="wa-preview"><div class="wa-head">' + ic("message") + "WhatsApp · " + esc(t("board.reminder")) + '</div><div class="wa-msg" dir="' + (state.shareMsgLang === "ar" ? "rtl" : "ltr") + '">' + esc(shareMessage(state.shareMsgLang)) + '</div><div class="wa-foot"><div class="segmented" style="padding:2px"><button class="' + (state.shareMsgLang === "en" ? "is-active" : "") + '" data-action="share-msg-lang" data-lang="en" style="height:24px;font-size:10.5px">EN</button><button class="' + (state.shareMsgLang === "ar" ? "is-active" : "") + '" data-action="share-msg-lang" data-lang="ar" style="height:24px;font-size:10.5px">العربية</button></div><button class="btn btn-sm btn-ghost" style="margin-inline-start:auto" data-action="copy-message">' + ic("copy") + esc(t("preview.copyMsg")) + "</button></div></div></div>" +
      '<div class="qr-block"><div class="qr-box">' + qrSvg(state.link) + '</div><div class="qr-copy"><strong>' + esc(t("preview.qr")) + '</strong><p>' + esc(t("preview.qrHint")) + "</p></div></div>" +
      '<div class="audience-summary">' + ic("users") + "<span>" + esc(t("preview.audienceRow", { crew: crewName("tb"), n: 24, l: state.jobLangs ? state.jobLangs.length : 6 })) + "</span></div>" +
      "</div>" +
      '<div class="drawer-foot">' +
      (state.instructionShared
        ? '<a class="btn btn-primary btn-full" href="#board" data-action="close-drawer">' + ic("checkCircle") + esc(t("board.workers")) + "</a>"
        : '<button class="btn btn-primary btn-full btn-lg" data-action="share-now">' + ic("share") + esc(t("preview.shareNow")) + "</button>") +
      '<a class="btn btn-ghost btn-full" href="worker.html?state=instruction&preview=1&lang=ar&worker=w4" target="_blank" rel="noopener">' + ic("external") + esc(t("preview.openWorker")) + "</a>" +
      '<button class="link-btn" data-action="regenerate-link" style="justify-content:center;margin-top:2px">' + ic("refresh") + esc(t("preview.regenerateLink")) + "</button>" +
      "</div>";
  }

  function openShareDrawer() {
    closeModal();
    drawer.hidden = false;
    renderShareDrawer();
    showScrim();
    var btn = drawer.querySelector(".drawer-head .icon-btn");
    if (btn) btn.focus();
  }

  function boardCounts() {
    var total = state.workers.length;
    var opened = state.workers.filter(function (w) { return w.status !== "pending"; }).length;
    var understood = state.workers.filter(function (w) { return w.status === "completed" && w.first; }).length;
    var help = state.workers.filter(function (w) { return w.help && !w.help.resolved; }).length;
    return { total: total, opened: opened, understood: understood, help: help };
  }

  function exceptionCards() {
    var out = [];
    state.workers.forEach(function (w) {
      if (w.help && !w.help.resolved) {
        out.push('<div class="bex"><span class="avatar avatar-sm">' + esc(initials(w.name)) + '</span><div class="bex-main"><strong>' + esc(w.name) + ' <span class="pill pill-amber">' + ic("alertCircle") + esc(t("status.help")) + "</span></strong><p>" + esc(t("reason." + w.help.reason)) + " · " + esc(t("board.helpAt", { time: w.help.at })) + '</p><div class="bex-foot"><button class="btn btn-sm btn-ghost" data-action="mark-resolved" data-id="' + w.id + '">' + ic("check") + esc(t("action.markResolved")) + "</button></div></div></div>");
      }
    });
    state.workers.forEach(function (w) {
      if (w.status === "pending") {
        out.push('<div class="bex blue"><span class="avatar avatar-sm">' + esc(initials(w.name)) + '</span><div class="bex-main"><strong>' + esc(w.name) + ' <span class="pill pill-blue">' + ic("clock") + esc(t("status.pending")) + "</span></strong><p>" + esc(t("board.pendingSince")) + '</p><div class="bex-foot"><button class="btn btn-sm btn-ghost" data-action="copy-reminder">' + ic("message") + esc(t("action.reminder")) + "</button></div></div></div>");
      }
    });
    state.workers.forEach(function (w) {
      if (w.first === false && w.status !== "opened" && w.status !== "pending") {
        out.push('<div class="bex red"><span class="avatar avatar-sm">' + esc(initials(w.name)) + '</span><div class="bex-main"><strong>' + esc(w.name) + ' <span class="pill pill-red">' + ic("x") + esc(t("board.wrong")) + "</span></strong><p>" + esc(t("board.firstAttempt")) + " · " + esc(w.status === "completed" ? t("status.completed") + " " + w.completedAt : t("status.answered") + " " + w.answeredAt) + '</p><div class="bex-foot"><button class="btn btn-sm btn-ghost" data-action="filter-wrong">' + ic("filter") + esc(t("board.filter.wrong")) + "</button></div></div></div>");
      }
    });
    return out.join("");
  }

  function renderBoard() {
    var c = boardCounts();
    var pct = Math.round((c.understood / c.total) * 100);
    var openPct = Math.round((c.opened / c.total) * 100);
    var title = DEMO.instruction.title[state.lang === "ar" ? "ar" : "en"];
    var visibleFilter = state.filter;
    var rows = state.workers.map(function (w) {
      var help = w.help ? (w.help.resolved ? "resolved" : "open") : "none";
      var search = (w.name + " " + LANGS[w.lang].en + " " + LANGS[w.lang].native).toLowerCase();
      return '<tr data-board-row data-id="' + w.id + '" data-status="' + w.status + '" data-first="' + (w.first === false ? "wrong" : w.first === true ? "correct" : "") + '" data-help="' + help + '" data-search="' + esc(search) + '">' +
        '<td><div class="cell-user"><span class="avatar avatar-sm">' + esc(initials(w.name)) + '</span><div><span class="name">' + esc(w.name) + '</span><span class="meta">' + esc(LANGS[w.lang].en) + "</span></div></div></td>" +
        "<td>" + langCell(w.lang) + "</td>" +
        "<td>" + statusPill(w) + "</td>" +
        "<td>" + attemptCell(w) + "</td>" +
        "<td>" + helpCell(w) + "</td>" +
        '<td class="tnum">' + esc(w.openedAt || "—") + "</td>" +
        '<td class="tnum">' + esc(w.completedAt || "—") + "</td></tr>";
    }).join("");

    var filters = [
      { key: "all", label: t("board.filter.all"), count: c.total },
      { key: "notOpened", label: t("board.filter.notOpened"), count: state.workers.filter(function (w) { return w.status === "pending"; }).length },
      { key: "wrong", label: t("board.filter.wrong"), count: state.workers.filter(function (w) { return w.first === false; }).length },
      { key: "needsHelp", label: t("board.filter.needsHelp"), count: c.help }
    ];

    root.innerHTML =
      '<div class="page-head board-head"><div><p class="eyebrow">' + esc(t("status.shared")) + " · " + esc(crewName("tb")) + '</p><h1>' + esc(title) + '</h1><p class="sub">' + esc(t("board.sub", { time: "06:58", crew: crewName("tb"), l: 6 })) + '</p></div>' +
      '<div class="page-actions"><button class="btn btn-ghost" data-action="copy-link">' + ic("copy") + esc(t("board.copyLink")) + '</button><button class="btn btn-ghost" data-action="copy-reminder">' + ic("message") + esc(t("board.reminder")) + '</button><button class="btn btn-primary" data-action="export-open">' + ic("download") + esc(t("board.export")) + "</button>" +
      '<div class="menu-wrap"><button class="icon-btn" data-action="toggle-menu" aria-label="' + esc(t("board.more")) + '">' + ic("dots") + '</button><div class="menu" id="board-menu" hidden><button data-action="regenerate-link">' + ic("refresh") + esc(t("board.regenerate")) + '</button><button class="danger" data-action="archive">' + ic("lock") + esc(t("board.archive")) + "</button></div></div>" +
      "</div></div>" +
      '<div class="board-kpis">' +
      '<div class="board-kpi"><div class="bk-label">' + ic("users") + esc(t("board.kpi.targeted")) + '</div><div class="bk-val">' + c.total + '</div><div class="bk-sub">' + esc(crewName("tb")) + "</div></div>" +
      '<div class="board-kpi"><div class="bk-label">' + ic("eye") + esc(t("board.kpi.opened")) + '</div><div class="bk-val">' + c.opened + ' <small>/ ' + c.total + '</small></div><div class="bk-sub">' + openPct + "% " + esc(t("board.kpi.openedSub", { pct: openPct }).replace(String(openPct) + "% ", "")) + '</div><div class="meter"><div class="meter-fill" style="width:' + openPct + '%"></div></div></div>' +
      '<div class="board-kpi"><div class="bk-label">' + ic("checkCircle") + esc(t("board.kpi.understood")) + '</div><div class="bk-val">' + pct + '%</div><div class="bk-sub">' + c.understood + " " + esc(t("kpi.of")) + " " + c.total + " · " + esc(t("board.kpi.understoodSub")) + '</div><div class="meter"><div class="meter-fill is-green" style="width:' + pct + '%"></div></div></div>' +
      '<div class="board-kpi"><div class="bk-label">' + ic("alertCircle") + esc(t("board.kpi.needsHelp")) + '</div><div class="bk-val">' + c.help + '</div><div class="bk-sub">' + esc(t("board.kpi.helpSub", { n: c.help })) + "</div></div>" +
      "</div>" +
      '<div class="board-section-head"><h2>' + ic("alertTriangle") + esc(t("board.attention")) + '</h2><span class="help">' + esc(t("board.attentionSub")) + "</span></div>" +
      (exceptionCards() ? '<div class="board-exceptions">' + exceptionCards() + "</div>" : '<div class="card empty">' + ic("checkCircle") + "<strong>" + esc(t("board.noExceptions")) + "</strong></div>") +
      '<div class="table-card"><div class="table-toolbar"><h3 style="font-size:13px;font-weight:650;margin-inline-end:6px">' + esc(t("board.workers")) + "</h3><div class=\"filter-chips\">" +
      filters.map(function (f) {
        return '<button class="filter-chip ' + (visibleFilter === f.key ? "is-active" : "") + '" data-action="set-board-filter" data-filter="' + f.key + '">' + esc(f.label) + '<span class="n">' + f.count + "</span></button>";
      }).join("") +
      '</div><span class="spacer"></span><div class="search">' + ic("search") + '<input id="board-search" type="search" value="' + esc(state.boardSearch) + '" placeholder="' + esc(t("board.search")) + '" aria-label="' + esc(t("board.search")) + '"></div></div>' +
      '<div class="table-scroll"><table class="data" id="board-table"><thead><tr><th>' + esc(t("table.worker")) + "</th><th>" + esc(t("table.language")) + "</th><th>" + esc(t("table.status")) + "</th><th>" + esc(t("table.first")) + "</th><th>" + esc(t("table.help")) + "</th><th>" + esc(t("table.opened")) + "</th><th>" + esc(t("table.completed")) + "</th></tr></thead><tbody>" +
      rows +
      '<tr id="board-empty" hidden><td colspan="7"><div class="empty"><div class="e-ic">' + ic("search") + "</div><strong>" + esc(t("board.empty")) + "</strong></div></td></tr>" +
      "</tbody></table></div>" +
      '<div class="table-foot"><span id="board-count">' + esc(t("board.footCount", { shown: c.total, total: c.total })) + '</span><span class="live"><span class="dot"></span><span id="board-updated">' + esc(t("board.updated")) + "</span> · " + esc(t("board.auto")) + "</span></div></div>";

    applyBoardFilter();
    var input = document.getElementById("board-search");
    if (input) input.addEventListener("input", function () {
      state.boardSearch = input.value;
      applyBoardFilter();
    });
  }

  function applyBoardFilter() {
    var rows = document.querySelectorAll("[data-board-row]");
    var q = state.boardSearch.trim().toLowerCase();
    var shown = 0;
    rows.forEach(function (r) {
      var ok = false;
      if (state.filter === "all") ok = true;
      else if (state.filter === "notOpened") ok = r.getAttribute("data-status") === "pending";
      else if (state.filter === "wrong") ok = r.getAttribute("data-first") === "wrong";
      else if (state.filter === "needsHelp") ok = r.getAttribute("data-help") === "open";
      if (ok && q && r.getAttribute("data-search").indexOf(q) === -1) ok = false;
      r.hidden = !ok;
      if (ok) shown++;
    });
    var empty = document.getElementById("board-empty");
    if (empty) empty.hidden = shown !== 0;
    var count = document.getElementById("board-count");
    if (count) count.textContent = t("board.footCount", { shown: shown, total: state.workers.length });
  }

  function renderSettings() {
    root.innerHTML =
      '<div class="page-head"><div><p class="eyebrow">' + esc(t("settings.pilot")) + "</p><h1>" + esc(t("settings.title")) + '</h1><p class="sub">' + esc(t("settings.sub")) + '</p></div><div class="page-actions"><button class="btn btn-primary" data-action="save-settings">' + ic("check") + esc(t("action.save")) + "</button></div></div>" +
      '<div class="settings-grid">' +
      '<div class="card settings-card"><h2>' + esc(t("settings.org")) + '</h2><p class="cap">' + esc(t("settings.plan")) + '</p>' +
      '<div class="field"><label>' + esc(t("settings.name")) + '</label><input class="input" value="' + esc(DEMO.org[state.lang === "ar" ? "ar" : "en"]) + '"></div>' +
      '<div class="field"><label>' + esc(t("settings.timezone")) + '</label><select class="select"><option>Asia/Dubai (GMT+4)</option><option>Asia/Riyadh (GMT+3)</option></select></div>' +
      '<div class="field"><label>' + esc(t("settings.defaultLang")) + '</label><div class="segmented"><button class="' + (state.lang === "en" ? "is-active" : "") + '" data-set-lang="en">English</button><button class="' + (state.lang === "ar" ? "is-active" : "") + '" data-set-lang="ar">العربية</button></div><p class="help" style="margin-top:6px">' + esc(t("settings.languageNote")) + "</p></div></div>" +
      '<div class="card settings-card"><h2>' + esc(t("settings.workers")) + '</h2><p class="cap">' + esc(t("settings.workersCap")) + '</p>' +
      LANG_ORDER.map(function (l) {
        return '<div class="settings-row"><span class="sr-label" style="font-size:13px">' + esc(LANGS[l].native) + '</span><span class="pill pill-green">' + ic("check") + esc(t("settings.active")) + "</span></div>";
      }).join("") + "</div>" +
      '<div class="card settings-card"><h2>' + esc(t("settings.data")) + '</h2><p class="cap">' + esc(t("settings.retention")) + '</p>' +
      '<div class="settings-row"><div><div class="sr-label">' + esc(t("board.export")) + '</div><div class="sr-sub">24 ' + esc(t("board.workers")) + " · " + esc(demoToday()) + '</div></div><button class="btn btn-sm btn-ghost" data-action="export-open">' + ic("download") + esc(t("settings.exportAll")) + "</button></div>" +
      '<div class="settings-row"><div><div class="sr-label">' + esc(t("settings.signout")) + '</div><div class="sr-sub">' + esc(DEMO.supervisor[state.lang === "ar" ? "ar" : "en"]) + '</div></div><button class="btn btn-sm btn-ghost" data-action="sign-out">' + esc(t("settings.signout")) + "</button></div></div>" +
      '<div class="card settings-card danger-zone"><h2>' + esc(t("settings.danger")) + '</h2><p class="cap">' + esc(t("settings.deleteSub")) + '</p><div class="settings-row"><div><div class="sr-label">' + esc(t("settings.delete")) + '</div><div class="sr-sub">' + esc(t("settings.deleteSub")) + '</div></div><button class="btn btn-sm btn-danger" disabled>' + esc(t("settings.delete")) + "</button></div></div>" +
      "</div>";
  }

  function renderSignin() {
    var sent = state.authSent;
    var box = sent
      ? '<div class="auth-sent"><div class="sent-ic">' + ic("mail") + "</div><h2>" + esc(t("sign.sent")) + '</h2><p>' + esc(t("sign.sentSub", { email: state.authEmail })) + '</p><span class="chip email-chip">' + esc(state.authEmail) + '</span><div style="display:grid;gap:8px"><button class="btn btn-primary" data-action="sign-open">' + esc(t("sign.openMail")) + '</button><button class="btn btn-ghost" data-action="sign-reset">' + esc(t("sign.back")) + "</button></div></div>"
      : '<h2>' + esc(t("sign.title")) + '</h2><p class="auth-sub">' + esc(t("sign.sub")) + '</p><div class="field"><label>' + esc(t("sign.email")) + '</label><input class="input" id="auth-email" type="email" value="' + esc(state.authEmail) + '" autocomplete="email"></div><button class="btn btn-primary" data-action="sign-send">' + ic("mail") + esc(t("sign.send")) + '</button><div class="auth-divider">or</div><button class="btn btn-ghost" data-action="sign-demo">' + ic("sparkles") + esc(t("sign.demo")) + '</button><p class="auth-fine">' + esc(t("sign.fine")) + "</p>";

    root.innerHTML =
      '<div class="auth"><div class="auth-brand"><a class="brand" href="#home"><span class="brand-mark">' + logoSvg(true) + '</span><span class="brand-name">Understood</span><span class="brand-tag">' + esc(t("brand.tag")) + "</span></a>" +
      '<div class="auth-hero"><span class="kicker">' + ic("checkCircle") + esc(t("sign.heroKicker")) + "</span><h1>" + esc(t("sign.hero")) + "</h1><p>" + esc(t("sign.heroSub")) + "</p>" +
      '<ul class="auth-list"><li><span class="tick">' + ic("check") + "</span>" + esc(t("sign.point1")) + "</li><li><span class=\"tick\">" + ic("check") + "</span>" + esc(t("sign.point2")) + "</li><li><span class=\"tick\">" + ic("check") + "</span>" + esc(t("sign.point3")) + "</li></ul></div>" +
      '<div class="auth-quote"><span class="quote-mark">“</span><p><strong>' + esc(t("sign.quote")) + "</strong><br>" + esc(t("sign.quoteSub")) + "</p></div></div>" +
      '<div class="auth-panel"><div class="auth-box">' + box + '<div class="auth-foot"><span>' + esc(t("auth.footer")) + '</span><div class="auth-lang"><button class="' + (state.lang === "en" ? "is-active" : "") + '" data-set-lang="en">EN</button><button class="' + (state.lang === "ar" ? "is-active" : "") + '" data-set-lang="ar">ع</button></div></div></div></div></div>';
  }

  /* ── Modals ────────────────────────────────────────────── */

  function openSubsetModal() {
    var rows = state.roster.map(function (w) {
      return '<label class="check-row"><input type="checkbox" value="' + w.id + '" ' + (state.composer.selected.indexOf(w.id) !== -1 ? "checked" : "") + '><span><span>' + esc(w.name) + '</span><span class="cr-lang">' + esc(LANGS[w.lang].native) + "</span></span></label>";
    }).join("");
    openModal(
      '<div class="modal-head"><div><h2>' + esc(t("composer.subsetTitle")) + "</h2><p>" + esc(t("composer.subsetSub")) + '</p></div><button class="icon-btn" data-action="close-modal" aria-label="' + esc(t("action.close")) + '">' + ic("x") + "</button></div>" +
      '<div class="modal-body"><div class="worker-checks">' + rows + "</div></div>" +
      '<div class="modal-foot"><span class="left" id="subset-count">' + state.composer.selected.length + " " + esc(t("meta.workers", { n: state.composer.selected.length })) + '</span><button class="btn btn-ghost" data-action="close-modal">' + esc(t("action.cancel")) + '</button><button class="btn btn-primary" data-action="subset-apply">' + esc(t("composer.subsetApply")) + "</button></div>",
      function () {
        var boxes = modal.querySelectorAll("input[type=checkbox]");
        function update() {
          var n = modal.querySelectorAll("input[type=checkbox]:checked").length;
          var el = document.getElementById("subset-count");
          if (el) el.textContent = n + " " + t("meta.workers", { n: n });
        }
        boxes.forEach(function (b) { b.addEventListener("change", update); });
      }
    );
  }

  function openAddWorkerModal(crewId) {
    openModal(
      '<div class="modal-head"><div><h2>' + esc(t("worker.addTitle")) + "</h2><p>" + esc(t("worker.addSub")) + '</p></div><button class="icon-btn" data-action="close-modal" aria-label="' + esc(t("action.close")) + '">' + ic("x") + "</button></div>" +
      '<div class="modal-body"><div class="field"><label>' + esc(t("worker.name")) + '</label><input class="input" id="new-worker-name" placeholder="' + esc(t("worker.name")) + '"></div>' +
      '<div class="field"><label>' + esc(t("worker.language")) + '</label><select class="select" id="new-worker-lang">' + LANG_ORDER.map(function (l) { return '<option value="' + l + '">' + esc(LANGS[l].native) + " · " + esc(LANGS[l].en) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>' + esc(t("worker.phone")) + '</label><input class="input" id="new-worker-phone" placeholder="+971 50 000 0000"><p class="help">' + esc(t("worker.phoneHelp")) + "</p></div>" +
      '<div class="modal-note">' + ic("shield") + "<span>" + esc(t("csv.snapshot")) + "</span></div></div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">' + esc(t("action.cancel")) + '</button><button class="btn btn-primary" data-action="save-worker" data-crew="' + crewId + '">' + ic("plus") + esc(t("worker.add")) + "</button></div>",
      function () { var el = document.getElementById("new-worker-name"); if (el) el.focus(); }
    );
  }

  function openNewCrewModal() {
    openModal(
      '<div class="modal-head"><div><h2>' + esc(t("crew.newTitle")) + "</h2><p>" + esc(t("crew.newSub")) + '</p></div><button class="icon-btn" data-action="close-modal" aria-label="' + esc(t("action.close")) + '">' + ic("x") + "</button></div>" +
      '<div class="modal-body"><div class="field"><label>' + esc(t("crew.name")) + '</label><input class="input" id="new-crew-name" placeholder="' + esc(t("crew.name")) + '"></div><div class="field"><label>' + esc(t("crew.site")) + '</label><input class="input" id="new-crew-site" placeholder="Tower A · Business Bay"></div></div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">' + esc(t("action.cancel")) + '</button><button class="btn btn-primary" data-action="save-crew">' + esc(t("crew.create")) + "</button></div>",
      function () { var el = document.getElementById("new-crew-name"); if (el) el.focus(); }
    );
  }

  function openCsvModal(crewId) {
    openModal(
      '<div class="modal-head"><div><h2>' + esc(t("csv.title")) + "</h2><p>" + esc(t("csv.sub")) + '</p></div><button class="icon-btn" data-action="close-modal" aria-label="' + esc(t("action.close")) + '">' + ic("x") + "</button></div>" +
      '<div class="modal-body"><label class="dropzone" for="csv-file" id="csv-drop"><span class="dz-ic">' + ic("file") + "</span><strong>" + esc(t("csv.drop")) + "</strong><span>" + esc(t("csv.or")) + "</span><input type=\"file\" id=\"csv-file\" accept=\".csv,text/csv\" hidden></label>" +
      '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-sm btn-ghost" data-action="csv-template">' + ic("download") + esc(t("csv.template")) + '</button><button class="btn btn-sm btn-ghost" data-action="csv-sample">' + ic("sparkles") + esc(t("csv.sample")) + "</button></div>" +
      '<div class="modal-note">' + ic("alertTriangle") + "<span>" + esc(t("csv.snapshot")) + "</span></div></div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">' + esc(t("action.close")) + "</button></div>",
      function () {
        var input = document.getElementById("csv-file");
        if (!input) return;
        input.addEventListener("change", function () {
          var f = input.files && input.files[0];
          if (!f) return;
          var reader = new FileReader();
          reader.onload = function () {
            var rows = parseCsv(String(reader.result || ""));
            openCsvPreview(crewId, rows);
          };
          reader.readAsText(f);
        });
        var drop = document.getElementById("csv-drop");
        if (drop) {
          drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.style.borderColor = "var(--primary)"; });
          drop.addEventListener("dragleave", function () { drop.style.borderColor = ""; });
          drop.addEventListener("drop", function (e) {
            e.preventDefault();
            drop.style.borderColor = "";
            var f = e.dataTransfer.files && e.dataTransfer.files[0];
            if (!f) return;
            var reader = new FileReader();
            reader.onload = function () {
              var rows = parseCsv(String(reader.result || ""));
              openCsvPreview(crewId, rows);
            };
            reader.readAsText(f);
          });
        }
      }
    );
  }

  function parseCsv(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });
    if (!lines.length) return [];
    return lines.slice(1).map(function (line) {
      var cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || [];
      cells = cells.map(function (c) { return c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim(); });
      return { name: cells[0] || "", lang: cells[1] || "", phone: cells[2] || "" };
    });
  }

  function normalizeLang(v) {
    var s = String(v || "").trim().toLowerCase();
    for (var k in LANGS) {
      if (k === s || LANGS[k].en.toLowerCase() === s || LANGS[k].native === String(v || "").trim() || LANGS[k].code.toLowerCase() === s) return k;
    }
    return null;
  }

  function openCsvPreview(crewId, rows) {
    var roster = rosterFor(crewId);
    var seen = {};
    var validated = rows.map(function (r) {
      var lang = normalizeLang(r.lang);
      var error = null;
      var key = r.name.toLowerCase();
      if (!r.name) error = t("csv.invalid");
      else if (seen[key] || roster.some(function (w) { return w.name.toLowerCase() === key; })) error = t("csv.duplicate");
      else if (!lang) error = t("csv.badLang");
      seen[key] = true;
      return { name: r.name, lang: lang, langRaw: r.lang, phone: r.phone, error: error };
    });
    var errors = validated.filter(function (r) { return r.error; }).length;
    var valid = validated.length - errors;
    var table = validated.map(function (r) {
      return '<tr class="' + (r.error ? "is-error" : "") + '"><td>' + esc(r.name || "—") + "</td><td>" + esc(r.lang ? LANGS[r.lang].native : r.langRaw || "—") + "</td><td>" + esc(r.phone || "—") + '</td><td class="' + (r.error ? "err" : "csv-status ok") + '">' + esc(r.error || "Ready") + "</td></tr>";
    }).join("");
    openModal(
      '<div class="modal-head"><div><h2>' + esc(t("csv.title")) + "</h2><p>" + esc(errors ? t("csv.errors", { n: errors }) : t("csv.valid", { n: valid })) + '</p></div><button class="icon-btn" data-action="close-modal" aria-label="' + esc(t("action.close")) + '">' + ic("x") + "</button></div>" +
      '<div class="modal-body"><div class="export-preview"><table><thead><tr><th>Name</th><th>Language</th><th>Phone</th><th>Status</th></tr></thead><tbody>' + table + "</tbody></table></div>" +
      (errors ? '<div class="modal-note">' + ic("alertTriangle") + "<span>" + esc(t("csv.sub")) + "</span></div>" : "") +
      '<div class="modal-note">' + ic("shield") + "<span>" + esc(t("csv.snapshot")) + "</span></div></div>" +
      '<div class="modal-foot"><span class="left">' + valid + " / " + validated.length + '</span><button class="btn btn-ghost" data-action="close-modal">' + esc(t("action.cancel")) + '</button>' +
      (errors ? '<button class="btn btn-ghost" data-action="csv-remove-invalid">' + esc(t("csv.removeInvalid")) + "</button>" : "") +
      '<button class="btn btn-primary" data-action="csv-commit" data-crew="' + crewId + '" ' + (errors || !valid ? "disabled" : "") + ">" + esc(t("csv.commit", { n: valid })) + "</button></div>",
      function () { state.csvRows = validated; }
    );
  }

  function openExportModal() {
    var sample = state.workers.slice(0, 5);
    var rows = sample.map(function (w) {
      return "<tr><td>" + esc(w.name) + "</td><td>" + esc(LANGS[w.lang].en) + "</td><td>" + esc(t("status." + w.status)) + "</td><td>" + esc(w.first === true ? t("board.correct") : w.first === false ? t("board.wrong") : "—") + "</td><td class=\"tnum\">" + esc(w.openedAt || "—") + "</td></tr>";
    }).join("");
    openModal(
      '<div class="modal-head"><div><h2>' + esc(t("board.exportTitle")) + "</h2><p>" + esc(t("board.exportSub")) + '</p></div><button class="icon-btn" data-action="close-modal" aria-label="' + esc(t("action.close")) + '">' + ic("x") + "</button></div>" +
      '<div class="modal-body"><div class="export-preview"><table><thead><tr><th>' + esc(t("table.worker")) + "</th><th>" + esc(t("table.language")) + "</th><th>" + esc(t("table.status")) + "</th><th>" + esc(t("table.first")) + "</th><th>" + esc(t("table.opened")) + "</th></tr></thead><tbody>" + rows + '<tr><td colspan="5" style="text-align:center;color:var(--ink-400)">… 19 more</td></tr></tbody></table></div>' +
      '<div class="check-line"><input type="checkbox" id="exp-help" checked>' + esc(t("board.exportInclude")) + '</div><div class="check-line"><input type="checkbox" id="exp-times" checked>' + esc(t("board.exportTimestamps")) + "</div></div>" +
      '<div class="modal-foot"><span class="left">' + esc(t("board.exportRows", { n: state.workers.length })) + '</span><button class="btn btn-ghost" data-action="close-modal">' + esc(t("action.cancel")) + '</button><button class="btn btn-primary" data-action="export-do">' + ic("download") + esc(t("board.exportDo")) + "</button></div>"
    );
  }

  function openQuestionModal(lang) {
    var q = variantQuestion(lang);
    var opts = q.options.map(function (o, i) {
      return '<div class="q-edit-row"><input type="radio" name="q-correct" value="' + i + '" ' + (i === q.correct ? "checked" : "") + '><label class="label" style="flex:1;font-weight:400">' + esc(t("preview.option", { n: i + 1 })) + '</label><input class="input" id="q-opt-' + i + '" value="' + esc(o) + '"></div>';
    }).join("");
    openModal(
      '<div class="modal-head"><div><h2>' + esc(t("preview.editQuestionTitle")) + "</h2><p>" + esc(t("preview.editQuestionSub")) + '</p></div><button class="icon-btn" data-action="close-modal" aria-label="' + esc(t("action.close")) + '">' + ic("x") + "</button></div>" +
      '<div class="modal-body"><div class="field"><label>' + esc(t("preview.question")) + '</label><input class="input" id="q-text" value="' + esc(q.question) + '"></div><div class="field"><label>' + esc(t("preview.correctOption")) + "</label>" + opts + "</div></div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">' + esc(t("action.cancel")) + '</button><button class="btn btn-primary" data-action="save-question" data-lang="' + lang + '">' + esc(t("action.save")) + "</button></div>"
    );
  }

  /* ── Audio ─────────────────────────────────────────────── */

  function initAudio(scope) {
    var boxes = scope.querySelectorAll(".audio");
    var all = [];
    function pauseOthers(except) {
      all.forEach(function (p) { if (p.box !== except) p.stop(); });
    }
    Array.prototype.forEach.call(boxes, function (box) {
      var btn = box.querySelector(".audio-btn");
      var fill = box.querySelector(".audio-fill");
      var time = box.querySelector(".time");
      var dur = parseFloat(box.getAttribute("data-audio-duration")) || 38;
      var elapsed = 0;
      var playing = false;
      var timer = null;
      function renderTime() {
        if (fill) fill.style.width = Math.min(100, (elapsed / dur) * 100) + "%";
        if (time) time.textContent = fmtClock(elapsed) + " / " + fmtClock(dur);
      }
      function stop() {
        playing = false;
        if (timer) { clearInterval(timer); timer = null; }
        box.classList.remove("is-playing");
        if (btn) { btn.innerHTML = ic("play"); btn.setAttribute("aria-label", t("audio.play")); }
      }
      function play() {
        pauseOthers(box);
        playing = true;
        box.classList.add("is-playing");
        if (btn) { btn.innerHTML = ic("pause"); btn.setAttribute("aria-label", t("audio.pause")); }
        timer = setInterval(function () {
          elapsed += 0.25;
          if (elapsed >= dur) {
            elapsed = dur;
            renderTime();
            stop();
            setTimeout(function () { elapsed = 0; renderTime(); }, 500);
          } else {
            renderTime();
          }
        }, 250);
      }
      if (btn) {
        btn.addEventListener("click", function () {
          if (playing) { stop(); } else { if (elapsed >= dur) elapsed = 0; play(); }
        });
      }
      renderTime();
      all.push({ box: box, stop: stop });
      state.audioStops.push(stop);
    });
  }

  /* ── Export ────────────────────────────────────────────── */

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildExportCsv(includeHelp, includeTimes) {
    var headers = ["Worker", "Language", "Status", "First attempt"];
    if (includeHelp) headers.push("Help reason", "Help resolved");
    if (includeTimes) headers.push("Opened", "Answered", "Completed");
    var lines = [headers.join(",")];
    state.workers.forEach(function (w) {
      var row = [w.name, LANGS[w.lang].en + " (" + LANGS[w.lang].native + ")", w.status, w.first === true ? "correct" : w.first === false ? "wrong" : ""];
      if (includeHelp) row.push(w.help ? w.help.reason : "", w.help ? (w.help.resolved ? "yes" : "no") : "");
      if (includeTimes) row.push(w.openedAt || "", w.answeredAt || "", w.completedAt || "");
      lines.push(row.map(csvCell).join(","));
    });
    return "\uFEFF" + lines.join("\r\n");
  }

  function doExport() {
    var includeHelp = document.getElementById("exp-help") ? document.getElementById("exp-help").checked : true;
    var includeTimes = document.getElementById("exp-times") ? document.getElementById("exp-times").checked : true;
    download("understood-delivery-record-2026-11-13.csv", buildExportCsv(includeHelp, includeTimes), "text/csv;charset=utf-8");
    closeModal();
    toast(t("board.exported", { n: state.workers.length }));
  }

  /* ── Routing & events ──────────────────────────────────── */

  function parseHash() {
    var h = (location.hash || "").replace(/^#/, "");
    if (!h) return { view: "home", param: "" };
    var parts = h.split("/");
    return { view: parts[0], param: parts[1] || "" };
  }

  function navigate(view, param) {
    var target = "#" + view + (param ? "/" + param : "");
    if (location.hash === target) {
      route();
    } else {
      location.hash = target;
    }
  }

  function route() {
    closeOverlays();
    var p = parseHash();
    var known = ["home", "instructions", "crews", "crew", "composer", "processing", "preview", "board", "settings", "signin"];
    var view = known.indexOf(p.view) !== -1 ? p.view : "home";
    if (view === "crew" && !crewById(p.param)) view = "crews";
    state.view = view;
    if (view === "crew") state.crewId = p.param;
    document.body.classList.toggle("is-auth", view === "signin");
    applyStatic();
    renderView();
    updateNav();
    updateCrumbs();
    window.scrollTo(0, 0);
  }

  function handleAction(action, el) {
    switch (action) {
      case "new-instruction":
        state.composer.step = 1;
        if (state.view === "composer") renderComposer();
        else navigate("composer");
        break;
      case "goto-settings": navigate("settings"); break;
      case "goto-board": navigate("board"); break;
      case "notifications": navigate("board"); break;
      case "open-instruction": {
        var id = el.getAttribute("data-open-instruction");
        if (id === "ins_01") navigate("board");
        else if (id === "ins_04") navigate("composer");
        else toast(t("toast.sampleOnly"));
        break;
      }
      case "open-crew": navigate("crew", el.getAttribute("data-crew")); break;
      case "new-crew": openNewCrewModal(); break;
      case "add-worker": openAddWorkerModal(el.getAttribute("data-crew")); break;
      case "import-csv": openCsvModal(el.getAttribute("data-crew")); break;
      case "save-worker": {
        var name = (document.getElementById("new-worker-name") || {}).value || "";
        var lang = (document.getElementById("new-worker-lang") || {}).value || "ar";
        var phone = (document.getElementById("new-worker-phone") || {}).value || "";
        name = name.trim();
        if (!name) {
          var inp = document.getElementById("new-worker-name");
          if (inp) { inp.style.borderColor = "var(--red)"; inp.focus(); }
          return;
        }
        var crewId = el.getAttribute("data-crew");
        rosterFor(crewId).push({ id: "n" + Date.now(), name: name, lang: lang, phone: phone, since: demoToday(), status: "active" });
        closeModal();
        renderCrew();
        toast(t("worker.added", { name: name, crew: crewName(crewId) }));
        break;
      }
      case "save-crew": {
        var cname = (document.getElementById("new-crew-name") || {}).value || "";
        var site = (document.getElementById("new-crew-site") || {}).value || "";
        cname = cname.trim();
        if (!cname) { var ci = document.getElementById("new-crew-name"); if (ci) { ci.style.borderColor = "var(--red)"; ci.focus(); } return; }
        var cid = "c" + Date.now();
        DEMO.crews.push({ id: cid, name: { en: cname, ar: cname }, site: { en: site || "—", ar: site || "—" }, workerIds: [], extra: [] });
        state.otherCrews[cid] = [];
        closeModal();
        renderCrews();
        toast(cname + " · " + t("crews.new"));
        break;
      }
      case "csv-template":
        download(t("csv.templateName"), "name,language,phone\r\nHassan M.,Arabic,+971 50 111 2233\r\nJisha V.,Malayalam,\r\n", "text/csv;charset=utf-8");
        toast(t("csv.downloaded"));
        break;
      case "csv-sample":
        openCsvPreview(state.crewId, DEMO.csvSample || window.CSV_SAMPLE);
        break;
      case "csv-remove-invalid": {
        var rows = (state.csvRows || []).filter(function (r) { return !r.error; });
        openCsvPreview(state.crewId, rows.map(function (r) { return { name: r.name, lang: r.lang, phone: r.phone }; }));
        break;
      }
      case "csv-commit": {
        var crew = el.getAttribute("data-crew");
        var validRows = (state.csvRows || []).filter(function (r) { return !r.error; });
        validRows.forEach(function (r) {
          rosterFor(crew).push({ id: "n" + Math.random().toString(36).slice(2, 8), name: r.name, lang: r.lang, phone: r.phone, since: demoToday(), status: "active" });
        });
        closeModal();
        renderCrew();
        toast(t("csv.imported", { n: validRows.length }));
        break;
      }
      case "compose-next":
        syncComposerFields();
        state.composer.step = 2;
        renderComposer();
        break;
      case "compose-back":
        if (state.view === "preview") { navigate("composer"); state.composer.step = 2; renderComposer(); }
        else { syncComposerFields(); state.composer.step = 1; renderComposer(); }
        break;
      case "set-type":
        syncComposerFields();
        state.composer.type = el.getAttribute("data-type");
        renderComposer();
        break;
      case "set-mode":
        syncComposerFields();
        state.composer.mode = el.getAttribute("data-mode");
        renderComposer();
        break;
      case "confirm-transcript":
        state.composer.transcriptConfirmed = !state.composer.transcriptConfirmed;
        renderComposer();
        break;
      case "toggle-record":
        toggleRecording();
        break;
      case "save-draft":
        syncComposerFields();
        toast(t("toast.draftSaved"));
        break;
      case "audience-all":
        state.composer.selected = state.roster.map(function (w) { return w.id; });
        renderComposer();
        break;
      case "open-subset": openSubsetModal(); break;
      case "subset-apply": {
        var chosen = [];
        modal.querySelectorAll("input[type=checkbox]:checked").forEach(function (b) { chosen.push(b.value); });
        state.composer.selected = chosen;
        closeModal();
        renderComposer();
        break;
      }
      case "select-crew": break;
      case "generate":
        syncComposerFields();
        if (!state.composer.selected.length) return;
        state.jobLangs = composerLangs();
        navigate("processing");
        break;
      case "skip-processing":
        clearJobTimers();
        navigate("preview");
        break;
      case "review-preview": navigate("preview"); break;
      case "open-share": openShareDrawer(); break;
      case "close-drawer": closeDrawer(); break;
      case "copy-link": copyText(state.link, t("share.copiedLink")); break;
      case "copy-message": copyText(shareMessage(state.shareMsgLang), t("share.copiedMsg")); break;
      case "share-msg-lang":
        state.shareMsgLang = el.getAttribute("data-lang");
        renderShareDrawer();
        break;
      case "share-now":
        state.instructionShared = true;
        closeDrawer();
        navigate("board");
        toast(t("share.live", { n: 24 }));
        break;
      case "regenerate-link":
        state.link = "https://understood.al/n/" + Math.random().toString(36).slice(2, 8).toUpperCase();
        state.instructionShared = false;
        if (!drawer.hidden) renderShareDrawer();
        toast(t("toast.newLink"));
        break;
      case "edit-variant":
        state.editingVariant = state.editingVariant === el.getAttribute("data-lang") ? null : el.getAttribute("data-lang");
        renderPreview();
        break;
      case "save-variant": {
        var l = el.getAttribute("data-lang");
        var ta = document.getElementById("variant-text-" + l);
        if (ta) state.previewTexts[l] = ta.value;
        state.editingVariant = null;
        renderPreview();
        toast(t("preview.audioUpdated", { lang: LANGS[l].native }));
        break;
      }
      case "cancel-variant":
        state.editingVariant = null;
        renderPreview();
        break;
      case "regenerate-variant":
        toast(t("preview.audioUpdated", { lang: LANGS[el.getAttribute("data-lang")].native }));
        break;
      case "edit-question": openQuestionModal(el.getAttribute("data-lang")); break;
      case "save-question": {
        var ql = el.getAttribute("data-lang");
        var qtext = (document.getElementById("q-text") || {}).value || "";
        var opts = [0, 1, 2].map(function (i) { return (document.getElementById("q-opt-" + i) || {}).value || ""; });
        var radio = modal.querySelector('input[name="q-correct"]:checked');
        state.previewQuestions[ql] = { question: qtext, options: opts, correct: radio ? parseInt(radio.value, 10) : 0 };
        closeModal();
        renderPreview();
        toast(t("preview.qSaved", { lang: LANGS[ql].native }));
        break;
      }
      case "mark-resolved": {
        var w = workerById(el.getAttribute("data-id"));
        if (w && w.help) {
          w.help.resolved = true;
          if (state.view === "board") renderBoard();
          else renderView();
          toast(t("board.resolvedToast", { name: w.name }));
        }
        break;
      }
      case "copy-reminder":
        copyText(shareMessage(state.lang === "ar" ? "ar" : "en").replace(/^تعليمات الصباح|^Morning briefing/, function (m) { return m; }), t("board.reminderCopied"));
        break;
      case "view-wrong":
        state.filter = "wrong";
        navigate("board");
        break;
      case "filter-wrong":
        state.filter = "wrong";
        renderBoard();
        break;
      case "set-board-filter":
        state.filter = el.getAttribute("data-filter");
        renderBoard();
        break;
      case "toggle-menu": {
        var menu = document.getElementById("board-menu");
        if (menu) menu.hidden = !menu.hidden;
        break;
      }
      case "archive":
        toast(t("board.archivedToast"));
        navigate("instructions");
        break;
      case "export-open": openExportModal(); break;
      case "export-do": doExport(); break;
      case "close-modal": closeModal(); break;
      case "save-settings": toast(t("settings.saved")); break;
      case "sign-out":
        state.authSent = false;
        navigate("signin");
        break;
      case "sign-send": {
        var email = (document.getElementById("auth-email") || {}).value || "";
        if (!email.trim()) return;
        state.authEmail = email.trim();
        state.authSent = true;
        renderSignin();
        break;
      }
      case "sign-demo":
        state.authSent = false;
        navigate("home");
        break;
      case "sign-open":
        state.authSent = false;
        navigate("home");
        break;
      case "sign-reset":
        state.authSent = false;
        renderSignin();
        break;
      case "set-tab":
        state.tab = el.getAttribute("data-tab");
        renderInstructions();
        break;
      default:
        break;
    }
  }

  function toggleRecording() {
    var mic = document.getElementById("mic-btn");
    var timeEl = document.getElementById("rec-time");
    var stateEl = document.getElementById("rec-state");
    var wave = document.getElementById("rec-wave");
    if (!mic || !timeEl) return;
    if (state.composer.recording) {
      state.composer.recording = false;
      clearInterval(state.recTimer);
      state.recTimer = null;
      mic.classList.remove("is-recording");
      if (timeEl) timeEl.textContent = fmtClock(DEMO.instruction.duration);
      if (stateEl) stateEl.textContent = t("composer.rerecord");
      if (wave) wave.classList.remove("is-live");
      return;
    }
    state.composer.recording = true;
    var sec = 0;
    mic.classList.add("is-recording");
    if (stateEl) stateEl.textContent = t("composer.recording");
    if (wave) wave.classList.add("is-live");
    state.recTimer = setInterval(function () {
      sec++;
      if (timeEl) timeEl.textContent = fmtClock(sec);
    }, 1000);
  }

  /* ── Listeners ─────────────────────────────────────────── */

  document.addEventListener("click", function (e) {
    var langBtn = e.target.closest("[data-set-lang]");
    if (langBtn) {
      e.preventDefault();
      setLang(langBtn.getAttribute("data-set-lang"));
      if (state.view === "signin") renderSignin();
      return;
    }
    var navLink = e.target.closest("[data-nav]");
    if (navLink) closeOverlays();
    var row = e.target.closest("[data-open-instruction]");
    if (row) {
      e.preventDefault();
      handleAction("open-instruction", row);
      return;
    }
    var actionEl = e.target.closest("[data-action]");
    if (actionEl) {
      e.preventDefault();
      handleAction(actionEl.getAttribute("data-action"), actionEl);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeOverlays();
    if (e.key === "Enter") {
      var row = e.target.closest("[data-open-instruction]");
      if (row) { e.preventDefault(); handleAction("open-instruction", row); }
    }
  });

  scrim.addEventListener("click", closeOverlays);

  window.addEventListener("hashchange", route);

  /* Recover from a direct #preview or #processing entry. */
  if (location.hash === "#preview" && !(state.jobLangs && state.jobLangs.length)) state.jobLangs = LANG_ORDER.slice();
  if (location.hash === "#processing" && !(state.jobLangs && state.jobLangs.length)) state.jobLangs = LANG_ORDER.slice();

  applyStatic();
  route();
})();
