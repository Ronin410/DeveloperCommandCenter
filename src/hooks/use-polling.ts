'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_POLL_INTERVAL_SECONDS } from '@/lib/api/constants';
import { apiGet } from '@/lib/api/client';

/**
 * Polling hook (spec §31).
 *
 * Polling — not WebSockets — is the first version on purpose. It also pauses
 * while the tab is hidden, which matters for a dashboard left open all day on a
 * phone or an Echo Show.
 */
export function usePolling<T>(
  path: string,
  initialData: T,
  options: { intervalSeconds?: number; enabled?: boolean } = {},
): { data: T; error: string | null; isRefreshing: boolean; refresh: () => Promise<void>; lastUpdated: Date } {
  const intervalMs = (options.intervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS) * 1000;
  const enabled = options.enabled ?? true;

  const [data, setData] = useState<T>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsRefreshing(true);

    try {
      const next = await apiGet<T>(path);
      setData(next);
      setError(null);
      setLastUpdated(new Date());
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      inFlight.current = false;
      setIsRefreshing(false);
    }
  }, [path]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    const timer = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, intervalMs, refresh]);

  return { data, error, isRefreshing, refresh, lastUpdated };
}
