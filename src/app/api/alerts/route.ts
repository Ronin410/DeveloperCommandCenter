import { ok, route } from '@/lib/api/response';
import { alertService } from '@/services/alert.service';
import { alertQuerySchema, parseQuery } from '@/lib/api/schemas';

export const dynamic = 'force-dynamic';

/** GET /api/alerts (spec §14). */
export const GET = route(async ({ request }) => {
  const query = parseQuery(request, alertQuerySchema);
  return ok(await alertService.list(query));
});
