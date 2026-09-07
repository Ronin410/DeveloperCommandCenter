import { ok, fail } from '@/lib/api/response';
import { loginSchema } from '@/lib/api/schemas';
import { login, setSessionCookie } from '@/lib/auth/session';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { badRequest, tooManyRequests } from '@/lib/errors';
import { audit } from '@/lib/audit';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/login
 *
 * Not wrapped by `route()` because it is the one endpoint that must run
 * unauthenticated while still being the most attacked: it gets its own,
 * stricter rate limit on top of the per-account brute-force counter.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const ip = clientIp(request);

    const limit = await rateLimit(`login:${ip}`, {
      limit: getEnv().LOGIN_RATE_LIMIT_PER_MINUTE,
      windowSeconds: 60,
    });
    if (!limit.allowed) throw tooManyRequests('Too many login attempts, slow down.');

    const raw = await request.json().catch(() => {
      throw badRequest('Request body must be valid JSON');
    });
    const credentials = loginSchema.parse(raw);

    const result = await login({
      email: credentials.email,
      password: credentials.password,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    await setSessionCookie(result.token, result.expiresAt);
    await audit({ action: 'auth.login', resource: 'session', userId: result.user.id, ipAddress: ip });

    return ok({ user: result.user, csrfToken: result.csrfToken, expiresAt: result.expiresAt.toISOString() });
  } catch (error) {
    return fail(error);
  }
}
