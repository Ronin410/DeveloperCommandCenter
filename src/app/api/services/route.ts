import { ok, route } from '@/lib/api/response';
import { monitoringService } from '@/services/monitoring.service';
import { parseQuery, serviceQuerySchema } from '@/lib/api/schemas';

export const dynamic = 'force-dynamic';

/** GET /api/services (spec §26). */
export const GET = route(async ({ request }) => {
  const query = parseQuery(request, serviceQuerySchema);
  return ok(await monitoringService.listServices(query));
});
