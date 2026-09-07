import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/auth/page-guard';
import { calendarService } from '@/services/calendar.service';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Card, EmptyState } from '@/components/ui/card';
import { formatTime } from '@/utils/format';

export const metadata: Metadata = { title: 'Calendar' };
export const dynamic = 'force-dynamic';

/** Calendar section (spec §21). Local events; provider sync comes later. */
export default async function CalendarPage() {
  const session = await requirePageSession('/calendar');
  const [today, upcoming] = await Promise.all([
    calendarService.today(session.user.id),
    calendarService.upcoming(session.user.id, 10),
  ]);

  return (
    <>
      <TopBar title="Calendar" />
      <main className="flex-1 px-4 py-4 lg:px-6">
        <PageHeader title="Calendar" description="Today's schedule and what's next" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Today" flush>
            <ul className="divide-y divide-line">
              {today.map((event) => (
                <li key={event.id} className="flex gap-4 px-4 py-3">
                  <span className="tabular w-12 shrink-0 text-sm text-accent">{formatTime(event.startsAt)}</span>
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{event.title}</span>
                    {event.description && <span className="block text-xs text-ink-faint">{event.description}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {today.length === 0 && <EmptyState message="Nothing scheduled today." />}
          </Card>

          <Card title="Upcoming" flush>
            <ul className="divide-y divide-line">
              {upcoming.map((event) => (
                <li key={event.id} className="flex gap-4 px-4 py-3">
                  <span className="w-24 shrink-0 text-xs text-ink-faint">
                    {new Date(event.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{event.title}</span>
                    <span className="tabular block text-xs text-ink-faint">{formatTime(event.startsAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
            {upcoming.length === 0 && <EmptyState message="No upcoming events." />}
          </Card>
        </div>
      </main>
    </>
  );
}
