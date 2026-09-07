import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/auth/page-guard';
import { buildOverview } from '@/services/overview.service';
import { KioskView } from '@/features/overview/kiosk-view';

export const metadata: Metadata = { title: 'Command Center' };
export const dynamic = 'force-dynamic';

/** Always-on kiosk view for Echo Show / wall displays (spec §18). */
export default async function CommandCenterPage() {
  const session = await requirePageSession('/command-center');
  return <KioskView initial={await buildOverview(session.user.id)} />;
}
