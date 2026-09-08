# Roadmap

Phase 1 is complete. Later phases keep the same rule: no speculative
implementation, but the seam for each one already exists in the code.

## Phase 1 — MVP ✅

Authentication · Dashboard · Services · Health checks · Projects · Alerts ·
System metrics · PWA shell · Kiosk view · Mock mode · Tests · Docker.

## Phase 2 — Infrastructure

- [x] Docker container actions (restart/stop/logs) with confirmation + role checks
- [x] Per-container CPU/RAM via the stats stream
- [x] Postgres deep metrics (slow queries, table sizes, backup status)
- [ ] Redis as cache + rate-limit store
- [x] Historical metric charts from the `Metric` table
- [ ] Retention/downsampling job

## Phase 3 — DevOps

- [ ] GitHub integration (repos, PRs, issues, Actions, releases)
- [ ] Deployment ingestion via webhook
- [ ] CI/CD status per project
- [ ] Commit → deployment → alert correlation

## Phase 4 — Productivity

- [ ] Focus statistics and history
- [ ] Task list
- [ ] Google / Outlook / Apple calendar sync
- [ ] Automatic focus sessions from calendar blocks

## Phase 5 — Notifications

- [ ] Web Push (PWA)
- [ ] Email provider
- [ ] Telegram and Discord providers
- [ ] Per-severity routing and quiet hours

## Phase 6 — PWA

- [ ] Offline shell for read-only views
- [ ] Background sync
- [ ] Push notification permissions flow
- [ ] Install prompts and mobile UX polish

## Phase 7 — Alexa

- [ ] Alexa skill consuming the existing API with a service credential
- [ ] "How are my services?", "Any errors?", "What was the last deploy?"
- [ ] Voice-controlled focus sessions

## Phase 8 — Echo Show

- [ ] Auto-rotating kiosk panels
- [ ] Always-on layout tuned for the device's viewport
- [ ] Touch shortcuts for acknowledge/resolve

## Phase 9 — AI

- [ ] Log/metric/deployment correlation
- [ ] "What is happening with production?" natural-language answers
- [ ] Anomaly detection on latency and error rate

## Cross-cutting backlog

- [ ] 2FA (TOTP) — schema columns already exist
- [ ] Password reset (needs the phase-5 email provider)
- [ ] Persisted `AlertRule` evaluation (table exists; engine uses defaults today)
- [ ] SSE/WebSocket transport behind the existing `usePolling` seam
- [ ] Multi-user sharing and per-project permissions
