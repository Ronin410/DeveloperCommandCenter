import { ok, route } from '@/lib/api/response';
import { destroyCurrentSession } from '@/lib/auth/session';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** POST /api/auth/logout — revokes the server-side session. */
export const POST = route(async ({ session, ip }) => {
  await destroyCurrentSession();
  await audit({ action: 'auth.logout', resource: 'session', userId: session.user.id, ipAddress: ip });
  return ok({ ok: true });
});
