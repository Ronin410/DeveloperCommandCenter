'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useSession } from '@/components/layout/session-provider';
import { apiPost } from '@/lib/api/client';
import { formatLongDate } from '@/utils/format';

export function TopBar({ title }: { title: string }) {
  const { user, csrfToken } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    try {
      await apiPost('/api/auth/logout', {}, csrfToken);
      router.replace('/login');
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold uppercase tracking-[0.22em] text-ink">{title}</h1>
        <p className="truncate text-xs text-ink-faint">{formatLongDate()}</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden text-right text-xs text-ink-muted sm:block">
          <span className="block font-medium text-ink">{user.name}</span>
          <span className="block text-ink-faint">{user.role}</span>
        </span>
        <ThemeToggle />
        <button
          type="button"
          onClick={logout}
          disabled={busy}
          className="rounded-lg border border-line p-2 text-ink-muted transition hover:border-offline hover:text-offline disabled:opacity-50"
          aria-label="Sign out"
        >
          <Icon name="logout" className="size-4" />
        </button>
      </div>
    </header>
  );
}
