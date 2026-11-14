# 07 — Phase 5 Handoff

**Phase 4 · Document 7 of 7** · Version 0.1 · Date 2026-11-13
**Owner:** Founder · **Status:** Ready to build, pending the four open decisions and explicit Phase 5 start

---

## 1. What Phase 4 produced

Phase 4 turned the TDD and the API spec into an implementable system:

| Artifact | What it settles |
|---|---|
| [01 — System Architecture](./01-system-architecture.md) | Processes, module boundaries, URL contract, scale envelope, invariants |
| [02 — Runtime & Pipeline](./02-runtime-and-pipeline.md) | Exact request and job sequences, failure behavior, polling, outbox |
| [03 — Data & API Contracts](./03-data-and-api-contracts.md) | Ownership, transactions, indexes, retention, D-01…D-17 amendments |
| [04 — Security & Privacy](./04-security-and-privacy.md) | Threat model, tokens, tenancy, headers, secrets, PII rules |
| [05 — Deployment & Operations](./05-deployment-and-operations.md) | Topology, CI/CD, backups, runbooks, cost and upgrade triggers |
| [06 — ADR Register](./06-adr-register.md) | 22 decisions (19 accepted, 3 proposed), alternatives recorded |
| **Doc 05 v0.2.0** | The API contract now matches what Phase 3 proved |

No production code was written in Phase 4. The prototype remains a design artifact.

---

## 2. What Phase 5 is

Phase 5 builds and proves v0.1: the code, the tests, the deployed pilot stack, and the dry run. It follows the backlog epics E0–E9 and the six-week shape in TDD §18. E10 stays post-gate.

| Week | Target | Epics |
|---|---|---|
| 1 | Workspace, CI, deployed walking skeleton, auth, org/crew/worker CRUD, supervisor shell | E0, E1, start E2 |
| 2 | CSV import, composer, voice/photo upload, draft persistence | E2, E3 |
| 3 | Pipeline v1, preview, per-language retry, share tokens | E4, start E5 |
| 4 | Share drawer, worker PWA (picker → done), board polling, help email | E5, E6, E7 |
| 5 | Exports, settings, usage, security pass, RTL and device polish | E8, E9 |
| 6 | Offline outbox, e2e, seed, pilot dry run on real phones | E9, E10.2 |

The calendar assumes ~36 focused hours/week; at 25 h it stretches to 9–10 weeks. The order is dependency-driven, not negotiable: a deployed skeleton precedes features (C8), and the worker cannot be built before share tokens exist.

---

## 3. Entry criteria

Phase 5 starts only when these are true:

- [ ] **P4-1…P4-4 resolved** (or explicitly deferred with the working default accepted). P4-1 blocks E4; P4-2 blocks E6; P4-3 blocks E5; P4-4 blocks E0 frontend setup.
- [ ] **Doc 05 v0.2.0 is the contract.** No story may implement the old shape.
- [ ] **Backlog stories amended** for E4/E5/E6/E7 with the delta IDs in §5. The backlog's acceptance criteria must reference `generation`/`revision`, signed media, pre-identify language, the delivery-derived audience, and the overview endpoint.
- [ ] **Provider spike scheduled** (E0.5): six Azure voices, Groq limits, DeepL coverage, Resend domain.
- [ ] **Accounts ready:** Oracle VM, domain, Atlas M0, Redis Cloud, two R2 buckets, Azure, Groq, Resend, Sentry, PostHog, UptimeRobot.
- [ ] **Design pack frozen** for v0.1; changes go through design docs first, then the token sync.
- [ ] **Explicit "start Phase 5"** from the founder. Phase 4 does not roll into build on its own.

---

## 4. First ten tasks

The order a solo founder should actually work in:

1. **E0.1** — npm workspace, strict TS, `packages/shared` Zod schemas generated from doc 05 v0.2.0, CI (lint → typecheck → unit).
2. **E0.2** — dev compose with Mongo replica set (transactions), Redis, MinIO; provider mocks for all six languages; `seed-demo`.
3. **E0.3** — Dockerfile (arm64, ffmpeg, sharp), Caddyfile, prod compose, GHCR + SSH deploy, `/healthz` 200 on day 2.
4. **E0.4** — config schema, `PROCESS_ROLE`, feature flag stub, timezone helpers, delayed-job support.
5. **E0.5** — provider spike and voice map; Resend domain; record T1/T2/T3/T5 results.
6. **E1** — magic link, session, `/me`, org, supervisor shell with tokens/fonts; CSP headers live.
7. **E2** — crews, workers, CSV template/import/commit in a transaction, duplicate warnings.
8. **E3** — composer routes, autosave, recorder with MIME negotiation, photo re-encode, transcription queue and confirm.
9. **E4** — per-variant job, revision fencing, TTS cache, finalize, partial failure, six-variant default.
10. **E5** — preview token, variant edit/regenerate, transactional share, share-link messages, archive.

Then E6–E9.

---

## 5. Story amendments required before coding

The backlog predates Phase 3/4. Apply these to the relevant epics before their first story is marked in progress:

| Delta | Amend | Acceptance addition |
|---|---|---|
| D-01 | E5, E6 | Worker media endpoints return `{url, expiresAt}`; payloads embed signed URLs; audio refresh works after expiry |
| D-02 | E6 | `GET /w/:token` returns `titleVariants` + `availableLanguages`; identify accepts `language` and updates the profile |
| D-03 | E4, E6 | Generate six variants by default; `availableLanguages` reflects the variant set; `LANGUAGE_UNAVAILABLE` path tested |
| D-04 | E7 | Home uses `GET /board/overview`; KPI and exception counts match fixtures |
| D-05 | E5, E8 | Share-link returns reminder messages; export accepts both column flags |
| D-06 | E5 | Preview token is minted server-side; preview route is `/i/preview/:token` |
| D-07 | E6 | `/w/state` returns full content and signed media; reload and completed recap use it |
| D-08 | E5 | Share is one transaction; concurrent share yields one winner; conflict recovers via share-link |
| D-09 | E0, E6 | Worker build uses `base:'/i/'`; no prototype query parameters ship |
| D-10 | E0 | Tokens copied from the design pack; drift check in CI; fonts self-hosted |
| D-11 | E7 | Help email is batched ≤10 min; reminders copy only |
| D-12 | E4 | `generation`/`revision` fields and migration; stale-job test is release-blocking |
| D-13 | E4 | TTS cache uses the org path; dedupe test asserts no second Azure call |
| D-14 | E5, E6 | Picker is delivery-derived; archived-after-share works; archived-before-share cannot identify |
| D-15 | E6 | Complete replay returns 200 with the original timestamp |
| D-16 | E6 | Language sheet handles `LANGUAGE_UNAVAILABLE` |
| D-17 | E7 | Board detail fetches all rows + counts; filters/search are local |

This table is the Phase 5 kickoff checklist. A story that touches one of these without the amendment is not done.

---

## 6. Definition of done (per story)

A story is done when:

1. Acceptance criteria in the backlog and the relevant architecture section are both satisfied.
2. Integration tests cover the happy path and the named failure path; security tests cover cross-tenant and token scope.
3. Typecheck, lint, unit, and integration are green; e2e is green on `main`.
4. The UI works at 360 px and 320 px, in EN and AR (RTL), with no console errors; worker screens also checked in ML or HI.
5. No PII in logs or analytics; no secret in the bundle.
6. Doc 05 is updated if the contract changed (with an amendment entry), and the fixture is updated in the same PR.
7. The deploy is live on the VM, `/healthz` green, and the change is recorded in the deploy log.

For worker-facing stories, add: tap-to-play only, 68 px play target, ≥48 px targets, no autoplay, no answer before submission, and a real-device check.

---

## 7. Testing obligations carried into Phase 5

Phase 4 added fifteen sequence tests (02 §9) and seven security tests (04 §11) beyond doc 05 §11. The release-blocking set:

| Area | Test |
|---|---|
| Pipeline | Stale-revision job writes nothing; finalize is order-independent; Redis flush reconciles |
| Share | Concurrent share → one shared instruction, one delivery per active worker; archived dropped |
| Worker | Two answers → attempts 2 + auto-help; third rejected; complete idempotent; language snapshot immutable after completion |
| Media | Signed URL expiry/refresh; variant from another instruction `403` |
| Preview | Zero writes, zero events, expired token 410 |
| Tenant | Every route class probed with a second org |
| Export | Formula escaping + BOM + Arabic names open correctly |
| Ops | Backup restore matches counts; rollback works after an expand migration |

E2E must include: magic link via test mailer → crew → CSV import → instruction → preview → share → worker AR flow → board → export. A second worker run in ML at 360 px. A revoked link. A preview. An offline answer queue replay.

---

## 8. Risks and mitigations for the build

| Risk | Early signal | Mitigation |
|---|---|---|
| Azure voice gaps for ml/bn | E0.5 sample missing or poor | Voice map config; closest-locale fallback with a warning; Q2 listening test |
| Safari recorder format | E3 upload fails on iPhone | MIME negotiation + server `ffprobe` + documented re-record |
| Free TTS exhausted by six variants | E4 usage counter climbs | `PIPELINE_ALL_LANGUAGES=false` fallback; 80% banner; audience-only is a config change |
| Transactions unavailable locally | E0.2 test fails | `mongodb-memory-server` replica set; never single-node |
| Redis loss during a demo | processing stalls | Reconcile job + retry language; demo pre-generated |
| Scope creep from pilot feedback | new asks during week 4 | Decision register §7: trade + amendment, or v0.2 |
| Time slips | week 5 still on E5 | Cut in ladder order: E10.2 outbox is already stretch; do not cut share transaction, preview, or CSV |
| Domain/email delay | magic link lands in spam | E0.5 Resend verification; do not start external pilot without it |
| Real-device performance | FCP > 2 s | bundle budget gate, self-hosted fonts, defer Indic webfonts |

---

## 9. Traceability

| Architecture | Primary epics | Gate |
|---|---|---|
| 01 §3–5 process/module map | E0, E1, E9 | Module boundaries reviewed; `import/no-cycle` green |
| 01 §6 design bridge | E0, E1, E6 | Token drift check; bundle budgets |
| 02 §2 supervisor sequences | E3, E5, E7, E8 | Integration tests + e2e |
| 02 §3 pipeline | E4 | Pipeline tests, stale-job test, 45/60 s p95 |
| 02 §4 worker sequences | E6 | Worker e2e in AR + ML, real device |
| 03 §3–8 data/transactions/indexes | E2, E4, E5, E7, E8 | Index migration matches `getIndexes()`; restore drill |
| 03 §9 amendments | E4–E8 | Contract fixtures |
| 04 §2–5 auth/browser/input | E1, E5, E6, E9 | Security test suite |
| 04 §7–9 PII/abuse/audit | E7, E8, E9 | Log scan, PostHog fixture, privacy page |
| 05 §4–8 CI/deploy/backup/runbooks | E0, E9 | Deploy + rollback + restore each performed |
| 06 ADRs | E0–E9 | Reviewed at each epic start |

---

## 10. Phase 5 exit / pilot gate

Phase 5 ends when all of these are true:

- Every MUST story and the four committed SHOULDs are done; E10.2 offline outbox is done if the clock allowed.
- CI gates green; e2e on `main` passing for two consecutive days.
- A 30 s × 4-language instruction completes in ≤45 s on the deployed stack; six languages ≤60 s.
- A worker on a low-end Android completes picker → audio → answer → done in under 90 s.
- Exports open in Excel with Arabic, Urdu, Malayalam, Bengali, and Hindi intact.
- Backup restore from the previous night succeeds and counts match.
- Security acceptance tests pass; CSP, cookies, signed URLs, tenant probes verified.
- The pilot ops checklist (05 §11) is complete, including domain/email verification and the printed runbook.
- Three real phones and three languages pass the dry run.

Until then, the product is not offered to an external crew.

---

## 11. What Phase 5 must not do

- Add screens, roles, channels, or analytics beyond the PRD scope (decision register §7).
- Build E10 items before the pilot gate; the only exception is E10.2 if the clock allows.
- Replace the preview gate with "send now".
- Compute KPI math on the client.
- Add websockets, a second database, a search engine, or a separate pipeline service.
- Ship the prototype's deep-link parameters, client CSV builder, or Google Fonts.
- Let a stale pipeline job write assets after an edit (D-12).
- Mark a story done with a failing security test or an untested failure path.

---

**Phase 4 ends here.** Phase 5 begins only on an explicit request.

---

**Previous:** [06 — ADR Register](./06-adr-register.md) · **Pack index:** [README](./README.md)
