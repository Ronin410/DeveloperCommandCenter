'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiPost } from '@/lib/api/client';

/**
 * Login form. Credentials go to /api/auth/login, which sets an httpOnly
 * cookie — the token is never handled by JavaScript.
 */
export function LoginForm({
  nextPath,
  demo,
}: {
  nextPath: string;
  demo: { email: string; password: string } | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(demo?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      // The login endpoint is CSRF-exempt by necessity: there is no session yet.
      await apiPost('/api/auth/login', { email, password }, '');
      router.replace(nextPath.startsWith('/') ? nextPath : '/');
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-line bg-surface-raised p-6"
      noValidate
    >
      <div>
        <label htmlFor="email" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">
          Email
        </label>
        <input
          id="email"
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted">
          Password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent"
          placeholder="••••••••••••"
        />
      </div>

      {error && (
        <p role="alert" data-testid="login-error" className="rounded-lg border border-offline/40 bg-offline/10 px-3 py-2 text-sm text-offline">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-surface transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      {demo && (
        <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-faint">
          Mock mode is enabled. Demo credentials: <span className="text-ink">{demo.email}</span> /{' '}
          <span className="text-ink">{demo.password}</span>
        </p>
      )}
    </form>
  );
}
