/** Shared client/server constants (safe to import from the browser). */
export const CSRF_HEADER_NAME = 'x-dcc-csrf';
export const SESSION_COOKIE_NAME = 'dcc_session';
export const DEFAULT_POLL_INTERVAL_SECONDS = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_SECONDS ?? 30);
