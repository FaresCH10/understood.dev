# Product Brief — Understood

**Version:** 0.2 (draft — updated with founder base, payment reality, and language priorities)
**Date:** 2026-11-12
**Founder base:** Lebanon — remote-first sales into the GCC, no existing industry network
**Status:** Working title — validate name (possible collision with Understood.org; GCC-friendly alternative: Arabic «مفهوم» — *mafhoom*, "understood")

---

## 1. One-line pitch

Understood turns a supervisor's voice note into every worker's language — and proves each worker actually understood it.

## 2. Vision

Every frontline worker in the Gulf understands what is expected of them, in their own language, every shift.

Three-year ambition: become the compliance-grade record of *who understood what* on GCC frontline sites — the way safety records became non-negotiable.

## 3. The problem (what happens today)

- Supervisors brief crews verbally in mixed Arabic / English / Hindi. Comprehension is assumed, never verified.
- Instructions live in WhatsApp groups: buried within hours, untranslated, untracked, with no record of who read, heard, or understood.
- New workers — often weeks into the country — learn the job from a bilingual colleague. It's a telephone game, and mistakes compound.
- Miscommunication costs real money: rework, quality escapes, safety incidents, and HSE audit findings for missing briefing records.
- Existing deskless apps (Beekeeper, Connecteam, Staffbase) demand app installs, English menus, and per-seat budgets designed for office-adjacent staff. Frontline adoption dies within weeks.

**Job to be done:** *"When I assign work to a multilingual crew, I want each worker to receive and truly understand it in their language, so the job is done right and I have a record — without chasing people."*

## 4. Who it's for (beachhead recommendation)

**Recommended first market:** UAE first (Dubai / Sharjah), then KSA.
**Recommended first vertical:** mid-size facilities management & cleaning companies (100–1,000 workers), then logistics/warehousing. Construction enters later through the toolbox-talk compliance angle.

**Why this beachhead, not "everyone":**
- FM/cleaning is extremely multilingual, already WhatsApp-run, has recurring daily instructions (high usage frequency), and shorter sales cycles than construction.
- Construction is the larger prize but carries heavier procurement and compliance; enter once the toolbox-talk module is proven.
- 100–1,000 workers = one decision-maker can say yes; large enough that per-worker pricing matters.
- **Founder base is Lebanon.** The Gulf is reached remotely: the product is link-based, so a pilot can run in Dubai while you are in Beirut. Same time zone. One closing trip (~$300–500) is funded by pilot revenue, not savings.
- **Diaspora shortcut.** A large share of GCC operations, HSE, and FM managers are Lebanese or Lebanon-educated — the first 30 conversations should start inside that network before any cold outreach.

**Personas**

| Role | Who | What success looks like |
|---|---|---|
| Buyer | Ops / HR / HSE manager | Fewer mistakes, audit-ready records, no new app for workers |
| Champion | Site supervisor | Says it once, stops repeating, sees who actually got it |
| End user | Frontline worker (low–moderate digital literacy, low-end Android, personal phone + shared site tablet) | Hears/reads the instruction in their language, confirms it, can ask for help |

Influencers: HSE auditors and the FM company's clients (who ask for proof of communicated safety instructions).

## 5. The solution (v1 experience)

**Supervisor (web app, English + Arabic with full RTL):**
1. Records a voice note, types, or attaches a photo. Picks a crew or individual workers — or starts from a template ("Toolbox talk: scaffolding").
2. The AI pipeline transcribes → translates → generates natural audio in each worker's language.
3. Distributes. **MVP:** supervisor pastes per-crew magic links into the WhatsApp group they already use (zero API cost). **Later:** WhatsApp Business Cloud API + web push.

**Worker (zero install):**
Link opens instantly in their language: instruction text, one big play button (audio), one comprehension question (tap the answer, or speak it), then **Done** or **I need help**.

**Supervisor dashboard:**
Live board — delivered / opened / heard / answered / completed — plus who needs help. One-click audit export (CSV first, PDF compliance pack later).

## 6. The four ideas that make it different

1. **"Understood" is a verb, not a read receipt.** A short AI-generated comprehension check (tap or spoken answer) converts communication into a verifiable record. Long-term moat: a per-worker, per-instruction, per-language comprehension ledger that HSE audits can rely on.
2. **Voice-in, voice-out.** Supervisors communicate the way they already do — WhatsApp voice notes. No typing, no English, no forms.
3. **WhatsApp-native, zero-install.** Ride the channel workers already use. The MVP costs $0 in messaging because links are shared through existing WhatsApp groups. The app is a fallback, never the front door.
4. **Per-company safety glossary + translation memory.** Safety-critical terms are approved once by the customer and reused forever. Translations stay consistent, get cheaper over time, and build switching costs.

**Later amplifiers:** comprehension analytics by language/crew ("your Malayalam speakers consistently miss fall-protection questions"); photographing existing paper SOPs/posters to auto-digitize them into translated voice instructions.

## 7. Business model

- **B2B SaaS, per active worker per month**, tiered; supervisors and crews unlimited within tier. Indicative pricing to validate: **$1.5–2.5/worker/month**, minimum plan ~$150–250/month. AI fair-use limits per tier.
- **Zero-budget start:** a paid **design-partner pilot** (one site, one supervisor group, 6–8 weeks) at roughly AED 1,500–3,000. Pilot revenue funds the ~$20–40/month stack.
- **Getting paid from Lebanon:** Stripe and mainstream GCC gateways (Tap, PayTabs) are not available to a Lebanon-registered merchant. Invoice pilots in USD via Payoneer; use a merchant-of-record (Paddle or Lemon Squeezy — confirm current Lebanon support) to automate subscriptions later. Register a UAE entity only when MRR justifies it (~$1.5–4k/year).
- **Land & expand:** one site → all sites of the FM company → toolbox talks + audit exports → analytics tier → HR roster integrations.

**$0 → first customer → $20–40/month stack:**

| Phase | What runs | Cost |
|---|---|---|
| Build + demo | Local dev; Vercel free + Render free / Oracle Always Free; Atlas M0; Redis free; R2 free; Azure Speech free tier; Groq free tier | $0 |
| First pilot customer | Turn on paid API instance (no cold starts), paid Redis, WhatsApp Cloud API or SMS as needed, domain | ~$20–40/mo |

## 8. MVP scope

**In (v0.1, target ~6 weeks part-time):**
- Supervisor web app: English + Arabic (RTL); email magic-link login
- Instruction creation: text, voice recording, photo
- Crew management + CSV roster import; worker language profiles
- AI pipeline: transcribe, translate, TTS with per-language audio caching
- Worker mobile web page via magic link: text + audio + 1 MCQ + "Done" / "Help"
- Live status board + CSV audit export
- Worker languages (native script in the UI): **Arabic (Gulf), English, Hindi, Urdu, Malayalam, Bengali** — the six that cover the bulk of GCC construction, FM, and cleaning crews. Add **Tamil, Tagalog, Nepali** within weeks; later Telugu, Kannada, Punjabi, Sinhala, Amharic. Audio-first is non-negotiable: many workers speak the language but read the script with difficulty.

**Out (deliberately):** WhatsApp API integration, native apps, SMS/OTP, automated billing, advanced analytics, kiosk mode, video, HR integrations, PDF compliance pack.

**After pilot revenue:** WhatsApp Cloud API delivery + receipts, toolbox-talk templates + compliance PDF export, Stripe/Tap billing, more languages, shared-device QR kiosk, two-way translated help chat, analytics, roster integrations, paper-SOP digitization.

## 9. Success metrics

- **North star:** % of instructions "understood" (opened + answered correctly + completed) within 24h.
- **Activation:** first instruction sent to ≥5 workers in the first session; ≥60% worker response within 24h.
- **Pilot gate (go/no-go to paid):** ≥1 design partner converts; comprehension response >70%; supervisor sends ≥3 instructions/week.
- **Business:** pilot → paid conversion, workers per account, logo churn.

## 10. Key risks & mitigations

| Risk | Mitigation |
|---|---|
| Mistranslation of safety-critical text | Customer glossary, human approval for safety templates, side-by-side bilingual text, start with non-safety workflows; position as support for — not replacement of — certified training |
| Worker adoption / literacy | Audio-first UI, WhatsApp link path, supervisor-led onboarding, activation measured from day one |
| AI cost creep (TTS/STT per minute) | Per-language audio cache, template reuse, tier limits, cheaper TTS for non-critical content |
| WhatsApp policy/pricing changes | Channel abstraction; PWA push + link sharing always works |
| Worker data privacy | Minimal PII, tenant isolation by company, region hosting (UAE/KSA) when enterprise demands it |
| Payment collection from Lebanon | USD invoices via Payoneer; merchant-of-record for subscriptions; UAE entity only when revenue justifies it |
| Zero network, remote-only selling | Diaspora-first outreach, async demo video, white-glove remote pilots (you set everything up; the supervisor only forwards links) |
| $0 budget discipline | Strict MVP list above; everything else parked until a customer pays |
| Name collision | Treat "Understood" as working title; test «مفهوم» with Gulf customers |

## 11. Validation & first customers (no network, zero budget)

1. **Interviews (10):** FM supervisors/ops in UAE — today's flow, WhatsApp habits, worst miscommunication incidents, audit pain.
2. **Pilot demand (3):** companies agree to a free 2-week pilot with one crew; goal is 1 paid conversion.
3. **Languages:** check real rosters — do 5 languages cover 80%+ of workers?
4. **Price:** present 3 packages; test reaction to per-worker pricing + pilot fee.
5. **Trust:** show a voice-note → translated-audio demo; would they use it for safety briefings? What would make them trust it?

**Concierge MVP first (week 1–2, no code):** for one friendly crew, manually translate the supervisor's daily brief, generate audio with free tools, and send it with a link plus a one-question Google Form. If the supervisor asks for it again on day three, the pain is real and the build is justified.

**Zero-network outreach engine (first 90 days):**
- 100 LinkedIn connections/week to GCC ops/HSE/FM managers; use the alumni filter for Lebanese universities (AUB, LAU, USJ) working in the UAE, Qatar, and KSA.
- Join ~10 Gulf FM/cleaning/HSE WhatsApp and Facebook groups; be useful, then invite to a 10-minute remote demo.
- One-page pitch in English + Arabic; a 3-minute demo video (voice note → six languages → worker confirms).
- The pilot offer has zero setup for the customer: you import the roster, generate the links, and the supervisor simply forwards them.

## 12. Positioning statement

*For GCC operations, HR, and HSE managers with multilingual frontline crews, Understood is the voice-first communication system that delivers every instruction in each worker's own language and proves it was understood — unlike employee apps that require installation, English menus, and read receipts that prove nothing.*

---

**Next document:** PRD — features, roles, and behavior. Run the §11 concierge MVP and interviews in parallel; the PRD gets sharper with every conversation.
