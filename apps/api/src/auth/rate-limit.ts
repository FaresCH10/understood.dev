import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { getKv } from '../stores/kv.js';

export interface RateLimitOptions {
  bucket: string;
  limit: number;
  windowSeconds: number;
  key?: (req: Request) => string;
}

export function rateLimit(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!config.RATE_LIMIT_ENABLED) return next();
    try {
      const identity = options.key ? options.key(req) : req.ip ?? 'unknown';
      const windowStart = Math.floor(Date.now() / 1000 / options.windowSeconds);
      const key = `rl:${options.bucket}:${identity}:${windowStart}`;
      const count = await getKv().incr(key, options.windowSeconds);
      const reset = (windowStart + 1) * options.windowSeconds;
      res.setHeader('RateLimit-Limit', String(options.limit));
      res.setHeader('RateLimit-Remaining', String(Math.max(0, options.limit - count)));
      res.setHeader('RateLimit-Reset', String(reset));
      if (count > options.limit) {
        res.setHeader('Retry-After', String(Math.max(1, reset - Math.floor(Date.now() / 1000))));
        return next(new AppError('RATE_LIMITED'));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function byIp(req: Request): string {
  return req.ip ?? 'unknown';
}
