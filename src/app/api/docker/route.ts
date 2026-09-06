import { ok, route } from '@/lib/api/response';
import { dockerService } from '@/services/docker.service';

export const dynamic = 'force-dynamic';

/** GET /api/docker (spec §12). Read-only. */
export const GET = route(async () => ok(await dockerService.listContainers()));
