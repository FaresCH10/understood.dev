import { resolve } from 'node:path';
import { unlink } from 'node:fs/promises';
import { backupKey, completed, encryptBackup, loadBackupEnvironment, mongoTool, verifyBackup } from './backup-lib.mjs';

loadBackupEnvironment();
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required.');
const key = backupKey();
const destination = resolve(process.argv[2] ?? `.data/backups/${new Date().toISOString().replace(/[:.]/g, '-')}.archive.aes`);
const child = mongoTool('mongodump', uri);
const exit = completed(child);
child.stdin.end();
try {
  await Promise.all([encryptBackup(child.stdout, destination, key), exit]);
  await verifyBackup(destination, key);
  console.log(`Encrypted database backup verified: ${destination}`);
  console.log('Copy the encrypted file to private off-site storage. Media objects need their own versioned backup.');
} catch (error) {
  child.kill();
  await unlink(destination).catch(() => {});
  throw error;
}
