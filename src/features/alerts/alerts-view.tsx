'use client';

import { useState } from 'react';
import { usePolling } from '@/hooks/use-polling';
import { useSession } from '@/components/layout/session-provider';
import { apiPost } from '@/lib/api/client';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { RefreshIndicator } from '@/components/layout/refresh-indicator';
import { Card, EmptyState } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { SEVERITY_TONE } from '@/features/overview/panels';
import { cn, formatRelativeTime } from '@/utils/format';
import type { AlertRecord, AlertStatus } from '@/types/domain';

const FILTERS: { label: string; value: AlertStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Acknowledged', value: 'ACKNOWLEDGED' },
  { label: 'Resolved', value: 'RESOLVED' },
];

/** Alerts section (spec §14). */
export function AlertsView({ initial }: { initial: AlertRecord[] }) {
  const { csrfToken } = useSession();
  const { data, error, isRefreshing, refresh, lastUpdated } = usePolling<AlertRecord[]>('/api/alerts', initial);
  const [filter, setFilter] = useState<AlertStatus | 'ALL'>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const act = async (id: string, action: 'acknowledge' | 'resolve') => {
    setBusyId(id);
    try {
      await apiPost(`/api/alerts/${id}/${action}`, {}, csrfToken);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const visible = filter === 'ALL' ? data : data.filter((alert) => alert.status === filter);

  return (
    <>
      <TopBar title="Alerts" />
      <main className="flex-1 px-4 py-4 lg:px-6">
        <PageHeader
          title="Alerts"
          description={`${data.filter((alert) => alert.status === 'ACTIVE').length} active`}
          action={
            <RefreshIndicator lastUpdated={lastUpdated} isRefreshing={isRefreshing} error={error} onRefresh={refresh} />
          }
        />

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition',
                filter === option.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Card flush>
          <ul className="divide-y divide-line">
            {visible.map((alert) => (
              <li key={alert.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <Icon name="alert" className={cn('mt-0.5 size-4 shrink-0', SEVERITY_TONE[alert.severity])} />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{alert.title}</p>
                  {alert.description && <p className="mt-0.5 text-sm text-ink-muted">{alert.description}</p>}
                  <p className="mt-1 text-xs text-ink-faint">
                    <span className={SEVERITY_TONE[alert.severity]}>{alert.severity}</span> · {alert.type}
                    {alert.serviceName ? ` · ${alert.serviceName}` : ''} · {formatRelativeTime(alert.createdAt)}
                    {alert.occurrences > 1 ? ` · ×${alert.occurrences}` : ''} · {alert.status}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  {alert.status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => void act(alert.id, 'acknowledge')}
                      disabled={busyId === alert.id}
                      className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-muted transition hover:border-warning hover:text-warning disabled:opacity-50"
                    >
                      Acknowledge
                    </button>
                  )}
                  {alert.status !== 'RESOLVED' && (
                    <button
                      type="button"
                      onClick={() => void act(alert.id, 'resolve')}
                      disabled={busyId === alert.id}
                      className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-muted transition hover:border-online hover:text-online disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {visible.length === 0 && <EmptyState message="Nothing to show for this filter." />}
        </Card>
      </main>
    </>
  );
}
