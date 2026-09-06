import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/auth/page-guard';
import { githubService } from '@/services/github.service';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Card, EmptyState } from '@/components/ui/card';
import { cn, formatRelativeTime } from '@/utils/format';

export const metadata: Metadata = { title: 'Git' };
export const dynamic = 'force-dynamic';

const WORKFLOW_TONE: Record<string, string> = {
  success: 'text-online',
  failure: 'text-offline',
  running: 'text-info',
  unknown: 'text-unknown',
};

/** Git section (spec §11). Uses mock data until GITHUB_TOKEN is configured. */
export default async function GitPage() {
  await requirePageSession('/git');
  const repositories = await githubService.listRepositories();

  return (
    <>
      <TopBar title="Git" />
      <main className="flex-1 px-4 py-4 lg:px-6">
        <PageHeader title="Repositories" description="Commits, pull requests and workflow status" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {repositories.map((repo) => (
            <Card key={repo.id} title={repo.name} subtitle={repo.fullName}>
              <p className="truncate text-sm text-ink">{repo.lastCommitMessage || 'No commits yet'}</p>
              <p className="mt-1 text-xs text-ink-faint">
                <span className="tabular">{repo.lastCommitSha}</span>
                {repo.lastCommitAuthor ? ` · ${repo.lastCommitAuthor}` : ''} · {formatRelativeTime(repo.lastCommitAt)}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
                <span className="text-ink-muted">
                  <span className="tabular text-ink">{repo.openPullRequests}</span> PRs ·{' '}
                  <span className="tabular text-ink">{repo.openIssues}</span> issues
                </span>
                <span className={cn('font-medium uppercase tracking-wider', WORKFLOW_TONE[repo.workflowStatus])}>
                  {repo.workflowStatus}
                </span>
              </div>
            </Card>
          ))}
        </div>

        {repositories.length === 0 && (
          <EmptyState message="No repositories available. Configure GITHUB_TOKEN to enable the integration." />
        )}
      </main>
    </>
  );
}
