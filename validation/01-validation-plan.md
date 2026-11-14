# 01 — Phase 1 Validation Plan

**Phase:** 1 — Discovery & Validation
**Version:** 0.1 · **Date:** 2026-11-13 · **Owner:** Founder
**Duration:** 13 Nov – 18 Dec 2026 (5 weeks)
**Gate review:** 15 Dec 2026 · **Decision memo:** 18 Dec 2026

---

## TL;DR

The planning documents are done. The remaining risk is not whether we can write a PRD; it is whether a Gulf facilities manager will change a daily habit and pay for proof. Phase 1 tests four things:

1. **Pain** — supervisors can name a recent miscommunication and what it cost.
2. **Channel** — WhatsApp is where instructions already live, and a link will be opened.
3. **Comprehension** — workers will answer one question, and supervisors trust the answer.
4. **Payment** — someone will pay $490 for an 8-week pilot and discuss $149–$630/month after.

Everything else (features, architecture, launch) is downstream of those four.

---

## 1. Why Phase 1 exists

Docs [01](../docs/01-product-brief.md)–[08](../docs/08-launch-growth-plan.md) describe a coherent product. Coherence is not evidence. Phase 1 exists to answer:

- Is the daily instruction problem painful enough that a supervisor will change one habit?
- Is WhatsApp the right distribution channel, or does the buyer want an app/API?
- Will workers answer a comprehension question without feeling tested or policed?
- Will an FM company pay a pilot fee before seeing a finished product?
- Does the competitor set already solve this at a lower price or with less friction?

**What Phase 1 is not:** a market-size study, a brand exercise, a feature bake-off, or a substitute for the pilot. It is a five-week evidence sprint with a binary gate.

---

## 2. Hypotheses and thresholds

Each hypothesis has a pass threshold, a measurement, and a consequence if refuted. Thresholds are directional, not statistical; ten interviews can reveal a pattern but cannot prove a market.

| # | Hypothesis | How we test | Pass threshold | If refuted |
|---|---|---|---|---|
| **H1** | The pain is real and costly | Ask for the last miscommunication; cost, delay, rework, safety impact | ≥7/10 describe a concrete incident with a consequence | Reposition from "miscommunication" to a narrower trigger (audit, onboarding, client complaint) |
| **H2** | WhatsApp is the instruction channel | Walk through yesterday's briefing; ask to see the group | ≥8/10 use WhatsApp groups/voice notes as primary | If email/verbal dominates, test another channel before building the share flow |
| **H3** | Zero-install links are acceptable | Concierge test; ask supervisors about forwarding behavior; workers' phones | ≥60% response within 24h in at least one crew; supervisor forwards without help | Test SMS or personal links; consider kiosk earlier; do not build an app by default |
| **H4** | Workers will answer one comprehension question | Concierge form; observe first-attempt correctness; ask supervisor reaction | ≥60% first-attempt correct; supervisor finds the answer credible | Redesign the question (action-based, 3 options, audio); do not add features |
| **H5** | The six languages cover the beachhead | Roster samples; ask for language counts | ≥7/10 rosters have 3+ languages; the six cover ≥80% of workers in samples | Narrow v0.1 to the top 4 languages; defer the rest |
| **H6** | Buyers need per-worker proof | Ask what they show an auditor/client today; ask for the artifact | ≥6/10 cannot produce a per-worker understanding record; ≥5/10 have been asked for proof | If proof is not valued, pivot the value proposition to supervisor time saved |
| **H7** | The price is payable | Present the pilot and per-worker price after the problem discussion | ≥3/10 agree to a pilot proposal; 1 signs and pays by 18 Dec | Change scope/price/ICP; do not discount the same offer |
| **H8** | Minimal PII is acceptable | Ask about worker data, phone numbers, privacy concerns | No privacy objection blocks a pilot; ≥7/10 accept name + language only | Add a privacy one-pager; if still blocked, revisit data model before build |
| **H9** | The name/positioning is safe and clear | Read the name and one-line pitch; ask what they think it does; check trademark/domain | No confusion with safety certification; name/domain clean or Mafhoom chosen | Launch as Mafhoom; adjust the pitch |
| **H10** | No direct substitute at our price/channel | Competitor teardown + interview mentions | No competitor combines zero-install, voice-first, comprehension, and audit at $149–$630/month | Sharpen the wedge or reposition; do not build a me-too app |

---

## 3. Evidence plan

### 3.1 Interviews (10)

| Segment | Count | Why |
|---|---:|---|
| Operations / facilities managers | 6 | Own the daily briefing and the supervisor behavior |
| HSE / safety managers | 2 | Own the audit answer and the risk narrative |
| Owners / GMs | 2 | Own the budget and the buying decision |

**Inclusion criteria:**

- UAE-based (Dubai, Sharjah, Abu Dhabi) FM, cleaning, or integrated facilities company.
- 50–1,000 workers for interviews; 100–1,000 for pilot candidates.
- At least three languages in the roster (ask; do not assume).
- A person who directly runs or oversees crews, not a vendor selling to them.

**Recruitment sources (no more than four interviews from one source):**

1. Lebanese diaspora and university alumni networks (AUB, LAU, USJ, NDU, Balamand) in UAE ops/HSE roles.
2. LinkedIn outbound with the search strings in [02-interview-kit.md](./02-interview-kit.md).
3. UAE FM/cleaning/HSE WhatsApp and Facebook communities (participate first; no spam).
4. Referrals from interviewees and warm contacts.
5. One industry meetup or association event if timing allows (MEFMA, Dubai Chamber).

**Sample-size honesty:** ten interviews are qualitative. They are enough to find repeated patterns and fatal objections; they are not enough to estimate market size or conversion rates. If the first five are contradictory, pause and re-recruit rather than pushing to ten for the number.

### 3.2 Concierge MVP (1–2 crews)

A no-code test of the full loop with a real crew for two weeks: supervisor voice note → manual transcription/translation → audio → Google Form with one question → response tracking → daily summary. Full procedure and guardrails in [05-concierge-mvp-runbook.md](./05-concierge-mvp-runbook.md).

**Why it matters:** it tests the channel and the comprehension behavior before a line of product code. It also creates the first proof asset and the first pilot conversation.

### 3.3 Pilot commitment (3 candidates → 1 signed)

- Identify three pilot candidates during interviews.
- Send a one-page proposal after a 20-minute demo (not during the research call).
- Target: one signed agreement and paid invoice by **18 Dec 2026**.
- The pilot offer is fixed: $490, 8 weeks, one site, ≤150 workers, credited to the first invoice ([08 §4–5](../docs/08-launch-growth-plan.md)).

### 3.4 Competitor teardown

Completed in [04-competitor-analysis.md](./04-competitor-analysis.md). Prices are indicative and must be re-verified before any customer-facing use. The key finding: translation is becoming table stakes in employee apps; the gap is zero-install, voice-first, instruction-level comprehension, and an audit record at an SME-GCC price.

### 3.5 Name and domain

- Deadline: **4 Dec 2026**.
- Run a UAE trademark search in classes 9, 35, and 42; check the domain and social handles.
- Buy the domain by 21 Nov regardless of the final name (required for email deliverability).
- If "Understood" is not clean, launch customer-facing as **Mafhoom / «مفهوم»**; the internal docs keep the working name.

---

## 4. Timeline

UAE working week is Monday–Friday; Friday–Saturday is the weekend. Book Sunday–Thursday mornings (GST, UTC+4). Avoid the last week of December.

| Week | Dates | Research | Concierge | Commercial | Output |
|---|---|---|---|---|---|
| **1** | 13–19 Nov | Send 20 outreach messages; book 5 interviews; run 2–3 interviews | Recruit one friendly supervisor; choose a non-safety instruction; set up tools | Draft pilot one-pager; name/domain search | First evidence rows; concierge ready |
| **2** | 20–26 Nov | 3–4 interviews; ask every interviewee for 2 referrals | Week 1: 3 instructions; daily tracking | Identify 5 pilot candidates | ≥5 interviews total; first response data |
| **3** | 27 Nov–3 Dec | 3 interviews; synthesis #1 after 5 interviews | Week 2: 3 instructions; day-3 demand check | Demo #1 with the warmest candidate | ≥8 interviews; concierge result; name decision prep |
| **4** | 4–10 Dec | Final 2 interviews; synthesis #2 | Wrap; write the one-page result | 3 pilot proposals; 2 demos | 10 interviews; 3 proposals |
| **5** | 11–18 Dec | Gate review 15 Dec; exit memo 18 Dec | — | Close 1 signed + paid pilot | Phase 1 decision; amendments list |

**Buffer:** one week is built into the timeline for no-shows and UAE holiday scheduling. If fewer than seven interviews are complete by 10 Dec, extend by one week and move the gate; do not lower the evidence bar.

---

## 5. Interview operations

### 5.1 Booking

- 25–30 minutes; LinkedIn message → WhatsApp → calendar invite (Calendly free or a manual slot).
- Time zone: GST (UTC+4). Offer 08:30–10:00 or 14:00–16:00, avoiding prayer times and shift handovers.
- Confirmation 24 hours before; one reschedule allowed; a second no-show is a "no."
- No incentive payment. Offer the one-page communication audit and a summary of findings; coffee only if meeting in person.

### 5.2 Consent and privacy

- State the purpose: "research on how multilingual crews receive instructions; not a sales call."
- Ask permission before recording. Default: written notes only.
- Anonymize companies in notes (Company A, B…); no worker names or phone numbers.
- Store notes in a private folder; delete raw audio after 30 days.
- Do not add interviewees to a marketing list without explicit consent.
- If they share a roster or screenshot, redact names and numbers before saving.

### 5.3 Note-taking

Within 24 hours of each call:

1. Fill one row in [interview-tracker.csv](./interview-tracker.csv).
2. Write five bullets: current flow, incident, audit answer, language mix, strongest objection.
3. Capture 1–3 exact quotes (verbatim, attributed to role only).
4. Mark any artifact they showed (WhatsApp screenshot, audit doc, roster).
5. Set the next step and date (referral, demo, pilot proposal, or no).

### 5.4 Who not to interview

- Vendors selling to FM companies (they have a pitch, not the pain).
- Single-language crews (not the beachhead).
- Construction-only HSE leads in this phase (heavier compliance; later).
- Friends who will only be nice. If the first three interviews are all friendly, recruit two skeptics before drawing conclusions.

---

## 6. Evidence quality rules

| Rule | Why |
|---|---|
| Ask about the last time, not "usually" | Specific past behavior beats generalized claims |
| Ask "show me" | A WhatsApp screenshot or audit document is stronger than an opinion |
| Separate observation from interpretation | "He said X" vs "I think he meant Y" — keep both, labeled |
| Count companies, not calls | Two calls with the same person are one data point |
| Record negative evidence verbatim | Disconfirming evidence is the most valuable kind |
| Do not pitch until the end | Early pitching contaminates the current-state answers |
| Ask "what would stop you?" | Surfaces the real blocker faster than "would you use it?" |
| Beware politeness bias | Friendly intros overstate interest; ask who would say no |
| Do not round up | Six interviews is six, not "about ten" |
| Write the quote, not the summary | Exact language becomes landing-page copy |

---

## 7. Gate scorecard

Fill this on 15 Dec from the tracker. One row per gate.

| # | Gate | Threshold | Actual | Status | Evidence link |
|---|---|---|---|---|---|
| 1 | Pain | ≥7/10 concrete incident | | ⬜ | |
| 2 | WhatsApp channel | ≥8/10 primary | | ⬜ | |
| 3 | Link response | ≥60% in a concierge crew | | ⬜ | |
| 4 | Comprehension | ≥60% first-attempt correct | | ⬜ | |
| 5 | Demand repeat | Supervisor asks after day 3 | | ⬜ | |
| 6 | Payment | 3 proposals; 1 signed + paid | | ⬜ | |
| 7 | Language mix | ≥7/10 rosters 3+; 80% coverage | | ⬜ | |
| 8 | No blocking gap | No gap blocks 2+ candidates | | ⬜ | |
| 9 | Name/domain | Clean or fallback chosen | | ⬜ | |
| 10 | Competitor gap | No direct substitute at price | | ⬜ | |

**Status:** Green = threshold met. Amber = close, one more data point needed. Red = refuted or blocked.

---

## 8. Decision rules

| Situation | Decision |
|---|---|
| All ten green | Proceed to Phase 2 reconciliation and Phase 5 build; update docs with evidence and start E0.1 |
| Pain green, payment red | Change the offer, ICP, or price; do not build billing or a free tier |
| Channel red (WhatsApp not primary) | Test SMS, personal links, or kiosk before building the share flow; do not default to an app |
| Comprehension red | Fix question design, audio-first flow, or the definition of "understood"; do not add features |
| Language red | Narrow v0.1 to the top four languages; defer the rest to v0.2 |
| Audit demand red | Reposition from "proof" to "supervisor time saved"; revisit the audit export priority |
| Privacy red | Add a DPA/privacy one-pager; if still blocked, change the data model before build |
| Name red | Launch as Mafhoom / «مفهوم»; keep the internal name |
| 2+ blocking gaps (seats, API, app) | Re-scope the pilot and v0.2 sequence; do not promise what v0.1 cannot deliver |
| Fewer than 7 interviews | Extend one week; report the real number; do not fake the gate |
| 3+ candidates demand the same missing feature | Re-open the PRD before Phase 2 sign-off; the backlog changes, not the pitch |

**Pivot rule:** if the pain is real but the channel or comprehension is refuted, pivot the *workflow*, not the mission. The mission is "workers understand"; the workflow is a hypothesis.

---

## 9. Deliverables

| Deliverable | File | Due |
|---|---|---|
| Validation plan | This file | 13 Nov |
| Interview kit | [02-interview-kit.md](./02-interview-kit.md) | 13 Nov |
| Outreach templates | [03-outreach-templates.md](./03-outreach-templates.md) | 13 Nov |
| Competitor analysis | [04-competitor-analysis.md](./04-competitor-analysis.md) | 13 Nov |
| Concierge runbook | [05-concierge-mvp-runbook.md](./05-concierge-mvp-runbook.md) | 13 Nov |
| MVP scope validation | [06-mvp-scope-validation.md](./06-mvp-scope-validation.md) | 13 Nov |
| Completed tracker (10 rows) | [interview-tracker.csv](./interview-tracker.csv) | 10 Dec |
| Pilot candidates (3) | [pilot-candidates.csv](./pilot-candidates.csv) | 10 Dec |
| Signed pilot + paid invoice | External | 18 Dec |
| Exit memo | [07-phase-1-exit-memo.md](./07-phase-1-exit-memo.md) | 18 Dec |

---

## 10. Risks to Phase 1

| Risk | Early signal | Mitigation |
|---|---|---|
| Access — no replies | <3 accepted invitations after 40 sends | Switch to warm intros; ask alumni groups; attend one event; do not buy lists |
| Politeness bias | Every answer is "great idea" | Recruit two known skeptics; ask "who would say no?"; watch what they show, not what they say |
| Sample bias (one network) | All interviewees are Lebanese or from one company | Cap four per source; add Indian/Pakistani supervisors and HSE leads |
| No-shows | Two cancellations in week 1 | Book 15 for 10 slots; confirm 24h before; offer two time windows |
| Concierge load | >60 min per instruction | Cap at 3 instructions/week; use templates; stop after 2 weeks |
| Privacy/legal concern | Interviewee refuses to share a roster | Use aggregated language counts; no worker names; explain the data model |
| Name search delay | Trademark ambiguity | Default to Mafhoom; buy the domain anyway |
| Pilot fee resistance | "Why pay for a pilot?" | Offer the demo crew; reduce scope to one crew; do not make it free |
| Founder bias | Hearing only confirmation | Tracker requires disconfirming evidence and exact quotes |
| Scheduling | UAE weekend/Friday | Book Sunday–Thursday; avoid Eid and the last week of December |

---

## 11. What Phase 1 does not do

- No production code, no feature build, no architecture changes.
- No free pilots or free software; the concierge test is manual and time-boxed.
- No paid advertising, no cold WhatsApp blasts, no purchased lists.
- No market-size proof; the brief's estimate remains an estimate until validated.
- No promises to interviewees about features, dates, or pricing beyond the pilot offer.

---

## 12. Phase 2 handoff

Phase 2 (Product Definition) is already documented in [PRD](../docs/02-prd.md) and [backlog](../docs/06-development-backlog.md). The Phase 1 exit memo does not rewrite them; it lists **amendments**:

- Requirements to add, remove, or re-prioritize.
- Pricing/packaging changes.
- Language scope changes.
- Channel or onboarding changes.
- Pilot candidate profile changes.

Only after those amendments are applied and versioned does Phase 2 sign off and Phase 5 build begin. If the founder chooses to run E0.1 (repo, CI, walking skeleton) in parallel, that is a deliberate risk decision recorded in the exit memo — not an accident.

---

**Next:** [02-interview-kit.md](./02-interview-kit.md) → send the first five messages.
