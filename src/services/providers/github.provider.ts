import 'server-only';
import type { GitProvider } from '@/services/ports';
import type { GitRepositorySummary } from '@/types/domain';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { getCache } from '@/lib/cache';

/**
 * GitHub REST integration (spec §11).
 *
 * The token is read from the environment on the server only and never leaves
 * this module. Failures degrade to an empty list rather than breaking the page.
 *
 * `listRepositories()` is 1 + N requests to GitHub's API (the repo list, plus
 * one commits lookup per repo) — cheap to call once, expensive under the
 * dashboard's own polling loop, and GitHub rate-limits by token. A short
 * cache (spec §36) absorbs that: real data is at most `CACHE_TTL_SECONDS` old,
 * which is a fine trade for not burning the rate limit on every refresh.
 */

const CACHE_TTL_SECONDS = 60;
const CACHE_KEY = 'github:repositories';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  open_issues_count: number;
  pushed_at: string;
}

interface GitHubCommit {
  sha: string;
  commit: { message: string; author: { name: string; date: string } | null };
}

const API = 'https://api.github.com';

export class GitHubProvider implements GitProvider {
  private async fetchJson<T>(path: string): Promise<T> {
    const token = getEnv().GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN is not configured');

    const response = await fetch(`${API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(getEnv().MONITORING_TIMEOUT_MS),
    });

    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    return (await response.json()) as T;
  }

  async listRepositories(): Promise<GitRepositorySummary[]> {
    const cache = getCache();
    const cached = await cache.get<GitRepositorySummary[]>(CACHE_KEY);
    if (cached) return cached;

    try {
      const repos = await this.fetchJson<GitHubRepo[]>('/user/repos?per_page=10&sort=pushed');

      const summaries = await Promise.all(
        repos.map(async (repo) => {
          const commits = await this.fetchJson<GitHubCommit[]>(`/repos/${repo.full_name}/commits?per_page=1`).catch(
            () => [] as GitHubCommit[],
          );
          const head = commits[0];

          return {
            id: String(repo.id),
            name: repo.name,
            fullName: repo.full_name,
            defaultBranch: repo.default_branch,
            openPullRequests: 0,
            openIssues: repo.open_issues_count,
            lastCommitSha: head?.sha.slice(0, 7) ?? '',
            lastCommitMessage: head?.commit.message.split('\n')[0] ?? '',
            lastCommitAuthor: head?.commit.author?.name ?? '',
            lastCommitAt: head?.commit.author?.date ?? repo.pushed_at,
            workflowStatus: 'unknown' as const,
          };
        }),
      );

      await cache.set(CACHE_KEY, summaries, CACHE_TTL_SECONDS);
      return summaries;
    } catch (error) {
      logger.warn('GitHub integration unavailable', { error: (error as Error).message });
      return [];
    }
  }
}
