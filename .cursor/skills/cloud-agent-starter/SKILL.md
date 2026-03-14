# Cloud Agent Starter Skill: Run and Test KRT-Leadtool

Use this skill when you need to quickly boot, run, and test the repo in Cursor Cloud without rediscovering setup steps.

## 0) Fast bootstrap (first 5 minutes)

1. Prepare env:
   - `cp example.env .env`
   - In `.env`, set at minimum:
     - `NODE_ENV=development`
     - `APP_URL=http://localhost:5173`
     - `APP_PORT=3000`
     - `POSTGRES_HOST=localhost` (local dev mode) or `postgres` (compose mode)
     - `VALKEY_HOST=localhost` (local dev mode) or `valkey` (compose mode)
     - `JWT_SECRET=<any-random-string>`
     - `SESSION_SECRET=<any-random-string>`
     - `DISCORD_CLIENT_ID=dummy`
     - `DISCORD_CLIENT_SECRET=dummy`
     - `DISCORD_CALLBACK_URL=http://localhost:3000/api/auth/discord/callback`
2. Install dependencies:
   - `cd backend && npm install`
   - `cd frontend && npm install`
3. Start infra dependencies (if not already running):
   - `docker compose up -d postgres valkey`
4. Start apps (separate terminals):
   - Backend: `cd backend && npm run dev`
   - Frontend: `cd frontend && npm run dev`
5. Verify:
   - `curl -i http://localhost:3000/api/health`
   - Open `http://localhost:5173`

## 1) Auth/Login area (Discord + local mock path)

### Real login path

- The UI login button goes to `/api/auth/discord`.
- This requires valid Discord OAuth values in `.env`.

### Mock login path (recommended for Cloud agents)

Use this when Discord OAuth is unavailable or slow:

1. Generate a JWT with backend secret:
   - `cd backend`
   - `TOKEN=$(node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({id:1,discord_id:'local-dev',username:'cloud-agent',role:'owner'}, process.env.JWT_SECRET||'dev-jwt-secret', {expiresIn:'7d'}));")`
2. API testing with header (no browser login needed):
   - `curl -i -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/me`
3. Frontend testing with cookie:
   - Open browser devtools on `http://localhost:5173`
   - Run:
     - `document.cookie = "jwt=<PASTE_TOKEN_HERE>; path=/; SameSite=Lax";`
   - Refresh the page; app should route to dashboard instead of `/login`.

### Feature flags / toggles note

- There is no dedicated feature-flag service in this repo right now.
- Effective toggles are environment values (`APP_URL`, `NODE_ENV`, DB/Valkey hosts, secrets) plus auth mode (real Discord vs mocked JWT).
- If a PR introduces new flags, add them to this skill with:
  - default value,
  - where consumed,
  - how to override in Cloud tests.

## 2) Backend area (`backend/`)

### Run

- `cd backend && npm run dev`

Backend startup checks DB + Valkey connections and applies navigation seed idempotently, so startup logs are an important health signal.

### Concrete backend test workflow

1. Service health:
   - `curl -i http://localhost:3000/api/health`
2. Auth sanity (mock token):
   - `curl -i -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/me`
3. Navigation reseed path:
   - `curl -i -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/navigation/reseed`
4. Lint + test:
   - `cd backend && npm run lint`
   - `cd backend && npm test`

## 3) Frontend area (`frontend/`)

### Run

- `cd frontend && npm run dev` (Vite on `5173`, proxies `/api` and `/socket.io` to backend `3000`)

### Concrete frontend test workflow

1. Open `http://localhost:5173`.
2. If OAuth is not configured, use mocked JWT cookie flow from section 1.
3. Validate:
   - Login page renders when unauthenticated.
   - After cookie injection, dashboard route (`/`) loads.
   - Mission map route (`/map/:missionId`) is reachable for an existing mission.
4. Static quality gates:
   - `cd frontend && npm run lint`
   - `cd frontend && npm run build`

## 4) Data + navigation area (`postgres/`, `backend/src/db`, `backend/src/routes/navigation.js`)

### Run/seed behavior to remember

- `postgres/init.sql` and `postgres/seed_stanton.sql` initialize baseline data for first-time DB volume setup.
- Backend also runs an idempotent navigation seed on startup.

### Concrete data workflow

1. Reset DB when needed:
   - `docker compose down`
   - `docker volume rm krt-leadtool_postgres-data`
   - `docker compose up -d postgres valkey`
2. Restart backend and watch startup logs for seed success.
3. Trigger reseed endpoint with JWT token:
   - `curl -i -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/navigation/reseed`
4. (Optional) inspect DB row counts with `psql` to verify seed contents.

## 5) Infra/compose area (`docker-compose.yml`, `nginx/`, `scripts/`)

### Minimal compose workflow for Cloud debugging

- Core app dependencies only:
  - `docker compose up -d postgres valkey`
- Full stack (heavier, closer to prod):
  - `docker compose up -d --build`

### Compose verification workflow

1. `docker compose ps`
2. `curl -i http://localhost:3000/api/health` (backend direct)
3. `curl -i http://localhost/api/health` (through nginx, if nginx is up)
4. `docker compose logs --no-color --tail=100 backend`

## 6) Updating this skill (keep it useful)

Whenever you discover a new reliable runbook trick, update this file in the same PR or immediately after:

1. Add the trick under the relevant area section.
2. Include exact command(s), expected output/signal, and common failure mode.
3. If the trick is auth-, seed-, or env-related, also update **0) Fast bootstrap**.
4. Keep instructions minimal and executable; remove stale or duplicate steps.

Quick update checklist:

- Does a new teammate/agent get from zero to running app in <10 minutes?
- Is there a no-OAuth mock path for testing?
- Does each area include at least one concrete verification workflow?
