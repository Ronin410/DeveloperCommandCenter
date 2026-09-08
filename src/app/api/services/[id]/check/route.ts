import { ok, route } from '@/lib/api/response';
import { monitoringService } from '@/services/monitoring.service';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** POST /api/services/:id/check — run one health check right now, outside the schedule. */
export const POST = route(async ({ params, session, ip }) => {
  const service = await monitoringService.checkServiceNow(params.id ?? '');

  await audit({ action: 'service.check', resource: 'service', resourceId: service.id, userId: session.user.id, ipAddress: ip });

  return ok(service);
});
