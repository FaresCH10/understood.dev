# 01 — System Architecture

**Phase 4 · Document 1 of 7** · Version 0.1 · Date 2026-11-13
**Owner:** Founder · **Status:** Implementation-ready, pending the open decisions in §12
**Builds on:** [TDD](../docs/04-tdd.md) · [Database & API Spec](../docs/05-database-api-spec.md) · [Design pack](../design/README.md) · [Decision Register](../product/04-decision-register.md)

---

## 0. How this pack relates to docs 04 and 05

Docs 04 and 05 already define the stack, collections, endpoints, and lifecycle rules. This pack does not replace them. It turns them into an implementation architecture and reconciles them with what Phase 3 proved.

| Question | Authority |
|---|---|
| What the product must do | PRD (doc 02) and product definition |
| Exact collections, fields, endpoints, error codes, lifecycle guards | **Doc 05** |
| Stack, topology, provider choices, operational constraints | **Doc 04** |
| Screen behavior, copy, visual rules | **Design pack 01–03** |
| Module boundaries, runtime sequences, failure behavior, deployment mechanics, contract deltas | **This pack** |

Where this pack proposes a change to doc 05, it is listed as a **contract delta** in [03-data-and-api-contracts.md](./03-data-and-api-contracts.md) and must be amended into doc 05 before the corresponding story is marked done. No delta is silently assumed.

The Phase 3 prototype is a design artifact, not production code. Its URLs (`worker.html?state=…`), metadata format, and client-side CSV do not ship.

---

## 1. What the architecture must satisfy

| Driver | Consequence |
|---|---|
| Solo founder, no on-call | One deployable, one database, one queue, boring failure modes, runbooks a tired person can follow |
| $0 until a paid pilot | Two-process monolith on one free VM; managed free tiers behind adapters; every upgrade is a config change |
| AI-heavy, latency-tolerant | All model work runs in a queue; the API never waits for a provider; audio is pre-generated before share |
| Six languages, RTL from day one | Language is data, not a build variant; worker catalogs are static; media and fonts are cached per language |
| Low-end Android, poor connectivity | Tiny worker bundle, no autoplay, signed MP3, PWA shell, offline answer outbox, server-authoritative reconciliation |
| Trust is the product | Preview gate, delivery snapshots, hashed tokens, signed media, org isolation, audit timestamps |
| One pilot, then ten | Capacity headroom at pilot scale, explicit upgrade triggers, no premature distribution |

---

## 2. System context

```
                         ┌──────────────────────┐
                         │      Supervisor      │
                         │  desktop, EN / AR    │
                         └──────────┬───────────┘
                                    │ HTTPS, cookie session
                                    ▼
┌───────────────┐        ┌──────────────────────┐        ┌──────────────────┐
│    Worker     │        │   Understood app     │        │  AI providers    │
│  phone, 6     │◄──────►│  supervisor + worker │◄──────►│  Groq (STT/LLM)  │
│  languages    │  link  │  + API + jobs        │        │  Azure (TTS/STT) │
└───────────────┘        └──────┬───────┬───────┘        │  DeepL (fallback)│
                                │       │                └──────────────────┘
                       ┌────────▼─┐  ┌──▼────────┐        ┌──────────────────┐
                       │ MongoDB  │  │  Redis    │        │  Cloudflare R2   │
                       │ metadata │  │ sessions  │        │  audio / photos  │
                       │ records  │  │ queues    │        │  backups          │
                       └──────────┘  └───────────┘        └──────────────────┘
                                                                    ▲
                                                                    │ Resend (email)
                                                                    │
```

**Trust boundaries:**

1. **Public worker surface** — anyone with a crew link can read the audience list. No account, no cookie, no supervisor data.
2. **Authenticated supervisor surface** — cookie session, org-scoped.
3. **Internal process boundary** — API and job worker share code and the same database but no network API between them.
4. **Third-party boundary** — AI, storage, email. No provider receives more than the task needs; no provider is trusted with tenant identity.

---

## 3. Containers and processes

| Container | Technology | Responsibility | Scales by |
|---|---|---|---|
| Caddy | Caddy 2 | TLS, security headers, static files, reverse proxy | Vertical only |
| Supervisor SPA | React 19 + Vite, static | All supervisor screens, EN/AR | CDN/static (later) |
| Worker PWA | React 19 + Vite, static | W-01…W-12, six languages, offline shell | CDN/static (later) |
| API | Node 24, Express 5, TypeScript | HTTP, auth, validation, reads/writes, enqueues jobs | One process at pilot |
| Job worker | Same image, `PROCESS_ROLE=worker` (or `both`) | Pipeline, email batching, cleanup, org deletion | Queue concurrency |
| MongoDB Atlas M0 | MongoDB 7.x | Source of truth for orgs, crews, instructions, deliveries | Atlas tier |
| Redis Cloud | Redis 7.x | Sessions, rate limits, idempotency, BullMQ | Redis plan |
| Cloudflare R2 | S3-compatible | Audio, photos, backups; private + signed URLs | Free tier |
| Resend | HTTP API | Magic links and batched help alerts | Free tier |

**Process model.** One Docker image, two roles:

```bash
PROCESS_ROLE=both   # free tier: HTTP + queue consumers in one process
PROCESS_ROLE=api    # paid path: HTTP only, no queue consumers
PROCESS_ROLE=worker # paid path: queue consumers only, no HTTP
```

`both` is the pilot default. The role switch is the first scaling lever and requires no code change. The API exposes no internal RPC; the worker consumes Redis jobs directly.

**Why not serverless:** sessions, polling, and long-running queue consumers all want a persistent process. Free serverless cold starts would hit the worker's 90-second promise for no cost benefit at pilot scale.

---

## 4. Origin and URL contract

One origin, three surfaces. No CORS, no cross-site cookies.

| Path | Served by | Notes |
|---|---|---|
| `/` and `/assets/*` | Supervisor SPA | Vite `base: '/'` |
| `/signin`, `/home`, `/crews/*`, `/instructions/*`, `/settings` | Supervisor SPA (history fallback) | React Router |
| `/i/*` | Worker SPA | Vite `base: '/i/'`; assets live at `/i/assets/*` |
| `/i/:shareToken` | Worker SPA | The real crew link. Server state decides picker / instruction / completed / closed |
| `/i/preview/:previewToken` | Worker SPA | Read-only preview; matched **before** `/i/:token` |
| `/api/v1/*` | API | All JSON and uploads |
| `/healthz` | API | Liveness + dependency check |

**Production URLs:**

```
Crew link:    https://app.example.com/i/9dK2...
Preview:      https://app.example.com/i/preview/eyJ...
API:          https://app.example.com/api/v1/...
```

**The prototype's deep-link parameters do not ship.** In production the URL carries only the token; the API returns the state (`picker`, `instruction`, `completed`, `closed`, `preview`). This is deliberate: a worker cannot force a state or another worker's identity through the URL.

**Caddy order:**

```
/api/*        → api:3000
/i/*          → try_files {path} /i/index.html   # worker assets or SPA fallback
/*            → try_files {path} /index.html     # supervisor assets or SPA fallback
```

Headers set at the edge for every HTML response: HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` on `/i/*`, a strict CSP, and `Permissions-Policy` denying camera, microphone, and geolocation on worker pages (the supervisor recorder needs microphone on `/instructions/*` only).

---

## 5. Module map and dependency rules

The API is a **modular monolith**. Modules have folders, public service functions, and owned collections.

| Module | Owns (writes) | Reads | Calls |
|---|---|---|---|
| `auth` | `users`, `magic_links`, Redis sessions | `organizations` | `email` |
| `orgs` | `organizations` | counts via read repos | `auth` (user context) |
| `crews` | `crews` | `workers` counts | — |
| `workers` | `workers`, `imports` | `crews` | — |
| `instructions` | `instructions` (draft/media/transcript) | `variants` | `media`, `pipeline` |
| `pipeline` | `variants`, `audio_assets`, `ai_usage` | `instructions` | providers, `media`, `usage` |
| `sharing` | share token fields, `deliveries` | `instructions`, `workers`, `variants` | `tokens` |
| `deliveries` | `deliveries` (worker mutations) | `instructions`, `variants` | `email`, `media` |
| `board` | — (read-only) | instructions, deliveries, workers | — |
| `exports` | — (read-only) | instructions, deliveries, workers | — |
| `settings` | `organizations` | `ai_usage` | — |
| `email` | `email_log` | — | Resend |
| `media` | R2 objects | `instructions`, `variants` | R2 |
| `usage` | `ai_usage` | — | — |

**Dependency rules, enforced by review and ESLint:**

1. No module imports another module's Mongoose model. Cross-module access goes through a service or read repository.
2. `packages/shared` contains only pure types, Zod schemas, language constants, prompt contracts, and the typed API client. No I/O, no Mongoose, no Node APIs.
3. A cross-module write is owned by exactly one service. For example, `sharing` creates deliveries; `deliveries` never creates them.
4. `board` and `exports` are read-only. They may query collections through read repositories but may not write.
5. Circular module imports fail CI (`import/no-cycle`).
6. Providers are behind interfaces. Domain code never imports an SDK directly; it receives a provider port.

This is enough structure to keep a solo codebase navigable without turning it into a distributed system on paper.

---

## 6. Frontend architecture bridge

Phase 3 defined the visual system; Phase 5 must implement it without forking it.

### 6.1 Design tokens

- `design/prototype/tokens.css` remains the canonical token file.
- Phase 5 copies it to `packages/design-tokens/tokens.css` and imports it in both apps.
- Tailwind's theme maps names to CSS variables (`colors.primary: 'var(--primary)'`), so there is one palette and no generated duplicate.
- A CI check diffs the app copy against the design file and fails on drift. Design changes are made in the design pack first, then synced.
- Components use logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`); physical classes are lint-banned except media-control internals.

### 6.2 Fonts

The Phase 3 prototype loads Google Fonts. Production must not:

- Self-host WOFF2 subsets under `/fonts` on the same origin (worker: `/i/fonts`).
- Latin Inter and Arabic Noto Sans Arabic are preloaded (`font-display: swap`); Arabic is subset to Arabic + Latin digits + punctuation.
- Devanagari, Bengali, and Malayalam use the device's system stack first (TDD §9.2). A Noto webfont is optional and only if the measured device matrix shows missing glyphs.
- Worker font budget: ≤90 KB WOFF2 for the critical Latin + Arabic subsets; Indic webfonts are not on the critical path.
- No runtime request to `fonts.googleapis.com` or `fonts.gstatic.com`; CSP does not allow them.

### 6.3 Apps and routes

| | Supervisor | Worker |
|---|---|---|
| Routes | `/signin`, `/home`, `/instructions`, `/instructions/:id`, `/crews`, `/crews/:id`, `/settings` | `/i/:token`, `/i/preview/:token` |
| Auth | Cookie session; `GET /me` on boot | Share token in path; delivery token in memory + localStorage |
| Data | TanStack Query; polling intervals from 02 | `fetch` + a tiny store; no background polling after content load |
| Bundle budget | ≤350 KB gzip initial | ≤180 KB gzip initial (hard gate) |
| PWA | None in v0.1 | Shell precache + audio runtime cache + offline outbox |
| i18n | i18next EN/AR | Six static catalogs, no runtime i18n library |

The worker's UI language before identify is a client concern: remembered language → `navigator.language` → instruction source language → English. The chosen language is passed to `identify` so the instruction opens in the language the worker can read. This closes a gap in doc 05 (delta D-02).

### 6.4 Worker route states

The worker SPA renders one of five server-derived states:

```
loading → picker → instruction → completed
                 ↘ closed (410)
preview token → preview instruction (no writes, no persistence)
```

No URL parameter selects a state. Preview uses a separate signed token and a separate route.

---

## 7. Cross-cutting policies

| Concern | Policy |
|---|---|
| Configuration | One Zod-validated env schema at boot. Missing/invalid config fails fast with a readable message. `PROCESS_ROLE` selects API, worker, or both. |
| Request identity | `X-Request-Id` accepted if well-formed, else generated (`req_` + 16 random bytes base64url). Echoed and attached to logs/Sentry. |
| Time | Store UTC, emit ISO-8601, display in `org.timezone`. The 24-hour "understood" window is anchored to `instruction.sharedAt` and computed server-side. |
| Validation | Zod at HTTP boundaries and at job boundaries. Unknown fields rejected. Provider output validated before persistence. |
| Errors | Doc 05 catalog only. Domain errors carry a code; the HTTP layer maps them. Provider messages and stacks never reach clients. |
| Logging | pino JSON to stdout. No names, emails, phone numbers, instruction bodies, or tokens. IDs only. |
| Idempotency | Worker mutations require `Idempotency-Key`; a Redis wrapper stores request hash + response for 24h. Share and generate are idempotent by state guard. |
| Rate limits | Redis counters; headers and `Retry-After` per doc 05. |
| Feature flags | `org.features` object; default v0.1 behavior. No flag may enable an unbuilt surface. |
| Seed/demo | `seed-demo` creates exactly the Phase 3 demo org, 24 workers, one shared instruction. Never run against production data. |
| Migrations | Mongoose `autoIndex` is **off** in production. Indexes and data migrations run from versioned scripts before the new image takes traffic. |

---

## 8. Request paths at a glance

Detailed sequences are in [02-runtime-and-pipeline.md](./02-runtime-and-pipeline.md).

**Supervisor read/write**

```
browser → Caddy → API (session middleware → Zod → module service → Mongo)
                → enqueue job (if generation/email) → response
```

**Worker read**

```
phone → /i/:token (static shell) → GET /api/v1/w/:token
      → audience + localized titles + state
```

**Worker write**

```
phone → POST /w/:token/identify → delivery token
      → POST /w/answer | /complete | /help (Bearer + Idempotency-Key)
      → conditional Mongo update → response
```

**Media**

```
payload carries a short-lived signed R2 URL (audio/photo)
audio element loads R2 directly; on expiry the client asks the
delivery-token endpoint for a fresh signed URL
```

The last line is a deliberate contract fix: a bare `<audio src="/api/v1/w/audio/…">` cannot send a bearer token. See delta D-01.

**Preview**

```
supervisor → POST /instructions/:id/preview-token (cookie)
           → opens /i/preview/:previewToken
           → GET /api/v1/w/preview/:previewToken (read-only)
```

---

## 9. Scale envelope and limits

| Dimension | v0.1 limit | Rationale |
|---|---|---|
| Orgs | 1–10 pilot | Free tiers and one operator |
| Active workers per org | 1,000 (service guard) | Audience payload and CSV size |
| Instruction text | 2,000 chars | TTS cost and comprehension |
| Supervisor audio | 3:00 hard, 3:05 server tolerance | Provider and UX bound |
| Languages per instruction | Six by default (P4-1); audience-only if rejected | TTS cost vs a language switch that always works |
| Audience per instruction | 1,000 | Delivery write batch |
| Instructions per org per month | ~12 expected; generate limit 10/hour | Abuse and cost guard |
| Concurrent pipeline jobs | 2–3 | Provider rate limits |
| Board polling | 15s, visible tab only | Load and freshness |
| Processing polling | 2s, stops at terminal state | UX |
| API p95, non-pipeline | ≤300ms | Board feels instant |
| Pipeline p95 | ≤45s at 4 languages · ≤60s at six | Supervisor patience |
| Worker FCP on 3G | ≤2.0s | Low-end Android |

**Scale ceiling of this design:** roughly 10 pilot orgs, 75–100 workers each, 12 instructions/month, 4–6 languages — thousands of deliveries and hundreds of audio assets per month. The first bottleneck is provider rate limits, not Mongo, Redis, or the VM.

**Upgrade triggers:** TTS usage > 80% of the free grant; Redis memory > 24MB; Mongo > 400MB; board p95 > 300ms; pipeline p95 > 90s for two consecutive days; a second supervisor needs concurrent access; availability complaints during working hours.

---

## 10. Frozen boundaries and non-goals

Not built in v0.1, and not to be smuggled in through "small" additions:

- Microservices, separate pipeline service, event bus, Kubernetes.
- Websockets or SSE. Polling is the decision (D4).
- SSR, server components, a marketing site in the same app.
- A second database, a search engine, or a cache layer beyond Redis.
- Per-worker accounts, passwords, employee IDs, or personal links.
- WhatsApp Business API, SMS, push notifications.
- Team seats, roles beyond owner, approvals, SSO.
- Billing, plans, metering beyond the soft TTS cap.
- PDF export, analytics dashboards, charts, scheduled or recurring instructions.
- Dark mode, theming, illustration, video instructions.
- Native mobile apps.

Seams for these exist in docs 04 and 05 (`channel`, `seriesId`, `plan`, `features`, provider interfaces). Seams are not implementations.

---

## 11. Architecture invariants

These are asserted in code and tests; violating one is a defect, not a trade-off.

1. Every org-scoped query includes `orgId` from the session; no client-supplied `orgId` is trusted.
2. A worker token resolves exactly one delivery and never another instruction.
3. A delivery's language and variant never change after completion.
4. Share is impossible unless every variant is ready, or the supervisor explicitly accepts text-only for failed languages.
5. A variant edit after ready re-enters processing and blocks share.
6. The API request path never calls an AI provider synchronously.
7. Every job stage is idempotent; repeated execution produces the same assets and state.
8. Audio and photos are private; access is authorized then signed, never public.
9. Exports are generated from stored delivery snapshots, not live joins that can rewrite history.
10. Preview writes nothing: no deliveries, no events, no localStorage identity.
11. The worker page never autoplays audio and never shows a question before the instruction text.
12. "Understood" means first-attempt correct + completed within 24h of `sharedAt`, computed server-side.

---

## 12. Decisions this pack needs before Phase 5 week 3

| # | Decision | Default / recommendation | Why it blocks |
|---|---|---|---|
| **P4-1** | Language change to a language with no variant (W-11) | Generate all six variants by default; see ADR-11 and 03 §9 | Determines pipeline fan-out, worker language sheet, TTS cost, and whether an error state is needed |
| **P4-2** | Archived worker after share (Q7) | Existing delivery remains openable; a worker archived before share has no delivery; already reflected in doc 05 v0.2.0 guards; see ADR-12 | Confirms the guard, the closed screen, and the audit consequence; closes Q7 |
| **P4-3** | Preview token TTL | 15 minutes, stateless; see ADR-08 | Already specified in doc 05 §4.4; confirm before endpoint freeze |
| **P4-4** | Font strategy | Self-host Latin/Arabic; system Indic; see ADR-18 | Changes CSP, worker bundle, and device QA |

Everything else in this pack follows locked decisions. These four are surfaced, not silently chosen.

---

**Next:** [02 — Runtime & Pipeline](./02-runtime-and-pipeline.md)
