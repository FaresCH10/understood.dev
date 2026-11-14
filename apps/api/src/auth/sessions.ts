import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { config, isProduction } from '../config.js';
import { getKv } from '../stores/kv.js';
import { randomToken, tokenHash } from './tokens.js';

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const REFRESH_INTERVAL_MS = 60 * 1000;

export const SESSION_COOKIE = isProduction ? '__Host-u_session' : 'u_session';

export interface SessionData {
  userId: string;
  orgId: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface AuthContext {
  userId: string;
  orgId: string;
  sessionHash: string;
  expiresInSeconds: number;
}

function sessionKey(hash: string): string {
  return `sess:${hash}`;
}

export async function createSession(userId: Types.ObjectId | string, orgId: Types.ObjectId | string): Promise<string> {
  const token = randomToken(32);
  const hash = tokenHash(token);
  const now = new Date().toISOString();
  const data: SessionData = {
    userId: String(userId),
    orgId: String(orgId),
    createdAt: now,
    lastSeenAt: now,
  };
  const kv = getKv();
  await kv.set(sessionKey(hash), JSON.stringify(data), SESSION_TTL_SECONDS);
  await kv.sadd(`us:${String(userId)}`, hash, SESSION_TTL_SECONDS);
  return token;
}

export async function readSession(token: string): Promise<{ auth: AuthContext; data: SessionData } | null> {
  const kv = getKv();
  const hash = tokenHash(token);
  const raw = await kv.get(sessionKey(hash));
  if (!raw) return null;

  let data: SessionData;
  try {
    data = JSON.parse(raw) as SessionData;
  } catch {
    await kv.del(sessionKey(hash));
    return null;
  }

  const lastSeen = new Date(data.lastSeenAt).getTime();
  if (Date.now() - lastSeen > REFRESH_INTERVAL_MS) {
    data.lastSeenAt = new Date().toISOString();
    await Promise.all([
      kv.set(sessionKey(hash), JSON.stringify(data), SESSION_TTL_SECONDS),
      kv.sadd(`us:${data.userId}`, hash, SESSION_TTL_SECONDS),
    ]);
  }

  return {
    auth: { userId: data.userId, orgId: data.orgId, sessionHash: hash, expiresInSeconds: SESSION_TTL_SECONDS },
    data,
  };
}

export async function destroySession(token: string, userId: string): Promise<void> {
  const kv = getKv();
  const hash = tokenHash(token);
  await kv.del(sessionKey(hash));
  await kv.srem(`us:${userId}`, hash);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  const kv = getKv();
  const hashes = await kv.smembers(`us:${userId}`);
  await Promise.all(hashes.map((hash) => kv.del(sessionKey(hash))));
  await kv.del(`us:${userId}`);
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' });
}

export function sessionCookie(req: Request): string | null {
  const value = req.cookies?.[SESSION_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function sessionTtl(): number {
  return SESSION_TTL_SECONDS;
}

export const appUrl = config.APP_URL;
