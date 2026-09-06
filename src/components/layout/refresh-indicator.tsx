'use client';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/utils/format';

/** Shows when data last refreshed and lets the user force a poll (spec §31). */
export function RefreshIndicator({
  lastUpdated,
  isRefreshing,
  error,
  onRefresh,
}: {
  lastUpdated: Date;
  isRefreshing: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-ink-faint">
      {error ? (
        <span className="text-offline">Update failed — {error}</span>
      ) : (
        <span className="tabular">
          {lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      )}
      <button
        type="button"
        onClick={onRefresh}
        className="rounded-md border border-line p-1.5 transition hover:border-line-strong hover:text-ink"
        aria-label="Refresh now"
      >
        <Icon name="refresh" className={cn('size-3.5', isRefreshing && 'animate-spin')} />
      </button>
    </div>
  );
}
