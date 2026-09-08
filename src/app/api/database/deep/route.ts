import { ok, route } from '@/lib/api/response';
import { databaseService } from '@/services/database.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/database/deep (spec §13 "deep metrics") — table sizes, slow
 * queries (when `pg_stat_statements` is installed) and WAL archiving status.
 * Split from `GET /api/database` because it costs more (several extra
 * queries) and the dashboard's main polling loop doesn't need it every cycle.
 */
export const GET = route(async () => ok(await databaseService.getDeepStats()));
