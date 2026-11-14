import Redis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../logger.js';

export interface KvStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  sadd(key: string, member: string, ttlSeconds: number): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
  incr(key: string, ttlSeconds: number): Promise<number>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

export class MemoryKvStore implements KvStore {
  private strings = new Map<string, MemoryEntry>();
  private sets = new Map<string, { members: Set<string>; expiresAt: number }>();

  private live(entry: { expiresAt: number } | undefined): boolean {
    return Boolean(entry && entry.expiresAt > Date.now());
  }

  async get(key: string): Promise<string | null> {
    const entry = this.strings.get(key);
    if (!this.live(entry)) {
      this.strings.delete(key);
      return null;
    }
    return entry!.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.strings.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.strings.delete(key);
    this.sets.delete(key);
  }

  async sadd(key: string, member: string, ttlSeconds: number): Promise<void> {
    const existing = this.sets.get(key);
    const members = this.live(existing) ? existing!.members : new Set<string>();
    members.add(member);
    this.sets.set(key, { members, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async srem(key: string, member: string): Promise<void> {
    this.sets.get(key)?.members.delete(member);
  }

  async smembers(key: string): Promise<string[]> {
    const entry = this.sets.get(key);
    if (!this.live(entry)) {
      this.sets.delete(key);
      return [];
    }
    return [...entry!.members];
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const current = Number((await this.get(key)) ?? '0') + 1;
    const existing = this.strings.get(key);
    const expiresAt = this.live(existing) ? existing!.expiresAt : Date.now() + ttlSeconds * 1000;
    this.strings.set(key, { value: String(current), expiresAt });
    return current;
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    this.strings.clear();
    this.sets.clear();
  }
}

class RedisKvStore implements KvStore {
  private client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, { maxRetriesPerRequest: null, enableOfflineQueue: true });
    this.client.on('error', (error) => logger.error({ err: error.message }, 'redis error'));
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async sadd(key: string, member: string, ttlSeconds: number): Promise<void> {
    await this.client.sadd(key, member);
    await this.client.expire(key, ttlSeconds);
  }

  async srem(key: string, member: string): Promise<void> {
    await this.client.srem(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const value = await this.client.incr(key);
    if (value === 1) await this.client.expire(key, ttlSeconds);
    return value;
  }

  async ping(): Promise<boolean> {
    return (await this.client.ping()) === 'PONG';
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

let store: KvStore | null = null;

export function getKv(): KvStore {
  if (!store) {
    store = config.REDIS_URL ? new RedisKvStore(config.REDIS_URL) : new MemoryKvStore();
    if (!config.REDIS_URL) {
      logger.warn('REDIS_URL not set — using in-memory store (development only)');
    }
  }
  return store;
}

export async function closeKv(): Promise<void> {
  await store?.close();
  store = null;
}
