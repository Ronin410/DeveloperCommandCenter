'use client';

import { usePolling } from '@/hooks/use-polling';
import { StatusDot, statusColorClass } from '@/components/ui/status';
import { DEPLOYMENT_TONE } from '@/features/overview/panels';
import { cn, formatClock, formatLatency, formatLongDate, formatPercent, formatTime } from '@/utils/format';
import type { OverviewSnapshot } from '@/types/domain';

/**
 * Kiosk / Echo Show view (spec §18).
 *
 * No navigation, oversized type, landscape-first grid and a faster refresh.
 * It consumes the same /api/overview payload as every other client — the Echo
 * Show is just another consumer of the API, never the core of the system.
 */
export function KioskView({ initial }: { initial: OverviewSnapshot }) {
  const { data } = usePolling<OverviewSnapshot>('/api/overview', initial, { intervalSeconds: 15 });

  const online = data.services.filter((service) => service.status === 'ONLINE').length;
  const criticalAlert = data.alerts.find((alert) => alert.severity === 'CRITICAL' || alert.severity === 'ERROR');
  // Anchored to the snapshot's own timestamp: a pure function of the props,
  // so the render stays idempotent between polls.
  const snapshotTime = new Date(data.generatedAt).getTime();
  const nextEvents = data.events.filter((event) => new Date(event.endsAt).getTime() >= snapshotTime).slice(0, 3);

  return (
    <main className="min-h-dvh bg-surface px-6 py-5 text-ink">
      <header className="mb-5 flex items-baseline justify-between border-b border-line pb-3">
        <h1 className="text-xl font-semibold uppercase tracking-[0.25em] text-accent">Developer Command Center</h1>
        <p className="text-lg text-ink-muted">{formatLongDate()}</p>
      </header>

      <div className="grid grid-cols-1 gap-5 landscape:grid-cols-3">
        <section className="landscape:col-span-2">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-ink-faint">
            Services · {online}/{data.services.length} online
          </h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface-raised">
            {data.services.slice(0, 6).map((service) => (
              <li key={service.id} className="flex items-center justify-between px-5 py-3">
                <span className="flex items-center gap-3">
                  <StatusDot status={service.status} className="!size-3" />
                  <span className="text-2xl font-medium">{service.name}</span>
                </span>
                <span className="flex items-center gap-6">
                  <span className={cn('text-xl font-semibold', statusColorClass(service.status))}>{service.status}</span>
                  <span className="tabular w-24 text-right text-xl text-ink-muted">
                    {formatLatency(service.latencyMs)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-5">
          <div className="rounded-xl border border-line bg-surface-raised px-5 py-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-ink-faint">System</h2>
            <dl className="space-y-2 text-2xl">
              <Stat label="CPU" value={formatPercent(data.system.cpuPct)} />
              <Stat label="RAM" value={formatPercent(data.system.ramPct)} />
              <Stat label="Disk" value={formatPercent(data.system.diskPct)} />
            </dl>
          </div>

          <div className="rounded-xl border border-line bg-surface-raised px-5 py-4 text-center">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-ink-faint">Focus</h2>
            <p className="tabular text-5xl font-semibold">{formatClock(data.focus.remainingSec)}</p>
            <p className="mt-1 text-sm text-ink-faint">
              Session {data.focus.sessionIndex} / {data.focus.totalSessions}
            </p>
          </div>
        </section>
      </div>

      {criticalAlert && (
        <p className="mt-5 rounded-xl border border-offline/40 bg-offline/10 px-5 py-3 text-xl text-offline">
          ⚠ {criticalAlert.title}
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 landscape:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-ink-faint">Next up</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface-raised">
            {nextEvents.map((event) => (
              <li key={event.id} className="flex items-baseline gap-5 px-5 py-3">
                <span className="tabular w-16 shrink-0 text-xl text-accent">{formatTime(event.startsAt)}</span>
                <span className="truncate text-xl">{event.title}</span>
              </li>
            ))}
            {nextEvents.length === 0 && <li className="px-5 py-3 text-lg text-ink-faint">Nothing scheduled.</li>}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-ink-faint">Deployments</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface-raised">
            {data.deployments.slice(0, 3).map((deployment) => (
              <li key={deployment.id} className="flex items-baseline justify-between gap-4 px-5 py-3">
                <span className="truncate text-xl">
                  {deployment.projectName} <span className="tabular text-ink-muted">{deployment.version}</span>
                </span>
                <span className={cn('shrink-0 text-lg font-semibold', DEPLOYMENT_TONE[deployment.status])}>
                  {deployment.status}
                </span>
              </li>
            ))}
            {data.deployments.length === 0 && <li className="px-5 py-3 text-lg text-ink-faint">No deployments.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-base uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="tabular font-semibold">{value}</dd>
    </div>
  );
}
