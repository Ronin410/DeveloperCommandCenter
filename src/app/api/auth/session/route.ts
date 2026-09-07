import { ok, route } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

/** GET /api/auth/session — current user and CSRF token for the client. */
export const GET = route(async ({ session }) => ok({ user: session.user, csrfToken: session.csrfToken }));
