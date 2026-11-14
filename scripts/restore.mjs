import { resolve } from 'node:path';
import { createReadStream } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { backupKey, completed, decryptedBackup, loadBackupEnvironment, mongoTool, verifyBackup } from './backup-lib.mjs';

loadBackupEnvironment();
const args = process.argv.slice(2);
const fileArg = args.find((arg) => !arg.startsWith('--'));
if (!fileArg) throw new Error('Usage: npm run restore -- <backup.archive.aes> --verify OR --confirm-restore');
const file = resolve(fileArg);
const key = backupKey();
await verifyBackup(file, key);
if (args.includes('--verify')) {
  console.log('Backup authentication and gzip integrity verified. No database was changed.');
  process.exit(0);
}
if (!args.includes('--confirm-restore')) throw new Error('Specify --confirm-restore only after setting RESTORE_MONGODB_URI to an empty scratch database.');
const uri = process.env.RESTORE_MONGODB_URI;
if (!uri || uri === process.env.MONGODB_URI) throw new Error('RESTORE_MONGODB_URI must name a separate empty scratch database.');
// Fully authenticate before the database receives any data; GCM authenticates only at EOF.
const directory = await mkdtemp(join(tmpdir(), 'understood-restore-'));
const plain = join(directory, 'archive.gz');
try {
  const { source, decipher } = await decryptedBackup(file, key);
  await pipeline(source, decipher, createWriteStream(plain, { mode: 0o600 }));
  const child = mongoTool('mongorestore', uri);
  const exit = completed(child);
  child.stdout.resume();
  await Promise.all([pipeline(createReadStream(plain), child.stdin), exit]);
  console.log('Restore completed. Compare collection counts and inspect records in the scratch database before any recovery cutover.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
