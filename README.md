# Developer Command Center (DCC)

A personal **monitoring + DevOps + productivity** command center for developers,
reachable from anywhere over the Internet.

The core is an independent web/PWA platform with an API-first backend. Browser,
phone, tablet, PWA, Echo Show and (later) Alexa are all *clients* of the same
API — no client is the centre of the system.

```
                    DEVELOPER COMMAND CENTER
                              │
                    ┌─────────┴─────────┐
                  Frontend             API
                    │                   │
        ┌───────────┼───────────┐       │
      Web          PWA      Echo Show   │
                                     Services
                                        │
                    ┌───────────────────┼───────────────────┐
                  Docker             Database             APIs
                                        │
                    ┌───────────────────┼───────────────────┐
                  GitHub               CI/CD           Monitoring
```

## Status — Phase 1 (MVP) complete

| Area | State |
|------|-------|
| Authentication (sessions, brute-force protection, CSRF) | ✅ |
| Dashboard (services, system, projects, alerts, focus, calendar) | ✅ |
| Services + health checks + check history | ✅ |
| Alerts + alert engine with deduplication | ✅ |
| System metrics + time-series model | ✅ |
| Infrastructure, Docker, Database, Git, Deployments sections | ✅ |
| PWA (manifest, icons, service worker, offline shell) | ✅ |
| Kiosk view for Echo Show / wall displays | ✅ |
| Mock mode (works with zero infrastructure) | ✅ |
| Alexa skill, notifications providers, smart office | ⏳ later phases |

See [ROADMAP.md](./ROADMAP.md) for the full phase plan.

## Requirements

**Node.js 22.12 or newer** (`.nvmrc` pins the major — `nvm use` picks it up).
The app itself runs on 20.9+, but Vitest 5 / Vite 8 require 22.12+, so an older
runtime will fail on `npm test` while `npm run dev` keeps working.

## Quick start (no database required)

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET
npm run dev                   # http://localhost:3000
```

`MOCK_MODE=true` (the default) serves realistic simulated infrastructure, so the
whole dashboard is usable before Postgres, Docker or GitHub exist.

**Demo credentials in mock mode (development only):**
`admin@dcc.local` / `CommandCenter!2024`

Generate a real secret with:

```bash
openssl rand -base64 48        # → AUTH_SECRET
```

## Running with a real database

```bash
cp .env.example .env
# set: MOCK_MODE=false, DATABASE_URL=..., AUTH_SECRET=..., SEED_ADMIN_PASSWORD=...
npm run db:migrate             # create the schema
npm run db:seed                # bootstrap admin + services + alert rules
npm run dev
```

## Deploying

- **Render** — a [`render.yaml`](./render.yaml) blueprint provisions the web
  service and a managed PostgreSQL instance in one click.
  [**RENDER-GUIA.md**](./RENDER-GUIA.md) is the full walkthrough in Spanish
  (steps, required tooling and a cost breakdown);
  [DEPLOYMENT.md](./DEPLOYMENT.md#2-option-a--render-managed-hosting) is the
  condensed English version.
- **Your own server** — Docker Compose plus a reverse proxy for TLS.

## Docker

```bash
cp .env.example .env           # set AUTH_SECRET and POSTGRES_PASSWORD
docker compose up --build      # dcc + postgres + redis
docker compose exec dcc npx prisma migrate deploy
```

The image is multi-stage, runs as a non-root user and ships a `HEALTHCHECK`
against `/api/health`.

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `AUTH_SECRET` | ✅ | — | Session/secret material, min. 32 chars |
| `APP_URL` | | `RENDER_EXTERNAL_URL` or `http://localhost:3000` | Public URL; used for cookies + origin checks |
| `DATABASE_URL` | when `MOCK_MODE=false` | — | PostgreSQL connection string |
| `MOCK_MODE` | | `true` | Serve simulated data instead of real providers |
| `MOCK_ADMIN_EMAIL` | | `admin@dcc.local` | Demo account in mock mode |
| `MOCK_ADMIN_PASSWORD` | in production mock mode | — | Overrides the demo password |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | | — | First-run admin, created on server start; never overwrites an existing account |
| `SESSION_TTL_SECONDS` | | `604800` | Session lifetime (7 days) |
| `MONITORING_INTERVAL_SECONDS` | | `30` | Health-check interval |
| `MONITORING_TIMEOUT_MS` | | `5000` | Per-check timeout |
| `NEXT_PUBLIC_POLL_INTERVAL_SECONDS` | | `30` | Dashboard refresh interval |
| `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` | | `120` / `60` | Global API rate limit |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCKOUT_MINUTES` | | `5` / `15` | Brute-force protection |
| `LOGIN_RATE_LIMIT_PER_MINUTE` | | `10` | Login requests per IP per minute |
| `REDIS_URL`, `GITHUB_TOKEN`, `DOCKER_SOCKET` | | — | Optional integrations |

Never commit `.env`. Only `.env.example` belongs in git.

## Architecture in one paragraph

`app/` (routing + UI) → `features/` (screen composition) → `services/` (business
logic) → **ports** → adapters (`database/repositories/` for Prisma,
`services/providers/` for OS/Docker/Postgres/GitHub, `services/mock/` for
simulated data). A composition root (`services/container.ts`) picks mock or real
adapters once, so no business logic ever branches on the mode. Full detail in
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Project layout

```
src/
├── app/                 # Routes: pages, API handlers, layouts
│   ├── (auth)/login     # Public login screen
│   ├── (dashboard)/     # Authenticated shell + sections
│   ├── command-center/  # Kiosk / Echo Show view
│   └── api/             # REST API
├── components/          # Reusable UI (ui/, layout/)
├── features/            # Screen-level composition per domain
├── services/            # Business logic + ports + adapters
│   ├── mock/            # Simulated infrastructure
│   └── providers/       # Real providers (os, docker, postgres, github)
├── database/            # Prisma client + repositories
├── lib/                 # env, auth, security, api plumbing, logger
├── hooks/               # Client hooks (polling)
├── types/               # Shared domain types
└── utils/               # Formatting helpers
```

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run start:migrate` | Apply pending migrations, then serve (used in Docker and on Render) |
| `npm run typecheck` | Route typegen + TypeScript, strict mode |
| `npm run lint` | ESLint (flat config) |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma workflows |

## Testing

- **Unit** — password hashing, env validation, alert engine, focus timer, formatters.
- **Integration** — auth store, service layer in mock mode, overview aggregation
  (including a check that no secret ever reaches the client payload).
- **E2E** — login, dashboard, navigation, alerts, focus, kiosk, on desktop and mobile viewports.

```bash
npm test          # 41 tests
npm run test:e2e  # 20 tests (desktop + mobile)
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — decisions, layers, data flow
- [API.md](./API.md) — endpoint reference
- [SECURITY.md](./SECURITY.md) — threat model and controls
- [DEPLOYMENT.md](./DEPLOYMENT.md) — production deployment and remote access
- [ROADMAP.md](./ROADMAP.md) — phases 1–9
- [RENDER-GUIA.md](./RENDER-GUIA.md) — guía paso a paso para desplegar en Render (español), con herramientas necesarias y presupuesto
