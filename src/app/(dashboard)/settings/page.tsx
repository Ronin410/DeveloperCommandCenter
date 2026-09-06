import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePageSession } from '@/lib/auth/page-guard';
import { getSelfHealth } from '@/services/overview.service';
import { getEnv } from '@/lib/env';
import { focusService } from '@/services/focus.service';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status';
import { NAV_ITEMS } from '@/components/layout/navigation';
import { formatUptime } from '@/utils/format';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

/**
 * Settings (spec §5).
 *
 * Shows configuration that is safe to display: intervals, mode and versions.
 * Secrets (DATABASE_URL, AUTH_SECRET, GITHUB_TOKEN) are deliberately reported
 * only as "configured / not configured" — never their values (spec §24).
 */
export default async function SettingsPage() {
  const session = await requirePageSession('/settings');
  const [self, env] = [await getSelfHealth(), getEnv()];
  const focus = focusService.getSettings();

  return (
    <>
      <TopBar title="Settings" />
      <main className="flex-1 px-4 py-4 lg:px-6">
        <PageHeader title="Settings" description="Configuration and platform status" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Account">
            <dl className="space-y-2 text-sm">
              <Row label="Name">{session.user.name}</Row>
              <Row label="Email">{session.user.email}</Row>
              <Row label="Role">{session.user.role}</Row>
            </dl>
          </Card>

          <Card title="Platform">
            <dl className="space-y-2 text-sm">
              <Row label="Version">v{self.version}</Row>
              <Row label="Environment">{env.NODE_ENV}</Row>
              <Row label="Mode">{self.mockMode ? 'Mock data' : 'Live data'}</Row>
              <Row label="Uptime">{formatUptime(self.uptimeSec)}</Row>
            </dl>
          </Card>

          <Card title="Monitoring">
            <dl className="space-y-2 text-sm">
              <Row label="Check interval">{env.MONITORING_INTERVAL_SECONDS}s</Row>
              <Row label="Check timeout">{env.MONITORING_TIMEOUT_MS}ms</Row>
              <Row label="UI polling">{process.env.NEXT_PUBLIC_POLL_INTERVAL_SECONDS ?? 30}s</Row>
              <Row label="Engine">
                <StatusPill status={self.monitoringEngine} />
              </Row>
            </dl>
          </Card>

          <Card title="Integrations">
            <dl className="space-y-2 text-sm">
              <Row label="Database">{env.DATABASE_URL ? 'Configured' : 'Not configured'}</Row>
              <Row label="Redis">{env.REDIS_URL ? 'Configured' : 'Not configured'}</Row>
              <Row label="GitHub">{env.GITHUB_TOKEN ? 'Configured' : 'Not configured'}</Row>
              <Row label="Docker socket">{env.DOCKER_SOCKET}</Row>
            </dl>
            <p className="mt-3 text-xs text-ink-faint">
              Secrets are never displayed. Configure them through environment variables.
            </p>
          </Card>

          <Card title="Focus defaults">
            <dl className="space-y-2 text-sm">
              <Row label="Focus">{focus.focusMinutes} min</Row>
              <Row label="Short break">{focus.shortBreakMinutes} min</Row>
              <Row label="Long break">{focus.longBreakMinutes} min</Row>
              <Row label="Sessions">{focus.sessionsBeforeLongBreak}</Row>
            </dl>
          </Card>

          <Card title="Navigation">
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-ink-muted transition hover:text-accent">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/command-center" className="text-ink-muted transition hover:text-accent">
                  Kiosk view
                </Link>
              </li>
            </ul>
          </Card>
        </div>
      </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0">
      <dt className="text-xs uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}
