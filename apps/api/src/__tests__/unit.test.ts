import { describe, expect, it } from 'vitest';
import {
  computeDisplayNames,
  isUnderstood,
  safeRate,
  validateQuestion,
  validateTranslation,
  type Question,
} from '@understood/shared';
import {
  canAnswer,
  canComplete,
  canEditVariant,
  canIdentify,
  canPatchInstruction,
  canShare,
  instructionStatusFromVariants,
} from '../domain/lifecycle.js';
import { decodeCursor, encodeCursor } from '../domain/cursor.js';
import { normalizeWorkerName, defaultOrgName } from '../domain/names.js';
import { buildCsv, escapeCsvValue, parseWorkerImport } from '../modules/workers/csv.js';
import { encryptedSecret, decryptSecret, signPreviewToken, tokenHash, verifyPreviewToken } from '../auth/tokens.js';

describe('lifecycle guards', () => {
  it('locks editing to draft and editing variants to ready/partial', () => {
    expect(canPatchInstruction('draft')).toBe(true);
    expect(canPatchInstruction('processing')).toBe(false);
    expect(canEditVariant('ready')).toBe(true);
    expect(canEditVariant('partial_failure')).toBe(true);
    expect(canEditVariant('shared')).toBe(false);
  });

  it('requires acceptTextOnly for partial share', () => {
    expect(canShare('ready', false)).toBe(true);
    expect(canShare('partial_failure', false)).toBe(false);
    expect(canShare('partial_failure', true)).toBe(true);
  });

  it('caps answers at two attempts and completes only after an answer', () => {
    expect(canAnswer('opened', 0)).toBe(true);
    expect(canAnswer('opened', 2)).toBe(false);
    expect(canComplete('answered', 0)).toBe('blocked');
    expect(canComplete('answered', 1)).toBe('complete');
    expect(canComplete('completed', 1)).toBe('replay');
  });

  it('derives instruction status from variants', () => {
    expect(instructionStatusFromVariants([])).toBe('processing');
    expect(instructionStatusFromVariants([{ status: 'ready' }])).toBe('ready');
    expect(instructionStatusFromVariants([{ status: 'ready' }, { status: 'text_only' }])).toBe('partial_failure');
    expect(instructionStatusFromVariants([{ status: 'ready' }, { status: 'processing' }])).toBe('processing');
  });

  it('identifies only shared instructions with a delivery', () => {
    expect(canIdentify('shared', true)).toBe(true);
    expect(canIdentify('shared', false)).toBe(false);
    expect(canIdentify('archived', true)).toBe(false);
  });
});

describe('cursor', () => {
  it('round-trips and rejects garbage', () => {
    const at = new Date('2026-11-13T07:02:11.000Z');
    const id = '665f1a2b3c4d5e6f708192a3';
    const decoded = decodeCursor(encodeCursor(at, id));
    expect(decoded?.at.toISOString()).toBe(at.toISOString());
    expect(decoded?.id).toBe(id);
    expect(decodeCursor('not-a-cursor')).toBeNull();
  });
});

describe('display names', () => {
  it('adds a last initial on first-name collisions and a numeric suffix after that', () => {
    const names = computeDisplayNames([
      { id: '1', name: 'Ramesh Kumar', language: 'ml' },
      { id: '2', name: 'Ramesh Nair', language: 'ml' },
      { id: '3', name: 'Ali', language: 'ar' },
    ]);
    expect(names[0]?.displayName).toBe('Ramesh K.');
    expect(names[1]?.displayName).toBe('Ramesh N.');
    expect(names[2]?.displayName).toBe('Ali');
  });

  it('adds numeric suffixes when the initial also collides', () => {
    const names = computeDisplayNames([
      { id: '1', name: 'Ramesh Kumar', language: 'ml' },
      { id: '2', name: 'Ramesh Khan', language: 'ur' },
    ]);
    expect(names[0]?.displayName).toBe('Ramesh K.');
    expect(names[1]?.displayName).toBe('Ramesh K. 2');
  });
});

describe('KPI math', () => {
  const shared = new Date('2026-11-13T06:00:00.000Z');
  it('understood requires a correct first attempt and completion within 24h', () => {
    expect(
      isUnderstood({ firstAttemptCorrect: true, sharedAt: shared, completedAt: new Date(shared.getTime() + 23 * 3600_000) }),
    ).toBe(true);
    expect(
      isUnderstood({ firstAttemptCorrect: true, sharedAt: shared, completedAt: new Date(shared.getTime() + 25 * 3600_000) }),
    ).toBe(false);
    expect(
      isUnderstood({ firstAttemptCorrect: false, sharedAt: shared, completedAt: new Date(shared.getTime() + 3600_000) }),
    ).toBe(false);
  });

  it('safeRate returns null when nothing was targeted', () => {
    expect(safeRate(0, 0)).toBeNull();
    expect(safeRate(3, 4)).toBe(0.75);
  });
});

describe('translation and question validation', () => {
  it('rejects identical, empty, wrong-script and length-ratio translations', () => {
    const base = { source: 'Wear your harness before entering the roof.', sourceLang: 'en' as const };
    expect(validateTranslation({ ...base, translated: base.source, target: 'ar' }).ok).toBe(false);
    expect(validateTranslation({ ...base, translated: '', target: 'ar' }).ok).toBe(false);
    expect(validateTranslation({ ...base, translated: 'Wear your harness now', target: 'ar' }).ok).toBe(false);
    expect(validateTranslation({ ...base, translated: 'ارتدِ حزام الأمان قبل دخول السطح.', target: 'ar' }).ok).toBe(true);
    expect(validateTranslation({ ...base, translated: base.source, target: 'en' }).ok).toBe(true);
  });

  it('rejects malformed questions', () => {
    const good: Question = {
      text: 'What should you do?',
      options: ['Wear a harness', 'Call the client', 'Take a photo'],
      correctIndex: 0,
      source: 'ai',
    };
    expect(validateQuestion(good).ok).toBe(true);
    expect(validateQuestion({ ...good, options: ['Same', 'Same', 'Other'] }).ok).toBe(false);
    expect(validateQuestion({ ...good, correctIndex: 5 as 0 }).ok).toBe(false);
  });
});

describe('CSV', () => {
  it('escapes formula injection and quotes', () => {
    expect(escapeCsvValue('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCsvValue('-2+3')).toBe("'-2+3");
    expect(escapeCsvValue('Ramesh, Kumar')).toBe('"Ramesh, Kumar"');
    expect(escapeCsvValue('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('writes a BOM and CRLF rows', () => {
    const csv = buildCsv([['name', 'language'], ['Ramesh', 'ml']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('\r\n');
  });

  it('parses a BOM CSV with named languages, phone and duplicates', () => {
    const csv = [
      'name,language,phone,crew',
      'Ramesh Kumar,Malayalam,+971501234567,A',
      'Ramesh Kumar,ml,,A',
      'Ali,ar,not-a-phone,B',
    ].join('\n');
    const result = parseWorkerImport(`\uFEFF${csv}`);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.language).toBe('ml');
    expect(result.rows[0]?.phoneE164).toBe('+971501234567');
    expect(result.warnings[0]?.code).toBe('duplicate_name');
    expect(result.errors[0]?.field).toBe('phone');
  });
});

describe('names', () => {
  it('normalizes whitespace and case', () => {
    expect(normalizeWorkerName('  Ramesh   Kumar ')).toBe('ramesh kumar');
    expect(defaultOrgName('owner@acme.com')).toContain('Acme');
  });
});

describe('tokens', () => {
  it('hashes deterministically', () => {
    expect(tokenHash('abc')).toBe(tokenHash('abc'));
    expect(tokenHash('abc')).not.toBe(tokenHash('abd'));
  });

  it('encrypts and decrypts token envelopes', () => {
    const secret = 'share-token-value';
    const envelope = encryptedSecret(secret);
    expect(envelope.startsWith('v1:')).toBe(true);
    expect(decryptSecret(envelope)).toBe(secret);
    expect(() => decryptSecret('v1:bad')).toThrow();
  });

  it('signs and verifies preview tokens and rejects expiry', () => {
    const { token } = signPreviewToken('665f1a2b3c4d5e6f708192a3', 15);
    expect(verifyPreviewToken(token)?.instructionId).toBe('665f1a2b3c4d5e6f708192a3');
    expect(verifyPreviewToken(`${token}x`)).toBeNull();

    const expired = signPreviewToken('665f1a2b3c4d5e6f708192a3', -1);
    expect(verifyPreviewToken(expired.token)).toBeNull();
  });
});
