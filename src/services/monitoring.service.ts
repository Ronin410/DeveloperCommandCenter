import 'server-only';
import { getContainer } from '@/services/container';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import type {
  Environment,
  ServiceCheckRecord,
  ServiceDetail,
  ServiceKind,
  ServiceStatus,
  ServiceSummary,
} from '@/types/domain';
import { badRequest, notFound } from '@/lib/errors';

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

  /**
   * Registers a new service and runs one check immediately, so it shows a
   * real status the moment it appears in the UI instead of sitting at
   * UNKNOWN until the next scheduled cycle (up to `MONITORING_INTERVAL_SECONDS`
   * away, and never in mock mode, since the periodic engine only runs when
   * MOCK_MODE is off).
   */
  async createService(input: {
    name: string;
    description: string | null;
    kind: ServiceKind;
    environment: Environment;
    healthUrl: string;
    projectId: string | null;
  }): Promise<ServiceDetail> {
    const service = await this.container.services.create(input);
    const result = await this.checkEndpoint(input.healthUrl);

    await this.container.services.recordCheck({
      serviceId: service.id,
      status: result.status,
      responseTime: result.responseTime,
      httpStatus: result.httpStatus,
      error: result.error,
    });

    // Re-read rather than hand-merge the check result onto `service`: recording
    // a check also recomputes `uptimePct` (see PrismaServiceRepository), and a
    // manual merge would silently drop any field like that one it doesn't name.
    return this.getService(service.id);
  }

  async removeService(id: string): Promise<void> {
    await this.container.services.remove(id);
  }

  async setMonitored(id: string, isMonitored: boolean): Promise<ServiceSummary> {
    return this.container.services.setMonitored(id, isMonitored);
  }

  /**
   * Edits a service's editable fields. When `healthUrl` changes, runs one
   * check against the new URL immediately — otherwise the dashboard would
   * keep showing a status measured against the URL the service no longer
   * points at until the next scheduled cycle.
   */
  async updateService(
    id: string,
    input: Partial<{
      name: string;
      description: string | null;
      kind: ServiceKind;
      environment: Environment;
      healthUrl: string;
      projectId: string | null;
    }>,
  ): Promise<ServiceDetail> {
    const updated = await this.container.services.update(id, input);

    if (input.healthUrl !== undefined) {
      const result = await this.checkEndpoint(input.healthUrl);
      await this.container.services.recordCheck({
        serviceId: updated.id,
        status: result.status,
        responseTime: result.responseTime,
        httpStatus: result.httpStatus,
        error: result.error,
      });
    }

    return this.getService(updated.id);
  }

  /**
   * Runs one health check for a single service right now, for a manual
   * "Check now" button — works even while the service is paused, since that
   * is the point of a manual check.
   */
  async checkServiceNow(idOrSlug: string): Promise<ServiceDetail> {
    const service = await this.getService(idOrSlug);

    const healthUrl = await this.container.services.getHealthUrl(service.id);
    if (!healthUrl) {
      throw badRequest(`Service "${idOrSlug}" has no health check URL configured`);
    }

    const result = await this.checkEndpoint(healthUrl);
    await this.container.services.recordCheck({
      serviceId: service.id,
      status: result.status,
      responseTime: result.responseTime,
      httpStatus: result.httpStatus,
      error: result.error,
    });

    return this.getService(service.id);
  }
}

export const monitoringService = new MonitoringService();
