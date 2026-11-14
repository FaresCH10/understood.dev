import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const COST = 32768;
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, { N: COST, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error); else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt-v1:${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string | null | undefined): Promise<boolean> {
  const [version, saltHex, keyHex] = (encoded ?? '').split(':');
  const valid = version === 'scrypt-v1' && /^[a-f0-9]{32}$/.test(saltHex ?? '') && /^[a-f0-9]{128}$/.test(keyHex ?? '');
  const key = await derive(password, valid ? Buffer.from(saltHex!, 'hex') : Buffer.alloc(16));
  return Boolean(valid && timingSafeEqual(key, Buffer.from(keyHex!, 'hex')));
}
