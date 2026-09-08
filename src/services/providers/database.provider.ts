import 'server-only';
import { getPrisma, pingDatabase } from '@/database/client';
import type { DatabaseStatsProvider } from '@/services/ports';
import type { DatabaseDeepStats, DatabaseStats } from '@/types/domain';
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

  async readDeep(): Promise<DatabaseDeepStats> {
    const empty: DatabaseDeepStats = { tables: [], slowQueries: [], slowQueriesAvailable: false, walArchiving: null };

    const ping = await pingDatabase();
    if (!ping.ok) return empty;

    const prisma = getPrisma();

    const tables = await prisma
      .$queryRaw<{ name: string; row_estimate: bigint; total_bytes: bigint; index_bytes: bigint }[]>`
        SELECT
          relname AS name,
          n_live_tup AS row_estimate,
          pg_total_relation_size(relid)::bigint AS total_bytes,
          pg_indexes_size(relid)::bigint AS index_bytes
        FROM pg_stat_user_tables
        ORDER BY total_bytes DESC
        LIMIT 10
      `
      .then((rows) =>
        rows.map((row) => ({
          name: row.name,
          rowEstimate: Number(row.row_estimate),
          totalMb: Math.round((Number(row.total_bytes) / (1024 * 1024)) * 100) / 100,
          indexMb: Math.round((Number(row.index_bytes) / (1024 * 1024)) * 100) / 100,
        })),
      )
      .catch((error: Error) => {
        logger.warn('Could not read table sizes', { error: error.message });
        return [];
      });

    // pg_stat_statements is an optional extension — most managed Postgres
    // instances (Render included) don't enable it by default, so this is
    // expected to fail there. `slowQueriesAvailable: false` lets the UI
    // explain that rather than showing a silently-empty list.
    let slowQueries: DatabaseDeepStats['slowQueries'] = [];
    let slowQueriesAvailable = true;
    try {
      const rows = await prisma.$queryRaw<{ query: string; calls: bigint; mean_ms: number; total_ms: number }[]>`
        SELECT query, calls, mean_exec_time AS mean_ms, total_exec_time AS total_ms
        FROM pg_stat_statements
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `;
      slowQueries = rows.map((row) => ({
        query: row.query.length > 200 ? `${row.query.slice(0, 200)}…` : row.query,
        calls: Number(row.calls),
        meanMs: Math.round(row.mean_ms * 100) / 100,
        totalMs: Math.round(row.total_ms * 100) / 100,
      }));
    } catch {
      slowQueriesAvailable = false;
    }

    const walArchiving = await prisma
      .$queryRaw<{ last_archived_time: Date | null; failed_count: bigint }[]>`
        SELECT last_archived_time, failed_count FROM pg_stat_archiver
      `
      .then(([row]) => (row ? { lastArchivedAt: row.last_archived_time?.toISOString() ?? null, failedCount: Number(row.failed_count) } : null))
      .catch((error: Error) => {
        logger.warn('Could not read WAL archiver status', { error: error.message });
        return null;
      });

    return { tables, slowQueries, slowQueriesAvailable, walArchiving };
  }
}
