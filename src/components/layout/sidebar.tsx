'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/components/layout/navigation';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/utils/format';

/** Desktop sidebar (spec §5). */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-surface-raised/60 px-3 py-4 lg:flex"
    >
      <div className="px-2 pb-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-accent">Command</p>
        <p className="text-sm font-semibold tracking-tight text-ink">Developer Center</p>
      </div>

      <ul className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                  active
                    ? 'bg-surface-sunken text-ink shadow-[inset_2px_0_0_0_var(--accent)]'
                    : 'text-ink-muted hover:bg-surface-sunken/60 hover:text-ink',
                )}
              >
                <Icon name={item.icon} className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/command-center"
        className="mt-2 flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-xs text-ink-muted transition hover:border-accent hover:text-ink"
      >
        <Icon name="expand" className="size-4" />
        Kiosk view
      </Link>
    </nav>
  );
}
