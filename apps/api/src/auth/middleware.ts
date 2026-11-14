import type { NextFunction, Request, Response } from 'express';
import { appOrigin, config } from '../config.js';
import { AppError } from '../errors.js';
import { sessionCookie, readSession, type AuthContext } from './sessions.js';
import { requireStaff } from '../modules/access/control.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export async function attachSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = sessionCookie(req);
    if (token) {
      const session = await readSession(token);
      if (session) req.auth = session.auth;
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) return next(new AppError('AUTH_REQUIRED'));
  try { await requireStaff(req); next(); } catch (error) { next(error); }
}

export function requireSameOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.header('origin');
  if (!origin) return next();
  if (origin !== appOrigin()) return next(new AppError('FORBIDDEN'));
  next();
}

export function isSecureRequest(): boolean {
  return new URL(config.APP_URL).protocol === 'https:';
}
