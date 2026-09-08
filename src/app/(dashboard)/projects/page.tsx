import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/auth/page-guard';
import { projectService, deploymentService } from '@/services/project.service';
import { ProjectsView } from '@/features/projects/projects-view';
import type { DeploymentRecord } from '@/types/domain';

export const metadata: Metadata = { title: 'Projects' };
export const dynamic = 'force-dynamic';

/** Projects section (spec §9). Multiple projects are first-class. */
export default async function ProjectsPage() {
  await requirePageSession('/projects');

  const [projects, latest] = await Promise.all([projectService.list(), deploymentService.latestPerProject()]);

  // A Map can't cross the server/client boundary as a prop, so flatten it to a plain object.
  const latestDeployments: Record<string, DeploymentRecord> = Object.fromEntries(latest);

  return <ProjectsView initial={{ projects, latestDeployments }} />;
}
