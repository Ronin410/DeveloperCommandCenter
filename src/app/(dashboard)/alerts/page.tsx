import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/auth/page-guard';
import { alertService } from '@/services/alert.service';
import { AlertsView } from '@/features/alerts/alerts-view';

export const metadata: Metadata = { title: 'Alerts' };
export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  await requirePageSession('/alerts');
  return <AlertsView initial={await alertService.list({ limit: 100 })} />;
}
