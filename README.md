# Understood

Understood is a multilingual instruction and team coordination application for frontline workplaces. Supervisors prepare and review instructions; workers respond or acknowledge receipt, ask for help, and separately mark work complete. Answer matching is evidence of a submitted response, not a certification of understanding, work quality or safety.

This repository contains a TypeScript npm-workspaces monorepo: `apps/api` (Express/MongoDB/Redis), `apps/supervisor` (React/Vite), `apps/worker` (React/Vite), and shared language/schema/design packages. The original standalone visual prototype is in `design/prototype`.

## Development

Use Node **24 LTS** and npm. Node 20 is no longer the deployment runtime. Install Docker Desktop/Engine and start it, or provide a transaction-capable MongoDB replica set and Redis independently.

```powershell
$env:MONGOMS_DISABLE_POSTINSTALL='true'
npm ci
docker compose -f compose.dev.yml up -d mongo mongo-init redis
Copy-Item apps/api/.env.example apps/api/.env
npm run dev
```

The Mongo replica set advertises `localhost:27017` for applications running on the host. The optional containerized API profile uses `directConnection=true` to connect through the Docker service name. Redis and Mongo ports bind only to loopback. The API profile is intentionally not started by default, avoiding a second API competing with `npm run dev`.

Supervisor: `http://localhost:5173`. Worker pages: the same origin under `/i/`. API: `http://localhost:4000`. The development script prints a single-use sign-in link; `npm run signin` creates another. Demo seeding is for a local database only. Do not use the example keys on a public service.

Mock AI is the default for development. It returns a fixed example and synthetic audio bytes; it is not a functional translator. Live mode needs configured Groq and Azure Speech credentials. DeepL is optional. Worker interface locales and actual provider/voice capabilities are separate; validate the languages required by your crews.

## Verification

```powershell
npm run typecheck
npm run build
npm run test:unit
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=rs0'
npm test
```

The integration suite uses an isolated randomly named database and drops only that test database. Without `TEST_MONGODB_URI`, it falls back to mongodb-memory-server, which may download a large platform-specific MongoDB binary. Using the Docker replica set avoids that download. CI runs a real MongoDB replica set on Node 24. Application tests use mock external providers; live provider, accessibility and physical-device acceptance tests still require their own verification.

## Production deployment

Copy `production.env.example` to `.env.production` on the deployment host. Configure HTTPS domain/DNS, real independent random secrets, MongoDB replica-set access, private R2 storage, a verified Resend sender, and live AI credentials. The platform operator token is optional and has no default; keep it off clients. VAPID browser-push settings are optional, and must be supplied together.

```sh
docker compose -f compose.prod.yml --env-file .env.production up -d redis
docker compose -f compose.prod.yml --env-file .env.production run --rm --no-deps api node dist/ensure-indexes.js
docker compose -f compose.prod.yml --env-file .env.production up -d api pipeline caddy
```

Before starting Caddy, place built frontend files in `releases/current/supervisor` and `releases/current/worker`, or set `RELEASE_SHA` to the version directory containing them. An image must be built/pulled before these commands; `IMAGE` selects it. `npm run db:indexes` is the equivalent source-side index provisioning command. Index creation does not drop old indexes. Duplicate data that conflicts with a required unique index stops the deployment and must be reconciled deliberately.

The API and background consumer run separately. The worker eagerly connects its queue and publishes `worker:heartbeat` to Redis; the API's `/healthz` alone is insufficient proof of a completed instruction. Production verification must include generation, worker response, help follow-up, media playback, and export. Local media is HMAC-signed with enforced expiry and uses a shared volume across both services. R2 is the preferred durable deployment storage. R2 bucket CORS must permit the app origin's supported media requests.

GitHub Actions verifies before building images, builds ARM64 and AMD64, uploads immutable frontend release directories, provisions indexes, and switches the containers. Failed smoke checks restore the previous image/static release when a previous release exists. Retain previous releases for rollback. Configure the `production` environment protection rules and repository deployment secrets (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`, `DOMAIN`, and a read token for private GHCR images). Nothing deploys from a local build alone.

## Backup and recovery

`npm run backup` streams a database-specific gzip archive through AES-256-GCM encryption, authenticates/decompresses it for verification, and writes a mode-600 `.data/backups/*.archive.aes` file. Generate a dedicated base64 32-byte `BACKUP_ENCRYPTION_KEY`; store that key separately. `BACKUP_ENV_FILE` can select a secret environment file (default `.env.production`). Copy the encrypted archive to private off-site storage and apply an explicit retention policy there. R2 media objects require their own versioned backup; the database archive does not contain uploaded files.

The default MongoDB tools driver is `docker run mongo:7` with Linux host networking. If MongoDB Database Tools are installed directly, set `MONGODB_TOOLS_DRIVER=native`. For an existing trusted Mongo container, `MONGODB_TOOLS_CONTAINER=<container-name>` uses its tools via `docker exec`; its URI must be reachable inside that container. This is useful on Docker Desktop where host networking may be disabled.

```sh
npm run backup -- /secure/backups/understood.archive.aes
npm run restore -- /secure/backups/understood.archive.aes --verify
```

A real restore drill needs a separate empty scratch database. Set `BACKUP_SOURCE_DATABASE` to the original database name and `RESTORE_MONGODB_URI` to a different database name, then run:

```sh
npm run restore -- /secure/backups/understood.archive.aes --confirm-restore
```

The restore authenticates the entire archive before sending bytes to MongoDB and remaps namespaces to the scratch database. It does not use `--drop`, and refuses the source database name. Compare source/restored collection counts and inspect example instruction/response records, then test media accessibility before any recovery cutover. Do not call a restore successful merely because encryption verification passed. No automatic production recovery or off-site backup is implied by these scripts.

## Product and release evidence

The product, architecture and validation folders include planning material, not proof of production deployment or customer traction. `PROJECT_REVIEW.md` records the original imported snapshot and should be read as historical review, not the current change log. A release requires the new behavior's tests plus real provider/device checks and a demonstrated backup restore. Keep secrets, worker data, recordings and backups out of Git.
