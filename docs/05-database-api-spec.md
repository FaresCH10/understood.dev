# 05 — Database & API Specification

**Document 5 of 8** · Version 0.2.0 · Date 2026-11-13
**Owner:** Founder · **Status:** Implementation contract · **Related:** [PRD](./02-prd.md) · [Wireframes](./03-user-flows-wireframes.md) · [TDD](./04-tdd.md) · [Architecture pack](../architecture/README.md)

This document is the exact contract for v0.1. Anything here is authoritative over summaries in earlier documents. Refinements discovered while specifying are collected in §13 (decision log B1–B23); §14 records the questions closed in review and the consistency pass applied on 2026-11-12.

**v0.2.0 (2026-11-13):** Phase 4 contract reconciliation — signed media URLs, pre-identify language, home overview, preview-token endpoint, transactional share, generation/revision fencing, delivery-derived audience, and related guard and error changes. Full rationale: [architecture/03 §9](../architecture/03-data-and-api-contracts.md).

---

## 1. Conventions

| Topic | Convention |
|---|---|
| DB | MongoDB via Mongoose. Collections `snake_case`, fields `camelCase` |
| IDs | ObjectId, serialized as 24-char hex strings |
| Dates | Stored UTC. API emits ISO-8601 (`2026-11-12T07:02:11.000Z`). Display and metrics use org timezone |
| API base | Same origin, `/api/v1` |
| Auth | Supervisor: `HttpOnly` cookie session. Worker: `Authorization: Bearer <deliveryToken>` |
| Envelope | Success `{ "data": …, "meta"?: … }` · Error `{ "error": { "code", "message", "details"? }, "requestId" }` |
| Validation | Zod at the boundary; reject unknown fields (`strict`) |
| Pagination | Cursor: `?limit=50&cursor=<opaque>`; response `meta.nextCursor` (opaque base64 of sort key + id) |
| Idempotency | `Idempotency-Key` header (UUID v4) required on worker mutations; 24h replay window in Redis |
| Rate limits | Redis counters; `429` + `Retry-After`; headers `RateLimit-Limit/Remaining/Reset` |
| Body size | JSON ≤ 256 KB; multipart uploads ≤ 15 MB |
| Errors | No stack traces, no provider messages, no PII in `message` |
| Request IDs | `X-Request-Id` echoed/generated; included in Sentry |

---

## 2. Enums and shared types

```ts
type Language = 'ar' | 'en' | 'hi' | 'ur' | 'ml' | 'bn';
type InstructionType = 'task' | 'info';
type ContentKind = 'text' | 'voice' | 'photo';        // 'video' reserved
type InstructionStatus = 'draft' | 'processing' | 'partial_failure'
                       | 'ready' | 'shared' | 'archived'
                       // 'scheduled' reserved (v0.2)
type DeliveryStatus = 'pending' | 'opened' | 'answered' | 'completed';
type HelpReason = 'dont_understand' | 'missing_tools' | 'safety_concern' | 'other';
type VariantStatus = 'pending' | 'processing' | 'ready' | 'text_only' | 'failed';
type StageStatus = 'pending' | 'running' | 'done' | 'failed';
type Role = 'owner';                                  // 'admin' | 'supervisor' reserved
type Plan = 'pilot';                                  // 'starter' | 'growth' | 'scale' reserved
type DeliveryChannel = 'link';                        // 'whatsapp' reserved
```

Language metadata (single source of truth in `packages/shared`):

| Code | Native label | Supervisor label | TTS locale | TTS voice (verify at build) |
|---|---|---|---|---|
| ar | العربية | Arabic | ar-AE | FatimaNeural |
| en | English | English | en-US | JennyNeural |
| hi | हिन्दी | Hindi | hi-IN | SwaraNeural |
| ur | اردو | Urdu | ur-PK | UzmaNeural |
| ml | മലയാളം | Malayalam | ml-IN | SobhanaNeural |
| bn | বাংলা | Bengali | bn-IN | NabanitaNeural |

---

## 3. Collections

### 3.1 `organizations`

| Field | Type | Req | Rules |
|---|---|---|---|
| `_id` | ObjectId | ✓ | — |
| `name` | string | ✓ | 1–120 chars, trimmed |
| `timezone` | string | ✓ | IANA; validated via `Intl`; default `Asia/Dubai` |
| `locale` | enum `en`\|`ar` | ✓ | Default `en` |
| `plan` | enum `pilot` | ✓ | Reserved values for v0.2 |
| `features` | object | — | Reserved per-org flags (empty in v0.1) |
| `createdAt` / `updatedAt` | Date | ✓ | Mongoose timestamps |

Indexes: none beyond `_id` (single org row per account in v0.1; teams arrive in v0.2).

### 3.2 `users`

| Field | Type | Req | Rules |
|---|---|---|---|
| `_id` | ObjectId | ✓ | — |
| `orgId` | ObjectId | ✓ | Ref `organizations` |
| `email` | string | ✓ | Lowercased, RFC-lite validation, unique |
| `name` | string | — | ≤80 chars (from email local part until set) |
| `role` | enum | ✓ | `owner` |
| `lastLoginAt` | Date | — | Updated on verify |
| `createdAt` / `updatedAt` | Date | ✓ | — |

Indexes: `{ email: 1 }` unique · `{ orgId: 1 }`.
v0.1 creates exactly one user per org; the first magic-link verify creates both.

### 3.3 Sessions — Redis (not a collection)

```
sess:{hmac_sha256(token)}  →  JSON { userId, orgId, createdAt, lastSeenAt }  TTL 30d (sliding)
us:{userId}                →  SET of session key hashes                          TTL 30d
```

Sliding refresh at most once per minute per session. Logout deletes the key and set member. Deactivating a user (v0.2) deletes all set members.

### 3.4 `magic_links`

| Field | Type | Req | Rules |
|---|---|---|---|
| `_id` | ObjectId | ✓ | — |
| `email` | string | ✓ | Lowercased |
| `tokenHash` | string | ✓ | `HMAC-SHA256(TOKEN_PEPPER, token)` hex |
| `expiresAt` | Date | ✓ | now + 15 min |
| `usedAt` | Date | — | Set atomically on verify |
| `createdAt` | Date | ✓ | — |

Indexes: TTL `expiresAt` (0s) · `{ tokenHash: 1 }`.
Verify is a single atomic `findOneAndUpdate({ tokenHash, usedAt: null, expiresAt: { $gt: now } }, { $set: { usedAt: now } })`.

### 3.5 `crews`

| Field | Type | Req | Rules |
|---|---|---|---|
| `_id` | ObjectId | ✓ | — |
| `orgId` | ObjectId | ✓ | Tenant |
| `name` | string | ✓ | 1–80 chars |
| `archivedAt` | Date | — | Soft archive |
| `createdAt` / `updatedAt` | Date | ✓ | — |

Indexes: `{ orgId: 1, archivedAt: 1, createdAt: -1 }`.

### 3.6 `workers`

| Field | Type | Req | Rules |
|---|---|---|---|
| `_id` | ObjectId | ✓ | — |
| `orgId` | ObjectId | ✓ | Tenant |
| `crewId` | ObjectId | ✓ | Ref `crews` |
| `name` | string | ✓ | 1–80 chars, trimmed, NFC-normalized |
| `normalizedName` | string | ✓ | Lowercase, whitespace-collapsed (dedupe help) |
| `language` | enum Language | ✓ | — |
| `phoneE164` | string | — | `^\+[1-9]\d{7,14}$`; display-only in v0.1 |
| `archivedAt` | Date | — | — |
| `personalTokenHash` | string | — | **Reserved v0.2** (personal inbox) |
| `pushEnabled` | boolean | — | **Reserved v0.2** |
| `createdAt` / `updatedAt` | Date | ✓ | — |

Indexes: `{ orgId: 1, crewId: 1, archivedAt: 1 }` · `{ orgId: 1, normalizedName: 1 }` (non-unique; duplicate names are legal but warned).
Guardrail: ≤ 1,000 active workers per org (service check).

### 3.7 `instructions`

| Field | Type | Req | Rules |
|---|---|---|---|
| `_id` | ObjectId | ✓ | — |
| `orgId` | ObjectId | ✓ | Tenant |
| `crewId` | ObjectId | — | Null in draft; required at generate |
| `audienceWorkerIds` | ObjectId[] | — | Snapshot at generate; ≤1,000; all active and in `crewId` |
| `title` | string | — | ≤120 chars (translated per variant when present) |
| `type` | enum InstructionType | ✓ | Default `task` |
| `content.kind` | enum ContentKind | — | Required at generate |
| `content.text` | string | — | ≤2,000 chars; required for `text` and `photo` |
| `content.audioKey` | string | — | R2 key; required for `voice` |
| `content.audioMime` | string | — | Allowed audio MIME |
| `content.durationS` | number | — | ≤185 (3:05 server tolerance) |
| `content.photoKey` | string | — | Required for `photo` |
| `content.transcript` | string | — | STT output for `voice`; written by the transcription job on upload; supervisor-editable while draft (B17) |
| `content.transcriptStatus` | enum `pending`\|`ready`\|`failed`\|`confirmed` | — | Voice only; `confirmed` required before generate |
| `content.detectedSourceLanguage` | enum Language | — | STT suggestion; `sourceLanguage` remains the confirmed value |
| `sourceLanguage` | enum Language | ✓ | Supervisor-confirmed (auto-set when the detected language is accepted) |
| `status` | enum InstructionStatus | ✓ | Default `draft` |
| `generation` | number | ✓ | Default 0; `+1` on generate and on every variant edit/regenerate; fences stale pipeline jobs (D-12) |
| `pipeline` | object | — | `{ startedAt, finishedAt, lastError: { code, message, at } \| null }` |
| `shareTokenHash` | string | — | HMAC hash; sparse unique |
| `shareTokenEnc` | string | — | AES-256-GCM envelope of raw token (re-display) |
| `shareTokenIssuedAt` | Date | — | — |
| `shareTokenRevokedAt` | Date | — | Set on regenerate |
| `createdBy` | ObjectId | ✓ | Owner |
| `sharedBy` | ObjectId | — | — |
| `sharedAt` | Date | — | Board metrics anchor |
| `archivedAt` | Date | — | — |
| `seriesId` / `occurrence` | — | — | **Reserved v0.2** (scheduled/recurring) |
| `createdAt` / `updatedAt` | Date | ✓ | — |

Indexes: `{ orgId: 1, status: 1, createdAt: -1 }` · `{ orgId: 1, crewId: 1, createdAt: -1 }` · `{ shareTokenHash: 1 }` unique sparse.
Invariants: `shareTokenHash` exists ⇔ status ∈ {shared, archived}. A variant edit or regeneration on `ready`/`partial_failure` re-enters `processing`; Share is blocked until every variant is ready again (B19).

### 3.8 `variants`

One per language of an instruction's audience.

| Field | Type | Req | Rules |
|---|---|---|---|
| `_id` | ObjectId | ✓ | — |
| `orgId` | ObjectId | ✓ | — |
| `instructionId` | ObjectId | ✓ | — |
| `language` | enum Language | ✓ | — |
| `title` | string | — | Translated title or null |
| `text` | string | — | Translated text (body) |
| `audioKey` | string | — | Cache asset key; null until ready or if `text_only` |
| `audioChars` | number | — | Characters synthesized (usage) |
| `audioDurationS` | number | — | Derived from MP3 |
| `audioStatus` | enum `pending`\|`ready`\|`failed`\|`skipped` | ✓ | `skipped` when supervisor accepts text-only |
| `question` | object | — | `{ text, options: [string,string,string], correctIndex: 0\|1\|2, source: 'ai'\|'manual' }` or null |
| `questionStatus` | enum `pending`\|`ready`\|`failed`\|`manual_required` | ✓ | — |
| `status` | enum VariantStatus | ✓ | Aggregate of stages |
| `stages` | object | ✓ | `{ translate: StageStatus, question: StageStatus, audio: StageStatus }` |
| `revision` | number | ✓ | Default 1; `+1` on that variant's edit/regenerate; stale jobs must not write (D-12) |
| `lastError` | object | — | `{ stage, code, message, at }` |
| `editedAt` | Date | — | Set on supervisor edits/regeneration |
| `createdAt` / `updatedAt` | Date | ✓ | — |

Indexes: `{ instructionId: 1, language: 1 }` unique · `{ orgId: 1, instructionId: 1 }`.

### 3.9 `deliveries`

| Field | Type | Req | Rules |
|---|---|---|---|
| `_id` | ObjectId | ✓ | — |
| `orgId` | ObjectId | ✓ | — |
| `instructionId` | ObjectId | ✓ | — |
| `workerId` | ObjectId | ✓ | — |
| `variantId` | ObjectId | ✓ | Snapshot; mutable only via explicit worker language change before completion (B4) |
| `language` | enum Language | ✓ | Snapshot; see B4 |
| `languageChangeHistory` | array | — | `[{ from, to, at }]` |
| `status` | enum DeliveryStatus | ✓ | `pending` at share |
| `firstAttemptCorrect` | boolean | — | Immutable once set |
| `attempts` | array | — | `[{ optionIndex, correct, at }]`; capped at 2 — first try + one retry (B18) |
| `openedAt` / `answeredAt` / `completedAt` | Date | — | First-event wins; idempotent |
| `help` | object | — | `{ requested: bool, reason, requestedAt, resolvedAt, resolvedBy }` |
| `deliveryTokens` | array | — | `[{ hash, createdAt, lastSeenAt }]`; cap 5, oldest evicted |
| `channel` | enum DeliveryChannel | ✓ | `link` |
| `createdAt` / `updatedAt` | Date | ✓ | — |

Indexes: `{ instructionId: 1, workerId: 1 }` unique · `{ instructionId: 1, status: 1 }` · `{ orgId: 1, status: 1 }` · `{ 'deliveryTokens.hash': 1 }` sparse multikey.

### 3.10 `audio_assets` (org-scoped TTS cache)

| Field | Type | Req | Rules |
|---|---|---|---|
| `_id` | ObjectId | ✓ | — |
| `orgId` | ObjectId | ✓ | — |
| `cacheKey` | string | ✓ | `sha256(orgId + text + voiceId + rate + format + glossaryVersion)` |
| `r2Key` | string | ✓ | `orgs/{orgId}/audio/{hash}.mp3` |
| `chars` | number | ✓ | — |
| `voiceId` | string | ✓ | — |
| `lastUsedAt` | Date | ✓ | Touched on cache hit |
| `createdAt` | Date | ✓ | — |

Indexes: `{ orgId: 1, cacheKey: 1 }` unique · `{ lastUsedAt: 1 }` (cleanup job: unreferenced assets > 180 days).

### 3.11 `ai_usage`

Append-only ledger. `{ orgId, instructionId, language?, stage: 'transcribe'|'translate'|'question'|'tts', provider, model?, units, unitType: 'chars'|'seconds'|'tokens', costUsd, latencyMs, createdAt }`.
Indexes: `{ orgId: 1, createdAt: -1 }` · `{ instructionId: 1 }`.

### 3.12 `imports`

`{ orgId, fileName, status: 'parsed'|'invalid'|'committed', crewId, totalRows, validRows, errors: [{ row, field, code, message }], warnings: [{ row, code: 'duplicate_name', message }], rows: [{ name, language, phoneE164?, crewName? }], committedAt, createdAt, expireAt }`.
Indexes: `{ orgId: 1, createdAt: -1 }` · TTL `expireAt` (30 days).

### 3.13 `email_log`

`{ orgId?, to, template: 'magic_link'|'help_alert'|'org_deletion', status, providerId?, error?, createdAt }`.
Index: TTL `createdAt` 90 days. (Recipient stored for deliverability debugging; purged automatically.)

### 3.14 Reserved collections (v0.2, do not create yet)

`invites` · `push_subscriptions` · `whatsapp_messages` · `glossary_terms` · `verification_records` (PDF packs) · `billing_customers` · `scheduled_occurrences`. Field-level reservations already exist where needed (`personalTokenHash`, `channel`, `seriesId`).

---

## 4. Token and session protocols

### 4.1 Supervisor magic link

```
Token: 32 random bytes → base64url (43 chars)
Store: HMAC-SHA256(TOKEN_PEPPER, token) hex in magic_links.tokenHash
URL:   https://{host}/api/v1/auth/verify?token=...
Verify (atomic): mark used → find user by email (create user+org if new) →
                 create session (Redis) → Set-Cookie → 302 /home
Invalid/used/expired → 302 /signin?error=link_unavailable (friendly page)
```

No email enumeration: `POST /auth/magic-link` always returns `202 { sent: true }`.

### 4.2 Instruction share token (crew link)

```
Raw: 32 random bytes → base64url
Lookup: HMAC hash (shareTokenHash, unique sparse)
Re-display: shareTokenEnc = AES-256-GCM(raw, TOKEN_ENC_KEY) — needed for "Copy link" later
Issue: POST /instructions/:id/share (only from ready / accepted-partial)
Revoke: POST /instructions/:id/regenerate-link → replaces hash+enc, sets revokedAt
Access: valid only while status = shared; archived → 410 screen
```

Encryption at rest is the deliberate trade-off (B2): the supervisor must be able to copy the link later, so hashing alone is insufficient. Keys live in env; rotation requires re-encrypting active links (rare, documented in the runbook).

### 4.3 Delivery token (worker session)

```
Issue: POST /w/:token/identify { workerId }
       → 32 random bytes returned once; hash appended to delivery.deliveryTokens (max 5, oldest evicted)
Auth:  Authorization: Bearer <deliveryToken>
       Lookup by 'deliveryTokens.hash' → delivery → instruction (must be shared)
Scope: exactly one delivery. Cannot read other workers, other instructions, or the roster.
Update: lastSeenAt touched at most once per minute
```

Multiple devices per delivery are supported up to five tokens (B3). Losing a device is harmless: the worker re-identifies and gets a new token; old ones expire with the delivery.

### 4.4 Preview token

- `POST /instructions/:id/preview-token` (owner session) → `{ token, url, expiresAt }`, valid 15 minutes. Allowed when the instruction is `ready`, `partial_failure`, or `shared`; otherwise `409 CONFLICT_STATE`.
- Format: `base64url(payload).HMAC-SHA256(TOKEN_SECRET, payload)` with `{ instructionId, exp, kind: 'preview' }`. Stateless, no DB row.
- URL: `https://{host}/i/preview/{token}`.
- `GET /w/preview/:token` returns the same shape as worker meta with `preview: true`; **all writes are rejected** with `403 PREVIEW_MODE`, and no deliveries or events are recorded.
- Invalid or expired token → `410 LINK_UNAVAILABLE` so the worker shell can show a "Preview expired" state.

### 4.5 Authorization matrix (v0.1)

| Surface | Credential | Scope |
|---|---|---|
| `/api/v1/auth/*` | none / cookie | — |
| Supervisor routes | cookie session | own `orgId` |
| `/api/v1/w/:token/*` | share token in path | one instruction + its audience |
| Worker mutations | delivery token | one delivery |
| `/api/v1/w/preview/:token` | signed preview token | one instruction, read-only |
| `/api/v1/exports/*` | cookie session | own org |

Every query is composed as `{ orgId: session.orgId, ... }`. There is no API that accepts `orgId` from the client. Cross-tenant access is tested per route class (§11).

---

## 5. API conventions

### 5.1 Success and error envelopes

```json
{ "data": { }, "meta": { "nextCursor": null } }
```

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request contains invalid fields.",
    "details": [{ "field": "language", "issue": "must be one of ar|en|hi|ur|ml|bn" }]
  },
  "requestId": "req_9f3c…"
}
```

### 5.2 Error catalog

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Zod failure; `details[]` lists fields |
| `MALFORMED_JSON` | 400 | Unparseable body |
| `WORKER_NOT_IN_AUDIENCE` | 400 | Worker id has no delivery for this instruction (no enumeration detail) |
| `TRANSCRIPT_UNCONFIRMED` | 400 | Voice generate attempted without a confirmed transcript |
| `AUTH_REQUIRED` | 401 | No/invalid session |
| `SESSION_EXPIRED` | 401 | Session TTL elapsed |
| `DELIVERY_TOKEN_INVALID` | 401 | Unknown/evicted token |
| `FORBIDDEN` | 403 | Authenticated but not allowed |
| `PREVIEW_MODE` | 403 | Attempted a write from preview |
| `NOT_FOUND` | 404 | Resource absent or outside tenant |
| `IMPORT_INVALID` | 409 | Commit attempted while errors exist |
| `IMPORT_ALREADY_COMMITTED` | 409 | Double commit |
| `WORKER_LIMIT_REACHED` | 409 | Org would exceed 1,000 active workers |
| `CONFLICT_STATE` | 409 | Invalid lifecycle transition (see §7) |
| `INSTRUCTION_NOT_READY` | 409 | Share/regen while not ready |
| `LANGUAGE_UNAVAILABLE` | 409 | Requested worker language has no variant for this instruction |
| `SHARE_CONFLICT` | 409 | Share attempted twice (use share-link) |
| `ATTEMPTS_EXHAUSTED` | 409 | Answer cap reached (first + one retry) |
| `DELIVERY_COMPLETED` | 409 | Mutation after completion (except help/resolve) |
| `PIPELINE_FAILED` | 409 | Requested action impossible for failed pipeline |
| `LINK_UNAVAILABLE` | 410 | Unknown/revoked/archived link → worker closed screen |
| `PAYLOAD_TOO_LARGE` | 413 | Upload or body limit exceeded |
| `UNSUPPORTED_MEDIA` | 415 | MIME rejected |
| `RATE_LIMITED` | 429 | See `Retry-After` |
| `IDEMPOTENCY_CONFLICT` | 409 | Same key, different payload |
| `INTERNAL` | 500 | Unexpected; logged with requestId |
| `SERVICE_UNAVAILABLE` | 503 | Health check failure |

### 5.3 Rate limits

| Bucket | Limit |
|---|---|
| Magic link | 5/h/email · 20/h/IP |
| Verify | 30/h/IP |
| Worker meta (`GET /w/:token`) | 60/min/token+IP |
| Identify | 10/min/token · 30/min/IP |
| Answer/complete/help/language | 30/min/delivery |
| Uploads | 10/min/org |
| Generate | 10/h/org |
| Share / regenerate | 10/h/instruction |
| Exports | 5/h/org |

### 5.4 Idempotency

- Required on `POST /w/answer`, `/w/complete`, `/w/help`; optional elsewhere.
- Key stored `idem:{deliveryId}:{key}` → `{ requestHash, status, body }`, TTL 24 h.
- Replay with same hash returns the stored response; different payload → `409 IDEMPOTENCY_CONFLICT`.
- Help-request email batching makes duplicate help calls harmless by design.

---

## 6. API reference

### 6.1 Auth

| Method · Path | Auth | Request | Response / Notes |
|---|---|---|---|
| `POST /auth/magic-link` | — | `{ email }` | `202 { data: { sent: true } }`; always generic |
| `GET /auth/verify?token=` | — | — | `302 /home` + `Set-Cookie`; invalid → `302 /signin?error=link_unavailable` |
| `POST /auth/logout` | cookie | — | `204` |
| `GET /me` | cookie | — | `{ user: { id, name, email, role, locale }, org: { id, name, timezone, plan } }` |

### 6.2 Org & settings

| Method · Path | Auth | Request | Response / Notes |
|---|---|---|---|
| `GET /org` | cookie | — | Org + counts `{ crews, workers }` |
| `PATCH /org` | cookie | `{ name?, timezone?, locale? }` | Updated org |
| `GET /org/usage` | cookie | — | `{ periodStart, periodEnd, ttsChars, ttsMinutes, capMinutes, instructionsSent, deliveries }` |
| `GET /exports/workers.csv` | cookie | — | All workers CSV (BOM) |
| `GET /exports/all.zip` | cookie | — | Workers + instructions + deliveries CSVs (SET-2 export) |
| `POST /org/delete` | cookie | `{ confirmName }` | Typed confirmation required; queues cascade delete; invalidates sessions; sends confirmation email; `202` |

### 6.3 Crews

| Method · Path | Auth | Request | Response / Notes |
|---|---|---|---|
| `GET /crews?includeArchived=` | cookie | — | List with `workerCount`, language summary |
| `POST /crews` | cookie | `{ name }` | `201` crew |
| `PATCH /crews/:id` | cookie | `{ name?, archived? }` | Updated crew; archive is idempotent |
| `GET /crews/:id` | cookie | — | Crew + counts |

### 6.4 Workers

| Method · Path | Auth | Request | Response / Notes |
|---|---|---|---|
| `GET /crews/:id/workers?search=&language=` | cookie | — | List (max 200/page, cursor) |
| `POST /workers` | cookie | `{ crewId, name, language, phoneE164? }` | `201` worker; duplicate name → 201 + `meta.warning: 'duplicate_name'` |
| `PATCH /workers/:id` | cookie | `{ name?, language?, phoneE164?, archived? }` | Updated worker; language changes affect future instructions only |
| `GET /workers/template.csv` | cookie | — | Template with BOM: `name,language,phone,crew` |
| `POST /workers/import` | cookie | multipart `file`, form `crewId?` | `{ importId, status, totalRows, validRows, errorCount, errors[≤50], warningCount, warnings[≤50] }` |
| `GET /imports/:id?cursor=` | cookie | — | Preview rows + full error and warning lists |
| `POST /imports/:id/commit` | cookie | — | All-or-nothing on **errors**; warnings never block. `201 { created }`; `409` if errors/uncommitted/limit |

Language aliases accepted: `ar|arabic|العربية` · `en|english` · `hi|hindi|हिन्दी` · `ur|urdu|اردو` · `ml|malayalam|മലയാളം` · `bn|bengali|bangla|বাংলা` (case-insensitive).
Duplicate definition: normalized name already present in the **same crew** (active workers). Duplicates are warnings only — never blocked, never skipped (B15).

### 6.5 Instructions & media

Draft lifecycle: create empty draft → patch fields → attach media → confirm transcript → generate.

Transcription is a **pre-pipeline step**: the voice upload queues it, the composer polls until `transcriptStatus='ready'`, and the supervisor confirms the transcript + language before Generate (B17). Generate never starts a blind transcription. If STT fails, the supervisor can type the transcript manually or re-record; there is no separate retry endpoint in v0.1.

| Method · Path | Auth | Request | Response / Notes |
|---|---|---|---|
| `POST /instructions` | cookie | `{}` | `201 { id, status: 'draft' }` |
| `PATCH /instructions/:id` | cookie | `{ title?, type?, sourceLanguage?, content? }` | Draft only (`CONFLICT_STATE` otherwise). `content` may set `kind: text` + `text`, or `kind: photo` + `text` (caption required), or edit `content.transcript`/confirm it via `content.transcriptStatus='confirmed'` for a voice draft |
| `POST /instructions/:id/voice` | cookie | multipart `file` | Validates MIME + `ffprobe` duration ≤185s; stores R2; sets `content.kind='voice'`, `audioKey`, `durationS`; **queues transcription (STT + language detection) immediately** (B17); returns `{ durationS, transcriptStatus: 'pending' }` |
| `POST /instructions/:id/photo` | cookie | multipart `file` | Re-encodes (EXIF stripped) → JPEG ≤1600px; sets `content.kind='photo'`, `photoKey` |
| `DELETE /instructions/:id/media` | cookie | — | Removes voice/photo from draft; content falls back to text |
| `POST /instructions/:id/generate` | cookie | `{ crewId, audienceWorkerIds? }` | Validates completeness — text present, or photo + caption, or voice with `transcriptStatus='confirmed'` (`400 TRANSCRIPT_UNCONFIRMED` otherwise); snapshots audience (default all active crew workers); creates one variant per language in the generation set (six by default — D-03); `202 { status:'processing' }` |
| `GET /instructions/:id` | cookie | — | Instruction + variants (text/question; no binaries) + share status; draft voice includes transcript + `transcriptStatus` (poll while transcribing) |
| `GET /instructions/:id/status` | cookie | — | Coarse status + per-language stages + errors (poll 2s); voice drafts report `transcript` state inline |
| `POST /instructions/:id/preview-token` | cookie | `{}` | `201 { token, url, expiresAt }`; 15-min stateless preview token (D-06). `ready`, `partial_failure`, or `shared`; else `409 CONFLICT_STATE` |
| `DELETE /instructions/:id` | cookie | — | Drafts only; hard delete |

**Generate request example**

```json
{
  "crewId": "665f1c…",
  "audienceWorkerIds": ["665f20…", "665f21…"]
}
```

**Status response example**

```json
{ "data": {
  "status": "processing",
  "transcript": { "status": "confirmed", "language": "hi" },
  "stages": {
    "translate": { "ar": "done", "en": "done", "hi": "running", "ur": "pending", "ml": "pending", "bn": "pending" },
    "question": { "ar": "done", "en": "done", "hi": "pending", "ur": "pending", "ml": "pending", "bn": "pending" },
    "audio":    { "ar": "done", "en": "done", "hi": "pending", "ur": "pending", "ml": "pending", "bn": "pending" }
  },
  "error": null
},
"meta": { "languages": ["ar", "en", "hi", "ur", "ml", "bn"], "audienceCount": 24 }
}
```

### 6.6 Variants (preview editing)

| Method · Path | Auth | Request | Response / Notes |
|---|---|---|---|
| `GET /variants/:id/audio` | cookie | — | `302` to signed R2 URL (15 min) |
| `PATCH /variants/:id` | cookie | `{ text?, title?, question? }` | Allowed only while instruction is `ready`/`partial_failure`. Text/title edits regenerate **that language's** question + audio (`202`) and **move the instruction back to `processing`; Share stays disabled until every variant is ready again** (B19). Question edits set `source='manual'`, no audio. `409` after share |
| `POST /variants/:id/regenerate` | cookie | `{}` | Re-runs translate → question → audio for that language from the source; `202`; same `processing` re-entry and Share block as an edit |

Editing rules: a variant in `text_only` that gets new text returns to normal generation; failed stages retry only what is missing. Other languages keep their ready assets; the instruction returns to `ready` only when all variants are ready — stale audio is never shareable (B19).

### 6.7 Share

| Method · Path | Auth | Request | Response / Notes |
|---|---|---|---|
| `POST /instructions/:id/share` | cookie | `{ acceptTextOnly?: boolean }` | From `ready` (or `partial_failure` + true). `acceptTextOnly` applies **only to failed languages**; ready languages keep audio (B22). Workers archived since generate are dropped and reported as `archivedDropped`; deliveries are created only for the remaining active audience (B20). Transactional: instruction transition + token + delivery inserts commit together (D-08). Creates share token, returns `{ url, whatsappMessage: { en, ar }, deliveriesCreated, archivedDropped }`. Second call → `409 SHARE_CONFLICT`; client recovers via `share-link` |
| `GET /instructions/:id/share-link` | cookie | — | Decrypts stored token → `{ url, issuedAt, whatsappMessage:{en,ar}, reminderMessage:{en,ar} }`; used by Copy link / Copy reminder (D-05) |
| `POST /instructions/:id/regenerate-link` | cookie | — | New token, old revoked instantly; returns `{ url }`; existing deliveries stay |
| `POST /instructions/:id/archive` | cookie | — | From `shared`; worker links show closed screen |

Share response example:

```json
{ "data": {
  "url": "https://app.example.com/i/9dK2…",
  "whatsappMessage": {
    "en": "Morning crew — today's instruction: Roof safety checks. Listen in your language and confirm when done: https://app.example.com/i/9dK2…",
    "ar": "فريق الصباح — تعليمات اليوم: فحص سلامة السطح. يرجى الاستماع بلغتك والتأكيد عند الانتهاء: https://app.example.com/i/9dK2…"
  },
  "deliveriesCreated": 24,
  "archivedDropped": 0
} }
```

### 6.8 Board

| Method · Path | Auth | Request | Response / Notes |
|---|---|---|---|
| `GET /board/overview` | cookie | — | Home KPIs + exception lists (≤5 each): `{ kpis:{workers,crews,liveInstructions,needsHelp,notOpened,understood7d:{understood,targeted,rate}}, exceptions:{needsHelp,notOpened,wrong} }` (D-04) |
| `GET /instructions?status=shared\|archived\|all&cursor=&limit=` | cookie | — | Summaries: `{ id, title, type, crewName, sharedAt, targeted, opened, understood, helpCount, updatedAt }` |
| `GET /instructions/:id/deliveries?filter=all\|not_opened\|wrong\|needs_help` | cookie | — | Full audience (≤1,000, no cursor — D-17); rows `{ deliveryId, worker:{name,language}, status, firstAttemptCorrect, help, openedAt, answeredAt, completedAt }` + `meta.counts` (always whole-instruction counts) |
| `POST /deliveries/:id/resolve-help` | cookie | — | Sets `resolvedAt`, `resolvedBy=ownerId`; idempotent; `409` if not requested |

`understood` in summaries = firstAttemptCorrect AND completed within 24h of `sharedAt` (PRD D8). `meta.counts` adds `needsHelp`, `notOpened`, and `wrong` alongside `targeted`, `opened`, `understood`. KPI math in §8.

### 6.9 Exports

| Method · Path | Auth | Output |
|---|---|---|
| `GET /exports/instructions/:id.csv?includeHelpReasons=&includeTimes=` | cookie | Instruction delivery CSV (columns below). Both flags default `true`; `false` omits the corresponding columns (D-05) |
| `GET /exports/org.csv?from=&to=` | cookie | Deliveries whose instruction `sharedAt` ∈ range |
| `GET /exports/workers.csv` | cookie | Roster CSV |
| `GET /exports/all.zip` | cookie | `workers.csv` + `instructions.csv` + `deliveries.csv` + `README.txt` |

CSV rules: `text/csv; charset=utf-8`, UTF-8 **BOM**, RFC 4180, formula-injection escaping, ISO-8601 UTC timestamps, plus `org_timezone` column. Filename: `understood_{scope}_{yyyy-mm-dd}.csv`.

Instruction CSV columns:

```
instruction_id, title, type, source_language, shared_at, crew, worker_name,
language, status, first_attempt_correct, opened_at, answered_at, completed_at,
help_reason, help_resolved_at, org_timezone
```

### 6.10 Worker public API

| Method · Path | Auth | Request | Response / Notes |
|---|---|---|---|
| `GET /w/:token` | share token | — | `{ org:{name}, instruction:{title, titleVariants, type}, availableLanguages, audience:[{ id, displayName, firstName, lastInitial, language }], preview:false }`; after share the audience is delivery-derived, so workers dropped at share never appear (D-14); `displayName` uses the collision rule (B21); `410 LINK_UNAVAILABLE` if invalid/archived |
| `POST /w/:token/identify` | share token | `{ workerId, language? }` | `language` must be in `availableLanguages`; explicit choice updates the worker profile and, if different, the delivery variant + `languageChangeHistory` (D-02). Sets `openedAt` (first only); issues delivery token; returns full content + question + signed media URLs. `400 WORKER_NOT_IN_AUDIENCE` / `409 LANGUAGE_UNAVAILABLE` |
| `GET /w/state` | delivery token | — | Full current state: `delivery` (status, attempts, help, timestamps), worker, instruction content, signed media, and question with `correctIndex`/`selectedIndex` only after an attempt (D-07) |
| `POST /w/answer` | delivery token | `{ optionIndex }` + Idempotency-Key | `{ correct, correctIndex, firstAttempt, attemptsCount }`; appends attempt (max 2 — first + one retry, B18); second wrong auto-sets help `dont_understand` and queues email; further submissions → `409 ATTEMPTS_EXHAUSTED` |
| `POST /w/complete` | delivery token | `{}` + Idempotency-Key | `{ completedAt }`; requires ≥1 attempt; idempotent — replay on a completed delivery returns `200` with the original timestamp (D-15) |
| `POST /w/help` | delivery token | `{ reason }` + Idempotency-Key | Upserts help; queues batched email (≤10 min); `{ requestedAt }` |
| `POST /w/language` | delivery token | `{ language }` | Updates worker profile; **before completion** also switches this delivery's variant (`languageChangeHistory` entry). After completion the delivery snapshot is immutable and only the profile changes (B4). `409 LANGUAGE_UNAVAILABLE` if no variant (D-16). Returns `{ language, deliveryLanguage, content, audioUrl, audioExpiresAt, question }` |
| `GET /w/audio/:variantId` | delivery token | — | `{ url, expiresAt }` signed R2 URL (15 min) (D-01); `403` if variant ∉ delivery instruction |
| `GET /w/photo/:variantId` | delivery token | — | `{ url, expiresAt }` signed R2 URL (D-01) |
| `GET /w/preview/:previewToken` | preview token | — | Meta + first-audience-worker content; `preview:true`; no writes; `410 LINK_UNAVAILABLE` if expired |
| `GET /w/preview/:previewToken/audio/:variantId` | preview token | — | `{ url, expiresAt }` signed R2 URL (D-01) |

Identify response (full shape):

```json
{ "data": {
  "deliveryToken": "opaque-32-byte-token",
  "deliveryId": "665f30…",
  "worker": { "firstName": "Ramesh", "language": "ml" },
  "instruction": {
    "title": "മേൽക്കൂര സുരക്ഷാ പരിശോധന",
    "type": "info",
    "text": "…Malayalam text…",
    "audioUrl": "https://r2.example.com/orgs/…/audio/….mp3?X-Amz-Expires=900&…",
    "audioExpiresAt": "2026-11-13T07:20:00.000Z",
    "photoUrl": null,
    "photoExpiresAt": null,
    "question": { "text": "…", "options": ["…","…","…"] },
    "preview": false
  },
  "alreadyCompleted": false
} }
```

Answer response:

```json
{ "data": { "correct": true, "correctIndex": 0, "firstAttempt": true, "attemptsCount": 1 } }
```

### 6.11 Health

`GET /healthz` → `200 { status: "ok" }` when Mongo and Redis respond; `503` otherwise. No versions or internals exposed.

---

## 7. Lifecycle guards (exact rules)

| Action | Allowed when | Else |
|---|---|---|
| `PATCH /instructions/:id` | `status=draft` | `409 CONFLICT_STATE` |
| Upload voice/photo | `status=draft` | `409 CONFLICT_STATE` |
| `POST generate` | `status=draft`, content complete (voice: transcript confirmed), audience valid | `409 CONFLICT_STATE` / `400 VALIDATION_FAILED` / `400 TRANSCRIPT_UNCONFIRMED` |
| `PATCH /variants/:id`, `regenerate` | instruction `ready` or `partial_failure`; re-enters `processing`, Share disabled until ready again | `409 CONFLICT_STATE` |
| `POST share` | `ready`; or `partial_failure` with `acceptTextOnly=true` (failed languages only); archived workers dropped | `409 INSTRUCTION_NOT_READY` |
| `GET share-link` | `shared` or `archived` | `404 NOT_FOUND` |
| `regenerate-link` | `shared` | `409 CONFLICT_STATE` |
| `archive` | `shared` | `409 CONFLICT_STATE` |
| `DELETE instruction` | `draft` | `409 CONFLICT_STATE` |
| `identify` | instruction `shared`; a delivery exists for the worker (worker may be archived after share — Q7/D-14); requested language has a variant | `410 LINK_UNAVAILABLE` / `400 WORKER_NOT_IN_AUDIENCE` / `409 LANGUAGE_UNAVAILABLE` |
| `answer` | delivery `opened`/`answered`, attempts < 2 | `409 DELIVERY_COMPLETED` / `409 ATTEMPTS_EXHAUSTED` / `409 CONFLICT_STATE` |
| `complete` | `answered`; or already `completed` → `200` with original timestamp (D-15) | `409 CONFLICT_STATE` |
| `help` | `opened`/`answered`/`completed` | `409 CONFLICT_STATE` |
| `resolve-help` | `help.requested=true` | `409 CONFLICT_STATE` |
| `language change` | `opened`/`answered`: switch variant + profile · `completed`: profile only, snapshot immutable · variant must exist | `409 LANGUAGE_UNAVAILABLE` (D-16) / see B4 |

Partial-failure share: response includes `meta.warnings: [{ language, affectedWorkers }]` so the UI can name who receives text-only (PRD PIPE-7).

---

## 8. Aggregations and metric math

Board summary (per instruction):

```js
deliveries.aggregate([
  { $match: { orgId, instructionId } },
  { $group: {
      _id: null,
      targeted: { $sum: 1 },
      opened: { $sum: { $cond: [{ $ne: ["$openedAt", null] }, 1, 0] } },
      understood: { $sum: { $cond: [
        { $and: [
          { $eq: ["$firstAttemptCorrect", true] },
          { $ne: ["$completedAt", null] },
          { $lte: ["$completedAt", { $add: ["$__sharedAt", 86_400_000] }] }
        ] }, 1, 0] } },
      helpCount: { $sum: { $cond: ["$help.requested", 1, 0] } },
      needsHelp: { $sum: { $cond: [
        { $and: ["$help.requested", { $eq: ["$help.resolvedAt", null] }] }, 1, 0] } },
      notOpened: { $sum: { $cond: [{ $eq: ["$openedAt", null] }, 1, 0] } },
      wrong: { $sum: { $cond: [{ $eq: ["$firstAttemptCorrect", false] }, 1, 0] } }
  } }
])
```

(`__sharedAt` is injected from the instruction document; computed once per list via a single `$lookup`.)

Definitions:

| Metric | Formula |
|---|---|
| Response rate (24h) | count(openedAt ≤ sharedAt+24h) ÷ targeted |
| Understood rate (24h) | count(firstAttemptCorrect ∧ completedAt ≤ sharedAt+24h) ÷ targeted |
| Help rate | count(help.requested) ÷ targeted |
| Needs-help count | count(help.requested ∧ help.resolvedAt = null) |
| Not-opened count | count(openedAt = null) |
| Wrong count | count(firstAttemptCorrect = false) |
| Median time to done | median(completedAt − sharedAt) for completed deliveries |

**Home overview (`GET /board/overview`, D-04):** one `$facet` over deliveries for the org — KPI counts, unresolved help, unopened, and wrong — each exception branch capped at 5 and joined to the instruction title and worker name. `understood7d` covers instructions with `sharedAt >= now − 7d`; `rate` is null when targeted is 0. Full contract: [architecture/03 §5.3](../architecture/03-data-and-api-contracts.md).

All metric math happens server-side; the client never computes KPI denominators.

Board list query: one aggregation with `$lookup` to deliveries grouped by `instructionId`, sorted by `updatedAt desc`, cursor-paginated. Indexes make this O(page).

Usage: sum `ai_usage.units` where `unitType='chars'` for the current month → minutes estimate (`/~14 chars per second`).

---

## 9. Data lifecycle

**Deletion cascade (org deletion, `POST /org/delete`):**

1. Mark org `deleting` (internal field) and revoke sessions (`us:{userId}` cleared).
2. Queue job: deliveries → variants → instructions → imports/ai_usage/email_log → crews/workers → users/magic_links → R2 prefix `orgs/{orgId}/` (batch) → org row.
3. TTS cache assets are org-prefixed with media, so they die with the prefix.
4. Send confirmation email; the job is idempotent and logged.

**Instruction draft deletion:** removes draft media objects; no deliveries exist.

**Audio asset cleanup (cron weekly):** delete cache assets with `lastUsedAt` < 180 days AND no `variants.audioKey` references them.

**TTLs:** magic links by `expiresAt`; imports by `expireAt` (30d); email log 90d; sessions 30d (Redis); backlogs via BullMQ retention.

---

## 10. Index summary

| Collection | Indexes |
|---|---|
| `users` | `{email:1}` unique · `{orgId:1}` |
| `magic_links` | TTL `{expiresAt:1}` · `{tokenHash:1}` |
| `crews` | `{orgId:1, archivedAt:1, createdAt:-1}` |
| `workers` | `{orgId:1, crewId:1, archivedAt:1}` · `{orgId:1, normalizedName:1}` |
| `instructions` | `{orgId:1, status:1, createdAt:-1}` · `{orgId:1, crewId:1, createdAt:-1}` · `{shareTokenHash:1}` unique sparse |
| `variants` | `{instructionId:1, language:1}` unique · `{orgId:1, instructionId:1}` |
| `deliveries` | `{instructionId:1, workerId:1}` unique · `{instructionId:1, status:1}` · `{orgId:1, status:1}` · `{'deliveryTokens.hash':1}` sparse · `{orgId:1, 'help.requested':1, 'help.resolvedAt':1}` |
| `audio_assets` | `{orgId:1, cacheKey:1}` unique · `{lastUsedAt:1}` |
| `ai_usage` | `{orgId:1, createdAt:-1}` · `{instructionId:1}` |
| `imports` | `{orgId:1, createdAt:-1}` · TTL `{expireAt:1}` |
| `email_log` | TTL `{createdAt:1}` |

Write-cost note: deliveries carry five indexes — acceptable at pilot volumes (a few thousand writes/month) and required for board, worker auth, and Home exception paths. `autoIndex` is off in production; the index set is created by the initial migration.

---

## 11. Security acceptance tests (must exist in CI)

1. Cross-tenant: org A's cookie cannot read/patch/delete org B's crew, worker, instruction, variant, delivery, export.
2. Worker token from instruction X cannot read or mutate instruction Y.
3. Delivery token cannot access another delivery, another worker's state, or supervisor routes.
4. Revoked share link returns `410`; archived returns `410`; preview token cannot write (`403`).
5. Magic link: single use, 15-minute expiry, generic responses (no enumeration).
6. Idempotency: replay returns identical response; mismatched payload returns `409`.
7. Rate limit breach returns `429` with `Retry-After`.
8. CSV: formula payloads (`=HYPERLINK(...)`, `+1`, `-1`, `@x`) escaped; Arabic names intact after Excel open (BOM test fixture).
9. Uploads: wrong MIME rejected; oversize rejected; EXIF GPS stripped after re-encode.
10. Answer attempts: first attempt immutable; second wrong auto-sets help; third answer rejected with `ATTEMPTS_EXHAUSTED`; completion idempotent.
11. Preview creates zero deliveries and zero events.
12. Sorted board counts match fixture deliveries (including the 24h understood window).
13. Media payloads return signed R2 URLs with ≤15-minute expiry; an expired URL fails at R2; a refresh endpoint issues a new one; a variant from another instruction returns `403`.
14. Identify with a language outside `availableLanguages` returns `409 LANGUAGE_UNAVAILABLE` and writes nothing; a valid choice updates the profile and the delivery snapshot with one history entry.
15. A worker archived after share can open and complete the existing delivery; a worker archived before share has no delivery and cannot identify (`400 WORKER_NOT_IN_AUDIENCE`).
16. Repeating complete with a new idempotency key returns `200` and the original `completedAt`; a third answer still returns `ATTEMPTS_EXHAUSTED`.
17. Concurrent share calls produce exactly one shared instruction, one token, and one delivery per active audience worker.
18. Replaying a stale variant job (older `revision`) writes no asset and leaves the newer text/audio intact.

---

## 12. Example documents

**Instruction (shared, voice, 4 languages)**

```json
{
  "_id": "665f1a2b3c4d5e6f708192a3",
  "orgId": "665f00000000000000000001",
  "crewId": "665f00000000000000000010",
  "audienceWorkerIds": ["665f00000000000000000021", "665f00000000000000000022"],
  "title": "Roof safety checks",
  "type": "info",
  "content": {
    "kind": "voice",
    "audioKey": "orgs/665f…/instructions/665f…/voice-9a1b.webm",
    "audioMime": "audio/webm",
    "durationS": 40,
    "transcript": "Before entering the roof, wear your harness and check the gate.",
    "transcriptStatus": "confirmed",
    "detectedSourceLanguage": "en"
  },
  "sourceLanguage": "en",
  "status": "shared",
  "generation": 1,
  "pipeline": { "startedAt": "2026-11-12T06:59:00.000Z", "finishedAt": "2026-11-12T07:01:30.000Z", "lastError": null },
  "shareTokenHash": "hmac…",
  "shareTokenEnc": "v1:iv:tag:cipher…",
  "shareTokenIssuedAt": "2026-11-12T07:02:11.000Z",
  "createdBy": "665f00000000000000000002",
  "sharedBy": "665f00000000000000000002",
  "sharedAt": "2026-11-12T07:02:11.000Z",
  "createdAt": "2026-11-12T06:58:40.000Z",
  "updatedAt": "2026-11-12T07:02:11.000Z"
}
```

**Variant (Malayalam)**

```json
{
  "_id": "665f40aa…",
  "orgId": "665f00000000000000000001",
  "instructionId": "665f1a2b3c4d5e6f708192a3",
  "language": "ml",
  "title": "മേൽക്കൂര സുരക്ഷാ പരിശോധന",
  "text": "മേൽക്കൂരയിൽ പ്രവേശിക്കുന്നതിന് മുമ്പ് ഹാർനെസ് ധരിച്ച് ഗേറ്റ് പരിശോധിക്കുക.",
  "audioKey": "orgs/665f…/audio/8c1d….mp3",
  "audioChars": 74,
  "audioDurationS": 26,
  "audioStatus": "ready",
  "question": {
    "text": "മേൽക്കൂരയിൽ പ്രവേശിക്കുന്നതിന് മുമ്പ് എന്താണ് ചെയ്യേണ്ടത്?",
    "options": ["ഹാർനെസ് ധരിക്കുക", "ക്ലയന്റിനെ വിളിക്കുക", "ഫോട്ടോ എടുക്കുക"],
    "correctIndex": 0,
    "source": "ai"
  },
  "questionStatus": "ready",
  "status": "ready",
  "stages": { "translate": "done", "question": "done", "audio": "done" },
  "revision": 1,
  "createdAt": "2026-11-12T07:00:01.000Z",
  "updatedAt": "2026-11-12T07:01:12.000Z"
}
```

**Delivery**

```json
{
  "_id": "665f55bb…",
  "orgId": "665f00000000000000000001",
  "instructionId": "665f1a2b3c4d5e6f708192a3",
  "workerId": "665f00000000000000000021",
  "variantId": "665f40aa…",
  "language": "ml",
  "languageChangeHistory": [],
  "status": "completed",
  "firstAttemptCorrect": true,
  "attempts": [{ "optionIndex": 0, "correct": true, "at": "2026-11-12T07:05:04.000Z" }],
  "openedAt": "2026-11-12T07:03:40.000Z",
  "answeredAt": "2026-11-12T07:05:04.000Z",
  "completedAt": "2026-11-12T07:05:09.000Z",
  "help": { "requested": false, "reason": null, "requestedAt": null, "resolvedAt": null, "resolvedBy": null },
  "deliveryTokens": [{ "hash": "hmac…", "createdAt": "2026-11-12T07:03:40.000Z", "lastSeenAt": "2026-11-12T07:05:09.000Z" }],
  "channel": "link",
  "createdAt": "2026-11-12T07:02:11.000Z",
  "updatedAt": "2026-11-12T07:05:09.000Z"
}
```

---

## 13. Decision log (database & API)

| # | Decision | Rationale |
|---|---|---|
| B1 | Envelope `{data, meta}` + typed error codes | Predictable clients; central error mapping |
| B2 | Share token stored as **hash + AES-GCM ciphertext** | Hash for lookup security; ciphertext because supervisors must re-copy links later |
| B3 | Up to 5 delivery tokens per delivery | Multi-device without breaking in-flight answers |
| B4 | Language change is allowed until completion and audited; after completion the worker profile updates but the delivery snapshot never changes | Worker fixes a wrong language; `languageChangeHistory` preserves the audit trail while CREW-4 still protects completed records (refines PRD D3) |
| B5 | Cursor pagination everywhere | Stable lists under polling; no offset drift |
| B6 | Idempotency keys on all worker mutations | Retries on flaky networks must never double-record |
| B7 | Exports are server-generated snapshots with BOM | Excel compatibility is a product requirement, not an implementation detail |
| B8 | Org deletion is immediate after typed confirmation + email | Simpler than a 7-day grace; PRD's "within 7 days" is an upper bound (SET-2) |
| B9 | Variants carry a translated title | Worker page shows the instruction title in their language |
| B10 | Phone optional, never messages in v0.1 | Keeps PII minimal; WhatsApp is v0.2 |
| B11 | Draft content is mutable; shared content is not | Trust and audit integrity |
| B12 | Preview uses stateless signed tokens + read-only worker view | Same UI as workers with zero write paths |
| B13 | "Understood" always means the 24h window — board, analytics, and exports | One number and one definition (D8); all-time completion remains visible per delivery, so nothing is hidden |
| B14 | Regenerating a share link does **not** revoke delivery tokens | The link gates entry; tokens belong to workers already mid-task. Rotation contains a leaked link without stranding them. A hard revoke-all action arrives with team seats in v0.2 |
| B15 | Duplicate names on import are **warned, never blocked or skipped** | Duplicate names are legal and common in GCC crews; blocking rejects valid workers, skipping silently loses them. All-or-nothing applies only to real validation errors |
| B16 | Board counts aggregate on read; no denormalized counters in v0.1 | Indexed `$group` is fast at pilot volume. Add counters only if board/API p95 exceeds 300ms on M0 — correctness before premature optimization |
| B17 | Transcription is a pre-pipeline step queued on voice upload; Generate requires a confirmed transcript and source language | The composer must show the detected language before Generate (S-10); starting STT inside Generate would force a blind source-language choice |
| B18 | Attempts are capped at 2 total; the second wrong answer auto-sets help | Matches WORK-4 ("retry once"); a third guess is worse than asking a human |
| B19 | Any variant edit or regeneration from `ready`/`partial_failure` re-enters `processing` and blocks Share until every variant is ready | Stale audio must never be shareable; the preview the supervisor approved must be the one workers receive |
| B20 | At share, workers archived since generate are dropped from the audience and reported as `archivedDropped` | Resolves the generate→share race without stranding an archived worker or resurrecting them |
| B21 | The worker API returns a computed `displayName`; collisions use full last names only among colliding workers, then a numeric suffix | Disambiguation without exposing phones or full surnames crew-wide (WORK-1/WORK-2) |
| B22 | `acceptTextOnly` applies only to failed languages | PIPE-7 is per-language; one boolean must not downgrade languages that already have audio |
| B23 | Phase 4 contract reconciliation (v0.2.0): D-01…D-17 — signed media URLs, pre-identify language, six-variant default, home overview, preview-token reference, transactional share, generation/revision fencing, delivery-derived audience, complete idempotency, `LANGUAGE_UNAVAILABLE`, unpaginated per-instruction delivery list | Phase 3 proved behaviors the contract could not express: `<audio>` cannot send a bearer token, the picker changes language before identify, Home needs org-wide exceptions in one call, and stale pipeline jobs need a fence. Full rationale and exact shapes: [architecture/03 §9](../architecture/03-data-and-api-contracts.md) |

---

## 14. Questions closed in review

All five questions in this document are resolved; none required customer input. No open questions remain here.

| # | Resolution |
|---|---|
| Q13 | 24h window everywhere (B13) |
| Q14 | Link regeneration leaves delivery tokens intact (B14) |
| Q15 | Instant deletion stays, after typed confirmation + email (B8). Revisit when seats ship in v0.2 |
| Q16 | Duplicates warn and never block (B15); preview shows them |
| Q17 | Aggregate on read; denormalize only on measured need (B16) |

The only genuinely open items are external verifications, not product choices: Meta verification and MoR eligibility in [03b](./03b-v0.2-surfaces.md) Q7–Q8, price acceptance Q9, and the build-time technical checks T1–T7 in [04-tdd.md](./04-tdd.md). They resolve through the pilot and tests, not a decision meeting.

**Consistency pass (2026-11-12):** doc 06 §12's C1–C11 were applied across docs 02–05. Doc-05-specific refinements landed as B17–B22 plus the amended B4; versions: 02 → 0.1.2, 03 → 0.1.1, 04 → 0.1.1, 05 → 0.1.2, 06 → 0.1.1.

**Phase 4 contract pass (2026-11-13):** doc 05 → 0.2.0. B23 and D-01…D-17 applied: signed media, pre-identify language, six-variant default, `/board/overview`, preview-token endpoint, share transaction/recovery, `generation`/`revision`, delivery-derived audience, complete idempotency, `LANGUAGE_UNAVAILABLE`, unpaginated delivery list, new help index. No product scope changed.

---

**Next document:** 06 — Development Backlog: epics, user stories, and build tasks derived from this contract, ordered for the 6-week build.
