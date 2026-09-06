'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/components/layout/session-provider';
import { apiGet, apiPost } from '@/lib/api/client';
import { TopBar } from '@/components/layout/top-bar';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { FocusPanel } from '@/features/overview/panels';
import type { FocusSessionState, FocusSettings } from '@/types/domain';

interface FocusPayload {
  session: FocusSessionState;
  settings: FocusSettings;
}

/**
 * Focus / Pomodoro (spec §20).
 *
 * The countdown ticks locally every second for a smooth display, and
 * re-synchronises with the server every 15 seconds — the server remains the
 * source of truth so the same session is visible from any client.
 */
export function FocusView({ initial }: { initial: FocusPayload }) {
  const { csrfToken } = useSession();
  const [payload, setPayload] = useState(initial);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const tick = setInterval(() => {
      setPayload((current) => {
        if (current.session.status !== 'RUNNING' || current.session.remainingSec <= 0) return current;
        return {
          ...current,
          session: {
            ...current.session,
            elapsedSec: current.session.elapsedSec + 1,
            remainingSec: current.session.remainingSec - 1,
          },
        };
      });
    }, 1000);

    const sync = setInterval(() => {
      void apiGet<FocusPayload>('/api/focus').then(setPayload).catch(() => undefined);
    }, 15_000);

    return () => {
      clearInterval(tick);
      clearInterval(sync);
    };
  }, []);

  const act = async (action: 'start' | 'pause' | 'resume' | 'stop' | 'reset', type?: FocusSessionState['type']) => {
    setPending(true);
    try {
      const session = await apiPost<FocusSessionState>(
        `/api/focus/${action}`,
        action === 'start' ? { type: type ?? 'FOCUS' } : {},
        csrfToken,
      );
      setPayload((current) => ({ ...current, session }));
    } finally {
      setPending(false);
    }
  };

  const { settings } = payload;

  return (
    <>
      <TopBar title="Focus" />
      <main className="flex-1 px-4 py-4 lg:px-6">
        <PageHeader title="Focus mode" description="Pomodoro timer synced across every device" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FocusPanel focus={payload.session} onAction={(action) => void act(action)} pending={pending} compact />
          </div>

          <Card title="Configuration">
            <dl className="space-y-2 text-sm">
              <Row label="Focus">{settings.focusMinutes} min</Row>
              <Row label="Short break">{settings.shortBreakMinutes} min</Row>
              <Row label="Long break">{settings.longBreakMinutes} min</Row>
              <Row label="Sessions">{settings.sessionsBeforeLongBreak}</Row>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => void act('start', 'SHORT_BREAK')}
                disabled={pending}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted transition hover:border-accent hover:text-ink disabled:opacity-50"
              >
                Short break
              </button>
              <button
                type="button"
                onClick={() => void act('start', 'LONG_BREAK')}
                disabled={pending}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-muted transition hover:border-accent hover:text-ink disabled:opacity-50"
              >
                Long break
              </button>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-0">
      <dt className="text-xs uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="tabular text-ink">{children}</dd>
    </div>
  );
}
