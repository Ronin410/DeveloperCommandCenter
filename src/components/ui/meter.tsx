import { cn } from '@/utils/format';

/**
 * Horizontal usage meter. Thresholds turn the bar amber/red so a glance at the
 * dashboard is enough to spot pressure (spec §4).
 */
export function Meter({
  label,
  value,
  suffix = '%',
  warnAt = 75,
  criticalAt = 90,
  max = 100,
}: {
  label: string;
  value: number;
  suffix?: string;
  warnAt?: number;
  criticalAt?: number;
  max?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const tone = value >= criticalAt ? 'bg-offline' : value >= warnAt ? 'bg-warning' : 'bg-online';

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">{label}</span>
        <span className="tabular text-sm text-ink">
          {value.toFixed(value < 10 ? 1 : 0)}
          {suffix}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
