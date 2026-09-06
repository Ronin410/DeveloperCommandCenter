import { cn } from '@/utils/format';

/**
 * Dependency-free sparkline (spec §28 "gráficas simples", §39.15).
 * A 40-point latency series does not justify a charting library.
 */
export function Sparkline({
  points,
  className,
  height = 40,
  width = 160,
}: {
  points: number[];
  className?: string;
  height?: number;
  width?: number;
}) {
  if (points.length < 2) {
    return <div className={cn('h-10 text-xs text-ink-faint', className)}>No data yet</div>;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('w-full', className)}
      style={{ height }}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Trend from ${min.toFixed(0)} to ${max.toFixed(0)}`}
    >
      <polyline
        points={`0,${height} ${coords.join(' ')} ${width},${height}`}
        fill="color-mix(in srgb, var(--accent) 12%, transparent)"
        stroke="none"
      />
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
