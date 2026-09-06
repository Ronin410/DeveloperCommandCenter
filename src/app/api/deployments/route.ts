import { ok, route } from '@/lib/api/response';
import { deploymentService } from '@/services/project.service';
import { deploymentQuerySchema, parseQuery } from '@/lib/api/schemas';

export const dynamic = 'force-dynamic';

/** GET /api/deployments (spec §10). */
export const GET = route(async ({ request }) => {
  const query = parseQuery(request, deploymentQuerySchema);
  return ok(await deploymentService.list(query));
});
