import { ok, route } from '@/lib/api/response';
import { alertService } from '@/services/alert.service';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** POST /api/alerts/:id/resolve (spec §26). */
export const POST = route(async ({ params, session, ip }) => {
  const alert = await alertService.resolve(params.id ?? '');
  await audit({
    action: 'alert.resolve',
    resource: 'alert',
    resourceId: alert.id,
    userId: session.user.id,
    ipAddress: ip,
  });
  return ok(alert);
});
