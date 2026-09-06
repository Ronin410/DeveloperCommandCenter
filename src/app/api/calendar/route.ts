import { ok, route } from '@/lib/api/response';
import { calendarService } from '@/services/calendar.service';

export const dynamic = 'force-dynamic';

/** GET /api/calendar (spec §21). */
export const GET = route(async ({ session }) => {
  const [today, upcoming] = await Promise.all([
    calendarService.today(session.user.id),
    calendarService.upcoming(session.user.id, 10),
  ]);
  return ok({ today, upcoming });
});
