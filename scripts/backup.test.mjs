import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { encryptBackup, verifyBackup, databaseFromUri } from './backup-lib.mjs';

test('encrypted backups authenticate correctly and reject tampering, wrong keys and truncated files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'understood-backup-test-'));
  try {
    const file = join(directory, 'sample.aes');
    const key = randomBytes(32);
    await encryptBackup(Readable.from(gzipSync(Buffer.from('example MongoDB archive data'))), file, key);
    await verifyBackup(file, key);
    await assert.rejects(verifyBackup(file, randomBytes(32)));
    const encrypted = await readFile(file);
    assert.equal(encrypted.includes(Buffer.from('example MongoDB archive data')), false);
    encrypted[encrypted.length - 1] ^= 1;
    await writeFile(file, encrypted);
    await assert.rejects(verifyBackup(file, key));
    await writeFile(file, encrypted.subarray(0, 8));
    await assert.rejects(verifyBackup(file, key));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('backup database selection rejects missing names and shell-like database text', () => {
  assert.equal(databaseFromUri('mongodb://user:pass@localhost:27017/understood?replicaSet=rs0'), 'understood');
  assert.equal(databaseFromUri('mongodb+srv://host/understood-restore'), 'understood-restore');
  assert.throws(() => databaseFromUri('mongodb://host/'));
  assert.throws(() => databaseFromUri('mongodb://host/db%20--drop'));
});
