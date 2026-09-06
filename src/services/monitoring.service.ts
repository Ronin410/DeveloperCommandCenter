import 'server-only';
import { getContainer } from '@/services/container';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { ServiceCheckRecord, ServiceDetail, ServiceStatus, ServiceSummary } from '@/types/domain';
import { notFound } from '@/lib/errors';

/**
 * MonitoringService — health checks and service state (spec §6, §7).
 */
export class MonitoringService {
  private get container() {
    return getContainer();
  }

  async listServices(filter: { environment?: string; projectId?: string } = {}): Promise<ServiceSummary[]> {
    return this.container.services.list(filter);
  }

  async getService(idOrSlug: string): Promise<ServiceDetail> {
    const service = await this.container.services.findBySlugOrId(idOrSlug);
    if (!service) throw notFound(`Service "${idOrSlug}" not found`);
    return service;
  }

  async getChecks(idOrSlug: string, limit = 60): Promise<ServiceCheckRecord[]> {
    const service = await this.getService(idOrSlug);
    return this.container.services.listChecks(service.id, limit);
  }

  /**
   * Performs one HTTP health check. Any non-2xx or transport error is OFFLINE;
   * a slow but successful response is WARNING, which is what makes the
   * "degraded" state visible before an outage (spec §6).
   */
  async checkEndpoint(url: string): Promise<{
    status: ServiceStatus;
    responseTime: number;
    httpStatus: number | null;
    error: string | null;
  }> {
    const startedAt = Date.now();
    const timeout = getEnv().MONITORING_TIMEOUT_MS;

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
        headers: { 'user-agent': 'developer-command-center/health-check' },
      });
      const responseTime = Date.now() - startedAt;

      if (!response.ok) {
        return { status: 'OFFLINE', responseTime, httpStatus: response.status, error: `HTTP ${response.status}` };
      }

      return {
        status: responseTime > timeout / 2 ? 'WARNING' : 'ONLINE',
        responseTime,
        httpStatus: response.status,
        error: null,
      };
    } catch (error) {
      return {
        status: 'OFFLINE',
        responseTime: Date.now() - startedAt,
        httpStatus: null,
        error: (error as Error).message,
      };
    }
  }

  /** Runs every monitored service's health check once and records the result. */
  async runChecks(): Promise<{ checked: number; failures: number }> {
    const targets = await this.container.services.listMonitored();
    let failures = 0;

    for (const target of targets) {
      if (!target.healthUrl) continue;

      const result = await this.checkEndpoint(target.healthUrl);
      if (result.status !== 'ONLINE') failures += 1;

      await this.container.services.recordCheck({
        serviceId: target.id,
        status: result.status,
        responseTime: result.responseTime,
        httpStatus: result.httpStatus,
        error: result.error,
      });

      await this.container.metrics.record({
        serviceId: target.id,
        type: 'LATENCY',
        value: result.responseTime,
        unit: 'ms',
      });
    }

    logger.debug('Monitoring cycle finished', { checked: targets.length, failures });
    return { checked: targets.length, failures };
  }
}

export const monitoringService = new MonitoringService();
