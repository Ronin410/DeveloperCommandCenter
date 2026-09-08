import 'server-only';
import { getEnv } from '@/lib/env';
import { getRedisClient } from '@/lib/redis';

/**
 * Fixed-window rate limiter, in-memory by default.
 *
 * The store is behind an interface on purpose: moving to Redis (spec §36) is a
 * new implementation of `RateLimitStore`, not a rewrite of the call sites. A
 * single-process memory store is correct for a single-container deployment;
 * `RedisRateLimitStore` takes over automatically once `REDIS_URL` is set, so
 * the limit is shared instead of per-instance once the app scales horizontally.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const bucket = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
      this.sweep(now);
      return bucket;
    }

    existing.count += 1;
    return existing;
  }

  private sweep(now: number): void {
    if (this.buckets.size < 5_000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

/**
 * `INCR` + `PEXPIRE` on the key's first hit — the standard fixed-window
 * pattern for Redis. There's a narrow race between the two commands (a crash
 * in between would leave a key with no expiry), which is an accepted
 * trade-off for a rate limiter: the failure mode is "briefly stricter than
 * intended" or, at worst, one key surviving until it's evicted, never a
 * correctness bug like letting extra requests through unbounded.
 */
class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly client: NonNullable<ReturnType<typeof getRedisClient>>) {}

  async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const redisKey = `dcc:ratelimit:${key}`;
    const count = await this.client.incr(redisKey);
    if (count === 1) await this.client.pexpire(redisKey, windowMs);

    const ttl = await this.client.pttl(redisKey);
    return { count, resetAt: Date.now() + (ttl > 0 ? ttl : windowMs) };
  }
}

const globalForRateLimit = globalThis as unknown as { dccRateLimitStore?: RateLimitStore };

function getStore(): RateLimitStore {
  if (!globalForRateLimit.dccRateLimitStore) {
    const client = getRedisClient();
    globalForRateLimit.dccRateLimitStore = client ? new RedisRateLimitStore(client) : new MemoryRateLimitStore();
  }
  return globalForRateLimit.dccRateLimitStore;
}

export async function rateLimit(
  key: string,
  options: { limit?: number; windowSeconds?: number } = {},
): Promise<RateLimitResult> {
  const env = getEnv();
  const limit = options.limit ?? env.RATE_LIMIT_MAX_REQUESTS;
  const windowMs = (options.windowSeconds ?? env.RATE_LIMIT_WINDOW_SECONDS) * 1000;

  const { count, resetAt } = await getStore().increment(key, windowMs);

  return { allowed: count <= limit, remaining: Math.max(0, limit - count), limit, resetAt };
}

/** Best-effort client IP behind a reverse proxy. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? '0.0.0.0';
}
