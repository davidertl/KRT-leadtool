# KRT-Leadtool

KRT-Leadtool is a web-based command and control tool for Star Citizen operations.
It provides a shared mission workspace with a 3D map, real-time updates, mission planning, tasking, contact tracking, and role-based collaboration.

## What the tool does

### Mission workspace
- Create private or public missions
- Join by code or public join
- Manage members and mission roles (gesamtlead, gruppenlead, teamlead)

### 3D operational map
- Shared map with unit, contact, task, waypoint, and navigation overlays
- Live position updates via WebSocket
- Focus/select workflows for fast situational awareness

### Unit and people tracking
- Manage units (ships/vehicles) and persons
- Track status, ROE, assignment, group membership, and resources
- Keep history entries and undo recent tracked changes

### Operations and tasking
- Create operations with phase management
- Track operation notes and ROE overrides
- Create and assign tasks to units/groups

### Contact and communications
- SPOTREP/contact management with IFF + threat metadata
- Quick message flow with status automation hooks
- Event log timeline with CSV export

### Bookmarks and navigation
- Mission bookmarks with shared/private visibility
- Navigation data APIs (systems, points, route planning, reseed/reset)

### Offline and sync behavior
- Frontend uses IndexedDB cache and service worker
- Delta sync endpoint for reconnect scenarios

## Tech stack

- Frontend: React 18, Vite 5, Tailwind CSS, Three.js (react-three/fiber + drei), Zustand
- Backend: Node.js 20, Express 4, Socket.IO 4
- Data: PostgreSQL 16 + PostGIS, Valkey 8
- Auth: Discord OAuth2 (Passport) + JWT cookie session
- Infra: Docker Compose, Nginx reverse proxy, Certbot container, optional Uptime Kuma

## Installation (recommended: Docker Compose)

### 1) Prerequisites
- Docker Engine + Docker Compose plugin
- A Discord application (OAuth2 client)
- A root domain plus DNS records for the required hosts:
  - `yourdomain.com` for the WebUI and main OAuth flow
  - `status.yourdomain.com` for Uptime Kuma
  - `voice.yourdomain.com` for the voice/companion endpoints

### 2) Deployment host layout
- `https://yourdomain.com` serves the React WebUI, main REST API, Socket.IO, and Discord OAuth callback
- `https://status.yourdomain.com` proxies Uptime Kuma
- `https://voice.yourdomain.com` proxies `/api/companion`, `/api/voice`, and the `/voice` WebSocket (used by the Companion App; see [docs/companion-api.md](docs/companion-api.md))

### 3) Clone and configure
```bash
git clone https://github.com/davidertl/KRT-leadtool.git
cd KRT-leadtool
cp example.env .env
```

Edit `.env` and set at minimum:
- `APP_URL`
- `DOMAIN`
- `STATUS_DOMAIN`
- `VOICE_DOMAIN`
- `CERTBOT_EMAIL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_CALLBACK_URL`
- `COMPANION_DISCORD_CALLBACK_URL`
- `JWT_SECRET`
- `SESSION_SECRET`
- `POSTGRES_PASSWORD`
- `VALKEY_PASSWORD`

Recommended production values:
- `APP_URL=https://yourdomain.com`
- `DOMAIN=yourdomain.com`
- `STATUS_DOMAIN=status.yourdomain.com`
- `VOICE_DOMAIN=voice.yourdomain.com`
- `DISCORD_CALLBACK_URL=https://yourdomain.com/api/auth/discord/callback`
- `COMPANION_DISCORD_CALLBACK_URL=https://voice.yourdomain.com/api/companion/auth/callback`

### 4) Start stack
```bash
APP_MODULES=leadtool,voice docker compose --profile combined --profile ops up -d --build
```

If you do not want the voice module, use `APP_MODULES=leadtool` with `--profile leadtool --profile ops` instead.

### 5) Verify
```bash
docker compose ps
curl -I https://yourdomain.com
curl -I https://status.yourdomain.com
curl -fsS http://localhost:3000/api/health
```

**Deployment verification (companion and voice):** The backend must reach a healthy state before Nginx starts (Nginx depends on `backend: condition: service_healthy`). If the backend is unhealthy, public URLs return 503 and the Companion app cannot verify the server. Confirm:

1. Backend is healthy: `docker compose ps` shows `krt-backend` as healthy (not "unhealthy" or "starting"). The backend uses startup retries for PostgreSQL/Valkey; ensure the image is rebuilt after pulling: `APP_MODULES=leadtool,voice docker compose --profile combined --profile ops up -d --build`.
2. Backend logs: `docker logs krt-backend` should show `[KRT] PostgreSQL connected`, `[KRT] Backend running on port 3000`, and no repeated "Failed to start" or "ECONNREFUSED".
3. Nginx is running: `docker compose ps` shows `krt-nginx` as "Up" (not "Created"). If Nginx is only "Created", the backend healthcheck failed and Nginx never started.
4. Public companion endpoint: after the stack is healthy, `curl -sS https://voice.yourdomain.com/api/companion/server-status` should return JSON with `ok: true` and `data.version`.

**Public host and DNS (voice/companion):** For the Companion app to verify and connect, ensure:

- `.env` has `DOMAIN`, `VOICE_DOMAIN`, `APP_URL`, `DISCORD_CALLBACK_URL`, and `COMPANION_DISCORD_CALLBACK_URL` set to your real hostnames (e.g. `VOICE_DOMAIN=voice.das-krt.com`, `COMPANION_DISCORD_CALLBACK_URL=https://voice.das-krt.com/api/companion/auth/callback`).
- DNS for `VOICE_DOMAIN` (e.g. `voice.das-krt.com`) points to the same server as `DOMAIN`; Nginx serves the voice host only when the backend is healthy and the same certificate covers all three hostnames.
- After the stack is healthy, from a machine with internet access run:
  - `curl -sS https://<VOICE_DOMAIN>/` — expect `KRT voice host is online.`
  - `curl -sS https://<VOICE_DOMAIN>/api/companion/server-status` — expect JSON with `ok: true` and `data.version`.
  - `curl -sS https://<VOICE_DOMAIN>/api/voice/status` — expect JSON with `ok: true`, `module: 'voice'`.

If these return 503 or connection errors, fix backend/nginx health first (see above); then re-check DNS and `.env`.

Notes:
- On first boot, PostgreSQL initializes schema and Stanton seed data from `postgres/init.sql` and `postgres/seed_stanton.sql`.
- Certbot requests a single certificate for `DOMAIN`, `STATUS_DOMAIN`, and `VOICE_DOMAIN`, then Nginx serves separate HTTPS virtual hosts for each hostname.
- Nginx starts in HTTP-only mode if no matching certificate exists yet, then serves SSL mode after Certbot obtains the certificate set and Nginx restarts.

## Local development (without full Docker stack)

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend (separate terminal)
```bash
cd frontend
npm install
npm run dev
```

Local dev requirements:
- Running PostgreSQL + Valkey instances
- Environment variables configured for backend (`backend/src/index.js` loads `.env`)

## Database reset

If you need a clean database volume:
```bash
docker compose down
docker volume rm krt-leadtool_postgres-data
docker compose up -d
```

## Troubleshooting

### Backend fails: "password authentication failed for user krt_user" (28P01)

PostgreSQL only sets `krt_user`’s password when the data directory is first created. If you changed `POSTGRES_PASSWORD` in `.env` after the first run, or the volume was created with a different password, the backend will get 28P01.

**Fix (choose one):**

1. **Recreate the database** (data loss): use [Database reset](#database-reset) above, then set `POSTGRES_PASSWORD` in `.env` to the value you want and run `docker compose up -d` again.
2. **Keep existing data**: connect to Postgres and set the password to match `.env`:
   ```bash
   docker exec -it krt-postgres psql -U krt_user -d krt_leadtool -c "ALTER USER krt_user PASSWORD 'YOUR_CURRENT_POSTGRES_PASSWORD_FROM_ENV';"
   ```
   Then restart the backend: `docker compose restart backend`.

Ensure `.env` exists (copy from `example.env`) and that `POSTGRES_PASSWORD` is set before the first `docker compose up` so backend and Postgres use the same value.

### Companion app cannot verify the server

Verification can fail for two main reasons: **deployment availability** or **wrong host**.

- **503 / 502 / 504:** The Companion calls `GET /api/companion/server-status` on the host you entered. If the backend is unhealthy, Nginx never starts or returns 503. Fix by ensuring the backend is healthy (see [Deployment verification](#5-verify)) and that the stack was rebuilt after pulling the latest code.
- **Wrong host:** The app must use the **voice host** (e.g. `https://voice.yourdomain.com`), which serves both the companion API and the `/voice` WebSocket. Using the main website URL (e.g. `https://yourdomain.com`) can work for the status endpoint on some setups but the voice WebSocket is only available on the voice host; the app shows a hint if the host does not look like a voice host.

## Main API groups

Mounted route groups in backend include:
- `/api/auth`
- `/api/missions`
- `/api/members`
- `/api/units`
- `/api/groups`
- `/api/contacts`
- `/api/tasks`
- `/api/messages`
- `/api/events`
- `/api/operations`
- `/api/operation-phases`
- `/api/operation-roe`
- `/api/operation-notes`
- `/api/navigation`
- `/api/bookmarks`
- `/api/waypoints`
- `/api/history`
- `/api/sync`
- `/api/ship-images`
- `/api/health`

## Companion App

This repo includes the **Companion App** (Windows WPF) in `companion/`. It connects to the **voice host** for Discord login, voice relay, and optional mission status updates. Voice is **end-to-end encrypted** (per-frequency AES-256-GCM); the server distributes keys over TLS and relays encrypted audio without decrypting it (same model as [KRT-Com_Discord](https://github.com/davidertl/KRT-Com_Discord)).

- **Operators:** Deploy the backend with the voice module and set `VOICE_DOMAIN` and `COMPANION_DISCORD_CALLBACK_URL`. Register the companion callback in the Discord app (`https://<VOICE_DOMAIN>/api/companion/auth/callback`). See [docs/companion-api.md](docs/companion-api.md).
- **End users:** Install the Companion App on Windows, then in settings enter the **voice host** URL (e.g. `https://voice.yourdomain.com`) with port 443, **not** the main WebUI URL. Log in with Discord when prompted. If verification fails (e.g. "Server unavailable (503)"), the cause is often deployment: backend or Nginx is not healthy — see [Deployment verification](#5-verify) and [Troubleshooting](#troubleshooting). Built artifacts are produced by CI (see Actions → workflow run → Artifacts: `companion-app-win-x64`), or build from source: see [companion/README.md](companion/README.md).

## Project structure

```text
backend/     Express API, auth, routes, socket, DB adapters
companion/   Companion App (WPF) source; connects to voice host
frontend/    React app, map UI, stores, panels, offline cache
nginx/       Reverse proxy templates and entrypoint
postgres/    SQL init + seed data
scripts/     Setup/backup helper scripts
docs/        Companion API contract and operator docs
localdoc/    Internal docs and audits
```

## Current status

- Core functionality is implemented and actively used in development.
- Security hardening and permission tightening are in progress (see `localdoc/codex_audit.md`).
- Automated e2e coverage is not present yet.

## License

Apache 2.0 — see LICENSE.
