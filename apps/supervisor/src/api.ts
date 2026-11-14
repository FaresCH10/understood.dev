export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Array<{ field: string; issue: string }>;

  constructor(status: number, code: string, message: string, details?: Array<{ field: string; issue: string }>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface Envelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

type Init = Omit<RequestInit, 'body'> & { body?: unknown };

export async function api<T>(path: string, init: Init = {}): Promise<{ data: T; meta: Record<string, unknown> }> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  let body: BodyInit | undefined;
  if (init.body instanceof FormData) {
    body = init.body;
  } else if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }

  const response = await fetch(path, { credentials: 'same-origin', ...init, headers, body });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: Array<{ field: string; issue: string }> } } | null)?.error;
    throw new ApiError(response.status, error?.code ?? 'INTERNAL', error?.message ?? `Request failed (${response.status})`, error?.details);
  }

  const envelope = (payload ?? { data: null }) as Envelope<T>;
  return { data: envelope.data, meta: envelope.meta ?? {} };
}

export async function download(path: string, filename: string): Promise<void> {
  const response = await fetch(path, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new ApiError(response.status, 'INTERNAL', 'Export failed.');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
