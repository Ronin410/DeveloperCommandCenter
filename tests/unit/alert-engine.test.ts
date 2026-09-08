import { describe, expect, it } from 'vitest';
import { AlertService, DEFAULT_RULES, fingerprint } from '@/services/alert.service';
import type { ServiceSummary, SystemMetrics } from '@/types/domain';

function service(overrides: Partial<ServiceSummary> = {}): ServiceSummary {
  return {
    id: 'svc_test',
    slug: 'test',
    name: 'TEST',
    description: null,
    kind: 'API',
    environment: 'PRODUCTION',
    status: 'ONLINE',
    latencyMs: 100,
    uptimePct: 99.9,
    version: 'v1',
    lastCheckAt: new Date().toISOString(),
    projectId: null,
    projectName: null,
    isMonitored: true,
    ...overrides,
  };
}

function system(overrides: Partial<SystemMetrics> = {}): SystemMetrics {
  return {
    cpuPct: 20,
    ramPct: 40,
    diskPct: 30,
    networkMbps: 5,
    uptimeSec: 1000,
    loadAverage: [0.5, 0.4, 0.3],
    requestsPerMin: 100,
    errorRatePct: 0.1,
    avgLatencyMs: 100,
    collectedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('alert engine', () => {
  it('creates a CRITICAL alert for an offline service', async () => {
    const alerts = new AlertService(DEFAULT_RULES.filter((rule) => rule.id === 'service-offline'));
    const created = await alerts.evaluate({ services: [service({ status: 'OFFLINE' })], system: system() });

    expect(created).toHaveLength(1);
    expect(created[0]?.severity).toBe('CRITICAL');
    expect(created[0]?.type).toBe('API_DOWN');
  });

  it('deduplicates repeated firings instead of creating new alerts', async () => {
    const alerts = new AlertService(DEFAULT_RULES.filter((rule) => rule.id === 'service-offline'));
    const input = { services: [service({ status: 'OFFLINE' })], system: system() };

    const first = await alerts.evaluate(input);
    const second = await alerts.evaluate(input);
    const third = await alerts.evaluate(input);

    expect(first[0]?.id).toBe(second[0]?.id);
    expect(third[0]?.occurrences).toBe(3);
  });

  it('fires a WARNING above the latency threshold and stays quiet below it', async () => {
    const alerts = new AlertService(DEFAULT_RULES.filter((rule) => rule.id === 'high-latency'));

    expect(await alerts.evaluate({ services: [service({ latencyMs: 1999 })], system: system() })).toHaveLength(0);

    const fired = await alerts.evaluate({ services: [service({ latencyMs: 2500 })], system: system() });
    expect(fired[0]?.severity).toBe('WARNING');
  });

  it('fires on high CPU, memory and disk thresholds', async () => {
    const alerts = new AlertService(
      DEFAULT_RULES.filter((rule) => ['high-cpu', 'high-memory', 'disk-space-low'].includes(rule.id)),
    );

    const fired = await alerts.evaluate({
      services: [],
      system: system({ cpuPct: 91, ramPct: 95, diskPct: 88 }),
    });

    expect(fired.map((alert) => alert.type).sort()).toEqual(['DISK_SPACE_LOW', 'HIGH_CPU', 'HIGH_MEMORY']);
  });

  it('acknowledges and resolves an alert', async () => {
    const alerts = new AlertService(DEFAULT_RULES.filter((rule) => rule.id === 'service-offline'));
    const [alert] = await alerts.evaluate({ services: [service({ status: 'OFFLINE' })], system: system() });

    expect((await alerts.acknowledge(alert!.id)).status).toBe('ACKNOWLEDGED');
    const resolved = await alerts.resolve(alert!.id);
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolvedAt).not.toBeNull();
  });

  it('builds a stable fingerprint', () => {
    expect(fingerprint('API_DOWN', 'svc_1')).toBe('API_DOWN:svc_1');
    expect(fingerprint('HIGH_CPU', null)).toBe('HIGH_CPU:global');
  });
});
