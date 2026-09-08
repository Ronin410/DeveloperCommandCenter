import 'server-only';
import { getContainer } from '@/services/container';
import { notFound } from '@/lib/errors';
import type { DeploymentRecord, Environment, ProjectStatus, ProjectSummary } from '@/types/domain';

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

  /** Registers a new project — the graphical alternative to inserting a row by hand (spec §26). */
  async create(input: {
    name: string;
    description: string | null;
    repository: string | null;
    environment: Environment;
    status: ProjectStatus;
    version: string | null;
  }): Promise<ProjectSummary> {
    return this.container.projects.create(input);
  }

  async update(
    id: string,
    input: Partial<{
      name: string;
      description: string | null;
      repository: string | null;
      environment: Environment;
      status: ProjectStatus;
      version: string | null;
    }>,
  ): Promise<ProjectSummary> {
    return this.container.projects.update(id, input);
  }

  /** Removes a project. Its services are unlinked, not deleted. */
  async remove(id: string): Promise<void> {
    await this.container.projects.remove(id);
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
