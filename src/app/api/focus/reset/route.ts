import { ok, route } from '@/lib/api/response';
import { focusService } from '@/services/focus.service';

export const dynamic = 'force-dynamic';

/** POST /api/focus/reset (spec §26). */
export const POST = route(async ({ session }) => ok(await focusService.reset(session.user.id)));
