'use client';

import { useState } from 'react';
import { usePolling } from '@/hooks/use-polling';
import { useSession } from '@/components/layout/session-provider';
import { apiPost } from '@/lib/api/client';
import { TopBar } from '@/components/layout/top-bar';
import { RefreshIndicator } from '@/components/layout/refresh-indicator';
import {
  AlertsPanel,
  CalendarPanel,
  DeploymentsPanel,
  FocusPanel,
  ProjectsPanel,
  SelfHealthPanel,
  ServicesPanel,
  SystemPanel,
} from '@/features/overview/panels';
import type { OverviewSnapshot } from '@/types/domain';

/**
 * The main screen (spec §4).
 *
 * Rendered on the server first, then kept fresh by polling /api/overview — so
 * it is readable instantly and never shows a loading spinner on refresh.
 */
export function OverviewClient({ initial }: { initial: OverviewSnapshot }) {
  const { csrfToken } = useSession();
  const { data, error, isRefreshing, refresh, lastUpdated } = usePolling<OverviewSnapshot>('/api/overview', initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [focusPending, setFocusPending] = useState(false);

  const alertAction = async (id: string, action: 'acknowledge' | 'resolve') => {
    setBusyId(id);
    try {
      await apiPost(`/api/alerts/${id}/${action}`, {}, csrfToken);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const focusAction = async (action: 'start' | 'pause' | 'resume' | 'stop' | 'reset') => {
    setFocusPending(true);
    try {
      await apiPost(`/api/focus/${action}`, action === 'start' ? { type: 'FOCUS' } : {}, csrfToken);
      await refresh();
    } finally {
      setFocusPending(false);
    }
  };

  return (
    <>
      <TopBar title="Developer Command Center" />

      <main className="flex-1 px-4 py-4 lg:px-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-xs text-ink-faint">
            {data.services.filter((service) => service.status === 'ONLINE').length}/{data.services.length} services
            online · {data.alerts.length} open alert{data.alerts.length === 1 ? '' : 's'}
          </p>
          <RefreshIndicator lastUpdated={lastUpdated} isRefreshing={isRefreshing} error={error} onRefresh={refresh} />
        </div>

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ServicesPanel services={data.services} />
          <SystemPanel system={data.system} />
          <ProjectsPanel projects={data.projects} />
          <AlertsPanel
            alerts={data.alerts}
            busyId={busyId}
            onAcknowledge={(id) => void alertAction(id, 'acknowledge')}
            onResolve={(id) => void alertAction(id, 'resolve')}
          />
          <FocusPanel focus={data.focus} onAction={(action) => void focusAction(action)} pending={focusPending} />
          <CalendarPanel events={data.events} />
          <DeploymentsPanel deployments={data.deployments} />
          <SelfHealthPanel self={data.self} />
        </div>
      </main>
    </>
  );
}
