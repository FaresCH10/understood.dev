# 03 — Prototype Guide

**Document 3 of the design pack** · Version 0.1 · Date 2026-11-13
**Owner:** Founder · **Status:** Review-ready · **Related:** [Visual System](./01-visual-system.md) · [Screen Specifications](./02-screen-specifications.md) · [User Flows & Wireframes](../docs/03-user-flows-wireframes.md)

This guide is for anyone opening the prototype: you, a design reviewer, a developer starting Phase 4, or a pilot customer in a screen-share. It explains how to run it, what every route does, which paths are real, which are simulated, and how to reset between demos.

> **Numbering note.** The product documentation in `docs/` has its own document 03 (User Flows & Wireframes). This is design-pack document 03. When a spec conflicts with the prototype, the screen specifications win and the prototype is the bug.

---

## 1. What this prototype is

A **high-fidelity clickable prototype** of the v0.1 product, built to validate hierarchy, density, copy, RTL behavior, and the end-to-end loop before Phase 4 writes production code.

| It is | It is not |
|---|---|
| Static HTML, CSS, and vanilla JS — no framework, no build step | The production app; there is no server, database, auth, or API |
| A faithful visual and behavioral reference for every S- and W-screen in doc 02 | A pixel-perfect design file; there is no Figma source of truth |
| Deep-linkable: every supervisor view and worker state has a URL | Multi-user; two browser windows do not share state |
| Seeded with one realistic org, one crew of 24, and one shared instruction | Connected to OpenAI, ElevenLabs, WhatsApp, or email |
| A test bed for Arabic RTL and all six worker languages | A translation review; HI/UR/ML/BN strings are working drafts |

**What is real:** layout, responsive behavior, typography, color, focus states, keyboard behavior, routing, supervisor UI language switching (EN/AR), worker language switching (six), name search, answer logic with two attempts, help flow, preview/offline states, CSV import review, export option selection, and local persistence of the worker's identity.

**What is simulated:** audio playback (a 4× speed timer with waveform, no sound file), AI transcription/translation/generation (the seeded instruction and variants are pre-written), board updates (seeded 24 deliveries; actions update the board in-session only), QR code (decorative), email delivery, and all timestamps.

---

## 2. Running it

### 2.1 With the included server (recommended)

```bash
cd design/prototype
node serve.mjs
# → http://127.0.0.1:4321/
```

`serve.mjs` is a 47-line static file server with no dependencies. It binds to `127.0.0.1` only. Use a different port with `PORT=8080 node serve.mjs`.

Then open:

| Surface | URL |
|---|---|
| Supervisor console | http://127.0.0.1:4321/ |
| Worker page | http://127.0.0.1:4321/worker.html |
| Worker preset — Arabic, instruction | http://127.0.0.1:4321/worker.html?state=instruction&lang=ar&worker=w4 |
| Worker preset — Malayalam, picker | http://127.0.0.1:4321/worker.html?lang=ml |

### 2.2 Without Node

Open `index.html` or `worker.html` directly from disk (`file://`). Everything works because the prototype deliberately uses script globals and no `fetch`, modules, or CORS-dependent assets. The only loss is that the Google Fonts request may be blocked offline; system fallbacks are defined in `tokens.css`, so layout and Arabic shaping still hold.

### 2.3 Requirements

- Any current Chromium, Firefox, or Safari. Verified in Chromium at 1440, 1024, 430, 360, and 320 CSS pixels wide.
- Network access is optional (fonts only). No installation, login, or API key.
- For phone review, resize the browser or open `worker.html` on a device on the same network via a tunnel. The worker page is mobile-first; the device frame disappears below 620px and the app goes full-bleed.

### 2.4 Stopping and resetting

- Stop the server with `Ctrl+C`.
- The supervisor resets on reload. Nothing is stored.
- The worker stores two `localStorage` keys: `understood.worker.last` (returning worker) and `understood.worker.lang` (language preference). To reset the demo, open DevTools → Application → Local Storage and delete both, or run `localStorage.clear()` in the console, then reload. The prototype panel's **Reset** button also clears stored identity and returns to the picker.
- Seeded roster edits (added workers, imports) live in memory and disappear on reload. The board always returns to its 24 seeded Tower B deliveries.

---

## 3. File map

```
design/
├── 01-visual-system.md            Tokens, type, components, RTL, accessibility
├── 02-screen-specifications.md    S-01…S-16, W-01…W-12, states, copy, handoff
├── 03-prototype-guide.md          This file
├── README.md                      Design pack index and review checklist
└── prototype/
    ├── index.html                 Supervisor shell (sidebar, topbar, overlay roots)
    ├── supervisor.css             Supervisor layout and all S-screen styles
    ├── supervisor.js              Hash router, screen renderers, actions, demo data
    ├── worker.html                Worker shell (phone frame, sheet root)
    ├── worker.css                 Worker layout, device frame, sheets, responsive
    ├── worker.js                  URL params, W-screen renderers, answer/help/audio logic
    ├── tokens.css                 Design tokens shared by both surfaces
    ├── data.js                    Seeded org, 24 workers, crews, instruction, six variants,
    │                              and WORKER_STR for all six languages
    ├── i18n.js                    Supervisor EN/AR UI strings
    └── serve.mjs                  Zero-dependency static server on 127.0.0.1:4321
```

Load order matters: `tokens.css` → surface CSS; `data.js` → (`i18n.js` → `supervisor.js`) or `worker.js`. All scripts are classic scripts, not modules.

---

## 4. Supervisor console

### 4.1 Routes

| Hash | Screen | Notes |
|---|---|---|
| `#home` | S-03 Home | Default. KPIs, attention cards, recent instructions, quick actions |
| `#instructions` | S-04 Instructions | Tabs: All / Shared / Drafts / Archived |
| `#crews` | Crew list | Three seeded crews with language mix |
| `#crew/tb` | S-06 Crew detail | `tb`, `villa`, `office`. Search + language filter |
| `#composer` | S-10/S-11 Composer | Two steps; stepper shows Generate as step 3 |
| `#processing` | S-12 Processing | Auto-advances to preview; generation is simulated |
| `#preview` | S-13 Preview & share | Per-language tabs, editable transcript, share drawer |
| `#board` | S-14 Live board | Seeded 24 deliveries; four KPI filters; row actions |
| `#settings` | S-16 Settings | Org, languages, export defaults, sign out |
| `#signin` | S-01/S-02 Sign-in | Magic-link screen; demo button enters the app |

Any unknown hash falls back to `#home`. `#crew/<unknown>` falls back to `#crews`.

### 4.2 Ten-minute review path (J1)

1. Open `#signin`. Enter any email → **Send me a sign-in link** → **Check your email** state → **I have opened the link**. Or skip the inbox entirely with **Open demo account**. Both land on `#home`.
2. On **Home**, read the four KPIs and the attention cards. Note the status vocabulary: Understood, Opened, Needs help, Pending.
3. Click **New instruction**. In the composer, step 1 is seeded in voice mode with a transcript. Switch between Voice / Text / Photo to see the three capture states. Confirm the transcript, choose **Task**, continue.
4. Step 2: only **Tower B — morning** is selectable (other crews are intentionally disabled in the prototype). Six languages are preselected. Continue.
5. **Processing** runs through per-language stages automatically (~3s total) and lands on Preview.
6. In **Preview**, switch language tabs. Edit the Arabic transcript and watch the language-scoped "audio and check updated" notice; the other languages stay untouched. Open the share drawer: the link, the EN/AR WhatsApp message preview, copy actions, QR, and **Open worker view**.
7. Open the worker preview link — it opens `worker.html?state=instruction&preview=1&lang=ar&worker=w4` in a new tab, with the preview banner and no persistence.
8. Back in the console, go to `#board`. Filter by **Needs help** and **Not opened**. Resolve Karim's help flag; the KPI and row update. Send the reminder to the not-opened row.
9. Use **Export** to open the dialog; toggle options; review the CSV column preview. **Download CSV** produces a real UTF-8 BOM file from the 24 seeded rows; Phase 5 replaces the client builder with the server export.
10. Switch the interface to Arabic with **ع** in the sidebar. Confirm the whole shell mirrors: sidebar on the right, directional icons flipped, numbers and Latin text isolated, media icons unchanged. Switch back to **EN**.

### 4.3 What each screen demonstrates

| Screen | The thing to look at |
|---|---|
| S-01/S-02 | Auth is deliberately plain; magic link, no password, bilingual subject line |
| S-03 Home | Answer to "what needs me now?" — exceptions before activity; percentage is secondary |
| S-04 Instructions | Lifecycle status is scannable; drafts and archived are separated |
| S-06 Crew | Search and language filter; roster is the audience source |
| S-08/S-09 CSV | Column mapping, duplicate detection, unknown-language handling, per-row removal |
| S-10/11 Composer | Capture mode → audience → language coverage; no advanced options on the happy path |
| S-12 Processing | Per-language progress, not a single spinner; failure would be per-language |
| S-13 Preview | Mandatory human review before share; per-language edit isolation |
| S-14 Board | Four states, help flags pinned, resolved in one tap, export nearby |
| S-16 Settings | Org name, default languages, export preferences, pilot usage |

### 4.4 Supervisor shortcuts and limits

- Composer is seeded and does not call AI. Edits update the preview but do not generate audio.
- Only Tower B can be targeted. Villa and Office are visibly disabled with a "prototype" note.
- The board is a snapshot. Roster changes do not add deliveries; resolving help or sending a reminder updates only the in-session board state.
- CSV export runs client-side from the seeded board. It is a real BOM file, but it is not tenant-scoped, paginated, or streamed from the server; Phase 5 replaces it.
- Sign-in accepts any well-formed email. There is no validation beyond the browser's.
- Supervisor UI supports EN and AR only; worker translations exist for all six languages.

---

## 5. Worker page

### 5.1 How the worker arrives

One link per instruction, shared in the WhatsApp group the crew already uses. The link opens the worker page with no app install, no login, and no worker navigation. The page is the whole product for the worker.

### 5.2 URL parameters

| Parameter | Values | Effect |
|---|---|---|
| `state` | `picker` (default), `instruction`, `completed`, `closed`, `notfound`, `help-sent` | Which screen to render |
| `lang` | `ar`, `en`, `hi`, `ur`, `ml`, `bn` | Worker language; overrides the stored/roster language |
| `worker` | `w1`…`w24` | Preselects identity; required for `instruction` (defaults to `w4`) and `completed` (defaults to `w1`) |
| `preview` | `1` | Shows the preview banner; suppresses all persistence (language and identity) |
| `offline` | `1` | Shows the offline banner; the answer queues until reconnect |
| `attempt` | `1`, `2`, `correct` | Presets the answer state on the instruction screen |
| `sheet` | `help`, `lang` | Opens the help reason sheet or language sheet on load |
| `help` | `sent` | Shows the help-sent confirmation instead of the instruction |
| `reason` | `dontUnderstand`, `tools`, `safety`, `other` | Preselects a help reason with `help=sent` |

Examples:

```
worker.html?lang=ml                                   Malayalam picker
worker.html?state=instruction&lang=hi&worker=w2       Hindi instruction
worker.html?state=instruction&lang=ar&worker=w4&attempt=1   First wrong answer
worker.html?state=instruction&lang=ar&worker=w4&attempt=2   Second wrong (help auto-flagged)
worker.html?state=completed&lang=bn&worker=w7         Completed state
worker.html?state=closed&lang=ur                       Closed link
worker.html?state=notfound&lang=en                     Name not found
worker.html?state=instruction&lang=ar&worker=w4&sheet=help   Help sheet open
worker.html?lang=ar&sheet=lang                        Language sheet on picker
worker.html?state=instruction&lang=ar&worker=w4&preview=1&offline=1
```

### 5.3 Worker review path (J2 and J3)

1. Open `worker.html?lang=ml`. The picker shows the company name, the instruction title in Malayalam, and 24 name tiles. Type `ramesh` — the tile filters. Clear the search.
2. Tap **Ramesh K.** The confirmation asks "Continue as Ramesh?" — accept. (This mirrors WORK-1: no accidental identity.)
3. The instruction screen shows the audio hero, the text in Malayalam, and the disclaimer. Tap anywhere on the audio card; the play control, waveform, and progress run. Tap again to pause. Media controls stay LTR.
4. Answer the quick check. Choose the wrong option: it shakes and turns red, the correct option is not revealed until the second attempt, and the feedback offers one more try.
5. Choose wrong again: the correct option is highlighted green, the message says the supervisor will be notified, and the help flag is set automatically. **Done** becomes available.
6. Tap **I need help** at any point: the reason sheet offers four choices; pick one and send. The confirmation says the supervisor has been notified.
7. Reload the picker. The returning card shows "Continue as Ramesh · മലയാളം". Tap it to skip the name step.
8. Change language via the header control: the sheet lists six native-script names; selecting one re-renders the whole page in that language and, outside preview, persists the choice.
9. Open `?state=closed` and `?state=notfound` for the dead-end states; both have exactly one action.

### 5.4 Answer logic, precisely

| Attempt | Result | Done | Help |
|---|---|---|---|
| 1st correct | Green confirmation, replayable audio | Available immediately | Still available |
| 1st wrong | Wrong option shaken and marked; no correct answer revealed; "try once more" | Blocked | Available |
| 2nd wrong | Correct option highlighted; "supervisor will be notified" | Available | Auto-flagged with reason "I don't understand" |
| Help requested | Confirmation; help button disabled on return | Depends on answer | Recorded |

"Understood" on the supervisor side is defined as **first-attempt correct + Done**. In the prototype the board is seeded, so worker actions do not write to it; the logic above is what Phase 4 must implement.

### 5.5 What the worker never sees

No account, no password, no app store, no bottom navigation, no settings, no instruction history, no other workers' answers, no "quiz" language, no autoplay, no color-only status, and no English fallback presented as the worker's language. Every worker screen has one primary action.

---

## 6. The prototype panel

The worker page includes a floating **Prototype** panel. It is not part of the product; it is a review instrument and is hidden at phone widths (≤1100px) to keep the canvas honest.

| Control | Use |
|---|---|
| Screen chips | Jump between picker, instruction, completed, help-sent, closed, not-found |
| Language | Switch all six worker languages live |
| Worker | Switch identity, which changes the roster language and name |
| Answer state | Preset unanswered / wrong 1 / wrong 2 / correct to demo J3 without clicking |
| Preview toggle | Turn preview mode on/off; verify no persistence |
| Offline toggle | Show the offline banner |
| Returning toggle | Show/hide the returning-worker card |
| Copy link | Copy the current state as a shareable deep link |
| Reset | Clear stored identity and language, return to the picker |

When demoing, keep the panel closed or use a phone-width window. The panel's state is reflected in the URL, so any state you reach can be copied and reopened.

---

## 7. Review scripts

Use these to sign off the design. Each maps to a PRD journey and a set of requirements. Check the box only when the behavior matches doc 02.

### J1 — Supervisor sends an instruction (≈8 min)

- [ ] Sign in → check email → demo workspace.
- [ ] Home answers "what needs me now?" before "what happened?"
- [ ] New instruction: record (simulated) → transcript → confirm → task.
- [ ] Audience: Tower B only, six languages, per-language coverage visible.
- [ ] Processing shows per-language progress, not one spinner.
- [ ] Preview requires review; one language can be edited without touching others.
- [ ] Share drawer: one link, bilingual message, copy and worker preview.
- [ ] Board shows 24 seeded deliveries; exceptions are above activity.
- [ ] Interface switches EN ↔ AR with full mirroring; media controls do not mirror.

### J2 — Worker happy path (≤90 seconds, timed)

- [ ] Link opens to the picker with the company name and instruction title.
- [ ] Name search works in Latin and Arabic script.
- [ ] Identity confirmation appears before the instruction.
- [ ] Audio is the dominant control; the whole card is tappable.
- [ ] Text is ≥16px in the worker's script, with the disclaimer visible.
- [ ] Quick check: one tap, three full-width options.
- [ ] Correct → green confirmation + Done.
- [ ] Returning worker card appears on the next visit.

### J3 — Worker lost path

- [ ] First wrong: correct answer hidden, one more attempt offered.
- [ ] Second wrong: correct answer highlighted, supervisor notification stated plainly.
- [ ] Help sheet: four reasons, cancel and send, no dead ends.
- [ ] Help sent: confirmation with one close action.
- [ ] Closed and not-found links each have one clear action.

### J4 — Supervisor fixes a language

- [ ] Preview tabs isolate languages; each variant shows its own audio, text, and question.
- [ ] Inline edit is possible in the selected language only.
- [ ] Save marks that language edited and shows a language-scoped "audio and check updated" notice.
- [ ] Other languages are unchanged after the save.
- [ ] Note: real regeneration and the share block are Phase 4 behavior (doc 02 S-13); the prototype simulates the notice only.

### J5 — Supervisor proves it

- [ ] Export is reachable from the board and from an instruction.
- [ ] Dialog states scope, format, and included columns.
- [ ] Arabic names render correctly in the preview and in RTL layout.
- [ ] The audit promise (who, language, status, first-attempt, timestamps) is visible.

### Cross-cutting

- [ ] 320px worker viewport: no horizontal scroll, targets ≥48px, options ≥56px.
- [ ] 1024px supervisor viewport: usable with sidebar; no clipped tables.
- [ ] Keyboard only: every interactive element reachable with a visible focus ring.
- [ ] Arabic worker UI: layout mirrors, numbers and the link isolate, progress stays LTR.
- [ ] No console errors on any route.
- [ ] Preview mode never writes worker identity or language.

---

## 8. Known limits (and why they exist)

| Limit | Consequence | Phase 4 owner |
|---|---|---|
| Audio is a 4× timer, no sound | Reviewers judge layout and states, not voice quality | Real TTS + audio element with signed URLs |
| Board is seeded; worker actions don't write back | The loop is demonstrated in two windows, not across them | Delivery state machine + polling (15s) |
| Composer targets Tower B only | Keeps the demo focused; other crews visibly disabled | Real audience selection |
| Preview edits don't truly regenerate or block Share | The language-scoped notice is shown; nothing is re-synthesized | Enforce Processing → ready before Share, per S-13 |
| CSV export is client-side from seeded rows | Columns are real and Excel-safe, but there is no server query, pagination, or tenant scoping | Server export with cursor streaming and the same BOM contract |
| QR is decorative | No camera path in v0.1 | Deferred; not a v0.1 requirement |
| HI/UR/ML/BN copy is a working draft | Native review still required before pilot | Content review, not code |
| Identity is localStorage only | Refreshing in a new tab loses the worker | Server-issued delivery token |
| Supervisor UI is EN/AR only | Matches the pilot's operator reality | Add languages only on demand |
| No error/retry states for network failures | Offline banner is the only network state shown | Full offline queue and retry |

None of these limits block design sign-off. Each is either out of v0.1 scope or deliberately faked to keep the prototype dependency-free.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Blank page | Opened via a path that blocks classic scripts, or a JS error | Open the console; use `node serve.mjs`; confirm all files are siblings |
| Arabic looks like disconnected letters | A font/CSS override is missing | Confirm `tokens.css` loads and `dir="rtl"` is set on the worker app |
| Fonts look like Times/fallback | Google Fonts blocked or offline | Expected; system fallbacks are intentional |
| Returning card won't disappear | Stored identity persists | Prototype panel → Reset, or `localStorage.clear()` |
| Board doesn't reflect a worker action | By design — seeded snapshot | Use the board's own resolve/reminder actions to demo state changes |
| Share drawer link 404s | Server root is wrong | Run from `design/prototype`, not the repo root |
| Sheet appears offset in a screenshot tool | CSS animation paused in a hidden tab | Bring the tab to the foreground; layout is correct |
| Language won't change | Preview mode is on | Preview intentionally disables persistence; turn preview off |

---

## 10. Handoff to Phase 4

The prototype is the behavioral contract, not the codebase. When Phase 4 starts:

1. **Tokens first.** Port `tokens.css` into the app's global styles unchanged. Do not invent a second palette.
2. **Components before screens.** Build the 16 components in doc 01 §9 once; the screens in doc 02 are compositions of them.
3. **Keep the routes.** The worker deep-link parameters in §5.2 become the real delivery URLs (`/w/:token` plus query state for preview). The supervisor hashes become real routes.
4. **Preserve the state vocabulary.** `pending → opened → answered → completed` plus help flags, and "Understood = first-attempt correct + Done." Do not rename statuses in the UI.
5. **Port the RTL rules, not the CSS hacks.** Use logical properties; do not duplicate every stylesheet for Arabic.
6. **Replace fakes one at a time.** Audio, AI generation, board polling, CSV export, and identity are the five seams. Each has a defined contract in docs 05–06.
7. **Re-run the review scripts in §7 against the real build.** They are the design acceptance tests; doc 07 holds the full test plan.

**Phase 4 inputs from this pack:** token source, component inventory, screen specs with states and copy, responsive rules, RTL rules, accessibility requirements, and the prototype as a live reference.

---

## 11. Change log

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-13 | Initial guide: run instructions, routes, deep links, review scripts, limits, handoff |
