import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/auth/page-guard';
import { deploymentService } from '@/services/project.service';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Card, EmptyState } from '@/components/ui/card';
import { DEPLOYMENT_TONE } from '@/features/overview/panels';
import { cn, formatRelativeTime, formatUptime } from '@/utils/format';

export const metadata: Metadata = { title: 'Deployments' };
export const dynamic = 'force-dynamic';

/** Deployments section (spec §10). */
export default async function DeploymentsPage() {
  await requirePageSession('/deployments');
  const deployments = await deploymentService.list({ limit: 50 });

  return (
    <>
      <TopBar title="Deployments" />
      <main className="flex-1 px-4 py-4 lg:px-6">
        <PageHeader title="Deployments" description="Release history across every project" />

        <Card flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.65rem] uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-2 font-medium">Project</th>
                  <th className="px-4 py-2 font-medium">Environment</th>
                  <th className="px-4 py-2 font-medium">Version</th>
                  <th className="px-4 py-2 font-medium">Branch</th>
                  <th className="px-4 py-2 font-medium">Commit</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Author</th>
                  <th className="px-4 py-2 font-medium">Started</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {deployments.map((deployment) => (
                  <tr key={deployment.id} className="hover:bg-surface-sunken/40">
                    <td className="px-4 py-2.5 font-medium text-ink">{deployment.projectName}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{deployment.environment}</td>
                    <td className="tabular px-4 py-2.5 text-ink-muted">{deployment.version}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{deployment.branch}</td>
                    <td className="tabular px-4 py-2.5 text-ink-faint">{deployment.commitSha.slice(0, 7)}</td>
                    <td className={cn('px-4 py-2.5 font-medium', DEPLOYMENT_TONE[deployment.status])}>
                      {deployment.status}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{deployment.author}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-faint">{formatRelativeTime(deployment.startedAt)}</td>
                    <td className="tabular px-4 py-2.5 text-xs text-ink-faint">
                      {deployment.durationSec ? formatUptime(deployment.durationSec) || `${deployment.durationSec}s` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {deployments.length === 0 && <EmptyState message="No deployments recorded." />}
          </div>
        </Card>
      </main>
    </>
  );
}
