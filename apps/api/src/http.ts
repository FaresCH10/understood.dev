import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { AppError } from './errors.js';
import { logger } from './logger.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const valid = incoming && /^[A-Za-z0-9_-]{8,64}$/.test(incoming);
  req.requestId = valid ? incoming : `req_${randomBytes(16).toString('base64url')}`;
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function parseBody<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  return parseWith(schema, req.body);
}

export function routeParam(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.length === 0) throw new AppError('NOT_FOUND');
  return value;
}

export function parseQuery<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  return parseWith(schema, req.query);
}

function parseWith<T extends ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value ?? {});
  if (!result.success) throw new AppError('VALIDATION_FAILED', zodDetails(result.error));
  return result.data;
}

export function zodDetails(error: ZodError): Array<{ field: string; issue: string }> {
  return error.issues.slice(0, 20).map((issue) => ({
    field: issue.path.join('.') || 'body',
    issue: issue.message,
  }));
}

export function sendData(res: Response, data: unknown, meta?: unknown, status = 200): void {
  const body: Record<string, unknown> = { data };
  if (meta !== undefined) body.meta = meta;
  res.status(status).json(body);
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError('NOT_FOUND'));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let error: AppError;

  if (err instanceof AppError) {
    error = err;
  } else if (err instanceof ZodError) {
    error = new AppError('VALIDATION_FAILED', zodDetails(err));
  } else if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    error = new AppError('MALFORMED_JSON');
  } else if (err instanceof Error && err.name === 'CastError') {
    error = new AppError('NOT_FOUND');
  } else if (err instanceof Error && err.name === 'MulterError') {
    const code = (err as Error & { code?: string }).code;
    error = new AppError(code === 'LIMIT_FILE_SIZE' ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_FAILED');
  } else {
    logger.error({ err: err instanceof Error ? err.message : String(err), requestId: req.requestId }, 'unhandled error');
    error = new AppError('INTERNAL');
  }

  if (res.headersSent) return;

  res.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    requestId: req.requestId,
  });
}
