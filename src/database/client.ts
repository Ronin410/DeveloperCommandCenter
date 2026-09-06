import 'server-only';
import { PrismaClient } from '@prisma/client';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Prisma singleton.
 *
 * In mock mode the database is optional, so the client is created lazily and
 * `isDatabaseConfigured()` lets callers degrade gracefully instead of crashing
 * the dashboard (spec §33).
 */

const globalForPrisma = globalThis as unknown as { dccPrisma?: PrismaClient };

export function isDatabaseConfigured(): boolean {
  return Boolean(getEnv().DATABASE_URL);
}

export function getPrisma(): PrismaClient {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is not configured; cannot use the Prisma client.');
  }

  if (!globalForPrisma.dccPrisma) {
    globalForPrisma.dccPrisma = new PrismaClient({
      log: getEnv().NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  return globalForPrisma.dccPrisma;
}

/** True when the database answers a trivial query. Used by /api/health. */
export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number | null; error?: string }> {
  if (!isDatabaseConfigured()) return { ok: false, latencyMs: null, error: 'not_configured' };

  const startedAt = Date.now();
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    logger.error('Database ping failed', { error: (error as Error).message });
    return { ok: false, latencyMs: Date.now() - startedAt, error: (error as Error).message };
  }
}
