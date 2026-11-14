# 02 — Runtime & Pipeline

**Phase 4 · Document 2 of 7** · Version 0.1 · Date 2026-11-13
**Owner:** Founder · **Status:** Implementation-ready; supersedes TDD §7.1 job granularity (D-12)
**Builds on:** [01 — System Architecture](./01-system-architecture.md) · [TDD §7](../docs/04-tdd.md) · [Database & API Spec §4–8](../docs/05-database-api-spec.md)

---

## 0. What this document fixes

Doc 05 defines *what* each endpoint does. This document defines *in what order*, *with what atomicity*, and *what happens when a step fails*. It is the sequence-level contract Phase 5 implements and tests.

Three rules govern every sequence here:

1. **The HTTP path never waits on an AI provider.** Uploads enqueue transcription; Generate enqueues generation. Nothing else in the request path calls Groq, Azure, DeepL, or Resend synchronously.
2. **Every mutation is a guarded state transition**, not a read-then-write. Guards live in the `WHERE` clause of an atomic update.
3. **Every job is resumable and revision-scoped.** A stale job can never overwrite a newer edit.

Where a sequence depends on a contract delta, the delta ID from [03 — Data & API Contracts](./03-data-and-api-contracts.md) is cited inline.

---

## 1. Process lifecycle

### 1.1 Boot sequence

The same image boots as `api`, `worker`, or `both` (01 §3).

```
1. Load env → Zod parse → fail fast with a readable field list
2. Connect Mongo (serverSelectionTimeoutMS 5 s) → ping
3. Connect Redis (lazyConnect; retry capped at 2 s exponential, 30 s max)
4. If PROCESS_ROLE includes api:
     - mount routers, session middleware, rate limiters
     - listen on :3000; /healthz returns 503 until Mongo and Redis both answer within 2 s
5. If PROCESS_ROLE includes worker:
     - instantiate BullMQ workers (pipeline, email, maintenance)
     - register cron jobs (reconcile, cleanup, backup trigger)
     - acquire a Redis lock per cron job so two processes never double-run
6. Emit one boot log line: role, version, commit, node version
```

Index creation never happens at boot in production. `autoIndex=false`; versioned migration scripts run before the new image receives traffic (03 §10).

### 1.2 Shutdown

`SIGTERM` → stop accepting connections → `/healthz` returns 503 → drain in-flight HTTP ≤20 s → `worker.close()` (waits for active jobs, ≤25 s) → close Mongo/Redis → exit. Hard exit at 30 s. BullMQ stalled-job recovery handles anything cut off.

### 1.3 Concurrency and limits

| Queue | Concurrency | Job timeout | Retries |
|---|---|---|---|
| `pipeline` (transcribe) | 2 | 90 s | 2 (1 s / 5 s) |
| `pipeline` (variant generate) | 3 | 150 s per language | 1 outer retry; 3 stage-local attempts |
| `email` | 2 | 30 s | 3 (1 s / 5 s / 20 s) |
| `maintenance` | 1 | 120 s | 1 |

Process-wide provider limiters (Redis token buckets): Groq 4 concurrent, Azure TTS 4 concurrent, DeepL 2, Resend 2. Concurrency 3 on the pipeline queue is the pilot default and the first knob to lower when a free tier pushes back.

### 1.4 Identity and time

ObjectIds for entities; `req_`-prefixed request IDs; job IDs deterministic (below). All timestamps stored UTC as BSON dates, serialized ISO-8601, displayed in `org.timezone`. The worker's 24-hour "understood" window is computed from `instruction.sharedAt`, never from the client clock.

---

## 2. Supervisor sequences

### 2.1 Sign in

```
POST /api/v1/auth/magic-link { email }
  → rate limit (5/h/email, 20/h/IP)
  → always 202 { sent: true }            # no enumeration
  → if user exists: insert magic_links { tokenHash, expiresAt: now+15m }
  → email job (template magic_link)

GET /api/v1/auth/verify?token=…
  → atomic: findOneAndUpdate({ tokenHash, usedAt: null, expiresAt: > now }, { $set: { usedAt: now } })
  → miss → 302 /signin?error=link_unavailable
  → hit  → find or create user (+ org on first sign-in)
         → create Redis session (30-day sliding)
         → Set-Cookie (HttpOnly; Secure; SameSite=Lax)
         → 302 /home
```

The atomic `findOneAndUpdate` is what makes single-use real under a double-click. A second verify with the same token loses the race and lands on the friendly error page, not an error JSON.

### 2.2 App boot and query caching

`GET /me` returns user + org + language policy in one call. TanStack Query hydrates the shell. Route-level queries: board list, instruction detail, crew list. No query runs on a hidden tab except the one already mounted; `refetchIntervalInBackground` is false everywhere.

### 2.3 Draft autosave

```
field change → local reducer → debounce 800 ms → PATCH /instructions/:id {changed fields only}
             → 409 CONFLICT_STATE → stop autosave, reload draft, show "This draft changed elsewhere"
```

Last-write-wins is acceptable: one owner, one tab is the expected case, and the guard prevents writes after Generate. The client keeps the draft in memory and rehydrates from `GET /instructions/:id` on reload; no offline draft editing in v0.1.

### 2.4 Voice upload and transcription (pre-pipeline)

```
MediaRecorder (audio/webm;codecs=opus → audio/mp4 fallback)
  → local playback → POST /instructions/:id/voice (multipart, ≤15 MB)
  → server: sniff MIME → ffprobe duration ≤185 s
  → store R2: orgs/{orgId}/instructions/{instructionId}/source-{uuid}.{ext}
  → write content {kind:'voice', audioKey, audioMime, durationS, transcriptStatus:'pending'}
  → enqueue transcribe job → 201 { durationS, transcriptStatus:'pending' }
  → composer polls GET /instructions/:id every 1.5 s (max 60 s fast, then 5 s)
  → job writes content.transcript, detectedSourceLanguage, transcriptStatus:'ready'
  → supervisor edits/confirms → PATCH { content: { transcript, transcriptStatus:'confirmed' } }
```

Transcription failure is a first-class state, not an error dialog: `transcriptStatus:'failed'` shows the manual-transcript textarea and a re-record button. Manual text sets `content.kind='text'` only after the supervisor explicitly chooses it; otherwise the voice file stays attached and Generate stays blocked (`400 TRANSCRIPT_UNCONFIRMED`). There is no independent retry endpoint (doc 05 §6.5); a re-record or manual transcript is the retry.

The 90-second transcription job timeout is generous for a 3-minute clip on free-tier Whisper. A timeout writes `transcriptStatus:'failed'` with a readable reason; the job does not retry indefinitely.

### 2.5 Photo upload

`POST /instructions/:id/photo` → `file-type` sniff → `sharp` re-encode JPEG ≤1600 px, EXIF/GPS stripped → R2 → `content.kind='photo'`, `photoKey`. Caption required; Generate rejects a photo without text (C2). No OCR in v0.1.

### 2.6 Generate

Generate is a state transition plus enqueue. Target p95 < 300 ms regardless of audience size.

```
POST /instructions/:id/generate { crewId, audienceWorkerIds? }
 1. Load instruction with orgId guard → must be draft
 2. Validate content completeness:
      text | (photo + caption) | (voice + transcriptStatus='confirmed')
      title non-empty (≤120)
 3. Resolve audience:
      explicit ids → every id must be active, in crewId, in org
      omitted     → all active workers in the crew
      empty       → 400 VALIDATION_FAILED
 4. Languages = PIPELINE_ALL_LANGUAGES ? six : distinct audience languages   (P4-1, D-03)
 5. Transaction:
      instructions.findOneAndUpdate({ _id, orgId, status:'draft' },
        { $set: { crewId, audienceWorkerIds, status:'processing',
                  generation: 1, 'pipeline.startedAt': now, 'pipeline.lastError': null } })
      insert variants (instructionId, language, status:'pending', revision:1,
                       stages:{translate:'pending',question:'pending',audio:'pending'})
 6. Enqueue one variant.generate job per language
 7. 202 { status:'processing' }
```

The `status:'draft'` guard makes double-Generate harmless: the second call gets `409 CONFLICT_STATE`.

### 2.7 Processing screen

`GET /instructions/:id/status` every 2 s while visible. It returns the coarse status, per-stage/per-language states, and the transcript state for voice drafts. The screen maps stages to copy (S-12): translate n/m, check n/m, audio n/m. Polling stops on `ready`, `partial_failure`, unmount, or hidden tab. After 60 s the interval backs off to 5 s — long enough not to hammer a free-tier provider, short enough to feel alive.

Terminal `partial_failure` opens the per-language failure list with two actions: retry that language (`POST /variants/:id/regenerate`) or accept text-only and continue to Share.

### 2.8 Preview, edit, regenerate

```
POST /instructions/:id/preview-token        → { token, url } (15 min, stateless)   (D-06)
Open /i/preview/:token                       → GET /w/preview/:token
PATCH /variants/:id { text?, title?, question? }
  → 409 after share; allowed only ready | partial_failure
  → transaction: instruction.generation += 1; variant.revision += 1;
                 instruction.status = 'processing'
  → text/title change: stages.question/audio = pending, question=null, audioKey=null
  → question-only change: question.source='manual', question stage stays done, audio untouched
  → enqueue variant.generate; Share disabled until status is ready again
POST /variants/:id/regenerate
  → same generation bump; all three stages reset; enqueue
```

The preview screen locks the edited variant card with a progress indicator and polls status every 2 s until the instruction is ready or partially failed again. Other languages keep their assets untouched. This is C5/B19 made mechanical: the variant's new text can never be shared with the old audio because Share is blocked while `processing`.

### 2.9 Share

```
POST /instructions/:id/share { acceptTextOnly? }
 1. Guard: status='ready' OR (status='partial_failure' AND acceptTextOnly=true)
 2. Load audienceWorkerIds ∩ active workers → archivedDropped = difference
    (no delivery is created for a dropped worker; their row never appears on the board)
 3. If acceptTextOnly: set failed-language variants audioStatus='skipped', status='text_only'
 4. Generate raw share token (32 bytes) → hash (HMAC) + encrypt (AES-GCM)
 5. Transaction:
      instructions.findOneAndUpdate({ _id, orgId, status: {$in:['ready','partial_failure']} },
        { $set: { status:'shared', shareTokenHash, shareTokenEnc,
                  shareTokenIssuedAt, sharedAt, sharedBy } })
      bulk insert deliveries for every active audience worker
        { status:'pending', variantId: variant(worker.language), language, deliveryTokens:[] }
 6. Build URL + whatsappMessage { en, ar }
 7. 201 { url, whatsappMessage, deliveriesCreated, archivedDropped }
```

**Why a transaction.** Without one, a mid-loop failure leaves a shared instruction with a partial audience — the supervisor sees "24 targeted" when 9 workers exist. Atlas M0 is a replica set and supports it; dev uses `mongodb-memory-server` in replica-set mode. The unique index `{instructionId, workerId}` makes delivery inserts idempotent if the transaction is retried.

**Double share.** The status guard is the concurrency control: one request wins, the other gets `409 SHARE_CONFLICT`. The client recovers by calling `GET /instructions/:id/share-link` and rendering the already-shared drawer. No share is ever created twice.

**Token issuance before commit.** If the process dies after token generation but before commit, the token simply never exists. If it dies after commit but before response, the supervisor retries, gets `SHARE_CONFLICT`, and recovers via share-link. There is no state in which a shared instruction lacks a usable link.

### 2.10 Home and board

- `GET /board/overview` (D-04) returns org-wide KPIs: workers, active crews, live instructions, needs-help count, not-opened count, understood rate, and the exception list (oldest unopened and unresolved-help rows, capped at 5 each). One call powers S-03.
- `GET /instructions?status=shared&…` powers the board; `GET /instructions/:id/deliveries?filter=…` powers rows and counts.
- Poll 15 s only while the tab is visible; refetch on focus and immediately after share/archive. Exports are fetched on demand, never polled.

### 2.11 Export

`GET /exports/instructions/:id.csv?includeHelpReasons=&includeTimes=` (D-05) streams rows from stored delivery snapshots. The BOM is written first, then rows stream; formula-injection escaping is applied per cell; timestamps are ISO-8601 UTC plus `org_timezone`. The route is rate-limited to 5/h/org. The filename contract is doc 05 §6.9.

The S-15 preview table is rendered from the delivery list already on the client; the downloaded file is always the server export, so the preview can never disagree with the file about a column that exists in both.

---

## 3. Pipeline

### 3.1 Job graph

```
generate
  └─ variant.generate × languages        (pipeline queue, concurrency 3)
        ├─ stage translate   → persist text/title
        ├─ stage question    → persist question (AI or manual_required)
        ├─ stage audio       → persist audioKey via TTS cache
        └─ enqueue finalize

variant edit / regenerate
  └─ variant.generate × 1                 (same shape, new revision)

finalize (instructionId, generation)
  → all variants ready            → instruction.status = 'ready'
  → any variant failed, none running/pending → 'partial_failure'
  → otherwise                     → exit (last completion re-enqueues)

transcribe (voice upload) → persists transcript on the instruction
email     (magic link, batched help)
maintenance (reconcile, asset cleanup, import expiry)
```

**Job granularity change (D-12).** TDD §7.1 describes one job per stage. This pack implements one resumable job per language whose stages run sequentially, with the stage cursor persisted in the variant document. Reasons: a worker crash mid-pipeline resumes at the next unfinished stage instead of re-paying for finished work; six languages cost six jobs, not eighteen; and the 3-minute budget maps to one job. Per-stage retry counts and backoff are unchanged (3 attempts, 1 s/5 s/20 s). The status endpoint reads the same `stages` object either way, so no client contract changes.

Question and audio could run in parallel after translate; they do not, because Azure and Groq are on separate rate budgets but the total is short (~8 s per language), and sequential stages make the failure story and the persisted cursor trivial. This is a deliberate simplicity trade for a solo operator.

### 3.2 Revisions and stale-job protection

Two integers make concurrency safe:

| Field | Lives on | Bumped when |
|---|---|---|
| `generation` | instruction | Generate; every variant edit or regenerate |
| `revision` | variant | That variant is edited or regenerated |

Every job payload carries `{ instructionId, orgId, language, generation, revision }`. Job ID: `pipeline:{instructionId}:g{generation}:{language}:v{revision}`. Every write is guarded by `{ _id: variantId, revision }`; a job whose revision no longer matches exits silently without writing.

Without this, this race is real: supervisor edits Malayalam text while the first-generation Malayalam audio is still synthesizing; the slow job lands last and attaches audio for the old text. The revision guard makes the stale write impossible. Finalize recomputes from the database rather than trusting job order, so an early finalize that sees a pending sibling simply exits.

### 3.3 Stage contracts

| Stage | Input | Timeout | Validation before persist | Writes |
|---|---|---|---|---|
| `transcribe` | R2 object | 90 s | non-empty, ≤2,000 chars | instruction transcript, detected language, `ai_usage` |
| `translate` | source text + language | 20 s | non-empty; target-script heuristic; length ratio 0.5–2.5×; not identical to source (warn) | variant text/title, stage done, `ai_usage` |
| `question` | translated text | 20 s | JSON shape; exactly 3 unique options; 1 index; ≤140/≤60 chars | variant question, stage done, `ai_usage` |
| `audio` | translated text + voice map | 30 s | non-empty MP3, >1 KB; duration estimate; ≤2,000 chars | audio asset, variant audioKey/duration, stage done, `ai_usage` |

Provider selection is the order in TDD §7.2. A 429 respects `Retry-After` and does not consume a stage attempt if the wait exceeds the stage budget — the stage fails fast, the variant is marked failed, and the supervisor can retry later. Every attempt writes an `ai_usage` row with provider, model, units, latency, and estimated cost, including failed attempts where the provider billed.

Translation post-validation failure gets one retry with the failure reason appended to the prompt. A second failure marks the variant failed with a specific stage error. Question validation failure does not fail the language: it sets `questionStatus='manual_required'` and the preview screen asks the supervisor to write the question — a language is never held hostage to a bad question (TDD §7.4).

### 3.4 Per-language isolation and finalize

A failure in one language never stops its siblings. Each variant documents its own stage states and `lastError`. Finalize runs when a variant reaches a terminal state and recomputes the instruction:

```js
const variants = await variants.find({ instructionId, generation });
if (variants.every(v => v.status === 'ready')) return setStatus('ready');
if (variants.some(v => ['pending','processing'].includes(v.status))) return; // last one will re-enqueue
return setStatus('partial_failure');
```

`partial_failure` still lets the supervisor open Preview and share the ready languages after explicitly accepting text-only for the failed ones. The share response's `meta.warnings` names each affected language and its worker count (PRD PIPE-7, C10).

### 3.5 Text-only acceptance

`acceptTextOnly` applies only to languages that actually failed (C10). Ready languages keep audio. On acceptance the failed variant becomes `text_only` with `audioStatus='skipped'`; its text and question remain delivered. If new text arrives later via edit, the variant resets and regenerates like any other. Text-only is a delivery decision, not a variant deletion.

### 3.6 TTS cache

```
key = sha256(orgId + '\0' + normalizedText + '\0' + voiceId + '\0' + rate + '\0' + format + '\0' + glossaryVersion)
1. audio_assets.findOne({ orgId, cacheKey })
2. hit  → HEAD R2 object → exists: touch lastUsedAt, reuse
3. miss → Redis lock tts:{key} (60 s, NX)
        → synthesize once → R2 orgs/{orgId}/audio/{key}.mp3
        → upsert audio_assets (duplicate key → re-read, delete the redundant object)
        → release lock
```

Text normalization is Unicode NFC plus collapsed whitespace; it is part of the hash contract, not an optional step. Cache hits never call Azure and never write `ai_usage` TTS chars. The lock prevents two languages-in-flight from double-paying for identical text, which is common when a title is reused.

**Path conflict resolved (D-13).** TDD §7.5 stores audio at `orgs/{orgId}/instructions/{instructionId}/{lang}-{hash}.mp3`; doc 05 stores `orgs/{orgId}/audio/{hash}.mp3`. Doc 05 wins: cache assets are org-scoped and reusable across instructions (D9), which the instruction-scoped path contradicts. The cleanup cron deletes assets with `lastUsedAt` older than 180 days **and** no variant references.

### 3.7 Budget and zombie protection

Each variant job enforces a 150 s wall clock and checks the instruction's generation at every stage boundary. A maintenance job every 5 minutes finds instructions stuck in `processing` with no variant transition for 10 minutes, marks unfinished stages failed with `PIPELINE_TIMEOUT`, and runs the same finalize logic. BullMQ's stalled-job check covers a dead worker; the reconciliation job covers lost Redis data, which the free tier can produce without warning.

**Redis-loss reconciliation.** Losing the queue loses running jobs but not variant stage documents. On boot and every 5 minutes, the worker checks `processing` instructions and compares the instruction's `pipeline.startedAt` and variant `updatedAt` against now. Any variant with a non-terminal stage older than 10 minutes is marked failed with a retryable error; the instruction becomes `partial_failure`, and the supervisor sees exactly which languages need a retry. No instruction is ever permanently stuck behind a lost queue.

---

## 4. Worker sequences

### 4.1 Meta (`GET /w/:token`)

Returns org name, instruction title/type, `audience[]` with `{ id, displayName, firstName, lastInitial, language }`, and — new — `titleVariants` and `availableLanguages` (D-02). `displayName` applies the collision rule (full last name only on collision, then numeric suffix, C7). No delivery state, no question, no media.

This call is rate-limited 60/min per token+IP. It is cached by the service worker shell only for the HTML/JS, never for API JSON containing names (TDD §9.3).

### 4.2 Identify

```
POST /w/:token/identify { workerId, language? }
 1. Resolve share token → instruction must be status='shared' (archived → 410)
 2. Worker must be in audienceWorkerIds AND have a delivery for this instruction
    (a worker archived after share still has one → allowed; Q7/P4-2, D-14)
 3. language? → must be in availableLanguages, else 409 LANGUAGE_UNAVAILABLE (P4-1)
              → update worker.language (explicit choice; W-01/W-11 promise this)
 4. Create delivery token (32 bytes), append hash, cap 5 oldest-evicted
 5. Set delivery.language/variantId if language override; history entry on change
 6. Set openedAt if null; status pending → opened
 7. Return deliveryToken + full content + question + signed media URLs (D-01, D-07)
```

Identify is not idempotent by key; it is idempotent by outcome. Re-identifying issues another device token and returns the current state. The cap of five means a stolen old phone stops working as soon as the worker signs in on a sixth.

### 4.3 Answer

```
POST /w/answer { optionIndex } + Bearer + Idempotency-Key
 1. Idempotency wrapper (Redis) → replay returns the stored body
 2. Atomic conditional update:
      { _id: deliveryId, status: {$in:['opened','answered']},
        $expr: { $lt: [ { $size: '$attempts' }, 2 ] } }
      pipeline:
        attempts += {optionIndex, correct, at}
        firstAttemptCorrect = $size(attempts)===0 ? correct : keep
        answeredAt = $ifNull(answeredAt, now)
        status = 'answered'
        if attempts count === 2 AND !correct AND !help.requested:
           help = {requested:true, reason:'dont_understand', requestedAt: now}
 3. No match:
      status='completed'      → 409 DELIVERY_COMPLETED
      attempts length ≥ 2     → 409 ATTEMPTS_EXHAUSTED
      otherwise               → 409 CONFLICT_STATE
 4. Enqueue help email if the update auto-requested help
 5. Return { correct, correctIndex, firstAttempt, attemptsCount }
```

The correct index is returned only after an attempt is recorded. The UI can then reveal the answer (W-03/W-04). The conditional update is the entire attempt cap; no read-then-write exists to race. Two rapid taps with different idempotency keys become attempt 1 and attempt 2 — which is the honest behavior, because the worker did submit twice; the client disables the control between submissions to prevent accidental double taps.

### 4.4 Help

```
POST /w/help { reason } + Bearer + Idempotency-Key
  → upsert help: requested=true, reason, requestedAt = $ifNull(requestedAt, now)
  → resolvedAt reset to null only if a new reason is submitted after resolution (supervisor sees it again)
  → enqueue help-email debounce job (10 min)
  → 200 { requestedAt }
```

Allowed from `opened`, `answered`, `completed`. Idempotent by key; repeated help calls with a new key are harmless because email is batched.

### 4.5 Complete

```
POST /w/complete {} + Bearer + Idempotency-Key
 1. Idempotency replay → return stored { completedAt }
 2. Conditional update { _id, status:'answered' } → { status:'completed', completedAt: now }
 3. Already completed → 200 { completedAt } (idempotent, not an error; D-15)
 4. No attempts → 409 CONFLICT_STATE
```

Completion is gated on an answer, not on correctness. A wrong-but-retried worker can complete; an unresolved help request can complete; the board shows both facts. This keeps "understood" a metric, not a gate (D8).

### 4.6 Language change

```
POST /w/language { language } + Bearer
  → update worker.language always
  → if delivery status ∈ opened|answered:
        find variant(instructionId, language) in availableLanguages
        miss → 409 LANGUAGE_UNAVAILABLE (only if P4-1 is rejected)
        delivery.variantId/language updated; history += {from,to,at}
        return content + question + fresh signed media in the new language
  → if completed:
        snapshot immutable; return current content + { deliveryLanguage, profileLanguage }
```

The response always includes both the profile language and the delivery language so the client can explain the difference after completion. A completed worker who changes language sees their profile change, not history.

### 4.7 Reload and completed recap

`GET /w/state` returns the full current state: content, title, question (with prior correctness after an attempt), signed media URLs, help state, attempts count, completion. Reload on a weak connection must not strand a worker at a blank instruction card, and "Completed" must be able to show the instruction again (W-09). The delivery token lives in `localStorage` under `u_delivery_{instructionId}`; a token that fails with 401 clears and returns to the picker. Tokens for other instructions are ignored, never tried.

### 4.8 Preview

`GET /w/preview/:token` returns the meta shape plus the first audience worker's content, `preview:true`. Every write route rejects the preview token with `403 PREVIEW_MODE`; no delivery is created; no `openedAt` is written; the preview page stores nothing in `localStorage` and shows the blue banner on every screen. The preview token is stateless and expires in 15 minutes; "Open worker view" in the share drawer mints a fresh one.

### 4.9 Signed media

A bare `<audio src="/api/v1/w/audio/:variantId">` cannot send `Authorization`, so audio and photo payloads carry short-lived signed R2 URLs (15 minutes), and `GET /w/audio/:variantId` returns JSON `{ url, expiresAt }` for refresh (D-01). The client:

1. Loads `preload="metadata"` from the signed URL.
2. On `error` or before replay after expiry, refreshes once and resumes at `currentTime`.
3. Never autoplays; the 68 px play button is the only start.
4. Caches the audio in the service worker after a successful play for replay; cache keys include variant id + revision.

Photos use the same signing path. R2 objects stay private; there is no public bucket.

### 4.10 Offline outbox

```
submit answer | help | complete while offline
  → append {idempotencyKey, method, path, body, createdAt} to IndexedDB queue
  → UI: pending state, "will send when connected" (W-12); Done disabled until the answer syncs
  → triggers: online, visibilitychange, app start, SW background sync if available
  → replay strictly in order per delivery; drop an item after a 2xx or a terminal 4xx
  → fetch GET /w/state after the queue drains; server state is the only truth
```

Answers are never evaluated locally; the client cannot know the correct index, so an offline answer stays pending until the server confirms. If the server says `ATTEMPTS_EXHAUSTED` (a retry was already used on another device), the outbox clears and the UI renders the server state. If `DELIVERY_COMPLETED`, same. The queue never overrides a server terminal state.

Completion is queued only after its answer has synced. If the worker closes the app, the service worker replays on next launch; the outbox is capped at 20 items and discarded if older than 7 days.

---

## 5. Consistency rules

| Operation | Mechanism | Failure result |
|---|---|---|
| Magic-link verify | atomic `findOneAndUpdate` on unused token | friendly error page; no session |
| Share | Mongo transaction + status guard | nothing written; 409 on double share |
| Answer | single pipeline update with attempt-length guard | 409 with specific code; no partial attempt |
| Complete | guarded update on `answered` | 200 if already completed; 409 otherwise |
| Help | upsert with `$ifNull` on `requestedAt` | idempotent |
| Language change | guarded on delivery status | snapshot immutable after completion |
| Variant stage write | revision-guarded update | stale job exits; newer job wins |
| Finalize | recompute from DB | safe under any job order |
| Idempotency | Redis `idem:{deliveryId}:{key}` → `{requestHash,status,body}`, 24 h | replay returns stored body; mismatch → 409 |

**Redis unavailability.** Worker mutations require idempotency. If Redis is unreachable, they return `503 SERVICE_UNAVAILABLE` and the client keeps the item in the outbox; correctness beats availability for attempts. Supervisor reads continue (sessions already in memory? No — sessions live in Redis, so a Redis outage signs supervisors out). Rate limits fail open when Redis is down; this is an explicit availability decision for a single-tenant pilot, documented in 04.

**Mongo unavailability.** `/healthz` 503; API returns 503 on data routes; jobs retry. R2 unavailability blocks uploads and new signing but not already-signed playback.

---

## 6. Notifications

| Message | Trigger | Delivery | Content |
|---|---|---|---|
| Magic link | `POST /auth/magic-link` | immediate | sign-in link, 15-minute expiry |
| Help alert | First help request per instruction (or first after a prior batch) | delayed 10 min, batched | board link, worker names/languages still needing help |
| Org deletion | `POST /org/delete` | immediate | confirmation |

**Help batching.** On a help request, enqueue `email:help:{instructionId}` with a 10-minute delay if no such job is waiting. At send time the job queries unresolved help deliveries, groups by worker, and sends one email to the owner. This respects the 10-minute supervisor promise (S-14), stays under Resend's free daily cap, and avoids one email per worker during a confused-crew spike. If email fails after three attempts, log it; the board remains the source of truth and the alert is not retried forever.

No auto-send to WhatsApp exists in v0.1 (D20): reminders and share messages are copy-to-clipboard only. The API returns message text; the client copies it; the supervisor sends it.

---

## 7. Failure matrix

| Failure | User sees | System behavior | Recovery |
|---|---|---|---|
| STT provider down | "We couldn't transcribe" + manual/re-record | transcriptStatus failed; Generate blocked | manual transcript or re-record |
| Translation provider 429/timeout | language marked failed in progress | retries with backoff, `partial_failure` | retry language or text-only |
| Translation output invalid | same | one prompt-retry, then failed with stage error | retry language |
| Question invalid | preview asks supervisor to write it | `manual_required`, language still deliverable | write question in preview |
| TTS failure | language shows audio failed | variant failed, text/question intact | retry language or text-only |
| R2 write failure | upload/audio error | stage fails; retries | retry |
| Worker process crash mid-job | processing continues | BullMQ stall → retry; stage cursor skips done work | automatic |
| Redis lost | supervisors signed out; workers see 503 on writes | sessions/queue/idempotency gone | sign in again; reconcile marks stuck instructions; outbox retries |
| Mongo unavailable | 503 | health red; jobs retry | provider-managed failover |
| VM reboot | brief 502 | Caddy + compose restart; jobs resume | uptime check |
| Share response lost after commit | second Share shows conflict | share-link recovers URL | client fetches share-link |
| Audio URL expires mid-play | brief stall | client refreshes signed URL and resumes | automatic |
| Worker goes offline after submit | "will send when connected" | outbox replays; server authoritative | automatic |
| Archived worker opens old link | sees closed screen for new instructions | existing delivery for this instruction still works (Q7) | — |
| Preview token expired | "Preview expired" + button | 403 on fetch | mint a new preview |

---

## 8. Performance budgets

| Path | Budget | Enforcement |
|---|---|---|
| `GET /w/:token` meta | p95 ≤ 250 ms | indexed token hash, projection, no variants join beyond titles |
| `POST /w/identify` | p95 ≤ 300 ms | one update + one read |
| `POST /w/answer` | p95 ≤ 250 ms | single conditional update |
| `GET /board/overview` | p95 ≤ 300 ms | one aggregation per org |
| Board list | p95 ≤ 300 ms | `$lookup` aggregation, cursor pagination |
| Instruction status poll | p95 ≤ 100 ms | single instruction + variant read |
| Share, 1,000 deliveries | p95 ≤ 1.5 s | transaction + bulk insert |
| Export, 1,000 rows | p95 ≤ 2 s, streamed | snapshot read, no joins beyond worker/variant maps |
| Pipeline, 4 languages | p95 ≤ 45 s | concurrency 3, per-language ~10 s |
| Pipeline, 6 languages | p95 ≤ 60 s | two waves at concurrency 3 |
| Worker FCP, mid Android 3G | ≤ 2.0 s | ≤180 KB initial JS, self-hosted fonts |
| Audio start after tap | p50 ≤ 4 s | 48 kbps MP3, metadata preload, signed URL prefetched |

Alerts: pipeline p95 > 90 s for 10 minutes; API 5xx > 1% for 5 minutes; queue depth > 50; Redis memory > 24 MB; TTS usage > 80% of grant.

---

## 9. Phase 5 test obligations

Every sequence in this document maps to at least one integration test. The non-negotiables:

1. Double Generate → one processing instruction, one variant set.
2. Share twice concurrently → one shared instruction, one delivery set, one 409.
3. Share with an archived worker → `archivedDropped` counted, no delivery row.
4. Variant edit while audio job in flight → old job exits, new text and new audio are what share delivers.
5. Finalize out of order → status is still correct.
6. Two answers with distinct keys in the same millisecond → attempts = 2, second wrong auto-requests help.
7. Third answer → `ATTEMPTS_EXHAUSTED`, attempts unchanged.
8. Complete before answer → `CONFLICT_STATE`; complete twice → 200 both times.
9. Language change before completion switches variant and records history; after completion changes only the profile.
10. Preview token on every write route → `403 PREVIEW_MODE`, zero deliveries, zero opener timestamps.
11. Redis flush mid-processing → reconcile moves the instruction out of `processing`; retry produces a ready instruction.
12. Offline outbox replay after reconnect → exactly one attempt per answer, server state rendered.
13. TTS cache hit produces no Azure call and no TTS `ai_usage` row.
14. Help requests from three workers within ten minutes → one email naming three workers.
15. Signed audio URL refresh after expiry → playback resumes, no auth error surfaced.

These extend doc 05 §11; they do not replace it.

---

## 10. Deliberate deferrals

- No SSE/websockets (D4). Polling intervals are part of the contract.
- No streaming TTS, no partial audio, no per-sentence synthesis.
- No cross-instruction audio streaming; cache reuse is whole-file.
- No background sync guarantee on iOS; the outbox also replays on app focus.
- No distributed locks beyond the TTS key, cron leader lock, and idempotency wrapper. At one process, more locking would be theater.
- No retry endpoint for transcription (doc 05 §6.5); re-record or type.

---

**Previous:** [01 — System Architecture](./01-system-architecture.md) · **Next:** [03 — Data & API Contracts](./03-data-and-api-contracts.md)
