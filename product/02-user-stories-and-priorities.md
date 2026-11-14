# 02 — User Stories and Priorities

**Version:** 1.0 · **Date:** 2026-11-13 · **Owner:** Founder
**Status:** Locked for build — conditional on Phase 1 field evidence
**Sources:** [PRD v0.1.2](../docs/02-prd.md) · [backlog v0.1.1](../docs/06-development-backlog.md) · [product definition](./01-product-definition.md)
**Rule:** this document maps and prioritizes. The backlog owns story-level acceptance criteria; the PRD owns required behavior. If a story here and a story there disagree, the backlog wins for detail and this document wins for release scope.

---

## 1. How to use this map

- **57 committed stories** (P0 and P1) ship in v0.1. **5 stretch stories** (P2) wait for the pilot gate.
- A story is identified by its backlog ID (`E3.3`). The PRD trace shows why it exists.
- **P0** = pilot-blocking or on the critical path. **P1** = committed, first cut if the clock slips. **P2** = after the pilot gate.
- Priorities are not a ranking of importance; they are a **release contract**. Everything in v0.1 matters, or it would not be in v0.1.
- A new story requires a written amendment in [04-decision-register.md](./04-decision-register.md) and a trade against something already committed.

---

## 2. Story map backbone

```
SUPERVISOR   Sign in → Set up roster → Compose → Generate → Preview → Share → Watch → Chase → Prove → Administer
WORKER       Open link → Identify → Understand → Check → Confirm or Help → Return
FOUNDER      Build & deploy → Operate → Validate → Launch
```

The supervisor path is the product. The worker path is the promise. The founder path exists only to make the first two repeatable.

### Personas used in the stories

| Code | Persona | Primary outcome |
|---|---|---|
| **S** | Supervisor / owner (champion) | Says it once, sees who got it, exports proof |
| **W** | Frontline worker (end user) | Understands in their language and can ask for help |
| **F** | Founder / operator | Builds, deploys, validates, and supports without a team |
| **Sys** | System / pipeline | Reliable, observable, tenant-safe behavior |

**Buyer and auditor stories are intentionally absent:** neither has a login in v0.1. The buyer's job is served by the supervisor's board (E7) and export (E8.1/E8.2), plus the weekly pilot report. The auditor receives the CSV. A buyer portal is a v0.2 surface, not a v0.1 story.

---

## 3. Access, roster, and foundation (13 stories, 47h)

| ID | Story | Pri | Release | PRD trace | Depends |
|---|---|---|---|---|---|
| E0.3 | Deployed walking skeleton on day 2 (HTTPS, `/healthz`, worker placeholder) | P0 | v0.1 | NFR availability | E0.1 |
| E1.1 | Sign in with an email link; no password; friendly expired/reused pages | P0 | v0.1 | AUTH-1, AUTH-5 | E0.3 |
| E1.2 | Org created on first sign-in; edit name/timezone/language | P0 | v0.1 | AUTH-2, SET-1 | E1.1 |
| E1.3 | Full EN/AR shell with true RTL; Arabic auto-suggest; design system | P0 | v0.1 | AUTH-3, AUTH-4 | E0.1 |
| E1.4 | Four-step first-run checklist that persists; shows the 9-minute promise | P0 | v0.1 | AUTH-2, ACT-2 | E1.2, E2.1 |
| E2.1 | Create, rename, archive crews; history preserved | P0 | v0.1 | CREW-1, CREW-7 | E1.2 |
| E2.2 | Add/edit workers with a required language; archive; 1,000 cap | P0 | v0.1 | CREW-2, CREW-4, CREW-5, CREW-7 | E2.1 |
| E2.3 | Import a 150-row CSV, see per-row errors, fix and re-upload | P0 | v0.1 | CREW-3 | E2.2 |
| E2.4 | Duplicate names stay distinguishable without exposing phones | P0 | v0.1 | WORK-1, WORK-2 | E2.2 |
| E0.1 | One workspace, shared contracts, green CI | P0 | v0.1 | NFR maintainability | — |
| E0.2 | Local stack, provider mocks, seed data | P0 | v0.1 | NFR testability | E0.1 |
| E0.4 | Runtime seams: `PROCESS_ROLE`, flags, entitlements stub, timezone helpers | P0 | v0.1 | TDD §16 | E0.1 |
| E0.5 | Provider spike: six voices, quotas, email domain verified | P0 | v0.1 | TDD §19 | — |

**Why this slice first:** without a deployed, secure shell and a real roster, every later demo is a mock. The roster is also where the language mix becomes real.

---

## 4. Supervisor — compose (5 stories, 19h)

| ID | Story | Pri | Release | PRD trace | Depends |
|---|---|---|---|---|---|
| E3.1 | Draft survives refresh; duplicate a past instruction | P0 | v0.1 | COMP-5 | E2.1 |
| E3.2 | Type/paste an instruction; mark Task or Info; confirm source language | P0 | v0.1 | COMP-1, COMP-6, COMP-7 | E3.1 |
| E3.3 | Record in-browser, re-record, see transcript, confirm language | P0 | v0.1 | COMP-2, PIPE-1 | E3.1, E4.1 |
| E3.4 | Attach one photo with a required caption | P0 | v0.1 | COMP-3 | E3.1 |
| E3.5 | Pick a crew or subset; see every language that will be generated | P0 | v0.1 | COMP-1, COMP-4, D6 | E2.2 |

**Product rule:** voice is the default action, not a secondary tab. The transcript is shown for confirmation before Generate (C1). A photo never travels without a caption (C2).

---

## 5. Supervisor — generate and preview (8 stories, 36h)

| ID | Story | Pri | Release | PRD trace | Depends |
|---|---|---|---|---|---|
| E4.1 | Provider-agnostic STT/translate/question/TTS adapters | P0 | v0.1 | PIPE-1, PIPE-2, PIPE-4 | E0.5, E0.2 |
| E4.2 | Pipeline orchestration: per-stage status, idempotency, retries, per-language isolation | P0 | v0.1 | PIPE-5, PIPE-8 | E4.1 |
| E4.3 | Faithful translation + exactly one fair 3-option question per language | P0 | v0.1 | PIPE-2, PIPE-3 | E4.1 |
| E4.4 | Neural TTS per language; org-scoped cache; signed audio access | P0 | v0.1 | PIPE-4, PIPE-7 | E4.1, E4.3 |
| E4.5 | Usage and cost ledger per stage | P0 | v0.1 | PIPE-8, SET-3 | E4.2 |
| E4.6 | One language fails → retry it or accept text-only with a named warning | P0 | v0.1 | PIPE-5, PIPE-7 | E4.2, E5.1 |
| E5.1 | Preview every language: text, audio, question, side-by-side source | P0 | v0.1 | PIPE-6, D2 | E4.3, E4.4 |
| E5.2 | Edit one language; only that TTS and question regenerate; Share disabled until ready | P0 | v0.1 | PIPE-6, J4 | E5.1 |

**The trust moment:** this slice is why the product exists. If preview is not fast and editable, the supervisor shares blind — and the promise dies at the first mistranslation.

---

## 6. Supervisor and worker — share and the loop (12 stories, 37h)

| ID | Story | Pri | Release | PRD trace | Depends |
|---|---|---|---|---|---|
| E5.3 | One 128-bit share link; deliveries created with a language + variant snapshot | P0 | v0.1 | SHARE-1, SHARE-3, D1 | E5.2 |
| E5.4 | Copy a prefilled WhatsApp message; on-screen QR; preview mode | P0 | v0.1 | SHARE-2, D2 | E5.3 |
| E5.5 | Regenerate or archive a link; old/closed links show a polite closed screen | P0 | v0.1 | SHARE-1, SHARE-4, B14 | E5.3 |
| E6.1 | Public link, name picker, remembered worker, "Not you?" / "My name isn't here" | P0 | v0.1 | WORK-1, WORK-2, D1 | E5.3 |
| E6.2 | Worker hears/reads the instruction in their language; one tap-to-play; photo | P0 | v0.1 | WORK-3, WORK-10, D16 | E6.1 |
| E6.3 | One question, three full-width options, instant feedback, two attempts max | P0 | v0.1 | WORK-4, J3 | E6.2 |
| E6.4 | Done / Got it only after answering; reopening preserves state | P0 | v0.1 | WORK-4, WORK-7, COMP-6 | E6.3 |
| E6.5 | I need help in one tap; four reasons; supervisor notified | P0 | v0.1 | WORK-5, NOTIF-1 | E6.1 |
| E6.6 | Switch language before completion; profile updates after confirmation | P0 | v0.1 | WORK-6, CREW-4, B4 | E6.2 |
| E6.7 | Closed, not-found, preview, offline, and audio-failure pages | P0 | v0.1 | WORK-7, SHARE-4, PIPE-7 | E6.1 |
| E6.8 | PWA shell + audio cache; second open works on a weak connection | P1 | v0.1 | WORK-8 | E6.2 |
| E6.9 | Six worker-language catalogs, disclaimer, native-review prep | P0 | v0.1 | WORK-10, WORK-11, PRD §12 | E6.2 |

**Worker acceptance is device acceptance.** Every story in this slice is demoed on a real low-end Android at 320px, not an emulator. E6.8 is the only committed story that may be cut if week 4 slips; the worker remains a normal web page.

---

## 7. Supervisor — watch, chase, prove, administer (10 stories, 34h)

| ID | Story | Pri | Release | PRD trace | Depends |
|---|---|---|---|---|---|
| E7.1 | Home list: recent instructions, counts, understood %, one "New instruction" action | P0 | v0.1 | BOARD-1, BOARD-6 | E5.3 |
| E7.2 | Per-worker board with status, first-attempt result, help badge, filters, 15s polling | P0 | v0.1 | BOARD-2, BOARD-5 | E6.3, E6.4 |
| E7.3 | Exception queue: needs help first, then not opened >2h, then wrong first attempt; resolve | P0 | v0.1 | BOARD-3, J3 | E7.2 |
| E7.4 | Copy link/reminder, worker preview, regenerate, archive, export from the board | P0 | v0.1 | BOARD-4, D20 | E5.5, E7.2 |
| E7.5 | Batched help email: ≤1 per 10 minutes, never lost | P0 | v0.1 | NOTIF-1, NOTIF-3 | E6.5 |
| E8.1 | Excel-safe CSV engine: BOM, ISO-8601 UTC, display timezone, formula-injection escaping | P0 | v0.1 | AUDIT-1, AUDIT-2, B7 | E5.3 |
| E8.2 | Export one instruction or an org-wide date range, one row per worker per instruction | P0 | v0.1 | AUDIT-1, AUDIT-4 | E8.1, E7.2 |
| E8.3 | Settings: org profile, support link, legal placeholders | P0 | v0.1 | SET-1, SET-4, SET-5 | E1.2 |
| E8.4 | Usage meter and soft warning at 150 TTS minutes | P0 | v0.1 | SET-3 | E4.5 |
| E8.5 | Export all data; delete org with typed + email confirmation; hard delete ≤7 days | P0 | v0.1 | SET-2, B8 | E8.1 |

**The board is the product.** E7 is not reporting; it is the supervisor's daily five-minute loop. E8 is the buyer's artifact. Neither is "phase two polish."

---

## 8. Founder — quality, operations, and pilot gate (9 stories, 31h)

| ID | Story | Pri | Release | PRD trace | Depends |
|---|---|---|---|---|---|
| E9.1 | Twelve mandatory security tests in CI | P0 | v0.1 | QO1, QO2 | E1–E8 |
| E9.2 | Accessibility, RTL, and device audit | P0 | v0.1 | QO7, NFR a11y | E6 |
| E9.3 | Performance budgets enforced | P0 | v0.1 | QO4, QO5 | E6–E8 |
| E9.4 | Playwright E2E for J1–J5 | P0 | v0.1 | QO3, J1–J5 | E9.1 |
| E9.5 | Ops readiness: backups, alerts, runbook, rollback | P0 | v0.1 | QO8, RPO ≤24h | E0.3 |
| E9.6 | Analytics verification and pilot dashboards | P0 | v0.1 | PRD §11 | E1–E8 |
| E9.7 | Worker/supervisor validation + native copy review | P0 | v0.1 | QO6, Q3 | E6, E7 |
| E9.8 | Pilot dry run | P0 | v0.1 | J1–J5, QO6 | E9.1–E9.7 |
| E9.9 | v0.2 seams audit | P0 | v0.1 | TDD §16 | E0–E8 |

**Note:** the five E0 foundation stories (17h) are listed in §3 because they are the trust foundation of release slice A. They are founder-facing work, but they are not repeated here, so every story appears exactly once across the map.

---

## 9. Stretch — after the pilot gate (5 stories, 13h)

| ID | Story | Pri | Release | PRD trace | Why it waits |
|---|---|---|---|---|---|
| E10.1 | In-product demo crew: 3 workers (hi/ar/ml), one sample instruction | P2 | v0.1.1 | ACT-1 | The operator can seed a staging org; not pilot-blocking |
| E10.2 | Offline answer/complete/help outbox with visible retry | P2 | v0.1.1 | WORK-9 | Online flow works; weak-network polish |
| E10.3 | Printable one-page QR PDF | P2 | v0.1.1 | SHARE-5 | On-screen QR covers the need |
| E10.4 | Weekly summary email | P2 | v0.1.1 | NOTIF-2 | The board answers "how are we doing?" |
| E10.5 | Bulk language edit for selected workers | P2 | v0.1.1 | CREW-6 | Manual edit is acceptable at pilot size |

**Demo strategy:** sales demos use a seeded staging org (E0.2), not E10.1. This resolves the apparent conflict between "demo crew for sales" and "E10 only after the pilot gate." The in-product demo crew remains a post-gate convenience.

---

## 10. Priority summary

| Bucket | Stories | Hours | Release | Rule |
|---|---:|---:|---|---|
| **P0** | 56 | 201 | v0.1 | Cannot ship without; on the critical path or protects the promise |
| **P1** | 1 (E6.8) | 3 | v0.1 | Committed, but first cut if the clock breaks |
| **P2** | 5 | 13 | v0.1.1 | After the pilot gate; field evidence orders them |
| **Total committed** | **57** | **204 + 10 buffer** | v0.1 | 6 weeks at ~36 focused hours/week |
| **Stretch** | 5 | 13 | v0.1.1 | Only after §14 pilot gate is green |

### Release slices

| Slice | Stories | Hours | What it proves |
|---|---:|---:|---|
| A — Trust foundation | 13 | 47 | Deployed, secure, bilingual shell with a real roster |
| B — Instruction in | 13 | 55 | A supervisor can create and trust a multilingual instruction |
| C — Loop out | 12 | 37 | A worker on a real phone understands and confirms |
| D — Proof | 10 | 34 | The supervisor can chase and export unaided |
| E — Pilot gate | 9 | 31 | The system is safe enough to put a paying crew on |
| **Total** | **57** | **204** | |

### Critical path

```
E0.3 deploy → E1.1 auth → E2.2 workers → E3.3 voice → E4.1 adapters
  → E4.2 pipeline → E5.3 share → E6.3 question → E7.2 board → E9.4 e2e
```

Any delay on this chain moves the pilot. Everything else fills gaps while provider calls or native review are in flight.

---

## 11. Requirement coverage audit

Every PRD requirement is accounted for. No orphan requirements; no unrequested feature story.

| Class | Count | Mapping |
|---|---:|---|
| PRD requirements | 64 | 54 MUST + 10 SHOULD |
| MUST traced to committed stories | 54 | E1–E8; verified against [backlog §10.1](../docs/06-development-backlog.md) |
| SHOULD committed to v0.1 | 4 | **AUTH-4** (E1.3), **WORK-8** (E6.8), **AUDIT-4** (E8.2), **ACT-2** (E1.4) |
| SHOULD post-gate (v0.1.1) | 5 | **CREW-6** (E10.5), **SHARE-5** (E10.3), **WORK-9** (E10.2), **NOTIF-2** (E10.4), **ACT-1** (E10.1) |
| SHOULD deferred to v0.2 | 1 | **PIPE-9** cross-org cache (decision D9) |
| **Total** | **64** | 54 + 4 + 5 + 1 |

**Engineering enablers:** E0 and E9 do not trace to a single feature ID. They trace to NFRs, quality objectives QO1–QO10, and the pilot gate. They are not optional; a green feature demo on an unsafe or unmonitored system is not a release.

**LABEL NOTE — ACT-2:** labeled SHOULD in the PRD but committed inside P0 story E1.4. The label reflects implementation cost, not release commitment. Same for AUTH-4 and AUDIT-4, which are bundled into P0 stories at near-zero marginal cost.

---

## 12. Cut ladder

If the clock slips, cut in this order and write the decision down. **Never cut silently.**

1. Weekly digest (E10.4 — not started).
2. Demo crew (E10.1 — not started).
3. Printable QR PDF (E10.3 — on-screen QR remains).
4. Bulk language edit (E10.5 — manual edit remains).
5. Offline answer outbox (E10.2 — online flow remains).
6. **PWA audio cache (E6.8 — the first committed cut; worker remains a normal web page).**
7. Photo input (E3.4 — requires an explicit scope decision; voice + text still cover the loop).

**Never cut:** magic-link auth · crew/worker core · voice/text composer · pipeline · preview gate · share tokens · worker question/Done/Help · board · CSV export · tenant isolation · idempotency · rate limits · Arabic supervisor UI · worker-language copy review.

**If photo is cut:** update [01-product-definition.md](./01-product-definition.md), [03-acceptance-criteria.md](./03-acceptance-criteria.md), PRD COMP-3, and the backlog estimate in the same day. A cut that is not written down becomes an argument later.

---

## 13. Priority and scope change control

| Event | Allowed? | Process |
|---|---|---|
| Competitor ships a feature | **No** | Note it in the v0.2 list; do not react in v0.1 |
| A signed pilot says a missing feature blocks them | **Yes, with a trade** | Log the request, name what slips, get the pilot's written acceptance of the trade, amend the register, bump versions |
| A legal, privacy, or safety issue | **Yes, immediate** | Fix first, document after; if it changes behavior, amend the PRD |
| A provider dies or a free tier changes | **Yes, with a fallback** | Adapter swap; update the provider spike report and cost model |
| Founder has a new idea | **No during a slice** | Write it in the v0.2 list; revisit after the pilot gate |
| A story estimate is wrong | **Yes** | Re-estimate, show the calendar impact, move the pilot date or cut in ladder order |

**The only valid reasons to add scope:** pilot-blocking evidence, legal/safety, or a cost overrun that threatens the $0/$40 budget. Everything else is v0.2.

---

**Next:** [03-acceptance-criteria.md](./03-acceptance-criteria.md) — the release-gating criteria that decide when these stories are actually done.
