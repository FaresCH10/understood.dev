# 04 — Decision Register

**Version:** 1.0 · **Date:** 2026-11-13 · **Owner:** Founder
**Status:** Locked decisions for v0.1; open questions owned and dated
**Purpose:** one place to see what is decided, what is provisional, what is still open, and how a change is approved.
**Sources:** [PRD §14–15](../docs/02-prd.md) · [backlog §12](../docs/06-development-backlog.md) · [wireframes §11](../docs/03-user-flows-wireframes.md) · [validation plan](../validation/01-validation-plan.md)

---

## 1. Status vocabulary

| Status | Meaning | Who can change it |
|---|---|---|
| **Locked** | Decided; changing it requires a written amendment (§7) | Founder |
| **Locked-provisional** | Decided for v0.1, expected to change with evidence; default stands until then | Founder with evidence note |
| **Evidence-pending** | Behavior defined by a default; Phase 1 or pilot data decides | Founder after evidence review |
| **Deferred** | Explicitly not in v0.1; recorded so it is not reinvented | Founder at a release gate |
| **Open** | No decision yet; a default may exist, but it must be resolved by its date | Founder |

---

## 2. Product decisions (PRD D1–D10)

All are **Locked** for v0.1. "Provisional" notes identify the part that evidence can move without reversing the decision.

| # | Decision | Status | Why | What evidence could change |
|---|---|---|---|---|
| **D1** | One crew link + name picker, not per-worker links | Locked | 40 personal links cannot be pasted into a WhatsApp group; the group is the channel | Q1 may replace the *picker mechanism* (numbered links/crew PIN) but not the one-link decision |
| **D2** | Preview is mandatory before share | Locked | The trust problem is translation; no auto-send | Nothing in v0.1. This is a principle (P4) |
| **D3** | Language snapshot per delivery | Locked | Audit integrity: history must not change when rosters do | Nothing. WORK-6 defines the only pre-completion switch, audited |
| **D4** | Polling every 15s; no websockets | Locked | Zero-cost, simple, sufficient for supervisor pacing | A pilot-blocking freshness complaint could justify SSE, not websockets |
| **D5** | One owner login in v0.1 | Locked | One-site pilot = one supervisor; seats are v0.2 | A signed pilot that requires a second supervisor can add seats as a paid exception (A10) |
| **D6** | Generate all audience languages; no exclusions | Locked | A worker without their language is a stranded worker (P5) | The enabled language set may narrow (A3), never per-audience exclusion |
| **D7** | Task vs Info types only; no "Safety" type | Locked | Avoid implying certified safety training; the disclaimer covers positioning | Legal review only |
| **D8** | Understood = first-attempt correct + Done within 24h | Locked | One teachable, audit-relevant definition; the brand metric | Nothing. It is measured, not negotiated |
| **D9** | Org-scoped audio cache only | Locked | Cross-org caching of customer content has unclear privacy posture | Revisit only with explicit customer consent in v0.2 |
| **D10** | Text-only fallback for failed TTS languages | Locked | Never block delivery; warn, name affected workers, keep going | Nothing; `acceptTextOnly` is per failed language (C10) |

---

## 3. Build decisions (C1–C11)

All are **Locked** and already folded into docs 02–06. Full rationale and affected sections: [backlog §12](../docs/06-development-backlog.md).

| # | Decision | Consequence |
|---|---|---|
| C1 | Transcription runs on voice upload, before Generate | Composer shows transcript + detected language; Generate requires confirmation |
| C2 | Photo requires caption text | No OCR, no photo-only instruction |
| C3 | Attempts cap is 2 total | Second wrong answer auto-flags help; no third guess |
| C4 | "Not you?" preserves audit timestamps | Wrongly opened delivery stays `opened`; correct worker uses their own |
| C5 | Variant edit returns the instruction to `processing` | Share disabled until every variant is ready; no stale audio |
| C6 | Archived workers dropped at share | `archivedDropped` count; no delivery for an archived worker |
| C7 | Collision-only full last names, then numeric suffix | No phones on worker screens; privacy preserved |
| C8 | Deploy the walking skeleton on day 2 | Deployment, TLS, DNS, and email proven before feature pressure |
| C9 | PWA shell + audio cache committed; offline outbox stretch | E6.8 P1; E10.2 P2 |
| C10 | `acceptTextOnly` applies only to failed languages | Ready languages keep audio |
| C11 | Language switch before completion; after completion profile-only | Delivery snapshot immutable after completion |

**Wireframe decisions used as acceptance inputs:** D16 tap-to-play only (never autoplay); D20 reminder copies a message instead of sending it. Canonical log: [doc 03 §11](../docs/03-user-flows-wireframes.md).

---

## 4. Phase 2 reconciliation decisions

These resolve interpretive gaps between the PRD, backlog, and Phase 1 findings. They do not change any requirement ID.

| # | Decision | Status | Rationale |
|---|---|---|---|
| **P2-1** | Phase 2 proceeds on documented assumptions while Phase 1 field evidence is pending | Locked by founder instruction | The founder explicitly asked to start Phase 2. The build authorization stays conditional; [01 §8](./01-product-definition.md) lists every assumption and its response |
| **P2-2** | v0.1 = 57 committed stories: 54 MUST + 4 committed SHOULDs (AUTH-4, WORK-8, AUDIT-4, ACT-2); 5 SHOULDs post-gate; PIPE-9 deferred | Locked | Reconciles the PRD's "SHOULD if the clock allows" with the backlog's E10-after-gate rule. The 4 committed SHOULDs are bundled into P0 work or protect the core promise |
| **P2-3** | Three metric tiers: concierge 60%, pilot 70% response / 60% understood, commercial conversion | Locked | Phase 1 is an early signal; the pilot is the product bar. They are not the same gate |
| **P2-4** | Sales demos use a seeded staging org; the in-product demo crew (ACT-1) stays post-gate | Locked | Resolves the apparent conflict between demos needed for sales and E10 being post-gate. E0.2 already seeds a demo org |
| **P2-5** | Authority order: behavior → PRD/doc 05; scope/priority → product definition; story detail → backlog | Locked | Prevents two documents from claiming the same decision |
| **P2-6** | Scope additions require a trade and a written amendment; competitor features are not a trigger | Locked | Protects the 6-week build and the $0 budget from reactive scope creep |
| **P2-7** | The pilot is one owner, one site, multiple crews allowed | Locked | One account can manage multiple crews; seats and permissions remain v0.2. A signed pilot needing a second supervisor is an exception under D5/A10 |

---

## 5. Open questions

| # | Question | Default until resolved | How it resolves | Deadline | If the answer is "no" |
|---|---|---|---|---|---|
| **Q1** | Will supervisors accept the name-picking model, or does it feel unserious? | One link + name picker | Observe first 3 concierge shares; ask the supervisor to forward without help | End of concierge test | Test numbered per-worker links or a crew PIN; one-link decision stays |
| **Q2** | Which Arabic TTS locale sounds natural to FM crews: ar-AE or MSA? | ar-AE candidate; MSA fallback | 5-worker listening test on real phones | Hardening (before pilot) | Switch voice map; no code change |
| **Q3** | Neutral "Done / I understood" wording per language | "Done / تم" with native review | Native-speaker review of all six catalogs | Before pilot opens | Adjust strings; no behavior change |
| **Q4** | Is 2 hours the right "not opened" chase threshold? | 2 hours | Pilot week 1 board data | Pilot week 2 | Change filter/reminder threshold; no schema change |
| **Q5** | Do Info instructions need Done, or is a correct answer enough? | Answer + "Got it" required | Pilot supervisor feedback | Pilot week 2 | Change Info completion semantics and copy only |
| **Q6** | What TTS minutes cap keeps the $0/$40 budget honest? | 150 minutes/org/month, soft warning | Usage data after 2 pilot weeks | Pilot week 3 | Adjust meter threshold/overage policy; no architecture change |
| **Q7** | Can a worker archived after share still open and complete their existing delivery? | **Recommended:** yes — archiving removes them from future audiences, not from an instruction already delivered. History must stay truthful | Decide before Slice C; align doc 02 edge cases, doc 05 worker guard, and tests | Before E6.1 starts | If no: the picker/API must block access and the board must still preserve the delivery record; document the audit consequence |

**Rule:** an open question is not a blocker to starting unrelated work, but it is a blocker to shipping the story it touches. Q7 must be closed before E6.1.

---

## 6. Phase 1 assumptions (H1–H10)

All are **untested as of 13 Nov 2026**. Full thresholds and consequences: [validation/01-validation-plan.md](../validation/01-validation-plan.md) and [product definition §8](./01-product-definition.md).

| # | Assumption | Gate | Type if false |
|---|---|---|---|
| H1 | Pain is real and costly | ≥7/10 concrete incident with cost | Positioning / segment |
| H2 | WhatsApp is the instruction channel | ≥8/10 primary | Scope-changing (channel) |
| H3 | Zero-install links are acceptable | ≥60% response in one concierge crew | Scope-changing (delivery) |
| H4 | Workers will answer one comprehension question | ≥60% first-attempt correct | Scope-changing (definition of understood) |
| H5 | Six languages cover the beachhead | ≥7/10 rosters 3+ languages; ≥80% coverage | Configuration + QA |
| H6 | Buyers need per-worker proof | ≥6/10 cannot produce a record; ≥5/10 asked | Positioning / pricing |
| H7 | The price is payable | ≥3 pilot proposals; 1 signed + paid by 18 Dec | Commercial, not product |
| H8 | Minimal PII is acceptable | No privacy objection blocks a pilot; ≥7/10 accept name + language | Light scope (consent/privacy) |
| H9 | Name/positioning is safe and clear | Clean check or Mafhoom | Positioning only |
| H10 | No direct substitute at our price/channel | No competitor combines the full workflow at $149–$630/month | Positioning / roadmap |

**Decision rule:** a red H1, H3, H4, or H7 reopens the scope lock. A red H2 or H5 changes the build. A red H6, H8, H9, or H10 changes the pitch, not the code. No red gate is argued with.

---

## 7. Change control

### 7.1 What qualifies as a change

| Trigger | Examples | Allowed? |
|---|---|---|
| Pilot-blocking evidence | A signed pilot cannot use the product without X | Yes, with a trade |
| Legal, privacy, or safety | A consent requirement, a forbidden claim, a data-retention rule | Yes, immediately |
| Provider or cost change | A free tier disappears; TTS price rises | Yes, with a fallback and a cost update |
| Competitor feature | A rival ships something | No — record in v0.2 |
| Founder idea | A better flow, a new surface | No during a slice — record in v0.2 |
| Estimate correction | A story is 2× harder | Yes — move the pilot or cut in ladder order |

### 7.2 Amendment format

Every change gets an ID and a written entry:

```
A-YYYYMMDD-##
Finding:        what happened, with evidence
Decision:       what changes and what does not
Affects:        doc + section (PRD / doc 05 / backlog / product / launch)
Scope impact:   stories added/removed, hours delta, calendar delta
Trade:          what slips or is cut to pay for it
Approved by:    founder            Date:
Version bumps:  PRD x.y.z · backlog x.y.z · product x.y
```

### 7.3 Version bump rules

| Change type | Bump | Must update |
|---|---|---|
| Required behavior or API contract | PRD patch/minor + doc 05 | Test plan, backlog AC, acceptance criteria |
| Scope, priority, or release slice | Product docs minor + backlog minor | Launch plan if commercial, validation plan if evidence-driven |
| Copy, visual, or design detail | Design doc only | Content deck / screenshots |
| Security or privacy behavior | PRD minor + doc 05 + test plan | Acceptance criteria + runbook |

**No silent changes.** If a decision is not in this register, it is not a decision.

### 7.4 Freeze windows

- **During Phase 3 design:** scope is frozen. Design may clarify behavior; it may not add screens or features.
- **During the last build week and hardening:** only stop-ship fixes and copy corrections.
- **During each pilot week:** no behavior changes except stop-ship fixes; log everything for the weekly review.
- **After the pilot gate:** E10 items are ordered by evidence, not by enthusiasm.

---

## 8. Decision log template

Copy this for each new decision. Keep it in this file; do not create a separate log.

| Field | Entry |
|---|---|
| ID | D-### or A-YYYYMMDD-## |
| Date | |
| Decision | |
| Status | Locked / Locked-provisional / Evidence-pending / Deferred / Open |
| Context | |
| Options considered | |
| Why this option | |
| What it forbids | |
| Affected docs | |
| Review date | |

---

## 9. Review cadence

| When | What is reviewed | Output |
|---|---|---|
| Before Phase 3 starts | This register, scope lock, story map | Design constraints confirmed |
| Every Friday during build | New decisions, slipped stories, cut-ladder use | Updated register + backlog statuses |
| After each Phase 1 interview batch | H1–H10 status | Evidence notes; scope triggers |
| After each pilot week | Q1–Q7 data, help rate, understood rate | Decision updates for the next week |
| At the pilot gate | Full register + acceptance criteria | Go / conditional / stop decision |

---

**Phase 2 closes when this register, the [scope lock](./01-product-definition.md), the [story map](./02-user-stories-and-priorities.md), and the [acceptance criteria](./03-acceptance-criteria.md) agree.** Any disagreement is an amendment, not a footnote.
