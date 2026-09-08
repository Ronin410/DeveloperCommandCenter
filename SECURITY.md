# Security

The DCC is designed as an Internet-exposed application (spec §23, §24): every
control below assumes an attacker can reach the login page.

## Authentication

- **Server-side sessions.** The cookie holds a random 32-byte opaque token; the
  database stores only `SHA-256(token)`. A database leak yields no usable sessions.
- **Cookie flags:** `httpOnly`, `SameSite=Lax`, `Secure` when `APP_URL` is HTTPS,
  explicit expiry (`SESSION_TTL_SECONDS`, default 7 days).
- **Password hashing:** scrypt (`N=2^15, r=8, p=1`, 64-byte key, 16-byte random
  salt), verified with `timingSafeEqual`. Parameters are stored with the hash so
  they can be raised later.
- **Uniform failures.** Unknown user and wrong password return the same message,
  and unknown users still run a dummy verification so response time does not
  disclose account existence.
- **Minimum password length** of 12 characters, enforced at hashing time.

## Brute force and rate limiting

| Control | Default | Variable |
|---------|---------|----------|
| Failed logins before lockout (per email *or* IP) | 5 / 15 min | `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES` |
| Login requests per IP | 10 / min | `LOGIN_RATE_LIMIT_PER_MINUTE` |
| API requests per IP per route | 120 / min | `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_SECONDS` |

The limiter is behind a `RateLimitStore` interface: in-memory by default,
Redis-backed automatically when `REDIS_URL` is set — the drop-in for
multi-instance deployments, where a per-instance memory store would let each
instance grant its own separate quota.

## CSRF and origin

Mutating requests must present the session's CSRF token in `x-dcc-csrf`
(double-submit, compared with `timingSafeEqual`), and the `Origin` header — when
sent — must equal `APP_URL`. `SameSite=Lax` is the third layer.

## Authorization

Roles are `ADMIN | OPERATOR | VIEWER` on `User`, with `requireRole()` available
for route handlers. The MVP's endpoints are read-mostly and require only an
authenticated session; role checks land with the first destructive action
(Docker restart, container stop), which the spec requires to be confirmed *and*
authorized.

## Input validation

Every request body and query string is parsed with Zod (`lib/api/schemas.ts`).
Unparsed input never reaches a service. Validation failures return `400` with the
issue list — and never echo back the raw body.

## Security headers

Set for every response in `next.config.ts`:

`Content-Security-Policy` (self-only, `frame-ancestors 'none'`, `object-src 'none'`),
`Strict-Transport-Security` (2 years, preload), `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` (camera/mic/geolocation denied). `X-Powered-By` is removed
and API responses are `no-store`.

CORS is not enabled: the API is same-origin only. Cross-origin clients (an Alexa
skill) will get an explicit allowlist plus a service credential, not `*`.

## Secrets

- Validated at startup by `lib/env.ts`; the process refuses to run with an
  `AUTH_SECRET` shorter than 32 characters, or without `DATABASE_URL` when mock
  mode is off.
- Server-only modules import `server-only`, so a secret leaking into a client
  bundle is a **build failure**, not a runtime surprise.
- The logger redacts `password`, `token`, `secret`, `authorization`, `cookie`,
  `apiKey`, `databaseUrl`, `privateKey` by key name.
- The Settings screen shows integrations as "Configured / Not configured", never
  values. Service `healthUrl`s (which can embed internal hostnames) are not part
  of any client payload — there is a test asserting this.
- The first-run administrator is created only from `BOOTSTRAP_ADMIN_EMAIL` /
  `BOOTSTRAP_ADMIN_PASSWORD` (minimum 12 characters, no defaults), only when a
  real database is configured, and **only when that account does not already
  exist** — so an environment variable can never reset a password or hijack an
  existing console.
- The built-in demo password only works outside production; a production
  instance in mock mode must set `MOCK_ADMIN_PASSWORD` explicitly or it refuses
  to authenticate.
- `.env` is git-ignored; only `.env.example` (no real values) is committed.

## Auditing and logging

`lib/audit.ts` records `auth.login`, `auth.logout`, `alert.acknowledge` and
`alert.resolve` with user, resource and IP — to the log always, and to
`AuditLog` when a database is configured. Structured JSON logs in production.

## Data exposure rules

The API never returns: password hashes, session tokens, connection strings, API
keys, or `.env` values. The database module exposes aggregate statistics only
(`pg_stat_activity` counts, database size, version).

## Known gaps (tracked, not hidden)

| Gap | Plan |
|-----|------|
| 2FA | Columns exist on `User`; TOTP enrolment is phase 2 |
| Password reset | Requires the email provider from phase 5 |
| Rate limiter is per-instance | Resolved: set `REDIS_URL` and `RedisRateLimitStore` takes over automatically |
| Docker restart/stop reach any container the socket can see | Same trade-off as service health checks: authentication + `ADMIN`/`OPERATOR` role + a confirmation dialog are the guardrails, not a container allowlist |
| `npm audit`: `deepmerge-ts` advisory via the Prisma **CLI** | Dev-only dependency, not in the runtime image; resolves when Prisma bumps it |
| Adding a monitored service lets an authenticated user make the server issue outbound GET requests to any http(s) URL, including internal/private addresses | Accepted trade-off: that is the feature (monitoring your own internal services from outside your network). Mitigated by requiring authentication for the endpoint, protocol allowlisting (`http`/`https` only), and a bounded timeout (`MONITORING_TIMEOUT_MS`) per request — but there is no SSRF-style blocklist of private IP ranges |

## Reporting

This is a personal project; report issues through the repository's issue tracker.
Do not include real credentials, tokens or `.env` contents in a report.
