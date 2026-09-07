'use client';

import { usePolling } from '@/hooks/use-polling';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { RefreshIndicator } from '@/components/layout/refresh-indicator';
import { Card, EmptyState } from '@/components/ui/card';
import { Meter } from '@/components/ui/meter';
import { StatusPill } from '@/components/ui/status';
import { cn, formatBytesMb, formatLatency, formatPercent, formatRelativeTime, formatUptime } from '@/utils/format';
import type { DatabaseStats, DockerContainer, ServiceSummary } from '@/types/domain';

export interface InfrastructureSnapshot {
  services: ServiceSummary[];
  docker: { available: boolean; containers: DockerContainer[] };
  database: DatabaseStats;
}

/**
 * Infrastructure section (spec §6, §12, §13).
 * Each service exposes name, status, latency, uptime, last check, environment
 * and version — the seven fields the spec asks for.
 */
export function InfrastructureView({ initial }: { initial: InfrastructureSnapshot }) {
  const services = usePolling<ServiceSummary[]>('/api/services', initial.services);
  const docker = usePolling<InfrastructureSnapshot['docker']>('/api/docker', initial.docker);
  const database = usePolling<DatabaseStats>('/api/database', initial.database);

  return (
    <>
      <TopBar title="Infrastructure" />
      <main className="flex-1 px-4 py-4 lg:px-6">
        <PageHeader
          title="Infrastructure"
          description="Services, containers and datastores"
          action={
            <RefreshIndicator
              lastUpdated={services.lastUpdated}
              isRefreshing={services.isRefreshing}
              error={services.error}
              onRefresh={() => {
                void services.refresh();
                void docker.refresh();
                void database.refresh();
              }}
            />
          }
        />

        <Card title="Services" flush className="mb-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[0.65rem] uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Latency</th>
                  <th className="px-4 py-2 font-medium">Uptime</th>
                  <th className="px-4 py-2 font-medium">Last check</th>
                  <th className="px-4 py-2 font-medium">Environment</th>
                  <th className="px-4 py-2 font-medium">Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {services.data.map((service) => (
                  <tr key={service.id} id={service.slug} className="hover:bg-surface-sunken/40">
                    <td className="px-4 py-2.5">
                      <span className="block font-medium text-ink">{service.name}</span>
                      <span className="block text-xs text-ink-faint">{service.kind}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={service.status} />
                    </td>
                    <td className="tabular px-4 py-2.5 text-ink-muted">{formatLatency(service.latencyMs)}</td>
                    <td className="tabular px-4 py-2.5 text-ink-muted">{formatPercent(service.uptimePct, 2)}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-faint">{formatRelativeTime(service.lastCheckAt)}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-muted">{service.environment}</td>
                    <td className="tabular px-4 py-2.5 text-xs text-ink-muted">{service.version ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {services.data.length === 0 && <EmptyState message="No services registered." />}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card title="Docker" subtitle={docker.data.available ? `${docker.data.containers.length} containers` : 'Unavailable'} flush>
            {docker.data.available ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[0.65rem] uppercase tracking-wider text-ink-faint">
                      <th className="px-4 py-2 font-medium">Container</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">CPU</th>
                      <th className="px-4 py-2 font-medium">RAM</th>
                      <th className="px-4 py-2 font-medium">Uptime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {docker.data.containers.map((container) => (
                      <tr key={container.id}>
                        <td className="px-4 py-2.5">
                          <span className="block font-medium text-ink">{container.name}</span>
                          <span className="block truncate text-xs text-ink-faint">{container.image}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusPill status={container.status} label={container.state} />
                        </td>
                        <td className={cn('tabular px-4 py-2.5', container.cpuPct > 80 ? 'text-warning' : 'text-ink-muted')}>
                          {formatPercent(container.cpuPct, 1)}
                        </td>
                        <td className="tabular px-4 py-2.5 text-ink-muted">{formatBytesMb(container.memoryMb)}</td>
                        <td className="px-4 py-2.5 text-xs text-ink-faint">{formatUptime(container.uptimeSec)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="Docker socket is not reachable from this instance." />
            )}
          </Card>

          <Card title="Database" subtitle={database.data.version}>
            <div className="space-y-4">
              <Meter
                label="Connections"
                value={database.data.connections}
                max={Math.max(1, database.data.maxConnections)}
                suffix=""
                warnAt={database.data.maxConnections * 0.7}
                criticalAt={database.data.maxConnections * 0.9}
              />
              <Meter
                label="Storage"
                value={database.data.storageMb}
                max={Math.max(1, database.data.storageLimitMb)}
                suffix=" MB"
                warnAt={database.data.storageLimitMb * 0.75}
                criticalAt={database.data.storageLimitMb * 0.9}
              />
              <Meter label="CPU" value={database.data.cpuPct} />
              <Meter label="Memory" value={database.data.memoryPct} />
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              <div>
                <dt className="text-[0.65rem] uppercase tracking-wider text-ink-faint">Latency</dt>
                <dd className="tabular mt-1 text-ink">{formatLatency(database.data.latencyMs)}</dd>
              </div>
              <div>
                <dt className="text-[0.65rem] uppercase tracking-wider text-ink-faint">Last backup</dt>
                <dd className="mt-1 text-ink">{formatRelativeTime(database.data.lastBackupAt)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </main>
    </>
  );
}
