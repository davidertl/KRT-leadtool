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
- Infra: Docker Compose, Nginx reverse proxy, Certbot container

## Installation (recommended: Docker Compose)

### 1) Prerequisites
- Docker Engine + Docker Compose plugin
- A Discord application (OAuth2 client)
- A domain pointing to your server (for HTTPS)

### 2) Clone and configure
```bash
git clone https://github.com/davidertl/KRT-leadtool.git
cd KRT-leadtool
cp example.env .env
```

Edit `.env` and set at minimum:
- `APP_URL`
- `DOMAIN`
- `CERTBOT_EMAIL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_CALLBACK_URL`
- `JWT_SECRET`
- `SESSION_SECRET`
- `POSTGRES_PASSWORD`
- `VALKEY_PASSWORD`

### 3) Start stack
```bash
docker compose up -d --build
```

### 4) Verify
```bash
docker compose ps
curl -fsS http://localhost/api/health || curl -fsS http://localhost:3000/api/health
```

Notes:
- On first boot, PostgreSQL initializes schema and Stanton seed data from `postgres/init.sql` and `postgres/seed_stanton.sql`.
- Nginx starts in HTTP-only mode if no certificate exists yet, then serves SSL mode after Certbot obtains certs and Nginx restarts.

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

## Project structure

```text
backend/     Express API, auth, routes, socket, DB adapters
frontend/    React app, map UI, stores, panels, offline cache
nginx/       Reverse proxy templates and entrypoint
postgres/    SQL init + seed data
scripts/     Setup/backup helper scripts
localdoc/    Internal docs and audits
```

## Current status

- Core functionality is implemented and actively used in development.
- Security hardening and permission tightening are in progress (see `localdoc/codex_audit.md`).
- Automated e2e coverage is not present yet.

## License

Apache 2.0 — see LICENSE.
