import { requirePageSession } from '@/lib/auth/page-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { SessionProvider } from '@/components/layout/session-provider';
import { startMonitoringEngine } from '@/services/monitoring.engine';
import { isMockMode } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Authenticated shell: sidebar on desktop, bottom bar on mobile (spec §5, §30).
 * The monitoring engine is started here — the first authenticated render is the
 * earliest reliable hook a Next.js server has for a background task.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();
  if (!isMockMode()) startMonitoringEngine();

  return (
    <SessionProvider value={{ user: session.user, csrfToken: session.csrfToken }}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">{children}</div>
        <MobileNav />
      </div>
    </SessionProvider>
  );
}
