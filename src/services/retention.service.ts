import 'server-only';
import { getPrisma } from '@/database/client';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { MetricType } from '@prisma/client';

/**
 * Retention and downsampling (spec §36).
 *
 * Without this, `ServiceCheck` and `Metric` grow forever: a check every 30
 * seconds is ~2.8M rows/service/year, and a metric snapshot every cycle isn't
 * far behind. Mock mode never persists either table, so this only ever runs
 * against a real database (see `retention.engine.ts`).
 */
export class RetentionService {
  /** The rolling uptime calculation only ever looks at the last 200 checks, so older raw history is pure archive — just delete it. */
  async purgeServiceChecks(): Promise<number> {
    const cutoff = daysAgo(getEnv().SERVICE_CHECK_RETENTION_DAYS);
    const result = await getPrisma().serviceCheck.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return result.count;
  }

  /**
   * Collapses metric points older than `METRIC_DOWNSAMPLE_AFTER_HOURS` into
   * one hourly-average row per (type, service, hour). A bucket with only one
   * row is left alone — `HAVING count(*) > 1` — which is what makes running
   * this repeatedly a no-op on data it has already downsampled, without
   * needing a schema column to mark "already downsampled" rows.
   */
  async downsampleMetrics(): Promise<number> {
    const cutoff = hoursAgo(getEnv().METRIC_DOWNSAMPLE_AFTER_HOURS);
    const prisma = getPrisma();

    const buckets = await prisma.$queryRaw<
      { type: MetricType; serviceId: string | null; hour: Date; avgValue: number; unit: string | null; ids: string[] }[]
    >`
      SELECT
        type,
        "serviceId",
        date_trunc('hour', timestamp) AS hour,
        avg(value)::float AS "avgValue",
        max(unit) AS unit,
        array_agg(id) AS ids
      FROM "Metric"
      WHERE timestamp < ${cutoff}
      GROUP BY type, "serviceId", date_trunc('hour', timestamp)
      HAVING count(*) > 1
    `;

    let collapsed = 0;
    for (const bucket of buckets) {
      await prisma.$transaction([
        prisma.metric.deleteMany({ where: { id: { in: bucket.ids } } }),
        prisma.metric.create({
          data: {
            type: bucket.type,
            serviceId: bucket.serviceId,
            value: bucket.avgValue,
            unit: bucket.unit,
            timestamp: bucket.hour,
          },
        }),
      ]);
      // N rows became 1, so N-1 rows were actually removed from the table.
      collapsed += bucket.ids.length - 1;
    }

    return collapsed;
  }

  /** Even downsampled (hourly) points don't live forever. */
  async purgeOldMetrics(): Promise<number> {
    const cutoff = daysAgo(getEnv().METRIC_RETENTION_DAYS);
    const result = await getPrisma().metric.deleteMany({ where: { timestamp: { lt: cutoff } } });
    return result.count;
  }

  async run(): Promise<{ checksDeleted: number; metricsDownsampled: number; metricsDeleted: number }> {
    const checksDeleted = await this.purgeServiceChecks();
    const metricsDownsampled = await this.downsampleMetrics();
    const metricsDeleted = await this.purgeOldMetrics();

    logger.info('Retention job finished', { checksDeleted, metricsDownsampled, metricsDeleted });
    return { checksDeleted, metricsDownsampled, metricsDeleted };
  }
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export const retentionService = new RetentionService();
