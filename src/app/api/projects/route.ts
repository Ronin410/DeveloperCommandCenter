import { ok, route } from '@/lib/api/response';
import { projectService } from '@/services/project.service';
import { createProjectSchema } from '@/lib/api/schemas';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** GET /api/projects (spec §9). */
export const GET = route(async () => ok(await projectService.list()));

/**
 * POST /api/projects — register a new project.
 *
 * The graphical alternative to inserting a row by hand: any authenticated
 * user can add one (reversible, not destructive).
 */
export const POST = route(
  async ({ body, session, ip }) => {
    const project = await projectService.create({
      name: body.name,
      description: body.description ?? null,
      repository: body.repository ?? null,
      environment: body.environment,
      status: body.status,
      version: body.version ?? null,
    });

    await audit({
      action: 'project.create',
      resource: 'project',
      resourceId: project.id,
      userId: session.user.id,
      ipAddress: ip,
      metadata: { name: project.name, environment: project.environment },
    });

    return ok(project, { status: 201 });
  },
  { schema: createProjectSchema },
);
