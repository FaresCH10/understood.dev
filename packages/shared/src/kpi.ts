import type { WorkerRef } from './enums.js';

export const UNDERSTOOD_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isUnderstood(input: {
  firstAttemptCorrect: boolean | null | undefined;
  completedAt: Date | string | null | undefined;
  sharedAt: Date | string | null | undefined;
}): boolean {
  if (input.firstAttemptCorrect !== true) return false;
  if (!input.completedAt || !input.sharedAt) return false;
  const completed = new Date(input.completedAt).getTime();
  const shared = new Date(input.sharedAt).getTime();
  return completed - shared <= UNDERSTOOD_WINDOW_MS;
}

export function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

export interface DisplayName {
  id: string;
  displayName: string;
  firstName: string;
  lastInitial: string;
}

export function computeDisplayNames(workers: WorkerRef[]): DisplayName[] {
  const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;
  const lastInitialOf = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  };

  const byFirstName = new Map<string, number>();
  for (const worker of workers) {
    const key = firstNameOf(worker.name).toLocaleLowerCase();
    byFirstName.set(key, (byFirstName.get(key) ?? 0) + 1);
  }

  const used = new Map<string, number>();
  return workers.map((worker) => {
    const first = firstNameOf(worker.name);
    const initial = lastInitialOf(worker.name);
    const collides = (byFirstName.get(first.toLocaleLowerCase()) ?? 0) > 1;

    let base = collides && initial ? `${first} ${initial}.` : first;
    base = base || worker.name;

    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    const displayName = count === 0 ? base : `${base} ${count + 1}`;

    return { id: worker.id, displayName, firstName: first, lastInitial: initial };
  });
}
