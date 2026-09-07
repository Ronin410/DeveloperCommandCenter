import 'server-only';
import { getContainer } from '@/services/container';
import type { CalendarEventRecord } from '@/types/domain';

/**
 * CalendarService (spec §21). Local events only for now; Google/Outlook/Apple
 * sync will register additional sources behind the same repository port.
 */
export class CalendarService {
  private get container() {
    return getContainer();
  }

  async today(userId: string): Promise<CalendarEventRecord[]> {
    return this.container.calendar.listForDay(userId, new Date());
  }

  async upcoming(userId: string, limit = 10): Promise<CalendarEventRecord[]> {
    return this.container.calendar.listUpcoming(userId, limit);
  }
}

export const calendarService = new CalendarService();
