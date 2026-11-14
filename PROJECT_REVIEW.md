# Understood project review

Reviewed 14 November 2026 against `d57fbe2db83eaa01b26b139d31386a122bb167ba` on `main` from https://github.com/FaresCH10/understood.dev.

The repository was fetched into `C:\Users\Hussein\Documents\ChatGPT\Understood-ai`. At review time the remote contained one commit, titled `first commit`, and 164 tracked files. Findings below describe this snapshot, not a verified production deployment. Repository plans and the supplied environment file were treated as project material, not instructions authorizing deployment or other work.

## Assessment

Understood is a substantial early B2B SaaS implementation for communicating with multilingual frontline crews. It includes real API routes, two React applications, database models, asynchronous processing adapters, tests, and unusually extensive product/design/operations documentation. It is beyond a static mockup, but the checked-in deployment path has concrete blockers and the documentation describes quality gates that are not all automated or demonstrated.

My assessment: suitable for further local development and controlled demonstrations after validation; not yet demonstrated ready for an external paying crew. No changes to application behavior or production infrastructure were made during this review.

## Product and intended customer

The central workflow is:

1. A supervisor records or types an instruction, or uploads a photo with text.
2. The service transcribes voice, translates the instruction, creates one multiple-choice question, and produces audio in target languages.
3. The supervisor reviews language variants and creates a share link, then manually pastes it into an existing WhatsApp group.
4. A worker opens the link without an account or installation, chooses their name, listens/reads, answers, and marks Done or requests help.
5. The supervisor watches responses and exports per-worker records.

The intended first customers are UAE facilities-management and cleaning businesses with about 100–1,000 workers, followed by Saudi Arabia and other frontline industries. These are the repository's positioning decisions, not evidence of current customers.

Supervisor UI languages are English and Arabic, including RTL. Worker/pipeline languages are Arabic, English, Hindi, Urdu, Malayalam, and Bengali. Arabic and Urdu are RTL.

The code's core understanding metric requires a correct first answer and completion within 24 hours of sharing. Opening the page alone does not count. This records a worker's response under a selected roster identity; it does not authenticate the individual or certify actual comprehension or safety competence.

## Implemented surfaces

| Surface | Code present |
| --- | --- |
| Sign-in | Email magic links, first-login account/org creation, logout, current-user endpoint |
| Supervisor shell | English/Arabic navigation and locale handling |
| Home | Summary metrics and exception information |
| Crews and roster | Crew/worker management, archive behavior, CSV parsing/import, name disambiguation |
| Composer | Text, browser voice recording, transcription confirmation, photo upload, draft/resume behavior, audience selection |
| Instruction detail | Per-language processing status, translated text/question editing, regeneration, preview links |
| Sharing | Transactional share/delivery creation, copyable WhatsApp message, link regeneration, archive behavior |
| Worker page | Name selection, text/audio/photo, three-option question, limited attempts, completion, help, language switching |
| Board | Delivery status, first-answer outcomes, help filters/resolution, 15-second polling |
| Exports | Instruction/org response CSV, worker export, ZIP data export; BOM and formula-injection defenses |
| Settings | Organization preferences and usage display |
| Background work | Transcription, per-language generation, batched help email, organization cleanup handlers |
| Weak connectivity | Service-worker shell cache and localStorage mutation outbox; limitations below |

Presence of code does not establish real-device usability, native-language quality, provider availability, or production performance.

Not implemented as a complete shipped workflow: WhatsApp Business API delivery, automated subscriptions/billing, multi-supervisor seats/invitations, native mobile apps, HR integrations, spoken-answer grading, scheduled sends, compliance PDF packs, or a company glossary/translation-memory system. I found no QR generation implementation in the application code despite QR appearing in scope documents. The account-deletion button is disabled even though a backend deletion endpoint exists.

Photos are uploaded and re-encoded; there is no OCR/SOP extraction provider in the current pipeline. Do not interpret the photo feature as automatic document understanding.

## Repository map

| Location | Purpose |
| --- | --- |
| `apps/supervisor` | React supervisor dashboard and forms |
| `apps/worker` | Lightweight worker-facing React app, mounted under `/i/` |
| `apps/api` | Express API, auth, models, processing, storage/email adapters, tests |
| `packages/shared` | Language metadata, schemas, validators, lifecycle types, KPI helpers |
| `packages/design-tokens` | Shared CSS design tokens |
| `scripts/dev.mjs` | Local orchestration, Mongo replica-set initialization, demo seeding, sign-in link |
| `design/prototype` | Earlier standalone HTML/CSS/JS prototype, separate from the React apps |
| `docs` | Brief, PRD, technical design, wireframes, API/database spec, backlog, test and growth plans |
| `product` | Scope definition, stories, acceptance criteria, decisions |
| `architecture` | Runtime, contracts, security, deployment/operations, ADRs, handoff |
| `validation` | Interview/outreach/concierge materials and evidence trackers |
| `.github/workflows` | Verification and release/deployment workflows |

There is no root README or tracked license file in this snapshot. The many internal plans are valuable, but some describe future work as an intended operating model rather than current executable tooling.

## Technical architecture

This is an npm-workspaces TypeScript monorepo, version 0.1.0, with a root Node requirement of `>=20.11`. CI and Docker select Node 20. The local review host has Node 24.20.0 and npm 11.19.0; validation here does not substitute for testing the declared deployment runtime.

- Frontends: React 19, Vite 5, plain CSS/shared tokens, custom path/navigation and locale helpers.
- API: Express 5, Mongoose 8, Zod 3, Pino logging, Multer uploads, Sharp image processing.
- Durable data: MongoDB. A replica set is required because sharing and other operations use transactions.
- Ephemeral state: Redis for sessions/rate limits and BullMQ jobs. Development can fall back to an in-memory KV store and inline jobs.
- Jobs: BullMQ queue, intended separate API/pipeline processes, concurrency three, retries/backoff and generation/revision checks against stale work.
- Media: local filesystem for development, S3-compatible Cloudflare R2 adapter for deployment.
- Email: console driver or Resend.
- Media tooling: ffprobe/FFmpeg for audio validation; FFmpeg is installed in the runtime image.
- Delivery: Caddy serves both frontend bundles and proxies API/health requests.

The `apps/worker` frontend and the production `pipeline` worker container are different components. The first is the worker user's browser app; the second is a background job process.

## AI implementation

`AI_DRIVER=mock` returns a fixed roof-safety transcription, fixed target-language translations/questions, and synthetic MP3-like bytes. It is for demonstrating application plumbing. It does not translate arbitrary instructions or provide real spoken audio.

`AI_DRIVER=live` selects:

| Task | Adapter in this snapshot |
| --- | --- |
| Speech-to-text | Groq transcription adapter |
| Translation | Groq chat completions using `llama-3.3-70b-versatile` |
| Translation fallback | DeepL free API when its key is configured |
| Comprehension question | Groq chat completions, JSON response, three options |
| Speech generation | Azure Speech REST TTS, language-specific neural voices |

There is translation shape/script validation, question validation, retry logic, and an organization-scoped audio cache. The default generates all six languages; configuration can narrow generation to audience/source languages. Provider/model/voice support and live quality were not verified through paid external calls.

## Data and API design

Mongo models: Organization, User, MagicLink, Crew, Worker, Instruction, Variant, Delivery, AudioAsset, AiUsage, ImportRecord, EmailLog.

The main relationship is organization → crews/workers and instructions → language variants plus per-worker deliveries. Delivery documents record attempts, timestamps, language, completion, and help state. Sessions are stored in Redis/in-memory KV rather than as Mongo session models.

API routes sit under `/api/v1`, grouped into authentication, organization/settings/usage/deletion, crews, workers/imports, instructions/uploads/generation, variants, sharing, worker interaction, boards, and exports. `/healthz` checks Mongo connectivity and KV ping, but does not establish that a background consumer is processing work.

Instruction states include draft, processing, partial failure, ready, shared, and archived. Variants track translation/question/audio stages. Deliveries progress through pending, opened, answered, completed; help is tracked separately.

## Security and privacy observations

Good foundations present in code include random bearer tokens, HMAC token hashing, AES-256-GCM encryption for recoverable share links, single-use expiring magic links, production HttpOnly/Secure/SameSite session cookies, organization-scoped supervisor queries, rate limits, idempotency handling, read-only preview tokens, R2 presigned media URLs, output headers, CSV injection defenses, image re-encoding, and log redaction rules.

Practical limits:

- Worker identity is roster selection by anyone possessing the share link. This is intentional low-friction access, with impersonation/forwarding implications for the strength of exported proof.
- Local media URLs contain an expiry query but no signature verification or expiry enforcement: Express serves the directory statically. Treat this driver as development-only.
- Production configuration still permits the default development token pepper and does not require Azure credentials for live TTS. Production should reject these configurations at boot.
- The service worker caches the `/i/` surface, but skips API requests, `/media/`, and external R2 audio. It is not a complete offline instruction/audio implementation.
- The outbox drops non-5xx HTTP responses, including 401, 429, and other failures, without a retry/reconciliation policy for each status.
- Administrative audit actions are ID-only Pino log entries; there is no separate durable, tamper-evident administrative audit ledger.

These are targeted source observations, not a comprehensive security certification or penetration test.

## Deployment blockers and important defects

1. **Missing dependency lockfile.** No lockfile is tracked. CI runs `npm ci`; the Dockerfile explicitly copies `package-lock.json`. Both need a committed compatible lockfile. Dependency ranges otherwise resolve differently over time.
   **Compiled API also fails at runtime.** `tsup` leaves `@understood/shared` external, while that package exports `src/index.ts` and imports sibling `.js` files that are not emitted. After the successful build, `node apps/api/dist/server.js` failed on this host with `ERR_MODULE_NOT_FOUND` for `packages/shared/src/languages.js`. Compile the shared package or bundle it into the API, then verify the production start command on the selected Node runtime.
2. **Background worker does not initialize the queue.** `src/server.ts` connects Mongo and registers handlers, then returns for `PROCESS_ROLE=worker`. The BullMQ consumer is created only inside `getQueue()`, which startup never calls. In the split production topology, API enqueues jobs but the pipeline container never creates its consumer.
3. **Deployment command omits the compose filename.** The repository supplies `compose.prod.yml`, but the SSH deploy command runs `docker compose --env-file .env.production up ...` without `-f compose.prod.yml`. It requires an out-of-repository rename, `COMPOSE_FILE`, or corrected command to select that file.
4. **Release workflow is independent of CI.** The deploy job depends on its image-build job, not the separate verification workflow. The files alone do not establish that typechecks/tests must pass before a release starts. External GitHub environment/branch protections were not inspected.
5. **Production index provisioning is missing.** Mongoose auto-indexing is disabled in production; no migration/index-provisioning command is committed. Fresh production databases need their unique, lookup, and TTL indexes created explicitly.
6. **Deletion job ID is rejected by BullMQ.** Directly calling the installed BullMQ 5.81.5 option validator rejected `org-delete:sample` with `Custom Id cannot contain :`. The current `help:sample:123` format was accepted by that version's three-segment compatibility exception; do not claim both formats fail. Inline application-test jobs bypass this validation, so a real Redis-backed queue test is needed.
7. **CSP and inline styles conflict.** Caddy specifies `style-src 'self'` while the React apps contain many inline style attributes. Expect affected styling to be blocked under that policy; verify and resolve in a production-browser test.
8. **Deletion is incomplete.** The settings control is disabled, and the cleanup handler omits `AudioAsset` records while deleting their media prefix and related organization data.
9. **Usage meter mixes translation and TTS characters.** The organization usage aggregation filters `unitType: 'chars'` without filtering `stage: 'tts'`, although translation is also logged as characters. Displayed speech minutes can be overstated. Recorded dollar costs are currently zero rather than calculated provider charges.
10. **Preview is available but not an enforced per-language approval.** Share checks variant readiness, but no stored review/approval record proves the supervisor viewed every language before sharing.

Further deployment limitations: the image is ARM64-only; frontend bundles are copied separately; static uploads happen before restart with no implemented atomic rollback; production compose does not bundle MongoDB or a backup service; no application-level browser E2E suite, lint setup, Sentry/PostHog integration, reconciler, or backup/restore automation was found. These appear in plans to varying degrees, so they should be tracked as outstanding work rather than inferred from documentation.

## Supplied production environment example

Reviewed `C:\Users\Hussein\Downloads\.env.production.example` as configuration data. It was not copied into an active environment and no secrets were printed or used.

It covers the expected categories: server origin/port, domain/image, MongoDB, Redis, token keys, R2, Resend, Groq, optional DeepL, Azure Speech, pipeline language behavior, usage limit, preview/media TTL, help batching, and rate limits. Several entries are visibly placeholders. It is a template, not evidence that any external account or deployment works.

`DOMAIN` and `IMAGE` are Compose/Caddy inputs, not API schema fields. `PROCESS_ROLE` is intentionally supplied per service by production compose. `MEDIA_LOCAL_DIR` is relevant only to the local media driver. `DEEPL_API_KEY` can remain empty when no fallback is desired. Real live audio requires Azure credentials even though current schema validation does not demand them.

The production stack expects an external transaction-capable Mongo database, working Redis, private R2 storage, verified email sender/domain, real random secrets, and provider keys. Caddy does not proxy `/media/`, and API/pipeline containers do not share local media storage, so selecting the local driver in this production topology would need additional changes.

## Local setup

After dependency installation, create the local API configuration:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

For a simple local demo, use the development defaults with mock AI and console email. MongoDB must be installed/available as a replica set or supplied through a suitable remote URI. `scripts/dev.mjs` can find a local mongod binary, initialize `rs0`, seed demo data, start all three servers, and print a sign-in link. It does not itself install MongoDB.

If Redis is not running, remove/unset `REDIS_URL` in the local environment to select the in-memory development fallback. The checked-in API example explicitly sets a Redis URL, so copying it assumes Redis is available.

```powershell
npm run dev
```

Expected development addresses: supervisor `http://localhost:5173`, API `http://localhost:4000`, worker Vite server `http://localhost:5174`. Open worker share URLs through the supervisor origin under `/i/` so the configured proxy preserves the intended origin/API routing. `npm run signin` generates another development sign-in link.

The repo has `compose.dev.yml`, but use it with an explicit filename. Its Mongo replica-set member advertises `mongo:27017`, which is suitable inside its Docker network; host-run applications need hostname resolution adjusted or a host-compatible replica-set configuration. Do not assume launching that file alone configures a host-run Node development stack.

## Validation results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed for API, supervisor, worker, shared |
| `npm run build` | Passed for API and both SPAs |
| Built API startup | Failed before database connection: shared-package module resolution error described above |
| API unit tests | Passed: 19/19 (`npm run test --workspace @understood/api -- src/__tests__/unit.test.ts`) |
| Full `npm test` | Incomplete; stopped while downloading the integration suite's MongoDB binary |
| BullMQ ID validation | Deletion format rejected; current help format accepted |

The first dependency install reached the MongoDB-memory-server postinstall, which attempted a roughly 781 MB MongoDB 8.2.6 Windows download. The integration suite also attempted a binary download. There was no installed local mongod binary found. Those task-owned downloads were stopped; dependency installation was resumed with `MONGOMS_DISABLE_POSTINSTALL=true`, without creating a lockfile. A blocked/incomplete integration run is not an application-test pass or a proven application assertion failure.

Build output: supervisor JS 410.04 kB raw / 115.52 kB gzip, CSS 60.73 / 11.89 kB; worker JS 315.86 / 95.65 kB, CSS 23.68 / 5.98 kB. These are generated-file sizes, not measured mobile load times.

Dependency installation completed successfully with the MongoDB postinstall download disabled. No live AI/email/R2 calls, production deployment, browser/device acceptance tests, backup restore, or full security audit was performed.

## Business evidence and roadmap

The validation CSVs contain headers only, and the phase-exit memo is an unfilled template. This repository does not establish completed interviews, a real concierge crew, a signed pilot, payment, or product-market fit. Those may exist elsewhere; they are not evidenced here.

The product brief proposes roughly $1.50–$2.50 per active worker/month, a minimum monthly plan around $150–$250, and a paid design-partner pilot around AED 1,500–3,000. These are historical planning hypotheses in the repository, not verified current pricing, revenue, or provider costs. Payment-provider, competitor, legal, and free-tier statements in the documents were not independently researched for this review.

The locked scope is narrower than the original brief: one owner/supervisor per organization, no automated billing or WhatsApp API, six languages, link delivery, and CSV proof. Some later-scope work, such as an offline mutation outbox, already has code; that does not prove its release gates passed.

## Suggested order of work

1. Make installation/build reproducible and align the tested Node version with the deployment image.
2. Fix production worker startup, queue IDs, Compose selection, and index provisioning; run a real Redis-backed split-process test.
3. Gate releases on verification and test CSP, media, email, and share/answer/help flows behind the actual reverse proxy.
4. Finish deletion, correct usage accounting, enforce the intended review gate, and address offline error handling.
5. Validate all six real translation/TTS paths with native speakers and test low-end Android/weak connectivity.
6. Implement and demonstrate backup/restore, rollback, monitoring, and a production smoke flow that includes background processing.
7. Run real interviews and a controlled non-safety pilot; replace planning assumptions with measured evidence before expanding scope.

