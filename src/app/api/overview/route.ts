import { ok, route } from '@/lib/api/response';
import { buildOverview } from '@/services/overview.service';

export const dynamic = 'force-dynamic';

/** GET /api/overview — the single payload behind the dashboard (spec §4). */
export const GET = route(async ({ session }) => ok(await buildOverview(session.user.id)));
