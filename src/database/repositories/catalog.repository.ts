import 'server-only';
import { getPrisma } from '@/database/client';
import type {
  AlertRepository,
  CalendarRepository,
  DeploymentRepository,
  MetricRepository,
  ProjectRepository,
} from '@/services/ports';
import type {
  AlertRecord,
  AlertSeverity,
  AlertStatus,
  AlertType,
  CalendarEventRecord,
  DeploymentRecord,
  DeploymentStatus,
  Environment,
  MetricType,
  ProjectStatus,
  ProjectSummary,
} from '@/types/domain';

export class PrismaProjectRepository implements ProjectRepository {
  async list(): Promise<ProjectSummary[]> {
    const rows = await getPrisma().project.findMany({
      include: {
        services: { select: { status: true } },
        deployments: { orderBy: { startedAt: 'desc' }, take: 1, select: { startedAt: true } },
      },
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      repository: row.repository,
      environment: row.environment as Environment,
      status: row.status as ProjectStatus,
      version: row.version,
      serviceCount: row.services.length,
      healthyServices: row.services.filter((service) => service.status === 'ONLINE').length,
      lastDeploymentAt: row.deployments[0]?.startedAt.toISOString() ?? null,
    }));
  }

  async findBySlugOrId(idOrSlug: string): Promise<ProjectSummary | null> {
    return (await this.list()).find((project) => project.id === idOrSlug || project.slug === idOrSlug) ?? null;
  }
}

export class PrismaDeploymentRepository implements DeploymentRepository {
  async list(filter: { projectId?: string; limit?: number } = {}): Promise<DeploymentRecord[]> {
    const rows = await getPrisma().deployment.findMany({
      where: filter.projectId ? { projectId: filter.projectId } : {},
      include: { project: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: filter.limit ?? 25,
    });

    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      projectName: row.project.name,
      environment: row.environment as Environment,
      version: row.version,
      branch: row.branch,
      commitSha: row.commitSha,
      commitMessage: row.commitMessage,
      status: row.status as DeploymentStatus,
      author: row.author,
      durationSec: row.durationSec,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
    }));
  }
}

type AlertRow = {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string | null;
  serviceId: string | null;
  status: string;
  occurrences: number;
  createdAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  service?: { name: string } | null;
};

function toAlert(row: AlertRow): AlertRecord {
  return {
    id: row.id,
    type: row.type as AlertType,
    severity: row.severity as AlertSeverity,
    title: row.title,
    description: row.description,
    serviceId: row.serviceId,
    serviceName: row.service?.name ?? null,
    status: row.status as AlertStatus,
    occurrences: row.occurrences,
    createdAt: row.createdAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

export class PrismaAlertRepository implements AlertRepository {
  async list(filter: { status?: AlertStatus; limit?: number } = {}): Promise<AlertRecord[]> {
    const rows = await getPrisma().alert.findMany({
      where: filter.status ? { status: filter.status } : {},
      include: { service: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: filter.limit ?? 50,
    });
    return rows.map(toAlert);
  }

  async findById(id: string): Promise<AlertRecord | null> {
    const row = await getPrisma().alert.findUnique({ where: { id }, include: { service: { select: { name: true } } } });
    return row ? toAlert(row) : null;
  }

  async findActiveByFingerprint(fingerprint: string): Promise<AlertRecord | null> {
    const row = await getPrisma().alert.findFirst({
      where: { fingerprint, status: { in: ['ACTIVE', 'ACKNOWLEDGED'] } },
      include: { service: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return row ? toAlert(row) : null;
  }

  async create(input: {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    description: string | null;
    serviceId: string | null;
    fingerprint: string;
  }): Promise<AlertRecord> {
    const row = await getPrisma().alert.create({
      data: {
        type: input.type,
        severity: input.severity,
        title: input.title,
        description: input.description,
        serviceId: input.serviceId,
        fingerprint: input.fingerprint,
      },
      include: { service: { select: { name: true } } },
    });
    return toAlert(row);
  }

  async incrementOccurrence(id: string): Promise<AlertRecord> {
    const row = await getPrisma().alert.update({
      where: { id },
      data: { occurrences: { increment: 1 } },
      include: { service: { select: { name: true } } },
    });
    return toAlert(row);
  }

  async updateStatus(id: string, status: AlertStatus): Promise<AlertRecord> {
    const row = await getPrisma().alert.update({
      where: { id },
      data: {
        status,
        ...(status === 'ACKNOWLEDGED' ? { acknowledgedAt: new Date() } : {}),
        ...(status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
      },
      include: { service: { select: { name: true } } },
    });
    return toAlert(row);
  }
}

export class PrismaMetricRepository implements MetricRepository {
  async record(input: { serviceId?: string | null; type: MetricType; value: number; unit?: string }): Promise<void> {
    await getPrisma().metric.create({
      data: {
        serviceId: input.serviceId ?? null,
        type: input.type,
        value: input.value,
        unit: input.unit ?? null,
      },
    });
  }

  async history(input: { type: MetricType; serviceId?: string | null; limit: number }): Promise<
    { value: number; timestamp: string }[]
  > {
    const rows = await getPrisma().metric.findMany({
      where: { type: input.type, ...(input.serviceId ? { serviceId: input.serviceId } : {}) },
      orderBy: { timestamp: 'desc' },
      take: input.limit,
    });

    return rows
      .map((row) => ({ value: row.value, timestamp: row.timestamp.toISOString() }))
      .reverse();
  }
}

function toEvent(row: {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  source: string;
}): CalendarEventRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    allDay: row.allDay,
    source: row.source,
  };
}

export class PrismaCalendarRepository implements CalendarRepository {
  async listForDay(userId: string, day: Date): Promise<CalendarEventRecord[]> {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const rows = await getPrisma().calendarEvent.findMany({
      where: { userId, startsAt: { gte: start, lt: end } },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map(toEvent);
  }

  async listUpcoming(userId: string, limit: number): Promise<CalendarEventRecord[]> {
    const rows = await getPrisma().calendarEvent.findMany({
      where: { userId, endsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      take: limit,
    });
    return rows.map(toEvent);
  }
}
