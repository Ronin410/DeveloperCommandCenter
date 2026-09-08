import 'server-only';
import type { Redis } from 'ioredis';
import { getRedisClient } from '@/lib/redis';
import { logger } from '@/lib/logger';

/**
 * Small read-through cache (spec §36), same interface-with-two-adapters shape
 * as `RateLimitStore`: an in-memory `Map` when Redis isn't configured, a
 * Redis-backed one when it is — so a single-instance deployment needs
 * nothing extra, and a horizontally-scaled one shares the cache across
 * instances instead of each one warming its own.
 */

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

class MemoryCache implements Cache {
  private readonly store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

class RedisCache implements Cache {
  constructor(private readonly client: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(`dcc:cache:${key}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      logger.warn('Redis cache read failed', { key, error: (error as Error).message });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(`dcc:cache:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      logger.warn('Redis cache write failed', { key, error: (error as Error).message });
    }
  }
}

const globalForCache = globalThis as unknown as { dccCache?: Cache };

export function getCache(): Cache {
  if (!globalForCache.dccCache) {
    const client = getRedisClient();
    globalForCache.dccCache = client ? new RedisCache(client) : new MemoryCache();
  }
  return globalForCache.dccCache;
}
