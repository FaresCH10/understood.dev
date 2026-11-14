#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDevDefaults, replicaSetError } from './dev-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const npm = 'npm';

try {
  process.loadEnvFile(path.join(root, 'apps/api/.env'));
} catch {
  console.log('[env] apps/api/.env not found — using local development defaults');
}

applyDevDefaults(process.env);
const MONGO_URI = process.env.MONGODB_URI;
const API_PORT = Number(process.env.PORT ?? 4000);
const API_URL = `http://localhost:${API_PORT}`;
const SUPERVISOR_URL = 'http://localhost:5173';
const WORKER_PORT = 5174;
const DEMO_EMAIL = 'owner@demo.understood.local';

const mongoTarget = parseMongoTarget(MONGO_URI);
const localMongo = ['127.0.0.1', 'localhost'].includes(mongoTarget.host);

const requireApi = createRequire(path.join(root, 'apps/api/package.json'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const services = [];
let mongoProcess = null;
let shuttingDown = false;

function parseMongoTarget(uri) {
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?([^/?]+)/);
  const hostPort = (match?.[1] ?? '127.0.0.1:27017').split(',')[0];
  const [host, port] = hostPort.split(':');
  return { host: host || '127.0.0.1', port: Number(port || 27017) };
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function waitForPort(port, label, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isPortOpen(port)) return;
    await sleep(300);
  }
  throw new Error(`${label} did not start on port ${port}.`);
}

async function waitForHttp(url, label, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not ready yet
    }
    await sleep(300);
  }
  throw new Error(`${label} did not respond at ${url}.`);
}

function findMongod() {
  if (process.env.MONGOD_BIN && fs.existsSync(process.env.MONGOD_BIN)) return process.env.MONGOD_BIN;
  const cacheDirs = [
    path.join(root, '.data', 'mongodb-binaries'),
    path.join(root, 'node_modules', '.cache', 'mongodb-memory-server'),
    path.join(root, 'apps', 'api', 'node_modules', '.cache', 'mongodb-memory-server'),
  ];
  for (const cacheDir of cacheDirs) {
    if (!fs.existsSync(cacheDir)) continue;
    const candidates = fs
      .readdirSync(cacheDir)
      .filter((name) => /^mongod/i.test(name) && !/\.(md5|lock|downloading)$/i.test(name))
      .sort()
      .reverse();
    for (const name of candidates) {
      const full = path.join(cacheDir, name);
      if (fs.statSync(full).isFile()) return full;
    }
  }
  const probe = spawnSync(isWin ? 'where' : 'which', ['mongod'], { encoding: 'utf8' });
  const found = probe.status === 0 ? probe.stdout.split(/\r?\n/).find(Boolean) : null;
  return found && fs.existsSync(found.trim()) ? found.trim() : null;
}

async function ensureReplicaSet() {
  const mongoose = requireApi('mongoose');
  const adminUri = `mongodb://${mongoTarget.host}:${mongoTarget.port}/admin?directConnection=true`;
  await mongoose.connect(adminUri, { serverSelectionTimeoutMS: 10_000 });
  try {
    try {
      await mongoose.connection.db.admin().command({
        replSetInitiate: {
          _id: 'rs0',
          members: [{ _id: 0, host: `${mongoTarget.host}:${mongoTarget.port}` }],
        },
      });
      console.log('[db] initialized replica set "rs0"');
    } catch (error) {
      if (error?.codeName !== 'AlreadyInitialized') throw replicaSetError(error, mongoTarget.port);
    }
    const started = Date.now();
    while (Date.now() - started < 20_000) {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      if (hello.isWritablePrimary) return;
      await sleep(300);
    }
    throw new Error('MongoDB replica set did not become primary.');
  } finally {
    await mongoose.disconnect();
  }
}

async function ensureMongo() {
  if (!localMongo) return;
  if (!(await isPortOpen(mongoTarget.port))) {
    const bin = findMongod();
    if (!bin) {
      throw new Error(
        'MongoDB was not found. Install MongoDB, or point MONGODB_URI in apps/api/.env at a free Atlas cluster.',
      );
    }
    const dbPath = path.join(root, '.data', 'db-dev');
    fs.mkdirSync(dbPath, { recursive: true });
    console.log('[db] starting MongoDB (replica set rs0)...');
    mongoProcess = spawn(
      bin,
      [
        '--replSet', 'rs0',
        '--dbpath', dbPath,
        '--port', String(mongoTarget.port),
        '--bind_ip', '127.0.0.1',
        '--logpath', path.join(root, '.data', 'mongod-dev.log'),
      ],
      { stdio: 'ignore' },
    );
    mongoProcess.on('exit', (code) => {
      if (!shuttingDown) console.log(`[db] mongod exited (code ${code}).`);
    });
    await waitForPort(mongoTarget.port, 'MongoDB');
  }
  await ensureReplicaSet();
}

async function ensureDemoUser() {
  const mongoose = requireApi('mongoose');
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  let exists = false;
  try {
    exists = (await mongoose.connection.db.collection('users').countDocuments({ email: DEMO_EMAIL, passwordHash: { $exists: true } })) > 0;
  } finally {
    await mongoose.disconnect();
  }
  if (exists) return null;

  console.log('[seed] first run — creating demo data...');
  const result = spawnSync(npm, ['run', 'seed', '--workspace', '@understood/api'], {
    cwd: root,
    shell: isWin,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`Demo seed failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.match(/Worker link:\s*(\S+)/)?.[1] ?? null;
}

function startService(name, args) {
  const child = spawn(npm, args, { cwd: root, shell: isWin, env: process.env });
  services.push(child);
  const prefix = `[${name}] `;
  const pipe = (stream) => {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) console.log(prefix + line);
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`\n[${name}] stopped unexpectedly (exit ${code}).`);
      shutdown(code || 1);
    }
  });
  return child;
}

function createSignInLink() {
  const result = spawnSync(
    npm,
    ['run', 'dev:login', '--workspace', '@understood/api'],
    { cwd: root, shell: isWin, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    console.warn('[login] could not create a sign-in link:', (result.stderr || result.stdout).trim());
    return null;
  }
  return result.stdout.match(/https?:\/\/\S+token=\S+/)?.[0] ?? null;
}

function killTree(child) {
  if (!child || child.killed) return;
  if (isWin && child.pid) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nStopping...');
  for (const child of services) killTree(child);
  killTree(mongoProcess);
  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  console.log('Starting Understood (dev)...\n');

  for (const [port, name] of [
    [API_PORT, 'API'],
    [5173, 'supervisor'],
    [WORKER_PORT, 'worker app'],
  ]) {
    if (await isPortOpen(port)) {
      console.error(`Port ${port} (${name}) is already in use.`);
      console.error(`The app may already be running — open ${SUPERVISOR_URL}, or stop the old process and retry.`);
      process.exit(1);
    }
  }

  await ensureMongo();
  const seededWorkerUrl = await ensureDemoUser();

  startService('api', ['run', 'dev', '--workspace', '@understood/api']);
  startService('web', ['run', 'dev', '--workspace', '@understood/supervisor']);
  startService('worker', ['run', 'dev', '--workspace', '@understood/worker']);

  await waitForHttp(`${API_URL}/healthz`, 'API');
  await waitForHttp(`${SUPERVISOR_URL}/`, 'Supervisor');
  await waitForHttp(`http://localhost:${WORKER_PORT}/i/`, 'Worker app');

  const signInUrl = createSignInLink();

  console.log(`\n${'='.repeat(64)}`);
  console.log(' Understood is running');
  console.log('='.repeat(64));
  console.log(` Homepage   : ${SUPERVISOR_URL}`);
  console.log(` Sign in    : ${SUPERVISOR_URL}/signin`);
  console.log(` Worker app : ${SUPERVISOR_URL}/i/`);
  if (seededWorkerUrl) console.log(` Demo worker: ${seededWorkerUrl}`);
  if (signInUrl) {
    console.log('\n Sign in (single use, 15 minutes):');
    console.log(` ${signInUrl}`);
  }
  console.log(`\n Demo email : ${DEMO_EMAIL}`);
  console.log(` Demo password: ${process.env.DEMO_PASSWORD ?? 'Understood-demo-2026!'}`);
  console.log(' Worker company: understood-demo | IDs: W001, W002, W003 | same demo password');
  console.log(' Stop       : press Ctrl+C');
  console.log(`${'='.repeat(64)}\n`);
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  shutdown(1);
});
