# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Local development (no Docker required)

```bash
# Backend (requires running PostgreSQL + Valkey, and a configured .env)
cd backend && npm install && npm run dev   # nodemon, hot-reload

# Frontend (separate terminal)
cd frontend && npm install && npm run dev  # Vite dev server on :5173
```

### Lint
```bash
cd backend && npm run lint    # eslint src/
cd frontend && npm run lint   # eslint src/
```

### Tests
```bash
cd backend && npm test        # jest --passWithNoTests (no tests written yet)
```

### Docker (full stack)
```bash
docker compose up -d --build  # builds backend + frontend images, starts all services
docker compose ps             # check service health
curl -fsS http://localhost/api/health   # verify backend via nginx
```

### Database reset
```bash
docker compose down
docker volume rm krt-leadtool_postgres-data
docker compose up -d
```

## Environment setup

Copy `example.env` → `.env`. Required variables: `APP_URL`, `DOMAIN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_CALLBACK_URL`, `JWT_SECRET`, `SESSION_SECRET`, `POSTGRES_PASSWORD`, `VALKEY_PASSWORD`.

For local dev, set `POSTGRES_HOST=localhost`, `VALKEY_HOST=localhost`, `APP_URL=http://localhost:5173`, and `NODE_ENV=development`.

## Architecture

### Services
- **nginx** — reverse proxy; serves static frontend build (via Docker volume) and proxies `/api` + `/socket.io/` to the backend
- **backend** — Node.js 20 / Express 4 / Socket.IO 4 on port 3000
- **frontend** — React 18 / Vite (build-only container; Vite dev server used locally)
- **postgres** — PostgreSQL 16 + PostGIS; schema initialized from `postgres/init.sql`, seed data from `postgres/seed_stanton.sql`
- **valkey** — Redis-compatible (open-source fork); used for session store (`krt:sess:*`) and per-mission online-user presence (`online:<missionId>` hash)

### Backend layout (`backend/src/`)
- `index.js` — startup: DB health checks, idempotent navigation seed, then HTTP + Socket.IO
- `app.js` — Express setup: middleware chain (helmet, cors, morgan, session, passport), all route mounts
- `socket.js` — Socket.IO server: JWT auth middleware, `mission:join/leave`, real-time `unit:move` and `cursor:update` broadcasts, Valkey presence updates, login/logout event-log entries
- `auth/discord.js` — Passport Discord OAuth2 strategy; on success, upserts user in DB and issues a JWT cookie
- `auth/jwt.js` — `requireAuth` middleware (reads JWT cookie), `requireRole` for site-level roles
- `auth/teamAuth.js` — `requireMissionMember` (checks `mission_members` table), `requireGesamtlead`, `requireGruppenlead`, `canEditGroup`
- `db/postgres.js` / `db/valkey.js` — singleton pool/client with `testConnection()`
- `validation/middleware.js` + `validation/schemas.js` — Zod-based request body validation; wrap route handlers with `validate(schemas.createFoo)`
- `routes/` — one file per resource; all data-mutating routes call `broadcastToMission(missionId, 'entity:verb', row)` after the DB write so connected clients receive live updates

### REST + real-time contract
Every data mutation follows this pattern:
1. REST handler validates, writes to Postgres, then calls `broadcastToMission(missionId, 'entity:verb', data)`
2. Clients listening on Socket.IO receive `entity:created/updated/deleted` and call the matching Zustand store action

`unit:move` is the exception — it broadcasts ephemeral position without a DB write; the DB is updated on drag-end via a REST PUT.

### Authorization layers
Two orthogonal role systems coexist:
1. **Team role** (`role` in `mission_members`): `admin` or `member` / `leader` — controls mission management (edit name, delete, accept join requests)
2. **Mission role** (`mission_role`): `gesamtlead` > `gruppenlead` > `teamlead` — controls map editing. Gesamtlead can edit everything; gruppenlead can only edit their `assigned_group_ids`; teamlead is read-only

`req.teamRole`, `req.missionRole`, and `req.assignedGroups` are set by `requireMissionMember` and used by subsequent middleware and route logic.

### Frontend layout (`frontend/src/`)
- `main.jsx` — React Router setup; routes: `/` (login), `/dashboard`, `/mission/:missionId` (map)
- `pages/MapPage.jsx` — on mount: loads IndexedDB cache, parallel-fetches all mission data from REST, then calls `connectSocket(missionId)`; on unmount: disconnects socket
- `stores/missionStore.js` — single Zustand store holding all mission state (units, groups, contacts, tasks, operations, waypoints, members, navData, etc.) plus `canEdit(groupId)` helper
- `lib/socket.js` — Socket.IO client singleton; on `connect` runs a delta sync (`/api/sync?since=...`), then wires all `entity:verb` events to Zustand store actions
- `lib/offlineDb.js` — Dexie (IndexedDB) schema (versioned migrations); stores units, groups, contacts, tasks for offline cache; operations/events are not persisted offline
- `components/SpaceMap.jsx` — `@react-three/fiber` `<Canvas>` rendering `UnitMarker`, `ContactMarker`, `TaskMarker`, `NavPointMarker`, `WaypointLine`; `CameraFocus` component handles animated camera lerp to focused unit/position
- `components/PopupPanels.jsx` — renders floating detail panels driven by `popupStore`
- `stores/popupStore.js` — controls which popup panels are open and their state

### Offline / delta sync
- On initial load, `loadFromCache()` reads IndexedDB before the REST fetch completes
- On socket reconnect, the client fetches `/api/sync?mission_id=&since=<lastSyncTime>` and merges delta results into the store
- `lastSyncTime` is stored in Zustand and updated after every successful full load or sync response
