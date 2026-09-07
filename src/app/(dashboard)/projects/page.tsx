import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/auth/page-guard';
import { projectService, deploymentService } from '@/services/project.service';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Card, EmptyState } from '@/components/ui/card';
import { formatRelativeTime } from '@/utils/format';

export const metadata: Metadata = { title: 'Projects' };
export const dynamic = 'force-dynamic';

const ENV_TONE: Record<string, string> = {
  PRODUCTION: 'text-online',
  STAGING: 'text-warning',
  DEVELOPMENT: 'text-info',
};

/** Projects section (spec §9). Multiple projects are first-class. */
export default async function ProjectsPage() {
  await requirePageSession('/projects');

  const [projects, latest] = await Promise.all([projectService.list(), deploymentService.latestPerProject()]);

  return (
    <>
      <TopBar title="Projects" />
      <main className="flex-1 px-4 py-4 lg:px-6">
        <PageHeader title="Projects" description={`${projects.length} projects tracked`} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const deployment = latest.get(project.id);

            return (
              <Card key={project.id} title={project.name} subtitle={project.repository ?? undefined}>
                <p className="text-sm text-ink-muted">{project.description ?? 'No description.'}</p>

                <dl className="mt-4 space-y-2 text-sm">
                  <Row label="Environment">
                    <span className={ENV_TONE[project.environment] ?? 'text-ink'}>{project.environment}</span>
                  </Row>
                  <Row label="Status">{project.status}</Row>
                  <Row label="Version">
                    <span className="tabular">{project.version ?? '—'}</span>
                  </Row>
                  <Row label="Services">
                    {project.healthyServices}/{project.serviceCount} healthy
                  </Row>
                  <Row label="Last deployment">
                    {deployment ? `${deployment.version} · ${formatRelativeTime(deployment.startedAt)}` : '—'}
                  </Row>
                </dl>
              </Card>
            );
          })}
        </div>

        {projects.length === 0 && <EmptyState message="No projects registered yet." />}
      </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-0">
      <dt className="text-xs uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}
