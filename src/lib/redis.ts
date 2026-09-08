import 'server-only';
import Redis from 'ioredis';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Shared Redis client (spec §36 "Redis as cache + rate-limit store").
 *
 * A single client is lazily created once per server instance and reused by
 * both `lib/security/rate-limit.ts` and `lib/cache.ts` — the same "one
 * connection, many consumers" shape the Prisma client already uses. Returns
 * `null` (never throws) when `REDIS_URL` isn't configured, so every caller
 * has an in-memory fallback and Redis stays fully optional.
 */

const globalForRedis = globalThis as unknown as { dccRedisClient?: Redis | null };

export function getRedisClient(): Redis | null {
  if (globalForRedis.dccRedisClient !== undefined) return globalForRedis.dccRedisClient;

  const url = getEnv().REDIS_URL;
  if (!url) {
    globalForRedis.dccRedisClient = null;
    return null;
  }

  const client = new Redis(url, { maxRetriesPerRequest: 2 });
  // ioredis crashes the process on an unhandled 'error' event — a single
  // listener that logs is the whole fix, and it's what makes a Redis outage
  // degrade (callers fall back to their own error handling) instead of
  // taking the app down.
  client.on('error', (error: Error) => {
    logger.warn('Redis connection error', { error: error.message });
  });

  globalForRedis.dccRedisClient = client;
  return client;
}
