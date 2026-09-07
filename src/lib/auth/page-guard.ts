import 'server-only';
import { redirect } from 'next/navigation';
import { getSession, type SessionContext } from '@/lib/auth/session';

/**
 * Page-level authentication guard.
 *
 * Middleware only checks that a cookie exists (it cannot reach the database
 * from the edge runtime); this is the authoritative check every protected page
 * runs on the server before rendering anything.
 */
export async function requirePageSession(returnTo?: string): Promise<SessionContext> {
  const session = await getSession();
  if (!session) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login');
  }
  return session;
}
