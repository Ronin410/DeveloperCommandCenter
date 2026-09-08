import { ok, route } from '@/lib/api/response';
import { dockerService } from '@/services/docker.service';
import { audit } from '@/lib/audit';
import { forbidden } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** POST /api/docker/:id/stop — stops a container. Same authorization tier as restart. */
export const POST = route(async ({ params, session, ip }) => {
  if (!['ADMIN', 'OPERATOR'].includes(session.user.role)) {
    throw forbidden('Only administrators and operators can stop a container');
  }

  const id = params.id ?? '';
  await dockerService.stop(id);
  await audit({ action: 'docker.stop', resource: 'container', resourceId: id, userId: session.user.id, ipAddress: ip });

  return ok({ ok: true });
});
