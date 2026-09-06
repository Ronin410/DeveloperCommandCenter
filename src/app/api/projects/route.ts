import { ok, route } from '@/lib/api/response';
import { projectService } from '@/services/project.service';

export const dynamic = 'force-dynamic';

/** GET /api/projects (spec §9). */
export const GET = route(async () => ok(await projectService.list()));
