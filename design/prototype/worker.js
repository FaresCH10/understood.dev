/* Understood — worker prototype (W-01…W-12), six languages, AR/UR RTL.
   Vanilla JS, no build step. State is local; nothing leaves the browser. */
(function () {
  "use strict";

  var ICONS = {
    play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    alertCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 0 1 4.8 1c0 1.6-2.4 2-2.4 3.6"/><path d="M12 17h.01"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    userX: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5M22 8l-5 5"/>',
    wifiOff: '<path d="m2 2 20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.5a10 10 0 0 1 4-2.3"/><path d="M2 8.8a15 15 0 0 1 5-3"/><path d="M15 5.8a15 15 0 0 1 7 3"/><path d="M19 12.5a10 10 0 0 0-2-1.3"/><path d="M12 20h.01"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v6H5a1 1 0 0 1-1-1zM20 14h-3v6h2a1 1 0 0 0 1-1z"/>',
    message: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
  };

  function ic(name, cls) {
    return '<svg class="ic ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function $(sel) { return document.querySelector(sel); }

  function byId(id) {
    for (var i = 0; i < DEMO.workers.length; i++) if (DEMO.workers[i].id === id) return DEMO.workers[i];
    return null;
  }

  function validLang(l) { return !!window.LANGS[l]; }

  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  }

  function nowClock() {
    var d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function initials(name) {
    var parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map(function (p) { return p.charAt(0); }).join("");
  }

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function loadLast() {
    try {
      var raw = safeGet("understood.worker.last");
      if (!raw) return null;
      var data = JSON.parse(raw);
      var w = byId(data.id);
      if (!w) return null;
      return { id: w.id, name: w.name, lang: validLang(data.lang) ? data.lang : w.lang };
    } catch (e) { return null; }
  }

  function saveLast(worker, lang) {
    safeSet("understood.worker.last", JSON.stringify({ id: worker.id, name: worker.name, lang: lang }));
  }

  /* ── State ──────────────────────────────────────────────── */

  var params = new URLSearchParams(location.search);
  var qState = params.get("state") || "picker";
  var screens = ["picker", "instruction", "completed", "closed", "notfound", "help-sent"];
  var screen = screens.indexOf(qState) !== -1 ? qState : "picker";

  var workerId = params.get("worker");
  if (!byId(workerId)) workerId = null;

  if (!workerId && (screen === "instruction" || screen === "completed")) {
    workerId = screen === "completed" ? "w1" : "w4";
  }

  var lang = params.get("lang");
  if (!validLang(lang)) {
    lang = workerId ? byId(workerId).lang : (safeGet("understood.worker.lang") || "en");
    if (!validLang(lang)) lang = "en";
  }

  var state = {
    screen: screen,
    workerId: workerId,
    lang: lang,
    draftLang: lang,
    preview: params.get("preview") === "1",
    offline: params.get("offline") === "1",
    attempts: 0,
    answer: "unanswered",
    selected: null,
    autoHelp: false,
    helpSent: screen === "help-sent" || params.get("help") === "sent",
    helpReason: params.get("reason") || null,
    sheet: params.get("sheet") === "help" ? "help" : params.get("sheet") === "lang" ? "lang" : null,
    draftReason: null,
    search: "",
    completedAt: null,
    recap: false,
    last: loadLast(),
    returningDismissed: false,
    audio: { playing: false, sec: 0, duration: 0, timer: null }
  };

  (function presetAttempt() {
    var a = params.get("attempt");
    if (a === "1") { state.attempts = 1; state.answer = "wrong1"; state.selected = 1; }
    else if (a === "2") { state.attempts = 2; state.answer = "wrong2"; state.selected = 1; state.autoHelp = true; }
    else if (a === "correct") { state.attempts = 1; state.answer = "correct"; state.selected = 0; }
  })();

  if (screen === "completed") {
    var cw = byId(state.workerId);
    state.completedAt = (cw && cw.completedAt) || nowClock();
  }

  function S() { return window.WORKER_STR[state.lang]; }
  function variant() { return DEMO.instruction.variants[state.lang]; }
  function worker() { return state.workerId ? byId(state.workerId) : null; }
  function title() { return DEMO.instruction.title[state.lang]; }
  function orgName() { return DEMO.org[state.lang === "ar" ? "ar" : "en"]; }
  function actionLabel() { return DEMO.instruction.type === "info" ? S().gotIt : S().done; }

  /* ── Audio (simulated; plays at 4× for the prototype) ────── */

  function stopAudio(reset) {
    clearInterval(state.audio.timer);
    state.audio.timer = null;
    state.audio.playing = false;
    if (reset) state.audio.sec = 0;
    paintAudio();
  }

  function playAudio() {
    var dur = variant().duration;
    if (state.audio.playing) { stopAudio(false); return; }
    if (state.audio.sec >= dur) state.audio.sec = 0;
    state.audio.duration = dur;
    state.audio.playing = true;
    clearInterval(state.audio.timer);
    state.audio.timer = setInterval(function () {
      state.audio.sec += 1;
      if (state.audio.sec >= state.audio.duration) {
        state.audio.sec = state.audio.duration;
        stopAudio(false);
        return;
      }
      paintAudio();
    }, 250);
    paintAudio();
  }

  function paintAudio() {
    var dur = state.audio.duration || variant().duration;
    var sec = Math.min(state.audio.sec, dur);
    var pct = Math.round((sec / dur) * 100);
    var btn = $(".w-play");
    if (btn) {
      btn.classList.toggle("is-playing", state.audio.playing);
      btn.innerHTML = ic(state.audio.playing ? "pause" : "play");
      btn.setAttribute("aria-label", state.audio.playing ? S().pause : S().listen);
    }
    var wave = $(".w-wave");
    if (wave) wave.classList.toggle("is-live", state.audio.playing);
    var fill = $(".a-fill");
    if (fill) fill.style.width = pct + "%";
    var time = $(".a-time");
    if (time) time.textContent = fmtClock(sec) + " / " + fmtClock(dur);
  }

  function waveBars() {
    var heights = [8, 15, 22, 12, 18, 27, 16, 23, 11, 20, 29, 14, 24, 17, 10, 21, 26, 13, 19, 11, 23, 16, 28, 12, 20, 15, 25, 10];
    return heights.map(function (h, i) {
      return '<i style="--h:' + h + "px;--i:" + (i % 9) + '"></i>';
    }).join("");
  }

  function audioCard() {
    var dur = variant().duration;
    var sec = Math.min(state.audio.sec, dur);
    var pct = Math.round((sec / dur) * 100);
    return '<div class="w-audio" data-audio-toggle>' +
      '<button class="w-play' + (state.audio.playing ? " is-playing" : "") + '" type="button" aria-label="' + esc(state.audio.playing ? S().pause : S().listen) + '">' + ic(state.audio.playing ? "pause" : "play") + "</button>" +
      '<span class="a-label">' + esc(S().listen) + "</span>" +
      '<div class="w-wave' + (state.audio.playing ? " is-live" : "") + '">' + waveBars() + "</div>" +
      '<div class="a-progress"><div class="a-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="a-time">' + fmtClock(sec) + " / " + fmtClock(dur) + "</div>" +
      '<div class="a-note">' + esc(S().tapPlay) + "</div>" +
      "</div>";
  }

  /* ── Header / banners ───────────────────────────────────── */

  function header() {
    var L = window.LANGS[state.lang];
    return '<header class="w-head">' +
      '<span class="w-org">' + esc(orgName()) + "</span>" +
      '<button class="w-lang-chip" type="button" data-lang-open aria-label="' + esc(S().langTitle) + '">' + ic("globe") + "<bdi>" + esc(L.native) + "</bdi></button>" +
      "</header>";
  }

  function banners() {
    var out = "";
    if (state.preview) out += '<div class="w-banner blue">' + ic("eye") + "<span>" + esc(S().preview) + "</span></div>";
    if (state.offline) out += '<div class="w-banner amber">' + ic("wifiOff") + "<span>" + esc(S().offline) + "</span></div>";
    return out;
  }

  /* ── Screens ────────────────────────────────────────────── */

  function pickerScreen() {
    var showReturn = state.last && !state.returningDismissed && !state.preview;
    var body = "";

    if (showReturn) {
      var lw = byId(state.last.id) || { name: state.last.name, lang: state.last.lang };
      var lwLang = window.LANGS[lw.lang] || window.LANGS[state.lang];
      body += '<div class="return-card">' +
        '<div class="return-row"><span class="n-av" aria-hidden="true">' + esc(initials(lw.name)) + "</span><div><span>" + esc(S().continueAs) + "</span><strong>" + esc(lw.name) + '</strong><span class="lang-' + lwLang.font + '" lang="' + lw.lang + '">' + esc(lwLang.native) + "</span></div></div>" +
        '<div class="return-actions"><button class="w-btn w-btn-primary" type="button" data-worker="' + esc(state.last.id) + '">' + ic("check") + esc(S().yesMe) + "</button>" +
        '<button class="w-btn w-btn-ghost" type="button" data-return-notme>' + esc(S().notMe) + "</button></div></div>" +
        '<div class="w-picker-foot"><button class="linklike" type="button" data-show-grid>' + ic("search") + esc(S().selectName) + "</button></div>";
    } else {
      var tiles = DEMO.workers.map(function (w) {
        var L = window.LANGS[w.lang];
        return '<button class="name-tile" type="button" data-worker="' + w.id + '" data-name="' + esc(w.name.toLowerCase()) + '">' +
          '<span class="n-av" aria-hidden="true">' + esc(initials(w.name)) + "</span>" +
          '<span class="n-meta"><span class="n-name lang-' + L.font + '" lang="' + w.lang + '">' + esc(w.name) + '</span><span class="n-lang">' + esc(L.native) + "</span></span></button>";
      }).join("");

      body += '<div class="w-search">' + ic("search") + '<input id="w-search" type="search" autocomplete="off" placeholder="' + esc(S().search) + '" aria-label="' + esc(S().search) + '"></div>' +
        '<div class="w-names" id="w-names">' + tiles + '<div class="w-empty-search" id="w-no-match" hidden>' + esc(S().noMatch) + "</div></div>" +
        '<div class="w-picker-foot"><button class="linklike" type="button" data-name-missing>' + ic("help") + esc(S().notHere) + "</button></div>";
    }

    return '<div class="w-main w-picker">' +
      '<h1 class="w-title lang-' + window.LANGS[state.lang].font + '" lang="' + state.lang + '">' + esc(title()) + "</h1>" +
      '<p class="w-sub">' + esc(S().selectName) + "</p>" +
      body + "</div>";
  }

  function optionMarkup(v, i) {
    var letter = window.LANGS[state.lang].letters[i % 3];
    var cls = "q-option";
    var disabled = false;
    var mark = "";

    if (state.answer === "correct") {
      if (i === v.correct) { cls += " is-correct"; mark = '<span class="checkmark">' + ic("check") + "</span>"; }
      else cls += " is-dim";
      disabled = true;
    } else if (state.answer === "wrong2") {
      if (i === v.correct) { cls += " is-correct"; mark = '<span class="checkmark">' + ic("check") + "</span>"; }
      else if (i === state.selected) cls += " is-wrong";
      else cls += " is-dim";
      disabled = true;
    } else if (state.answer === "wrong1" && i === state.selected) {
      cls += " is-wrong";
    }

    return '<button class="' + cls + '" type="button" data-answer="' + i + '"' + (disabled ? " disabled" : "") + ">" +
      '<span class="letter" aria-hidden="true">' + esc(letter) + "</span>" +
      "<span>" + esc(v.options[i]) + "</span>" + mark + "</button>";
  }

  function questionFeedback() {
    if (state.answer === "correct") {
      return '<div class="q-feedback ok">' + ic("checkCircle") + "<span>" + esc(S().correct) + "</span></div>";
    }
    if (state.answer === "wrong1") {
      return '<div class="q-feedback bad">' + ic("alertCircle") + '<span class="fb-body">' + esc(S().wrong1) +
        '<br><button class="listen-again-btn" type="button" data-listen-again>' + ic("volume") + esc(S().listenAgain) + "</button></span></div>";
    }
    if (state.answer === "wrong2") {
      return '<div class="q-feedback bad">' + ic("alertCircle") + "<span>" + esc(S().wrong2) + "</span></div>";
    }
    return "";
  }

  function instructionScreen() {
    var v = variant();
    var doneEnabled = state.answer === "correct" || state.answer === "wrong2";
    return '<div class="w-main w-instruction">' +
      '<h1 class="w-instr-title lang-' + window.LANGS[state.lang].font + '" lang="' + state.lang + '">' + esc(title()) + "</h1>" +
      audioCard() +
      '<div class="w-text-card"><p class="w-instruction-text lang-' + window.LANGS[state.lang].font + '" dir="' + v.dir + '" lang="' + state.lang + '">' + esc(v.text) + "</p>" +
      '<div class="w-disclaimer">' + ic("shield") + "<span>" + esc(S().disclaimer) + "</span></div></div>" +
      '<section class="w-question" aria-labelledby="q-title"><div class="q-head" id="q-title">' + ic("help") + esc(S().quickCheck) + "</div>" +
      '<p class="q-text lang-' + window.LANGS[state.lang].font + '" lang="' + state.lang + '">' + esc(v.question) + "</p>" +
      '<p class="q-hint">' + esc(S().questionHint) + "</p>" +
      '<div class="q-options">' + v.options.map(function (_, i) { return optionMarkup(v, i); }).join("") + "</div>" +
      '<div id="q-feedback">' + questionFeedback() + "</div></section>" +
      "</div>" +
      '<div class="w-actionbar">' +
      '<button class="w-btn w-btn-primary" type="button" data-done' + (doneEnabled ? "" : " disabled") + ">" + esc(actionLabel()) + "</button>" +
      '<button class="help-link" type="button" data-help' + (state.helpSent ? " disabled" : "") + ">" + ic(state.helpSent ? "check" : "message") + esc(state.helpSent ? S().helpRequested : S().helpCta) + "</button>" +
      "</div>";
  }

  function completedScreen() {
    var w = worker();
    var recap = state.recap
      ? '<div class="t-recap">' + audioCard() + '<div class="w-text-card"><p class="w-instruction-text lang-' + window.LANGS[state.lang].font + '" dir="' + variant().dir + '" lang="' + state.lang + '">' + esc(variant().text) + "</p></div></div>"
      : "";
    return '<div class="w-center">' +
      '<span class="t-orb green">' + ic("checkCircle") + "</span>" +
      '<h1 class="t-title">' + esc(S().completedTitle) + "</h1>" +
      '<p class="t-sub">' + esc(S().completedSub) + (w ? " · " + esc(w.name) : "") + "</p>" +
      '<div class="t-time">' + esc(state.completedAt || nowClock()) + "</div>" +
      '<div class="t-actions"><button class="w-btn w-btn-ghost" type="button" data-recap>' + ic(state.recap ? "chevronDown" : "headphones") + esc(S().listenAgain) + "</button></div>" +
      recap +
      (state.preview ? '<p class="t-note">' + esc(S().preview) + "</p>" : "") +
      (state.offline ? '<p class="t-note">' + esc(S().offline) + "</p>" : "") +
      "</div>";
  }

  function helpSentScreen() {
    return '<div class="w-center">' +
      '<span class="t-orb green">' + ic("checkCircle") + "</span>" +
      '<h1 class="t-title">' + esc(S().helpSent) + "</h1>" +
      '<p class="t-sub">' + esc(S().helpSentSub) + "</p>" +
      '<div class="t-actions"><button class="w-btn w-btn-primary" type="button" data-help-close>' + esc(S().close) + "</button></div>" +
      "</div>";
  }

  function closedScreen() {
    return '<div class="w-center">' +
      '<span class="t-orb slate">' + ic("lock") + "</span>" +
      '<h1 class="t-title">' + esc(S().closedTitle) + "</h1>" +
      '<p class="t-sub">' + esc(S().closedSub) + "</p>" +
      "</div>";
  }

  function notFoundScreen() {
    return '<div class="w-center">' +
      '<span class="t-orb blue">' + ic("userX") + "</span>" +
      '<h1 class="t-title">' + esc(S().notHere) + "</h1>" +
      '<p class="t-sub">' + esc(S().notHereBody) + "</p>" +
      '<div class="t-actions"><button class="w-btn w-btn-ghost" type="button" data-back-picker>' + ic("arrowLeft") + esc(S().backToNames) + "</button></div>" +
      "</div>";
  }

  function screenMarkup() {
    if (state.screen === "picker") return pickerScreen();
    if (state.screen === "instruction") return instructionScreen();
    if (state.screen === "completed") return completedScreen();
    if (state.screen === "closed") return closedScreen();
    if (state.screen === "notfound") return notFoundScreen();
    if (state.screen === "help-sent") return helpSentScreen();
    return pickerScreen();
  }

  function helpSheet() {
    var reasons = [
      { key: "dontUnderstand", label: S().reasons.dontUnderstand },
      { key: "tools", label: S().reasons.tools },
      { key: "safety", label: S().reasons.safety },
      { key: "other", label: S().reasons.other }
    ];
    return '<div class="sheet-scrim" id="sheet-scrim"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' +
      '<div class="sheet-handle" aria-hidden="true"></div>' +
      '<h2 id="sheet-title">' + esc(S().helpTitle) + "</h2><p class=\"sheet-sub\">" + esc(S().helpSub) + "</p>" +
      '<div class="reason-list">' + reasons.map(function (r) {
        return '<button class="reason' + (state.draftReason === r.key ? " is-selected" : "") + '" type="button" data-reason="' + r.key + '"><span class="radio" aria-hidden="true"></span><span>' + esc(r.label) + "</span></button>";
      }).join("") + "</div>" +
      '<div class="sheet-actions"><button class="w-btn w-btn-ghost" type="button" data-sheet-cancel>' + esc(S().cancel) + "</button>" +
      '<button class="w-btn w-btn-primary" type="button" data-help-send' + (state.draftReason ? "" : " disabled") + ">" + ic("message") + esc(S().send) + "</button></div>" +
      "</div></div>";
  }

  function langSheet() {
    return '<div class="sheet-scrim" id="sheet-scrim"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' +
      '<div class="sheet-handle" aria-hidden="true"></div>' +
      '<h2 id="sheet-title">' + esc(S().langTitle) + "</h2>" +
      '<div class="lang-list">' + window.LANG_ORDER.map(function (code) {
        var L = window.LANGS[code];
        return '<button class="lang-row' + (state.draftLang === code ? " is-active" : "") + '" type="button" data-lang-set="' + code + '">' +
          '<span class="lang-native lang-' + L.font + '" lang="' + code + '">' + esc(L.native) + "</span>" +
          '<span class="lang-en">' + esc(L.en) + "</span>" +
          '<span class="lang-check">' + ic("check") + "</span></button>";
      }).join("") + "</div>" +
      '<div class="lang-note">' + ic("globe") + "<span>" + esc(S().langNote) + "</span></div>" +
      '<div class="sheet-actions"><button class="w-btn w-btn-ghost" type="button" data-sheet-cancel>' + esc(S().cancel) + "</button>" +
      '<button class="w-btn w-btn-primary" type="button" data-lang-save>' + esc(S().save) + "</button></div>" +
      "</div></div>";
  }

  /* ── Prototype panel (outside the phone) ────────────────── */

  function panelMarkup() {
    var screenOpts = [
      ["picker", "Picker"],
      ["instruction", "Instruction"],
      ["completed", "Completed"],
      ["closed", "Closed link"],
      ["notfound", "Name missing"],
      ["help-sent", "Help sent"]
    ];
    var answers = [
      ["unanswered", "Unanswered"],
      ["wrong1", "1st wrong"],
      ["wrong2", "2nd wrong"],
      ["correct", "Correct"]
    ];
    var workerOpts = DEMO.workers.map(function (w) {
      return '<option value="' + w.id + '"' + (w.id === state.workerId ? " selected" : "") + ">" + esc(w.name) + " · " + esc(window.LANGS[w.lang].native) + "</option>";
    }).join("");

    return '<h2>Prototype</h2><p class="proto-sub">Not part of the worker UI. Change screens, language, and simulated conditions.</p>' +
      '<div class="proto-group"><span class="plabel">Screen</span><div class="proto-chips">' +
      screenOpts.map(function (s) {
        return '<button type="button" data-p-screen="' + s[0] + '" class="' + (state.screen === s[0] ? "is-active" : "") + '">' + s[1] + "</button>";
      }).join("") + "</div></div>" +
      '<div class="proto-group"><span class="plabel">Language</span><div class="proto-chips">' +
      window.LANG_ORDER.map(function (code) {
        return '<button type="button" data-p-lang="' + code + '" class="' + (state.lang === code ? "is-active" : "") + ' lang-' + window.LANGS[code].font + '">' + esc(window.LANGS[code].native) + "</button>";
      }).join("") + "</div></div>" +
      '<div class="proto-group"><label for="p-worker">Worker</label><select class="proto-select" id="p-worker"><option value="">No one selected</option>' + workerOpts + "</select></div>" +
      '<div class="proto-group"><span class="plabel">Answer state</span><div class="proto-chips">' +
      answers.map(function (a) {
        return '<button type="button" data-p-answer="' + a[0] + '" class="' + (state.answer === a[0] ? "is-active" : "") + '">' + a[1] + "</button>";
      }).join("") + "</div></div>" +
      '<div class="proto-group"><span class="plabel">Simulate</span>' +
      '<label class="proto-toggle"><span>Preview mode</span><input type="checkbox" data-p-toggle="preview"' + (state.preview ? " checked" : "") + "></label>" +
      '<label class="proto-toggle"><span>Offline</span><input type="checkbox" data-p-toggle="offline"' + (state.offline ? " checked" : "") + "></label>" +
      '<label class="proto-toggle"><span>Returning worker</span><input type="checkbox" data-p-toggle="returning"' + (state.last ? " checked" : "") + "></label>" +
      "</div>" +
      '<div class="proto-actions"><button type="button" data-p-copy>Copy deep link</button><button type="button" data-p-reset>Reset saved state</button></div>';
  }

  /* ── Render ─────────────────────────────────────────────── */

  function deepLink() {
    var p = new URLSearchParams();
    p.set("state", state.screen);
    p.set("lang", state.lang);
    if (state.workerId) p.set("worker", state.workerId);
    if (state.preview) p.set("preview", "1");
    if (state.offline) p.set("offline", "1");
    if (state.screen === "instruction") {
      if (state.answer === "wrong1") p.set("attempt", "1");
      else if (state.answer === "wrong2") p.set("attempt", "2");
      else if (state.answer === "correct") p.set("attempt", "correct");
    }
    return location.href.split("?")[0].split("#")[0] + "?" + p.toString();
  }

  function render(preserveScroll) {
    var scroller = $("#phone-scroll");
    var y = preserveScroll && scroller ? scroller.scrollTop : 0;
    var L = window.LANGS[state.lang];

    document.documentElement.lang = state.lang;
    document.documentElement.dir = L.dir;
    document.title = "Understood — " + title();
    document.body.className = "lang-" + L.font;

    $("#w-app").innerHTML = header() + banners() + screenMarkup();
    $("#sheet-root").innerHTML = state.sheet === "help" ? helpSheet() : state.sheet === "lang" ? langSheet() : "";
    $("#proto-panel").innerHTML = panelMarkup();

    if (scroller) scroller.scrollTop = y;
  }

  function renderPanelOnly() {
    $("#proto-panel").innerHTML = panelMarkup();
  }

  /* ── Actions ────────────────────────────────────────────── */

  function changeScreen(next) {
    stopAudio(true);
    state.screen = next;
    state.sheet = null;
    state.recap = false;
    if (next === "instruction") {
      if (!state.workerId) state.workerId = "w4";
      if (!params.get("lang") && byId(state.workerId)) state.lang = byId(state.workerId).lang;
      state.answer = "unanswered";
      state.attempts = 0;
      state.selected = null;
      state.autoHelp = false;
      state.completedAt = null;
    }
    if (next === "completed") {
      if (!state.workerId) state.workerId = "w1";
      var w = byId(state.workerId);
      state.completedAt = (w && w.completedAt) || nowClock();
    }
    if (next === "help-sent") state.helpSent = true;
    if (next === "picker") state.returningDismissed = false;
    render(false);
  }

  function selectWorker(id) {
    var w = byId(id);
    if (!w) return;
    state.workerId = w.id;
    state.lang = validLang(state.lang) && params.get("lang") ? state.lang : w.lang;
    state.draftLang = state.lang;
    state.screen = "instruction";
    state.answer = "unanswered";
    state.attempts = 0;
    state.selected = null;
    state.completedAt = null;
    state.returningDismissed = false;
    stopAudio(true);
    if (!state.preview) saveLast(w, state.lang);
    state.last = loadLast();
    render(false);
  }

  function setLanguage(code) {
    if (!validLang(code)) return;
    state.lang = code;
    state.draftLang = code;
    state.audio.sec = 0;
    stopAudio(true);
    if (!state.preview) {
      safeSet("understood.worker.lang", code);
      var w = worker();
      if (w) saveLast(w, code);
    }
    state.last = loadLast();
    render(true);
  }

  function answer(i) {
    if (state.answer === "correct" || state.answer === "wrong2") return;
    var v = variant();
    if (i === v.correct) {
      state.selected = i;
      state.answer = "correct";
    } else {
      state.selected = i;
      state.attempts = (state.attempts || 0) + 1;
      if (state.attempts >= 2) {
        state.answer = "wrong2";
        state.autoHelp = true;
      } else {
        state.answer = "wrong1";
      }
    }
    render(true);
  }

  function complete() {
    if (!(state.answer === "correct" || state.answer === "wrong2")) return;
    stopAudio(true);
    var w = worker();
    state.completedAt = (w && w.completedAt) || nowClock();
    if (!state.preview && w) saveLast(w, state.lang);
    state.last = loadLast();
    state.screen = "completed";
    state.recap = false;
    render(false);
  }

  function closeSheet() {
    state.sheet = null;
    document.getElementById("sheet-root").innerHTML = "";
  }

  document.addEventListener("click", function (e) {
    var el;

    if ((el = e.target.closest("[data-lang-open]"))) {
      state.sheet = "lang";
      state.draftLang = state.lang;
      render(true);
      return;
    }
    if (e.target.id === "sheet-scrim") { closeSheet(); return; }
    if (e.target.closest("[data-sheet-cancel]")) { closeSheet(); return; }

    if ((el = e.target.closest("[data-lang-set]"))) {
      state.draftLang = el.getAttribute("data-lang-set");
      render(true);
      return;
    }
    if (e.target.closest("[data-lang-save]")) {
      setLanguage(state.draftLang);
      state.sheet = null;
      render(true);
      return;
    }
    if ((el = e.target.closest("[data-reason]"))) {
      state.draftReason = el.getAttribute("data-reason");
      render(true);
      return;
    }
    if (e.target.closest("[data-help-send]")) {
      if (!state.draftReason) return;
      state.helpReason = state.draftReason;
      state.helpSent = true;
      state.sheet = null;
      state.screen = "help-sent";
      render(false);
      return;
    }
    if (e.target.closest("[data-help-close]")) {
      state.screen = "instruction";
      render(false);
      return;
    }
    if (e.target.closest("[data-help]")) {
      state.sheet = "help";
      state.draftReason = null;
      render(true);
      return;
    }
    if ((el = e.target.closest("[data-worker]"))) {
      selectWorker(el.getAttribute("data-worker"));
      return;
    }
    if (e.target.closest("[data-return-notme]")) {
      safeRemove("understood.worker.last");
      state.last = null;
      state.returningDismissed = true;
      render(false);
      return;
    }
    if (e.target.closest("[data-show-grid]")) {
      state.returningDismissed = true;
      render(false);
      return;
    }
    if (e.target.closest("[data-name-missing]")) {
      state.screen = "notfound";
      render(false);
      return;
    }
    if (e.target.closest("[data-back-picker]")) {
      state.screen = "picker";
      render(false);
      return;
    }
    if (e.target.closest("[data-audio-toggle]")) {
      playAudio();
      return;
    }
    if ((el = e.target.closest("[data-answer]"))) {
      answer(parseInt(el.getAttribute("data-answer"), 10));
      return;
    }
    if (e.target.closest("[data-listen-again]")) {
      state.audio.sec = 0;
      var audioEl = $(".w-audio");
      if (audioEl && audioEl.scrollIntoView) audioEl.scrollIntoView({ block: "center", behavior: "smooth" });
      playAudio();
      return;
    }
    if (e.target.closest("[data-done]")) {
      complete();
      return;
    }
    if (e.target.closest("[data-recap]")) {
      state.recap = !state.recap;
      render(false);
      if (state.recap) {
        state.audio.sec = 0;
        playAudio();
      }
      return;
    }

    /* Prototype panel */
    if ((el = e.target.closest("[data-p-screen]"))) {
      changeScreen(el.getAttribute("data-p-screen"));
      return;
    }
    if ((el = e.target.closest("[data-p-lang]"))) {
      setLanguage(el.getAttribute("data-p-lang"));
      return;
    }
    if ((el = e.target.closest("[data-p-answer]"))) {
      var a = el.getAttribute("data-p-answer");
      state.screen = "instruction";
      if (!state.workerId) state.workerId = "w4";
      state.attempts = a === "wrong1" ? 1 : a === "wrong2" ? 2 : a === "correct" ? 1 : 0;
      state.answer = a;
      state.selected = a === "unanswered" ? null : a === "correct" ? 0 : 1;
      state.autoHelp = a === "wrong2";
      render(false);
      return;
    }
    if (e.target.closest("[data-p-copy]")) {
      var text = deepLink();
      copyText(text);
      e.target.closest("[data-p-copy]").textContent = "Copied";
      return;
    }
    if (e.target.closest("[data-p-reset]")) {
      safeRemove("understood.worker.last");
      safeRemove("understood.worker.lang");
      location.href = location.href.split("?")[0];
      return;
    }
  });

  document.addEventListener("input", function (e) {
    if (e.target.id === "w-search") {
      state.search = e.target.value;
      var q = state.search.trim().toLowerCase();
      var shown = 0;
      var tiles = document.querySelectorAll(".name-tile");
      Array.prototype.forEach.call(tiles, function (tile) {
        var ok = !q || (tile.getAttribute("data-name") || "").indexOf(q) !== -1;
        tile.hidden = !ok;
        if (ok) shown++;
      });
      var empty = document.getElementById("w-no-match");
      if (empty) empty.hidden = shown !== 0;
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target.id === "p-worker") {
      var id = e.target.value;
      if (!id) { state.workerId = null; render(false); return; }
      var w = byId(id);
      state.workerId = id;
      state.lang = w.lang;
      state.draftLang = w.lang;
      if (state.screen === "picker") state.screen = "instruction";
      render(false);
      return;
    }
    var toggle = e.target.getAttribute("data-p-toggle");
    if (toggle === "preview") { state.preview = e.target.checked; render(false); }
    if (toggle === "offline") { state.offline = e.target.checked; render(false); }
    if (toggle === "returning") {
      if (e.target.checked) {
        var demo = byId("w1");
        state.last = { id: demo.id, name: demo.name, lang: demo.lang };
        saveLast(demo, demo.lang);
        state.returningDismissed = false;
        state.screen = "picker";
      } else {
        state.last = null;
        safeRemove("understood.worker.last");
      }
      render(false);
    }
  });

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  window.addEventListener("beforeunload", function () { stopAudio(true); });

  /* Keyboard: Enter/Space already handled by native buttons. */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && state.sheet) closeSheet();
  });

  render(false);
})();
