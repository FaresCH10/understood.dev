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

type Init = Omit<RequestInit, 'body'> & {
  body?: unknown;
  retryOnUnavailable?: boolean;
};

type ErrorPayload = { code?: string; message?: string; details?: Array<{ field: string; issue: string }> };

async function parsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function api<T>(path: string, init: Init = {}): Promise<{ data: T; meta: Record<string, unknown> }> {
  const { retryOnUnavailable = false, ...request } = init;
  const headers: Record<string, string> = { ...(request.headers as Record<string, string> | undefined) };
  let body: BodyInit | undefined;
  if (request.body instanceof FormData) {
    body = request.body;
  } else if (request.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(request.body);
  }

  let response = await fetch(path, { credentials: 'same-origin', ...request, headers, body });
  let payload = await parsePayload(response);
  let error = (payload as { error?: ErrorPayload } | null)?.error;

  // A bare 5xx without our JSON envelope comes from the proxy or gateway, not
  // the API; callers opt in only for requests that are safe to repeat.
  if (!response.ok && retryOnUnavailable && response.status >= 500 && !error) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    response = await fetch(path, { credentials: 'same-origin', ...request, headers, body });
    payload = await parsePayload(response);
    error = (payload as { error?: ErrorPayload } | null)?.error;
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      error?.code ?? 'INTERNAL',
      error?.message ?? (response.status >= 500 ? 'The server is unavailable. Please try again.' : `Request failed (${response.status})`),
      error?.details,
    );
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
