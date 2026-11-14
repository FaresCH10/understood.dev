import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, stat, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import { createGunzip } from 'node:zlib';

const MAGIC = Buffer.from('UDBK1');

export function backupKey() {
  const raw = process.env.BACKUP_ENCRYPTION_KEY ?? '';
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32 || !/^[A-Za-z0-9+/]{43}=$/.test(raw)) throw new Error('BACKUP_ENCRYPTION_KEY must be a base64-encoded random 32-byte key, stored separately from the backup.');
  return key;
}

export function loadBackupEnvironment() {
  const file = process.env.BACKUP_ENV_FILE ?? '.env.production';
  try { process.loadEnvFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export function databaseFromUri(uri) {
  const name = decodeURIComponent(uri.replace(/^mongodb(?:\+srv)?:\/\//, '').split('/')[1]?.split('?')[0] ?? '');
  if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error('Backup/restore URIs must specify a database name using letters, digits, underscores or hyphens.');
  return name;
}

export function mongoTool(tool, uri) {
  const args = tool === 'mongodump' ? ['--archive', '--gzip'] : ['--archive', '--gzip', '--stopOnError'];
  const targetDatabase = databaseFromUri(uri);
  if (tool === 'mongodump') {
    args.push(`--db=${targetDatabase}`);
  } else {
    const sourceDatabase = process.env.BACKUP_SOURCE_DATABASE ?? databaseFromUri(process.env.MONGODB_URI ?? '');
    if (!/^[A-Za-z0-9_-]+$/.test(sourceDatabase) || sourceDatabase === targetDatabase) throw new Error('Restore requires a different scratch database name. Set BACKUP_SOURCE_DATABASE to the database used when the archive was made.');
    args.push(`--nsInclude=${sourceDatabase}.*`, `--nsFrom=${sourceDatabase}.*`, `--nsTo=${targetDatabase}.*`);
  }
  const envName = tool === 'mongodump' ? 'MONGODB_URI' : 'RESTORE_MONGODB_URI';
  // Pass the URI through an environment variable; never interpolate its value into shell text.
  if (process.env.MONGODB_TOOLS_DRIVER === 'native') {
    return spawn(tool, [`--uri=${uri}`, ...args], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  }
  if (process.env.MONGODB_TOOLS_CONTAINER) {
    return spawn('docker', ['exec', '-i', '-e', envName, process.env.MONGODB_TOOLS_CONTAINER, 'sh', '-c',
      `exec ${tool} --uri="$${envName}" "$@"`, 'mongo-tool', ...args],
      { env: { ...process.env, [envName]: uri }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  }
  return spawn('docker', ['run', '--rm', '-i', '--network', 'host', '-e', envName, 'mongo:7', 'sh', '-c',
    `exec ${tool} --uri="$${envName}" "$@"`, 'mongo-tool', ...args],
    { env: { ...process.env, [envName]: uri }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
}

export function completed(child) {
  // Database tools may include connection details in errors; return only the exit code.
  child.stderr.resume();
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`MongoDB tool exited with code ${code}. Check database access and tool availability.`)));
  });
}

export async function encryptBackup(source, destination, key) {
  await mkdir(dirname(destination), { recursive: true });
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const out = createWriteStream(destination, { flags: 'wx', mode: 0o600 });
  out.write(Buffer.concat([MAGIC, iv]));
  await pipeline(source, cipher, out);
  await appendFile(destination, cipher.getAuthTag());
}

export async function decryptedBackup(file, key) {
  const size = (await stat(file)).size;
  if (size < MAGIC.length + 12 + 16 + 1) throw new Error('Backup is truncated.');
  const handle = await open(file, 'r');
  const header = Buffer.alloc(MAGIC.length + 12);
  const tag = Buffer.alloc(16);
  try {
    await handle.read(header, 0, header.length, 0);
    await handle.read(tag, 0, tag.length, size - tag.length);
  } finally { await handle.close(); }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Unknown backup format.');
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(MAGIC.length));
  decipher.setAuthTag(tag);
  return { source: createReadStream(file, { start: header.length, end: size - tag.length - 1 }), decipher };
}

export async function verifyBackup(file, key) {
  const { source, decipher } = await decryptedBackup(file, key);
  await pipeline(source, decipher, createGunzip(), new Writable({ write(_chunk, _encoding, callback) { callback(); } }));
}
