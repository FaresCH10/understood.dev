import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDevDefaults, replicaSetError } from './dev-config.mjs';

test('no-config development uses an isolated replica set and exports matching API settings', () => {
  const env = {};
  applyDevDefaults(env);
  assert.equal(env.MONGODB_URI, 'mongodb://127.0.0.1:27018/understood?replicaSet=rs0');
  assert.equal(env.PORT, '4000');
  assert.equal(env.APP_URL, 'http://localhost:5173');
  assert.equal(env.PROCESS_ROLE, 'both');
});

test('explicit database and runtime settings remain authoritative', () => {
  const env = { MONGODB_URI: 'mongodb://db:27017/pilot?replicaSet=pilot', PORT: '4100', APP_URL: 'https://example.com', PROCESS_ROLE: 'api' };
  const original = { ...env };
  applyDevDefaults(env);
  assert.deepEqual(env, original);
});

test('standalone MongoDB gives an actionable error without masking other failures', () => {
  const error = Object.assign(new Error('This node was not started with replication enabled.'), { code: 76 });
  const result = replicaSetError(error, 27017);
  assert.match(result.message, /port 27017.*without replication/);
  assert.match(result.message, /27018/);
  assert.equal(result.cause, error);
  const denied = new Error('Authentication failed');
  assert.equal(replicaSetError(denied, 27017), denied);
});
