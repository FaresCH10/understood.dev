import { parseLanguage, type Language } from '@understood/shared';
import { normalizeWorkerName } from '../../domain/names.js';

export interface ParsedWorkerRow {
  row: number;
  name: string;
  normalizedName: string;
  language: Language;
  phoneE164: string | null;
  crewName: string | null;
}

export interface ImportParseError {
  row: number;
  field: string;
  code: string;
  message: string;
}

export interface ImportParseWarning {
  row: number;
  code: 'duplicate_name';
  message: string;
}

export interface ImportParseResult {
  totalRows: number;
  rows: ParsedWorkerRow[];
  errors: ImportParseError[];
  warnings: ImportParseWarning[];
}

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\r') {
      if (input[i + 1] !== '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      }
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((line) => line.some((cell) => cell.trim() !== ''));
}

export function escapeCsvValue(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const dangerous = /^[=+\-@\t\r]/.test(raw);
  const guarded = dangerous ? `'${raw}` : raw;
  if (/[",\r\n]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

export function buildCsv(rows: Array<Array<unknown>>, withBom = true): string {
  const body = rows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n');
  return `${withBom ? '\uFEFF' : ''}${body}\r\n`;
}

const REQUIRED_HEADERS = ['name', 'language'] as const;

export function parseWorkerImport(text: string): ImportParseResult {
  const table = parseCsv(text);
  const errors: ImportParseError[] = [];
  const warnings: ImportParseWarning[] = [];
  const rows: ParsedWorkerRow[] = [];

  if (table.length === 0) {
    return { totalRows: 0, rows, errors: [{ row: 1, field: 'file', code: 'empty_file', message: 'The file is empty.' }], warnings };
  }

  const header = table[0]!.map((cell) => cell.trim().toLowerCase());
  const index = {
    name: header.indexOf('name'),
    language: header.indexOf('language'),
    phone: header.indexOf('phone'),
    crew: header.indexOf('crew'),
  };

  for (const required of REQUIRED_HEADERS) {
    if (index[required] === -1) {
      errors.push({ row: 1, field: required, code: 'missing_header', message: `Missing required column "${required}".` });
    }
  }
  if (index.crew === -1) {
    // A crew column is optional when the import is scoped to one crew.
  }
  if (errors.length > 0) return { totalRows: 0, rows, errors, warnings };

  const seen = new Map<string, number>();

  for (let i = 1; i < table.length; i += 1) {
    const line = table[i]!;
    const rowNumber = i + 1;
    const cell = (position: number) => (position >= 0 ? (line[position] ?? '').trim() : '');

    const name = cell(index.name).slice(0, 80);
    if (!name) {
      errors.push({ row: rowNumber, field: 'name', code: 'required', message: 'Name is required.' });
      continue;
    }

    const rawLanguage = cell(index.language);
    const language = parseLanguage(rawLanguage);
    if (!language) {
      errors.push({
        row: rowNumber,
        field: 'language',
        code: 'invalid_language',
        message: 'Language must be one of ar, en, hi, ur, ml, bn (or its name).',
      });
      continue;
    }

    const rawPhone = cell(index.phone).replace(/[\s()-]/g, '');
    let phoneE164: string | null = null;
    if (rawPhone) {
      if (!/^\+[1-9]\d{7,14}$/.test(rawPhone)) {
        errors.push({ row: rowNumber, field: 'phone', code: 'invalid_phone', message: 'Phone must be in +E.164 format.' });
        continue;
      }
      phoneE164 = rawPhone;
    }

    const crewName = index.crew >= 0 ? cell(index.crew) || null : null;
    const normalizedName = normalizeWorkerName(name);
    const dedupeKey = `${crewName ? crewName.toLowerCase() : ''}::${normalizedName}`;
    const firstRow = seen.get(dedupeKey);
    if (firstRow !== undefined) {
      warnings.push({
        row: rowNumber,
        code: 'duplicate_name',
        message: `Same name as row ${firstRow}; both will be imported.`,
      });
    } else {
      seen.set(dedupeKey, rowNumber);
    }

    rows.push({ row: rowNumber, name, normalizedName, language, phoneE164, crewName });
  }

  return { totalRows: table.length - 1, rows, errors, warnings };
}
