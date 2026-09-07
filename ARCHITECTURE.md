# Architecture

## Goals

1. **API-first.** Every client (web, PWA, Echo Show, Alexa) consumes the same API.
2. **Internet-facing from day one.** Authentication, CSRF, rate limiting and
   security headers are not a later phase.
3. **Usable before the infrastructure exists.** Mock mode is a first-class run mode.
4. **No over-engineering.** One process, one interval, no queues or WebSockets
   until they earn their place.

## Layers

```
 app/            Routing, server components, API handlers   ← knows HTTP
   ↓
 features/       Screen composition (client components)     ← knows UI state
   ↓
 services/       Business logic (MonitoringService, …)      ← knows the domain
   ↓  ports
 adapters        database/repositories · services/providers · services/mock
```

Business logic never lives in components, and components never import the
database client. The rule is enforced mechanically: every server-side module
imports `server-only`, so a leak into a client bundle fails the build.

### Ports and adapters

`services/ports.ts` defines an interface per capability (`ServiceRepository`,
`SystemMetricsProvider`, `DockerProvider`, …). Each has:

| Port | Mock adapter | Real adapter |
|------|--------------|--------------|
| `ServiceRepository` | `services/mock/adapters.ts` | `database/repositories/service.repository.ts` |
| `ProjectRepository`, `DeploymentRepository`, `AlertRepository`, `MetricRepository`, `CalendarRepository` | idem | `database/repositories/catalog.repository.ts` |
| `FocusRepository` | idem | `database/repositories/focus.repository.ts` |
| `SystemMetricsProvider` | simulated | `services/providers/system.provider.ts` (`node:os`) |
| `DockerProvider` | simulated | `services/providers/docker.provider.ts` (Engine API over the unix socket) |
| `DatabaseStatsProvider` | simulated | `services/providers/database.provider.ts` (`pg_stat_activity`) |
| `GitProvider` | simulated | `services/providers/github.provider.ts` (GitHub REST) |

`services/container.ts` is the single composition root that decides mock vs.
real, once, from `MOCK_MODE` and `DATABASE_URL`.

## Key decisions

### Next.js App Router, single deployable
The MVP does not split frontend and backend. The service layer is already
isolated behind ports, so extracting `services/` into its own process later is a
transport change, not a rewrite. Splitting now would buy nothing and cost a
deployment.

### Server-side sessions instead of stateless JWTs
The cookie carries a random 32-byte opaque token; the database stores only its
SHA-256. Revocation is a `DELETE`, "sign out everywhere" is one query, and a
database dump yields no usable tokens. Refresh-token rotation and 2FA (columns
already exist on `User`) slot in without a schema migration.

### scrypt from `node:crypto` for password hashing
Memory-hard, standard-library, no native addon — which keeps Docker builds and
CI simple. Parameters (`N=2^15, r=8, p=1`) are encoded in the stored hash so they
can be raised without invalidating existing passwords.

### Polling, not WebSockets
The dashboard refreshes every 30 seconds and pauses while the tab is hidden.
For an operations console that is indistinguishable from realtime at a fraction
of the complexity. `usePolling` is the seam where SSE or WebSockets replace it.

### One aggregated `/api/overview`
The main screen needs eight datasets. Fetching them individually would be eight
round trips every 30 seconds on a phone; one endpoint composes them server-side.
Section pages still use their own focused endpoints.

### Alert deduplication by fingerprint
Every alert carries `fingerprint = type:serviceId`. While an alert with that
fingerprint is unresolved, further firings increment `occurrences` instead of
inserting rows — the difference between "×47" and 47 identical alerts.

### Derived timers
A focus session stores `elapsedSec` (written on pause/stop) and `resumedAt`.
Remaining time is computed on read, so the timer survives restarts, is identical
on every device, and needs no background job.

### Monitoring engine as an in-process interval
`services/monitoring.engine.ts` runs health checks and rule evaluation on a
`setInterval`, started on the first authenticated render. For a single-node
personal command center that is the right amount of machinery; the module
boundary is where BullMQ/Redis go if the workload grows. In mock mode the engine
is not started and rules are evaluated on read instead.

## Data model

```
User ─┬─< Session
      ├─< FocusSession
      ├─< CalendarEvent
      ├─< AuditLog
      └─< Project ─┬─< Service ─┬─< ServiceCheck
                   │            ├─< Metric
                   │            └─< Alert >── AlertRule
                   └─< Deployment
LoginAttempt (standalone, brute-force counters)
Notification >── Alert
Integration (external provider configuration, no secrets)
```

`ServiceCheck` and `Metric` are append-only and indexed by `(subject, timestamp)`
so history queries and retention jobs stay cheap.

## Request lifecycle

1. `src/proxy.ts` (edge) rejects requests with no session cookie — cheap gate only.
2. `route()` (`lib/api/response.ts`) applies rate limiting → authentication →
   CSRF + origin check → Zod validation → error mapping.
3. The handler calls a service; the service calls ports; the container decides
   which adapter answers.
4. Errors become `AppError`s with a status and machine-readable code; anything
   unexpected is logged server-side and returned as a generic 500.

## What is deliberately *not* built yet

Alexa skill, push/email/Telegram/Discord delivery, Docker write actions, Google
Calendar sync, historical metric charts, WebSockets, smart-office automation.
Each has its seam in place — a port, an abstraction or a schema column — and is
scheduled in [ROADMAP.md](./ROADMAP.md).
