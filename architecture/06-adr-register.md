# 06 — Architecture Decision Register

**Phase 4 · Document 6 of 7** · Version 0.1 · Date 2026-11-13
**Owner:** Founder · **Status:** 22 decisions — 19 accepted; 3 proposed (P4-1, P4-2, P4-4)

---

## How to read this

An ADR records a decision that constrains code, with the trade accepted. Accepted decisions are implemented as written. **Proposed** decisions have a working default already described in the pack; the founder can flip them before Phase 5 without rewriting architecture. Product decisions live in the [decision register](../product/04-decision-register.md); this register covers technical and design-adjacent choices.

| # | Decision | Status |
|---|---|---|
| ADR-01 | Modular monolith, one image, `api`/`worker`/`both` roles | Accepted |
| ADR-02 | One origin, Caddy path routing, no CORS | Accepted |
| ADR-03 | Static SPAs; worker state is server-derived, not URL-derived | Accepted |
| ADR-04 | Polling only; no websockets or SSE | Accepted |
| ADR-05 | Magic link + opaque Redis session | Accepted |
| ADR-06 | Share token stored as HMAC hash + AES-GCM ciphertext | Accepted |
| ADR-07 | Delivery token per delivery, five-device cap | Accepted |
| ADR-08 | Stateless 15-minute preview token, read-only | Accepted (TTL provisional — P4-3) |
| ADR-09 | Share is a MongoDB transaction | Accepted |
| ADR-10 | One resumable job per variant; generation/revision fencing | Accepted |
| ADR-11 | Generate all six language variants | **Proposed** (P4-1) |
| ADR-12 | Delivery-derived audience; archived worker keeps existing delivery | **Proposed** (P4-2 / Q7) |
| ADR-13 | Signed R2 URLs in worker payloads; media endpoints return JSON | Accepted |
| ADR-14 | Per-instruction delivery list is unpaginated (≤1,000) | Accepted |
| ADR-15 | Org-scoped TTS cache at `orgs/{orgId}/audio/{hash}.mp3` | Accepted |
| ADR-16 | One `TOKEN_PEPPER` for magic links, sessions, share, delivery | Accepted |
| ADR-17 | Encrypted nightly Mongo dumps; media is not separately backed up | Accepted |
| ADR-18 | Self-host Latin/Arabic fonts; system stack for Indic scripts | **Proposed** (P4-4) |
| ADR-19 | No general admin audit log in v0.1 | Accepted |
| ADR-20 | Batched help emails within 10 minutes; reminders are copy-only | Accepted |
| ADR-21 | `autoIndex` off; expand → migrate → contract | Accepted |
| ADR-22 | Board/exports are read-only; all KPI math is server-side | Accepted |

---

## ADR-01 — Modular monolith with process roles

**Status:** Accepted · **Supersedes:** nothing

**Context.** One founder must build and operate this. The workload has two shapes: latency-sensitive HTTP and long-running AI jobs. A separate pipeline service would add deployment, networking, and failure modes before there is traffic to justify them.

**Decision.** One TypeScript codebase, one Docker image, `PROCESS_ROLE=both|api|worker`. Modules own folders and collections, with dependency rules enforced by lint and review ([01 §5](./01-system-architecture.md)). Jobs consume Redis directly; there is no internal RPC.

**Consequences.** Positive: one deploy, one log stream, one set of types, zero network hops between API and jobs. Negative: scaling is coarse — the first scaling move is splitting the role, not scaling a module. A crash takes both HTTP and jobs down until the supervisor restarts; acceptable at pilot.

**Alternatives rejected.** Microservices (ops burden), serverless functions (cold starts, no persistent queue consumers), a separate worker repo (duplicate types and deploy pipeline).

---

## ADR-02 — One origin, path routing

**Status:** Accepted

**Context.** Cookies, CSP, and share links are simpler on a single origin. Separate subdomains would require CORS, cross-site cookie rules, and more DNS/TLS surface.

**Decision.** `app.example.com` serves supervisor at `/`, worker at `/i/*`, API at `/api/v1/*`, health at `/healthz`. Caddy routes by path. No CORS for app traffic.

**Consequences.** Positive: no CORS, no cookie `SameSite=None`, one TLS cert, one CSP family. Negative: a bad Caddyfile takes everything down; the worker's asset path is nested (`/i/assets`), which needs a Vite `base` setting and a fallback rule.

**Alternatives rejected.** `app.` + `work.` subdomains (CORS/cookie complexity), API on a separate domain (third-party cookie erosion).

---

## ADR-03 — Static SPAs, server-derived worker state

**Status:** Accepted

**Context.** Phase 3 used worker URL parameters (`?state=…&worker=…`) for review. Shipping those would let a worker force a screen or another identity.

**Decision.** Both frontends are static Vite builds. The worker route is `/i/:token`; the API decides `picker`, `instruction`, `completed`, or `closed`. Preview is a separate route and token. No SSR, no server-rendered names or tokens in HTML.

**Consequences.** Positive: worker bundle is small and cacheable; link-preview crawlers see no PII; state cannot be forged by URL. Negative: first paint shows the shell before data; the API must be fast on slow networks, and the PWA shell must precache.

**Alternatives rejected.** SSR (bigger surface, slower cold start on free VM), prototype-style query parameters (security and correctness bug).

---

## ADR-04 — Polling, no websockets

**Status:** Accepted · **Locks:** PRD D4

**Context.** The supervisor watches a processing screen for ~45 s and a board that changes over hours. Websockets add connection state, reconnection logic, Redis pub/sub, and a class of bugs that a solo operator does not need.

**Decision.** Processing polls every 2 s (backs off to 5 s after a minute); board polls every 15 s only while visible; nothing polls in a hidden tab. Worker pages do not poll after content load.

**Consequences.** Positive: trivial infrastructure, works through every proxy, no socket lifecycle. Negative: freshness is bounded by the interval; a share by another device can take 15 s to appear. Acceptable for one supervisor.

**Alternatives rejected.** SSE (still persistent connections), websockets (unnecessary complexity), long polling (worse than short intervals here).

---

## ADR-05 — Magic link + opaque Redis session

**Status:** Accepted

**Context.** One owner, no passwords, no SSO. Passwords create reset flows, hashing choices, and credential-stuffing risk. JWTs would put session state in a token that cannot be revoked simply.

**Decision.** 32-byte single-use magic link, HMAC-hashed, 15-minute expiry, always the same response. Verify creates a 32-byte opaque session stored in Redis and a `__Host-u_session` cookie (`HttpOnly; Secure; SameSite=Lax`), 30-day sliding. Origin checked on mutations.

**Consequences.** Positive: no password database, server-side revocation, simple code. Negative: email deliverability is now an auth dependency; Redis loss signs everyone out. Both are documented and accepted.

**Alternatives rejected.** Passwords (reset/security burden), JWT (revocation complexity), OAuth (no identity provider for this buyer).

---

## ADR-06 — Share token: hash + ciphertext

**Status:** Accepted · **Locks:** B2

**Context.** The token must be unguessable, must not be recoverable from a database leak alone, and must be re-displayable weeks later when the supervisor copies the link again.

**Decision.** Lookup by `HMAC-SHA256(TOKEN_PEPPER, raw)`; re-display by decrypting `AES-256-GCM(raw, TOKEN_ENC_KEY)`. Both stored on the instruction; regeneration replaces both and sets `shareTokenRevokedAt`.

**Consequences.** Positive: DB-only leak yields neither working links nor a usable hash reversal. Negative: key rotation requires an application-level re-encrypt migration (04 §6.3); two secrets to protect.

**Alternatives rejected.** Plaintext token (leak = live links), hash only (cannot re-display), deterministic encryption (weaker than GCM).

---

## ADR-07 — Delivery token per delivery, five-device cap

**Status:** Accepted · **Locks:** B3

**Context.** Workers use shared and personal phones, often switch devices, and never create accounts. A crew-level token would let one worker act as another. Per-worker permanent tokens would require identity infrastructure the product does not have.

**Decision.** Identify issues a 32-byte delivery token bound to one delivery; server stores hashes, caps at five, evicts the oldest. The client keeps it in `localStorage` keyed by instruction. Delivery token mutations are rate-limited per delivery.

**Consequences.** Positive: narrow scope, no account, multi-device support, simple revocation by eviction. Negative: a worker on a sixth device silently evicts the first; `localStorage` clearing forces re-identify. Both are acceptable.

**Alternatives rejected.** Crew-level token (lateral movement), per-worker permanent token (becomes an account), cookie session for workers (shared-device confusion).

---

## ADR-08 — Stateless preview token

**Status:** Accepted; **TTL provisional (P4-3)**

**Context.** Supervisors review the worker experience before sharing. Preview must not create deliveries, events, or persistent identity, and must not require a worker name.

**Decision.** HMAC-signed payload `{instructionId, exp, kind:'preview'}`; no DB row; 15-minute TTL; read-only; separate route `/i/preview/:token`; all writes return `403 PREVIEW_MODE`.

**Consequences.** Positive: zero write surface, no cleanup job, instant issuance. Negative: cannot revoke an individual preview before expiry (15 minutes); a leaked preview token exposes one instruction read-only for its lifetime. P4-3 confirms 15 minutes versus a shorter 5.

**Alternatives rejected.** DB-backed preview sessions (cleanup, extra collection), reusing the share token (would record opens and confuse the board).

---

## ADR-09 — Share is a transaction

**Status:** Accepted · **Related:** D-08

**Context.** Share changes the instruction, creates a token, sets `sharedAt`, potentially downgrades variants to text-only, and inserts one delivery per active worker. A mid-loop failure could leave a "shared" instruction with a partial audience.

**Decision.** One Mongo transaction guarded by `status ∈ {ready, partial_failure}`; delivery inserts inside it; unique `{instructionId, workerId}` makes retries safe. Second share returns `SHARE_CONFLICT`; the client recovers via `share-link`.

**Consequences.** Positive: no partial shares, no duplicate deliveries, clear concurrency control. Negative: requires a replica set (Atlas M0 has one); the transaction holds for the insert duration at 1,000 rows (~tens of ms).

**Alternatives rejected.** Read-then-write loop (race), background job with eventual consistency (supervisor sees a wrong count), no transaction with cleanup (partial audiences).

---

## ADR-10 — Per-variant resumable job + revision fencing

**Status:** Accepted · **Supersedes:** TDD §7.1 job granularity

**Context.** Stage-per-job orchestration creates 18 jobs for six languages, and a worker crash mid-stage can re-pay for completed work. Concurrent edits can also let an old job overwrite new assets.

**Decision.** One BullMQ job per variant runs translate → question → audio sequentially, persisting each stage and resuming from the first unfinished one. `instruction.generation` and `variant.revision` fence every write; job IDs include both. Finalize recomputes from the database. Stage-local retries remain 3 (1 s/5 s/20 s).

**Consequences.** Positive: fewer jobs, resumability, stale writes impossible, simpler logs. Negative: question and audio do not run in parallel, adding ~3–5 s per language; a deviation from the TDD's job diagram that must be reflected in the backlog's pipeline tasks.

**Alternatives rejected.** Stage jobs with FlowProducer (more moving parts, same result), parallel question/audio (slightly faster, harder failure story), job-level dedupe only (does not stop stale writes after an edit).

---

## ADR-11 — Generate all six language variants

**Status:** **Proposed** (P4-1) · **Working default:** enabled via `PIPELINE_ALL_LANGUAGES=true`

**Context.** W-11 offers all six languages at any time, including before identify. The recovery case is real: a worker listed as Hindi who actually reads Malayalam switches on the name screen. If that variant does not exist, the worker is stranded at the moment they are trying to understand a safety instruction.

**Decision.** Generate one variant per supported language (six) for every instruction by default. The audience still determines deliveries; languages determine content. If the founder rejects the cost, the pipeline uses audience languages and the language sheet must disable unavailable rows (`LANGUAGE_UNAVAILABLE`).

**Consequences.** Positive: language switching always works; no stranded worker; simpler copy and state. Negative: ~50% more TTS cost (57.6k chars/org-month at six vs ~38k at four); the 500k free grant covers ~8.7 org-months at full volume, with an 80% trigger at ~7 orgs. Pilot scale is 1–3 orgs.

**Alternatives rejected.** Audience languages only (stranded switch), English fallback (not a language the worker reads), on-demand generation at switch time (latency and failure at the worst moment).

---

## ADR-12 — Delivery-derived audience; archived worker keeps access

**Status:** **Proposed** (P4-2, closes Q7) · **Working default:** allow

**Context.** Workers can be archived between generate and share, and after share. C6 drops archived workers at share. Doc 05's guard said identify requires an active worker, which would strand a worker who was archived after share but already has a delivery.

**Decision.** After share, the picker audience is the set of workers with a delivery. A worker archived after share can identify, open, and complete the existing delivery. A worker archived before share has no delivery and cannot identify. No new deliveries are ever created for archived workers.

**Consequences.** Positive: the delivery record stays truthful; a worker who was briefed can prove it even if they left the roster. Negative: an archived worker still appears in the picker for that instruction until its link closes; supervisor sees a name they thought was removed. The board labels archived workers only if the roster join says so (optional).

**Alternatives rejected.** Block archived workers entirely (breaks Q7 and audit truth), hide them but keep deliveries (worker cannot open), regenerate audience at share (loses snapshot semantics).

---

## ADR-13 — Signed R2 URLs in worker payloads

**Status:** Accepted · **Related:** D-01

**Context.** Doc 05 originally returned `/api/v1/w/audio/:variantId` as an audio URL. An `<audio src>` element cannot attach an `Authorization` header, so the delivery token would never reach the endpoint. Fetching audio as a blob and creating object URLs works but breaks media caching and complicates the service worker.

**Decision.** Worker payloads carry short-lived signed R2 URLs (15 minutes) plus `expiresAt`; `GET /w/audio/:variantId` (bearer-authenticated) returns a fresh `{url, expiresAt}` JSON. The audio element loads R2 directly. Preview uses its own signed-token endpoint.

**Consequences.** Positive: native streaming, range requests, simple caching, no token in a query string. Negative: URLs expire and the client must refresh; R2 CORS and CSP must allow the bucket host; a signed URL is bearer-like for 15 minutes (acceptable, single object).

**Alternatives rejected.** Token in query string (leaks in logs/referrers), blob fetch (memory and cache cost on low-end phones), public bucket (privacy).

---

## ADR-14 — Per-instruction delivery list is unpaginated

**Status:** Accepted · **Related:** D-17

**Context.** The board filters and searches instantly over the whole instruction. Server-side pagination with client-side filtering would search only the loaded page; server-side name search would require a join/sort that the schema does not index.

**Decision.** `GET /instructions/:id/deliveries` returns the full audience, capped at 1,000 (the audience cap), with `meta.counts`. The UI filters and searches locally. The `filter` param remains for API callers.

**Consequences.** Positive: correct filters, one request, instant UI, counts always consistent. Negative: payload up to ~250 KB uncompressed at 1,000 workers (~40 KB gzip); not a general-purpose API shape. At pilot scale (24–75 rows) it is trivial.

**Alternatives rejected.** Cursor pagination with server search (unindexed join), capped page with "load more" (filters lie), denormalizing worker names into deliveries (schema and history cost for a v0.1 non-problem).

---

## ADR-15 — Org-scoped TTS cache path

**Status:** Accepted · **Supersedes:** TDD §7.5 storage path

**Context.** TDD stored audio under the instruction (`orgs/{orgId}/instructions/{instructionId}/{lang}-{hash}.mp3`); doc 05 stores it in an org-level cache (`orgs/{orgId}/audio/{hash}.mp3`). The instruction path makes cross-instruction reuse impossible, contradicting D9.

**Decision.** Doc 05 wins: cache at `orgs/{orgId}/audio/{sha256(...)}.mp3`, deduped by `audio_assets`, touched on use, cleaned after 180 days when unreferenced.

**Consequences.** Positive: true org-scoped cache; repeated titles/boilerplate cost nothing; one delete prefix for org removal. Negative: audio is not co-located with its instruction for manual inspection; the asset row is the mapping.

**Alternatives rejected.** Instruction-scoped path (no reuse), global cache (D9 privacy posture).

---

## ADR-16 — Single token pepper

**Status:** Accepted

**Context.** Magic links, sessions, share tokens, and delivery tokens are all hashed. Four separate peppers would mean four secrets, four rotations, and four chances to misconfigure.

**Decision.** One `TOKEN_PEPPER` HMACs all four. `TOKEN_ENC_KEY` and `TOKEN_SECRET` remain separate because they have different cryptographic roles.

**Consequences.** Positive: one secret to set and protect; simple code. Negative: pepper rotation invalidates sessions, pending magic links, active share links, and delivery tokens — a disruptive, last-resort operation (04 §6.3). At pilot scale, a forced re-share is annoying, not catastrophic.

**Alternatives rejected.** Per-purpose peppers (more config for little gain now), no pepper (a DB leak yields crackable hashes for 32-byte tokens — actually infeasible, but pepper also prevents precomputation and ties tokens to the server).

---

## ADR-17 — Metadata backups, provider-durable media

**Status:** Accepted

**Context.** Atlas M0 has no managed backups. R2 holds audio and photos but is not a backup target for itself without a second bucket and cost/complexity. The metadata (who understood what) is irreplaceable; source audio and TTS are regenerable from text.

**Decision.** Nightly encrypted `mongodump` to a separate R2 backup bucket, 30-day retention, weekly restore drill. Media is not copied; R2 durability is the media recovery story. Org deletion removes both prefixes.

**Consequences.** Positive: cheap, simple, covers the data that cannot be recreated. Negative: loss of the R2 bucket loses source recordings and photos; TTS can be regenerated, re-recording source audio is manual. Accepted for v0.1.

**Alternatives rejected.** Nightly media sync (doubles storage, same-account risk), Atlas paid backups (cost), no backups (irresponsible).

---

## ADR-18 — Self-hosted fonts, system Indic stack

**Status:** **Proposed** (P4-4)

**Context.** The Phase 3 prototype loads Google Fonts. Production CSP forbids third-party font hosts; the worker must render six scripts on low-end Android over 3G.

**Decision.** Self-host Inter and Noto Sans Arabic (subset), preload them, use the device system stack for Devanagari, Bengali, and Malayalam. No webfont for Indic scripts in v0.1 unless device testing shows missing glyphs. Budget ≤90 KB WOFF2 for critical Latin + Arabic.

**Consequences.** Positive: no third-party request, consistent EN/AR typography, small bundle, CSP clean. Negative: Indic rendering varies by device; QA must cover the device matrix; a future Noto Indic pack is a bundle-budget decision.

**Alternatives rejected.** Google Fonts runtime (CSP, privacy, latency), six self-hosted Noto families (bundle bloat on 3G), no Arabic webfont (system Arabic varies and shaping quality matters for RTL trust).

---

## ADR-19 — No general admin audit log in v0.1

**Status:** Accepted

**Context.** The product's audit value is the delivery record, not a log of supervisor clicks. One owner, no seats. A general audit collection would add writes, retention, and UI that no pilot buyer asked for.

**Decision.** v0.1 records immutable delivery timestamps, language-change history, help resolution actor, share/archive timestamps, and `email_log`. Settings edits, worker edits, and imports are not separately logged. `audit_exported` analytics records exports.

**Consequences.** Positive: less schema and UI; the record that matters is complete. Negative: "who changed the worker's language last Tuesday" is unanswerable. When seats ship, `audit_events` becomes necessary; actor fields already exist as seams.

**Alternatives rejected.** Full audit log now (scope, no consumer), event sourcing (massive overkill).

---

## ADR-20 — Batched help emails, copy-only reminders

**Status:** Accepted · **Locks:** D20

**Context.** A confused crew can generate many help requests in minutes. Per-request email would spam the owner and burn the free email cap. The product does not send WhatsApp in v0.1.

**Decision.** The first help request schedules one delayed email per instruction (10 minutes); at send time it includes every unresolved help request. Reminders are copy-ready messages in the UI; the product never sends them.

**Consequences.** Positive: one actionable email, capped volume, ≤10-minute supervisor promise kept. Negative: a help request made just after a batch waits another 10 minutes. Email failure does not lose the signal; the board is authoritative.

**Alternatives rejected.** Immediate per-request email (spam), daily digest (too slow for safety), auto-WhatsApp (v0.2, unverified channel).

---

## ADR-21 — No runtime index builds; expand/contract migrations

**Status:** Accepted

**Context.** Mongoose `autoIndex` in production causes surprise index builds and startup latency. Rollback with schema changes can break the previous image if migrations are destructive.

**Decision.** `autoIndex=false`; indexes and data changes run from versioned migration scripts before the new image takes traffic. Migrations are forward-only and backward-compatible with the previous image (expand → migrate → contract). A destructive step ships one release after the code stops using the old shape.

**Consequences.** Positive: predictable boots, real rollback. Negative: two deploys for a rename/drop; migration discipline is a human process. The deploy script aborts on migration failure.

**Alternatives rejected.** `autoIndex=true` (unpredictable), down-migrations (rarely tested, dangerous), manual `mongosh` changes (undocumented).

---

## ADR-22 — Read-only board/exports, server-side KPI math

**Status:** Accepted · **Locks:** B16

**Context.** "Understood" must mean one thing everywhere (D8). If the client computes rates, two screens can disagree. Denormalized counters add write paths and reconciliation bugs before there is load to justify them.

**Decision.** Board and exports are read-only modules. Counts and understood flags are computed in Mongo aggregations anchored to `instruction.sharedAt`; the client formats only. No counter fields in v0.1.

**Consequences.** Positive: one definition, no drift, simpler writes. Negative: each board poll runs an aggregation; at pilot scale it is milliseconds. If p95 exceeds 300 ms, the escape hatch is a materialized summary per instruction, not client math.

**Alternatives rejected.** Client-side KPI math (drift), counters on writes (reconciliation), a separate analytics store (another component).

---

## Open decisions and their defaults

| ID | Question | Default in this pack | Flip cost |
|---|---|---|---|
| **P4-1** | Six variants vs audience languages | Six (ADR-11), `PIPELINE_ALL_LANGUAGES=true` | Config + language-sheet disabled state + TTS cost −33% |
| **P4-2** | Archived worker after share | Existing delivery remains openable (ADR-12) | Guard change + closed screen + audit consequence |
| **P4-3** | Preview token TTL | 15 minutes (ADR-08) | Config constant; no schema/API shape |
| **P4-4** | Font strategy | Self-hosted Latin/Arabic; system Indic (ADR-18) | Bundle + CSP + device QA |

Everything else in this register follows a locked product decision or is a technical choice with no user-visible alternative.

---

**Previous:** [05 — Deployment & Operations](./05-deployment-and-operations.md) · **Next:** [07 — Phase 5 Handoff](./07-phase-5-handoff.md)
