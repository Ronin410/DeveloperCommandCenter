import { ok, route } from '@/lib/api/response';
import { focusService } from '@/services/focus.service';
import { focusStartSchema } from '@/lib/api/schemas';

export const dynamic = 'force-dynamic';

/** POST /api/focus/start (spec §26). */
export const POST = route(
  async ({ session, body }) =>
    ok(
      await focusService.start(session.user.id, {
        type: body.type,
        label: body.label ?? null,
        ...(body.durationSec ? { durationSec: body.durationSec } : {}),
      }),
    ),
  { schema: focusStartSchema },
);
