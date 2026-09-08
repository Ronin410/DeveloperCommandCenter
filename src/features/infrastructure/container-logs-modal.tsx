'use client';

import { useEffect, useState } from 'react';
import { apiGet, ApiError } from '@/lib/api/client';
import { Icon } from '@/components/ui/icon';

/** Read-only recent stdout/stderr for one container (spec §12). */
export function ContainerLogsModal({ containerId, containerName, onClose }: { containerId: string; containerName: string; onClose: () => void }) {
  const [lines, setLines] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiGet<{ lines: string[] }>(`/api/docker/${containerId}/logs?tail=200`)
      .then((result) => {
        if (!cancelled) setLines(result.lines);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof ApiError ? cause.message : 'Could not load logs');
      });

    return () => {
      cancelled = true;
    };
  }, [containerId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-surface-raised shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">Logs — {containerName}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-faint transition hover:text-ink" aria-label="Close">
            <Icon name="close" className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error && (
            <p role="alert" className="rounded-lg border border-offline/40 bg-offline/10 px-3 py-2 text-sm text-offline">
              {error}
            </p>
          )}
          {!error && !lines && <p className="text-sm text-ink-faint">Loading…</p>}
          {!error && lines && lines.length === 0 && <p className="text-sm text-ink-faint">No log output.</p>}
          {!error && lines && lines.length > 0 && (
            <pre className="whitespace-pre-wrap break-all font-mono text-xs text-ink-muted">{lines.join('\n')}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
