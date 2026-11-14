const QUEUE_KEY = 'understood.worker.queue';

export interface QueuedMutation {
  key: string;
  path: string;
  body: unknown;
  deliveryToken: string;
  queuedAt: string;
}

function readQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedMutation[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export function enqueueMutation(mutation: Omit<QueuedMutation, 'queuedAt'>): void {
  const queue = readQueue().filter((entry) => entry.key !== mutation.key);
  queue.push({ ...mutation, queuedAt: new Date().toISOString() });
  writeQueue(queue);
}

export function queuedCount(): number {
  return readQueue().length;
}

export async function flushQueue(): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;

  let index = 0;
  for (; index < queue.length; index += 1) {
    const mutation = queue[index]!;
    let response: Response;
    try {
      response = await fetch(mutation.path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mutation.deliveryToken}`,
          'Idempotency-Key': mutation.key,
        },
        body: JSON.stringify(mutation.body),
      });
    } catch {
      break;
    }
    if (response.status >= 500) break;
  }

  const remaining = queue.slice(index);
  writeQueue(remaining);
  return remaining.length;
}
