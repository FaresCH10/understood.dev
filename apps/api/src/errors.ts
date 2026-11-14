import { ERROR_MESSAGES, ERROR_STATUS, type ErrorCode } from '@understood/shared';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Array<{ field: string; issue: string }>;

  constructor(code: ErrorCode, details?: Array<{ field: string; issue: string }>) {
    super(ERROR_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }
}

export function assert(condition: unknown, code: ErrorCode): asserts condition {
  if (!condition) throw new AppError(code);
}
