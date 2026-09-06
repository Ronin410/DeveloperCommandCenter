import { ok, route } from '@/lib/api/response';
import { focusService } from '@/services/focus.service';

export const dynamic = 'force-dynamic';

/** GET /api/focus — current session plus configuration (spec §20). */
export const GET = route(async ({ session }) =>
  ok({
    session: await focusService.getCurrent(session.user.id),
    settings: focusService.getSettings(),
  }),
);
