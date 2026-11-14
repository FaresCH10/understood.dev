# PRD — Understood v0.1 (Pilot MVP)

**Document 2 of 8** · Version 0.1.2 · Date 2026-11-12
**Owner:** Founder · **Status:** Ready to build · **Related:** [Product Brief](./01-product-brief.md)

---

## TL;DR

Understood v0.1 lets one supervisor send one voice, text, or photo instruction to a multilingual crew — and see exactly who understood it. No worker app. No worker login. No WhatsApp API. Six languages. One link per instruction. The pilot exists to prove three things: supervisors use it weekly, workers respond, and someone pays for it.

**The promise the build must keep:**

> A first-time supervisor goes from empty account to a shared instruction in **9 minutes**. A worker opens a link in a WhatsApp group and hears their instruction in their own language in **10 seconds**, finishing the whole flow in under **90 seconds** — on a low-end phone, with no install.

---

## 1. Goals and non-goals

### v0.1 goals (ranked)

| ID | Goal | How we know |
|---|---|---|
| G1 | A first-time supervisor can create a crew, import workers, record a voice note, and share links without training | Activation: first instruction shared on day 1 |
| G2 | A worker with WhatsApp and a low-end Android phone understands the instruction in their language and confirms it | Response rate ≥70%, flow ≤90 seconds |
| G3 | The supervisor can answer "who did not understand?" at a glance and export an audit-ready record | Board + CSV used weekly |
| G4 | The AI pipeline is invisible: reliable, retried, previewable, and cheap to run | Pipeline success ≥98%, cost <$0.05/instruction |

### Non-goals (v0.1)

No worker accounts or logins · No WhatsApp Business API · No native apps · No SMS/OTP · No automated billing · No analytics dashboards beyond the live board · No video · No kiosk mode · No PDF audit pack · No translation glossary · No scheduled sends · No spoken answers (tap only) · No multi-supervisor seats.

**The deciding rule during the pilot:** if a request doesn't serve G1–G4, it goes to the v0.2 backlog — no matter who asks, including paying customers.

---

## 2. Success metrics (pilot)

**North star — Understood Rate:** percentage of targeted workers who answered the comprehension question correctly on the first attempt **and** pressed Done, within 24 hours of sharing.

| Metric | Formula | Pilot target |
|---|---|---|
| Response rate | opened ÷ targeted (24h) | ≥70% |
| Understood rate | first-attempt-correct + completed ÷ targeted (24h) | ≥60% |
| Help rate | help requests ÷ targeted | 5–15% (0 is a bad sign) |
| Activation | first instruction shared within 24h of signup | ≥80% of orgs |
| Supervisor habit | instructions sent per supervisor per week by week 3 | ≥3 |
| Pilot gate → paid | a design partner converts and keeps ≥70% response for 4 consecutive weeks | 1 partner |

Instrumentation in §12.

---

## 3. Roles and tenancy

| Role | Exists in v0.1? | Access |
|---|---|---|
| Owner (supervisor) | Yes — only human login | Email magic link, full access, one org per account |
| Worker | No account, ever | Identity = a name on a crew roster; access = an instruction link. No password, no signup, no app |
| Supervisor seats | v0.2 | Owner invites colleagues |

**Tenancy:** every record belongs to an Organization. Tenant isolation is enforced server-side on every query. A cross-tenant data leak is the only severity-1 bug class in v0.1.

**Trust rule:** the pilot customer's roster is the customer's data. We store the minimum: name, language, optional phone (display-only in v0.1, never messaged), and delivery/response records.

---

## 4. Product principles

These survive every future trade-off debate.

- **P1 — One link, zero install.** Anything requiring a worker to install, register, or remember a password is out.
- **P2 — Speak, don't type.** The composer's default action is the microphone, because that's how supervisors already brief crews.
- **P3 — Proof over receipts.** A read receipt proves nothing. We track comprehension: answered correctly, then confirmed done.
- **P4 — Preview before share.** Nothing reaches workers until the supervisor has seen the text and heard the audio in every language.
- **P5 — Never strand a worker.** Audio fails → show text. Translation fails → retry. Worker is lost → "I need help" reaches a human.
- **P6 — The board is the product.** The supervisor's daily loop is share → watch → chase → export. Everything else supports it.
- **P7 — Boring beats clever in workers' hands.** One action per screen, big targets, native script, audio first.

---

## 5. Object model (product language)

```
Organization ──< Crew ──< Worker
      │
      └──< Instruction ──< Variant (per language: text + audio + question)
                     │
                     └──< Delivery (per Worker: status, answer, help)
```

| Term | Definition |
|---|---|
| Instruction | One message a supervisor sends: text, voice (transcribed), or photo + text |
| Variant | The language-specific version: translated text, generated audio, comprehension question — generated once, shared by every worker of that language |
| Delivery | The per-worker record for one instruction: status, first-attempt correctness, help flags, timestamps |
| Understood | Derived state: first attempt correct + Done pressed |
| Crew link | One share link per instruction + audience. The supervisor pastes it into the WhatsApp group once |

**Decision D1 — one crew link, not per-worker links.** Forty personal links cannot be pasted into a WhatsApp group. Workers identify themselves from a list (mitigations in WORK-2). Personal links arrive in v0.2 as an *additional* path, never a replacement.

---

## 6. Core journeys

### J1 — Wednesday, 06:40, Al Quoz yard (the story we're building for)

A cleaning company supervisor finishes the morning briefing. Instead of repeating it three times in Urdu, Hindi, and broken Arabic, he taps record, speaks for 40 seconds, picks "Tower B — morning crew," and reviews four language versions — Arabic, Hindi, Urdu, Malayalam — in about a minute. He copies one link, pastes it into the WhatsApp group he already uses, and drives to the next site. By 07:10 his board shows 18 of 24 workers understood it, 3 haven't opened it, 2 pressed "I need help," and one got the fall-protection question wrong twice. He calls those three and resolves the flags before the shift's first inspection.

### J2 — Worker, happy path (≤90 seconds)

1. Opens the WhatsApp message: "Your supervisor sent you an instruction — افتح الرابط" (in the group's main languages).
2. The page loads fast and shows the company name and instruction title, with a language-neutral layout.
3. Selects his name from a short list (first name + last initial, searchable if the crew is large). His device remembers him next time: "Continue as Ramesh · मलयालम".
4. Sees the instruction in his language — text plus one big play button. Audio starts.
5. Answers the one comprehension question: three full-width options, one tap.
6. Correct → green confirmation, audio stays replayable, primary button becomes **Done / تم**.
7. Taps Done. Status flips on the supervisor's board within 15 seconds.

### J3 — Worker, lost path

Wrong answer → the correct option is highlighted, audio replays, one more attempt is offered. Still wrong → the page says, plainly: "Your supervisor will be notified." Behind that, the delivery is flagged **Needs help** with the reason preselected ("I don't understand"). Alternatively, at any point, the worker taps **I need help** and picks: Don't understand / Missing tools or materials / Safety concern / Other. The supervisor gets a batched email within 10 minutes and a pinned item on the board with a one-tap "Mark resolved."

### J4 — Supervisor fixes a language

On preview, the Malayalam audio sounds wrong and the supervisor's bilingual foreman spots a mistranslated term. The supervisor edits the Malayalam text inline → TTS and the question regenerate for that language only. Other languages untouched.

### J5 — Supervisor proves it

Friday, the client's HSE auditor asks for proof of the week's briefings. Supervisor opens the instruction, exports CSV: every worker, language, delivery status, first-attempt correctness, timestamps. Arabic names intact in Excel. Done in 20 seconds.

---

## 7. Lifecycle and status model

### 7.1 Instruction lifecycle

| State | Meaning | Allowed next states |
|---|---|---|
| `draft` | Composer data saved; voice is transcribed and confirmed before Generate | `processing` (on "Generate") |
| `processing` | Pipeline running: translate → question → TTS | `ready`, `partial_failure` |
| `partial_failure` | At least one language failed after retries | `processing` (retry/edit), `ready` (accept text-only for failed languages), `draft` |
| `ready` | All variants generated; preview available | `shared`, `processing` (variant edit/regenerate) |
| `shared` | Link live; deliveries tracked | `archived` |
| `archived` | Link shows a closed screen; records frozen | — (duplicate to reuse) |

Sharing is impossible before `ready`. Preview is mandatory — no auto-share path exists in v0.1. Editing or regenerating a variant returns the instruction to `processing` and disables Share until every variant is ready again; stale audio is never shareable.

### 7.2 Delivery status (per worker)

| Status | Meaning | Set when |
|---|---|---|
| `pending` | Link not yet opened | On share |
| `opened` | Worker identified on the page | Name selected |
| `answered` | Comprehension answered (records `first_attempt_correct`) | First question submission |
| `completed` | Worker pressed Done / Got it | Explicit confirmation |

Orthogonal flags: `needs_help` + `help_reason` (Don't understand / Missing tools / Safety concern / Other), `help_resolved_at`, `audio_played_at` (first play).

Derived states shown on the board: **Understood** = first attempt correct + completed. **Chase list** = pending >2h after share, wrong first attempt, or `needs_help`.

---

## 8. Functional requirements

Priorities: **MUST** = pilot-blocking. **SHOULD** = ship within v0.1 if the pilot clock allows.

### A. Accounts and onboarding

| ID | Pri | Requirement |
|---|---|---|
| AUTH-1 | MUST | Email magic-link sign-in. One field. Link single-use, 15-minute expiry, then a 30-day session. No passwords anywhere in the product |
| AUTH-2 | MUST | First sign-in creates an Organization (editable name) and lands on a 4-step setup checklist: create crew → add workers → record first instruction → share |
| AUTH-3 | MUST | Supervisor UI fully localized in English and Arabic with true RTL mirroring; language toggle persists per user |
| AUTH-4 | SHOULD | UI language auto-suggests Arabic for `ar` browser locale |
| AUTH-5 | MUST | Friendly failures: reused/expired link pages explain what to do; no dead ends |

### B. Crews and workers

| ID | Pri | Requirement |
|---|---|---|
| CREW-1 | MUST | Create, rename, archive crews. A worker belongs to exactly one crew in v0.1 |
| CREW-2 | MUST | Add worker: name (required), language (required, 6 languages with native-script labels), phone (optional, display-only) |
| CREW-3 | MUST | CSV import: downloadable template, in-app preview of every row's validation, duplicate detection (normalized name + crew), commit-all-or-nothing |
| CREW-4 | MUST | Worker language is editable anytime. **Snapshot rule:** each delivery locks the language used at share time. Language changes affect future instructions only, never audit history |
| CREW-5 | MUST | Org guardrail: 1,000 workers max in v0.1, with a respectful upgrade message |
| CREW-6 | SHOULD | Bulk language edit for multiple selected workers |
| CREW-7 | MUST | Archive keeps history; archived workers disappear from new audiences |

**Acceptance (CREW-3):** importing a 150-row Arabic/Hindi/Urdu CSV with three invalid language values shows exactly those three rows as errors, commits nothing, and lets the supervisor fix and re-upload.

### C. Composer

| ID | Pri | Requirement |
|---|---|---|
| COMP-1 | MUST | Instruction fields: optional title; body = text (≤2,000 chars) OR voice note (≤3:00) OR photo (≤1 image) + caption text (required); explicit source language (auto-suggested from transcription, supervisor confirms); audience = one crew or a multi-selected subset of its workers |
| COMP-2 | MUST | In-browser voice recording: start/stop, re-record, playback before generating. No upload required (upload is a v0.2 input path) |
| COMP-3 | MUST | Photo: client-side compression to ≤1,600px long edge, jpg/png/webp, ≤8MB pre-compression. Caption text is required (COMP-1) — the photo is a visual aid, never the sole content. Explicit non-goal: no OCR in v0.1 |
| COMP-4 | MUST | The composer shows the exact set of languages to be generated, derived from the audience's worker languages, with native-script chips (العربية · English · हिन्दी · اردو · മലയാളം · বাংলা). No exclusions — every worker gets their language or we don't ship |
| COMP-5 | MUST | Autosave drafts; duplicate any past instruction as a starting point |
| COMP-6 | MUST | Instruction type toggle: **Task** (Done) vs **Info** (Got it). Changes worker-facing completion copy only |
| COMP-7 | MUST | Send now only. Scheduling is explicitly a v0.2 feature |

### D. AI pipeline

| ID | Pri | Requirement |
|---|---|---|
| PIPE-1 | MUST | Voice → transcript (Azure STT primary, Whisper/Groq fallback). Detect language, present for confirmation |
| PIPE-2 | MUST | Translate to every target language. Prompt constraints: preserve numbers, units, names, site names, acronyms; short sentences; low temperature; structured JSON output |
| PIPE-3 | MUST | Generate one comprehension question per language with exactly 3 options, 1 correct, strictly answerable from the instruction text. No trick questions, no negation puzzles. Supervisor can edit question and options at preview |
| PIPE-4 | MUST | TTS per language with locale-appropriate neural voice. Audio cached by (text + voice + speed) and reused across duplicated instructions and all workers of that language within the org |
| PIPE-5 | MUST | Live per-stage progress UI. Idempotent jobs, 3 retries with backoff, per-language failure isolation. Never lose a supervisor's recording |
| PIPE-6 | MUST | Preview: original transcript/text side-by-side with each language variant (native script), inline audio player, question; actions: edit translation text (regenerates that language's TTS + question), regenerate a language, remove nothing |
| PIPE-7 | MUST | If a language fails after retries, supervisor can share with text-only for that language after acknowledging a warning naming the affected workers |
| PIPE-8 | MUST | Log chars/seconds/cost per stage per instruction (internal only in v0.1) |
| PIPE-9 | SHOULD | Cross-org audio cache for generic phrases — explicitly deferred; org-scoped cache only in v0.1 |

**Acceptance (PIPE-2):** a 30-second voice note, 4 languages, reaches preview in ≤45 seconds and costs <$0.05 at current API rates.

### E. Preview and share

| ID | Pri | Requirement |
|---|---|---|
| SHARE-1 | MUST | One crew link per instruction + audience. 128-bit token. Revocable: "Regenerate link" kills the old one instantly (old link shows a closed screen) |
| SHARE-2 | MUST | Share screen: copy-link button, prefilled WhatsApp message (supervisor picks EN/AR; template includes instruction title + link), QR code, and "See what workers see" |
| SHARE-3 | MUST | Worker-facing pages are `noindex` and show only: org name, instruction content, worker's language UI. No other org content, no roster beyond the audience, no navigation to the supervisor app |
| SHARE-4 | MUST | Archived instruction links show a polite closed screen with org name; data remains exportable |
| SHARE-5 | SHOULD | QR code printable as a one-page PDF for site tablets |

### F. Worker experience (the heart of the product)

| ID | Pri | Requirement |
|---|---|---|
| WORK-1 | MUST | Name picker: shows audience workers as first name + last initial; when two names would render identically, **only the colliding workers** show their full last name, then a numeric suffix if still identical (Ramesh K. → Ramesh Kumar → Ramesh Kumar 2). Never a phone number. Search appears above 20 workers; "My name isn't here" → "Ask your supervisor" screen (never a dead end). Device remembers worker + language (localStorage) and offers "Continue as {name} · {language}" plus "Not you?" |
| WORK-2 | MUST | Privacy mitigation: no full surnames on worker-facing screens (the collision fallback in WORK-1 is the only exception), no phone numbers, no crew list beyond the audience |
| WORK-3 | MUST | Instruction view: native-script text, one prominent play/pause control (tap to play — never rely on autoplay), photo if provided. Tap targets ≥48px, body text ≥16px, high contrast |
| WORK-4 | MUST | Question flow: 3 full-width options; instant feedback; wrong → correct option highlighted + audio replay + retry once; first-attempt correctness recorded. After an answer, primary button = Done / Got it |
| WORK-5 | MUST | **I need help** always reachable after the name step: reason sheet (4 reasons) → "Your supervisor has been notified" + status flag. No free-text required in v0.1 |
| WORK-6 | MUST | Language switch: available on the name step and in the page menu **before completion**; updates the worker's profile after an explicit confirmation ("Change my language to മലയാളം?"). An opened/answered delivery switches its own variant (audited); after completion the profile changes for future instructions while the completed delivery keeps its snapshot |
| WORK-7 | MUST | Idempotency: reopening the link shows prior state (answered/completed), preserves first timestamps, never double-counts |
| WORK-8 | SHOULD | PWA: installable, page shell cached; audio cached after first play via Cache API so a second open works on weak connectivity. **Committed for v0.1** (doc 06 E6.8) — poor connectivity is the pilot's core constraint |
| WORK-9 | SHOULD | Offline submit: answers held and retried when connectivity returns, with a visible "will send when connected" state. **Stretch** (doc 06 E10.2): ships only if the schedule holds |
| WORK-10 | MUST | Global footer disclaimer on every worker page: "This instruction supports — and does not replace — your company's training and safety procedures." EN + the six languages |
| WORK-11 | MUST | Supports Chrome Android ≥100 and Safari iOS ≥15 at 320px width |

**Acceptance (J2 GWT):** Given a shared instruction with a 30-second audio and 4 languages; when a worker on 3G opens the link and selects their name; then audio is playable within 4 seconds, the question renders in their language, and a correct answer + Done appears on the board within 15 seconds.

### G. Live board

| ID | Pri | Requirement |
|---|---|---|
| BOARD-1 | MUST | Home: recent instructions with a summary per instruction (targeted, opened, understood %, help flags) and one clear "New instruction" action |
| BOARD-2 | MUST | Detail: per-worker rows with status, first-attempt correct/incorrect, help badge, timestamps. Filters: all / not opened / wrong / needs help |
| BOARD-3 | MUST | Pinned exception section: **Needs help** first, then not-opened >2h, then wrong-first-attempt. "Mark resolved" per help flag, with resolver + timestamp |
| BOARD-4 | MUST | Actions: copy link, copy reminder message (EN/AR template), worker preview, regenerate link, archive, export CSV |
| BOARD-5 | MUST | Freshness: polling every 15s; no websockets in v0.1 (decision D4). Status conveyed by icon + label, never color alone |
| BOARD-6 | MUST | "Understood %" defined in a tooltip — the metric is our brand, teach it |

### H. Notifications

| ID | Pri | Requirement |
|---|---|---|
| NOTIF-1 | MUST | Email to owner on help requests: worker, reason, instruction, link. Batched ≤1 per 10 minutes, never lost |
| NOTIF-2 | SHOULD | Weekly summary: instructions sent, response rate, understood rate, top misunderstanding by language |
| NOTIF-3 | MUST | Transactional email only (magic links, help alerts, weekly digest). No marketing email to pilot customers in v0.1 |

### I. Audit export

| ID | Pri | Requirement |
|---|---|---|
| AUDIT-1 | MUST | CSV per instruction and org-wide date range. Columns: instruction ID, title, type, source language, sent date, crew, worker name, language, status, first-attempt correct, opened/answered/completed timestamps, help reason + resolution |
| AUDIT-2 | MUST | Excel-safe for Arabic: UTF-8 with BOM, ISO-8601 UTC timestamps + a display-timezone column (org timezone) |
| AUDIT-3 | MUST | Export reflects the delivery snapshot (language at share time), never the live worker profile |
| AUDIT-4 | SHOULD | Org-wide "all deliveries" export with one row per worker per instruction |

### J. Settings, data, support

| ID | Pri | Requirement |
|---|---|---|
| SET-1 | MUST | Org profile: name, timezone, language. Logo deferred |
| SET-2 | MUST | Data controls: export all data (CSV), delete org (typed confirmation + email confirmation; hard delete within 7 days) |
| SET-3 | MUST | AI usage meter: minutes/chars used this month, soft warning at 150 TTS minutes (fair-use guardrail, not a paywall) |
| SET-4 | MUST | Support: WhatsApp deep link + mailto in the header. A pilot customer's "contact us" is a button, not a treasure hunt |
| SET-5 | MUST | Legal placeholders: Terms, Privacy. No compliance claims in UI copy |

### K. Activation aids

| ID | Pri | Requirement |
|---|---|---|
| ACT-1 | SHOULD | "Try with a demo crew": 3 sample workers (Hindi, Arabic, Malayalam), one sample instruction, so the full loop — including the worker page — can be experienced in 60 seconds during sales demos |
| ACT-2 | SHOULD | Setup checklist persists progress and shows the 9-minute promise |

---

## 9. Edge cases and failure modes

| Case | Behavior |
|---|---|
| Worker opens an archived instruction | Closed screen with org name; no data entry possible |
| Worker opens before share (preview link) | Preview mode — visibly watermarked "Preview"; nothing recorded |
| Duplicate worker names in a crew | Picker applies the collision rule: first name + last initial; only colliding workers show the full last name, then a numeric suffix. Import warns on duplicates; never blocks |
| Worker picks the wrong name | "Not you?" returns to the picker without erasing audit timestamps: the wrongly opened delivery stays `opened` with no answer, and the correct worker uses their own delivery |
| Non-roster person opens the link | "My name isn't here" screen; no enrollment, no data capture |
| Worker archived after generate, before share | Dropped from the delivery set; share shows the count and never creates a delivery for an archived worker |
| Supervisor records in a noisy yard | Transcript shown for confirmation; re-record is one tap; alert if transcript is empty after 2 attempts |
| Translation returns the source unchanged | Flagged in preview as "possibly untranslated"; does not block, but warns |
| TTS voice unavailable for a language | Retry → text-only variant with warning naming affected workers (PIPE-7) |
| Worker on 2G / audio stalls | Text is always visible; play control shows buffering; audio cached after first successful play (WORK-8) |
| Autoplay blocked | Never relies on autoplay; first tap starts audio (WORK-3) |
| Answer submitted twice (two tabs/devices) | First attempt and first completion timestamps win; no duplicates |
| Worker language changed mid-instruction | Before completion: the delivery switches to the chosen language variant, audited in `languageChangeHistory`. After completion: the worker profile updates for future instructions; the delivery snapshot is immutable (CREW-4) |
| CSV with Arabic names, BOM, mixed encodings | Import tolerant with clear per-row errors (CREW-3); exports always BOM (AUDIT-2) |
| Daylight/clock rules for "24h" metrics | Store UTC; display and compute metrics in org timezone |
| Photo fails upload | Instruction can proceed without photo, warning shown at preview |
| Token guessed or sprayed | 128-bit tokens, rate limiting on worker endpoints, no enumeration surfaces |

---

## 10. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance (worker) | First paint <2s on emulated 3G (page shell cached); audio playable <4s; worker flow ≤90s median |
| Performance (supervisor) | Pipeline preview ≤45s for 30s audio × 4 languages; board load <2s |
| Reliability | Pipeline success ≥98% with retries; delivery data loss = zero tolerance; nightly backups with restore drills (RPO ≤24h) |
| Availability | Best-effort during pilot (free/entry tiers acceptable); cold starts eliminated before the first paid pilot week |
| Security | TLS everywhere; tokens high-entropy and revocable; signed/validated audio access; tenant isolation server-side; rate limiting; no worker passwords stored (there are none) |
| Privacy | Minimum required data; no analytics PII; data export and delete flows (SET-2); retention: org data kept until deletion during pilot, documented in Privacy |
| Accessibility | Worker UI aims at WCAG 2.1 AA: contrast, ≥48px targets, labels for icons, no color-only states |
| i18n / RTL | Supervisor UI EN/AR with full RTL mirroring; worker UI in 6 languages; native script everywhere; missing-key lint in CI |
| Localization style | Short sentences (≤12 words), warm and direct, no idioms, gender-neutral constructions where the language forces gender; worker strings need native review before pilot |
| Cost guardrails | Target <$0.05/instruction at 4 languages; audio cache mandatory; usage meter (SET-3) |
| Browser support | Chrome Android ≥100; Safari iOS ≥15; Chrome/Edge/Firefox desktop for supervisors |

---

## 11. Analytics and instrumentation

Events (pseudonymous IDs only; no worker PII; PostHog free tier is sufficient):

| Event | Key properties |
|---|---|
| `org_created` | locale |
| `crew_created` | worker_count |
| `workers_imported` | rows, errors, method (manual/csv) |
| `instruction_created` | type (voice/text/photo), instruction_type (task/info), audience_size, languages[] |
| `pipeline_completed` | duration_s, languages[], cost_estimate, failures[] |
| `instruction_shared` | channels (copy/QR), minutes_since_signup |
| `worker_opened` | language, device_class, seconds_since_share |
| `worker_audio_played` | language, seconds_into_page |
| `worker_answered` | correct_first_attempt, language |
| `worker_completed` | seconds_since_open, language |
| `help_requested` | reason, language |
| `help_resolved` | minutes_to_resolve |
| `reminder_copied` | worker_count_targeted |
| `audit_exported` | scope (instruction/org) |
| `weekly_digest_sent` | — |

Metric definitions live in §2 and must be computed in one place (org timezone-aware).

---

## 12. Content and localization requirements

- **Supervisor UI:** complete EN + AR; RTL mirroring includes layout, icons with direction, charts, and the composer. Arabic copy written, not machine-translated.
- **Worker UI:** six languages minimum: العربية (Gulf), English, हिन्दी, اردو, മലയാളം, বাংলা. Native script labels in pickers — never transliterations, never flags.
- **The gendering problem is real:** "Done / I understood" is gendered in Hindi, Urdu, Bengali, and others. Use neutral constructions where possible; where unavoidable, test wording with native speakers during the pilot (open question Q3). Do not ship machine-translated button copy.
- **Digits and units:** keep Western digits for quantities and time in v0.1 (worker feedback will decide); preserve units exactly; dates localized to org timezone.
- **Voice and tone:** instructions are short and imperative; the comprehension question asks about the *action*, not trivia ("What must you do before entering the shaft?" not "How many meters…").
- **Sample strings:** Listen = استمع · Done = تم · I need help = أحتاج إلى مساعدة · Select your name = اختر اسمك. All worker strings require native review before the pilot opens.

---

## 13. Rollout plan

| Phase | Content | Exit criteria |
|---|---|---|
| v0.1 build (≈6 weeks at ~36 focused hours/week) | Everything marked MUST | Internal demo of J1–J5 on real phones |
| Hardening (2 weeks) | Bugs, performance, AR copy review, worker copy native review | 10 simulated workers complete the flow unaided |
| Pilot (6–8 weeks, 1 design partner) | Real crew, real instructions, weekly founder review | Pilot gate in §2 met |
| v0.1.1 | Weekly digest, demo crew, QR PDF, fixes from the field | — |
| v0.2 backlog | WhatsApp Cloud API delivery + receipts · personal worker links/inbox + web push · Tamil, Tagalog, Nepali · translation glossary per org · PDF audit pack · automated billing (merchant of record) · multi-supervisor seats · scheduled sends · voice answers with STT grading · kiosk QR for shared tablets | — |

**Definition of done (every requirement):** demoable in staging · acceptance criteria pass · Arabic UI complete · analytics event fires · error and empty states exist · tested at 320px on a real low-end Android · copy reviewed (native speaker for worker strings).

---

## 14. Decisions log

| # | Decision | Why |
|---|---|---|
| D1 | One crew link + name picker, not per-worker links | WhatsApp groups are the distribution channel; 40 links are unusable. Privacy mitigated by first-name display and audience scoping |
| D2 | Preview is mandatory before share | The trust problem is translation of safety-relevant content; no auto-send |
| D3 | Language snapshot per delivery | Audit integrity: history must not change when rosters do |
| D4 | Polling every 15s, no websockets | Zero-cost, simple, good enough for supervisor pacing |
| D5 | Single owner login in v0.1 | One-site pilot = one supervisor; seats are v0.2 |
| D6 | All audience languages generated, no exclusions | A worker without their language is a stranded worker (P5) |
| D7 | Task vs Info types only; no "Safety" type | Avoid implying certified safety training; disclaimer covers positioning |
| D8 | Understood = first attempt correct + Done within 24h | A single, teachable, audit-relevant definition — the brand metric |
| D9 | Org-scoped audio cache only | Cross-org caching of customer content has unclear privacy posture; revisit in v0.2 |
| D10 | Text-only fallback for failed TTS languages | Never block delivery; warn, name affected workers, keep going |

---

## 15. Open questions

| # | Question | Resolve by |
|---|---|---|
| Q1 | Will supervisors accept the name-picking model, or does it feel unserious? | Concierge MVP with 1 crew; observe first 3 shares |
| Q2 | Which Arabic TTS locale/dialect (ar-AE vs MSA) sounds natural for FM crews? | 5-worker listening test during hardening |
| Q3 | Neutral "Done" wording per language — which variant survives native review? | Native review before pilot |
| Q4 | Is 2 hours the right "not opened" chase threshold? | Pilot week 1 data |
| Q5 | Do Info instructions need Done, or is answer-correct enough? | Pilot supervisor feedback |
| Q6 | What soft cap (TTS minutes) keeps the $0/$40 budget honest per org? | Usage data after first 2 pilot weeks |

---

## 16. Appendix

**CSV import template:** `name, language, phone, crew` — language accepts one of `ar, en, hi, ur, ml, bn` or a friendly label ("Malayalam"). Phone optional; never messaged in v0.1.

**Prefilled WhatsApp share message (EN):**
> Morning crew — today's instruction: {title}. Please listen in your language and confirm when done: {link}

**Prefilled WhatsApp share message (AR):**
> فريق الصباح — تعليمات اليوم: {title}. يرجى الاستماع بلغتك والتأكيد عند الانتهاء: {link}

**Sample comprehension question (EN / AR):**
> Before entering the shaft, what must you do?
> أ) Wear the safety harness · ب) Call the client · ج) Take a photo

**Worker status quick reference:** pending → opened → answered → completed, plus flags `needs_help` and `first_attempt_correct`. Understood = correct-first + completed.

---

**Next documents:** 03 — User Flows & Wireframes (screens for J1–J5, RTL-first), then 05 — Database & API Specification (collections, tokens, jobs). TDD (§04 of the plan) follows the wireframes so architecture matches the actual screens.
