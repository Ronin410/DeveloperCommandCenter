import { ok, route } from '@/lib/api/response';
import { focusService } from '@/services/focus.service';

export const dynamic = 'force-dynamic';

/** POST /api/focus/pause (spec §26). */
export const POST = route(async ({ session }) => ok(await focusService.pause(session.user.id)));
