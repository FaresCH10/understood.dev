# 03 — Data & API Contracts

**Phase 4 · Document 3 of 7** · Version 0.1 · Date 2026-11-13
**Owner:** Founder · **Status:** Contract amendment set, applied to doc 05 v0.2.0
**Builds on:** [01 — System Architecture](./01-system-architecture.md) · [02 — Runtime & Pipeline](./02-runtime-and-pipeline.md) · [Database & API Spec](../docs/05-database-api-spec.md)

---

## 0. Why this document exists

Doc 05 is the contract. Phase 3 and the runtime design exposed places where the contract was silent, ambiguous, or impossible to implement as written. Each is resolved here with an ID, then applied to doc 05. After this document, doc 05 v0.2.0 is the single authoritative API contract; this document records what changed and why.

Two kinds of change are kept separate:

- **Contract amendments (D-01…D-17)** — request/response, guard, or schema changes. Applied to doc 05.
- **Internal design (no API change)** — job granularity, transactions, indexes, retention. Implemented in code, documented here.

No amendment changes product scope. None adds a screen, a channel, or a role.

---

## 1. Collection ownership

The module map is in [01 §5](./01-system-architecture.md). At the field level:

| Collection | Sole writer(s) | Read by |
|---|---|---|
| `organizations` | `orgs` (identity), `settings` (name, timezone, locale) | all modules via session org |
| `users` | `auth` | `orgs`, `settings` |
| `magic_links` | `auth` | — |
| `crews` | `crews` | `workers`, `instructions`, `board` |
| `workers` | `workers` | `sharing`, `deliveries`, `exports`, `board` |
| `imports` | `workers` | — |
| `instructions` draft fields + content | `instructions` | `pipeline`, `sharing`, `board`, `exports` |
| `instructions` pipeline fields (`pipeline.*`, `generation`) | `pipeline` | `instructions`, `board` |
| `instructions` share fields (`status=shared`, tokens, `sharedAt`, `sharedBy`) | `sharing` | `instructions`, `deliveries`, `board` |
| `instructions` archive fields | `sharing` | `board` |
| `variants` | `pipeline` | `instructions`, `sharing`, `deliveries`, `exports` |
| `deliveries` creation | `sharing` | `deliveries`, `board`, `exports` |
| `deliveries` worker state | `deliveries` | `board`, `exports` |
| `deliveries` help resolution | `board` via `deliveries` service | `board`, `exports` |
| `audio_assets` | `pipeline` | `media`, cleanup |
| `ai_usage` | `pipeline`, `usage` | `settings`, founder queries |
| `email_log` | `email` | — |

Rules:

1. `sharing` creates deliveries; nothing else does. `deliveries` mutates worker state but never creates or deletes a delivery.
2. `board` never writes deliveries directly; "Mark resolved" calls the `deliveries.resolveHelp` service.
3. `instructions` may write supervisor edits to variants, but only through the pipeline's `applyEdit` function so the revision and status transition happen together.
4. `pipeline` never changes `status` to `shared`; only `sharing` does.
5. `exports` and `board` are read-only and use read repositories, never models owned by other modules.

---

## 2. Schema amendments

Applied to doc 05 §3.7 and §3.8.

| Field | Collection | Type | Rules | Why |
|---|---|---|---|---|
| `generation` | `instructions` | number | Default 0; `+1` on generate and on every variant edit/regenerate; never decreases | Stale-job fencing and status recomputation |
| `revision` | `variants` | number | Default 1; `+1` on that variant's edit/regenerate; never decreases | A slow job from an older edit can never write assets over newer ones |

No other field is added. `pipeline` already carries `{startedAt, finishedAt, lastError}`. `variants.stages` already carries per-stage state. `deliveries.attempts` already carries the attempt array and cap.

**Index amendment.** One compound index is added to `deliveries`:

```
{ orgId: 1, 'help.requested': 1, 'help.resolvedAt': 1 }
```

It serves the Home "needs help" count and exception list without scanning every delivery in the org. Total delivery indexes become five. At pilot volume (thousands of writes/month) this remains a non-issue; doc 05 §10's write-cost note is updated accordingly.

**Derived audience rule (D-14).** `instructions.audienceWorkerIds` stays the generate-time snapshot. After share, the authoritative audience is the set of workers with a delivery. This matters because workers archived between generate and share are dropped (C6) and must not appear in the picker. `GET /w/:token` therefore returns workers with deliveries, not the raw snapshot.

---

## 3. Transaction and consistency boundaries

| # | Operation | Boundary | Guard | On failure |
|---|---|---|---|---|
| T1 | Generate | Transaction: instruction `draft → processing` + variant inserts | `status='draft'`, `generation` unchanged | Nothing written; 409 or 400 |
| T2 | Share | Transaction: instruction `ready/partial_failure → shared` + token fields + delivery inserts + text-only variant updates | status guard; `shareTokenHash` null | Nothing shared; 409 on retry |
| T3 | Import commit | Transaction: worker inserts + import `committed` | import parsed, no errors | No partial roster |
| T4 | Variant edit / regenerate | Transaction: instruction `generation+1`, `status='processing'`; variant `revision+1`, stage resets | instruction `ready/partial_failure`; not shared | 409; no status change |
| T5 | Answer | Single-document pipeline update on `deliveries` | `attempts.length < 2`, status not completed | 409 with specific code |
| T6 | Complete | Single-document guarded update | `status='answered'` or already `completed` | 200 if completed, 409 otherwise |
| T7 | Language change | Single-document update + profile update (two collections, no transaction) | delivery not completed for variant switch | Profile may update while delivery switch fails only if the variant is missing; the service checks the variant before writing the profile |

T7 is deliberately not transactional. The only failure mode is "profile language changed, delivery language unchanged" when the requested variant does not exist; the service checks the variant first and returns `LANGUAGE_UNAVAILABLE` before writing either. Once the check passes, the writes cannot conflict (single worker, single delivery, no concurrent editor). A transaction would add cost for no correctness.

T1 and T2 require a replica set. Atlas M0 provides one; local development and CI use `mongodb-memory-server` in replica-set mode (already the testing plan in TDD §14). A single-node Mongo without transactions is not a supported environment.

---

## 4. Hot queries and index plan

| Query | Index used | Notes |
|---|---|---|
| Share-token lookup | `instructions {shareTokenHash:1}` unique sparse | One document; then status check |
| Delivery-token auth | `deliveries {'deliveryTokens.hash':1}` sparse | Multikey; returns one delivery |
| Identify | `deliveries {instructionId:1, workerId:1}` unique | Point read |
| Roster page | `workers {orgId:1, crewId:1, archivedAt:1}` | Cursor by `_id`; 200/page |
| Board list | `instructions {orgId:1, status:1, createdAt:-1}` + `$lookup` deliveries by `instructionId` | Page ≤20 instructions; `$lookup` uses `{instructionId:1, status:1}` |
| Board detail deliveries | `deliveries {instructionId:1, status:1}` | Returns the full audience (≤1,000, D-17) |
| Help exceptions | `deliveries {orgId:1, 'help.requested':1, 'help.resolvedAt':1}` | New index; unresolved only |
| Understood aggregation | `deliveries {instructionId:1, status:1}` | `$match` instruction ids from the page |
| Export by instruction | `deliveries {instructionId:1, status:1}` | Snapshot rows; worker names joined by `_id` |
| Worker state reload | `deliveries {'deliveryTokens.hash':1}` | Point read |
| Org usage | `ai_usage {orgId:1, createdAt:-1}` | Current month range |
| Imports | `imports {orgId:1, createdAt:-1}` + TTL | — |

**Deliberate scan.** Home KPI counts (active workers, active crews, live instructions) use `countDocuments` with `orgId` + status filters. At ≤1,000 workers and ≤10 crews, these are index-prefix scans of a few hundred documents. Adding three more indexes to save 2 ms would cost more in write amplification than it returns. The caps in 01 §9 are what keep this honest.

**Sorting.** Board instructions sort by `createdAt desc` with `_id` as the cursor tiebreak. Delivery rows have no server sort requirement (D-17): the client sorts and filters the full per-instruction list, which is at most 1,000 rows (typically 24–75).

---

## 5. Aggregation contracts

All math is server-side (doc 05 §8). These definitions are normative; the client only formats.

### 5.1 Delivery-derived flags

```
targeted            = 1 delivery
opened              = openedAt != null
answered            = attempts.length >= 1
wrong               = firstAttemptCorrect === false
needsHelp           = help.requested === true && help.resolvedAt == null
notOpened           = openedAt == null
understood          = firstAttemptCorrect === true
                      && completedAt != null
                      && completedAt <= sharedAt + 24h
```

`helpCount` counts requests, including resolved ones. `needsHelp` counts unresolved ones. A worker can be both `wrong` and `needsHelp`; the board shows both badges because they answer different questions.

### 5.2 Board summary (per instruction)

```js
{
  targeted, opened, understood, helpCount,
  needsHelp: unresolved help count,
  notOpened: openedAt == null count,
  wrong:    firstAttemptCorrect === false count
}
```

`understood` uses the instruction's `sharedAt`, never "now". Recomputing an old instruction cannot change its understood count because the anchor is immutable.

### 5.3 Home overview

`GET /board/overview` (D-04) returns:

```json
{ "data": {
  "kpis": {
    "workers": 24,
    "crews": 3,
    "liveInstructions": 1,
    "needsHelp": 2,
    "notOpened": 5,
    "understood7d": { "understood": 18, "targeted": 24, "rate": 0.75 }
  },
  "exceptions": {
    "needsHelp": [{
      "deliveryId": "…", "instructionId": "…", "instructionTitle": "Roof safety checks",
      "workerName": "Ramesh K.", "language": "ml", "reason": "dont_understand",
      "requestedAt": "2026-11-13T05:40:00.000Z", "sharedAt": "2026-11-13T04:00:00.000Z"
    }],
    "notOpened": [{
      "deliveryId": "…", "instructionId": "…", "instructionTitle": "Roof safety checks",
      "workerName": "Anil M.", "language": "hi",
      "sharedAt": "2026-11-13T04:00:00.000Z", "hoursSinceShare": 3
    }],
    "wrong": [{
      "deliveryId": "…", "instructionId": "…", "instructionTitle": "Roof safety checks",
      "workerName": "Fatima S.", "language": "ar", "answeredAt": "2026-11-13T04:15:00.000Z"
    }]
  }
}, "meta": { "generatedAt": "2026-11-13T07:05:00.000Z" } }
```

| Field | Definition |
|---|---|
| `workers` | Active workers in the org (`archivedAt: null`) |
| `crews` | Active crews in the org |
| `liveInstructions` | Instructions with `status='shared'` |
| `needsHelp` | Unresolved help requests across all shared instructions |
| `notOpened` | Deliveries of shared instructions with `openedAt: null` |
| `understood7d` | For instructions with `sharedAt >= now − 7d`: sum understood ÷ sum targeted; `rate: null` when targeted = 0 |
| Exception lists | Oldest first, capped at 5 each; `hoursSinceShare` rounded down; UI shows 3 cards per S-03 |

The endpoint is one aggregation pipeline with `$facet`: KPI counts, unresolved help, unopened, and wrong. Each exception branch `$lookup`s the instruction title and worker name, then `$limit 5`. At pilot scale this is a single-digit-millisecond query per org.

### 5.4 Usage

`GET /org/usage` sums `ai_usage.units` where `unitType='chars'` for the current calendar month in the org timezone, divides by 14 chars/second to estimate TTS minutes, and returns the soft cap (150 min). Failed provider attempts are included if the provider billed them; the estimate is deliberately conservative.

### 5.5 Export

Export rows are the delivery snapshots, not a live metric computation:

```
worker_name = current worker name (name edits are corrections, not history rewrites)
language    = delivery.language snapshot
status      = delivery.status
first_attempt_correct = delivery.firstAttemptCorrect
help_reason = delivery.help.reason when includeHelpReasons
opened/answered/completed = delivery timestamps when includeTimes
```

The 24-hour understood flag is **not** a column. The CSV is a record, not a scoreboard; supervisors who need the metric read the board. This avoids a second definition of "understood" living in a spreadsheet.

---

## 6. Storage layout and media policy

| Object | R2 key | Content type | Lifecycle |
|---|---|---|---|
| Supervisor voice | `orgs/{orgId}/instructions/{instructionId}/source-{uuid}.{ext}` | as recorded | Deleted with draft; retained with shared instruction |
| Supervisor photo | `orgs/{orgId}/instructions/{instructionId}/photo-{uuid}.jpg` | `image/jpeg` | Same |
| TTS audio | `orgs/{orgId}/audio/{sha256}.mp3` | `audio/mpeg` | Cache: unreferenced + `lastUsedAt` > 180 days |
| Mongo backup | `backups/mongo/{yyyy-mm-dd}.gz` (separate bucket) | `application/gzip` | 30 days |
| Export | none (streamed) | `text/csv` | Never stored |

**Signed URLs.** R2 bucket is private. The API signs GET URLs with a 15-minute expiry and `response-content-disposition=inline`. Worker payloads embed the signed URL plus `expiresAt`; the client refreshes through the authenticated media endpoint when needed (02 §4.9). CORS on the bucket allows `GET` and `HEAD` from the app origin so the service worker can cache audio after a successful play.

**Cache headers.** Audio objects are immutable by key; the signed response sets `Cache-Control: private, max-age=900`. The service worker keeps its own copy keyed by variant id + revision, so a replay does not depend on the browser HTTP cache or the signature.

**No public objects.** There is no bucket policy that grants anonymous read. A leaked URL is valid for at most 15 minutes and only for one object.

---

## 7. Retention and deletion

| Data | Retention | Mechanism |
|---|---|---|
| Org, users, crews, workers, instructions, variants, deliveries, usage | Life of org | Explicit deletion only |
| Magic links | 15 min (TTL cleanup later) | TTL `{expiresAt:1}` |
| Sessions | 30-day sliding | Redis TTL |
| Imports | 30 days | TTL `{expireAt:1}` |
| Email log | 90 days | TTL `{createdAt:1}` |
| TTS cache asset | 180 days after last use, if unreferenced | Weekly cron |
| Request logs | 14 days | Docker log rotation |
| Backups | 30 days | R2 lifecycle rule |
| Sentry events | 30 days (free tier) | Provider |
| PostHog events | 1 year, pseudonymous | Provider |

**Draft deletion.** `DELETE /instructions/:id` (draft only) deletes the source voice/photo objects and the draft document. No variants or deliveries exist, so nothing else changes.

**Org deletion.** Doc 05 §9 cascade is unchanged: mark `deleting`, revoke sessions, queue the job, delete children in dependency order, delete the R2 prefix, delete the org, confirm by email. The job is idempotent and resumable; a re-run continues from missing collections. The job logs counts, not names.

**Worker deletion.** Workers are archived, never hard-deleted in v0.1, so deliveries and audit rows remain referentially intact. Archive removes them from future audiences; it does not touch existing deliveries (Q7/P4-2).

---

## 8. Migration and index policy

- **`autoIndex=false`** in all deployed environments.
- Migrations live in `packages/api/src/migrations/YYYYMMDD-name.ts`, are forward-only, and are recorded in a `migrations` collection with `{name, appliedAt, checksum}`.
- A deploy runs `npm run migrate` before the new image takes traffic; a failed migration aborts the deploy.
- Index builds use `createIndexes` with `background: true` where the driver supports it; at pilot data volume they complete immediately.
- Destructive migrations require a fresh `mongodump` first and a one-line rollback note in the migration file.
- Greenfield project: the first migration creates the initial index set (doc 05 §10 + §2's help index). There is no legacy data migration.
- Seed (`seed-demo`) is idempotent by fixed `_id`s and refuses to run when `NODE_ENV=production` unless `ALLOW_SEED=true` is explicitly set for a demo environment.

---

## 9. API amendment register

Each amendment was applied to doc 05 v0.2.0. "Blocking" means Phase 5 cannot implement the related screen or story without it.

| ID | Amendment | Endpoint / section | Blocking |
|---|---|---|---|
| **D-01** | Media payloads carry signed R2 URLs; worker media endpoints return JSON instead of `302` | doc 05 §6.10 (supervisor variant audio keeps its cookie-authenticated `302`) | Worker audio, preview |
| **D-02** | Picker accepts a language before identify; meta exposes localized titles and available languages; explicit choice updates the worker profile | doc 05 §6.10 | W-01, W-02, W-11 |
| **D-03** | Generate produces all six variants by default; `LANGUAGE_UNAVAILABLE` when a switch targets a missing variant | doc 05 §6.5, §6.10, §5.2 | W-11, pipeline fan-out |
| **D-04** | `GET /board/overview` powers Home KPIs and exceptions | doc 05 §6.8 | S-03 |
| **D-05** | Export accepts `includeHelpReasons` and `includeTimes`; share-link returns WhatsApp and reminder messages | doc 05 §6.9, §6.7 | S-15, S-13, S-14 |
| **D-06** | Preview-token endpoint is in the API reference with its guards | doc 05 §6.5 | S-11 preview |
| **D-07** | `GET /w/state` returns full content and signed media for reload and completed recap | doc 05 §6.10 | W-09, reload |
| **D-08** | Share is transactional; second share returns `SHARE_CONFLICT` and the client recovers via share-link | doc 05 §6.7, §7 | S-13 |
| **D-09** | Production worker URLs are `/i/:shareToken` and `/i/preview/:previewToken`; no state in query parameters | doc 05 §6.7 example | Routing |
| **D-10** | Design tokens are copied and drift-checked; fonts are self-hosted | none (frontend) | Build setup |
| **D-11** | Help alerts are batched within 10 minutes; reminders are copy-only | doc 05 §6.8 behavior | S-03, S-14 |
| **D-12** | `instructions.generation` and `variants.revision` fence stale jobs; one resumable job per variant | doc 05 §3.7, §3.8 | Pipeline correctness |
| **D-13** | TTS cache path is `orgs/{orgId}/audio/{hash}.mp3`; TDD §7.5's instruction-scoped path is superseded | doc 05 §3.10 | Media |
| **D-14** | Picker audience is delivery-derived after share; a worker archived after share can still open their existing delivery | doc 05 §6.10, §7 | W-01, Q7 |
| **D-15** | Completing an already-completed delivery with a new idempotency key returns `200` with the original `completedAt` | doc 05 §7 | W-08 |
| **D-16** | `LANGUAGE_UNAVAILABLE` (409) added to the error catalog | doc 05 §5.2 | W-11 |
| **D-17** | Per-instruction delivery list returns the full audience (≤1,000) instead of cursor pages | doc 05 §6.8 | S-14 filters |

### 9.1 Exact shapes for changed endpoints

**`GET /api/v1/w/:token`** (D-02, D-14)

```json
{ "data": {
  "org": { "name": "Al Noor Facilities" },
  "instruction": {
    "title": "Roof safety checks",
    "titleVariants": {
      "en": "Roof safety checks",
      "ar": "فحص سلامة السطح",
      "hi": "छत सुरक्षा जाँच",
      "ur": "چھت کی حفاظت کی جانچ",
      "ml": "മേൽക്കൂര സുരക്ഷാ പരിശോധന",
      "bn": "ছাদের নিরাপত্তা পরীক্ষা"
    },
    "type": "info"
  },
  "availableLanguages": ["ar", "en", "hi", "ur", "ml", "bn"],
  "audience": [
    { "id": "665f…", "displayName": "Ramesh K.", "firstName": "Ramesh", "lastInitial": "K.", "language": "ml" }
  ],
  "preview": false
} }
```

`titleVariants` falls back to `instruction.title` for languages where the variant title is null. `audience` after share is derived from deliveries (D-14); in preview it is the snapshot. `availableLanguages` is the variant set (six under D-03).

**`POST /api/v1/w/:token/identify`** (D-02)

```json
{ "workerId": "665f…", "language": "ml" }
```

`language` is optional. When present it must be in `availableLanguages`; the worker profile language is updated and, if it differs from the delivery snapshot, the delivery switches variant and records `languageChangeHistory`. Response is the doc 05 shape plus:

```json
{ "data": {
  "deliveryToken": "…",
  "deliveryId": "…",
  "worker": { "firstName": "Ramesh", "language": "ml" },
  "instruction": {
    "title": "മേൽക്കൂര സുരക്ഷാ പരിശോധന",
    "type": "info",
    "text": "…",
    "audioUrl": "https://r2.example.com/…?X-Amz-Expires=900&…",
    "audioExpiresAt": "2026-11-13T07:20:00.000Z",
    "photoUrl": null,
    "photoExpiresAt": null,
    "question": { "text": "…", "options": ["…","…","…"] }
  },
  "alreadyCompleted": false
} }
```

If the instruction is archived, identify returns `410 LINK_UNAVAILABLE`. If the worker was dropped at share (no delivery), it returns `400 WORKER_NOT_IN_AUDIENCE`. If the language has no variant, `409 LANGUAGE_UNAVAILABLE` with `details: [{ field: "language", availableLanguages: [...] }]`.

**`GET /api/v1/w/state`** (D-07)

```json
{ "data": {
  "delivery": {
    "id": "665f…",
    "status": "answered",
    "language": "ml",
    "attemptsCount": 1,
    "firstAttemptCorrect": true,
    "openedAt": "…", "answeredAt": "…", "completedAt": null,
    "help": { "requested": false, "reason": null, "requestedAt": null, "resolvedAt": null }
  },
  "worker": { "firstName": "Ramesh", "language": "ml" },
  "instruction": {
    "title": "…", "type": "info", "text": "…",
    "audioUrl": "…", "audioExpiresAt": "…", "photoUrl": null, "photoExpiresAt": null
  },
  "question": {
    "text": "…", "options": ["…","…","…"],
    "correctIndex": 0, "selectedIndex": 0, "correct": true
  },
  "preview": false
} }
```

`correctIndex` and `selectedIndex` are present only after at least one attempt. Before an attempt, `question` has `text` and `options` only. This is the rule the worker UI depends on: no answer may leak before submission.

**`GET /api/v1/w/audio/:variantId`** and **`/photo/:variantId`** (D-01)

`200 { "data": { "url": "https://r2…", "expiresAt": "2026-11-13T07:20:00.000Z" } }`

`403 FORBIDDEN` if the variant does not belong to the delivery's instruction. The preview equivalent is `GET /w/preview/:token/audio/:variantId`, authorized by the preview token in the path.

**`POST /api/v1/instructions/:id/preview-token`** (D-06)

`201 { "data": { "token": "…", "url": "https://app.example.com/i/preview/…", "expiresAt": "…" } }`

Allowed when the instruction is `ready`, `partial_failure`, or `shared`; otherwise `409 CONFLICT_STATE`. The token is stateless, 15 minutes, read-only.

**`GET /api/v1/instructions/:id/share-link`** (D-05)

```json
{ "data": {
  "url": "https://app.example.com/i/9dK2…",
  "issuedAt": "2026-11-13T04:00:00.000Z",
  "whatsappMessage": { "en": "…", "ar": "…" },
  "reminderMessage": { "en": "…", "ar": "…" }
} }
```

Message text comes from the content deck (doc 03 §10) and is rendered server-side so every client shows the same copy. `reminderMessage` is copy-ready WhatsApp text with the link; nothing is sent by the product (D20).

**`GET /api/v1/exports/instructions/:id.csv?includeHelpReasons=&includeTimes=`** (D-05)

Both params are booleans, default `true`. When `false`, the corresponding columns (`help_reason`, `help_resolved_at`; `opened_at`, `answered_at`, `completed_at`) are omitted from the header and every row. The S-15 preview table uses the same flags. Filename and BOM rules are unchanged.

**`GET /api/v1/instructions/:id/deliveries`** (D-17)

Returns all rows for the instruction, capped at 1,000 (the audience cap), with `meta.counts`:

```json
{ "data": [
    { "deliveryId": "…", "worker": { "name": "Ramesh K.", "language": "ml" },
      "status": "answered", "firstAttemptCorrect": true,
      "help": { "requested": false, "reason": null, "resolvedAt": null },
      "openedAt": "…", "answeredAt": "…", "completedAt": null }
  ],
  "meta": { "counts": { "targeted": 24, "opened": 21, "understood": 17,
                        "needsHelp": 2, "notOpened": 3, "wrong": 1 } } }
```

The `filter` param remains accepted for API callers and returns the filtered subset with the same `meta.counts` (counts are always for the whole instruction). The UI fetches once and filters locally; search by name runs over the loaded rows. There is no cursor for this endpoint in v0.1.

### 9.2 Error catalog additions

| Code | HTTP | When | Client behavior |
|---|---|---|---|
| `LANGUAGE_UNAVAILABLE` | 409 | A requested language has no variant (only reachable if P4-1 is rejected) | Language sheet marks the row unavailable; no state change |
| `LINK_UNAVAILABLE` | 410 | Also used for an invalid or expired preview token | "Preview expired" screen with a mint-new button (supervisor) or "Link closed" (worker) |

`PIPELINE_TIMEOUT` and `STT_FAILED` are stage error codes stored in `variants.lastError.code` and `instructions.pipeline.lastError.code`; they are never HTTP error codes. The status endpoint returns them for display.

### 9.3 Guard changes

| Action | Doc 05 v0.1.2 | v0.2.0 |
|---|---|---|
| `identify` | worker active and in audience | instruction shared; delivery exists for the worker; worker may be archived after share (D-14) |
| `complete` | `answered` | `answered`, or already `completed` → 200 with original timestamp (D-15) |
| `language change` | variant switch or profile-only | variant must exist → else `409 LANGUAGE_UNAVAILABLE` (D-16) |
| `preview-token` | not listed | `ready`, `partial_failure`, or `shared` (D-06) |
| `share-link` | `shared` or `archived` | unchanged; response extended (D-05) |
| `GET /w/:token` audience | snapshot | delivery-derived after share (D-14) |

---

## 10. Contract freeze

Before Phase 5 writes feature code:

| Artifact | Freeze rule |
|---|---|
| `packages/shared` Zod schemas | Single source of runtime truth; generated types; no module hand-rolls a request shape |
| Doc 05 v0.2.0 | Human-readable contract; every amendment in §9 applied |
| Fixture set | One JSON fixture per endpoint shape, used by API tests and the typed client |
| Error codes | Shared enum; adding one requires an amendment entry |
| Index set | Captured in the initial migration; CI compares `getIndexes()` to the expected set |
| Delta register | No open amendment without an owner and a target story |

Any post-freeze change follows the decision register's amendment format (A-YYYYMMDD-##), bumps doc 05's patch version, and updates the fixture in the same PR. A contract change without a fixture change is incomplete.

**Freeze exception:** P4-1…P4-4 in [01 §12](./01-system-architecture.md) are product/design decisions, not contract ambiguities. Their defaults are implemented; flipping one changes configuration and copy, not the shape of the API, except P4-1's effect on `availableLanguages` (already modeled as data) and P4-2's effect on archived access (already modeled as "delivery exists").

---

**Previous:** [02 — Runtime & Pipeline](./02-runtime-and-pipeline.md) · **Next:** [04 — Security & Privacy](./04-security-and-privacy.md)
