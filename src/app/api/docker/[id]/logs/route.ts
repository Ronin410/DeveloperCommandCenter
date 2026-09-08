import { ok, route } from '@/lib/api/response';
import { dockerService } from '@/services/docker.service';
import { dockerLogsQuerySchema, parseQuery } from '@/lib/api/schemas';

export const dynamic = 'force-dynamic';

/** GET /api/docker/:id/logs — recent stdout/stderr lines. Read-only, any authenticated session. */
export const GET = route(async ({ params, request }) => {
  const { tail } = parseQuery(request, dockerLogsQuerySchema);
  const lines = await dockerService.logs(params.id ?? '', tail);
  return ok({ lines });
});
