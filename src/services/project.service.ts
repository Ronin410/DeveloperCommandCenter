import 'server-only';
import { getContainer } from '@/services/container';
import { notFound } from '@/lib/errors';
import type { DeploymentRecord, ProjectSummary } from '@/types/domain';

/** ProjectService and DeploymentService (spec §9, §10). */
export class ProjectService {
  private get container() {
    return getContainer();
  }

  async list(): Promise<ProjectSummary[]> {
    return this.container.projects.list();
  }

  async get(idOrSlug: string): Promise<ProjectSummary> {
    const project = await this.container.projects.findBySlugOrId(idOrSlug);
    if (!project) throw notFound(`Project "${idOrSlug}" not found`);
    return project;
  }
}

export class DeploymentService {
  private readonly container = getContainer();

  async list(filter: { projectId?: string; limit?: number } = {}): Promise<DeploymentRecord[]> {
    return this.container.deployments.list(filter);
  }

  async latestPerProject(): Promise<Map<string, DeploymentRecord>> {
    const deployments = await this.list({ limit: 100 });
    const latest = new Map<string, DeploymentRecord>();
    for (const deployment of deployments) {
      if (!latest.has(deployment.projectId)) latest.set(deployment.projectId, deployment);
    }
    return latest;
  }
}

export const projectService = new ProjectService();
export const deploymentService = new DeploymentService();
