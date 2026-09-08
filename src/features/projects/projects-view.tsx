'use client';

import { useState } from 'react';
import { usePolling } from '@/hooks/use-polling';
import { useSession } from '@/components/layout/session-provider';
import { apiDelete, ApiError } from '@/lib/api/client';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { RefreshIndicator } from '@/components/layout/refresh-indicator';
import { Card, EmptyState } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { AddProjectForm } from '@/features/projects/add-project-form';
import { EditProjectForm } from '@/features/projects/edit-project-form';
import { formatRelativeTime } from '@/utils/format';
import type { DeploymentRecord, ProjectSummary } from '@/types/domain';

const ENV_TONE: Record<string, string> = {
  PRODUCTION: 'text-online',
  STAGING: 'text-warning',
  DEVELOPMENT: 'text-info',
};

export interface ProjectsSnapshot {
  projects: ProjectSummary[];
  /** Last deployment per project id, keyed since a Map can't cross the server/client boundary. */
  latestDeployments: Record<string, DeploymentRecord>;
}

/** Projects section (spec §9). Multiple projects are first-class, and can now be added/edited/removed from here. */
export function ProjectsView({ initial }: { initial: ProjectsSnapshot }) {
  const { csrfToken, user } = useSession();
  const projects = usePolling<ProjectSummary[]>('/api/projects', initial.projects);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectSummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const canDelete = user.role === 'ADMIN' || user.role === 'OPERATOR';

  const removeProject = async (project: ProjectSummary) => {
    if (!window.confirm(`Remove "${project.name}"? Its services will be kept, unlinked from this project.`)) return;

    setBusyId(project.id);
    setRowError(null);
    try {
      await apiDelete(`/api/projects/${project.id}`, csrfToken);
      await projects.refresh();
    } catch (cause) {
      setRowError(cause instanceof ApiError ? cause.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <TopBar title="Projects" />
      <main className="flex-1 px-4 py-4 lg:px-6">
        <PageHeader
          title="Projects"
          description={`${projects.data.length} projects tracked`}
          action={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingProject(null);
                  setShowAddForm((value) => !value);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-ink"
              >
                <Icon name="plus" className="size-3.5" />
                Add project
              </button>
              <RefreshIndicator
                lastUpdated={projects.lastUpdated}
                isRefreshing={projects.isRefreshing}
                error={projects.error}
                onRefresh={() => void projects.refresh()}
              />
            </div>
          }
        />

        {showAddForm && (
          <AddProjectForm
            onClose={() => setShowAddForm(false)}
            onCreated={() => {
              setShowAddForm(false);
              void projects.refresh();
            }}
          />
        )}

        {editingProject && (
          <EditProjectForm
            project={editingProject}
            onClose={() => setEditingProject(null)}
            onSaved={() => {
              setEditingProject(null);
              void projects.refresh();
            }}
          />
        )}

        {rowError && (
          <p role="alert" className="mb-4 rounded-lg border border-offline/40 bg-offline/10 px-3 py-2 text-sm text-offline">
            {rowError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.data.map((project) => {
            const deployment = initial.latestDeployments[project.id];
            const busy = busyId === project.id;

            return (
              <Card
                key={project.id}
                title={project.name}
                subtitle={project.repository ?? undefined}
                action={
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingProject(project);
                      }}
                      disabled={busy}
                      title="Edit"
                      aria-label={`Edit ${project.name}`}
                      className="rounded-md border border-line p-1.5 text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-40"
                    >
                      <Icon name="edit" className="size-3.5" />
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void removeProject(project)}
                        disabled={busy}
                        title="Remove"
                        aria-label={`Remove ${project.name}`}
                        className="rounded-md border border-line p-1.5 text-ink-muted transition hover:border-offline hover:text-offline disabled:opacity-40"
                      >
                        <Icon name="trash" className="size-3.5" />
                      </button>
                    )}
                  </div>
                }
              >
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

        {projects.data.length === 0 && <EmptyState message="No projects registered yet." />}
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
