import 'server-only';
import { getContainer } from '@/services/container';
import { notFound } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { notificationService } from '@/services/notification.service';
import type {
  AlertRecord,
  AlertSeverity,
  AlertStatus,
  AlertType,
  ServiceSummary,
  SystemMetrics,
} from '@/types/domain';

/**
 * AlertService + Alert Engine (spec §14, §15).
 *
 * Rules are evaluated against the current snapshot and produce alerts keyed by
 * a stable fingerprint (type + service). While an alert with that fingerprint
 * is unresolved, further firings only bump `occurrences` — that is the
 * deduplication the spec asks for, and it is why the dashboard shows "×4"
 * instead of four identical rows.
 */

export interface AlertRuleDefinition {
  id: string;
  name: string;
  type: AlertType;
  severity: AlertSeverity;
  description: string;
  evaluate(input: { services: ServiceSummary[]; system: SystemMetrics }): {
    serviceId: string | null;
    serviceName: string | null;
    title: string;
    description: string;
  }[];
}

/** Default rule set. Persisted rules (AlertRule table) extend this later. */
export const DEFAULT_RULES: AlertRuleDefinition[] = [
  {
    id: 'service-offline',
    name: 'Service offline',
    type: 'API_DOWN',
    severity: 'CRITICAL',
    description: 'IF service status == OFFLINE THEN create CRITICAL alert',
    evaluate: ({ services }) =>
      services
        .filter((service) => service.status === 'OFFLINE')
        .map((service) => ({
          serviceId: service.id,
          serviceName: service.name,
          title: `${service.name} is OFFLINE`,
          description: `Health checks are failing for ${service.name} (${service.environment}).`,
        })),
  },
  {
    id: 'high-latency',
    name: 'High latency',
    type: 'HIGH_LATENCY',
    severity: 'WARNING',
    description: 'IF latency > 2000ms THEN create WARNING alert',
    evaluate: ({ services }) =>
      services
        .filter((service) => (service.latencyMs ?? 0) > 2000)
        .map((service) => ({
          serviceId: service.id,
          serviceName: service.name,
          title: `High response time on ${service.name}`,
          description: `Latency is ${service.latencyMs} ms, above the 2000 ms threshold.`,
        })),
  },
  {
    id: 'high-cpu',
    name: 'High CPU',
    type: 'HIGH_CPU',
    severity: 'WARNING',
    description: 'IF cpu > 85% THEN create WARNING alert',
    evaluate: ({ system }) =>
      system.cpuPct > 85
        ? [
            {
              serviceId: null,
              serviceName: null,
              title: 'High CPU usage',
              description: `CPU usage is ${system.cpuPct}%, above the 85% threshold.`,
            },
          ]
        : [],
  },
  {
    id: 'high-memory',
    name: 'High memory',
    type: 'HIGH_MEMORY',
    severity: 'WARNING',
    description: 'IF memory > 90% THEN create WARNING alert',
    evaluate: ({ system }) =>
      system.ramPct > 90
        ? [
            {
              serviceId: null,
              serviceName: null,
              title: 'High memory usage',
              description: `RAM usage is ${system.ramPct}%, above the 90% threshold.`,
            },
          ]
        : [],
  },
  {
    id: 'disk-space-low',
    name: 'Disk space low',
    type: 'DISK_SPACE_LOW',
    severity: 'WARNING',
    description: 'IF disk > 85% THEN create WARNING alert',
    evaluate: ({ system }) =>
      system.diskPct > 85
        ? [
            {
              serviceId: null,
              serviceName: null,
              title: 'Disk space running low',
              description: `Disk usage is ${system.diskPct}%, above the 85% threshold.`,
            },
          ]
        : [],
  },
];

export function fingerprint(type: AlertType, serviceId: string | null): string {
  return `${type}:${serviceId ?? 'global'}`;
}

export class AlertService {
  private get container() {
    return getContainer();
  }

  constructor(private readonly rules: AlertRuleDefinition[] = DEFAULT_RULES) {}

  async list(filter: { status?: AlertStatus; limit?: number } = {}): Promise<AlertRecord[]> {
    return this.container.alerts.list(filter);
  }

  async listActive(limit = 20): Promise<AlertRecord[]> {
    const alerts = await this.container.alerts.list({ limit: 100 });
    return alerts.filter((alert) => alert.status !== 'RESOLVED').slice(0, limit);
  }

  async acknowledge(id: string): Promise<AlertRecord> {
    await this.assertExists(id);
    return this.container.alerts.updateStatus(id, 'ACKNOWLEDGED');
  }

  async resolve(id: string): Promise<AlertRecord> {
    await this.assertExists(id);
    return this.container.alerts.updateStatus(id, 'RESOLVED');
  }

  private async assertExists(id: string): Promise<AlertRecord> {
    const alert = await this.container.alerts.findById(id);
    if (!alert) throw notFound(`Alert "${id}" not found`);
    return alert;
  }

  /** Evaluates every rule and creates or deduplicates the resulting alerts. */
  async evaluate(input: { services: ServiceSummary[]; system: SystemMetrics }): Promise<AlertRecord[]> {
    const produced: AlertRecord[] = [];

    for (const rule of this.rules) {
      for (const match of rule.evaluate(input)) {
        const key = fingerprint(rule.type, match.serviceId);
        const existing = await this.container.alerts.findActiveByFingerprint(key);

        if (existing) {
          produced.push(await this.container.alerts.incrementOccurrence(existing.id));
          continue;
        }

        const alert = await this.container.alerts.create({
          type: rule.type,
          severity: rule.severity,
          title: match.title,
          description: match.description,
          serviceId: match.serviceId,
          serviceName: match.serviceName,
          fingerprint: key,
        });

        logger.info('Alert created', { rule: rule.id, alertId: alert.id, severity: rule.severity });
        await notificationService.dispatch({
          title: alert.title,
          body: alert.description ?? '',
          severity: alert.severity,
          alertId: alert.id,
        });

        produced.push(alert);
      }
    }

    return produced;
  }
}

export const alertService = new AlertService();
