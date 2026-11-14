# Architecture Pack — Understood v0.1

**Phase 4 deliverable** · Version 1.0 · Date 2026-11-13
**Status:** Implementation-ready. Four product/design decisions remain open (P4-1…P4-4), each with a working default.
**Contract:** [Doc 05 — Database & API Specification](../docs/05-database-api-spec.md) is now **v0.2.0** and incorporates D-01…D-17.

---

## What this pack is

The bridge between the planning docs and the build. It answers:

- How the system is split into processes and modules, and what may call what.
- In what order each request and job runs, and what happens when a step fails.
- Which data is written where, with which transaction and index.
- Who can access what, and what the browser is allowed to load.
- How the thing is deployed, backed up, monitored, and fixed at 2 am.
- Which decisions were made, what was rejected, and what is still open.

It is **not** a replacement for doc 05 (the exact API contract) or the design pack (the exact screens). It is the implementation map that connects them.

---

## Read in this order

| # | Document | Read time | What you get |
|---|---|---|---|
| 1 | [System Architecture](./01-system-architecture.md) | 15 min | Processes, module map, URL contract, scale envelope, 12 invariants |
| 2 | [Runtime & Pipeline](./02-runtime-and-pipeline.md) | 25 min | Every sequence, the per-variant pipeline, failure matrix, offline outbox |
| 3 | [Data & API Contracts](./03-data-and-api-contracts.md) | 20 min | Ownership, transactions, indexes, retention, D-01…D-17 amendment register |
| 4 | [Security & Privacy](./04-security-and-privacy.md) | 20 min | Threat model, tokens, tenancy, CSP, secrets, PII, incident response |
| 5 | [Deployment & Operations](./05-deployment-and-operations.md) | 20 min | Topology, CI/CD, backups, runbooks, cost, upgrade triggers |
| 6 | [ADR Register](./06-adr-register.md) | 15 min | 22 decisions (19 accepted, 3 proposed), alternatives |
| 7 | [Phase 5 Handoff](./07-phase-5-handoff.md) | 10 min | Entry criteria, first ten tasks, story amendments, pilot gate |

**If you read only two:** 01 and 03. The rest is detail you will want on the day you build or debug the corresponding area.

---

## The architecture in one page

```
Browser ── HTTPS ──> Caddy ──> /api/*   → Express API ──> Mongo (metadata)
                             ├─ /i/*    → Worker PWA  ──> Redis (sessions, queues, limits)
                             └─ /*      → Supervisor SPA ─> R2 (audio/photos, signed)
                                                             AI providers (queue only)
                                                             Resend (magic links, help alerts)
```

- **One origin, three surfaces.** Supervisor `/`, worker `/i/:token`, API `/api/v1`. No CORS.
- **One image, two roles.** `PROCESS_ROLE=both|api|worker`; the pilot runs `both`.
- **One queue.** BullMQ on Redis; transcription on upload, one resumable job per language on generate.
- **One database.** Mongo is the source of truth; Redis is disposable (sessions, queues, idempotency).
- **One contract.** Doc 05 v0.2.0 + shared Zod schemas; the client never computes a KPI.

**The five rules that keep it correct**

1. `orgId` comes from the session, never the client.
2. Every mutation is a guarded state transition, not a read-then-write.
3. Every job is resumable and revision-scoped; a stale job writes nothing.
4. Media is private, authorized, then signed; never a public URL.
5. Preview is read-only and mandatory before share.

---

## Phase 4 decisions at a glance

### Accepted (implementation follows)

| Area | Decision |
|---|---|
| Topology | Modular monolith, one image, process roles |
| Origin | One origin, path-routed, no CORS |
| Auth | Magic link + opaque Redis session; no passwords |
| Share token | HMAC hash for lookup + AES-GCM for re-display |
| Delivery token | Per delivery, five-device cap |
| Preview | Stateless HMAC token, 15 min, read-only |
| Share | One Mongo transaction; concurrent share → one winner |
| Pipeline | One resumable job per variant; `generation`/`revision` fencing |
| Media | Signed R2 URLs in payloads; worker media endpoints return JSON |
| Board | Server-side KPI math; delivery list unpaginated (≤1,000) |
| TTS | Org-scoped cache; doc 05 path wins over TDD |
| Ops | Encrypted nightly dumps; no media backup; runbooks |
| Audit | Delivery record, not an admin click log (v0.1) |

### Proposed (working defaults built)

| ID | Decision | Default |
|---|---|---|
| **P4-1** | Language coverage | Generate all six variants (ADR-11) |
| **P4-2** | Archived worker after share (Q7) | Existing delivery remains openable (ADR-12) |
| **P4-3** | Preview TTL | 15 minutes (ADR-08) |
| **P4-4** | Font strategy | Self-host Latin/Arabic; system Indic (ADR-18) |

These are surfaced, not silently chosen. Flipping P4-1 is a config change plus a language-sheet disabled state; P4-2 is a guard change; P4-3 is one constant; P4-4 changes fonts and QA.

---

## Contract changes that matter most

Doc 05 changed from v0.1.2 to v0.2.0. The changes a developer will trip over:

1. **Worker media:** audio/photo URLs are signed R2 URLs, not API routes. `GET /w/audio/:variantId` returns `{url, expiresAt}`.
2. **Picker language:** `GET /w/:token` returns `titleVariants` + `availableLanguages`; `identify` accepts `language`.
3. **Pipeline fields:** `instructions.generation` and `variants.revision` exist and must be enforced.
4. **Share:** transactional, and a duplicate share returns `SHARE_CONFLICT`; recover via `share-link`.
5. **Audience:** after share, the picker comes from deliveries, not the raw snapshot; archived-after-share still works.
6. **Home:** `GET /board/overview` exists; the client does not compute KPIs.
7. **Delivery list:** full audience per instruction, no cursor; filters are local.
8. **Complete:** replay returns `200` with the original `completedAt`, not `409`.
9. **Export:** `includeHelpReasons` / `includeTimes` params; share-link returns reminder messages.
10. **Errors:** `LANGUAGE_UNAVAILABLE` (409); `LINK_UNAVAILABLE` also covers expired previews.

Full register with shapes: [03 §9](./03-data-and-api-contracts.md#9-api-amendment-register).

---

## Phase 4 exit checklist

- [x] Architecture drivers and system context documented (01).
- [x] Module map and dependency rules documented (01).
- [x] URL contract and Caddy routing documented (01, 05).
- [x] Frontend design-token and font bridge documented (01, 06).
- [x] Every supervisor, worker, preview, and pipeline sequence documented (02).
- [x] Failure matrix, polling, offline outbox, and notification batching documented (02).
- [x] Collection ownership, transactions, indexes, aggregation math, retention documented (03).
- [x] D-01…D-17 resolved and applied to doc 05 v0.2.0 (03, doc 05).
- [x] Threat model, tokens, tenancy, headers, secrets, PII, incident response documented (04).
- [x] Deployment, CI/CD, backups, runbooks, cost, upgrade triggers documented (05).
- [x] ADR register with accepted and proposed decisions (06).
- [x] Phase 5 entry criteria, story amendments, first tasks, pilot gate documented (07).
- [ ] P4-1…P4-4 answered by the founder (working defaults stand until then).
- [ ] Phase 5 explicitly requested (not started by this pack).

The two unchecked items are decisions and a go-ahead, not missing architecture.

---

## Related documents

| Direction | Document |
|---|---|
| Product scope and decisions | [Product definition](../product/01-product-definition.md) · [Decision register](../product/04-decision-register.md) |
| Requirements | [PRD](../docs/02-prd.md) |
| Screens and visual system | [Design pack](../design/README.md) · [Screen specs](../design/02-screen-specifications.md) |
| Stack and milestones | [TDD](../docs/04-tdd.md) |
| Exact API contract | [Database & API spec v0.2.0](../docs/05-database-api-spec.md) |
| Build plan | [Development backlog](../docs/06-development-backlog.md) |
| Validation | [Validation plan](../validation/01-validation-plan.md) |

---

## Maintenance rule

A change to behavior updates, in order:

1. The PRD or product definition (if scope).
2. Doc 05 (if contract) with an amendment entry.
3. This pack (if module, runtime, security, or ops behavior).
4. The affected story's acceptance criteria.
5. The fixture and test in the same PR.

No silent changes. If it is not written in one of those places, it is not a decision.

---

**Previous phase:** [Design pack](../design/README.md) · **Next phase:** Phase 5 — Development & Testing (not begun)
