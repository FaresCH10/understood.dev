# MVP Scope Validation — what Phase 1 must prove before build

**Version:** 0.1 · **Date:** 2026-11-13 · **Owner:** Founder
**Status:** Scope hypothesis — evidence pending, to be reconciled in the exit memo on 15–18 Dec 2026
**Companions:** [01-validation-plan.md](./01-validation-plan.md) · [../docs/02-prd.md](../docs/02-prd.md) · [../docs/06-development-backlog.md](../docs/06-development-backlog.md) · [../docs/08-launch-growth-plan.md](../docs/08-launch-growth-plan.md)

---

## 1. The MVP in one paragraph

One supervisor at one site records or types an instruction (optional photo), picks a crew, previews the translated text and audio, and shares one link into the WhatsApp group the crew already uses. Each worker opens the link with no install, sees the instruction in their language, plays the audio, answers one three-option comprehension question, and taps **Done** or **I need help**. The supervisor sees who opened, heard, answered correctly, and completed — and exports a CSV that survives an HSE audit. Nothing else ships in v0.1.

That paragraph is a **hypothesis**, not a settled decision. Every clause below is tied to the evidence that can shrink, reshape, or veto it.

---

## 2. Scope ledger — capability, reason, evidence, failure response

Scope items map to PRD requirements in [02-prd.md](../docs/02-prd.md). Evidence status is deliberately honest: as of 13 Nov 2026 **no interviews or concierge runs have occurred**.

| # | Capability in v0.1 | Why it is in | Hypothesis / test | Evidence status (13 Nov) | If evidence contradicts |
|---|---|---|---|---|---|
| 1 | Supervisor web app, English + Arabic RTL | The buyer and champion are Gulf-based; an English-only tool loses the supervisor | H2, H9 — interviews | Untested | Ship English-only first only if ≥8/10 supervisors work in English; RTL slips to v0.2 |
| 2 | Instruction from voice, text, or photo | Voice is the existing behavior; typing is the fallback; photos carry SOPs | H1, H2 — interviews + concierge | Untested | If voice notes dominate and photo is unused, ship voice + text and defer photo capture |
| 3 | Transcribe → translate → TTS per language | This is the product; without it there is no instruction in the worker's language | H3, H4, H5 — concierge | Untested | If translation quality is rejected for safety content, restrict v0.1 to non-safety instructions and add human approval before safety templates |
| 4 | Six languages: ar, en, hi, ur, ml, bn | Covers the bulk of GCC FM/cleaning/construction crews in low-signal conditions | H5 — roster samples | Untested | Narrow to the top 4 languages present in sampled rosters; defer the rest without changing the architecture |
| 5 | Crews + CSV roster import + language profile | Supervisors will not type a roster; language must be per worker, not per crew | H5, H8 — interviews | Untested | If rosters are too messy, allow manual add for ≤25 workers and defer import quality work |
| 6 | Mandatory preview before share | Safety and trust: the supervisor must see what will be sent, including "possibly untranslated" warnings | H4, H9 — interviews + concierge | Untested | Never cut. If preview is too slow, reduce pipeline latency, not the gate |
| 7 | One link per share, name picker per worker | Zero install, no phone numbers, one message in the existing group | H3 — concierge | Untested | If name picking confuses workers, test numbered links or a per-worker link list; do not build an app |
| 8 | Worker page: text + one play button + one MCQ + Done / Help | Audio-first for literacy; one question makes "understood" measurable; Help captures the failure case | H3, H4 — concierge | Untested | If workers refuse the question, test a spoken answer or a simpler action-based question before adding features |
| 9 | Live status board + CSV audit export | The buyer's proof and the reason to return; the export is the artifact an auditor sees | H6 — interviews | Untested | If proof is not valued, reposition around supervisor time saved; if CSV is insufficient, add PDF before analytics |
| 10 | Magic-link email login, org/crew/worker model, delivery tokens | Minimum secure multi-tenant foundation; no passwords for supervisors | H8 — interviews | Untested | No change expected; simplify only if onboarding exceeds the 9-minute target |
| 11 | Fair-use meter at 150 TTS minutes/org/month | Prevents silent AI cost creep at $0 budget | H7 — pricing interviews | Untested | Adjust the threshold from observed concierge volume, not from guesses |

### Explicitly out of v0.1

WhatsApp Business API, native apps, SMS/OTP, billing automation, analytics dashboards, kiosk mode, video, HR integrations, PDF compliance pack. These stay out until a **paying pilot** or a **blocking pilot candidate** forces them in — not because a competitor has them.

---

## 3. Scope assumptions ranked by risk

| Rank | Assumption | If false | Cost to fix after build |
|---|---|---|---|
| 1 | A link in a WhatsApp group gets ≥60% of a crew to respond within 24h | The whole delivery model fails | Very high — channel and product change |
| 2 | Workers will answer one comprehension question | "Understood" cannot be measured | High — core promise and data model change |
| 3 | Six languages cover ≥80% of sampled workers | Translation scope is wrong | Medium — narrow languages, same architecture |
| 4 | Supervisors will forward a link without training | Adoption depends on founder hand-holding | Medium — onboarding and share flow change |
| 5 | A per-worker CSV record is worth paying for | The audit value proposition is weak | High — positioning and pricing change |
| 6 | $149–$630/month is payable by a 50–300-worker site | Unit economics or ICP is wrong | Medium — packaging changes before billing code |
| 7 | Minimal PII (name + language) is acceptable | Privacy review blocks the pilot | Low–medium — consent and data model adjustments |

The first two are **existential**. They are tested in the concierge MVP, not in interviews. Interview enthusiasm is not evidence that a worker will tap a link.

---

## 4. What would change the scope

### Shrink (most likely)

- **Language mix is narrower than assumed** (H5): ship the top four languages; keep the pipeline language-agnostic. Saves ~1 week of voice QA, not architecture.
- **Photo capture is unused in the concierge test**: defer photo to v0.2; voice + text remain.
- **Arabic supervisor UI is not required for the first pilot**: ship English-first, keep RTL strings in the design system, add Arabic before the second pilot.
- **CSV import is not needed under 25 workers**: manual entry is acceptable for the design partner; import follows the first paid month.

### Reshape (test before building)

- **Comprehension question is rejected or gamed** (H4): switch from a knowledge MCQ to an action-confirmation question ("What do you do first?"), keep three options, keep audio. Same data model, different prompt and copy.
- **Name picker causes wrong-person answers** (H3): switch to per-worker links pasted as a numbered list, or a crew PIN. Delivery tokens and audit model do not change.
- **Supervisors want to send without preview** (H9): never remove preview; reduce the number of steps and show a one-line diff instead.
- **Buyers demand PDF before pilot** (H6): add a print-friendly HTML export before a PDF engine; do not build a compliance pack.

### Expand (only with a blocking pilot candidate)

| Request | Trigger | Smallest response | Full response (later) |
|---|---|---|---|
| WhatsApp API delivery | ≥2 pilot candidates say forwarding links is a dealbreaker | Keep link sharing; add a "copy message" helper | WhatsApp Cloud API + delivery receipts |
| PDF compliance pack | A signed pilot's auditor rejects CSV | Print-friendly HTML → PDF | Branded compliance pack |
| More languages (Tamil, Tagalog, Nepali) | ≥20% of a pilot roster speaks them | Add one language end-to-end | Language expansion program |
| Kiosk / shared tablet | A pilot site has no personal phones | Supervisor-assisted mode on one tablet | QR kiosk with session reset |
| Billing automation | A second paying customer | Manual invoice | Merchant-of-record subscription |

**Rule:** a request expands scope only when it blocks a **paying or signed** pilot. "A competitor has it" is not a trigger.

---

## 5. Scope-creep kill list

Do **not** start these during v0.1, even if they are easy:

- A settings page beyond org profile and language.
- A second dashboard chart. The board and CSV are the proof.
- A worker login, profile, or history. The delivery token is the identity.
- Rich text formatting, attachments beyond one photo, or instruction templates beyond one sample.
- Any AI feature that does not shorten the supervisor's path to a shared, understood instruction.
- Any language whose translation and audio have not been checked by a native speaker on the team.

Each item above is a real product idea. None of them is v0.1.

---

## 6. Pre-build verification checklist

Before E0.1 (walking skeleton), the founder confirms:

- [ ] 10 interviews completed and logged in [interview-tracker.csv](./interview-tracker.csv); no row is fabricated.
- [ ] At least one concierge crew completed two weeks, or the gate is explicitly reported as not met.
- [ ] Concierge response and first-attempt-correct numbers are recorded in [concierge-tracker.csv](./concierge-tracker.csv).
- [ ] Three pilot candidates are in [pilot-candidates.csv](./pilot-candidates.csv); one has a signed agreement and a paid invoice by 18 Dec 2026.
- [ ] Roster language counts are sampled and the six-language assumption is confirmed or amended.
- [ ] Name/domain decision recorded; fallback is Mafhoom / «مفهوم» if the check is not clean.
- [ ] Every scope amendment is written into [07-phase-1-exit-memo.md](./07-phase-1-exit-memo.md) with the doc and section to update.

If any box is unchecked, the correct action is to **report the gate as unmet**, not to build through it. The [01-validation-plan.md §8](./01-validation-plan.md#8-decision-rules) decision rules apply.

---

## 7. Definition of a valid v0.1

v0.1 is done when a supervisor who has never seen the product can, in under nine minutes and without the founder in the room:

1. Create an instruction from a voice note.
2. Pick a crew of at least five workers.
3. Preview the text and audio in each language and share one link.
4. Watch at least three workers open, answer, and complete within 24 hours.
5. Export a CSV that a stranger can read and an auditor can file.

Anything that does not serve that loop is not v0.1.

---

**Next artifact:** [07-phase-1-exit-memo.md](./07-phase-1-exit-memo.md) — filled on 15–18 Dec 2026 with real evidence.
