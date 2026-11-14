import { z } from 'zod';

const cursorSchema = z.object({ at: z.string().datetime(), id: z.string().regex(/^[a-f\d]{24}$/i) });

export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(JSON.stringify({ at: at.toISOString(), id })).toString('base64url');
}

export function decodeCursor(cursor: string | undefined): { at: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    if (!parsed.success) return null;
    return { at: new Date(parsed.data.at), id: parsed.data.id };
  } catch {
    return null;
  }
}
