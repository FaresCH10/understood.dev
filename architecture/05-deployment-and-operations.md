# 05 — Deployment & Operations

**Phase 4 · Document 5 of 7** · Version 0.1 · Date 2026-11-13
**Owner:** Founder · **Status:** Implementation-ready
**Builds on:** [01 — System Architecture](./01-system-architecture.md) · [TDD §11–18](../docs/04-tdd.md) · [Decision Register §7](../product/04-decision-register.md)

---

## 0. The operating constraint

One founder, no on-call, $0 until a paid pilot. Every decision below optimizes for **a tired person at 11 pm being able to fix it from a laptop**. That rules out Kubernetes, managed pipelines, multi-region, and any component whose failure requires a specialist. It also means backups, health checks, and a printed runbook are not operational polish — they are the architecture.

---

## 1. Environments

| Environment | Purpose | Data | Deploy |
|---|---|---|---|
| Local | Development, UI work, provider mocks | Seed only | `docker compose -f infra/docker-compose.dev.yml up` |
| Staging (optional) | Pilot rehearsal, e2e against a real origin | Seed + synthetic | Same VM, separate compose project + Atlas DB + R2 prefix |
| Production | Pilot | Real | `main` → GHCR → VM |

Staging is optional until the first external pilot. If used, it lives on the same Oracle VM with a separate compose project (`understood-staging`) and separate credentials. It never shares Mongo, Redis, or R2 buckets with production. The cost of a second Atlas M0 is $0; the cost of a staging bug touching production data is not.

Local development uses provider adapters in `mock` mode with fixture responses, so UI work needs no API keys (TDD §11.3). A `seed-demo` command creates the Phase 3 demo org, 24 workers, and one shared instruction.

---

## 2. Production topology

```
                    Internet
                       │ 443
                 ┌─────▼──────┐
                 │   Caddy    │  TLS, headers, gzip, static shells
                 └──┬──────┬──┘
          /api/*    │      │  /* and /i/*
                 ┌──▼──────▼──┐
                 │ api (both) │  Node 24 + Express; queue consumers
                 └──┬─────┬───┘
        ┌───────────┘     └───────────┐
   ┌────▼─────┐                 ┌─────▼─────┐
   │ Atlas M0 │                 │ Redis Cloud│
   └──────────┘                 └───────────┘
        │                              
   ┌────▼─────┐   ┌──────────────┐   ┌──────────────┐
   │    R2    │   │  Resend /    │   │ Groq / Azure │
   │ media +  │   │  Sentry /    │   │ / DeepL      │
   │ backups  │   │  PostHog     │   └──────────────┘
   └──────────┘   └──────────────┘
```

Compose services on the VM:

| Service | Image | Responsibility |
|---|---|---|
| `caddy` | custom Caddy image with both SPAs copied in | TLS, headers, static files, reverse proxy |
| `api` | app image, `PROCESS_ROLE=both` | HTTP + queue consumers |
| `worker` | same app image, `PROCESS_ROLE=worker` | Added only when the API process is saturated |
| `backup` | small cron image with `mongodump` + `age` | Nightly encrypted dump to R2 |

All services `restart: unless-stopped`, Docker log rotation (`max-size: 10m`, `max-file: 3`), and a compose healthcheck on `api` (`/healthz`, 30 s interval, 3 retries).

### 2.1 Image

- Multi-stage build: Node 24 slim for build, Node 24 slim runtime with `ffmpeg` (for `ffprobe`) and sharp's prebuilt libvips.
- Built for `linux/arm64` (Oracle Ampere). CI uses `docker buildx --platform linux/arm64`; a local x86 build is for tests only.
- Frontends are built in CI and copied into the Caddy image at `/srv/supervisor` and `/srv/worker`. One image pair, one deploy.
- Non-root user in the app container; read-only root filesystem except `/tmp`.
- Image tag: git SHA; `latest` also pushed but never deployed by tag.

### 2.2 Caddy

```
app.example.com {
  encode zstd gzip
  request_body { max_size 16MB }

  handle /api/* {
    reverse_proxy api:3000
  }
  handle /healthz {
    reverse_proxy api:3000
  }
  handle /i/* {
    root * /srv/worker
    try_files {path} /index.html
    file_server
  }
  handle {
    root * /srv/supervisor
    try_files {path} /index.html
    file_server
  }

  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    -Server
  }
  header /i/* Referrer-Policy "no-referrer"
  header /i/* Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
  header /api/* Cache-Control "no-store"
}
```

CSP is set by the app for HTML responses or by a Caddy header block using the policy in [04 §4.2](./04-security-and-privacy.md); it is not duplicated in two places. Static assets are content-hashed by Vite and served with `Cache-Control: public, max-age=31536000, immutable`.

### 2.3 Database connections

Atlas M0 permits 500 connections; the app opens a pool of 10 per process. The VM's egress IP is allowlisted in Atlas. `serverSelectionTimeoutMS=5000`, `socketTimeoutMS=45000`. Redis Cloud uses TLS (`rediss://`) with a 30 MB / 30-connection limit; the app uses one connection for BullMQ plus one for sessions/limits.

---

## 3. Configuration

One Zod schema at boot. Required in every deployed environment:

```
NODE_ENV, APP_ORIGIN, PROCESS_ROLE
MONGODB_URI
REDIS_URL
TOKEN_PEPPER, TOKEN_ENC_KEY, TOKEN_SECRET
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_BACKUP_BUCKET
AZURE_SPEECH_KEY, AZURE_SPEECH_REGION
GROQ_API_KEY
RESEND_API_KEY, EMAIL_FROM
SENTRY_DSN (optional in dev)
POSTHOG_KEY (optional in dev)
```

Optional: `DEEPL_API_KEY`, `PIPELINE_ALL_LANGUAGES` (default `true`, P4-1), `PIPELINE_CONCURRENCY` (default 3), `TTS_MONTHLY_MINUTES_CAP` (default 150), `ALLOW_SEED` (default false), `PREVIEW_TTL_MINUTES` (default 15).

Rules:

- Missing or malformed config fails boot with the field name, never a stack trace.
- `NODE_ENV=production` rejects `mock` providers and `ALLOW_SEED=true` unless an explicit override is set for a demo environment.
- Client bundles receive only `VITE_*` values. CI scans the built assets for server secret names and fails on a match.
- `.env.example` documents every variable with placeholders; `.env` is gitignored.

---

## 4. CI/CD

### 4.1 Pipeline (GitHub Actions)

| Stage | Runs on | Gate |
|---|---|---|
| Install (`npm ci`) | every PR | lockfile only |
| Lint + typecheck | every PR | zero errors |
| Unit tests | every PR | zero failures |
| Integration tests (Mongo replica set + Redis service) | every PR | includes tenant probes, idempotency, share/answer races |
| Build (API + both SPAs) | every PR | bundle budgets: supervisor ≤350 KB, worker ≤180 KB gzip |
| E2E (Playwright) | `main` only | golden supervisor path + worker AR/ML flow |
| Docker build + push to GHCR | `main` only | arm64, tagged with SHA |
| Deploy | `main` only, after manual approval | migration + compose up + smoke |

Target: PR feedback under 10 minutes. E2E runs in parallel shards if it threatens that budget. Free 2,000 minutes/month is sufficient for a solo project; if it is not, E2E moves to nightly and stays release-blocking.

### 4.2 Deploy sequence

```
1. SSH to VM; record current image SHA
2. docker pull ghcr.io/…/app:<new-sha>
3. docker compose run --rm api npm run migrate      # aborts deploy on failure
4. docker compose up -d --no-deps api caddy
5. Poll https://app…/healthz until 200 (max 60 s)
6. Smoke: GET / (200), GET /i/ (200), POST /auth/magic-link (202), one seeded worker meta
7. If any step fails: redeploy previous SHA and investigate
```

Migrations are **expand → migrate → contract** across releases: a migration must not break the previous image, because rollback runs the old image against the new schema. Dropping a column happens one release after it stops being written. This is the only rule that makes rollback real without down-migrations.

### 4.3 Rollback

```
docker compose up -d --no-deps api caddy with PREVIOUS_SHA
```

Rollback does not undo a migration; the expand/contract rule makes that safe. If a migration itself is destructive and must be undone, restore the pre-deploy dump (documented in the migration file). Data loss is acknowledged in the incident record.

### 4.4 Release policy

- `main` is always deployable. Feature work merges only with tests and a green build.
- Freeze windows (decision register §7.4): no behavior changes during a pilot week except stop-ship fixes; last build week only stop-ship and copy.
- Every deploy is one line in `ops/deploy-log.md`: date, SHA, what changed, who approved.
- No deploy after 16:00 local on a Friday before a pilot week.

---

## 5. Provisioning runbook

Ordered, ~2 hours once accounts exist.

1. **Domain + DNS.** Buy a domain (~$10–12/yr, the one honest cost). Point `app` A/AAAA at the VM. Wait for propagation.
2. **Oracle VM.** Always Free Ampere (4 OCPU / 24 GB), Ubuntu 24.04. Open 80/443 only. Create a non-root `deploy` user with SSH key, disable password auth, enable `ufw`.
3. **Docker.** Install Docker Engine + Compose plugin; add `deploy` to the docker group; enable on boot.
4. **Atlas M0.** Create a project, one cluster, database user with a generated password, allowlist the VM egress IP. Use a dedicated database name (`understood`).
5. **Redis Cloud.** Free 30 MB database; copy the TLS URL; confirm `PING` from the VM.
6. **R2.** Two private buckets: media (`understood-media`) and backups (`understood-backups`). CORS on media: `GET, HEAD` from `https://app…`. Lifecycle rule on backups: delete after 30 days.
7. **AI providers.** Azure Speech F1 (check all six voices during week 3 — T1/Q2), Groq key, optional DeepL key.
8. **Resend.** Verify the domain (SPF, DKIM, DMARC), set `EMAIL_FROM`. Do not run an external pilot from the test sender.
9. **Sentry + PostHog + UptimeRobot.** Create projects; copy DSN/key; add an UptimeRobot HTTP check on `/healthz` every 5 minutes with email + WhatsApp alerts.
10. **Secrets.** Write production `.env` (mode 600). Add SSH key, GHCR token, and deploy host to GitHub Actions secrets.
11. **First deploy.** Push `main`; watch the workflow; confirm `/healthz`, TLS, and a magic link end to end.
12. **Backup.** Run the backup container once manually; verify an encrypted object exists in R2; run a restore into a scratch DB (§7).
13. **Pin the runbook.** Print §8 or keep it open on the phone. The person fixing an outage will not read a 400-line document at 2 am.

---

## 6. Observability

### 6.1 What exists

| Signal | Tool | Retention |
|---|---|---|
| Uptime + TLS expiry | UptimeRobot (5 min) | Provider |
| Exceptions + error rate | Sentry (API + both SPAs) | 30 days |
| Product events | PostHog (pseudonymous) | 1 year |
| Logs | pino JSON → Docker json-file | 14 days (rotation) |
| Queue depth / failed jobs | BullMQ counts logged by a 5-minute maintenance job | 14 days in logs |
| Health | `/healthz` (Mongo + Redis ping) | live |

There is no Prometheus, Grafana, or custom dashboard. At one operator and ten orgs, three alert emails and `docker compose logs` are the observability stack. Adding a metrics server would create a component to maintain with no one to watch it.

### 6.2 Alerts (email; WhatsApp for uptime)

| Alert | Threshold | Action |
|---|---|---|
| Site down | 2 consecutive UptimeRobot failures | §8.1 |
| Error rate | Sentry >1% of requests for 5 min | Inspect top issue; rollback if new deploy |
| Pipeline failures | >20% of variants failed in 1 h (logged alert job) | Check provider status/keys; retry languages |
| Queue depth | >50 waiting for 10 min | Check worker process; provider rate limits |
| Redis memory | >24 MB | Prune retention; plan paid tier |
| TTS usage | >80% of monthly grant | Settings banner; slow generation; upgrade trigger |
| Disk | >80% | Clear Docker images/logs; check backups |
| TLS renewal failure | UptimeRobot/Caddy log | Check port 80/443, DNS, rate limits |

### 6.3 Log rules

Allowlisted fields only (04 §7.3). One line per request: `requestId, route, method, status, latencyMs, orgId?, instructionId?, errorCode?`. One line per job: `jobId, stage, language, attempt, durationMs, provider, outcome`. Never a token, name, email, phone, or instruction body. A CI test asserts the logger rejects a payload containing a name field.

---

## 7. Backup and recovery

### 7.1 Backup

Nightly at 02:00 org timezone (cron container):

```
mongodump --uri "$MONGODB_URI" --gzip --archive \
  | age -r "$BACKUP_PUBLIC_KEY" \
  > /tmp/understood-$(date +%F).gz.age
aws s3 cp … s3://understood-backups/mongo/$(date +%F).gz.age --endpoint-url $R2_ENDPOINT
```

- Encrypted before leaving the VM with an `age` public key; the private key is stored off-VM (password manager + printed copy).
- 30-day lifecycle on the backup bucket.
- Media is not duplicated into backups. R2 is the durable store for audio/photos; a loss of R2 is a media-loss event, not a metadata-loss event. Source audio can be re-recorded; TTS can be regenerated from text in Mongo. This trade is recorded in ADR-17.
- Atlas M0 has no managed backups; this dump is the only recovery path.

### 7.2 Restore

```
age -d -i backup.key understood-2026-11-12.gz.age > dump.gz
mongorestore --uri "$SCRATCH_URI" --gzip --archive=dump.gz --drop
```

Validate: counts per collection match the deploy log snapshot; one delivery's timestamps and understood flag match; one worker page loads against the scratch API. Restore drill weekly during the pilot, monthly after.

**RPO 24 h, RTO 2 h** for metadata. Media RPO is provider durability, not a backup schedule.

### 7.3 Disaster scenarios

| Scenario | Impact | Recovery |
|---|---|---|
| VM lost/rebooted | Minutes of downtime | Rebuild from provisioning runbook; Atlas/R2 intact; 1–4 h |
| Atlas unavailable | Total outage | Wait on Atlas; if data corrupt, restore latest dump |
| Redis lost | Supervisors signed out; queues/idempotency gone; processing instructions stall | Reconcile job moves stuck instructions to `partial_failure`; workers re-identify; supervisor retries languages |
| R2 unavailable | Uploads and new audio signing fail; cached audio still plays | Wait; retry; no data loss |
| Domain/TLS failure | Total outage | Fix DNS; Caddy retries ACME |
| Ransomware/compromise | Catastrophic | Rotate every key; restore from encrypted backup; follow 04 §10 |

---

## 8. Runbooks

### 8.1 Site down

1. `curl https://app…/healthz` → 200/503/timeout?
2. SSH: `docker compose ps`; `docker compose logs --tail=200 api caddy`.
3. If the API is restarting: check `docker compose logs api | grep -i "config\|mongo\|redis"`.
4. If Mongo/Redis unreachable: check Atlas/Redis status pages and IP allowlist; restart API after connectivity returns.
5. If the VM is unreachable: reboot from the Oracle console; if it does not return, rebuild.
6. Confirm recovery: `/healthz`, one worker link, one magic link.

### 8.2 Stuck instruction (`processing` > 10 minutes)

1. Check `GET /instructions/:id/status` — which stage/language is running?
2. `docker compose logs api | grep <instructionId>` — provider 429/timeout or crashed job?
3. If the queue is alive, retry the language from the preview screen.
4. If Redis was lost or the queue is empty, run the reconcile script (02 §3.7); it marks stalled stages failed so Retry becomes available.
5. Verify no duplicate audio: the variant revision guard prevents stale writes.

### 8.3 Redis loss / memory pressure

1. Supervisors are signed out — that is expected. Workers' delivery tokens still work; mutations return 503 until idempotency is available.
2. Restore Redis Cloud service; app reconnects automatically.
3. Run reconcile; instruction statuses settle.
4. Check memory: if >24 MB, lower idempotency TTL to 12 h, cap queue retention, delete stale imports; if still high, upgrade Redis ($5).
5. Remind the supervisor that in-flight help emails may be delayed; the board is authoritative.

### 8.4 Provider outage (Groq/Azure/DeepL)

1. Check provider status page and `ai_usage` error pattern.
2. Pipeline retries automatically with backoff; languages fail individually.
3. If Groq LLM is down, DeepL handles translation if configured; question generation has no fallback — mark `manual_required` and let the supervisor write it.
4. If Azure TTS is down, variants fail audio; share with text-only (C10) or retry later.
5. Never bypass the preview gate to "just send" ungenerated content.

### 8.5 Email not arriving

1. Resend dashboard: delivered/bounced? `email_log` status.
2. SPF/DKIM/DMARC intact? Domain not suspended?
3. Check the recipient spam folder; magic links are transactional.
4. If Resend is down, share links can still be copied manually; magic-link sign-in is temporarily unavailable (documented limitation).

### 8.6 Share conflict / lost share response

1. The instruction is already shared if `status='shared'`.
2. `GET /instructions/:id/share-link` returns the URL and messages.
3. Do not regenerate the link unless it leaked; regeneration revokes the old URL.

### 8.7 Audio not playing

1. Inspect the signed URL expiry; the client should refresh automatically.
2. Check R2 CORS and bucket policy; check CSP `media-src`.
3. Check the file exists at `orgs/{orgId}/audio/{hash}.mp3`.
4. If the variant is `text_only`, there is no audio by design.

### 8.8 Org deletion stuck

1. The job is idempotent; re-run from the admin script with the org id.
2. Check R2 prefix deletion progress; re-run only deletes remaining objects.
3. Confirm the org row and sessions are gone; send the confirmation email if it failed.

---

## 9. Cost and capacity

### 9.1 The $0 stack

| Piece | Service | Free allowance | Pilot headroom |
|---|---|---|---|
| Compute | Oracle Always Free ARM | 4 OCPU / 24 GB | One app + Caddy + backups |
| DB | Atlas M0 | 512 MB | ~2 years at 10 orgs (metadata only) |
| Redis | Redis Cloud | 30 MB, 30 conn | Sessions + queues + idempotency |
| Storage | R2 | 10 GB, 1M Class A | ~25 MB/org-month at six languages |
| TTS | Azure F1 | 500k chars/month | See 9.2 |
| STT | Groq/Azure | 5 h/month | ~8 min/org-month |
| LLM | Groq free | Rate-limited | Low concurrency |
| Email | Resend | 3k/month, 100/day | One digest + magic links |
| Monitoring | Sentry/PostHog/UptimeRobot | Free tiers | Single org |
| Domain | Registrar | — | **$10–12/year** |

### 9.2 TTS math at six languages (P4-1 default)

```
800 chars per instruction × 6 languages × 12 instructions = 57,600 chars/org-month
500,000 free chars ÷ 57,600 ≈ 8.7 org-months
80% trigger ≈ 6.9 orgs at full volume
```

The pilot target is 1–3 orgs. Six variants buy language switching without an error state and cost roughly 50% more TTS than an audience-only build. The upgrade trigger is usage, not calendar: when monthly TTS reaches 400k chars, either move to pay-as-you-go Azure (pennies at this volume) or turn on audience-only generation. This is the main reason P4-1 is surfaced rather than silently assumed.

Audio storage: ~57 s per 800-char clip × 6 KB/s ≈ 342 KB per language-instruction; six languages × 12 instructions ≈ 24.6 MB/org-month. The 180-day unreferenced cleanup keeps 10 GB comfortable for years at pilot scale.

### 9.3 Upgrade triggers

| Trigger | Action | Cost |
|---|---|---|
| TTS > 80% of grant | Azure pay-as-you-go or audience-only generation | ~$1–5/mo |
| Redis > 24 MB or evictions | Redis paid tier | ~$5/mo |
| Mongo > 400 MB | Atlas M2 | ~$9/mo |
| Board p95 > 300 ms for 3 days | Move API to Render Starter, keep worker on VM | ~$7–14/mo |
| Pipeline p95 > 90 s for 2 days | Raise concurrency (if providers allow) or Render worker | ~$7–14/mo |
| Second supervisor needs concurrent access | Seats (v0.2), paid exception (A10) | Pricing decision |
| Availability complaint during working hours | Render + paid Redis | ~$20–35/mo |

The first paid customer ($149–$630/month) covers every upgrade on this list several times over. Until then, the free stack is the budget.

---

## 10. Performance validation

| Check | When | Tool | Pass |
|---|---|---|---|
| Worker bundle ≤180 KB gzip; supervisor ≤350 KB | every PR | CI size check | hard gate |
| Lighthouse mobile ≥90 performance on worker shell | weekly + before release | Lighthouse CI (throttled) | FCP ≤2 s |
| API p95 ≤300 ms (board, meta, identify, answer) | before pilot; after schema changes | k6 or autocannon (local + prod smoke) | p95 |
| Pipeline p95 4 languages ≤45 s; 6 ≤60 s | week 6 dry run | real providers, 10 runs | p95 |
| Share 1,000 deliveries <1.5 s | staging | seeded audience | p95 |
| Export 1,000 rows <2 s | staging | seeded deliveries | p95 |
| Real devices: low-end Android Chrome, iPhone Safari | week 6 | manual matrix, throttled 3G | flow <90 s |
| Restore drill | weekly during pilot | runbook §7.2 | counts match |

Load testing is deliberately light. The pilot has one supervisor and at most a few hundred workers; the failure modes that matter are provider rate limits and low-end phones, not request volume. The two load numbers worth testing — share and export at 1,000 rows — correspond to the only batch operations in the product.

---

## 11. Phase 5 operations handoff

Before the first external pilot, all of these must be true:

- [ ] Domain resolves; TLS auto-issued; HSTS present.
- [ ] `/healthz` green from UptimeRobot; alert email received on a forced failure.
- [ ] Production `.env` complete; no secret in the client bundle (CI scan green).
- [ ] Atlas allowlist limited to the VM; Redis TLS verified.
- [ ] R2 buckets private; CORS correct; one audio file plays on a real phone.
- [ ] Resend domain verified; magic link arrives; help alert arrives within 10 minutes of a test request.
- [ ] First encrypted backup in R2; restore drill passed into a scratch DB.
- [ ] Sentry captures a forced error with no PII; PostHog receives an event with no names or text.
- [ ] Deploy and rollback each performed once on the real VM.
- [ ] Printed runbook (this document §8) at the desk.
- [ ] Privacy page live; pilot terms name the processors.

---

**Previous:** [04 — Security & Privacy](./04-security-and-privacy.md) · **Next:** [06 — ADR Register](./06-adr-register.md)
