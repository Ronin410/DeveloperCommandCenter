import 'server-only';
import { getContainer } from '@/services/container';
import type { GitRepositorySummary } from '@/types/domain';

/** GitHubService (spec §11). Tokens live in the environment, never in code. */
export class GitHubService {
  private get container() {
    return getContainer();
  }

  async listRepositories(): Promise<GitRepositorySummary[]> {
    return this.container.git.listRepositories();
  }
}

export const githubService = new GitHubService();
