import type { ServiceStatus } from '@/types/domain';
import { cn } from '@/utils/format';

const STATUS_COLOR: Record<ServiceStatus, string> = {
  ONLINE: 'text-online',
  WARNING: 'text-warning',
  OFFLINE: 'text-offline',
  UNKNOWN: 'text-unknown',
};

export function StatusDot({ status, className }: { status: ServiceStatus; className?: string }) {
  return <span className={cn('status-dot', STATUS_COLOR[status], className)} aria-hidden="true" />;
}

/**
 * Status is conveyed by dot + text, never by colour alone — the dashboard has
 * to be readable at a glance and by colour-blind users (spec §28).
 */
export function StatusPill({ status, label }: { status: ServiceStatus; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-line px-2.5 py-1 text-xs font-medium tracking-wide',
        STATUS_COLOR[status],
      )}
    >
      <StatusDot status={status} />
      {label ?? status}
    </span>
  );
}

export function statusColorClass(status: ServiceStatus): string {
  return STATUS_COLOR[status];
}
