# 03 — Release-Gating Acceptance Criteria

**Version:** 1.0 · **Date:** 2026-11-13 · **Owner:** Founder
**Status:** Locked for build — conditional on Phase 1 field evidence
**Authority:** [Test plan v0.1](../docs/07-test-plan.md) is authoritative for test execution; [Database/API v0.1.2](../docs/05-database-api-spec.md) is authoritative for contracts; this document defines the product-level pass/fail for a v0.1 release. Story-level criteria live in [backlog v0.1.1](../docs/06-development-backlog.md).
**Rule:** a story is done when its backlog criteria pass. **v0.1 is done only when every criterion in §2, §3, and §4 passes.** A green demo is not a release.

---

## 1. How to read this document

- **§2 Journey criteria** are the five end-to-end promises. They are tested on staging and on real devices, not just in unit tests.
- **§3 Cross-cutting criteria** are the invariants that apply to every story. They are the ones most likely to be broken by a "small" change.
- **§4 Release acceptance** is the pilot gate: the checklist that decides whether a paying crew may use the product.
- **§5 Stop-ship conditions** override any schedule. One open item stops the release.
- Each criterion is written as Given / When / Then. The test suite reference in §6 is where the automation lives.

---

## 2. Journey acceptance criteria

### AC-J1 — First instruction in ≤9 minutes

**Given** a new supervisor with an empty account and a 20-row crew CSV containing Arabic, Hindi, Urdu, and Malayalam names,
**When** they sign in by email magic link, create a crew, import the CSV, record a 30-second voice note, confirm the transcript and source language, select the crew, generate, preview every language, and copy the share link,
**Then** the elapsed time from first sign-in to a shared instruction is ≤9 minutes, the instruction is `shared`, exactly one delivery exists per active worker, each delivery snapshots the worker's language and a ready variant, and the board shows the targeted count.

**Negative:** a CSV with 3 invalid language values shows exactly 3 row errors, blocks commit, and creates no workers. The supervisor can fix and re-upload in the same session.

**Also:** every language represented in the audience appears as a preview variant; no language is silently skipped.

---

### AC-J2 — Worker happy path in ≤90 seconds

**Given** a shared instruction with four language variants and audio,
**When** a worker on a low-end Chrome Android phone at 320px, on emulated 3G, opens the link, selects their name, plays the audio, answers the question correctly on the first attempt, and taps Done,
**Then** the text is visible before audio plays, audio is playable within 4 seconds of the tap, the question and controls are in the worker's language at ≥16px body and ≥48px targets, the board shows the delivery as completed within 15 seconds, and the delivery records opened/answered/completed timestamps with `first_attempt_correct = true`.

**Reopen:** opening the link again shows the completed state, preserves the original timestamps, and never increments the counts or creates a second delivery.

**No autoplay:** audio starts only after an explicit tap. A blocked-autoplay browser never leaves the worker without text or a play control.

---

### AC-J3 — Worker lost path

**Given** a worker has identified themselves on a shared instruction,
**When** they answer incorrectly, then incorrectly again,
**Then** after the first wrong answer the correct option is highlighted, the audio can replay, and one retry is offered; after the second wrong answer the delivery is flagged `needs_help` with reason "Don't understand," no third attempt is accepted, the supervisor sees a pinned exception on the board, and a batched help email arrives within 10 minutes.

**Alternative:** tapping **I need help** at any point after name selection opens the four reasons (Don't understand / Missing tools or materials / Safety concern / Other), confirms "Your supervisor has been notified," and creates the same board flag. No free-text explanation is required in v0.1.

**No dead end:** the page never tells the worker to "try again later" without a human escalation path.

---

### AC-J4 — Supervisor fixes one language

**Given** a `ready` instruction with Arabic, Hindi, Urdu, and Malayalam variants,
**When** the supervisor edits only the Malayalam text and saves,
**Then** only the Malayalam TTS and comprehension question regenerate; the other three variants are unchanged; the instruction returns to `processing`; Share is disabled until all four variants are ready again; and preview shows the edited Malayalam text with playable audio.

**After share:** editing a shared instruction is unavailable. "Duplicate" creates a new draft. No old share token can reach stale audio or a superseded variant.

---

### AC-J5 — Audit export in 20 seconds

**Given** a shared instruction targeted at 24 workers across four languages, with at least one worker profile changed after share and one help request resolved,
**When** the supervisor exports the instruction CSV and an org-wide date-range CSV, and opens both in Excel,
**Then** both files open without repair, Arabic names are intact (UTF-8 BOM), timestamps are ISO-8601 UTC plus an org-timezone display column, every AUDIT-1 column is present, one row exists per worker per instruction, the language column reflects the delivery snapshot (not the live worker profile), and help reason plus resolution are populated.

**Injection safety:** a name or note beginning with `=`, `+`, `-`, or `@` is escaped so it cannot execute as a spreadsheet formula.

**Scope:** the org-wide export covers the selected date range and includes deliveries from archived instructions.

---

## 3. Cross-cutting acceptance criteria

### AC-X1 — Tenant isolation

**Given** two organizations, A and B, and a valid session for A,
**When** A requests any B-owned crew, worker, instruction, variant, delivery, export, or import identifier,
**Then** the API returns a uniform not-found/forbidden response with no B data, counts, or existence leak, and every query is scoped by `orgId` from the session — never from the URL or body.

**Token scope:** a worker token for instruction A cannot read instruction B's content or deliveries. A cross-tenant finding is an automatic stop-ship (§5).

---

### AC-X2 — Share link lifecycle

**Given** a shared instruction,
**When** the supervisor regenerates the link, archives the instruction, or the token is invalid, expired, or evicted,
**Then** the old link shows a polite closed screen with the organization name, no data entry, and no indication of other instructions; the new link works; preview tokens are visibly watermarked "Preview" and record nothing.

**Anti-enumeration:** invalid tokens return uniform responses and are rate-limited. A 128-bit share token is never guessable or sequential.

---

### AC-X3 — Language snapshot and switch

**Given** a delivery created at share with language L,
**When** the worker explicitly switches language before completion,
**Then** the delivery points to the chosen language variant, the change is appended to `languageChangeHistory`, and the board and export reflect the delivery's current language.

**When** the worker completes,
**Then** no later profile change or language switch alters that delivery. Future instructions use the updated profile. Exports never read the live worker profile for historical language.

---

### AC-X4 — Preview gate and stale variants

**Given** an instruction in `draft`, `processing`, or `partial_failure` without accepted text-only,
**When** any client calls the share endpoint or the UI attempts to share,
**Then** the request is rejected with the typed not-ready error, no share token or delivery is created, and the Share control is disabled.

**Given** a variant edit on a `ready` instruction,
**Then** it returns to `processing`, and Share stays disabled until every variant is ready again.

**Given** a preview link,
**Then** the page is watermarked, no delivery exists, and no worker action is recorded.

---

### AC-X5 — Language coverage and fallback

**Given** an audience whose active workers speak N distinct enabled languages,
**When** Generate runs,
**Then** exactly N variants are produced, every delivery points to a variant in the worker's snapshot language, and no language is silently excluded.

**Given** a language fails after retries,
**Then** the instruction is `partial_failure`; the supervisor can retry that language or share with `acceptTextOnly` for that language only, after a warning that names the affected workers; ready languages keep their audio.

**Given** TTS is unavailable,
**Then** the worker sees text plus a clear audio-unavailable state, never a dead end or a play button that silently fails.

---

### AC-X6 — Idempotency

**Given** a worker has one delivery,
**When** the same answer, complete, or help request is retried, or two tabs/devices submit,
**Then** the first attempt and first completion timestamps win, no duplicate delivery or count is created, and reopening shows the persisted state.

**Given** repeated share, regenerate, or archive calls,
**Then** the operation is idempotent or returns a typed conflict; deliveries are never duplicated.

---

### AC-X7 — Names and privacy

**Given** a crew with duplicate names,
**When** the worker picker renders,
**Then** workers show first name + last initial; only colliding workers show full last names, then a stable numeric suffix; no phone number ever appears; and the worker-facing API exposes no phone or full surname outside the collision fallback.

**Given** a person not on the roster,
**Then** "My name isn't here" explains to ask the supervisor; there is no enrollment, no data capture, and no roster enumeration.

---

### AC-X8 — Roster changes around share

**Given** a worker is archived after Generate but before Share,
**When** the supervisor shares,
**Then** the worker is dropped from the delivery set, `archivedDropped` reports the count, and no delivery is created for them.

**Given** a worker is archived after Share,
**Then** history is preserved. Access to the already-shared delivery follows the decision recorded in [04-decision-register.md](./04-decision-register.md) (Q7); implementation must match that decision before release.

---

### AC-X9 — CSV integrity

**Given** a 150-row CSV with BOM, CRLF, Arabic/Hindi/Urdu/Malayalam/Bengali names, quoted commas, and 3 invalid language values,
**When** imported,
**Then** exactly 3 row errors are shown, commit is blocked and nothing is created; after fixing, the same file commits all 150; duplicate names warn but never block; the 1,000-worker cap is enforced.

**Given** an export,
**Then** it is UTF-8 with BOM, timestamps are ISO-8601 UTC plus the display timezone, and formula-leading cells are escaped.

---

### AC-X10 — RTL, localization, accessibility

**Given** the supervisor UI in Arabic,
**Then** the shell mirrors (navigation, forms, tables, composer, preview), numbers and links are bidi-isolated, and no text clips at supported widths.

**Given** a worker screen,
**Then** all strings are in the six catalogs in native script, no raw keys are visible, the disclaimer is present, and every icon has a label.

**And:** axe reports zero critical or serious violations on worker core screens; targets are ≥48px; body text is ≥16px; contrast meets WCAG 2.1 AA; no state is conveyed by color alone; audio never autoplays.

---

### AC-X11 — Performance and resilience

**Given** a 30-second voice note and four languages,
**Then** preview is ready in ≤45 seconds p95, pipeline success is ≥98% over 50 staging runs, and cost is <$0.05 per instruction.

**Given** a worker on emulated 3G at 320px,
**Then** first paint is <2 seconds, audio is playable <4 seconds after tap, and the median complete flow is ≤90 seconds.

**Given** an audio request fails or the network drops,
**Then** text remains visible, buffering/failure is shown, the page shell works after first load, and audio is cached after the first successful play (PWA).

**Given** the board,
**Then** it loads in <2 seconds p95 and reflects a worker action within 15 seconds.

---

### AC-X12 — AI output integrity and safety

**Given** any instruction text or transcript,
**When** translation, question generation, and TTS run,
**Then** numbers, units, names, site names, and acronyms are preserved; output validates against the JSON schema; each question has exactly 3 options with 1 correct answer, answerable from the instruction, with no negation tricks; and audio matches the variant language and voice.

**Given** a translation returns the source unchanged,
**Then** preview flags "possibly untranslated" and warns, but does not block.

**Given** instruction content that attempts prompt injection,
**Then** the pipeline treats it as content, never as instructions; no schema escape, cross-org data access, or secret exposure occurs.

**And:** every worker string and voice passes native review before the pilot opens (Q3).

---

### AC-X13 — Notifications, analytics, and data controls

**Given** workers request help,
**Then** the owner receives a batched email at most once per 10 minutes, never lost, containing the worker, reason, instruction, and link; email is transactional only.

**Given** analytics events,
**Then** they fire with the specified properties, use pseudonymous IDs, and contain no worker PII.

**Given** the owner requests export-all or org deletion,
**Then** export includes all org data as CSV; deletion requires typed confirmation plus email confirmation and hard-deletes within 7 days; no cross-tenant data is included.

---

### AC-X14 — Board truth

**Given** a shared instruction,
**Then** the board's counts (targeted, opened, answered, completed, understood %, help) reconcile exactly with the delivery records and the export; the Understood % tooltip defines the metric; filters all / not opened / wrong / needs help return the same rows as the corresponding export scope.

**And:** "Mark resolved" records the resolver and timestamp, removes the item from the exception queue, and preserves the history.

---

## 4. Release acceptance (the pilot gate)

A v0.1 release is eligible for a paying pilot only when every box is true.

### 4.1 Build and quality

- [ ] All 57 committed stories are `done` against their backlog criteria and the global Definition of Done.
- [ ] AC-J1 through AC-J5 pass on staging and on real target devices.
- [ ] AC-X1 through AC-X14 pass.
- [ ] Test plan QO1–QO10 are met; the traceability linter reports 100% of PRD MUSTs covered (≥85% automated).
- [ ] The twelve mandatory security tests (doc 05 §11) run in CI and block production deploys.
- [ ] No open S1 or S2 defects; S3s have a documented workaround and owner.
- [ ] Backup restore succeeds in ≤60 minutes with matching counts; RPO is ≤24h.
- [ ] 10 simulated workers complete the flow unaided; 5/5 worker sessions have zero observer touches; 4/5 supervisors finish in ≤9 minutes.

### 4.2 Content and trust

- [ ] Supervisor UI is complete in English and Arabic, including RTL and error/empty states.
- [ ] Six worker-language catalogs are complete; no raw keys; native review signed off for every language.
- [ ] The worker disclaimer appears on every worker page in all six languages.
- [ ] No compliance or certification claim appears anywhere in the product or sales copy.
- [ ] Terms and Privacy placeholders exist; the data-deletion path is tested.

### 4.3 Operations

- [ ] Owned domain with TLS; SPF, DKIM, and DMARC verified; magic-link email lands in Gmail and Outlook.
- [ ] Sentry captures errors; UptimeRobot monitors `/healthz`; alert routing reaches the founder.
- [ ] Rollback to the previous image is documented and tested.
- [ ] The pilot runbook exists: onboarding, share ritual, support channel, escalation, data deletion.

### 4.4 Commercial readiness

- [ ] A signed pilot agreement and a paid invoice exist (Phase 1 gate 6).
- [ ] The pilot site, crew, supervisor, and start date are confirmed.
- [ ] Support WhatsApp deep link and mailto are live in the header.
- [ ] The pilot kickoff script and the 9-minute onboarding promise are rehearsed.

### 4.5 Pilot dry run

- [ ] One end-to-end instruction with a test crew on production-like configuration: create → generate → preview → share → worker opens on a real phone → answers → Done → board → export.
- [ ] The dry run is timed; every observer note is triaged before the first real shift.

---

## 5. Stop-ship conditions

Any one of these stops the release, regardless of schedule or pilot pressure.

| # | Condition | Why it is absolute |
|---|---|---|
| S1 | Any cross-tenant data exposure | The only severity-1 bug class; destroys trust and the business |
| S2 | Any lost, duplicated, or silently rewritten delivery/audit record | The product's reason to exist is the record |
| S3 | Sharing possible before `ready`, or stale audio reachable from a live link | The first mistranslation destroys the preview promise |
| S4 | Worker flow unusable in a supported language or on a target device | Excludes the people the product is for |
| S5 | Arabic export corrupt or unreadable in Excel | The buyer's artifact fails at the audit moment |
| S6 | Guessable/enumerable share tokens, reusable magic links, or missing auth rate limits | Unauthorized access to worker data |
| S7 | No successful backup restore | A single failure becomes a company-ending data loss |
| S8 | Any open S1 defect | The defect log is the contract |
| S9 | A safety-certification or compliance claim in UI or sales copy | Legal and ethical misrepresentation |
| S10 | Worker data used for anything beyond delivery and audit without consent | Violates the privacy promise and the pilot agreement |

**Escalation:** if a stop-ship condition appears during the pilot, pause new shares for the affected path, notify the pilot supervisor within 1 hour, fix, re-run the relevant AC, and record the incident. Do not "monitor it."

---

## 6. Traceability to test suites

| Criterion | Primary test suites | Secondary |
|---|---|---|
| AC-J1 | `T-E2E-01`, `T-AUTH`, `T-CREW`, `T-COMP`, `T-SHARE` | `T-PIPE`, `T-PERF` |
| AC-J2 | `T-E2E-02`, `T-WORK`, `T-PERF`, `T-DEVICE` | `T-PWA`, `T-A11Y` |
| AC-J3 | `T-E2E-03`, `T-WORK`, `T-BOARD`, `T-NOTIF` | `T-SEC` |
| AC-J4 | `T-PREV`, `T-PIPE` | `T-E2E-04` |
| AC-J5 | `T-E2E-05`, `T-DATA` | `T-SEC` (injection) |
| AC-X1 | `T-TEN`, `T-SEC` | `T-AUTH` |
| AC-X2 | `T-SHARE`, `T-SEC` | `T-WORK` |
| AC-X3 | `T-CREW`, `T-WORK`, `T-DATA` | `T-SHARE` |
| AC-X4 | `T-PREV`, `T-SHARE` | `T-PIPE` |
| AC-X5 | `T-PIPE`, `T-WORK` | `T-PREV` |
| AC-X6 | `T-WORK`, `T-DATA` | `T-SHARE` |
| AC-X7 | `T-WORK`, `T-CREW` | `T-A11Y` |
| AC-X8 | `T-SHARE`, `T-CREW` | `T-DATA` |
| AC-X9 | `T-CREW`, `T-DATA`, `T-SEC` | `T-E2E-01` |
| AC-X10 | `T-A11Y`, `T-I18N` | `T-DEVICE` |
| AC-X11 | `T-PERF`, `T-PIPE`, `T-PWA`, `T-RES` | `T-DEVICE` |
| AC-X12 | `T-PIPE`, `T-SEC` | `T-I18N` |
| AC-X13 | `T-BOARD`, `T-AN`, `T-DATA` | `T-SEC` |
| AC-X14 | `T-BOARD`, `T-DATA` | `T-E2E-05` |

Suite identifiers are defined in [test plan §7](../docs/07-test-plan.md).

---

## 7. Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Product owner | Founder | ☐ Approved  ☐ Blocked | |
| Engineering | Founder | ☐ Approved  ☐ Blocked | |
| Pilot readiness | Founder | ☐ Approved  ☐ Blocked | |
| Native copy review | External reviewers | ☐ All six languages signed off | |

**Evidence bundle attached:** E2E run, security suite, performance report, backup restore log, a11y report, native review notes, pilot dry-run timing, defect log.

**If any box is unchecked, the release does not happen.** The correct response to schedule pressure is to move the pilot date, not to waive a criterion.

---

**Next:** [04-decision-register.md](./04-decision-register.md) — what is locked, what is provisional, and how a change is approved.
