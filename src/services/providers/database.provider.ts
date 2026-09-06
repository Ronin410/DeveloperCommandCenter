import 'server-only';
import { getPrisma, pingDatabase } from '@/database/client';
import type { DatabaseStatsProvider } from '@/services/ports';
import type { DatabaseStats } from '@/types/domain';
import { logger } from '@/lib/logger';

/**
 * PostgreSQL statistics read through Prisma's raw query API (spec §13).
 * Only aggregate, non-sensitive figures are exposed — never connection
 * strings, roles or passwords.
 */
export class PostgresStatsProvider implements DatabaseStatsProvider {
  async read(): Promise<DatabaseStats> {
    const ping = await pingDatabase();

    const fallback: DatabaseStats = {
      status: ping.ok ? 'ONLINE' : 'OFFLINE',
      connections: 0,
      maxConnections: 0,
      storageMb: 0,
      storageLimitMb: 0,
      latencyMs: ping.latencyMs ?? 0,
      cpuPct: 0,
      memoryPct: 0,
      lastBackupAt: null,
      version: 'PostgreSQL',
    };

    if (!ping.ok) return fallback;

    try {
      const prisma = getPrisma();
      const [connections] = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*)::bigint AS count FROM pg_stat_activity WHERE datname = current_database()
      `;
      const [maxConnections] = await prisma.$queryRaw<{ setting: string }[]>`
        SELECT setting FROM pg_settings WHERE name = 'max_connections'
      `;
      const [size] = await prisma.$queryRaw<{ bytes: bigint }[]>`
        SELECT pg_database_size(current_database())::bigint AS bytes
      `;
      const [version] = await prisma.$queryRaw<{ version: string }[]>`SELECT version() AS version`;

      return {
        ...fallback,
        connections: Number(connections?.count ?? 0),
        maxConnections: Number(maxConnections?.setting ?? 0),
        storageMb: Math.round(Number(size?.bytes ?? 0) / (1024 * 1024)),
        version: version?.version.split(' ').slice(0, 2).join(' ') ?? 'PostgreSQL',
      };
    } catch (error) {
      logger.warn('Could not read PostgreSQL statistics', { error: (error as Error).message });
      return fallback;
    }
  }
}
