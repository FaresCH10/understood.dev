# Phase 2 — Product Definition

**Status:** Artifacts complete · **Started:** 2026-11-13 · **Completed:** 2026-11-13
**Owner:** Founder · **Previous:** [Phase 1 validation](../validation/README.md) · **Next:** Phase 3 — UX/UI Design
**Build authorization:** Conditional — Phase 1 field evidence is still pending. See [01 §8](./01-product-definition.md).

---

## What Phase 2 is

Phase 2 turns the product idea and the existing PRD into a **locked, buildable definition**: who it is for, what ships in v0.1, every user story, every release-gating acceptance criterion, the priority order, and the decisions that are still open.

The PRD ([docs/02](../docs/02-prd.md)) already existed at v0.1.2. Phase 2 does **not** rewrite it. It reconciles it with the backlog and the Phase 1 findings, then locks the interpretation. No requirement IDs changed.

**Phase 2 answers five questions:**

1. **What exactly are we building?** → [01-product-definition.md](./01-product-definition.md)
2. **For whom, and why will they use it?** → personas, jobs, and wedge in [01](./01-product-definition.md)
3. **What are the stories, and in what order?** → [02-user-stories-and-priorities.md](./02-user-stories-and-priorities.md)
4. **How do we know it is done?** → [03-acceptance-criteria.md](./03-acceptance-criteria.md)
5. **What is decided, what is provisional, and who can change it?** → [04-decision-register.md](./04-decision-register.md)

---

## Artifacts

| File | What it contains | Status |
|---|---|---|
| [01-product-definition.md](./01-product-definition.md) | Product definition, personas, jobs, wedge, principles, scope contract, release slices, success metrics, assumptions and triggers | Complete |
| [02-user-stories-and-priorities.md](./02-user-stories-and-priorities.md) | All 57 committed stories + 5 stretch, by journey, with priority, release slice, PRD trace, coverage audit, cut ladder | Complete |
| [03-acceptance-criteria.md](./03-acceptance-criteria.md) | Five journey ACs (J1–J5), fourteen cross-cutting ACs, pilot release checklist, stop-ship conditions, test-suite traceability | Complete |
| [04-decision-register.md](./04-decision-register.md) | D1–D10, C1–C11, Phase 2 reconciliation decisions, Q1–Q7 open questions, H1–H10 assumptions, change control | Complete |

---

## The locks

| # | Lock | Consequence |
|---|---|---|
| 1 | **The loop is fixed** | Voice/text/photo → transcribe → translate + question + audio → preview → one link → worker answer/Done/Help → board + CSV. No feature is added in v0.1 unless it serves this loop |
| 2 | **v0.1 = 57 committed stories, 204h + 10h buffer** | 54 MUST + 4 committed SHOULDs; five SHOULDs post-gate; PIPE-9 deferred to v0.2. 6 weeks at ~36 focused hours/week |
| 3 | **Zero install, one link, mandatory preview, snapshot, Understood** | P1–P7 principles are not negotiable in v0.1; preview can be simplified but never removed |
| 4 | **Three metric tiers** | Concierge 60% is an early signal; pilot 70% response / 60% understood is the product bar; commercial conversion is the business gate |
| 5 | **Demos use a seeded staging org** | The in-product demo crew (ACT-1) stays post-gate; no sales dependency on E10 |
| 6 | **Scope changes require a trade and an amendment** | Competitor features, founder ideas, and "small additions" are v0.2 notes, not v0.1 changes |

---

## What Phase 2 changed

These are the only substantive reconciliations. None adds a feature or changes a requirement ID.

| Change | Why it was needed | Where it lands |
|---|---|---|
| **Priority interpretation** — 4 SHOULDs committed (AUTH-4, WORK-8, AUDIT-4, ACT-2); 5 post-gate; PIPE-9 deferred | PRD said SHOULD "if the clock allows"; backlog placed E10 after the pilot gate. The two read differently without an explicit mapping | [02 §11](./02-user-stories-and-priorities.md) |
| **Metric tiers** — 60% concierge vs 70% pilot response | Phase 1 used a lower early-signal bar; the PRD used the pilot target. They must not be quoted as the same number | [01 §7](./01-product-definition.md) |
| **Demo strategy** — seeded staging org, not in-product demo crew | The in-product demo crew was post-gate, but sales demos happen before the pilot. E0.2 already seeds a demo org | [02 §9](./02-user-stories-and-priorities.md) |
| **Authority order** — behavior → PRD/doc 05; scope/priority → product docs; story detail → backlog | Four documents were citing each other; one conflict order prevents future drift | [01 header](./01-product-definition.md), [04 §4](./04-decision-register.md) |
| **Conditional build authorization** — proceed on assumptions, reopen if a Phase 1 gate goes red | Phase 1 evidence is not yet collected; the founder asked to start Phase 2. The definition must not pretend the evidence exists | [01 §8](./01-product-definition.md) |

**Not changed:** the PRD (v0.1.2), the backlog (v0.1.1), any requirement ID, any story estimate, any API contract, or the launch plan. Phase 2 is an interpretation layer, not a rewrite.

---

## Phase 2 exit checklist

- [x] Product definition and scope lock written.
- [x] All 64 PRD requirements mapped (54 MUST + 10 SHOULD); no orphan requirements.
- [x] 57 committed stories + 5 stretch stories mapped with priority, slice, and backlog ID.
- [x] Journey acceptance criteria J1–J5 and cross-cutting criteria X1–X14 written.
- [x] Pilot release checklist and stop-ship conditions written.
- [x] Decision register complete: locked decisions, Phase 2 reconciliations, 7 open questions, 10 Phase 1 assumptions, change control.
- [ ] **Phase 1 field evidence collected** — interviews, concierge crew, signed/paid pilot. This is human work and remains open.
- [ ] **Build authorization released** — depends on the Phase 1 gate. Conditional until then.

---

## Open items that block specific work

| Item | Blocks | Deadline |
|---|---|---|
| Q7 — archived worker access after share | E6.1 name picker and worker guard | Before E6.1 starts |
| Q1 — name-picker acceptance | Share flow wording and picker design | End of concierge test |
| Q2 — Arabic TTS locale | Voice map and Arabic audio QA | Before pilot |
| Q3 — neutral Done wording | Six worker catalogs and native review | Before pilot |
| Q4 — 2-hour chase threshold | Board filter/reminder copy | Pilot week 2 |
| Q5 — Info instructions require Done | Info completion copy and status semantics | Pilot week 2 |
| Q6 — TTS minutes cap | Usage meter threshold | Pilot week 3 |
| H1, H2, H3, H4, H5, H7 | Scope lock validity | Phase 1 gate |

---

## Handoff to Phase 3 — UX/UI Design

Phase 3 starts from the existing wireframes in [03-user-flows-wireframes.md](../docs/03-user-flows-wireframes.md), constrained by the locks above.

**Phase 3 must produce:**

1. **Supervisor visual system, EN + AR RTL** — logical CSS, mirrored navigation, bidi-safe numbers/links, no direction-dependent icons.
2. **Composer and preview screens** — voice-first, transcript before Generate, per-language audio and edit, explicit not-ready states.
3. **Worker flow at 320px** — name picker, instruction + audio, question states, Done, help, language switch, closed/preview/offline pages. One action per screen; ≥48px targets; ≥16px body; no autoplay.
4. **Board and export screens** — 150-worker density, exception-first ordering, filters, resolve action, Excel-safe export dialog.
5. **State matrix** — loading, empty, error, offline, partial-failure, text-only, archived, preview. Every state has a design, not a default.
6. **Prototype** — clickable J1–J5 happy paths plus the lost path (wrong answer → help), in EN and AR.

**Design rule:** no new screen without a committed story in [02](./02-user-stories-and-priorities.md). A design idea without a story is a v0.2 note.

---

## Honest status

The product definition is complete and internally consistent. The **evidence** is not. Phase 1 still requires 10 real interviews, a two-week concierge crew, and one signed/paid pilot by 18 Dec 2026. If a Phase 1 gate goes red, the scope lock reopens at the affected assumption — it is not defended.

**No Phase 3 work has started.** The next action is the founder's choice: begin UX/UI design, or collect the Phase 1 evidence first.
