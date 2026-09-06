# Deployment

The DCC must be reachable from outside the home network, over HTTPS, from PC,
laptop, phone, tablet and Echo Show (spec §23).

## 1. Prepare the environment

```bash
cp .env.example .env
openssl rand -base64 48        # → AUTH_SECRET
```

Minimum production values:

```bash
NODE_ENV=production
APP_URL=https://dcc.example.com     # must match the real public URL
AUTH_SECRET=<48+ random chars>
DATABASE_URL=postgresql://user:pass@postgres:5432/dcc?schema=public
MOCK_MODE=false
POSTGRES_PASSWORD=<strong password>
SEED_ADMIN_PASSWORD=<strong password>   # only needed for the first seed
```

`APP_URL` is not cosmetic: it drives the `Secure` cookie flag and the CSRF
origin check.

## 2. Docker Compose (recommended)

```bash
docker compose up -d --build
docker compose exec dcc npx prisma migrate deploy
docker compose exec dcc npx tsx prisma/seed.ts     # first run only
docker compose logs -f dcc
```

The stack runs `dcc` (port 3000), `postgres` and `redis`. Postgres and Redis are
not published to the host — only the app is reachable.

## 3. Reverse proxy and TLS

The container speaks plain HTTP; terminate TLS in front of it.

```nginx
server {
  listen 443 ssl http2;
  server_name dcc.example.com;

  ssl_certificate     /etc/letsencrypt/live/dcc.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/dcc.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name dcc.example.com;
  return 301 https://$host$request_uri;
}
```

`X-Forwarded-For` matters: rate limiting and brute-force protection key on the
client IP, and without it every request looks like it comes from the proxy.

Certificates: `certbot --nginx -d dcc.example.com`.

### Alternatives to opening a port

- **Cloudflare Tunnel** — `cloudflared tunnel --url http://localhost:3000`; no
  inbound port, TLS terminated at the edge.
- **Tailscale** — private access from your own devices; note that an Echo Show
  cannot join a tailnet, so it needs the public route.

## 4. Manual deployment (no Docker)

```bash
npm ci
npx prisma migrate deploy
BUILD_STANDALONE=true npm run build
node .next/standalone/server.js      # honours PORT / HOSTNAME
```

Run it under systemd or pm2 with `EnvironmentFile=/etc/dcc/.env` (mode `0600`).

## 5. Verify

```bash
curl -fsS https://dcc.example.com/api/health          # → {"status":"ok",…}
curl -sI https://dcc.example.com | grep -i strict-transport-security
curl -s -o /dev/null -w '%{http_code}\n' https://dcc.example.com/api/overview   # → 401
```

Then sign in from a phone and install the PWA ("Add to home screen").

## 6. Echo Show / kiosk

Open `https://dcc.example.com/command-center` in the Echo Show's Silk browser
after signing in once — the session cookie persists, the view auto-refreshes
every 15 seconds, and it hides all navigation.

## 7. Operations

- **Backups:** `docker compose exec postgres pg_dump -U dcc dcc | gzip > dcc-$(date +%F).sql.gz` on a schedule.
- **Upgrades:** `git pull && docker compose up -d --build && docker compose exec dcc npx prisma migrate deploy`.
- **Log inspection:** logs are one JSON line per event in production.
- **Monitoring the monitor:** point an external uptime service at `/api/health`,
  so an outage of the DCC itself is still noticed.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Invalid environment configuration` at boot | Missing/short `AUTH_SECRET`, or `MOCK_MODE=false` without `DATABASE_URL` | Fix `.env`; the message names the variable |
| Login works locally but fails behind the proxy | `APP_URL` does not match the public URL → origin check rejects | Set `APP_URL` to the real HTTPS URL |
| Everyone shares one rate-limit bucket | Proxy does not forward `X-Forwarded-For` | Add the header in the proxy config |
| Dashboard shows simulated data in production | `MOCK_MODE` still `true` | Set `MOCK_MODE=false` and run the migrations |
| `MOCK_ADMIN_PASSWORD must be set…` | Mock mode in production | Disable mock mode, or set the variable deliberately |
