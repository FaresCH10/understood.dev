import type { Request } from 'express';
import { AppError } from '../../errors.js';
import { sha256Hex } from '../../auth/tokens.js';
import { getKv } from '../../stores/kv.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TTL_SECONDS = 24 * 60 * 60;

interface StoredResponse {
  requestHash: string;
  status: number;
  body: unknown;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

export interface IdempotencySlot {
  key: string;
  requestHash: string;
  cached: { status: number; body: unknown } | null;
}

export async function beginIdempotent(
  req: Request,
  scope: string,
  payload: unknown,
): Promise<IdempotencySlot> {
  const raw = req.header('idempotency-key')?.trim() ?? '';
  if (!UUID_V4.test(raw)) {
    throw new AppError('VALIDATION_FAILED', [
      { field: 'Idempotency-Key', issue: 'a UUID v4 header is required on worker mutations' },
    ]);
  }

  const key = `idem:${scope}:${raw.toLowerCase()}`;
  const requestHash = sha256Hex(stableStringify(payload));
  const stored = await getKv().get(key);
  if (!stored) return { key, requestHash, cached: null };

  let record: StoredResponse;
  try {
    record = JSON.parse(stored) as StoredResponse;
  } catch {
    return { key, requestHash, cached: null };
  }
  if (record.requestHash !== requestHash) throw new AppError('IDEMPOTENCY_CONFLICT');
  return { key, requestHash, cached: { status: record.status, body: record.body } };
}

export async function finishIdempotent(
  slot: IdempotencySlot,
  status: number,
  body: unknown,
): Promise<void> {
  const record: StoredResponse = { requestHash: slot.requestHash, status, body };
  await getKv().set(slot.key, JSON.stringify(record), TTL_SECONDS);
}
