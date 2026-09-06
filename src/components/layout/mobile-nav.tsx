'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/components/layout/navigation';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/utils/format';

/**
 * Mobile bottom bar (spec §5, §30).
 *
 * Only the four primary destinations are shown; everything else lives behind
 * "More" so the critical information keeps the screen.
 */
export function MobileNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.primary);

  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-raised/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[0.65rem] font-medium transition',
                  active ? 'text-accent' : 'text-ink-faint',
                )}
              >
                <Icon name={item.icon} className="size-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <Link
            href="/settings"
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 text-[0.65rem] font-medium transition',
              pathname.startsWith('/settings') ? 'text-accent' : 'text-ink-faint',
            )}
          >
            <Icon name="settings" className="size-5" />
            More
          </Link>
        </li>
      </ul>
    </nav>
  );
}
