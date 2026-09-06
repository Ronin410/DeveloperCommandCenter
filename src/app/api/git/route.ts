import { ok, route } from '@/lib/api/response';
import { githubService } from '@/services/github.service';

export const dynamic = 'force-dynamic';

/** GET /api/git (spec §11). */
export const GET = route(async () => ok(await githubService.listRepositories()));
