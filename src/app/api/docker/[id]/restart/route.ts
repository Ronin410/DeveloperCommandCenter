import { ok, route } from '@/lib/api/response';
import { dockerService } from '@/services/docker.service';
import { audit } from '@/lib/audit';
import { forbidden } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * POST /api/docker/:id/restart — restarts a container.
 *
 * Destructive-ish (drops the container's in-memory state), so it requires
 * ADMIN or OPERATOR, same tier as removing a service or a project (spec §12:
 * confirmation lives in the UI, authorization lives here).
 */
export const POST = route(async ({ params, session, ip }) => {
  if (!['ADMIN', 'OPERATOR'].includes(session.user.role)) {
    throw forbidden('Only administrators and operators can restart a container');
  }

  const id = params.id ?? '';
  await dockerService.restart(id);
  await audit({ action: 'docker.restart', resource: 'container', resourceId: id, userId: session.user.id, ipAddress: ip });

  return ok({ ok: true });
});
