import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { AppError, badRequest } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { requireSession, assertCsrf, type SessionContext } from '@/lib/auth/session';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';

export interface ApiSuccess<T> {
  data: T;
  meta: { generatedAt: string };
}

export interface ApiFailure {
  error: { code: string; message: string; details?: unknown };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data, meta: { generatedAt: new Date().toISOString() } }, init);
}

export function fail(error: unknown): NextResponse<ApiFailure> {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Invalid request payload', details: error.issues } },
      { status: 400 },
    );
  }

  logger.error('Unhandled API error', { error: (error as Error).message, stack: (error as Error).stack });
  return NextResponse.json({ error: { code: 'internal_error', message: 'Internal server error' } }, { status: 500 });
}

export interface RouteContext<TBody = undefined> {
  request: Request;
  session: SessionContext;
  body: TBody;
  ip: string;
  /** Dynamic segment values, e.g. { id: 'alr_1' } for /api/alerts/[id]. */
  params: Record<string, string>;
}

/** Second argument Next.js passes to a route handler for dynamic segments. */
interface NextRouteArgs {
  params?: Promise<Record<string, string | string[] | undefined>>;
}

async function resolveParams(args?: NextRouteArgs): Promise<Record<string, string>> {
  const raw = (await args?.params) ?? {};
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? (value[0] ?? '') : (value ?? '')]),
  );
}

interface RouteOptions<TSchema extends ZodType | undefined> {
  /** Public routes skip authentication (only /api/health today). */
  auth?: boolean;
  /** Enforce CSRF + Origin checks. Defaults to true for non-GET handlers. */
  csrf?: boolean;
  schema?: TSchema;
  rateLimit?: { limit: number; windowSeconds: number };
}

type Handler<TBody> = (context: RouteContext<TBody>) => Promise<Response> | Response;

/**
 * Wraps a route handler with the cross-cutting concerns every endpoint needs:
 * rate limiting, authentication, CSRF, body validation and error mapping
 * (spec §24, §26). Keeping this in one place is what stops each route from
 * re-implementing security by hand.
 */
export function route<TSchema extends ZodType | undefined = undefined>(
  handler: Handler<TSchema extends ZodType ? ReturnType<TSchema['parse']> : undefined>,
  options: RouteOptions<TSchema> = {},
) {
  return async (request: Request, args?: NextRouteArgs): Promise<Response> => {
    try {
      const ip = clientIp(request);
      const path = new URL(request.url).pathname;

      const limit = await rateLimit(`${ip}:${path}`, options.rateLimit);
      if (!limit.allowed) {
        return NextResponse.json(
          { error: { code: 'rate_limited', message: 'Too many requests' } },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))),
              'X-RateLimit-Limit': String(limit.limit),
              'X-RateLimit-Remaining': String(limit.remaining),
            },
          },
        );
      }

      let session: SessionContext | null = null;
      if (options.auth !== false) {
        session = await requireSession();

        const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
        if (options.csrf ?? mutating) await assertCsrf(session);
      }

      let body: unknown;
      if (options.schema) {
        const raw = await request.json().catch(() => {
          throw badRequest('Request body must be valid JSON');
        });
        body = options.schema.parse(raw);
      }

      return await handler({
        request,
        ip,
        params: await resolveParams(args),
        session: session as SessionContext,
        body: body as TSchema extends ZodType ? ReturnType<TSchema['parse']> : undefined,
      });
    } catch (error) {
      return fail(error);
    }
  };
}
