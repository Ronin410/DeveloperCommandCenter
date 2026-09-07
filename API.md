# API reference

Base URL: `${APP_URL}/api`. All responses are JSON and never cached.

## Conventions

Success:

```json
{ "data": { }, "meta": { "generatedAt": "2026-09-06T12:00:00.000Z" } }
```

Failure:

```json
{ "error": { "code": "unauthorized", "message": "Authentication required" } }
```

| Status | Code | Meaning |
|--------|------|---------|
| 400 | `bad_request` / `validation_error` | Malformed body or query |
| 401 | `unauthorized` | Missing or expired session |
| 403 | `forbidden` | Failed CSRF/origin check or insufficient role |
| 404 | `not_found` | Unknown resource |
| 429 | `rate_limited` | Rate limit exceeded (`Retry-After` header set) |
| 500 | `internal_error` | Unexpected failure (details are logged, not returned) |

### Authentication

Every endpoint except `GET /api/health` and `POST /api/auth/login` requires the
`dcc_session` cookie (httpOnly, SameSite=Lax, Secure when `APP_URL` is HTTPS).

### CSRF

Every mutating request (`POST`) must send the session's CSRF token in the
`x-dcc-csrf` header. Fetch it from `GET /api/auth/session`. The `Origin` header,
when present, must match `APP_URL`.

---

## Auth

### `POST /api/auth/login`
Public. Rate limited to `LOGIN_RATE_LIMIT_PER_MINUTE` per IP; after
`LOGIN_MAX_ATTEMPTS` failures the account/IP is locked for `LOGIN_LOCKOUT_MINUTES`.

```json
{ "email": "admin@dcc.local", "password": "…" }
```

→ `{ "data": { "user": {…}, "csrfToken": "…", "expiresAt": "…" } }` and sets the session cookie.

### `GET /api/auth/session`
Current user and CSRF token.

### `POST /api/auth/logout`
Revokes the server-side session and clears the cookie.

---

## Monitoring

### `GET /api/health`
**Public.** Liveness/readiness probe — deliberately minimal.

```json
{ "status": "ok", "version": "0.1.0", "uptime": 98231 }
```

Returns `503` with `"status": "degraded"` when the database is unreachable.

### `GET /api/overview`
Everything the dashboard renders: `services`, `system`, `projects`, `alerts`,
`deployments`, `focus`, `events`, `self`.

### `GET /api/services`
Query: `environment` (`DEVELOPMENT|STAGING|PRODUCTION`), `projectId`.

Each service: `id, slug, name, kind, environment, status, latencyMs, uptimePct,
version, lastCheckAt, projectId, projectName`.
Status is one of `ONLINE | WARNING | OFFLINE | UNKNOWN`.

### `GET /api/services/:id`
Accepts an id or a slug. Adds `checks[]` (recent health-check history).

### `GET /api/system`
Query: `type` (metric type, default `CPU`), `limit` (1–500, default 60).

```json
{ "metrics": { "cpuPct": 32, "ramPct": 61, "diskPct": 48, … },
  "history": { "type": "CPU", "points": [{ "value": 31.2, "timestamp": "…" }] } }
```

---

## Catalogue

### `GET /api/projects`
### `GET /api/deployments` — query: `projectId`, `limit` (1–100, default 25)
### `GET /api/docker` — `{ "available": true, "containers": [...] }`
### `GET /api/database` — aggregate PostgreSQL health; never credentials
### `GET /api/git` — repositories, commits and workflow status
### `GET /api/calendar` — `{ "today": [...], "upcoming": [...] }`

---

## Alerts

### `GET /api/alerts`
Query: `status` (`ACTIVE|ACKNOWLEDGED|RESOLVED`), `limit` (1–200, default 50).

### `POST /api/alerts/:id/acknowledge`
### `POST /api/alerts/:id/resolve`
Both are audited.

---

## Focus

### `GET /api/focus` → `{ "session": {…}, "settings": {…} }`
### `POST /api/focus/start`

```json
{ "type": "FOCUS", "label": "Pasitos API", "durationSec": 1500 }
```

`type` ∈ `FOCUS | SHORT_BREAK | LONG_BREAK`; `durationSec` is optional (60–14400).

### `POST /api/focus/pause` · `resume` · `stop` · `reset`

---

## Example session

```bash
BASE=http://localhost:3000

curl -c jar -X POST $BASE/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@dcc.local","password":"CommandCenter!2024"}'

CSRF=$(curl -s -b jar $BASE/api/auth/session | jq -r .data.csrfToken)

curl -s -b jar $BASE/api/overview | jq '.data.services[0]'

curl -s -b jar -X POST $BASE/api/focus/start \
  -H "x-dcc-csrf: $CSRF" -H 'content-type: application/json' \
  -d '{"type":"FOCUS"}'
```

## Alexa (future phase)

An Alexa skill will call these same endpoints with a service credential —
"Alexa, how are my services?" maps to `GET /api/services`. No parallel API and
no duplicated logic; that is the reason the dashboard has no privileged
back-channel of its own.
