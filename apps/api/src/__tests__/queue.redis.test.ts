import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { BullQueue, registerJobHandler } from '../jobs/queue.js';

it.skipIf(!process.env.TEST_REDIS_URL)('a separate Redis producer and background consumer process jobs and deduplicate IDs', async () => {
  const name = `understood-test-${randomUUID()}`;
  const producer = new BullQueue(process.env.TEST_REDIS_URL!, 'api', name);
  const consumer = new BullQueue(process.env.TEST_REDIS_URL!, 'worker', name);
  let calls = 0;
  let received: unknown;
  registerJobHandler('operation', async (_name, data) => { calls++; received = data; });
  try {
    await Promise.all([producer.ready(), consumer.ready()]);
    const data = {instructionId: 'queue-smoke', generation: 7};
    await producer.enqueue('operation', data, {jobId: 'safe_deduplicated_id', removeOnComplete: false});
    const deadline = Date.now() + 5_000;
    while (!calls && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    expect(received).toEqual(data);
    await producer.enqueue('operation', data, {jobId: 'safe_deduplicated_id', removeOnComplete: false});
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(calls).toBe(1);
  } finally {
    await Promise.all([producer.close(), consumer.close()]);
    const { default: Redis } = await import('ioredis');
    const client = new Redis(process.env.TEST_REDIS_URL!);
    const keys = await client.keys(`bull:${name}:*`);
    if (keys.length) await client.del(...keys);
    await client.quit();
  }
});
