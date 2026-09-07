import 'server-only';
import { getContainer } from '@/services/container';
import type { DockerContainer } from '@/types/domain';
import { logger } from '@/lib/logger';

/**
 * DockerService (spec §12).
 *
 * Read-only for now. Container actions (restart/stop/logs) are intentionally
 * absent: the spec requires confirmation and authorization for destructive
 * operations, so they land with the phase-2 authorization work rather than as
 * an unguarded endpoint today.
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
}

export const dockerService = new DockerService();
