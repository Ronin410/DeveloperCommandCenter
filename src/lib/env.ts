import 'server-only';
import { z } from 'zod';

/**
 * Server-side environment validation (spec §25, §39.5).
 *
 * Importing this module from a client component fails the build thanks to
 * `server-only`, which is the cheapest possible guarantee that secrets never
 * reach the browser.
 */

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === 'boolean' ? value : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_URL: z.string().url().default('http://localhost:3000'),

    DATABASE_URL: z.string().min(1).optional(),

    AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),

    MOCK_MODE: booleanish.default(true),
    MOCK_ADMIN_EMAIL: z.string().email().default('admin@dcc.local'),
    MOCK_ADMIN_PASSWORD: z.string().min(8).optional(),

    /**
     * First-run administrator. When both are set and the database holds no
     * users, the account is created at server start (see instrumentation.ts).
     * There is deliberately no default: a known password on an
     * Internet-exposed console would be an open door.
     */
    BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).optional(),
    BOOTSTRAP_ADMIN_NAME: z.string().min(1).default('Command Center Admin'),

    MONITORING_INTERVAL_SECONDS: z.coerce.number().int().min(5).default(30),
    MONITORING_TIMEOUT_MS: z.coerce.number().int().min(250).default(5000),

    /** How often the retention/downsampling job runs (spec §36). */
    RETENTION_INTERVAL_HOURS: z.coerce.number().int().min(1).default(24),
    /** Raw service-check history older than this is deleted outright — the rolling uptime window only looks at the last 200 anyway. */
    SERVICE_CHECK_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
    /** Metric points older than this are collapsed to one hourly average per (type, service, hour). */
    METRIC_DOWNSAMPLE_AFTER_HOURS: z.coerce.number().int().min(1).default(24),
    /** Even downsampled metric points are deleted after this long. */
    METRIC_RETENTION_DAYS: z.coerce.number().int().min(1).default(90),

    REDIS_URL: z.string().optional(),
    GITHUB_TOKEN: z.string().optional(),
    DOCKER_SOCKET: z.string().default('/var/run/docker.sock'),

    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    /** Requests per minute per IP accepted by the login endpoint. */
    LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
    LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  })
  .superRefine((value, ctx) => {
    // Cross-field rules describe how the app is *run*, not how it is compiled:
    // a production image is built without a database URL or runtime secrets.
    if (isBuildPhase()) return;

    if (!value.MOCK_MODE && !value.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required when MOCK_MODE is disabled',
      });
    }
  });

function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(envSource());

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}\n\nSee .env.example.`);
  }

  return parsed.data;
}

/**
 * Raw values to validate.
 *
 * `APP_URL` drives the Secure cookie flag and the CSRF origin check, so getting
 * it wrong breaks login in a way that is hard to diagnose. PaaS providers that
 * publish the public URL as an environment variable are used as a fallback so a
 * deploy works without hand-copying the hostname.
 */
function envSource(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    APP_URL: process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL ?? undefined,
  };
}

let cached: Env | null = null;

/** Validated environment. Throws once, at first access, with a readable report. */
export function getEnv(): Env {
  cached ??= loadEnv();
  return cached;
}

/** Test helper: forces the next getEnv() call to re-read process.env. */
export function resetEnvCache(): void {
  cached = null;
}

export function isMockMode(): boolean {
  return getEnv().MOCK_MODE;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}

/** Default demo password, only ever used in non-production mock mode. */
export const DEV_MOCK_PASSWORD = 'CommandCenter!2024';

/**
 * Password of the in-memory demo account. The built-in default is a
 * development convenience only: exposing it on a production instance would be
 * a publicly known credential, so production must set one explicitly.
 */
export function mockAdminPassword(): string {
  const env = getEnv();
  if (env.MOCK_ADMIN_PASSWORD) return env.MOCK_ADMIN_PASSWORD;

  if (env.NODE_ENV === 'production') {
    throw new Error(
      'MOCK_ADMIN_PASSWORD must be set when running MOCK_MODE in production, or disable MOCK_MODE.',
    );
  }

  return DEV_MOCK_PASSWORD;
}
