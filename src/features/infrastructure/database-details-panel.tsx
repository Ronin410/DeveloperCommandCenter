'use client';

import { useState } from 'react';
import { apiGet, ApiError } from '@/lib/api/client';
import { formatRelativeTime } from '@/utils/format';
import type { DatabaseDeepStats } from '@/types/domain';

/**
 * Toggleable "deep metrics" panel (spec §13): table sizes and slow queries.
 * Loaded on demand rather than polled — several extra queries per table plus
 * `pg_stat_statements` aren't cheap enough to run every refresh cycle.
 */
export function DatabaseDetailsButton() {
  const [open, setOpen] = useState(false);
  const [deep, setDeep] = useState<DatabaseDeepStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setOpen((value) => !value);
    if (deep || loading) return;

    setLoading(true);
    setError(null);
    try {
      setDeep(await apiGet<DatabaseDeepStats>('/api/database/deep'));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load database details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void toggle()}
        className="rounded-md border border-line px-2 py-1 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-ink"
      >
        {open ? 'Hide details' : 'Details'}
      </button>

      {open && (
        <div className="mt-3 space-y-4 border-t border-line pt-4 text-sm">
          {loading && <p className="text-ink-faint">Loading…</p>}
          {error && (
            <p role="alert" className="rounded-lg border border-offline/40 bg-offline/10 px-3 py-2 text-offline">
              {error}
            </p>
          )}

          {deep && (
            <>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Largest tables</h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-ink-faint">
                      <th className="py-1 font-medium">Table</th>
                      <th className="py-1 text-right font-medium">Rows (est.)</th>
                      <th className="py-1 text-right font-medium">Total</th>
                      <th className="py-1 text-right font-medium">Indexes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {deep.tables.map((table) => (
                      <tr key={table.name}>
                        <td className="py-1.5 font-mono text-ink">{table.name}</td>
                        <td className="tabular py-1.5 text-right text-ink-muted">{table.rowEstimate.toLocaleString()}</td>
                        <td className="tabular py-1.5 text-right text-ink-muted">{table.totalMb.toLocaleString()} MB</td>
                        <td className="tabular py-1.5 text-right text-ink-muted">{table.indexMb.toLocaleString()} MB</td>
                      </tr>
                    ))}
                    {deep.tables.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-2 text-ink-faint">
                          No tables reported.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Slowest queries</h4>
                {deep.slowQueriesAvailable ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-faint">
                        <th className="py-1 font-medium">Query</th>
                        <th className="py-1 text-right font-medium">Calls</th>
                        <th className="py-1 text-right font-medium">Mean</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {deep.slowQueries.map((query, index) => (
                        <tr key={index}>
                          <td className="max-w-xs truncate py-1.5 font-mono text-ink" title={query.query}>
                            {query.query}
                          </td>
                          <td className="tabular py-1.5 text-right text-ink-muted">{query.calls.toLocaleString()}</td>
                          <td className="tabular py-1.5 text-right text-ink-muted">{query.meanMs.toLocaleString()} ms</td>
                        </tr>
                      ))}
                      {deep.slowQueries.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-2 text-ink-faint">
                            No queries recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-ink-faint">
                    The <code className="font-mono">pg_stat_statements</code> extension isn&apos;t installed on this
                    database, so per-query timing isn&apos;t available.
                  </p>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">WAL archiving</h4>
                {deep.walArchiving ? (
                  <p className="text-ink-muted">
                    Last archived {formatRelativeTime(deep.walArchiving.lastArchivedAt)}
                    {deep.walArchiving.failedCount > 0 && (
                      <span className="text-warning"> · {deep.walArchiving.failedCount} failed attempts</span>
                    )}
                  </p>
                ) : (
                  <p className="text-ink-faint">No WAL archiving activity reported.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
