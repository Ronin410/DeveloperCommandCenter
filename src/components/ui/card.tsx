import type { ReactNode } from 'react';
import { cn } from '@/utils/format';

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Removes inner padding for tables and dense lists. */
  flush?: boolean;
}

export function Card({ title, subtitle, action, children, className, flush }: CardProps) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border border-line bg-surface-raised shadow-[0_1px_0_0_rgba(255,255,255,0.02)]',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">{title}</h2>
            )}
            {subtitle && <p className="mt-0.5 truncate text-xs text-ink-faint">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn('min-w-0 flex-1', flush ? '' : 'p-4')}>{children}</div>
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-ink-faint">{message}</p>;
}
