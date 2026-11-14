import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config, encryptionKey } from '../config.js';

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacHex(pepper: string, value: string): string {
  return createHmac('sha256', pepper).update(value).digest('hex');
}

export function tokenHash(token: string): string {
  return hmacHex(config.TOKEN_PEPPER, token);
}

export function encryptedSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptSecret(envelope: string): string {
  const [version, ivB64, tagB64, cipherB64] = envelope.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !cipherB64) throw new Error('invalid secret envelope');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(cipherB64, 'base64')), decipher.final()]).toString('utf8');
}

export interface PreviewPayload {
  instructionId: string;
  exp: number;
  kind: 'preview';
}

export function signPreviewToken(instructionId: string, ttlMinutes: number): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  const payload: PreviewPayload = {
    instructionId,
    exp: Math.floor(expiresAt.getTime() / 1000),
    kind: 'preview',
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', config.TOKEN_PEPPER).update(encoded).digest('base64url');
  return { token: `${encoded}.${signature}`, expiresAt };
}

export function verifyPreviewToken(token: string): PreviewPayload | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = createHmac('sha256', config.TOKEN_PEPPER).update(encoded).digest();
  const provided = Buffer.from(signature, 'base64url');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as PreviewPayload;
    if (payload.kind !== 'preview' || !payload.instructionId) return null;
    if (!Number.isInteger(payload.exp) || payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
