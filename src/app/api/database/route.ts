import { ok, route } from '@/lib/api/response';
import { databaseService } from '@/services/database.service';

export const dynamic = 'force-dynamic';

/** GET /api/database (spec §13). Aggregates only — never credentials. */
export const GET = route(async () => ok(await databaseService.getStats()));
