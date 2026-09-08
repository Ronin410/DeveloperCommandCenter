import 'server-only';
import { getContainer } from '@/services/container';
import type { DockerContainer } from '@/types/domain';
import { logger } from '@/lib/logger';

/**
 * DockerService (spec §12).
 *
 * Listing degrades to "unavailable" on failure, since a Docker hiccup should
 * not break the whole Infrastructure page. Actions (restart/stop/logs) do the
 * opposite — they let the error surface, so the person who clicked the button
 * finds out it didn't work, and the route layer is where confirmation and
 * role checks live (spec §12: destructive actions require both).
 */
export class DockerService {
  private get container() {
    return getContainer();
  }

  async listContainers(): Promise<{ available: boolean; containers: DockerContainer[] }> {
    const available = await this.container.docker.isAvailable();
    if (!available) return { available: false, containers: [] };

    try {
      return { available: true, containers: await this.container.docker.listContainers() };
    } catch (error) {
      logger.warn('Docker listing failed', { error: (error as Error).message });
      return { available: false, containers: [] };
    }
  }

  async restart(id: string): Promise<void> {
    await this.container.docker.restart(id);
  }

  async stop(id: string): Promise<void> {
    await this.container.docker.stop(id);
  }

  async logs(id: string, tail = 200): Promise<string[]> {
    return this.container.docker.logs(id, tail);
  }
}

export const dockerService = new DockerService();
