import { Queue, Worker, type JobsOptions } from 'bullmq';
import Redis from 'ioredis';
import { config, isTest } from '../config.js';
import { logger } from '../logger.js';

export type JobName = 'transcribe' | 'variant' | 'help_alert' | 'cleanup' | 'operation';

export interface JobPayloads {
  transcribe: { instructionId: string; orgId: string; audioKey: string };
  variant: { instructionId: string; orgId: string; language: string; generation: number; revision: number };
  help_alert: { orgId: string; instructionId: string };
  cleanup: { orgId: string };
  operation: { instructionId: string; generation: number };
}

export type JobHandler = (name: JobName, data: unknown) => Promise<void>;

const handlers = new Map<JobName, JobHandler>();

export function registerJobHandler(name: JobName, handler: JobHandler): void {
  handlers.set(name, handler);
}

type QueueAdapter = {
  ready(): Promise<void>;
  enqueue(name: JobName, data: JobPayloads[JobName], options?: JobsOptions): Promise<void>;
  close(): Promise<void>;
};

class InlineQueue implements QueueAdapter {
  async ready(): Promise<void> {}
  async enqueue(name: JobName, data: unknown, options?: JobsOptions): Promise<void> {
    const handler = handlers.get(name);
    if (!handler) {
      logger.warn({ job: name }, 'no handler registered for job');
      return;
    }
    const delay = typeof options?.delay === 'number' ? options.delay : 0;
    setTimeout(() => {
      void handler(name, data).catch((error) => {
        logger.error({ job: name, err: error instanceof Error ? error.message : String(error) }, 'inline job failed');
      });
    }, delay).unref();
  }

  async close(): Promise<void> {}
}

export class BullQueue implements QueueAdapter {
  private queue: Queue;
  private worker: Worker | null = null;
  private connection: Redis;

  constructor(url: string, role = config.PROCESS_ROLE, name = 'pipeline') {
    const connection = new Redis(url, { maxRetriesPerRequest: null });
    this.connection = connection;
    this.queue = new Queue(name, { connection });
    if (role === 'worker' || role === 'both') {
      this.worker = new Worker(
        name,
        async (job) => {
          const handler = handlers.get(job.name as JobName);
          if (!handler) throw new Error(`no handler for ${job.name}`);
          await handler(job.name as JobName, job.data);
        },
        {
          connection,
          concurrency: 3,
          settings: {
            backoffStrategy: (attemptsMade: number) =>
              [1000, 5000, 20000][attemptsMade - 1] ?? 20000,
          },
        },
      );
      this.worker.on('failed', (job, error) => {
        logger.error({ job: job?.name, id: job?.id, err: error.message }, 'job failed');
      });
      this.worker.on('error', (error) => logger.error({ err: error.message }, 'queue worker error'));
    }
  }

  async ready(): Promise<void> {
    await this.queue.waitUntilReady();
    await this.worker?.waitUntilReady();
  }

  async enqueue(name: JobName, data: unknown, options?: JobsOptions): Promise<void> {
    await this.queue.add(name, data, {
      attempts: 3,
      backoff: { type: 'custom' },
      removeOnComplete: 500,
      removeOnFail: 1000,
      ...options,
    });
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    await this.connection.quit();
  }
}

let queue: QueueAdapter | null = null;

export function getQueue(): QueueAdapter {
  if (!queue) {
    queue = config.REDIS_URL && !isTest ? new BullQueue(config.REDIS_URL) : new InlineQueue();
  }
  return queue;
}

export async function closeQueue(): Promise<void> {
  await queue?.close();
  queue = null;
}
