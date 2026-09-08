/**
 * Minimal inline-SVG trend line. No charting library: a dozen lines of SVG
 * covers "is this metric trending up or down", which is all a sparkline is
 * for — the same reasoning that keeps the icon set hand-drawn (see icon.tsx).
 */
export function Sparkline({ points, className }: { points: number[]; className?: string }) {
  if (points.length < 2) return null;

  const width = 100;
  const height = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);

  const coords = points.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  const linePath = `M${coords.join(' L')}`;
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d={areaPath} fill="currentColor" opacity="0.12" />
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
