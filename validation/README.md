# Phase 1 — Discovery & Validation

**Status:** Ready to execute · **Started:** 2026-11-13 · **Gate:** evidence review on 15 Dec 2026
**Owner:** Founder · **Companion plan:** [01-validation-plan.md](./01-validation-plan.md)

---

## What this folder is

Phase 1 is the evidence phase. The eight planning documents in [`/docs`](../docs/) are **hypotheses with structure** — a brief, a PRD, wireframes, architecture, a backlog, a test plan, and a launch plan. This folder turns the riskiest hypotheses into real conversations, a no-code concierge test, and a decision memo.

Nothing in this folder is a substitute for talking to Gulf operations, HSE, and facilities managers. No interview has been invented. The kit is ready; the conversations are human work.

---

## Phase 1 gate (binary)

Phase 1 is **passed** only when all of the following are true:

| # | Gate | Threshold | Evidence |
|---|---|---|---|
| 1 | Pain is real | ≥7 of 10 interviewees describe a concrete miscommunication incident with a cost, delay, or rework | Interview notes + tracker |
| 2 | WhatsApp is the channel | ≥8 of 10 use WhatsApp groups/voice notes as the primary instruction channel | Interview notes |
| 3 | Workers will open a link | ≥60% response in at least one concierge crew within 24h | Concierge tracker |
| 4 | Comprehension is measurable | ≥60% first-attempt correct in the concierge test | Google Form results |
| 5 | Supervisors want it again | The concierge supervisor asks to continue after day 3 without being prompted | WhatsApp log |
| 6 | Someone will pay | 3 pilot candidates agree to a proposal; **1 signed and paid by 18 Dec 2026** | Signed pilot agreement + invoice |
| 7 | Language mix fits | ≥7 of 10 rosters have 3+ languages; the six shipped languages cover ≥80% of workers in sampled rosters | Roster samples |
| 8 | No blocking gap | No missing v0.1 capability blocks two or more pilot candidates | Interview notes |
| 9 | Name is safe | Trademark/domain check clean, or Mafhoom chosen as fallback | Name memo (4 Dec) |
| 10 | Competitor position holds | The competitor teardown does not reveal a cheaper, direct substitute for the zero-install + comprehension + audit workflow | [04-competitor-analysis.md](./04-competitor-analysis.md) |

Any red gate triggers the decision rules in [01-validation-plan.md §8](./01-validation-plan.md#8-decision-rules). Do not build through a red gate; change the hypothesis.

---

## Artifacts

| File | What it is | Status |
|---|---|---|
| [01-validation-plan.md](./01-validation-plan.md) | Hypotheses, methods, thresholds, timeline, decision rules | Complete |
| [02-interview-kit.md](./02-interview-kit.md) | Screener, 30-minute script, consent, note template, synthesis method | Complete |
| [03-outreach-templates.md](./03-outreach-templates.md) | Research-oriented LinkedIn/WhatsApp/email messages | Complete |
| [04-competitor-analysis.md](./04-competitor-analysis.md) | Sourced category map, matrix, profiles, implications | Complete (prices need re-verification before external use) |
| [05-concierge-mvp-runbook.md](./05-concierge-mvp-runbook.md) | No-code test with one real crew, including privacy and safety guardrails | Complete |
| [06-mvp-scope-validation.md](./06-mvp-scope-validation.md) | One-page scope tied to evidence; what would change the MVP | Complete |
| [07-phase-1-exit-memo.md](./07-phase-1-exit-memo.md) | The decision memo to fill on 15–18 Dec | Template |
| [interview-tracker.csv](./interview-tracker.csv) | 10 interview slots, evidence columns, synthesis fields | Template |
| [pilot-candidates.csv](./pilot-candidates.csv) | Pipeline for 15 target companies and 3 pilot candidates | Template |
| [concierge-tracker.csv](./concierge-tracker.csv) | Per-instruction response, first-attempt correctness, and help requests | Template |

---

## This week (13–19 Nov 2026)

1. Send 20 personalized LinkedIn requests from [03-outreach-templates.md](./03-outreach-templates.md); target 10 accepted conversations.
2. Book the first five interviews for 20–26 Nov; use the screener in [02-interview-kit.md](./02-interview-kit.md).
3. Recruit one friendly supervisor for the concierge MVP ([05](./05-concierge-mvp-runbook.md)); choose a **non-safety** instruction for week 1.
4. Run the name/domain check; buy the domain by 21 Nov regardless of the final name.
5. After each interview, fill one row in [interview-tracker.csv](./interview-tracker.csv) within 24 hours.

---

## What Phase 1 does not include

- No production code. The walking skeleton (E0.1) starts only after the Phase 1 gate, unless the founder explicitly decides to run it in parallel.
- No free product trials. The concierge test is manual and paid in time, not software.
- No pricing experiments on real customers. Price is tested in interviews as a reaction, not charged until the pilot.
- No fabricated evidence. A gate with 6 interviews is reported as 6, not rounded to 10.

---

## How Phase 1 feeds Phase 2

Docs 02 (PRD), 06 (backlog), and 08 (launch) already exist. Phase 1 does not rewrite them from scratch; it **reconciles** them:

- If the channel is wrong, PRD requirements and the pilot offer change.
- If the comprehension question is rejected, the worker flow and the "understood" definition change.
- If buyers demand seats before pilots, the v0.2 sequence changes.
- If the language mix is narrower, v0.1 language scope narrows.
- If the price is rejected, packaging changes before a line of billing code is written.

The exit memo lists every amendment with the doc and section to update. That is the handoff to Phase 2 sign-off.

---

**Next action:** open [03-outreach-templates.md](./03-outreach-templates.md) and send the first five messages today.
