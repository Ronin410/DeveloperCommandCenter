import type { ReactNode } from 'react';

/** Section heading used by every non-dashboard screen. */
export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-faint">{description}</p>}
      </div>
      {action}
    </div>
  );
}
