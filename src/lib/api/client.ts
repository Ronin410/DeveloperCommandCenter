/**
 * Browser-side API client.
 *
 * Every mutating call carries the CSRF token from the session; GETs are plain
 * fetches with `no-store` so polling never reads a stale cache.
 */

import { CSRF_HEADER_NAME } from '@/lib/api/constants';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: { message: string; code: string } }
    | null;

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      payload?.error?.code ?? 'request_failed',
    );
  }

  return (payload?.data ?? (payload as T)) as T;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, method: 'GET', cache: 'no-store', credentials: 'same-origin' });
  return parse<T>(response);
}

async function mutate<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
  csrfToken: string,
): Promise<T> {
  const response = await fetch(path, {
    method,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', [CSRF_HEADER_NAME]: csrfToken },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return parse<T>(response);
}

export async function apiPost<T>(path: string, body: unknown, csrfToken: string): Promise<T> {
  return mutate<T>('POST', path, body ?? {}, csrfToken);
}

export async function apiPatch<T>(path: string, body: unknown, csrfToken: string): Promise<T> {
  return mutate<T>('PATCH', path, body ?? {}, csrfToken);
}

export async function apiDelete<T>(path: string, csrfToken: string): Promise<T> {
  return mutate<T>('DELETE', path, undefined, csrfToken);
}
