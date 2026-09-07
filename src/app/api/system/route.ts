import { ok, route } from '@/lib/api/response';
import { systemService } from '@/services/system.service';
import { metricQuerySchema, parseQuery } from '@/lib/api/schemas';

export const dynamic = 'force-dynamic';

/** GET /api/system — current host metrics plus one metric's history. */
export const GET = route(async ({ request }) => {
  const { type, limit } = parseQuery(request, metricQuerySchema);
  const [metrics, history] = await Promise.all([
    systemService.getMetrics(),
    systemService.getHistory(type, limit),
  ]);
  return ok({ metrics, history: { type, points: history } });
});
