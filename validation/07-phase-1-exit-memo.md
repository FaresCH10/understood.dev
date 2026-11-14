# Phase 1 Exit Memo — Discovery & Validation

**Version:** 0.1 (template) · **Decision window:** 15–18 Dec 2026 · **Owner:** Founder
**Status:** TEMPLATE — do not fill until the evidence exists. Empty fields are honest; invented fields are not.
**Companions:** [README.md](./README.md) · [01-validation-plan.md](./01-validation-plan.md) · [06-mvp-scope-validation.md](./06-mvp-scope-validation.md)

---

## 1. Decision requested

Choose exactly one. Phase 2 (Product Definition reconciliation and build kickoff) does not start without a written decision here.

| Option | Meaning | Consequence |
|---|---|---|
| **PASS** | All 10 gates green, or any yellow gate has a written, time-boxed mitigation | Proceed to Phase 2: reconcile PRD/backlog/launch plan, then E0.1 |
| **CONDITIONAL PASS** | No more than 2 gates yellow; no red gates; conditions have owners and dates before 15 Jan 2027 | Proceed to Phase 2 planning only; E0.1 waits for conditions |
| **REPEAT** | Any existential gate red (1, 3, 4, or 6) | Do not build. Re-test with a changed hypothesis, segment, or offer for 30–45 days |
| **STOP** | Pain, channel, or willingness to pay is absent after a genuine attempt | Archive the build plan; keep the research; do not spend the $550 pre-revenue budget |

**Decision:** ☐ PASS  ☐ CONDITIONAL PASS  ☐ REPEAT  ☐ STOP

**One-paragraph rationale (required):**

> _Write 3–5 sentences. Name the strongest evidence for and against. Do not summarize the whole folder._

---

## 2. Evidence inventory

Report actual counts. A gate with 6 interviews is reported as 6.

| Evidence | Planned | Actual | Notes / where stored |
|---|---|---|---|
| Interviews — ops / FM managers | 6 | | |
| Interviews — HSE | 2 | | |
| Interviews — owners / GMs | 2 | | |
| **Total interviews logged** | **10** | | [interview-tracker.csv](./interview-tracker.csv) |
| Roster samples collected | 10 | | Language counts per roster |
| Concierge crews run | 1–2 | | [concierge-tracker.csv](./concierge-tracker.csv) |
| Concierge instructions sent | 6 per crew | | Non-safety only |
| Pilot proposals sent | 3 | | [pilot-candidates.csv](./pilot-candidates.csv) |
| Pilot agreements signed | 1 | | Contract + invoice |
| Pilot invoices paid | 1 | | Payment date, amount, method |
| Name/domain decision | 1 | | Memo, date, registrar |
| Competitor re-checks | 1 | | [04-competitor-analysis.md](./04-competitor-analysis.md) |

**Evidence-quality statement (required):**

> _I confirm that every interview row reflects a real conversation, every concierge number comes from a real form export, and no quote or result has been invented or rounded up. Signed: ________  Date: _________

---

## 3. Gate scorecard

Thresholds are from [README.md](./README.md). Verdict: **G** green, **Y** yellow (partial/ambiguous), **R** red.

| # | Gate | Threshold | Result | Verdict | Evidence pointer |
|---|---|---|---|---|---|
| 1 | Pain is real | ≥7/10 concrete incident with cost/delay/rework | /10 | | Quotes + cost estimates |
| 2 | WhatsApp is the channel | ≥8/10 primary | /10 | | Interview field `PrimaryChannel` |
| 3 | Workers open the link | ≥60% within 24h in ≥1 crew | % | | Concierge tracker |
| 4 | Comprehension measurable | ≥60% first-attempt correct | % | | Form export |
| 5 | Supervisor wants it again | Asks to continue after day 3 unprompted | Yes / No | | WhatsApp log, date |
| 6 | Someone will pay | 3 proposals; 1 signed + paid by 18 Dec | /3, signed? | | Contract, invoice |
| 7 | Language mix fits | ≥7/10 rosters 3+ languages; six cover ≥80% | /10, % | | Roster samples |
| 8 | No blocking gap | No missing v0.1 capability blocks ≥2 candidates | Yes / No | | Objection log |
| 9 | Name is safe | Clean check or Mafhoom chosen | Yes / No | | Name memo (4 Dec) |
| 10 | Competitor position holds | No cheaper direct substitute for the full workflow | Yes / No | | [04](./04-competitor-analysis.md) re-check |

**Gate arithmetic:** red = ___ · yellow = ___ · green = ___
**Decision-rule check** ([01-validation-plan.md §8](./01-validation-plan.md#8-decision-rules)): does the pattern of reds force REPEAT or STOP regardless of the total? ☐ No ☐ Yes — which rule: ______

---

## 4. Hypothesis verdicts (H1–H10)

Definitions and thresholds: [01-validation-plan.md §2](./01-validation-plan.md). Verdict: **Supported / Mixed / Refuted**.

| H | Hypothesis | Verdict | Strongest evidence (quote or number, anonymized) | Implication for Phase 2 |
|---|---|---|---|---|
| H1 | Pain is real and costly | | | |
| H2 | WhatsApp is the instruction channel | | | |
| H3 | Zero-install links are acceptable | | | |
| H4 | Workers will answer one comprehension question | | | |
| H5 | Six languages cover the beachhead | | | |
| H6 | Buyers need per-worker proof | | | |
| H7 | The price is payable | | | |
| H8 | Minimal PII is acceptable | | | |
| H9 | Name/positioning is safe and clear | | | |
| H10 | No direct substitute at our price/channel | | | |

---

## 5. What surprised us

Five bullets maximum. Surprises matter more than confirmations; they are where the plan is wrong.

1.
2.
3.
4.
5.

**Most dangerous finding (required):**

> _The single fact that most threatens the business. If none exists, say so explicitly._

---

## 6. Scope and document amendments

Every amendment names the document and section. Phase 2 is the act of applying these, not re-planning from scratch.

| # | Finding | Affects (doc / section) | Exact change | Owner | Due | Status |
|---|---|---|---|---|---|---|
| A1 | | `02-prd.md` / | | Founder | | ☐ |
| A2 | | `03-user-flows-wireframes.md` / | | Founder | | ☐ |
| A3 | | `04-tdd.md` / | | Founder | | ☐ |
| A4 | | `05-database-api-spec.md` / | | Founder | | ☐ |
| A5 | | `06-development-backlog.md` / | | Founder | | ☐ |
| A6 | | `07-test-plan.md` / | | Founder | | ☐ |
| A7 | | `08-launch-growth-plan.md` / | | Founder | | ☐ |

**MVP scope verdict** (from [06-mvp-scope-validation.md](./06-mvp-scope-validation.md)):

- Shrink: _which capabilities leave v0.1 and why_
- Reshape: _which capabilities change form and why_
- Expand: _only if a signed/paid pilot is blocked; name the candidate_
- Unchanged: _state explicitly what the evidence did not move_

**Language decision:** ☐ Six as planned  ☐ Narrow to ______  ☐ Add ______
**Channel decision:** ☐ Link-in-WhatsApp  ☐ Per-worker links  ☐ Kiosk earlier  ☐ Other: ______
**Comprehension decision:** ☐ Three-option MCQ  ☐ Action-based question  ☐ Spoken answer  ☐ Other: ______

---

## 7. Pilot pipeline at exit

| Company | Contact role | Workers | Stage | Next step | Date | Blocking issue |
|---|---|---|---|---|---|---|
| | | | | | | |
| | | | | | | |
| | | | | | | |

**Signed pilot terms (if any):** price $______ · duration ______ · site ______ · workers ______ · start date ______ · invoice sent ______ · paid ______
**If none signed:** what specifically failed — offer, price, timing, trust, procurement, or no decision-maker? _Answer in one paragraph; do not blame "the market."_

---

## 8. Risks and unknowns entering Phase 2

| Risk | Evidence so far | Mitigation | Review date |
|---|---|---|---|
| | | | |
| | | | |
| | | | |

**Open questions that Phase 2 must not pretend to answer:** _list 1–5. These stay open until a customer closes them._

---

## 9. Decision and conditions

**Decision:** ☐ PASS  ☐ CONDITIONAL PASS  ☐ REPEAT  ☐ STOP

**If CONDITIONAL PASS — conditions (max 2, each with a date and a binary test):**

| # | Condition | Binary test | Due | Owner |
|---|---|---|---|---|
| C1 | | | | |
| C2 | | | | |

**If REPEAT — what changes in the next 30–45 days:**

- Hypothesis to change:
- Segment or channel to change:
- Evidence needed to overturn the red gate:
- Spend cap: $______ (pre-revenue budget ceiling remains $550)

**If STOP — what is preserved:** research notes, competitor teardown, interview quotes (anonymized), and the planning docs. What is not spent: build budget, pilot discount, domain renewal beyond one year.

---

## 10. Sign-off and handoff

**Signed:** ______________________  **Date:** ____________

**First five Phase 2 actions (only if PASS or CONDITIONAL PASS):**

1. Apply amendments A1–A7 to the named documents and bump versions.
2. Re-issue the one-page MVP scope with the final language/channel/comprehension decisions.
3. Update the backlog's E0/E1 ordering to match the amended scope; re-estimate only changed stories.
4. Confirm the pilot start date and work backward to the release gate.
5. Start E0.1 (walking skeleton) only when conditions C1–C2 are green or the decision is PASS.

**Stop rule:** if this memo is still a template on 19 Dec 2026, Phase 1 has not exited. Report the delay; do not proceed to build.

---

## Appendix A — Evidence index and handling

| Evidence type | Naming | Store | Retention |
|---|---|---|---|
| Interview notes | `INT-###-YYYY-MM-DD.md` | Private folder, not in the repo | 12 months, then delete |
| Interview tracker | [interview-tracker.csv](./interview-tracker.csv) | Repo | Keep |
| Concierge form exports | `CON-###-export.csv` | Private folder | 30 days after test; aggregates only in repo |
| Concierge tracker | [concierge-tracker.csv](./concierge-tracker.csv) | Repo | Keep (no PII) |
| Pilot agreement / invoice | `PILOT-<company>-YYYY-MM-DD.pdf` | Private folder | 7 years (finance) |
| Name/trademark check | `NAME-2026-12-04.md` | Repo | Keep |
| Roster samples | `ROSTER-##-languages.csv` | Private folder | 30 days; keep counts only |

**Rules:** anonymize company and person names in the repo; never store worker phone numbers; quotes are paraphrased unless written permission exists; no evidence file is created before the event it describes.
