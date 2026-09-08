import { ok, route } from '@/lib/api/response';
import { monitoringService } from '@/services/monitoring.service';
import { updateServiceSchema } from '@/lib/api/schemas';
import { audit } from '@/lib/audit';
import { forbidden } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** GET /api/services/:id — detail plus recent check history. */
export const GET = route(async ({ params }) => ok(await monitoringService.getService(params.id ?? '')));

/**
 * PATCH /api/services/:id — pause/resume (`isMonitored`) and/or edit any of the
 * other fields, in the same request. Both are reversible, so any authenticated
 * session may do either — same authorization tier as creating a service.
 */
export const PATCH = route(
  async ({ params, body, session, ip }) => {
    const id = params.id ?? '';

    if (body.isMonitored !== undefined) {
      await monitoringService.setMonitored(id, body.isMonitored);
      await audit({
        action: body.isMonitored ? 'service.resume' : 'service.pause',
        resource: 'service',
        resourceId: id,
        userId: session.user.id,
        ipAddress: ip,
      });
    }

    const edits = {
      name: body.name,
      description: body.description,
      kind: body.kind,
      environment: body.environment,
      healthUrl: body.healthUrl,
      projectId: body.projectId,
    };
    const hasEdits = Object.values(edits).some((value) => value !== undefined);

    if (hasEdits) {
      await monitoringService.updateService(id, edits);
      await audit({ action: 'service.update', resource: 'service', resourceId: id, userId: session.user.id, ipAddress: ip });
    }

    return ok(await monitoringService.getService(id));
  },
  { schema: updateServiceSchema },
);

/**
 * DELETE /api/services/:id — permanently removes a service and its history.
 *
 * Destructive, so it requires ADMIN or OPERATOR (spec §3 "destructive actions
 * must require confirmation and authorization"; the confirmation itself lives
 * in the UI).
 */
export const DELETE = route(async ({ params, session, ip }) => {
  if (!['ADMIN', 'OPERATOR'].includes(session.user.role)) {
    throw forbidden('Only administrators and operators can remove a monitored service');
  }

  await monitoringService.removeService(params.id ?? '');
  await audit({ action: 'service.delete', resource: 'service', resourceId: params.id, userId: session.user.id, ipAddress: ip });

  return ok({ ok: true });
});
