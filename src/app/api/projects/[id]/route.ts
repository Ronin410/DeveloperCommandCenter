import { ok, route } from '@/lib/api/response';
import { projectService } from '@/services/project.service';
import { updateProjectSchema } from '@/lib/api/schemas';
import { audit } from '@/lib/audit';
import { forbidden } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** GET /api/projects/:id — accepts an id or a slug. */
export const GET = route(async ({ params }) => ok(await projectService.get(params.id ?? '')));

/** PATCH /api/projects/:id — edits any subset of a project's fields. Reversible, so any session may do it. */
export const PATCH = route(
  async ({ params, body, session, ip }) => {
    const project = await projectService.update(params.id ?? '', body);

    await audit({
      action: 'project.update',
      resource: 'project',
      resourceId: project.id,
      userId: session.user.id,
      ipAddress: ip,
    });

    return ok(project);
  },
  { schema: updateProjectSchema },
);

/**
 * DELETE /api/projects/:id — permanently removes a project. Its services are
 * unlinked, not deleted, so this is less destructive than removing a service —
 * still gated to ADMIN/OPERATOR for consistency with that endpoint.
 */
export const DELETE = route(async ({ params, session, ip }) => {
  if (!['ADMIN', 'OPERATOR'].includes(session.user.role)) {
    throw forbidden('Only administrators and operators can remove a project');
  }

  await projectService.remove(params.id ?? '');
  await audit({ action: 'project.delete', resource: 'project', resourceId: params.id, userId: session.user.id, ipAddress: ip });

  return ok({ ok: true });
});
