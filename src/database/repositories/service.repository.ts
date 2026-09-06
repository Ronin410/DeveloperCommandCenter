import 'server-only';
import { getPrisma } from '@/database/client';
import type { ServiceRepository } from '@/services/ports';
import type { ServiceCheckRecord, ServiceDetail, ServiceStatus, ServiceSummary } from '@/types/domain';
import type { Environment, Service, ServiceKind } from '@prisma/client';

type ServiceRow = Service & { project?: { id: string; name: string } | null };

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
        data: { status: input.status, latencyMs: input.responseTime, lastCheckAt: new Date() },
      }),
    ]);

    return toCheck(check);
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
}
