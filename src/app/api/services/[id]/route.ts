import { ok, route } from '@/lib/api/response';
import { monitoringService } from '@/services/monitoring.service';
import { setMonitoredSchema } from '@/lib/api/schemas';
import { audit } from '@/lib/audit';
import { forbidden } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** GET /api/services/:id — detail plus recent check history. */
export const GET = route(async ({ params }) => ok(await monitoringService.getService(params.id ?? '')));

/** PATCH /api/services/:id — pause/resume health checks. Reversible, so any session may do it. */
export const PATCH = route(
  async ({ params, body, session, ip }) => {
    const service = await monitoringService.setMonitored(params.id ?? '', body.isMonitored);

    await audit({
      action: body.isMonitored ? 'service.resume' : 'service.pause',
      resource: 'service',
      resourceId: service.id,
      userId: session.user.id,
      ipAddress: ip,
    });

    return ok(service);
  },
  { schema: setMonitoredSchema },
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
