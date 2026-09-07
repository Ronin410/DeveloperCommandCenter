import { requirePageSession } from '@/lib/auth/page-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { SessionProvider } from '@/components/layout/session-provider';

export const dynamic = 'force-dynamic';

/**
 * Authenticated shell: sidebar on desktop, bottom bar on mobile (spec §5, §30).
 * The monitoring engine starts in `instrumentation.ts`, not here, so health
 * checks run from server start rather than from the first login.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();

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
