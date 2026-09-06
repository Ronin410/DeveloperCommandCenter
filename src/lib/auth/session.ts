import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { getEnv } from '@/lib/env';
import { getAuthStore } from '@/lib/auth/store';
import { verifyPassword } from '@/lib/auth/password';
import { logger } from '@/lib/logger';
import { forbidden, tooManyRequests, unauthorized } from '@/lib/errors';
import type { AuthenticatedUser } from '@/types/domain';

/**
 * Session management.
 *
 * The cookie holds an opaque 32-byte token; only its SHA-256 is stored, so a
 * leaked database cannot be replayed. Sessions are server-side, which makes
 * "log out everywhere" and 2FA step-up trivial to add later (spec §2).
 */

export const SESSION_COOKIE = 'dcc_session';
export const CSRF_HEADER = 'x-dcc-csrf';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionContext {
  user: AuthenticatedUser;
  csrfToken: string;
  sessionId: string;
}

export async function createSessionForUser(
  userId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<{ token: string; csrfToken: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + getEnv().SESSION_TTL_SECONDS * 1000);

  await getAuthStore().createSession({
    userId,
    tokenHash: hashToken(token),
    csrfToken,
    expiresAt,
    userAgent: meta.userAgent ?? null,
    ipAddress: meta.ipAddress ?? null,
  });

  return { token, csrfToken, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getEnv().APP_URL.startsWith('https://'),
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/** Resolves the current session, or null when unauthenticated/expired. */
export async function getSession(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await getAuthStore().findSessionByTokenHash(hashToken(token));
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await getAuthStore().deleteSessionByTokenHash(hashToken(token));
    return null;
  }

  if (!session.user.isActive) return null;

  return {
    sessionId: session.id,
    csrfToken: session.csrfToken,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    },
  };
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) throw unauthorized();
  return session;
}

export async function requireRole(...allowed: AuthenticatedUser['role'][]): Promise<SessionContext> {
  const session = await requireSession();
  if (!allowed.includes(session.user.role)) throw forbidden();
  return session;
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await getAuthStore().deleteSessionByTokenHash(hashToken(token));
  await clearSessionCookie();
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export interface LoginResult {
  user: AuthenticatedUser;
  token: string;
  csrfToken: string;
  expiresAt: Date;
}

/**
 * Verifies credentials with brute-force protection (spec §24).
 *
 * The same generic error is returned for unknown users and wrong passwords, and
 * a dummy hash comparison runs for unknown users so response time does not leak
 * account existence.
 */
export async function login(input: {
  email: string;
  password: string;
  ipAddress: string;
  userAgent?: string | null;
}): Promise<LoginResult> {
  const env = getEnv();
  const store = getAuthStore();
  const since = new Date(Date.now() - env.LOGIN_LOCKOUT_MINUTES * 60 * 1000);

  const failures = await store.countRecentFailures({ email: input.email, ipAddress: input.ipAddress, since });
  if (failures >= env.LOGIN_MAX_ATTEMPTS) {
    logger.warn('Login blocked by brute-force protection', { email: input.email, ip: input.ipAddress });
    throw tooManyRequests(`Too many failed attempts. Try again in ${env.LOGIN_LOCKOUT_MINUTES} minutes.`);
  }

  const user = await store.findUserByEmail(input.email);
  const passwordOk = user
    ? await verifyPassword(input.password, user.passwordHash)
    : await verifyPassword(input.password, 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAA==');

  if (!user || !passwordOk || !user.isActive) {
    await store.recordLoginAttempt({ email: input.email, ipAddress: input.ipAddress, success: false });
    throw unauthorized('Invalid email or password');
  }

  await store.recordLoginAttempt({ email: input.email, ipAddress: input.ipAddress, success: true });

  const session = await createSessionForUser(user.id, {
    ipAddress: input.ipAddress,
    userAgent: input.userAgent ?? null,
  });

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    ...session,
  };
}

// ---------------------------------------------------------------------------
// CSRF
// ---------------------------------------------------------------------------

function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

/**
 * Double-submit CSRF check for state-changing requests, plus an Origin check.
 * SameSite=Lax already blocks most cross-site POSTs; this is defence in depth
 * for a service deliberately exposed to the Internet (spec §24).
 */
export async function assertCsrf(session: SessionContext): Promise<void> {
  const headerList = await headers();
  const origin = headerList.get('origin');

  if (origin) {
    const allowed = new URL(getEnv().APP_URL).origin;
    if (origin !== allowed) {
      logger.warn('Rejected request with unexpected origin', { origin });
      throw forbidden('Invalid request origin');
    }
  }

  const provided = headerList.get(CSRF_HEADER);
  if (!provided || !safeCompare(provided, session.csrfToken)) {
    throw forbidden('Invalid CSRF token');
  }
}
