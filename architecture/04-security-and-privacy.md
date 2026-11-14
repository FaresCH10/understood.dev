# 04 — Security & Privacy

**Phase 4 · Document 4 of 7** · Version 0.1 · Date 2026-11-13
**Owner:** Founder · **Status:** Implementation-ready
**Builds on:** [01 — System Architecture](./01-system-architecture.md) · [03 — Data & API Contracts](./03-data-and-api-contracts.md) · [TDD §10](../docs/04-tdd.md) · [Database & API Spec §4, §11](../docs/05-database-api-spec.md)

---

## 0. Posture

Understood holds worker names, languages, and a record of who understood which instruction. It does not hold national IDs, salaries, passwords, or worker photos. The supervisor is one owner; workers have no accounts.

The security posture follows from that shape:

- **Minimize first.** The safest data is the data not collected. Phone is optional and never used to send anything in v0.1.
- **Tokens over accounts.** Workers get unguessable, narrowly scoped tokens; supervisors get magic links and an opaque session. No passwords exist to leak or reuse.
- **Tenant isolation is a code convention with tests**, not a database feature. Every query carries `orgId` from the session.
- **Every public surface is rate-limited and unguessable.** The crew link is shareable by design; the delivery token is not.
- **Availability yields before correctness.** When Redis is down, worker mutations fail closed rather than risk double-counting an attempt.

This is a pilot-grade posture for one operator and a handful of orgs. It is not a claim of enterprise certification.

---

## 1. Threat model

### 1.1 Assets

| Asset | Sensitivity | Where it lives |
|---|---|---|
| Worker names, languages, optional phones | Personal data (low–medium) | Mongo; audience payloads; help emails |
| Delivery records (opened, answered, completed, help) | Personal + audit | Mongo |
| Instruction content (site procedures, safety text) | Customer confidential | Mongo + R2 + AI providers |
| Supervisor email + session | Account access | Mongo, Redis, Resend |
| Share token, delivery token, preview token | Access material | URL/localStorage; hashes in Mongo |
| Provider API keys, encryption keys | Critical | Server env only |

### 1.2 Actors and trust boundaries

| Actor | Capability | Trust |
|---|---|---|
| Anonymous internet | Can reach `/i/*` with a guessed or leaked link | Untrusted |
| Worker with a valid crew link | Can read audience names, identify as any listed worker | Untrusted but authorized by link possession |
| Worker with a delivery token | Can mutate exactly one delivery | Scoped |
| Supervisor (owner) | Full org read/write via cookie | Authenticated |
| AI / email / storage providers | Receive the minimum needed for one task | Untrusted third parties |
| Infrastructure operator (founder) | Root on VM, env secrets, DB access | Trusted, logged |

The worker-picker model means **possession of the link is the access control for the roster**. That is a product decision (D1), not an oversight. Mitigations: no phones in the roster, no instruction content before identify, revocable link, rate limits, and a visible closed screen after archive.

### 1.3 Priority risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Leaked crew link exposes the roster | Medium | Medium | Revocable; names only; no content pre-identify; rate limit; archived closes |
| R2 | Cross-tenant read/write via IDOR | Low | Critical | `orgId` from session; per-route tenant tests; no client-supplied org |
| R3 | Stolen delivery token used on another delivery | Low | Low | Token bound to one delivery; 5-device cap; no supervisor scope |
| R4 | XSS steals supervisor session | Low | High | React escaping, CSP without `unsafe-inline` scripts, HttpOnly cookie, no `dangerouslySetInnerHTML` |
| R5 | Malicious upload (polyglot, SVG, EXIF GPS) | Medium | Medium | MIME sniff, `sharp` re-encode, EXIF strip, no SVG, size caps |
| R6 | CSV formula injection opens in Excel | Medium | Medium | Prefix `= + - @` cells; BOM; RFC 4180 |
| R7 | Prompt injection changes translation or question rules | Medium | Low–Medium | Data delimiters, schema validation, no tools, allowlisted languages, human preview gate |
| R8 | Share token brute force | Very low | High | 32 random bytes, hashed at rest, rate-limited, revocable |
| R9 | Session fixation / CSRF | Low | High | New session on verify; `SameSite=Lax`; Origin check on mutations |
| R10 | PII in logs or analytics | Medium | Medium | Log allowlist, Sentry scrubbing, no names/text in PostHog, no session replay |
| R11 | Provider breach exposes instruction content | Low | Medium | Minimum text sent; no worker identities to LLM/TTS; DPAs where available |
| R12 | Secret leak via repo or client bundle | Low | Critical | Server-only env, `.gitignore`, no secrets in Vite, rotation runbook |
| R13 | Backup exposure | Low | High | Encrypted backups in a separate R2 bucket, 30-day lifecycle |
| R14 | Abuse/DoS via magic link or upload endpoints | Medium | Medium | Redis rate limits, body caps, queue concurrency, provider limiters |
| R15 | Worker link preview crawler captures names | Low | Low | Worker shell is static HTML with no PII; names arrive only via authenticated JS API |

---

## 2. Authentication

### 2.1 Supervisor — magic link and session

| Property | Value |
|---|---|
| Token | 32 random bytes, base64url |
| Storage | `magic_links.tokenHash = HMAC-SHA256(TOKEN_PEPPER, token)` |
| TTL | 15 minutes, single use via atomic `findOneAndUpdate` |
| Delivery | Resend; always `202 { sent: true }` (no enumeration) |
| Session | 32 random bytes, opaque; Redis key `sess:{HMAC-SHA256(token)}` → `{userId, orgId, createdAt, lastSeenAt}` |
| Cookie | `__Host-u_session`; `HttpOnly; Secure; SameSite=Lax; Path=/`; no `Domain` |
| Lifetime | 30-day sliding TTL; refreshed at most once per minute |
| Logout | Deletes the Redis key and the `us:{userId}` set entry |
| Fixation | A new token and key are created on every verify; no pre-auth session is reused |
| CSRF | `SameSite=Lax` plus `Origin` must equal `APP_ORIGIN` on every mutating request |

Session tokens are never stored in plaintext at rest. The `us:{userId}` set exists so a future seat/deactivation feature can revoke all sessions without scanning Redis. In v0.1 the only trigger is org deletion.

**Email is the root of supervisor auth.** Resend domain verification (SPF/DKIM/DMARC) is a security dependency, not just deliverability: a spoofed sender could phish a magic link. The domain is configured before any external pilot, and the sign-in email names the org and the 15-minute expiry.

### 2.2 Worker — share token

| Property | Value |
|---|---|
| Raw | 32 random bytes, base64url |
| Lookup | `shareTokenHash = HMAC-SHA256(TOKEN_PEPPER, raw)`; unique sparse index |
| Re-display | `shareTokenEnc = AES-256-GCM(raw, TOKEN_ENC_KEY)`; needed for "Copy link" |
| Scope | One instruction; audience names and titles only, until a worker identifies |
| Validity | Instruction must be `shared`; `archived` or regenerated → `410` |
| Rotation | Regenerate replaces hash + ciphertext; old link dies instantly; delivery tokens survive (B14) |
| Exposure | URL path, WhatsApp, QR; `Referrer-Policy: no-referrer` on `/i/*`; no third-party scripts |

The raw token exists server-side only when issuing or re-displaying the link. It is never logged. Ciphertext is encrypted with a key separate from the pepper, so a database-only leak does not yield working links.

### 2.3 Worker — delivery token

| Property | Value |
|---|---|
| Raw | 32 random bytes; returned once at identify |
| Storage | Client: `localStorage['u_delivery_{instructionId}']`; server: HMAC hash in `deliveryTokens[]` |
| Cap | 5 tokens per delivery; oldest evicted on the sixth |
| Scope | Exactly one delivery, one instruction, one worker |
| Auth | `Authorization: Bearer …` on `/w/state`, `/w/answer`, `/w/complete`, `/w/help`, `/w/language`, `/w/audio`, `/w/photo` |
| Revocation | Dies with the delivery or when evicted; share-link regeneration does **not** revoke it |
| Last seen | `lastSeenAt` touched at most once per minute to avoid write amplification |

A delivery token cannot read the roster, another worker's state, supervisor routes, or another instruction. Every handler resolves `deliveryId` from the token and ignores any client-supplied id.

### 2.4 Preview token

Stateless `base64url(payload).HMAC-SHA256(TOKEN_SECRET, payload)` with `{instructionId, exp, kind:'preview'}`. Fifteen-minute TTL, read-only. Every write route rejects it with `403 PREVIEW_MODE`. No DB row, no delivery, no event, no localStorage identity. Expired/invalid → `410 LINK_UNAVAILABLE` with a "Preview expired" state.

---

## 3. Authorization and tenant isolation

### 3.1 The rule

`orgId` comes from the session and nowhere else. No endpoint accepts it as a body, query, or header field. Repositories take it as their first argument:

```ts
deliveries.findForInstruction(orgId, instructionId)
```

Mongoose models are module-private; cross-module access goes through services/read repositories (01 §5). This is enforced by ESLint `no-restricted-imports` and review.

### 3.2 Scoping matrix

| Surface | Credential | Scope | Explicitly denied |
|---|---|---|---|
| Supervisor routes | session cookie | own org | other orgs; worker routes |
| Worker meta/identify | share token | one instruction + audience | roster beyond audience; delivery state of others; supervisor data |
| Worker mutations | delivery token | one delivery | other deliveries; roster; supervisor data |
| Preview | preview token | one instruction, read-only | all writes; deliveries; events |
| Exports | session cookie | own org | other orgs; worker tokens |
| Health | none | status only | versions, internals, env |

### 3.3 Test obligation

Every route class has a cross-tenant probe in CI (doc 05 §11.1). The probe suite creates two orgs with identical-looking ids and asserts that org A's cookie returns `404` (not `403`, not data) for every one of org B's resources. Worker-token probes assert a token from instruction X cannot touch instruction Y. These tests are release-blocking, not aspirational.

---

## 4. Browser and transport security

### 4.1 Headers (Caddy)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer            # /i/*; strict-origin-when-cross-origin elsewhere
Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=()
```

`microphone=(self)` is allowed globally because the supervisor recorder lives on the same origin; worker pages never call it. The worker CSP can tighten to `microphone=()` if Caddy applies a path-specific header block for `/i/*`.

### 4.2 CSP

Supervisor (`/*`):

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://<r2-host>;
media-src https://<r2-host> blob:;
font-src 'self';
connect-src 'self' https://<posthog-host> https://<sentry-ingest>;
frame-ancestors 'none';
base-uri 'none';
form-action 'self';
object-src 'none';
upgrade-insecure-requests
```

Worker (`/i/*`):

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://<r2-host>;
media-src https://<r2-host> blob:;
font-src 'self';
connect-src 'self' https://<r2-host>;
worker-src 'self';
manifest-src 'self';
frame-ancestors 'none';
base-uri 'none';
form-action 'self';
object-src 'none';
upgrade-insecure-requests
```

Notes:

- No `unsafe-eval`, no inline `<script>`, no third-party scripts. Sentry and PostHog are npm dependencies bundled into the app, not snippets from a CDN.
- `style-src 'unsafe-inline'` is required by React inline styles and some UI primitives. It cannot execute code; style injection is not a script-execution vector on its own.
- Fonts are self-hosted; `fonts.googleapis.com` is not allowed anywhere.
- R2 hosts are the only external `media-src`/`img-src` origin. The bucket stays private; URLs are signed.
- `connect-src` on the worker includes R2 so the service worker can fetch and cache audio. No PostHog/Sentry on the worker in v0.1; error reporting is supervisor-side only, which keeps the worker bundle and policy smaller.

### 4.3 Cookies and CSRF

`SameSite=Lax` blocks cross-site POSTs. In addition, every mutating request validates `Origin` (or `Referer` fallback) against `APP_ORIGIN`; a missing or foreign origin is rejected with `403`. This is defense-in-depth against browsers that mis-handle `SameSite` and against future cookie changes.

### 4.4 XSS

- React escaping only. `dangerouslySetInnerHTML` is banned by lint.
- No user-controlled HTML anywhere: instruction text, titles, worker names, and questions render as text.
- CSV and JSON responses set `X-Content-Type-Options: nosniff`; exports use `Content-Disposition: attachment`.
- The worker shell is static HTML with a generic title. No server-side rendering of names or tokens into HTML, which also protects against link-preview crawlers.

### 4.5 CORS

Same origin only. Caddy routes `/api` and both SPAs on one host, so no CORS headers are needed for app traffic. R2 gets a narrow CORS policy: `GET, HEAD` from the app origin only, for service-worker audio caching.

---

## 5. Input, uploads, and content

### 5.1 Boundaries

| Input | Limit | Validation |
|---|---|---|
| JSON body | 256 KB | Zod strict; unknown fields rejected |
| Instruction text | 2,000 chars | length, non-empty at generate |
| Title | 120 chars | length |
| Question/options | 140/60 chars | exact 3 options, unique |
| Audio upload | 15 MB, ≤185 s | MIME sniff + `ffprobe`; allowed codecs only |
| Image upload | 8 MB pre-compression | `file-type` JPEG/PNG/WebP; re-encode to JPEG ≤1600 px |
| CSV import | 1,000 rows | streaming parse; per-row validation; aliases allowlisted |
| Export params | booleans | coerce and validate |

Rejected MIME types include SVG (script carrier), HTML, PDF, and any archive. The stored filename is never derived from user input; R2 keys use UUIDs.

### 5.2 Upload pipeline

1. `multer` memory/stream cap → reject oversize before buffering fully.
2. `file-type` magic-byte sniff → must match an allowlisted type, not the declared MIME alone.
3. Audio: `ffprobe` duration and codec check; reject >185 s or non-audio.
4. Image: `sharp` re-encode (strips EXIF, GPS, ICC quirks, and embedded payloads); JPEG, max 1600 px.
5. Store under an org-scoped key; never expose the bucket publicly.
6. Any failure deletes the temp object; no orphaned uploads.

### 5.3 Prompt injection

Instruction text is untrusted data that reaches an LLM. Defenses:

- System prompt wraps source in `<source>…</source>` and states that content is data, never instructions.
- Output is parsed as JSON and schema-validated: `{text}` for translation, `{question, options, correctIndex}` for checks. Anything else fails the stage.
- No tools, no function calling, no browsing, no code execution on model output.
- Language codes come from an allowlist, never from model output.
- The supervisor preview gate means a manipulated translation is seen before it reaches workers (D2).
- Model output is rendered as plain text and synthesized as plain text. The TTS adapter sends text through the SDK, never by concatenating SSML — this closes an SSML-injection path.

Residual risk: a sufficiently subtle bad translation is a content-quality issue, not a security breach. Preview and native review (Q3) are the controls.

### 5.4 CSV

Imports parse defensively (no formulas are evaluated). Exports prefix any cell beginning with `= + - @` with a single quote, quote per RFC 4180, prepend a UTF-8 BOM, and send `Content-Disposition: attachment`. Excel opening an export cannot execute a payload from a worker name or instruction title.

---

## 6. Secrets and keys

### 6.1 Inventory

| Secret | Purpose | Rotation impact |
|---|---|---|
| `MONGODB_URI` | Atlas connection | Restart |
| `REDIS_URL` | Sessions, queues, limits | Restart; sessions/queues lost if the instance changes |
| `TOKEN_PEPPER` | Magic-link and session hashes | All sessions and pending magic links invalidate |
| `TOKEN_ENC_KEY` (32 bytes) | Share-token ciphertext | Requires decrypt/re-encrypt migration of active links |
| `TOKEN_SECRET` | Preview-token HMAC | Outstanding previews invalidate (15 min, harmless) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Object storage | Restart; old signed URLs expire naturally |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | TTS/STT fallback | Restart |
| `GROQ_API_KEY` | STT/LLM | Restart |
| `DEEPL_API_KEY` (optional) | Translation fallback | Restart |
| `RESEND_API_KEY` | Email | Restart |
| `SENTRY_DSN` | Error reporting | Restart |
| `POSTHOG_KEY` | Product analytics (public by design) | Restart |
| `BACKUP_ENCRYPTION_KEY` | Backup archive encryption | Old backups require the old key |

Only the PostHog project key and Sentry DSN may appear in a client bundle. Everything else is server env. Vite exposes only `VITE_*` variables, and the build fails if a server secret name is found in client output during CI.

### 6.2 Storage and access

- Local: `.env` (gitignored), `.env.example` with placeholders.
- Production: server `.env` owned by root, mode 600; GitHub Actions secrets for deploy; never printed in logs.
- Sentry/PostHog keys scoped to the project; no personal keys.
- Provider keys are separate per environment (dev keys never used in production).

### 6.3 Rotation runbook (summary)

| Situation | Action |
|---|---|
| Key suspected leaked | Revoke at provider → issue new key → update env → restart → verify `/healthz` and one pipeline run → record incident |
| `TOKEN_PEPPER` leak | Rotate, invalidate all sessions, force re-sign-in; pending magic links die (acceptable); share/delivery hashes are HMAC'd with the same pepper — **active share links and delivery tokens must be re-issued**, so this is a last resort |
| `TOKEN_ENC_KEY` leak | Run the decrypt/re-encrypt migration over shared/archived instructions, then rotate; old ciphertext becomes useless |
| `TOKEN_SECRET` leak | Rotate; previews expire in 15 minutes anyway |
| R2 key leak | Rotate; existing signed URLs remain valid until expiry (≤15 min); consider regenerating share links if bucket listing was possible (it is not, by policy) |

The pepper is shared by magic links, sessions, share hashes, and delivery hashes. That is simple but makes pepper rotation disruptive. The alternative — four peppers — adds config surface for a solo operator without changing the threat model at pilot scale. This is recorded as a deliberate trade in ADR-16.

---

## 7. Personal data and privacy

### 7.1 Inventory

| Data | Why | Where | Retention |
|---|---|---|---|
| Worker name | Picker, board, audit record | Mongo | Life of org |
| Worker language | Content language, TTS, audit | Mongo | Life of org |
| Worker phone (optional) | Display only; not used to send | Mongo | Life of org |
| Delivery events and help | "Who understood?" record | Mongo | Life of org |
| Supervisor email | Sign-in | Mongo, Resend | Life of org |
| Request metadata (IP, UA) | Rate limiting, security | Redis/logs | 14 days (logs); counters expire |
| Analytics events | Product improvement | PostHog | 1 year, pseudonymous |

No worker account, password, national ID, photo, salary, or location is collected. No worker-facing analytics or session replay exists.

### 7.2 Data flow to providers

| Provider | Receives | Does not receive |
|---|---|---|
| Groq | Instruction source text/audio | Worker names, languages, org identity |
| Azure Speech | Instruction text, audio | Worker names |
| DeepL | Instruction text | Worker names |
| R2 | Instruction media, TTS audio | Worker roster (media keys are org/instruction scoped) |
| Resend | Supervisor email; help-alert content (worker first names + languages) | Rosters, phones, instruction bodies |
| Sentry | Error stacks, request IDs | Names, emails, tokens, instruction text |
| PostHog | Pseudonymous ids, event properties | Names, emails, text, replay |

Help-alert emails necessarily name the workers who need help. That is the product. The email goes only to the org owner and is not stored beyond `email_log` metadata (recipient + template + status, 90 days).

### 7.3 Logging and analytics rules

- Log fields are allowlisted: `requestId`, `orgId`, `instructionId`, `deliveryId`, `route`, `status`, `latency`, `errorCode`, provider name. Never names, emails, phones, token values, or text.
- Sentry `beforeSend` drops request bodies, cookies, headers, and query strings; `sendDefaultPii: false`.
- PostHog: `person_profiles: 'identified_only'`, IP capture disabled, autocapture disabled, session recording disabled. Events use the PRD §11 names with pseudonymous ids.
- Error messages returned to clients never include provider output, stack traces, or PII.

### 7.4 Rights and deletion

The org owner is the controller for worker data; Understood is the processor. The owner can:

- Export any instruction or the whole org (CSV / ZIP).
- Archive a worker (removes them from future audiences; existing delivery records remain — Q7).
- Delete the org with typed confirmation; the cascade removes all tenant data and media, confirmed by email.
- Correct a worker name or language; delivery language snapshots stay immutable (D3).

A worker who asks the supervisor to remove their data is handled through worker archive plus org export/deletion policy. There is no self-service worker data portal in v0.1, and this is disclosed in the pilot terms.

### 7.5 Notices

A static `/privacy` page (linked from the sign-in footer and the worker picker footer, per the wireframe) states: what is collected, why, who processes it, retention, and how to contact the org owner. It is written for workers in plain language and reviewed before the first external pilot. The product does not claim legal compliance; it states practices.

### 7.6 Cross-border processing

Providers may process data outside the GCC. The pilot terms and privacy page name the categories of processors (AI, storage, email) without pretending to a specific legal mechanism. Before a paid pilot in a regulated entity, counsel confirms whether a data processing agreement or localization requirement applies.

---

## 8. Abuse resistance and rate limits

| Bucket | Limit | Failure mode |
|---|---|---|
| Magic link request | 5/h/email · 20/h/IP | 429 |
| Verify | 30/h/IP | 429 |
| Worker meta | 60/min/token+IP | 429 |
| Identify | 10/min/token · 30/min/IP | 429 |
| Worker mutations | 30/min/delivery | 429 |
| Uploads | 10/min/org | 429 |
| Generate | 10/h/org | 429 |
| Share/regenerate | 10/h/instruction | 429 |
| Exports | 5/h/org | 429 |

- Limits are Redis counters keyed by the narrowest identity available (token, then IP).
- `X-Forwarded-For` is trusted only from Caddy (`trust proxy` set to the loopback proxy); client-supplied forwarding headers are ignored.
- **Fail-open vs fail-closed:** rate limits fail open when Redis is unavailable (availability), but worker mutations fail closed because idempotency is unavailable (correctness). This asymmetry is intentional and tested.
- Share-token guessing is bounded by 256-bit entropy; rate limits are a second layer, not the primary control.
- Upload and generate caps also protect the free-tier budget. Provider 429s are handled by queue backoff, not by user-visible errors until retries exhaust.

---

## 9. Auditability

v0.1 does not ship a general admin audit log. What exists:

| Event | Record |
|---|---|
| Instruction shared | `sharedAt`, `sharedBy` on the instruction; `instruction_shared` analytics event |
| Link regenerated | New hash/ciphertext, `shareTokenRevokedAt`; old link returns 410 |
| Instruction archived | `archivedAt`; worker link shows closed |
| Delivery opened / answered / completed | First-event timestamps, immutable |
| Language change | `languageChangeHistory` with from/to/at |
| Help requested / resolved | `help.requestedAt`, `resolvedAt`, `resolvedBy` |
| Export performed | `audit_exported` analytics event (scope only) |
| Magic link sent / used | `email_log` + `magic_links.usedAt` |

What does not exist: a per-actor log of settings changes, worker edits, or CSV imports. With one owner and no seats, the marginal value is low and the schema cost is real. When seats ship in v0.2, an `audit_events` collection becomes necessary; the seam is the existing actor fields (`createdBy`, `sharedBy`, `resolvedBy`). This limitation is stated in the pilot terms rather than implied away.

---

## 10. Incident response

### 10.1 Severity

| Level | Example | Response |
|---|---|---|
| S1 | Cross-tenant access, leaked secrets, data loss | Immediate; pause feature work |
| S2 | Auth bypass, worker data exposed via a link, prolonged outage | Same day |
| S3 | Single-org bug, failed pipeline, email outage | Next working block |
| S4 | Cosmetic, single-user confusion | Backlog |

### 10.2 First 60 minutes

1. **Contain.** Rotate the affected secret; regenerate share links for the affected instruction; disable the affected route via feature flag if needed.
2. **Preserve.** Snapshot relevant logs and Sentry events; do not delete evidence.
3. **Assess.** Which orgs, which data, how long, who could see it. Use ids, not names.
4. **Notify.** The founder informs the affected owner with facts and the fix. Legal notification obligations (e.g., UAE PDPL, Saudi PDPL) are decided with counsel; the runbook records the decision and timing.
5. **Recover.** Restore from the last good backup only if data was lost; verify `/healthz`, one worker flow, and one export.
6. **Postmortem.** Within five days: timeline, root cause, what prevented detection, one corrective action with an owner. Stored in the repo, not in a private notebook.

### 10.3 Specific playbooks

| Scenario | Action |
|---|---|
| Share link posted publicly | Regenerate link; deliveries and delivery tokens survive; old link 410 |
| Delivery token stolen | Evict by issuing five new tokens from the worker's device, or wait for delivery close; no cross-delivery scope exists |
| Session stolen | Delete `us:{userId}` sessions, rotate `TOKEN_PEPPER` only if widespread |
| R2 object exposed | Bucket policy check; rotate keys; signed URLs expire ≤15 min |
| Provider breach | Rotate that provider key; assess what text/email it held; notify per §10.2 |
| Backup compromised | Rotate encryption key, delete old backups, rotate R2 credentials |

---

## 11. Security acceptance tests

Doc 05 §11 is the canonical list. The security-specific additions:

1. CSP header present on both shells; no `unsafe-eval`; no inline script executes under the policy.
2. Session cookie has `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefix; logout invalidates server-side.
3. A mutating request with a foreign `Origin` is rejected even with a valid cookie.
4. Share token and delivery token values never appear in logs, Sentry payloads, or analytics events.
5. An uploaded SVG or HTML file is rejected; a JPEG with GPS EXIF is stored with EXIF removed.
6. A translation response containing markup or extra JSON keys fails validation and never reaches a variant.
7. A worker token from delivery A cannot read or mutate delivery B, even within the same instruction.
8. Rate-limit headers are present and a breach returns 429 with `Retry-After`; when Redis is down, worker writes return 503 rather than double-recording.
9. The `/privacy` page is reachable without auth and the footer links resolve.
10. PostHog events contain no worker name, email, phone, or instruction text (asserted against a fixture payload).
11. Sentry event from a forced error contains no cookie, token, or request body.
12. Restoring last night's backup into a scratch database yields identical delivery counts and the same understood counts.

---

## 12. Open security items

| # | Item | Needed by | Owner |
|---|---|---|---|
| S1 | Domain + SPF/DKIM/DMARC before any external magic link | Pilot start | Founder |
| S2 | `/privacy` copy reviewed for plain language and accuracy | Pilot start | Founder + counsel |
| S3 | Provider DPAs/terms recorded (Resend, Azure, Groq, R2) | First paid pilot | Founder |
| S4 | Backup encryption key stored outside the VM | Before first backup | Founder |
| S5 | Penetration test or external review | After first revenue, not v0.1 | Founder |
| S6 | Legal review of PDPL obligations for KSA/UAE pilots | Before paid pilot | Counsel |

None of these blocks the build. S1, S2, and S4 block the first external pilot.

---

**Previous:** [03 — Data & API Contracts](./03-data-and-api-contracts.md) · **Next:** [05 — Deployment & Operations](./05-deployment-and-operations.md)
