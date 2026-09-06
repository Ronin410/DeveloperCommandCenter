import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/auth/page-guard';
import { focusService } from '@/services/focus.service';
import { FocusView } from '@/features/focus/focus-view';

export const metadata: Metadata = { title: 'Focus' };
export const dynamic = 'force-dynamic';

export default async function FocusPage() {
  const session = await requirePageSession('/focus');

  return (
    <FocusView
      initial={{ session: await focusService.getCurrent(session.user.id), settings: focusService.getSettings() }}
    />
  );
}
