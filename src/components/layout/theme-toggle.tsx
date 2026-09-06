'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/icon';

type Theme = 'dark' | 'light';

const THEME_EVENT = 'dcc:theme-change';

/**
 * The theme lives on <html data-theme>, written before first paint by the
 * inline script in the root layout. React subscribes to that external value
 * with useSyncExternalStore instead of mirroring it in state, which keeps the
 * server render ("dark") and the client in agreement.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribe, getSnapshot, () => 'dark');

  const toggle = useCallback(() => {
    const next: Theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;

    try {
      localStorage.setItem('dcc-theme', next);
    } catch {
      // Storage can be blocked; the in-memory choice still applies.
    }

    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-lg border border-line p-2 text-ink-muted transition hover:border-line-strong hover:text-ink"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="size-4" />
    </button>
  );
}
