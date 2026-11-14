# 01 — Product Definition (v0.1 Scope Lock)

**Version:** 1.0 · **Date:** 2026-11-13 · **Owner:** Founder
**Status:** Locked for build — conditional on Phase 1 field evidence
**Authority:** [PRD v0.1.2](../docs/02-prd.md) defines required behavior · [Database/API v0.1.2](../docs/05-database-api-spec.md) defines contracts · [backlog v0.1.1](../docs/06-development-backlog.md) defines story detail · **this document defines release scope and priority interpretation.**
**Conflict order:** behavior → PRD/doc 05 · scope and release priority → this document · story detail → backlog.

> **Build authorization is conditional.** Phase 1 field evidence — 10 interviews, a real concierge crew, and one signed/paid pilot — is still pending. Phase 2 proceeds on the founder's explicit instruction. This document does not claim that evidence exists. §8 lists every assumption that field evidence can invalidate, and the response if one fails. A red Phase 1 gate reopens this lock; it is not built through silently.

---

## 1. The product

**Understood turns a supervisor's voice note into every worker's language — and proves each worker actually understood it.**

A supervisor records, types, or photographs an instruction and picks a crew. The product transcribes, translates, writes one comprehension question, and generates audio in each worker's language. The supervisor previews every language and pastes one link into the WhatsApp group the crew already uses. Each worker opens the link with no install, picks their name, hears the instruction in their language, answers one question, and taps **Done** or **I need help**. The supervisor's board shows who understood, who needs help, and who has not opened it — and a CSV gives the buyer an audit record.

### The promise the build must keep

| Role | Promise | Measured by |
|---|---|---|
| Supervisor | Empty account to a shared instruction in **9 minutes**, without training | First instruction shared on day 1; 4/5 supervisors unaided in validation |
| Worker | Tap the link and hear the instruction in their language in **10 seconds**; finish in **90 seconds** | Real low-end Android on 3G; zero observer touches |
| Buyer | Answer "who understood this?" in **20 seconds** with an Excel-safe export | CSV opens in Excel with Arabic intact; per-worker rows |

### The loop

```
Supervisor speaks / types / attaches a photo
        ↓  transcribe → translate → one question → audio per language
Supervisor previews every language, edits if needed, shares one link
        ↓  WhatsApp group (or QR on a site tablet)
Worker picks name → hears/reads → answers one question → Done or Help
        ↓
Board shows understood / not opened / needs help → CSV proves it
```

### What this product is not

| Not this | Why it matters |
|---|---|
| An employee app or intranet | No install, no login, no English menu for workers. The link is the product |
| A read-receipt tool | Opening proves nothing. First-attempt-correct plus Done is the record |
| A translation tool | Translation is table stakes; comprehension and audit are the wedge |
| A safety-certification or LMS product | It supports training and procedures; it never replaces them. The disclaimer is on every worker page |
| A WhatsApp API product (v0.1) | The supervisor forwards a link in the group they already use; zero messaging cost |
| A workforce management suite | No scheduling, payroll, tasks, or HR integrations in v0.1 |

---

## 2. Users and jobs

### 2.1 Who it is for

| Role | Who | v0.1 access | What success looks like |
|---|---|---|---|
| **Economic buyer** | Ops / HR / HSE manager at a 100–1,000-worker FM, cleaning, or logistics company in the UAE (then KSA) | No login required during the pilot; receives exports and updates | Fewer mistakes, an audit-ready record, no new app for workers, a supervisor who stops repeating himself |
| **Champion / daily user** | Site supervisor or foreman | Owner account, email magic link, full access | Says it once, sees who got it, chases only the exceptions, exports proof |
| **End user** | Frontline worker; low–moderate digital literacy; low-end Android; personal phone or shared site tablet | No account. A name on the roster and an instruction link | Hears/reads the instruction in their language, confirms it, can ask for help without explaining in English |
| **Influencer** | HSE auditor or the FM company's client | No access; sees the export | A per-worker record of what was communicated, when, and in which language |
| **Operator** | Founder | Admin access, staging, support inbox | Zero-touch demos, one-site pilots, costs under control |

### 2.2 Jobs to be done

- **Buyer:** "When I assign work to a multilingual crew, I want proof that each worker understood it, so I can answer clients and auditors and stop paying for rework."
- **Supervisor:** "When I brief my crew, I want to say it once and know exactly who did not get it, so I stop repeating myself and chasing everyone."
- **Worker:** "When my supervisor sends an instruction, I want to hear it in my language and tell someone if I am stuck, so I do the job right and don't get blamed."
- **Operator:** "When I sell and onboard a pilot, I want the product to run itself on free tiers, so I can prove the loop without spending money I don't have."

### 2.3 The beachhead

| Dimension | v0.1 decision | Why |
|---|---|---|
| Market | UAE first (Dubai / Sharjah), then KSA | Founder is Lebanon-based; the Gulf is reachable remotely; UAE has the density and the language mix |
| Vertical | Mid-size facilities management and cleaning (100–1,000 workers) | Extremely multilingual, WhatsApp-run, daily recurring instructions, shorter sales cycle than construction |
| Buyer | Ops / HR / HSE manager | One decision-maker can say yes at this size |
| Later | Logistics / warehousing, then construction toolbox talks | Larger prize, heavier procurement and compliance; enter after the loop is proven |

---

## 3. The wedge

The 2026 competitor teardown in [validation/04-competitor-analysis.md](../validation/04-competitor-analysis.md) found that **auto-translation is now table stakes**: Beekeeper, Blink, Connecteam, and Staffbase all offer it. A translation-only pitch is not a business. The wedge is the combination incumbents do not sell to this buyer at this price:

| # | Differentiator | Why it holds | Who it beats |
|---|---|---|---|
| 1 | **Zero install, link-first** | Workers never register, install, or find an app. The supervisor uses the WhatsApp group already in place | Employee apps that require adoption; intranets; kiosk-only tools |
| 2 | **Voice in, audio out** | The supervisor communicates the way he already does; the worker hears the instruction even if reading the script is hard | Text-first tools; translation widgets; email |
| 3 | **Comprehension, not receipts** | One question per instruction produces a per-worker, per-language record of understanding | Read receipts; "seen by"; attendance-style tracking |
| 4 | **Audit-grade proof at an SME price** | One CSV per instruction or date range, Arabic-safe, snapshot-accurate | Enterprise suites priced per seat for office-adjacent staff |
| 5 | **Built for the Gulf frontline** | Six Gulf-crew languages, RTL supervisor UI, 320px low-end phones, weak connectivity | Global products with English admin and shallow Indic/Arabic support |

**What we deliberately do not compete on:** full intranet, scheduling, payroll, LMS, safety certification, hardware push-to-talk, or a worker social feed. Every one of those is a different product with a different buyer.

**Positioning sentence:** *For GCC operations, HR, and HSE managers with multilingual frontline crews, Understood is the voice-first communication system that delivers every instruction in each worker's own language and proves it was understood — unlike employee apps that require installation, English menus, and read receipts that prove nothing.*

---

## 4. Product principles

Canonical definitions live in [PRD §4](../docs/02-prd.md). They are restated here because every scope argument is settled against them.

| # | Principle | What it forbids |
|---|---|---|
| P1 | **One link, zero install** | Any worker registration, password, app install, or app-store dependency |
| P2 | **Speak, don't type** | Making text entry the primary path for supervisors |
| P3 | **Proof over receipts** | Shipping "opened" or "seen" as the definition of understood |
| P4 | **Preview before share** | Any auto-send path; stale audio or an unseen translation reaching workers |
| P5 | **Never strand a worker** | Blocking delivery because one provider failed; a dead end on any worker screen |
| P6 | **The board is the product** | Building analytics before the share → watch → chase → export loop works |
| P7 | **Boring beats clever in workers' hands** | Clever interactions, hidden gestures, English-only controls, color-only states |

---

## 5. Scope contract

### 5.1 Committed to v0.1

Every MUST requirement in [PRD §8](../docs/02-prd.md) plus four committed SHOULDs. **57 stories, 204 focused hours + 10h buffer.**

| Capability area | What ships | PRD IDs | Epics |
|---|---|---|---|
| Foundation and delivery | Workspace, CI, local stack, deployed walking skeleton, provider spikes | NFRs, TDD §11 | E0 |
| Identity and shell | Magic-link auth, org, EN/AR RTL shell, first-run checklist | AUTH-1…5, SET-1, ACT-2 | E1 |
| Crews and roster | Crew/worker CRUD, archive, CSV import, display names, 1,000 cap | CREW-1…7, WORK-1/2 | E2 |
| Compose | Text, voice recording + transcript, photo + caption, audience, language chips, autosave | COMP-1…7, PIPE-1 | E3 |
| AI pipeline | Provider adapters, orchestration, translation, question, TTS cache, usage ledger, failure UX | PIPE-2…8 | E4 |
| Preview and share | Mandatory preview, per-language edit/regenerate, one share link, QR, preview mode, revoke/archive | PIPE-6, SHARE-1…4 | E5 |
| Worker loop | Name picker, instruction + audio, question, Done, Help, language switch, edge pages, PWA, six catalogs | WORK-1…8, 10, 11 | E6 |
| Board and notifications | Home list, per-worker board, exceptions, actions, batched help email | BOARD-1…6, NOTIF-1/3 | E7 |
| Proof and admin | CSV engine, instruction/org exports, settings, support, legal, usage meter, delete org | AUDIT-1…4, SET-1…5 | E8 |
| Quality and pilot gate | Security suite, a11y/RTL, performance, e2e, ops, validation, dry run, seams audit | NFRs, QO1–QO10 | E9 |

### 5.2 The four committed SHOULDs

A SHOULD is a cost label, not a commitment. These four are pulled into v0.1 because they are bundled into P0 work or protect the core promise:

| Requirement | Story | Why it is committed | Cut status |
|---|---|---|---|
| **AUTH-4** — Arabic auto-suggest for `ar` locale | E1.3 (P0) | Bundled in the bilingual shell; near-zero extra cost | Not separately cuttable |
| **WORK-8** — PWA shell + audio cache | E6.8 (P1) | Poor connectivity is the worker's reality; text-only fallback is not enough | First real cut if week 4 slips |
| **AUDIT-4** — org-wide export | E8.2 (P0) | "Export all" is part of SET-2; one row per worker per instruction is the buyer's artifact | Not separately cuttable |
| **ACT-2** — checklist persists + 9-minute promise | E1.4 (P0) | The activation promise is the product's first impression | Not separately cuttable |

### 5.3 Post-gate release — v0.1.1

Built only after the pilot gate, in the order field evidence justifies. **E10 = 13 hours total.**

| Item | Requirement | Why it waits |
|---|---|---|
| In-product demo crew (3 workers, 1 instruction) | ACT-1 | Sales aid; the operator can seed a staging org before the pilot |
| Offline answer/complete/help outbox | WORK-9 | Online flow works; weak-network polish with idempotency risk |
| Printable one-page QR PDF | SHARE-5 | On-screen QR covers the need |
| Weekly summary email | NOTIF-2 | The board already answers "how are we doing?" |
| Bulk language edit | CREW-6 | Manual edit is acceptable at pilot size |

### 5.4 v0.2 and later

WhatsApp Cloud API delivery + receipts · personal worker links/inbox + web push · Tamil, Tagalog, Nepali · per-org safety glossary and translation memory · PDF compliance pack · automated billing via merchant of record · multi-supervisor seats · scheduled/recurring sends · spoken answers with STT grading · kiosk QR for shared tablets · cross-org audio cache (PIPE-9) · analytics dashboards · HR roster integrations.

These are documented in [03b-v0.2-surfaces.md](../docs/03b-v0.2-surfaces.md). **None is a v0.1 commitment**, regardless of competitor presence.

### 5.5 Languages

| Decision | Value |
|---|---|
| Enabled in v0.1 | **Arabic (Gulf), English, Hindi, Urdu, Malayalam, Bengali** — native script in every picker |
| Why six | Cover the bulk of GCC FM, cleaning, and construction crews; audio-first is non-negotiable |
| Evidence status | H5 is **untested**. Roster samples may narrow the enabled set before the pilot |
| Architecture rule | The pipeline is language-agnostic. Narrowing or adding a language is configuration + voice QA, not a rewrite |
| English | Both a source language and a target language for mixed crews |
| Native review | Every worker string and every TTS voice requires native review before the pilot opens (Q3) |

### 5.6 Roles and tenancy

- **One human role in v0.1:** the owner/supervisor. Email magic link. One org per account. No seats, no invitations, no admin console.
- **Workers never have accounts.** Identity is a name on the roster; access is a delivery link.
- **Every record belongs to an Organization.** `orgId` comes from the server session, never from a URL or body. Cross-tenant exposure is the only severity-1 bug class.
- **Minimum PII:** name, language, optional display-only phone, delivery/response records. No national IDs, no documents, no worker login.

---

## 6. Release slices

The backlog is ordered by risk. The product release is ordered by **value demonstrable at the end of each slice**. They must agree; if they don't, the slice is wrong.

| Slice | Outcome demonstrated | Stories | Exit demo |
|---|---|---|---|
| **A — Trust foundation** | A deployed, secure, bilingual shell with a real roster | E0, E1, E2 | Sign in on the deployed domain, create a crew, import 150 Arabic/Hindi/Urdu rows, archive a worker |
| **B — Instruction in** | A supervisor can create and trust a multilingual instruction | E3, E4, E5.1–E5.2 | Record 30 seconds, confirm transcript, see 4 languages in preview in ≤45 seconds, edit Malayalam only |
| **C — Loop out** | A worker on a real phone can understand and confirm | E5.3–E5.5, E6 | Share one link; two real phones (AR + ML) open, answer, complete; wrong path triggers help; board updates ≤15s |
| **D — Proof** | The supervisor can chase and export without help | E7, E8 | Full J1 loop: share → watch → resolve help → export Excel-safe Arabic CSV |
| **E — Pilot gate** | The system is safe enough to put a paying crew on | E9 | QO1–QO10 green, backup restored, pilot dry run signed off |

**Release rules**

1. No slice is skipped; each ends with a demo on staging and, from Slice C, a real phone.
2. A failed Friday demo stops the next slice until it is fixed.
3. The pilot opens only after Slice E, never to "finish testing in production."
4. If the calendar slips, move the pilot. Do not compress E9, native copy review, or the backup restore.

---

## 7. Success metrics

### 7.1 North star

**Understood rate** = targeted workers who answered the comprehension question correctly on the first attempt **and** pressed Done, within 24 hours of share ÷ targeted workers.

It is computed once, in the org's timezone, from delivery records. It is not "opened," "heard," or "answered."

### 7.2 Three gates, three thresholds

The numbers differ by stage on purpose. Do not collapse them into one promise.

| Stage | Metric | Threshold | Source | What it decides |
|---|---|---|---|---|
| **Concierge evidence** (Phase 1) | Response within 24h | ≥60% in at least one crew | [validation/01](../validation/01-validation-plan.md) | Whether workers will open a link at all |
| | First-attempt correct | ≥60% | [validation/01](../validation/01-validation-plan.md) | Whether one question is measurable and credible |
| | Supervisor pulls | Asks to continue after day 3 unprompted | [validation/01](../validation/01-validation-plan.md) | Whether the loop earns a second week |
| **Pilot targets** (product) | Response rate | ≥70% | [PRD §2](../docs/02-prd.md) | Whether the crew is actually reached |
| | Understood rate | ≥60% | [PRD §2](../docs/02-prd.md) | The brand metric; whether the product works |
| | Help rate | 5–15% | [PRD §2](../docs/02-prd.md) | 0% means workers are guessing or afraid to ask |
| | Activation | ≥80% of orgs share on day 1 | [PRD §2](../docs/02-prd.md) | Whether onboarding is self-serve |
| | Supervisor habit | ≥3 instructions/week by week 3 | [PRD §2](../docs/02-prd.md) | Whether it becomes a routine, not a trial |
| | Pipeline success | ≥98% | [PRD §2](../docs/02-prd.md) | Whether the AI is invisible |
| | Cost | <$0.05/instruction at 4 languages | [PRD §2](../docs/02-prd.md) | Whether free tiers and pricing survive |
| **Commercial gate** (launch) | Paid conversion | 1 design partner pays | [launch plan](../docs/08-launch-growth-plan.md) | Whether this is a business |
| | Retention | ≥70% response for 4 consecutive weeks | [launch plan](../docs/08-launch-growth-plan.md) | Whether the pilot is a habit or a honeymoon |

**Interpretation rule:** 60% is the early signal that the mechanism works; 70% is the pilot bar. A concierge crew at 62% is a green light to build the pilot, not proof that the pilot target is met.

### 7.3 Guardrails

- Zero cross-tenant findings; zero lost or double-counted deliveries; zero rewritten audit timestamps.
- Any worker-route 5xx is triaged as S1 within 24 hours.
- Help rate never zero for two consecutive weeks — investigate, don't celebrate.
- No compliance claim in UI copy; the disclaimer stays on every worker page.

---

## 8. Definition assumptions and invalidation triggers

Each assumption below can change the definition. "Scope-changing" means the product or build plan changes; "positioning-only" means copy, pricing, or sales changes. Status as of **13 Nov 2026: all untested**.

| # | Assumption | Phase 1 test | If it fails | Type | Response |
|---|---|---|---|---|---|
| A1 | A WhatsApp link gets ≥60% of a crew to respond in 24h | Concierge; H3 | The delivery model is wrong | Scope-changing | Test per-worker links, SMS, or kiosk earlier; do not default to a worker app |
| A2 | Workers will answer one comprehension question and find it fair | Concierge; H4 | "Understood" cannot be measured this way | Scope-changing | Redesign to an action-based question or spoken answer; keep the ledger |
| A3 | Six languages cover ≥80% of sampled workers | Roster samples; H5 | The language set is wrong | Configuration + QA | Narrow to the top four present; architecture unchanged |
| A4 | Supervisors will preview and forward without training | Interviews + concierge; H2/H9 | Adoption depends on founder hand-holding | Onboarding + scope | Add guided setup or a one-page share ritual; simplify preview, never remove it |
| A5 | A per-worker CSV record is worth paying for | Interviews; H6 | The audit value proposition is weak | Positioning + pricing | Reposition around supervisor time saved; keep export as a feature, not the pitch |
| A6 | $149–$630/month is payable by a 50–300-worker site | Interviews; H7 | Unit economics or ICP is wrong | Commercial, not product | Change packaging or segment before writing billing code; do not discount the same offer |
| A7 | Name + language is acceptable personal data | Interviews; H8 | Privacy review blocks the pilot | Scope (light) | Add a privacy one-pager and consent copy; revisit the data model only if still blocked |
| A8 | The name is safe or Mafhoom is acceptable | Trademark/domain; H9 | Brand collision | Positioning-only | Launch as Mafhoom / «مفهوم»; product scope unchanged |
| A9 | No competitor combines zero-install + voice + comprehension + audit at this price | Desk research; H10 | The wedge is not defensible | Positioning + roadmap | Sharpen the wedge or change the segment; do not build a me-too intranet |
| A10 | One supervisor can run the pilot site; multiple crews are allowed under that one owner | Pilot sales; H7 | A second supervisor blocks the sale | Scope-changing (seats) | Add seats only for a signed pilot; keep one-owner architecture until then |

**Rule:** an assumption that fails does not get argued with. It gets a written amendment in [04-decision-register.md](./04-decision-register.md), a version bump, and, if scope-changing, a re-estimate.

---

## 9. What Phase 2 locks — and what it leaves open

### Locked (changing these requires a written amendment)

- The problem, the beachhead, the three personas, and the jobs.
- The loop: voice/text/photo in → translate + question + audio → one link → worker answer/Done/Help → board + CSV.
- Zero install, one crew link + name picker, mandatory preview, language snapshot, Understood definition.
- The six-language architecture; the enabled set may narrow without a rewrite.
- v0.1 scope: 57 stories, 204h, four committed SHOULDs; everything in §5.4 stays out.
- No billing, native apps, WhatsApp API, worker accounts, seats, kiosk, PDF pack, or analytics dashboards in v0.1.
- Safety framing: support, not certification; disclaimer on every worker page.

### Provisional (evidence or pilot data may change it)

| Item | Current default | Resolves by | Consequence if changed |
|---|---|---|---|
| Enabled language set | Six | Phase 1 roster samples | Configuration + copy, not architecture |
| Comprehension format | 3-option MCQ, 2 attempts | Concierge + pilot | Prompt, UI, and grading change; ledger shape survives |
| "Not opened" chase threshold | 2 hours | Pilot week 1 | Board filter and reminder copy only |
| Info instruction completion | "Got it" still requires Done | Pilot supervisor feedback (Q5) | Copy and status semantics for Info only |
| Arabic TTS locale | Decide after listening test (ar-AE vs MSA) | Hardening | Voice map only |
| TTS fair-use cap | 150 minutes/org/month | First two pilot weeks | Meter threshold and overage policy |
| Product name | Understood working title | 4 Dec name/domain decision | Branding, domain, and copy only |
| Archived worker with an existing delivery | Recommended: can still complete an already-shared instruction | Phase 2 decision register Q7 | Picker/API guard; audit behavior |

### Not decided here

Pricing, packaging, contract terms, the pilot offer, and the sales funnel live in the [launch plan](../docs/08-launch-growth-plan.md). Phase 2 defines what is built, not what is charged.

---

## 10. Phase 3 handoff

Phase 3 (UX/UI Design) starts from the existing wireframes in [03-user-flows-wireframes.md](../docs/03-user-flows-wireframes.md), not from a blank canvas. This definition constrains the design:

| Design deliverable | Constraint |
|---|---|
| Supervisor visual system, EN + AR RTL | Logical CSS, mirrored navigation, bidi-safe numbers and links; no direction-dependent icons |
| Composer and preview | Voice-first; transcript visible before Generate; every language previewable with audio; edit is per language |
| Worker flow, 320px | One action per screen, ≥48px targets, ≥16px body, native script, audio never autoplay |
| Board | Density that supports 150 workers; icons + labels, never color alone; exception-first ordering |
| Export and settings | Plain, fast, and Excel-safe; no compliance claims |
| Error and empty states | Every state in [doc 03 §8](../docs/03-user-flows-wireframes.md); no dead ends |

**New screen rule:** no screen may be added in Phase 3 unless it maps to a committed story in [02-user-stories-and-priorities.md](./02-user-stories-and-priorities.md). A design idea without a story is a v0.2 note.

---

**Next:** [02-user-stories-and-priorities.md](./02-user-stories-and-priorities.md) — every committed story, its priority, and its release slice.
