import { cn } from '@/utils/format';

/**
 * Inline icon set. Twelve glyphs do not justify an icon package, and inlining
 * them keeps the CSP free of external asset hosts.
 */

const PATHS: Record<string, string> = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  server: 'M4 5h16v5H4zM4 14h16v5H4zM7.5 7.5h.01M7.5 16.5h.01',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  rocket: 'M5 15l4 4M14 4c3 0 6 3 6 6 0 4-4 8-8 10l-2-2c2-4 6-8 10-8M9 11l-4 1 3 3 1-4z',
  branch: 'M6 4v10a4 4 0 004 4h4M6 4a2 2 0 100 4 2 2 0 000-4zM18 14a2 2 0 100 4 2 2 0 000-4zM18 4a2 2 0 100 4 2 2 0 000-4zM18 8v2a4 4 0 01-4 4h-4',
  bell: 'M18 16v-5a6 6 0 10-12 0v5l-2 2h16zM10 21h4',
  timer: 'M12 8v5l3 2M12 21a8 8 0 100-16 8 8 0 000 16zM9 2h6',
  calendar: 'M4 6h16v15H4zM4 10h16M9 3v4M15 3v4',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2v.2a2 2 0 11-4 0v-.1a1.7 1.7 0 00-3-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.9H3a2 2 0 110-4h.1a1.7 1.7 0 001.2-3l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 002.9-1.2V3a2 2 0 114 0v.1a1.7 1.7 0 003 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  refresh: 'M21 12a9 9 0 11-3-6.7M21 4v5h-5',
  logout: 'M15 17l5-5-5-5M20 12H9M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h5',
  moon: 'M21 13A9 9 0 1111 3a7 7 0 0010 10z',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  check: 'M20 6L9 17l-5-5',
  play: 'M6 4l14 8-14 8z',
  pause: 'M8 5h3v14H8zM13 5h3v14h-3z',
  stop: 'M6 6h12v12H6z',
  expand: 'M4 14v6h6M20 10V4h-6M14 10l6-6M10 14l-6 6',
  close: 'M18 6L6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const path = PATHS[name] ?? PATHS.grid;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5 shrink-0', className)}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
