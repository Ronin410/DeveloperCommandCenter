import { ok, route } from '@/lib/api/response';
import { monitoringService } from '@/services/monitoring.service';

export const dynamic = 'force-dynamic';

/** GET /api/services/:id — detail plus recent check history. */
export const GET = route(async ({ params }) => ok(await monitoringService.getService(params.id ?? '')));
