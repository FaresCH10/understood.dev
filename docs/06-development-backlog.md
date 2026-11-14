# 06 — Development Backlog

**Document 6 of 8** · Version 0.1.1 · Date 2026-11-12
**Owner:** Founder · **Status:** Execution plan · **Related:** [PRD](./02-prd.md) · [Wireframes](./03-user-flows-wireframes.md) · [TDD](./04-tdd.md) · [Database & API](./05-database-api-spec.md)

> **TL;DR** — 10 committed epics, 57 stories, 204 focused hours + 10h buffer. Six weeks at ~36h/week; 9–10 weeks at 25h/week. Deploy on day 2, spike providers in week 1, put the worker flow on real phones in week 4, and do not onboard a paying pilot until the week 6 gate is green. Eleven build decisions (C1–C11) resolved contradictions found while sequencing the work; they were folded back into docs 02–05 on 2026-11-12 (02 → 0.1.2, 03 → 0.1.1, 04 → 0.1.1, 05 → 0.1.2). §12 records them.

---

## 1. How to use this backlog

- Build **one epic at a time, one story at a time**. Do not start a story until its `depends` line is satisfied.
- Every story is demoable on staging and has testable acceptance criteria. If it cannot be demoed, it is a task, not a story.
- Statuses: `todo` → `doing` → `done`; `cut` is a valid, explicit state. Nothing silently disappears.
- Priorities: **P0** = pilot-blocking or on the critical path; **P1** = committed SHOULD; **P2** = stretch only after the pilot gate is green.
- Estimates are **focused hours**, not calendar time. They include implementation, tests, and the story's Arabic/worker strings. They assume AI pair-programming; add 20% if a provider or browser fights you.
- Every Friday: deploy, record a 3-minute demo, update statuses, and write down what slipped. A week without a deployed demo is a red flag, not a schedule detail.
- The backlog is ordered by **risk**, not by screen order: external providers first, the worker loop early, exports late.

**Definition of Ready (per story)**
- [ ] Acceptance criteria are testable and reference a PRD ID, a screen, or an endpoint.
- [ ] The API/schema shape is known (docs 05) or the story explicitly includes designing it.
- [ ] No unresolved dependency on an unbuilt story.
- [ ] Error, empty, and loading states are named.

**Definition of Done (global)** — see §9. A story is not done because the happy path works.

---

## 2. Capacity reality check

The TDD originally said “≈6 weeks part-time.” The consistency pass makes the assumption explicit: this plan assumes **~36 focused hours per week** — a full-time founder with AI assistance, not nights and weekends.

| Available time | Calendar reality | What changes |
|---|---|---|
| **35–40h/week** (full-time) | 6-week build + 1–2 weeks hardening | This plan as written |
| **25h/week** (serious part-time) | 9–10 weeks | Same order; one epic per ~1.5 weeks; stretch cut |
| **15h/week** (evenings) | 14–16 weeks | Cut photo, PWA cache, and every SHOULD; core loop only |

**Planning numbers**

| Bucket | Hours |
|---|---:|
| Committed stories (E0–E9) | 204 |
| Contingency (~5%) | 10 |
| **Total** | **214** |
| Stretch (E10, only if ahead) | 13 |

If your real capacity is 25h/week, do not compress the plan — move the pilot date. A missed pilot promise costs more than a later one.

**External tasks that start on day 1, not week 6**
- Owned domain purchase + DNS (the only honest $0-breaker, ~$10–12/year).
- Resend domain verification (SPF/DKIM/DMARC).
- Azure Speech + Groq keys and a small live-call spike.
- Oracle Always Free ARM instance in the closest region; decide DuckDNS vs owned domain.

---

## 3. Scope contract

### 3.1 Committed

- Every **MUST** requirement in [PRD §8](./02-prd.md).
- **WORK-8** (PWA shell + audio cache) — committed P1 because poor connectivity is the worker reality.
- **AUDIT-4** (org-wide export) — covered inside the SET-2 “export all” flow.
- The 12 v0.2 seams in [TDD §16](./04-tdd.md), verified but not exposed.

### 3.2 Stretch (E10, only after the pilot gate)

**ACT-1** demo crew · **WORK-9** offline answer outbox · **SHARE-5** printable QR PDF · **NOTIF-2** weekly digest · **CREW-6** bulk language edit.

### 3.3 Explicitly out

WhatsApp Business API · personal worker links/inbox/push · billing and plans · analytics dashboards beyond the board · kiosk mode · scheduled/recurring sends · PDF compliance pack · team seats/permissions · translation glossary · video · spoken answers · OCR · SMS/OTP · native apps · cross-org audio cache (**PIPE-9**).

If a request is not in §3.1, it goes to the v0.2 backlog in [03b](./03b-v0.2-surfaces.md), no matter who asks.

### 3.4 Cut ladder (if the clock slips)

Cut in this order, and write the decision down:

1. Weekly digest (never started).
2. Demo crew.
3. Printable QR PDF (keep the on-screen QR).
4. Bulk language edit.
5. Offline answer outbox.
6. PWA audio cache (worker remains a normal web page).
7. Photo input — **requires an explicit scope decision**; voice + text still cover the core loop.

**Never cut:** magic-link auth, crew/worker core, voice/text composer, pipeline, preview gate, share tokens, worker question/Done/help, board, CSV export, tenant isolation, idempotency, rate limits, Arabic supervisor UI, worker-language copy review.

---

## 4. Build strategy

### 4.1 The shape of the six weeks

```
Day 2   deploy the walking skeleton (HTTPS, /healthz, one static route)
Week 1  identity + roster        → "I can sign in and create a crew"
Week 2  content in               → "I can import a crew and record an instruction"
Week 3  languages out            → "4 languages reach preview in ≤45s"
Week 4  the loop                 → "a worker on a real phone understands and confirms"
Week 5  proof + polish           → "the supervisor can chase and export"
Week 6  trust + pilot gate       → "security, backup restore, dry run, go/no-go"
```

### 4.2 Principles

- **Deploy day 2, then continuously.** The TDD originally put production deploy in week 6; that would have been too late to discover TLS, DNS, Oracle capacity, or email deliverability. The walking skeleton is E0.3, and the TDD now matches this schedule.
- **Vertical slices.** Every week ends with a demo that crosses UI → API → DB → provider. No week is spent “finishing the backend.”
- **Risk-first.** Provider spikes happen before the pipeline is written. The worker flow is tested on real phones as soon as it exists, not in week 6.
- **One real phone per week from week 4.** Emulators lie about audio, tap targets, and 3G.
- **Trunk-based, small commits.** `main` is always deployable; unfinished work sits behind a flag, not on a branch.
- **No polish before the loop.** Visual polish, animations, and empty-state illustration wait until the worker loop is proven.
- **The pilot gate is binary.** A green demo is not a green pilot. §14 is the release contract.

### 4.3 Weekly cadence

| Day | Focus |
|---|---|
| Monday | Pick 3–5 stories; confirm dependencies; write the demo script |
| Tue–Thu | Build, test, deploy to staging daily; 30-minute bug triage at end of day |
| Friday | Deploy to production, record the demo, update the backlog, note slippage |
| Sunday | 30-minute review of pilot metrics/emails; no coding |

---

## 5. Epic map

| Epic | Outcome | Stories | Hours | Week |
|---|---|---|---:|---:|
| **E0** Foundation & delivery | Repo, CI, local stack, deployed skeleton, provider spikes | 5 | 17 | 1 |
| **E1** Identity, org, shell | Magic-link sign-in, org, bilingual RTL shell, checklist | 4 | 14 | 1 |
| **E2** Crews, workers, import | Roster CRUD, CSV import, limits, display names | 4 | 16 | 1–3 |
| **E3** Composer & media | Text, voice recording, transcript, photo, audience | 5 | 19 | 2 |
| **E4** AI pipeline | Providers, queue, translate, question, TTS, ledger, failure UX | 6 | 26 | 2–3 |
| **E5** Preview, share, tokens | Trust screen, edits, share link, deliveries, QR, preview mode | 5 | 17 | 3–4 |
| **E6** Worker PWA | Picker, instruction, question, Done, help, language, edge pages | 9 | 30 | 4 |
| **E7** Board & notifications | Home, board, exceptions, actions, help email batching | 5 | 20 | 5 |
| **E8** Exports, settings, data | CSV engine, exports, settings, usage, delete org | 5 | 14 | 5 |
| **E9** Quality & pilot gate | Security suite, a11y, performance, e2e, ops, validation, dry run | 9 | 31 | 5–6 |
| **E10** Stretch | Demo crew, offline outbox, QR PDF, digest, bulk edit | 5 | 13 | after gate |
| **Total committed** | | **57** | **204 + 10 buffer** | **6 weeks** |

---

## 6. Week-by-week plan

| Week | Stories | Hours | Friday demo (must be real) | Exit gate |
|---|---|---:|---|---|
| **1** | E0.1–E0.5, E1.1–E1.4, E2.1 | 34 | Deployed URL; magic link; org; crew; 3 workers; CI green | Can sign in on the deployed domain and create a crew without help |
| **2** | E2.2, E2.3, E3.1–E3.5, E4.1 | 36 | 150-row CSV import; record 30s voice; transcript + detected language; photo + caption; language chips | A draft with voice/transcript and a validated audience exists; no lost recording |
| **3** | E4.2–E4.6, E5.1, E5.2, E2.5 | 32 | 30s × 4 languages reaches preview in ≤45s; play each language; edit Malayalam; retry one failure | Preview is trustworthy and editable; cost/timing recorded |
| **4** | E5.3–E5.5, E6.1–E6.9 | 37 | Share link; two real phones (AR + ML); correct, wrong, help; board updates ≤15s; preview mode | J2 and J3 complete on real phones with zero observer touches |
| **5** | E7.1–E7.5, E8.1–E8.5, E9.7 | 38 | J1 full loop; chase/resolve; Excel-safe Arabic CSV; settings/usage; 3 worker + 3 supervisor sessions | Supervisor can run share → watch → chase → export unaided |
| **6** | E9.1–E9.6, E9.8, E9.9 + buffer | 37 | Security suite green; e2e green; backup restored; pilot dry run; go/no-go | §14 pilot gate fully checked |

**Rule:** if a Friday demo fails, next week starts with the fix. Do not start the next epic on a broken previous one.

---

## 7. Critical path and parallel work

```
E0.3 deploy ─► E1.1 auth ─► E2.2 workers ─► E3.3 voice ─► E4.1 adapters
   ─► E4.2 pipeline ─► E5.3 share ─► E6.3 question ─► E7.2 board ─► E9.4 e2e
```

- Any delay on this chain delays the pilot. Protect it.
- **Off the critical path:** exports, settings, QR, demo crew, digest, bulk edit. They fill gaps while waiting for provider calls or review feedback.
- **Parallel-friendly pairs:** E8 starts once E5.3 shape exists; E9 tests grow with each epic; E6.8 PWA shell can be built while the board API is in review.
- **Do not parallelize** pipeline stages and worker UI before the share contract is stable — it creates rework.

---

## 8. Epics and stories

### E0 — Foundation & delivery (17h)

#### E0.1 · Monorepo, shared contracts, CI
`P0 · 4h · depends: — · trace: TDD §5, §11.4`

**Story.** As the founder, I want one workspace with shared types and green CI so that all three apps compile against the same contract.

**Acceptance**
- [ ] npm workspace with `apps/api`, `apps/supervisor`, `apps/worker`, `packages/shared`; TypeScript strict.
- [ ] Shared Zod schemas/types for `Language`, `InstructionType`, `DeliveryStatus`, content, API envelopes, error codes.
- [ ] `npm run dev`, `npm test`, `npm run lint`, `npm run typecheck` work from the root; CI runs lint → typecheck → unit on every PR and `main`.
- [ ] A fresh clone can be running locally in ≤15 minutes, documented in README.

**Tasks** — [infra] workspace + tsconfig base · [shared] schema package · [ci] GitHub Actions + branch protection · [docs] README.

#### E0.2 · Local stack, provider mocks, seed
`P0 · 3h · depends: E0.1 · trace: TDD §11.3`

**Story.** As the founder, I want to develop without paid provider keys so that UI work and tests are never blocked by quotas.

**Acceptance**
- [ ] `docker compose -f infra/compose.dev.yml up` starts Mongo (replica set for transactions), Redis, MinIO.
- [ ] Provider mock mode returns deterministic STT/translation/question/TTS/email fixtures; no keys required.
- [ ] `seed-demo` creates an org, 3 workers (hi/ar/ml), and one text instruction.
- [ ] Integration tests run offline against local Mongo/Redis/MinIO.

**Tasks** — [infra] compose · [api] mock adapters · [test] fixtures/helpers · [script] seed.

#### E0.3 · Walking skeleton deployed
`P0 · 5h · depends: E0.1 · trace: TDD §11.4, §18 (revised by C8)`

**Story.** As the founder, I want the app live on day 2 so that deployment, TLS, DNS, and email are proven before feature pressure.

**Acceptance**
- [ ] Push to `main` builds images, deploys to the Oracle VM, and `/healthz` returns 200.
- [ ] HTTPS via Caddy; supervisor shell at `/`; worker placeholder at `/i/:token`; same origin for `/api/*`.
- [ ] Sentry captures a test error; UptimeRobot monitors `/healthz`; rollback to the previous image is documented and tested.
- [ ] Domain/DuckDNS decision and Oracle region are recorded; `PROCESS_ROLE=both` runs API + worker in one container.

**Tasks** — [infra] Dockerfile + Caddy + prod compose · [ci] GHCR + SSH deploy · [ops] monitoring/secrets · [docs] rollback.

#### E0.4 · Runtime seams and configuration
`P0 · 2h · depends: E0.1 · trace: TDD §16`

**Story.** As the founder, I want the v0.2 seams wired now so that later features are additions, not retrofits.

**Acceptance**
- [ ] `PROCESS_ROLE=api|worker|both` starts only the intended loops; tests assert each mode.
- [ ] Feature-flag module and `requireEntitlement()` stub (always passes for `plan=pilot`).
- [ ] Timezone-aware date helpers exist and are used by every metric/date display from day one.
- [ ] Job runner accepts delayed jobs (needed later for help-email batching).

**Tasks** — [api] config schema · [api] flags/entitlements · [shared] time helpers · [test] role tests.

#### E0.5 · Provider spike, voice map, email domain
`P0 · 3h · depends: — · trace: TDD §19 T1/T2/T3/T5`

**Story.** As the founder, I want the risky external dependencies proven in week 1 so that the pipeline is not blocked in week 3.

**Acceptance**
- [ ] Six voice IDs confirmed (or a documented fallback) for ar, en, hi, ur, ml, bn; a sample MP3 per language saved.
- [ ] Groq Whisper + Llama calls succeed within free-tier limits; rate limits and model names recorded.
- [ ] DeepL coverage for all six languages checked; Azure Translator fallback decision recorded.
- [ ] Resend domain verified with SPF/DKIM/DMARC; a test magic-link email lands in Gmail and Outlook.
- [ ] Spike report in `docs/decisions/provider-spike.md`; T1/T2/T3/T5 marked resolved.

**Tasks** — [spike] scripts + calls · [ops] domain/DNS · [docs] report/voice map.

---

### E1 — Identity, org, and shell (14h)

#### E1.1 · Magic-link auth, sessions, failure pages
`P0 · 6h · depends: E0.3 · trace: AUTH-1, AUTH-5 · S-01/S-02 · POST /auth/magic-link, GET /auth/verify, POST /auth/logout, GET /me`

**Story.** As a supervisor, I want to sign in with my email and no password so that I can start in seconds.

**Acceptance**
- [ ] `POST /auth/magic-link` always returns `202 { sent: true }`; 5/h/email and 20/h/IP; no account enumeration.
- [ ] Verify is single-use, 15-minute, token hashed at rest, sets a 30-day sliding `HttpOnly Secure SameSite=Lax` session cookie; invalid → friendly S-01 error.
- [ ] Logout revokes the server-side session; `GET /me` returns user + org; expired/reused links explain what to do.
- [ ] Email is templated (Resend in prod, mock in tests); AR/EN subject and body.

**Tasks** — [api] magic-link model + token utils + Redis sessions · [web] S-01/S-02 + resend timer + errors · [api] rate limits · [test] single-use/expiry/enumeration.

#### E1.2 · Org bootstrap and profile
`P0 · 2h · depends: E1.1 · trace: AUTH-2, SET-1 · GET/PATCH /org`

**Story.** As a first-time supervisor, I want an organization created for me so that my crews and records have a home.

**Acceptance**
- [ ] First successful verify creates one org per user with name, IANA timezone (browser default, `Asia/Dubai` fallback), locale en/ar.
- [ ] `GET/PATCH /org` validates name 2–80, timezone, locale; only the owner can edit.
- [ ] Cross-tenant access is impossible; invalid timezone is rejected with a typed error.

**Tasks** — [api] org model + creation hook · [api] routes · [test] tenancy/validation.

#### E1.3 · Bilingual shell, RTL, design system
`P0 · 4h · depends: E0.1 · trace: AUTH-3, AUTH-4 · all S screens`

**Story.** As an Arabic-speaking supervisor, I want the product mirrored in Arabic so that it feels native, not translated.

**Acceptance**
- [ ] EN/AR toggle flips all shell strings and `<html dir>`; persists per user and pre-auth; `ar` browser locale auto-suggests Arabic (AUTH-4).
- [ ] Logical CSS mirrors nav, forms, tables, breadcrumbs; media controls do not mirror; bidi isolation for numbers/links.
- [ ] Tokens + core components: `Button`, `Input`, `Modal`, `Sheet`, `StatusPill`, `EmptyState`, `Toast`, `AudioPlayer` shell.
- [ ] Missing-key lint fails CI; fonts load; axe reports no critical issues on the shell.

**Tasks** — [web] i18n + toggle + RTL · [web] tokens/components · [ci] missing-key lint · [test] AR screenshot + axe.

#### E1.4 · First-run checklist
`P0 · 2h · depends: E1.2, E2.1 · trace: AUTH-2, ACT-2 · S-03`

**Story.** As a first-time supervisor, I want a four-step checklist so that I know exactly how to reach my first shared instruction.

**Acceptance**
- [ ] Steps: create crew → add workers → record instruction → share; completion comes from server counts, not local state.
- [ ] Checklist persists across sessions; 9-minute promise visible; returning users land on the instruction list.
- [ ] Empty state has exactly one action; loading/error states exist.

**Tasks** — [api] counts endpoint · [web] S-03 + states · [test] progress transitions.

---

### E2 — Crews, workers, import (16h)

#### E2.1 · Crew CRUD and archive
`P0 · 3h · depends: E1.2 · trace: CREW-1, CREW-7 · S-05/S-06 · /crews`

**Story.** As a supervisor, I want to create, rename, and archive crews so that my roster matches the site.

**Acceptance**
- [ ] Create/rename/archive; archive is idempotent and keeps history; archived crews are excluded from new audiences but visible in history.
- [ ] Crew detail shows worker count and language summary; empty state has one action.
- [ ] All queries are org-scoped; validation 2–80 chars; no hard delete in v0.1.

**Tasks** — [api] model/routes · [web] S-05/S-06 · [test] archive/tenancy.

#### E2.2 · Worker CRUD, archive, limits
`P0 · 5h · depends: E2.1 · trace: CREW-2, CREW-4, CREW-5, CREW-7 · S-06/S-07 · /workers`

**Story.** As a supervisor, I want to add a worker with their language so that they receive instructions they can understand.

**Acceptance**
- [ ] Add/edit: name 1–80 NFC, language required from six native-script options, phone optional E.164 (display-only).
- [ ] Duplicate normalized name in the same crew → `201` + `meta.warning: duplicate_name`; duplicate names are legal (B15).
- [ ] 1,001st active worker returns `WORKER_LIMIT_REACHED` with respectful copy; archive keeps deliveries and hides the worker from new audiences.
- [ ] Language edits affect future instructions only; existing deliveries keep their snapshot (CREW-4).
- [ ] Worker-facing APIs never expose phone; the only full-surname exposure is the display-name collision fallback (C7/WORK-2).

**Tasks** — [api] model/indexes + routes · [web] S-06/S-07 · [test] limit/snapshot/PII.

#### E2.3 · CSV import end-to-end
`P0 · 6h · depends: E2.2 · trace: CREW-3 · S-08/S-09 · /workers/template.csv, /workers/import, /imports/:id, /imports/:id/commit`

**Story.** As a supervisor, I want to paste a 150-row crew into a template and fix only the bad rows so that onboarding a site takes minutes.

**Acceptance**
- [ ] Template downloads with UTF-8 BOM and `name,language,phone,crew`; parser tolerates BOM/encoding, friendly language aliases, and headers.
- [ ] Preview shows every row, per-row errors (≤50 inline, full list via API), and duplicate-name warnings; warnings never block (B15).
- [ ] Fixture: 150 rows with 3 invalid languages → exactly 3 errors, commit blocked, nothing created. Arabic/Hindi/Urdu names intact.
- [ ] Commit is all-or-nothing on errors inside a transaction; `201 { created }`; import TTL 30 days; 1,000-worker cap enforced.
- [ ] Re-upload after fixing works; double commit returns `IMPORT_ALREADY_COMMITTED`.

**Tasks** — [api] parser/validators/import doc/commit · [web] S-08/S-09 · [test] fixture + encoding + transaction.

#### E2.4 · Roster edge cases and display names
`P0 · 2h · depends: E2.2 · trace: WORK-1, WORK-2 · S-06/W-01`

**Story.** As a supervisor, I want duplicate names to remain distinguishable without exposing private data.

**Acceptance**
- [ ] Worker display name = first name + last initial; if that collides in the audience, use the full last name only for colliding workers; if still identical, append a stable numeric suffix.
- [ ] Phones are never returned by worker-facing APIs; full surnames appear only inside the collision fallback. Supervisor UI may show the full name.
- [ ] Empty crew, archived filter, and search-with-no-results each have one clear action; archived workers appear in history only.

**Tasks** — [api] display-name util + audience payload · [web] states · [test] collision fixtures.

---

### E3 — Composer and media (19h)

#### E3.1 · Draft lifecycle, autosave, duplicate
`P0 · 4h · depends: E2.1 · trace: COMP-5 · S-10 · /instructions`

**Story.** As a supervisor, I want my draft to survive a refresh and reuse a past instruction so that I never retype a briefing.

**Acceptance**
- [ ] Create draft; debounced autosave (~600ms); refresh restores the draft; retries never create duplicates.
- [ ] Shared/archived instructions are immutable; duplicate creates a new draft copying title/type/source/audience and media (server-side R2 copy).
- [ ] Draft delete removes media not referenced elsewhere; orphan cleanup is queued.

**Tasks** — [api] draft model/routes + duplicate · [web] autosave hook + recover UI · [test] refresh/duplicate/media.

#### E3.2 · Text, type, source language
`P0 · 3h · depends: E3.1 · trace: COMP-1, COMP-6, COMP-7 · S-10`

**Story.** As a supervisor, I want to type or paste an instruction and mark it Task or Info so that the worker sees the right final action.

**Acceptance**
- [ ] Text ≤2,000 chars with counter; empty/whitespace blocked; source language required (default org locale).
- [ ] Task → “Done”; Info → “Got it”; nothing else changes.
- [ ] Draft persists type/source; `instruction_created` fires at generate with type, audience size, languages.

**Tasks** — [web] form + validation · [api] PATCH content · [test] limits/copy.

#### E3.3 · Voice recorder, upload, transcript confirmation
`P0 · 6h · depends: E3.1, E4.1 · trace: COMP-2, PIPE-1 · S-10/S-12 · POST /instructions/:id/voice`

**Story.** As a supervisor, I want to speak for 40 seconds, see what was heard, and confirm the language so that translation starts from the truth.

**Acceptance**
- [ ] MediaRecorder supports `webm/opus` (Chromium) and `mp4/aac` (Safari); start/stop/re-record/playback; 3:00 max with auto-stop.
- [ ] Upload retries; the recording blob is retained locally until the server confirms; server `ffprobe` validates ≤185s and stores an org-scoped R2 key.
- [ ] Upload queues STT (C1); UI shows “Transcribing…”, then transcript + detected language; supervisor can edit the transcript and confirm source language before Generate.
- [ ] Empty transcript after 2 attempts → clear error + re-record; the recording is never silently lost.
- [ ] Generate is disabled until transcript + source language are confirmed.

**Tasks** — [web] recorder component + retry · [api] upload + job enqueue · [web] transcript confirm UI · [test] Safari/Chromium fixtures.

#### E3.4 · Photo attachment
`P0 · 3h · depends: E3.1 · trace: COMP-3 · S-10 · POST /instructions/:id/photo`

**Story.** As a supervisor, I want to attach a site photo as a visual aid so that the crew sees the exact location or item.

**Acceptance**
- [ ] Client compresses to ≤1,600px long edge; accepts jpg/png/webp ≤8MB before compression; camera HEIC is converted via canvas to JPEG.
- [ ] Server re-encodes, strips EXIF/GPS, stores org-scoped; wrong MIME/oversize → `UNSUPPORTED_MEDIA`/`PAYLOAD_TOO_LARGE`.
- [ ] Photo requires caption text in v0.1 (C2); Generate disabled without text; a photo failure never loses the text.
- [ ] Removing the photo returns content to text-only.

**Tasks** — [web] compressor/preview · [api] sharp re-encode · [test] EXIF/MIME.

#### E3.5 · Audience picker and language chips
`P0 · 3h · depends: E2.2 · trace: COMP-1, COMP-4, D6 · S-11 · POST /generate`

**Story.** As a supervisor, I want to choose a crew or a subset and see exactly which languages will be generated so that no worker is stranded.

**Acceptance**
- [ ] Default audience = all active crew workers; multi-select subset with search; empty audience blocked.
- [ ] Language chips are derived from the audience, in native script, with counts; there are no exclusions (D6).
- [ ] Audience snapshot is stored at generate; archived workers are excluded; a warning names how many were dropped.
- [ ] 1,000-worker cap and org scoping enforced.

**Tasks** — [web] S-11 picker + chips · [api] audience snapshot + validation · [test] derived languages/archived.

---

### E4 — AI pipeline (26h)

#### E4.1 · Provider adapters and contracts
`P0 · 6h · depends: E0.5, E0.2 · trace: PIPE-1, PIPE-2, PIPE-4 · TDD §9`

**Story.** As the system, I want provider-agnostic adapters so that a quota or outage is a fallback, not a rewrite.

**Acceptance**
- [ ] Interfaces for STT, translation, question, TTS, email, storage; SDK types never leak into modules.
- [ ] Every call has a timeout and a typed error; retries belong to jobs, not adapters; mock mode is deterministic.
- [ ] Contract tests cover success, timeout, malformed output, and rate-limit errors; STT falls back Groq → Azure; translation falls back Llama → DeepL when configured.
- [ ] No prompt text or worker PII in logs.

**Tasks** — [api] interfaces + Azure/Groq/DeepL/Resend/R2 adapters · [test] fixtures/failures · [docs] provider notes.

#### E4.2 · Pipeline orchestration, status, retries
`P0 · 7h · depends: E4.1 · trace: PIPE-5, PIPE-8 · S-12 · GET /instructions/:id/status`

**Story.** As a supervisor, I want to see per-language progress and recover from one failed language without losing the rest.

**Acceptance**
- [ ] Voice upload queues transcription; Generate queues per-language jobs (translate → question → TTS); stages are idempotent by key.
- [ ] 3 retries with exponential backoff; one language failure never blocks others; status endpoint returns coarse status + per-language stages; poll 2s and stop at ready/partial_failure.
- [ ] No provider call runs in the request path; graceful shutdown; queue retention is capped for the 30MB Redis budget.
- [ ] Structured logs include requestId/jobId, never worker names or instruction bodies.

**Tasks** — [api] queues/workers/state machine · [api] status endpoint · [test] partial failure/resume/idempotency.

#### E4.3 · Translation and question generation
`P0 · 5h · depends: E4.1 · trace: PIPE-2, PIPE-3 · TDD §20 prompts`

**Story.** As a worker, I want a faithful translation and one fair question so that the check tests the instruction, not trivia.

**Acceptance**
- [ ] Translation skips target == source; source is delimited and treated as data; JSON schema validated; numbers/units preserved via post-check; unchanged target flagged “possibly untranslated.”
- [ ] Question has exactly 3 unique options, one correct, within length limits; invalid output is retried; failure is isolated per language.
- [ ] Prompts are versioned in repo; adversarial source text cannot escape the data delimiters or inject instructions.

**Tasks** — [api] prompt contracts/parsing/post-checks · [api] variant writes · [test] adversarial + number preservation.

#### E4.4 · TTS, cache, signed audio
`P0 · 5h · depends: E4.1, E4.3 · trace: PIPE-4, PIPE-7 · /variants/:id/audio`

**Story.** As a worker, I want audio in my language that plays instantly and is cached so that weak connectivity is survivable.

**Acceptance**
- [ ] Six-voice map; 48kbps MP3; cache key = `sha256(orgId + text + voiceId + rate + format + glossaryVersion)`, hit reuses asset and touches `lastUsedAt`.
- [ ] Audio is org-scoped in R2; supervisor audio URL is cookie-checked then 302 to a 15-minute signed URL; worker audio is delivery-token-scoped.
- [ ] TTS failure after retries → `text_only` variant with an explicit warning; other languages unaffected.
- [ ] Audio is never publicly enumerable.

**Tasks** — [api] TTS adapter/cache/audio_assets · [api] signed URLs · [test] cache hit/failure/scoping.

#### E4.5 · Usage ledger and cost metering
`P0 · 1h · depends: E4.2 · trace: PIPE-8, SET-3 · GET /org/usage`

**Story.** As the founder, I want to see what each instruction costs so that the free tiers stay honest.

**Acceptance**
- [ ] Every provider call writes `ai_usage` (stage/provider/model/units/cost/latency/instructionId).
- [ ] Monthly org aggregation returns TTS chars/minutes, instructions, deliveries; no UI yet.
- [ ] A 4-language fixture asserts one ledger row per stage per language.

**Tasks** — [api] ledger service/wrappers/aggregation · [test] fixture.

#### E4.6 · Pipeline failure UX and text-only acceptance
`P0 · 2h · depends: E4.2, E5.1 · trace: PIPE-5, PIPE-7 · S-12/S-13`

**Story.** As a supervisor, I want to retry one language or share the rest as text so that a provider bad day never blocks the crew.

**Acceptance**
- [ ] S-12 shows per-language stage, error, and retry; retry only the failed stage/language; old audio is preserved until new audio is ready.
- [ ] Partial-failure preview names affected workers and languages; `acceptTextOnly` applies **only** to failed languages (C10); ready languages keep audio.
- [ ] The recording/transcript is never lost; refresh resumes polling.

**Tasks** — [web] failure/status UI · [api] acceptTextOnly semantics · [test] partial share.

---

### E5 — Preview, share, tokens (17h)

#### E5.1 · Preview screen
`P0 · 6h · depends: E4.3, E4.4 · trace: PIPE-6, D2 · S-13 · GET /instructions/:id`

**Story.** As a supervisor, I want to see and hear every language before sharing so that I trust what my crew receives.

**Acceptance**
- [ ] Shows source text/transcript + each variant in native script, audio player, and question; no autoplay.
- [ ] Per-card loading/error states; inline edit entry; AR RTL; desktop ≥1024px.
- [ ] Preview creates zero deliveries and zero worker events (security test 11).
- [ ] “Possibly untranslated” and text-only warnings are visible and explained.

**Tasks** — [api] instruction detail · [web] S-13 + AudioPlayer · [test] zero deliveries.

#### E5.2 · Edit and regenerate a language
`P0 · 4h · depends: E5.1 · trace: PIPE-6, J4 · PATCH /variants/:id, POST /variants/:id/regenerate`

**Story.** As a supervisor, I want to fix one language without touching the others so that a mistranslated safety term is corrected in seconds.

**Acceptance**
- [ ] Edit text/title/question; text/title edit regenerates that language's question + TTS; question edit sets `source='manual'` and does not regenerate audio.
- [ ] During regeneration the instruction returns to `processing` and Share is disabled (C5); old audio stays until the new audio is ready.
- [ ] Other languages are untouched; a failed regeneration leaves the old variant recoverable.
- [ ] Post-share edits are blocked with a typed conflict.

**Tasks** — [api] lifecycle + PATCH/regenerate · [web] inline edit + regenerating state · [test] isolation/rollback.

#### E5.3 · Share token and deliveries
`P0 · 4h · depends: E5.2 · trace: SHARE-1, SHARE-3, D1 · POST /instructions/:id/share`

**Story.** As a supervisor, I want one link that opens the right instruction for my crew so that I can paste it into the WhatsApp group once.

**Acceptance**
- [ ] Share only from `ready` (or `partial_failure` + `acceptTextOnly`); 128-bit token stored as HMAC hash + AES-GCM ciphertext (B2); `sharedAt` set.
- [ ] Deliveries are created for active audience workers in a transaction; archived workers are dropped with a warning count (C6); each delivery snapshots language + variant.
- [ ] Second share returns `SHARE_CONFLICT`; share response returns URL, EN/AR WhatsApp messages, and `deliveriesCreated`.
- [ ] `instruction_shared` analytics event fires; worker pages are `noindex`.

**Tasks** — [api] token service + transaction · [api] share endpoint · [web] share panel · [test] conflict/audience/zero-archived.

#### E5.4 · QR, WhatsApp copy, preview mode
`P0 · 2h · depends: E5.3 · trace: SHARE-2, D2 · S-13/W-09`

**Story.** As a supervisor, I want to copy the message or show a QR so that sharing fits the room I am standing in.

**Acceptance**
- [ ] Copy link; copy EN/AR message with title + link; on-screen QR renders client-side.
- [ ] “See what workers see” opens a watermarked read-only worker view; no writes, no deliveries, no analytics worker events.
- [ ] Preview token is stateless HMAC, read-only, and uses the first audience worker's language.

**Tasks** — [web] QR + copy + preview link · [api] preview token · [test] read-only.

#### E5.5 · Regenerate/archive link and closed screens
`P0 · 1h · depends: E5.3 · trace: SHARE-1, SHARE-4, B14 · POST /regenerate-link, /archive`

**Story.** As a supervisor, I want to kill a leaked link or close an old instruction without losing the record.

**Acceptance**
- [ ] Regenerate replaces the token instantly; old link → 410 closed screen; existing delivery tokens stay valid (B14).
- [ ] Copy link still works after reload (AES-GCM decrypt); archive is idempotent and keeps records exportable.
- [ ] Closed screen shows org name + “Ask your supervisor for a new link”; no dead end.

**Tasks** — [api] endpoints · [web] confirmations/closed states · [test] old-link/token-stay.

---

### E6 — Worker PWA (30h)

> **The heart of the product.** Every story here is tested at 320px, on a real low-end Android and an iPhone, in at least Arabic and Malayalam.

#### E6.1 · Public link, name picker, remembered worker
`P0 · 4h · depends: E5.3 · trace: WORK-1, WORK-2, D1 · W-01/W-10 · GET /w/:token, POST /w/:token/identify`

**Story.** As a worker, I want to tap the link and find my name so that I never create an account or remember a password.

**Acceptance**
- [ ] Page shows org name, instruction title, audience tiles (display name + language), search above 20; no phones, and no full surnames except the collision fallback.
- [ ] Select name → identify → delivery token stored; `openedAt` set first-event-only; localStorage offers “Continue as …” + “Not you?”.
- [ ] “Not you?” returns to the picker without clearing audit timestamps (C4); “My name isn't here” → ask-supervisor screen.
- [ ] Invalid/archived link → closed screen; `noindex`; 48px targets; no horizontal scroll at 320px.

**Tasks** — [worker] shell + picker + storage · [api] meta/identify · [test] privacy/remember/invalid.

#### E6.2 · Instruction view, audio, photo
`P0 · 5h · depends: E6.1 · trace: WORK-3, WORK-10, D16 · W-02`

**Story.** As a worker, I want to hear the instruction in my language while seeing the text and photo so that I understand even if I cannot read well.

**Acceptance**
- [ ] Native-script text, photo if present, one prominent 64px play/pause; tap-to-play only; replay always available.
- [ ] Buffering/error states; audio starts ≤4s after tap on 3G; text remains visible if audio fails.
- [ ] Question below the content; sticky Done/Got it; help reachable; disclaimer in the worker's language every page.
- [ ] Arabic/Urdu RTL; media controls not mirrored; body ≥16px; contrast AA.

**Tasks** — [worker] screen + AudioPlayer + photo · [api] audio/photo redirects · [test] RTL/3G/error.

#### E6.3 · Question flow and attempts
`P0 · 4h · depends: E6.2 · trace: WORK-4, J3 · W-03/W-04 · POST /w/answer`

**Story.** As a worker, I want one clear question with instant feedback so that I know whether I understood.

**Acceptance**
- [ ] 3 full-width options; tap sends with Idempotency-Key; correct → green confirmation + audio replay; wrong → correct highlighted + audio replay + one retry.
- [ ] First-attempt correctness is immutable; attempts cap is **2 total** (C3); second wrong auto-sets help `dont_understand` and confirms the supervisor is notified; a third answer → `ATTEMPTS_EXHAUSTED`.
- [ ] Network error shows retry, never records twice; reopening preserves state.

**Tasks** — [worker] question UI · [api] answer + idempotency + attempts · [test] double-submit/third answer.

#### E6.4 · Done / Got it, reopen
`P0 · 3h · depends: E6.3 · trace: WORK-4, WORK-7, COMP-6 · W-07 · POST /w/complete`

**Story.** As a worker, I want to press Done only after I have answered so that my supervisor knows I am finished.

**Acceptance**
- [ ] Done/Got it enabled after ≥1 attempt; complete is idempotent and requires an attempt.
- [ ] First timestamps win; reopening shows completed state and keeps audio replayable.
- [ ] Board reflects completion within 15s; no duplicate analytics events.

**Tasks** — [worker] complete state · [api] complete + idempotency · [test] reopen/race.

#### E6.5 · Help flow and auto-help
`P0 · 3h · depends: E6.1 · trace: WORK-5, NOTIF-1 · W-05/W-06 · POST /w/help`

**Story.** As a worker who is stuck, I want to ask for help in one tap so that my supervisor knows before the shift starts.

**Acceptance**
- [ ] Help is reachable after identify; sheet has four reasons (don't understand, missing tools, safety, other); no free text.
- [ ] POST is idempotent; confirmation says the supervisor was notified; help flag appears on the board.
- [ ] Second wrong answer auto-sets help; email batching is handled by E7.5.
- [ ] Offline help shows “will send when connected” or a retry, never a dead end.

**Tasks** — [worker] sheet/confirmation · [api] help + queue · [test] idempotency/auto-help.

#### E6.6 · Language switch
`P0 · 2h · depends: E6.2 · trace: WORK-6, CREW-4, B4 · W-01/W-11 · POST /w/language`

**Story.** As a worker, I want to switch to my language if the wrong one was saved so that I can still understand the instruction.

**Acceptance**
- [ ] Switch available on the picker and page menu; explicit confirmation (“Change my language to മലയാളം?”).
- [ ] Server updates worker profile + current delivery variant; `languageChangeHistory` records `{from,to,at}`; content/audio/question refresh.
- [ ] Before completion: delivery switches. After completion: profile updates but the delivery snapshot is immutable (C11).
- [ ] Future instructions use the new language; no data loss.

**Tasks** — [api] language endpoint + history · [worker] sheet + refresh · [test] pre/post completion.

#### E6.7 · Edge pages and offline states
`P0 · 3h · depends: E6.1 · trace: WORK-7, SHARE-4, PIPE-7 · W-08/W-09/W-10/W-12`

**Story.** As a worker, I want a clear next step when a link is closed, the audio fails, or the network dies so that I am never stranded.

**Acceptance**
- [ ] Closed/archived, preview, name-not-found, invalid-token, and offline/weak-connection pages exist with exactly one action.
- [ ] Offline shows cached text if available + retry; audio failure shows text-only fallback.
- [ ] No page is a dead end; org name appears where appropriate.

**Tasks** — [worker] routes/copy/states · [test] each edge page.

#### E6.8 · PWA shell and audio cache
`P1 · 3h · depends: E6.2 · trace: WORK-8 · W-12`

**Story.** As a worker on a weak connection, I want the page and audio to work after the first open so that a dead spot does not block the task.

**Acceptance**
- [ ] Manifest + service worker precache the worker shell; installable via Android and iOS Add to Home Screen.
- [ ] Audio cached after first successful play (Cache API); second play works offline; cache is bounded and evicts oldest.
- [ ] Worker bundle ≤180KB gzip; no supervisor code or shadcn enters the worker bundle.

**Tasks** — [worker] vite-plugin-pwa + SW · [test] offline second open + bundle budget.

#### E6.9 · Six-language catalogs, disclaimer, native review prep
`P0 · 3h · depends: E6.2 · trace: WORK-10, WORK-11, PRD §12 · all W screens`

**Story.** As a worker, I want every button and message in my language so that I never guess what “Done” means.

**Acceptance**
- [ ] All worker strings in ar/en/hi/ur/ml/bn, native script, no machine-translated button copy; gender-neutral where possible.
- [ ] Disclaimer appears on every worker page in the UI language + English.
- [ ] Fonts for all six scripts render at 320px; native-review checklist prepared; open wording traps logged (PRD Q3).
- [ ] Missing key falls back safely to English, never to a raw key.

**Tasks** — [worker] catalogs/fonts/disclaimer · [docs] review sheet · [test] script screenshots.

---

### E7 — Board and notifications (20h)

#### E7.1 · Home instruction list
`P0 · 4h · depends: E5.3 · trace: BOARD-1, BOARD-6 · S-04 · GET /instructions`

**Story.** As a supervisor, I want to open the app and see how my recent instructions are doing so that I know where to spend the next five minutes.

**Acceptance**
- [ ] Recent instructions with targeted/opened/understood/help counts; one “New instruction” CTA; archived instructions separated.
- [ ] “Understood %” tooltip explains first attempt + Done within 24h (B13); keyboard accessible; AR copy.
- [ ] Polls 15s only while visible; “last updated” timestamp; loading/empty/error/offline states; no color-only status.

**Tasks** — [api] summary aggregation · [web] S-04 + polling + tooltip · [test] KPI math/states.

#### E7.2 · Instruction board and filters
`P0 · 6h · depends: E6.3, E6.4 · trace: BOARD-2, BOARD-5 · S-14 · GET /instructions/:id/deliveries`

**Story.** As a supervisor, I want the per-worker truth at a glance so that I can chase the right people, not everyone.

**Acceptance**
- [ ] Rows: worker, language, status, first-attempt correct/incorrect, help badge, opened/answered/completed timestamps.
- [ ] Filters all / not opened / wrong / needs help; counts match rows; cursor pagination.
- [ ] Polls 15s only when visible; “Showing last data” on error; server computes the 24h KPI; AR RTL; ≥1024px.

**Tasks** — [api] deliveries + counts · [web] S-14 + filters + polling · [test] 24h boundary.

#### E7.3 · Exception section and resolve help
`P0 · 4h · depends: E7.2 · trace: BOARD-3, J3 · S-14 · POST /deliveries/:id/resolve-help`

**Story.** As a supervisor, I want a pinned list of who needs help first so that I can resolve the shift's real blockers.

**Acceptance**
- [ ] Pinned order: needs help → not opened >2h → wrong first attempt; each row has the relevant action.
- [ ] Mark resolved sets resolver + timestamp, is idempotent, and is visible in the export.
- [ ] Resolved items leave the filter with confirmation; unresolved count updates; empty state explains what “no exceptions” means.

**Tasks** — [api] exception aggregation + resolve · [web] pinned section · [test] order/resolve.

#### E7.4 · Board actions
`P0 · 3h · depends: E5.5, E7.2 · trace: BOARD-4, D20 · S-14`

**Story.** As a supervisor, I want to copy a reminder or resend the link without leaving the board so that chasing takes seconds.

**Acceptance**
- [ ] Copy link; copy reminder message EN/AR with title + link; regenerate/archive with confirmation; open worker preview.
- [ ] Actions respect lifecycle and rate limits; no message is sent by the product (D20).
- [ ] `reminder_copied` fires with targeted count.

**Tasks** — [web] actions/copy templates · [test] lifecycle/copy.

#### E7.5 · Help alert email batching
`P0 · 3h · depends: E6.5 · trace: NOTIF-1, NOTIF-3 · TDD §12`

**Story.** As a supervisor, I want one email when workers need help so that I am notified without being spammed.

**Acceptance**
- [ ] First help queues a delayed batch job; ≤1 email per instruction per 10 minutes; aggregates worker names, reasons, instruction, and link.
- [ ] Only the owner receives it; Resend template AR/EN; `email_log` row; failures retry and never silently drop.
- [ ] Fake-timer test: 3 helps in 10 minutes → 1 email; a help after 10 minutes → a new email.

**Tasks** — [api] delayed job + aggregation + template · [test] batching/failure.

---

### E8 — Exports, settings, data (14h)

#### E8.1 · CSV engine
`P0 · 4h · depends: E5.3 · trace: AUDIT-1, AUDIT-2, B7 · GET /exports/...`

**Story.** As a supervisor, I want an Excel-safe CSV that an auditor can open without fixing Arabic names.

**Acceptance**
- [ ] RFC 4180; UTF-8 BOM; formula-injection escaping for `=`, `+`, `-`, `@`; ISO-8601 UTC + `org_timezone` column.
- [ ] Delivery language is the snapshot, never the live worker profile (AUDIT-3).
- [ ] Stable filenames; tests open the file in Excel with Arabic/Hindi/Urdu names intact.

**Tasks** — [api] exporter/escaping/timezone · [test] Excel fixture/injection.

#### E8.2 · Instruction and org exports
`P0 · 3h · depends: E8.1, E7.2 · trace: AUDIT-1, AUDIT-4 · S-15`

**Story.** As a supervisor, I want to export one instruction or a date range so that I can answer an HSE request in 20 seconds.

**Acceptance**
- [ ] Instruction CSV and org date-range CSV with the exact columns in doc 05; archived included.
- [ ] Export dialog S-15; 5/h/org rate limit; server-generated; `audit_exported` fires with scope.
- [ ] Errors are recoverable; empty range shows a clear message.

**Tasks** — [api] endpoints/rate limit · [web] S-15 · [test] columns/scope.

#### E8.3 · Settings, support, legal
`P0 · 3h · depends: E1.2 · trace: SET-1, SET-4, SET-5 · S-16`

**Story.** As a supervisor, I want to fix my org name/timezone and find support so that I am not hunting through the app.

**Acceptance**
- [ ] Edit org name/timezone/locale; timezone drives exports and metrics; validation + saved confirmation.
- [ ] Header has WhatsApp deep link + mailto; Terms/Privacy placeholders exist; no compliance claims in UI.
- [ ] AR/EN and RTL; no logo upload (deferred).

**Tasks** — [web] S-16 + support links + legal pages · [test] timezone effect.

#### E8.4 · Usage meter and soft cap
`P0 · 2h · depends: E4.5 · trace: SET-3 · GET /org/usage`

**Story.** As the founder, I want a visible usage meter so that a pilot cannot silently burn the free TTS tier.

**Acceptance**
- [ ] Current month TTS chars/minutes, instructions, deliveries; soft cap 150 minutes; warning at 80% and 100%.
- [ ] Never blocks an instruction (fair-use guardrail, not a paywall); org timezone; AR/EN.
- [ ] Values match the ledger fixture.

**Tasks** — [api] usage aggregation · [web] meter/warnings · [test] cap.

#### E8.5 · Export all and delete org
`P0 · 2h · depends: E8.1 · trace: SET-2, B8`

**Story.** As a supervisor, I want my data out and my org gone if I ask so that I trust the product with my roster.

**Acceptance**
- [ ] Export all ZIP = workers + instructions + deliveries CSVs + README; works before deletion.
- [ ] Delete requires typed org name, queues the cascade, revokes sessions, sends a confirmation email; idempotent.
- [ ] R2 org prefix and TTS cache are deleted; PRD “within 7 days” is an upper bound; test fixture verifies no orphan.

**Tasks** — [api] zip + cascade job + email · [web] typed confirm · [test] idempotency/orphans.

---

### E9 — Quality, security, pilot gate (31h)

#### E9.1 · Security acceptance suite
`P0 · 6h · depends: E1–E8 · trace: doc 05 §11`

**Story.** As the founder, I want the twelve security tests in CI so that the only severity-1 bug class (cross-tenant) cannot ship.

**Acceptance**
- [ ] All 12 tests from doc 05 §11 exist and pass against real Mongo/Redis.
- [ ] Cross-tenant probes cover crews, workers, instructions, variants, deliveries, exports, and media.
- [ ] Token tests cover share/delivery/preview/magic-link scoping and revocation.
- [ ] Any failure blocks deploy to production.

**Tasks** — [test] harness + 12 suites · [ci] release gate.

#### E9.2 · Accessibility, RTL, device audit
`P0 · 4h · depends: E6 · trace: NFR a11y/i18n, doc 03 §9`

**Story.** As a worker with a low-end phone or low literacy, I want a usable interface so that the product does not exclude the people it is for.

**Acceptance**
- [ ] axe clean on instruction, question, and help; focus order; contrast AA; 48px targets; 320px.
- [ ] All six scripts render; Arabic RTL screenshots; media controls not mirrored.
- [ ] Real low-end Android Chrome + iPhone Safari pass; known issues documented.

**Tasks** — [test] axe/Lighthouse · [manual] device matrix · [fix] criticals.

#### E9.3 · Performance budgets
`P0 · 3h · depends: E6–E8 · trace: TDD §13`

**Story.** As the founder, I want the budgets enforced so that “fast on 3G” is a test, not a hope.

**Acceptance**
- [ ] Worker FCP ≤2s on 3G (cached shell ≤1s); audio ≤4s after tap; board ≤2s; API p95 ≤300ms; pipeline ≤45s.
- [ ] Bundle budgets in CI (worker ≤180KB gzip, supervisor ≤350KB).
- [ ] Lighthouse + API smoke recorded before the pilot gate.

**Tasks** — [ci] budgets · [test] Lighthouse/k6 · [fix] regressions.

#### E9.4 · E2E golden paths
`P0 · 5h · depends: E9.1 · trace: TDD §14`

**Story.** As the founder, I want the five journeys in Playwright so that refactors cannot break the pilot loop.

**Acceptance**
- [ ] Covers magic link → crew → CSV → voice → preview → share → worker answer → board → export.
- [ ] AR + ML at 360px; wrong answer; help; revoked link; preview mode; offline answer retry.
- [ ] Test mailer + mock providers; runs on `main`; artifacts on failure.

**Tasks** — [test] e2e suite/fixtures · [ci] artifacts.

#### E9.5 · Ops readiness
`P0 · 3h · depends: E0.3 · trace: TDD §11.5`

**Story.** As the only operator, I want backups, alerts, and a runbook so that a 2am failure is recoverable.

**Acceptance**
- [ ] Nightly `mongodump` → encrypted R2; restore drill succeeds from the previous night.
- [ ] UptimeRobot + Sentry + queue-depth alert; runbook covers restart, Redis memory, provider limits, rollback.
- [ ] Secrets only in GitHub/env; no secrets in logs; rotation note.

**Tasks** — [ops] backup cron/restore · [ops] alerts/runbook · [test] drill.

#### E9.6 · Analytics verification and pilot dashboards
`P0 · 2h · depends: E1–E8 · trace: PRD §11`

**Story.** As the founder, I want the pilot metrics computed correctly so that the go/no-go decision is evidence, not vibes.

**Acceptance**
- [ ] Every PRD §11 event fires with the exact name/properties; no worker PII.
- [ ] PostHog dashboards: activation, response rate, understood rate, help rate, 9-minute and 90-second times.
- [ ] Staging test event verified end-to-end.

**Tasks** — [web/api] event wrapper · [analytics] dashboards · [test] event audit.

#### E9.7 · Worker and supervisor validation + native copy review
`P0 · 4h · depends: E6, E7 · trace: doc 03 §13, PRD Q3`

**Story.** As the founder, I want real people to use the product before the pilot so that I fix confusion before a customer sees it.

**Acceptance**
- [ ] 3 workers (at least 2 languages) complete the flow unaided on their phones; zero observer touches; times recorded.
- [ ] 3 supervisors attempt sign-in → first share; activation time and blockers recorded.
- [ ] Native review of all six worker catalogs; blockers fixed; gender-neutral wording confirmed.
- [ ] Session notes include verbatim confusion quotes; copy changes are applied or explicitly deferred.

**Tasks** — [research] recruit/script/sessions · [fix] copy/UX · [docs] notes.

#### E9.8 · Pilot dry run
`P0 · 3h · depends: E9.1–E9.7 · trace: PRD J1–J5`

**Story.** As the founder, I want one full dress rehearsal so that the pilot week is not the first time the system meets reality.

**Acceptance**
- [ ] One crew, 3 real phones, 3 languages, real domain and email; J1–J5 end-to-end.
- [ ] 9-minute supervisor and 90-second worker targets measured; defects triaged.
- [ ] P0 defects fixed; go/no-go decision documented against §14.

**Tasks** — [ops] dry run · [fix] P0 · [docs] decision.

#### E9.9 · v0.2 seams audit
`P0 · 1h · depends: E0–E8 · trace: TDD §16`

**Story.** As the founder, I want the seams verified now so that v0.2 does not begin with a refactor.

**Acceptance**
- [ ] All 12 TDD §16 items exist in code/tests; missing ones added.
- [ ] No v0.2 UI leaks into v0.1.
- [ ] Audit recorded in this document or a short checklist.

**Tasks** — [audit] checklist · [fix] gaps.

---

### E10 — Stretch (13h, only after the pilot gate)

| ID | Story | Hours | Trace | Why it can wait |
|---|---|---:|---|---|
| E10.1 | In-product demo crew (3 workers, 1 sample instruction) | 4 | ACT-1 | Sales aid, not pilot-blocking |
| E10.2 | Offline answer/complete/help outbox with visible retry | 2 | WORK-9 | Online flow works; weak-network polish |
| E10.3 | Printable one-page QR PDF | 2 | SHARE-5 | On-screen QR covers the need |
| E10.4 | Weekly summary email | 3 | NOTIF-2 | Board already answers “how are we doing?” |
| E10.5 | Bulk language edit for selected workers | 2 | CREW-6 | Manual edit is acceptable at pilot size |

**Rule:** do not start E10 until every box in §14 is checked. If a stretch item is half-built when the pilot starts, hide it behind a flag and leave it.

---

## 9. Definition of Done

A story is done only when all of these are true:

**Code**
- [ ] Typecheck, lint, unit and integration tests pass; new query paths have indexes.
- [ ] Every org-scoped query takes `orgId` from the session, never from the URL/body.
- [ ] Boundaries validate with Zod; errors use the doc 05 catalog; no raw provider errors reach users.
- [ ] Worker mutations are idempotent; uploads are MIME/size checked; media is token-scoped.

**UX**
- [ ] Loading, empty, error, and offline states exist per [doc 03 §8](./03-user-flows-wireframes.md).
- [ ] Supervisor strings exist in EN + AR; worker strings in the six languages; no raw keys.
- [ ] Worker screens pass 320px, 48px targets, contrast, and no-color-only rules.
- [ ] The happy path is demoed on staging; worker stories are demoed on a real phone.

**Data & trust**
- [ ] Analytics event fires with the specified properties; no PII.
- [ ] Audit fields (`createdBy`, `sharedBy`, `resolvedBy`) are populated.
- [ ] Delivery snapshots are never rewritten by later roster edits.
- [ ] The story leaves the v0.2 seams intact (flags, timezone, tokens, exporter interface).

**Docs**
- [ ] Endpoint/schema changes reflected in doc 05 or the story notes.
- [ ] New operational step added to the runbook.
- [ ] Any deliberate deviation logged in §12, not hidden in code.

---

## 10. Traceability

### 10.1 PRD requirements → stories

| PRD IDs | Stories |
|---|---|
| AUTH-1, AUTH-5 | E1.1 |
| AUTH-2, ACT-2 | E1.2, E1.4 |
| AUTH-3, AUTH-4 | E1.3 |
| CREW-1, CREW-7 | E2.1, E2.2 |
| CREW-2, CREW-4, CREW-5 | E2.2, E3.5 |
| CREW-3 | E2.3 |
| CREW-6 | E10.5 (stretch) |
| COMP-1, COMP-4, COMP-6, COMP-7 | E3.2, E3.5 |
| COMP-2, PIPE-1 | E3.3, E4.2 |
| COMP-3 | E3.4 |
| COMP-5 | E3.1 |
| PIPE-2, PIPE-3 | E4.3 |
| PIPE-4 | E4.4 |
| PIPE-5, PIPE-8 | E4.2, E4.5 |
| PIPE-6, PIPE-7 | E4.6, E5.1, E5.2 |
| PIPE-9 | Explicitly deferred (D9) |
| SHARE-1, SHARE-3 | E5.3, E5.5 |
| SHARE-2 | E5.4 |
| SHARE-4 | E5.5, E6.7 |
| SHARE-5 | E10.3 (stretch) |
| WORK-1, WORK-2 | E6.1, E2.4 |
| WORK-3, WORK-10, WORK-11 | E6.2, E6.9 |
| WORK-4 | E6.3, E6.4 |
| WORK-5 | E6.5 |
| WORK-6 | E6.6 |
| WORK-7 | E6.4, E6.7 |
| WORK-8 | E6.8 |
| WORK-9 | E10.2 (stretch) |
| BOARD-1, BOARD-6 | E7.1 |
| BOARD-2, BOARD-5 | E7.2 |
| BOARD-3 | E7.3 |
| BOARD-4 | E7.4 |
| NOTIF-1, NOTIF-3 | E7.5 |
| NOTIF-2 | E10.4 (stretch) |
| AUDIT-1, AUDIT-2, AUDIT-3 | E8.1, E8.2 |
| AUDIT-4 | E8.2 |
| SET-1 | E1.2, E8.3 |
| SET-2 | E8.5 |
| SET-3 | E4.5, E8.4 |
| SET-4, SET-5 | E8.3 |
| ACT-1 | E10.1 (stretch) |

### 10.2 API surface → stories

| API group | Stories |
|---|---|
| Auth | E1.1 |
| Org/settings | E1.2, E8.3–E8.5 |
| Crews/workers/import | E2.1–E2.3 |
| Instructions/media | E3.1–E3.5, E5.2 |
| Variants | E4.3–E4.6, E5.2 |
| Share | E5.3–E5.5 |
| Board | E7.1–E7.4 |
| Exports | E8.1–E8.2 |
| Worker public | E6.1–E6.7 |
| Health | E0.3 |

### 10.3 Screen coverage

All screens S-01…S-16 and W-01…W-12 are covered by E1–E8. The worker edge pages W-08…W-12 are explicitly E6.1/E6.6/E6.7. The settings screen S-16 is E8.3–E8.5.

---

## 11. v0.2 seams checklist (verify in E9.9)

| Seam | Where it lands |
|---|---|
| `Delivery.channel` default `link` | E5.3 |
| Actor fields populated | E2.1, E5.3, E7.3 |
| `Instruction.status` includes `scheduled`; `seriesId`, `occurrence` | E0.4, E3.1 |
| Entitlements middleware stub | E0.4 |
| Feature flags per org | E0.4 |
| Timezone used by dates/metrics | E1.2, E8.3 |
| Generalized token utilities (instruction now, personal later) | E5.3, E6.1 |
| Templated email module with language selection | E1.1, E7.5 |
| Exporter interface (`CsvExporter` now, PDF later) | E8.1 |
| Media keys org+type, lifecycle hooks | E3.3, E3.4, E8.5 |
| `PROCESS_ROLE` + delayed jobs | E0.4, E4.2, E7.5 |
| PostHog event names/properties incl. v0.2 fields | E9.6 |

---

## 12. Build decisions discovered while sequencing

These eleven decisions resolved contradictions between docs 02–05. They were folded back on 2026-11-12; the table records what changed and where. They are canonical for the build.

| # | Decision | Why | Applied to |
|---|---|---|---|
| **C1** | Transcription runs **on voice upload**, before Generate. The composer shows transcript + detected language; Generate requires a confirmed transcript. | S-10 shows “Language detected” before Generate, and COMP-1/PIPE-1 require confirmation. Doc 05 used to start transcription inside Generate, which would force a blind source-language choice. | 05 §6.5/§6.6, status shape; 03 S-10 transcript row |
| **C2** | A photo **requires caption text** in v0.1; the photo is a visual aid, never the sole source. | No OCR + photo-only means nothing to translate and no answerable comprehension question. | 02 COMP-1/COMP-3, 03 S-10 |
| **C3** | Attempts cap is **2 total** (first + one retry), matching WORK-4. A third answer is rejected; the second wrong auto-sets help. | Doc 05 used to say max 3 while PRD says retry once; guessing a third time is worse than asking for help. | 05 delivery schema + `POST /w/answer` |
| **C4** | “Not you?” returns to the picker **without erasing audit timestamps**. The wrongly opened delivery stays `opened` with no answer; the correct worker uses their own delivery. | PRD's “original record cleared” would have rewritten history; the board must still show that someone opened it. | 02 edge cases |
| **C5** | Editing a variant while `ready` returns the instruction to `processing` and disables Share; stale audio is never shareable. | Doc 05 used to allow PATCH after ready without defining the share guard; trust requires no preview/audio mismatch. | 02 lifecycle, 05 §7, 03 S-13 |
| **C6** | At share, **archived workers are dropped** from the generate-time audience with a warning count; deliveries are never created for archived workers. | Resolves the generate→share race without silently stranding or resurrecting a worker. | 05 share endpoint |
| **C7** | Duplicate display names: first name + last initial; collisions get the full last name **only for colliding workers**, then a numeric suffix. Never a phone. | WORK-1 needs disambiguation without violating WORK-2 privacy. | 02 WORK-1, 03 W-01 |
| **C8** | **Deploy the walking skeleton on day 2**, not week 6; deploy continuously after. | TDD used to deploy in week 6, discovering DNS/TLS/Oracle/email too late. | 04 §18 |
| **C9** | PWA shell + audio cache are **committed** (E6.8); offline answer outbox is stretch (E10.2). | Poor connectivity is core; offline mutations are polish with idempotency risk. | 02 WORK-8/9, 04 §18 |
| **C10** | `acceptTextOnly` applies **only to failed languages**; ready languages keep audio. | PIPE-7 is per-language, but a single boolean could be read as whole-instruction downgrade. | 05 share endpoint |
| **C11** | Language switch is allowed **before completion**; after completion the profile updates but the delivery snapshot is immutable. | Preserves the snapshot rule (CREW-4) while honoring WORK-6. | 02 WORK-6, 05 B4 |

**Pre-build consistency pass — complete (2026-11-12):** C1–C11 applied to docs 02/04/05, plus supporting lines in 03 (S-10, S-12, S-13, W-01) and 04 §7. Versions bumped: 02 → 0.1.2 · 03 → 0.1.1 · 04 → 0.1.1 · 05 → 0.1.2 · 06 → 0.1.1. Traceability re-checked in §10 — no PRD IDs changed, so the mappings stand. No contradictions remain; start E0.1.

---

## 13. Risks and recovery

| Risk | Trigger | Response | Cut |
|---|---|---|---|
| Provider spike fails (voice missing, Groq quota) | End of week 1 | Use closest locale voice; Azure STT; DeepL/Azure Translator; document warning | Not a cut; adjust voice map |
| Resend domain not verified | End of week 1 | Use dev mailer for staging only; do not onboard a pilot until verified | No pilot launch |
| Pipeline misses 45s | Week 3 demo | Profile stages; cache repeated TTS; raise language concurrency to 3; if still over, cut photo and re-measure | Photo |
| Worker flow not on a real phone by end of week 4 | Friday demo | Stop feature work; fix audio/identity/tap targets; cut photo/QR immediately | Photo, QR |
| Board polling overloads M0 | Week 5 | 15s only visible; limit page size; add indexes; cache summaries | None |
| Backup restore fails | Week 6 drill | Fix before pilot; do not launch without a restore | No pilot launch |
| Native copy review finds gender problems | Week 5 | Rewrite copy; use neutral constructions; delay pilot by a week if needed | No pilot launch |
| Solo-founder illness / life | Any week | Buffer is 10h, not 2 weeks; move the pilot date; do not compress security | Move date |
| Scope creep from a prospect | Any week | Log in 03b; the deciding rule is PRD G1–G4 | Everything outside §3.1 |

**If you are behind at the end of week 4:** the pilot date moves. Do not cut security, tenant isolation, idempotency, the preview gate, or worker-language review to protect a date.

---

## 14. Pilot readiness gate

Do not onboard a paying pilot until every box is checked.

**Product**
- [ ] A first-time supervisor reaches a shared instruction in ≤9 minutes, measured in a real session.
- [ ] A worker on a real low-end Android completes the flow in ≤90 seconds, in their language, with zero observer touches.
- [ ] All MUST requirements are demoable; the cut list is documented.
- [ ] AR supervisor UI and all six worker catalogs have native review sign-off.

**Trust & security**
- [ ] The 12 security acceptance tests pass in CI.
- [ ] Cross-tenant probes cover every collection and media route.
- [ ] Share/delivery/preview tokens are scoped, hashed, and revocable; worker pages are `noindex`.
- [ ] Preview creates zero deliveries; 24h KPI counts match fixtures.

**Operations**
- [ ] HTTPS, domain, SPF/DKIM/DMARC verified; magic links land in Gmail/Outlook.
- [ ] Nightly backup + successful restore drill.
- [ ] Uptime, Sentry, and queue-depth alerts reach the founder.
- [ ] Runbook covers restart, Redis memory, provider outage, rollback.
- [ ] Rate limits and soft TTS cap are live.

**Evidence**
- [ ] PostHog dashboards show activation, response, understood, help, 9-minute, 90-second.
- [ ] A real Excel file opens with Arabic/Hindi/Urdu names intact.
- [ ] Pilot dry run completed; P0 defects closed; go/no-go recorded.
- [ ] Terms/Privacy placeholders and support channel are live.

**Commercial**
- [ ] Pilot scope and price are written down (brief hypothesis, validated in conversation).
- [ ] The customer knows this is a pilot and what feedback is expected weekly.
- [ ] A rollback/export path exists if the pilot stops.

---

## 15. Backlog maintenance

- New idea? It goes to [03b](./03b-v0.2-surfaces.md), not into a current week. The only exceptions are defects and MUST gaps.
- Every Friday, update story status and add one line: what slipped, why, and the new date.
- Re-estimate only when a story is touched; do not re-plan the whole backlog every week.
- Keep the “cut ladder” visible. A cut is a decision, not a failure.
- When a story changes a contract, update doc 05 and this document's §10 traceability in the same commit.
- At the pilot gate, freeze v0.1. New work goes to v0.1.1 or v0.2; the pilot is for learning, not for shipping requests.

---

## Appendix A — Story card template

```
#### E?.? · Title
`P? · ?h · depends: … · trace: PRD ID · Screen · Endpoint`

Story: As a …, I want …, so that …

Acceptance
- [ ] testable outcome
- [ ] error/empty/offline state
- [ ] analytics/security/copy requirement

Tasks — [api] … · [web] … · [worker] … · [test] … · [ops] …
```

## Appendix B — Estimate scale

| Size | Hours | Meaning |
|---|---:|---|
| XS | 1 | Config, copy, a small endpoint |
| S | 2–3 | One screen or one route with tests |
| M | 4–6 | A vertical slice with edge states |
| L | 7 | A risky slice spanning API + UI + provider |
| XL | >7 | Split it; XL stories hide unknown work |

## Appendix C — Friday demo script (reuse every week)

1. Open the deployed URL on a real phone (not localhost).
2. Walk the week's slice as a supervisor; then as a worker in Arabic or Malayalam.
3. Show one failure/edge state, not only the happy path.
4. Show the test/CI result for the slice.
5. State what slipped and what is next; record the 3-minute video.

## Appendix D — Required fixtures

- 150-row CSV: Arabic/Hindi/Urdu/Malayalam/Bengali names, 3 invalid language rows, 2 duplicate names, BOM.
- 30-second voice note in each source language; 4-language audience; one TTS failure.
- Worker phones: one low-end Android (Chrome), one iPhone (Safari), one 320px viewport.
- One archived instruction, one revoked link, one partial-failure instruction.
- Arabic names with bidi-sensitive numbers/links for export tests.

---

**Next document:** 07 — Test Plan: the test pyramid, fixtures, device matrix, security/accessibility/performance gates, and the pilot acceptance script derived from this backlog.
