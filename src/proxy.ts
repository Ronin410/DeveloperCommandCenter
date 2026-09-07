import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cheap edge gate: bounce requests with no session cookie straight to /login
 * instead of rendering a protected layout. The real session validation happens
 * server-side in `requirePageSession()` — a cookie's presence proves nothing.
 */

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/health', '/manifest.webmanifest', '/sw.js'];

export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has('dcc_session');
  if (hasSession) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Authentication required' } }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|offline.html).*)'],
};
