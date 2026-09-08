import 'server-only';
import { getPrisma } from '@/database/client';
import type { ServiceRepository } from '@/services/ports';
import type { ServiceCheckRecord, ServiceDetail, ServiceStatus, ServiceSummary } from '@/types/domain';
import type { Environment, Service, ServiceKind } from '@prisma/client';
import { notFound } from '@/lib/errors';
import { slugify, uniqueSlug } from '@/utils/slug';

type ServiceRow = Service & { project?: { id: string; name: string } | null };

/** How many recent checks the rolling uptime percentage is computed over. */
const UPTIME_WINDOW = 200;

function toSummary(row: ServiceRow): ServiceSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    kind: row.kind as ServiceKind,
    environment: row.environment as Environment,
    status: row.status as ServiceStatus,
    latencyMs: row.latencyMs,
    uptimePct: row.uptimePct,
    version: row.version,
    lastCheckAt: row.lastCheckAt?.toISOString() ?? null,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    isMonitored: row.isMonitored,
  };
}

function toCheck(row: {
  id: string;
  serviceId: string;
  status: string;
  responseTime: number | null;
  httpStatus: number | null;
  error: string | null;
  createdAt: Date;
}): ServiceCheckRecord {
  return {
    id: row.id,
    serviceId: row.serviceId,
    status: row.status as ServiceStatus,
    responseTime: row.responseTime,
    httpStatus: row.httpStatus,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaServiceRepository implements ServiceRepository {
  async list(filter: { environment?: string; projectId?: string } = {}): Promise<ServiceSummary[]> {
    const rows = await getPrisma().service.findMany({
      where: {
        ...(filter.environment ? { environment: filter.environment as Environment } : {}),
        ...(filter.projectId ? { projectId: filter.projectId } : {}),
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toSummary);
  }

  async findBySlugOrId(idOrSlug: string): Promise<ServiceDetail | null> {
    const row = await getPrisma().service.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        project: { select: { id: true, name: true } },
        checks: { orderBy: { createdAt: 'desc' }, take: 60 },
      },
    });
    if (!row) return null;

    return { ...toSummary(row), checks: row.checks.map(toCheck) };
  }

  async recordCheck(input: {
    serviceId: string;
    status: ServiceStatus;
    responseTime: number | null;
    httpStatus: number | null;
    error: string | null;
  }): Promise<ServiceCheckRecord> {
    const prisma = getPrisma();
    const [check] = await prisma.$transaction([
      prisma.serviceCheck.create({
        data: {
          serviceId: input.serviceId,
          status: input.status,
          responseTime: input.responseTime,
          httpStatus: input.httpStatus,
          error: input.error,
        },
      }),
      prisma.service.update({
        where: { id: input.serviceId },
        data: {
          status: input.status,
          latencyMs: input.responseTime,
          lastCheckAt: new Date(),
          uptimePct: await this.recentUptimePct(input.serviceId, input.status),
        },
      }),
    ]);

    return toCheck(check);
  }

  /**
   * Rolling uptime over the last {@link UPTIME_WINDOW} checks, including the one
   * being written (which is not yet committed when this runs, hence the
   * `pendingStatus` argument).
   *
   * A degraded service still counts as up: WARNING means "slow", not "down", and
   * conflating the two would make the number useless for spotting real outages.
   */
  private async recentUptimePct(serviceId: string, pendingStatus: ServiceStatus): Promise<number> {
    const previous = await getPrisma().serviceCheck.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
      take: UPTIME_WINDOW - 1,
      select: { status: true },
    });

    const statuses = [pendingStatus, ...previous.map((row) => row.status as ServiceStatus)];
    const up = statuses.filter((status) => status === 'ONLINE' || status === 'WARNING').length;

    return Math.round((up / statuses.length) * 10000) / 100;
  }

  async listChecks(serviceId: string, limit: number): Promise<ServiceCheckRecord[]> {
    const rows = await getPrisma().serviceCheck.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toCheck);
  }

  async listMonitored(): Promise<{ id: string; slug: string; name: string; healthUrl: string | null }[]> {
    return getPrisma().service.findMany({
      where: { isMonitored: true },
      select: { id: true, slug: true, name: true, healthUrl: true },
    });
  }

  async getHealthUrl(id: string): Promise<string | null> {
    const row = await getPrisma().service.findUnique({ where: { id }, select: { healthUrl: true } });
    return row?.healthUrl ?? null;
  }

  async create(input: {
    name: string;
    description: string | null;
    kind: ServiceKind;
    environment: Environment;
    healthUrl: string;
    projectId: string | null;
  }): Promise<ServiceSummary> {
    const prisma = getPrisma();
    const existing = await prisma.service.findMany({ select: { slug: true } });
    const slug = uniqueSlug(
      slugify(input.name),
      existing.map((row) => row.slug),
    );

    const row = await prisma.service.create({
      data: {
        slug,
        name: input.name,
        description: input.description,
        kind: input.kind,
        environment: input.environment,
        healthUrl: input.healthUrl,
        isMonitored: true,
        projectId: input.projectId,
      },
      include: { project: { select: { id: true, name: true } } },
    });

    return toSummary(row);
  }

  async remove(id: string): Promise<void> {
    try {
      await getPrisma().service.delete({ where: { id } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2025') throw notFound(`Service "${id}" not found`);
      throw error;
    }
  }

  async setMonitored(id: string, isMonitored: boolean): Promise<ServiceSummary> {
    try {
      const row = await getPrisma().service.update({
        where: { id },
        data: { isMonitored },
        include: { project: { select: { id: true, name: true } } },
      });
      return toSummary(row);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2025') throw notFound(`Service "${id}" not found`);
      throw error;
    }
  }
}
