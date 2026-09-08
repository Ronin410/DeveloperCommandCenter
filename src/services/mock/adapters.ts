import type {
  AlertRecord,
  AlertStatus,
  CalendarEventRecord,
  DatabaseStats,
  DeploymentRecord,
  DockerContainer,
  FocusSessionState,
  GitRepositorySummary,
  ProjectSummary,
  ServiceCheckRecord,
  ServiceDetail,
  ServiceStatus,
  ServiceSummary,
  SystemMetrics,
} from '@/types/domain';
import type {
  AlertRepository,
  CalendarRepository,
  DatabaseStatsProvider,
  DeploymentRepository,
  DockerProvider,
  FocusRepository,
  GitProvider,
  MetricRepository,
  ProjectRepository,
  ServiceRepository,
  SystemMetricsProvider,
} from '@/services/ports';
import { badRequest, notFound } from '@/lib/errors';
import { slugify, uniqueSlug } from '@/utils/slug';
import {
  MOCK_PROJECTS,
  MOCK_SERVICES,
  mockAlerts,
  mockCalendarEvents,
  mockDeployments,
  mockRepositories,
  seededRandom,
  wobble,
} from '@/services/mock/dataset';

/**
 * Mock adapters. Mutable state (alerts, focus) lives on globalThis so actions
 * performed in the UI survive across requests during development.
 */

interface MockState {
  alerts: AlertRecord[];
  focus: Map<string, FocusSessionState & { resumedAtMs: number | null }>;
  checks: ServiceCheckRecord[];
  /**
   * Services added through the UI in mock mode. Kept separate from the
   * static `MOCK_SERVICES` demo dataset — which is never mutated, so the
   * built-in demo always looks the same — and merged with it at read time.
   *
   * Carries `healthUrl` alongside the public fields, stripped by
   * `toPublicSummary` before anything leaves this module — the same
   * discipline `PrismaServiceRepository` uses, since a health-check URL can
   * embed an internal hostname and must never reach the client.
   */
  customServices: CustomMockService[];
}

interface CustomMockService extends ServiceSummary {
  healthUrl: string;
}

/**
 * Explicit field-by-field projection — never a spread — so `healthUrl` can
 * never leak here by accident when `CustomMockService` grows a field later.
 */
function toPublicSummary(service: CustomMockService): ServiceSummary {
  return {
    id: service.id,
    slug: service.slug,
    name: service.name,
    description: service.description,
    kind: service.kind,
    environment: service.environment,
    status: service.status,
    latencyMs: service.latencyMs,
    uptimePct: service.uptimePct,
    version: service.version,
    lastCheckAt: service.lastCheckAt,
    projectId: service.projectId,
    projectName: service.projectName,
    isMonitored: service.isMonitored,
  };
}

const globalForMock = globalThis as unknown as { dccMockState?: MockState };

function state(): MockState {
  globalForMock.dccMockState ??= { alerts: mockAlerts(), focus: new Map(), checks: [], customServices: [] };
  return globalForMock.dccMockState;
}

export function resetMockState(): void {
  globalForMock.dccMockState = undefined;
}

function statusFor(seed: (typeof MOCK_SERVICES)[number], latency: number): ServiceStatus {
  if (seed.status) return seed.status;
  if (latency > 1000) return 'OFFLINE';
  if (latency > seed.baseLatency * 2) return 'WARNING';
  return 'ONLINE';
}

function toSummary(seed: (typeof MOCK_SERVICES)[number]): ServiceSummary {
  const latency = Math.max(1, Math.round(wobble(seed.slug, seed.baseLatency, seed.baseLatency * 0.25)));
  const project = MOCK_PROJECTS.find((item) => item.id === seed.projectId) ?? null;

  return {
    id: seed.id,
    slug: seed.slug,
    name: seed.name,
    description: seed.description,
    kind: seed.kind,
    environment: seed.environment,
    status: statusFor(seed, latency),
    latencyMs: seed.kind === 'CONTAINER' ? null : latency,
    uptimePct: seed.baseUptime,
    version: seed.version,
    lastCheckAt: new Date(Math.floor(Date.now() / 30_000) * 30_000).toISOString(),
    projectId: seed.projectId,
    projectName: project?.name ?? null,
    // The built-in demo dataset doesn't support pausing; it always reads ONLINE-ish.
    isMonitored: true,
  };
}

function isBuiltInServiceId(id: string): boolean {
  return MOCK_SERVICES.some((seed) => seed.id === id);
}

export class MockServiceRepository implements ServiceRepository {
  async list(filter: { environment?: string; projectId?: string } = {}): Promise<ServiceSummary[]> {
    const all = [...MOCK_SERVICES.map(toSummary), ...state().customServices.map(toPublicSummary)];
    return all.filter((service) => {
      if (filter.environment && service.environment !== filter.environment) return false;
      if (filter.projectId && service.projectId !== filter.projectId) return false;
      return true;
    });
  }

  private findCustom(idOrSlug: string): CustomMockService | undefined {
    return state().customServices.find((item) => item.id === idOrSlug || item.slug === idOrSlug);
  }

  async findBySlugOrId(idOrSlug: string): Promise<ServiceDetail | null> {
    const seed = MOCK_SERVICES.find((item) => item.id === idOrSlug || item.slug === idOrSlug);
    if (seed) return { ...toSummary(seed), checks: await this.listChecks(seed.id, 40) };

    const custom = this.findCustom(idOrSlug);
    if (!custom) return null;
    return { ...toPublicSummary(custom), checks: await this.listChecks(custom.id, 40) };
  }

  async recordCheck(input: {
    serviceId: string;
    status: ServiceStatus;
    responseTime: number | null;
    httpStatus: number | null;
    error: string | null;
  }): Promise<ServiceCheckRecord> {
    const check: ServiceCheckRecord = {
      id: `chk_${Date.now()}_${input.serviceId}`,
      createdAt: new Date().toISOString(),
      ...input,
    };
    state().checks.unshift(check);
    state().checks.splice(500);

    // Custom (user-added) services have no wobble simulation behind them, so
    // the check result is the only thing that updates their displayed state.
    const custom = state().customServices.find((item) => item.id === input.serviceId);
    if (custom) {
      custom.status = input.status;
      custom.latencyMs = input.responseTime;
      custom.lastCheckAt = check.createdAt;
      const recent = [
        input.status,
        ...state()
          .checks.filter((item) => item.serviceId === input.serviceId && item.id !== check.id)
          .slice(0, 199)
          .map((item) => item.status),
      ];
      const up = recent.filter((status) => status === 'ONLINE' || status === 'WARNING').length;
      custom.uptimePct = Math.round((up / recent.length) * 10000) / 100;
    }

    return check;
  }

  /** Synthesises a believable check history so charts have something to draw. */
  async listChecks(serviceId: string, limit: number): Promise<ServiceCheckRecord[]> {
    const seed = MOCK_SERVICES.find((item) => item.id === serviceId);
    const recorded = state().checks.filter((check) => check.serviceId === serviceId);

    if (!seed) {
      // Custom services only ever have real, recorded checks — no synthetic
      // backfill, since there is no baseline to simulate from.
      return recorded.slice(0, limit);
    }

    const synthetic = Array.from({ length: limit }, (_, index) => {
      const at = new Date(Date.now() - index * 30_000);
      const bucket = Math.floor(at.getTime() / 30_000);
      const noise = seededRandom(`${seed.slug}:${bucket}`);
      const responseTime = Math.max(1, Math.round(seed.baseLatency * (0.75 + noise * 0.6)));
      return {
        id: `chk_syn_${seed.id}_${bucket}`,
        serviceId: seed.id,
        status: statusFor(seed, responseTime),
        responseTime,
        httpStatus: 200,
        error: null,
        createdAt: at.toISOString(),
      } satisfies ServiceCheckRecord;
    });

    return [...recorded, ...synthetic].slice(0, limit);
  }

  async listMonitored(): Promise<{ id: string; slug: string; name: string; healthUrl: string | null }[]> {
    const builtIn = MOCK_SERVICES.map((seed) => ({ id: seed.id, slug: seed.slug, name: seed.name, healthUrl: null }));
    const custom = state()
      .customServices.filter((service) => service.isMonitored)
      .map((service) => ({ id: service.id, slug: service.slug, name: service.name, healthUrl: service.healthUrl }));
    return [...builtIn, ...custom];
  }

  /**
   * Built-in demo services are purely simulated (wobble-driven, no real
   * endpoint behind them), so there is nothing meaningful to check — only
   * custom services added through the UI have a real URL.
   */
  async getHealthUrl(id: string): Promise<string | null> {
    return this.findCustom(id)?.healthUrl ?? null;
  }

  async create(input: {
    name: string;
    description: string | null;
    kind: ServiceSummary['kind'];
    environment: ServiceSummary['environment'];
    healthUrl: string;
    projectId: string | null;
  }): Promise<ServiceSummary> {
    const taken = new Set([...MOCK_SERVICES.map((seed) => seed.slug), ...state().customServices.map((s) => s.slug)]);
    const slug = uniqueSlug(slugify(input.name), taken);
    const project = MOCK_PROJECTS.find((item) => item.id === input.projectId) ?? null;

    const service: CustomMockService = {
      id: `svc_custom_${Date.now()}_${Math.round(Math.random() * 1000)}`,
      slug,
      name: input.name,
      description: input.description,
      kind: input.kind,
      environment: input.environment,
      status: 'UNKNOWN',
      latencyMs: null,
      uptimePct: null,
      version: null,
      lastCheckAt: null,
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      healthUrl: input.healthUrl,
      isMonitored: true,
    };

    state().customServices.unshift(service);
    return toPublicSummary(service);
  }

  async remove(id: string): Promise<void> {
    if (isBuiltInServiceId(id)) {
      throw badRequest('Built-in demo services cannot be removed. Disable MOCK_MODE to manage real services.');
    }

    const before = state().customServices.length;
    state().customServices = state().customServices.filter((item) => item.id !== id);
    if (state().customServices.length === before) throw notFound(`Service "${id}" not found`);

    state().checks = state().checks.filter((check) => check.serviceId !== id);
  }

  async setMonitored(id: string, isMonitored: boolean): Promise<ServiceSummary> {
    if (isBuiltInServiceId(id)) {
      throw badRequest('Built-in demo services are always monitored.');
    }

    const service = this.findCustom(id);
    if (!service) throw notFound(`Service "${id}" not found`);

    service.isMonitored = isMonitored;
    return toPublicSummary(service);
  }
}

export class MockMetricRepository implements MetricRepository {
  async record(): Promise<void> {
    // Mock mode does not persist metrics; history is synthesised on read.
  }

  async history(input: { type: string; serviceId?: string | null; limit: number }): Promise<
    { value: number; timestamp: string }[]
  > {
    const base = { CPU: 32, RAM: 61, DISK: 48, NETWORK: 12, UPTIME: 99.9, REQUESTS: 840, ERROR_RATE: 0.4, LATENCY: 128 }[
      input.type
    ] ?? 50;

    return Array.from({ length: input.limit }, (_, index) => {
      const at = new Date(Date.now() - (input.limit - index) * 60_000);
      const bucket = Math.floor(at.getTime() / 60_000);
      const noise = seededRandom(`${input.type}:${input.serviceId ?? 'system'}:${bucket}`) - 0.5;
      return {
        value: Math.round((base + noise * base * 0.25) * 10) / 10,
        timestamp: at.toISOString(),
      };
    });
  }
}

export class MockProjectRepository implements ProjectRepository {
  async list(): Promise<ProjectSummary[]> {
    const services = MOCK_SERVICES.map(toSummary);
    const deployments = mockDeployments();

    return MOCK_PROJECTS.map((project) => {
      const own = services.filter((service) => service.projectId === project.id);
      const lastDeployment = deployments
        .filter((deployment) => deployment.projectId === project.id)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];

      return {
        ...project,
        serviceCount: own.length,
        healthyServices: own.filter((service) => service.status === 'ONLINE').length,
        lastDeploymentAt: lastDeployment?.startedAt ?? null,
      };
    });
  }

  async findBySlugOrId(idOrSlug: string): Promise<ProjectSummary | null> {
    return (await this.list()).find((project) => project.id === idOrSlug || project.slug === idOrSlug) ?? null;
  }
}

export class MockDeploymentRepository implements DeploymentRepository {
  async list(filter: { projectId?: string; limit?: number } = {}): Promise<DeploymentRecord[]> {
    return mockDeployments()
      .filter((deployment) => !filter.projectId || deployment.projectId === filter.projectId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, filter.limit ?? 25);
  }
}

export class MockAlertRepository implements AlertRepository {
  async list(filter: { status?: AlertStatus; limit?: number } = {}): Promise<AlertRecord[]> {
    return state()
      .alerts.filter((alert) => !filter.status || alert.status === filter.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, filter.limit ?? 50);
  }

  async findById(id: string): Promise<AlertRecord | null> {
    return state().alerts.find((alert) => alert.id === id) ?? null;
  }

  async findActiveByFingerprint(fingerprint: string): Promise<AlertRecord | null> {
    return (
      state().alerts.find(
        (alert) => alert.status !== 'RESOLVED' && `${alert.type}:${alert.serviceId ?? 'global'}` === fingerprint,
      ) ?? null
    );
  }

  async create(input: {
    type: AlertRecord['type'];
    severity: AlertRecord['severity'];
    title: string;
    description: string | null;
    serviceId: string | null;
    serviceName: string | null;
  }): Promise<AlertRecord> {
    const alert: AlertRecord = {
      id: `alr_${Date.now()}`,
      status: 'ACTIVE',
      occurrences: 1,
      createdAt: new Date().toISOString(),
      acknowledgedAt: null,
      resolvedAt: null,
      ...input,
    };
    state().alerts.unshift(alert);
    return alert;
  }

  async incrementOccurrence(id: string): Promise<AlertRecord> {
    const alert = state().alerts.find((item) => item.id === id);
    if (!alert) throw new Error(`Unknown alert ${id}`);
    alert.occurrences += 1;
    return alert;
  }

  async updateStatus(id: string, status: AlertStatus): Promise<AlertRecord> {
    const alert = state().alerts.find((item) => item.id === id);
    if (!alert) throw new Error(`Unknown alert ${id}`);
    alert.status = status;
    if (status === 'ACKNOWLEDGED') alert.acknowledgedAt = new Date().toISOString();
    if (status === 'RESOLVED') alert.resolvedAt = new Date().toISOString();
    return alert;
  }
}

const IDLE_FOCUS: FocusSessionState = {
  id: null,
  type: 'FOCUS',
  status: 'IDLE',
  durationSec: 25 * 60,
  elapsedSec: 0,
  remainingSec: 25 * 60,
  sessionIndex: 1,
  totalSessions: 4,
  label: null,
  startedAt: null,
};

export class MockFocusRepository implements FocusRepository {
  private read(userId: string): (FocusSessionState & { resumedAtMs: number | null }) | null {
    return state().focus.get(userId) ?? null;
  }

  private project(session: FocusSessionState & { resumedAtMs: number | null }): FocusSessionState {
    const elapsed =
      session.status === 'RUNNING' && session.resumedAtMs
        ? session.elapsedSec + Math.floor((Date.now() - session.resumedAtMs) / 1000)
        : session.elapsedSec;

    const clamped = Math.min(elapsed, session.durationSec);
    const completed = clamped >= session.durationSec;

    return {
      id: session.id,
      type: session.type,
      status: completed && session.status === 'RUNNING' ? 'COMPLETED' : session.status,
      durationSec: session.durationSec,
      elapsedSec: clamped,
      remainingSec: Math.max(0, session.durationSec - clamped),
      sessionIndex: session.sessionIndex,
      totalSessions: session.totalSessions,
      label: session.label,
      startedAt: session.startedAt,
    };
  }

  async getCurrent(userId: string): Promise<FocusSessionState> {
    const session = this.read(userId);
    return session ? this.project(session) : IDLE_FOCUS;
  }

  async start(input: {
    userId: string;
    type: FocusSessionState['type'];
    durationSec: number;
    sessionIndex: number;
    totalSessions: number;
    label: string | null;
  }): Promise<FocusSessionState> {
    const session = {
      id: `fcs_${Date.now()}`,
      type: input.type,
      status: 'RUNNING' as const,
      durationSec: input.durationSec,
      elapsedSec: 0,
      remainingSec: input.durationSec,
      sessionIndex: input.sessionIndex,
      totalSessions: input.totalSessions,
      label: input.label,
      startedAt: new Date().toISOString(),
      resumedAtMs: Date.now(),
    };
    state().focus.set(input.userId, session);
    return this.project(session);
  }

  async pause(userId: string): Promise<FocusSessionState> {
    const session = this.read(userId);
    if (!session || session.status !== 'RUNNING') return this.getCurrent(userId);

    const projected = this.project(session);
    session.elapsedSec = projected.elapsedSec;
    session.status = 'PAUSED';
    session.resumedAtMs = null;
    return this.project(session);
  }

  async resume(userId: string): Promise<FocusSessionState> {
    const session = this.read(userId);
    if (!session || session.status !== 'PAUSED') return this.getCurrent(userId);

    session.status = 'RUNNING';
    session.resumedAtMs = Date.now();
    return this.project(session);
  }

  async stop(userId: string): Promise<FocusSessionState> {
    const session = this.read(userId);
    if (!session) return IDLE_FOCUS;

    const projected = this.project(session);
    session.elapsedSec = projected.elapsedSec;
    session.status = 'CANCELLED';
    session.resumedAtMs = null;
    return this.project(session);
  }

  async reset(userId: string): Promise<FocusSessionState> {
    state().focus.delete(userId);
    return IDLE_FOCUS;
  }
}

export class MockCalendarRepository implements CalendarRepository {
  async listForDay(_userId: string, day: Date): Promise<CalendarEventRecord[]> {
    const key = day.toISOString().slice(0, 10);
    return mockCalendarEvents().filter((event) => event.startsAt.slice(0, 10) === key);
  }

  async listUpcoming(_userId: string, limit: number): Promise<CalendarEventRecord[]> {
    const now = Date.now();
    return mockCalendarEvents()
      .filter((event) => new Date(event.endsAt).getTime() >= now)
      .slice(0, limit);
  }
}

export class MockSystemMetricsProvider implements SystemMetricsProvider {
  async read(): Promise<SystemMetrics> {
    return {
      cpuPct: Math.max(1, wobble('system:cpu', 32, 9)),
      ramPct: Math.max(1, wobble('system:ram', 61, 6)),
      diskPct: Math.max(1, wobble('system:disk', 48, 2)),
      networkMbps: Math.max(0, wobble('system:net', 14, 8)),
      uptimeSec: 98231 + Math.floor(Date.now() / 1000) % 1000,
      loadAverage: [wobble('system:l1', 1.2, 0.5), wobble('system:l5', 1.05, 0.4), wobble('system:l15', 0.9, 0.3)],
      requestsPerMin: Math.round(Math.max(0, wobble('system:req', 840, 180))),
      errorRatePct: Math.max(0, wobble('system:err', 0.4, 0.35)),
      avgLatencyMs: Math.round(Math.max(1, wobble('system:lat', 128, 40))),
      collectedAt: new Date().toISOString(),
    };
  }
}

export class MockDockerProvider implements DockerProvider {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async listContainers(): Promise<DockerContainer[]> {
    const definitions: [string, string, number, number, number][] = [
      ['backend', 'acme/pasitos-api:2.4.18', 12, 420, 1024],
      ['frontend', 'acme/pasitos-web:3.1.0', 5, 280, 512],
      ['postgres', 'postgres:16-alpine', 8, 510, 2048],
      ['redis', 'redis:7-alpine', 2, 120, 512],
      ['nginx', 'nginx:1.27-alpine', 1, 80, 256],
    ];

    return definitions.map(([name, image, cpu, memory, limit], index) => {
      const cpuPct = Math.max(0.1, wobble(`docker:${name}:cpu`, cpu, cpu * 0.4));
      return {
        id: `ctr_${name}`,
        name,
        image,
        state: 'running' as const,
        status: cpuPct > cpu * 2 ? ('WARNING' as const) : ('ONLINE' as const),
        cpuPct,
        memoryMb: Math.round(Math.max(1, wobble(`docker:${name}:mem`, memory, memory * 0.12))),
        memoryLimitMb: limit,
        uptimeSec: 3600 * (12 + index),
        ports: index === 4 ? ['80:80', '443:443'] : [],
      };
    });
  }
}

export class MockDatabaseStatsProvider implements DatabaseStatsProvider {
  async read(): Promise<DatabaseStats> {
    return {
      status: 'ONLINE',
      connections: Math.round(Math.max(1, wobble('db:conn', 18, 6))),
      maxConnections: 100,
      storageMb: Math.round(wobble('db:storage', 2480, 20)),
      storageLimitMb: 10240,
      latencyMs: Math.max(1, wobble('db:latency', 8, 3)),
      cpuPct: Math.max(1, wobble('db:cpu', 21, 8)),
      memoryPct: Math.max(1, wobble('db:mem', 44, 7)),
      lastBackupAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
      version: 'PostgreSQL 16.4',
    };
  }
}

export class MockGitProvider implements GitProvider {
  async listRepositories(): Promise<GitRepositorySummary[]> {
    return mockRepositories();
  }
}
