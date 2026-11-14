export const ERROR_STATUS = {
  VALIDATION_FAILED: 400,
  MALFORMED_JSON: 400,
  WORKER_NOT_IN_AUDIENCE: 400,
  TRANSCRIPT_UNCONFIRMED: 400,
  AUTH_REQUIRED: 401,
  SESSION_EXPIRED: 401,
  DELIVERY_TOKEN_INVALID: 401,
  FORBIDDEN: 403,
  PREVIEW_MODE: 403,
  NOT_FOUND: 404,
  IMPORT_INVALID: 409,
  IMPORT_ALREADY_COMMITTED: 409,
  WORKER_LIMIT_REACHED: 409,
  CONFLICT_STATE: 409,
  INSTRUCTION_NOT_READY: 409,
  LANGUAGE_UNAVAILABLE: 409,
  SHARE_CONFLICT: 409,
  ATTEMPTS_EXHAUSTED: 409,
  DELIVERY_COMPLETED: 409,
  PIPELINE_FAILED: 409,
  LINK_UNAVAILABLE: 410,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA: 415,
  RATE_LIMITED: 429,
  IDEMPOTENCY_CONFLICT: 409,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'The request contains invalid fields.',
  MALFORMED_JSON: 'The request body could not be parsed.',
  WORKER_NOT_IN_AUDIENCE: 'This worker is not part of this instruction.',
  TRANSCRIPT_UNCONFIRMED: 'Confirm the transcript before generating.',
  AUTH_REQUIRED: 'Sign in to continue.',
  SESSION_EXPIRED: 'Your session has expired. Sign in again.',
  DELIVERY_TOKEN_INVALID: 'This device is no longer linked. Open the crew link again.',
  FORBIDDEN: 'You do not have access to this resource.',
  PREVIEW_MODE: 'Preview is read-only.',
  NOT_FOUND: 'Not found.',
  IMPORT_INVALID: 'Fix the import errors before committing.',
  IMPORT_ALREADY_COMMITTED: 'This import has already been committed.',
  WORKER_LIMIT_REACHED: 'This organization has reached its worker limit.',
  CONFLICT_STATE: 'This action is not available in the current state.',
  INSTRUCTION_NOT_READY: 'The instruction is not ready to share.',
  LANGUAGE_UNAVAILABLE: 'That language is not available for this instruction.',
  SHARE_CONFLICT: 'This instruction was already shared. Use the existing link.',
  ATTEMPTS_EXHAUSTED: 'You have used both attempts for this instruction.',
  DELIVERY_COMPLETED: 'This instruction is already complete.',
  PIPELINE_FAILED: 'Generation failed for this language.',
  LINK_UNAVAILABLE: 'This link is no longer available.',
  PAYLOAD_TOO_LARGE: 'The file is too large.',
  UNSUPPORTED_MEDIA: 'That file type is not supported.',
  RATE_LIMITED: 'Too many requests. Try again shortly.',
  IDEMPOTENCY_CONFLICT: 'The request conflicts with an earlier request.',
  INTERNAL: 'Something went wrong. Try again.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable.',
};

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Array<{ field: string; issue: string }>;
  };
  requestId: string;
}
