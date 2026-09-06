import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { LoginForm } from '@/features/auth/login-form';
import { isMockMode } from '@/lib/env';
import { getEnv, DEV_MOCK_PASSWORD } from '@/lib/env';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getSession()) redirect('/');

  const { next } = await searchParams;
  const env = getEnv();
  // The demo hint is only rendered outside production, and only in mock mode.
  const demo =
    isMockMode() && env.NODE_ENV !== 'production' && !env.MOCK_ADMIN_PASSWORD
      ? { email: env.MOCK_ADMIN_EMAIL, password: DEV_MOCK_PASSWORD }
      : null;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-accent">Developer</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Command Center</h1>
          <p className="mt-2 text-sm text-ink-faint">Sign in to access your operations console.</p>
        </div>

        <LoginForm nextPath={next ?? '/'} demo={demo} />

        <p className="mt-6 text-center text-xs text-ink-faint">
          Protected by rate limiting, brute-force detection and server-side sessions.
        </p>
      </div>
    </main>
  );
}
