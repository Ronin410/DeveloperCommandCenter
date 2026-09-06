import { requirePageSession } from '@/lib/auth/page-guard';
import { buildOverview } from '@/services/overview.service';
import { OverviewClient } from '@/features/overview/overview-client';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const session = await requirePageSession('/');
  const snapshot = await buildOverview(session.user.id);

  return <OverviewClient initial={snapshot} />;
}
