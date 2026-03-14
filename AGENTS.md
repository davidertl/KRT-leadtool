# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview
Two independent packages (not a monorepo workspace): `backend/` (Express + Socket.IO) and `frontend/` (React + Vite). See `README.md` for full tech stack and API route list.

### Required services
| Service | How to run locally | Default port |
|---|---|---|
| PostgreSQL 16 + PostGIS 3.4 | `sudo docker start krt-postgres` (or re-create; see below) | 5432 |
| Valkey 8 (Redis-compatible) | `sudo docker start krt-valkey` (or re-create; see below) | 6379 |
| Backend | `cd backend && NODE_ENV=development POSTGRES_HOST=localhost POSTGRES_USER=$POSTGRES_USER POSTGRES_PASSWORD=$POSTGRES_PASSWORD POSTGRES_DB=$POSTGRES_DB VALKEY_HOST=localhost VALKEY_PASSWORD= npx nodemon src/index.js` | 3000 |
| Frontend | `cd frontend && npx vite --host 0.0.0.0` | 5173 |

### Critical: injected env vars override dotenv
The Cloud Agent VM injects secrets (e.g. `POSTGRES_HOST=postgres`, `VALKEY_HOST=valkey`, `NODE_ENV=production`) as shell environment variables. Since `dotenv` does not overwrite existing env vars, you **must** pass local-dev overrides explicitly on the command line when starting the backend (see table above).

### Docker containers for data services
If the containers don't exist yet, create them:
```bash
sudo docker run -d --name krt-postgres \
  -e POSTGRES_USER="$POSTGRES_USER" -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" -e POSTGRES_DB="$POSTGRES_DB" \
  -p 5432:5432 \
  -v /workspace/postgres/init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro \
  -v /workspace/postgres/seed_stanton.sql:/docker-entrypoint-initdb.d/02-seed-stanton.sql:ro \
  postgis/postgis:16-3.4

sudo docker run -d --name krt-valkey \
  -p 6379:6379 \
  valkey/valkey:8-alpine \
  valkey-server --appendonly yes --maxmemory 100mb --maxmemory-policy allkeys-lru
```
Schema + Stanton seed data load automatically on first postgres boot via `/docker-entrypoint-initdb.d/`.

### Vite proxy
The frontend Vite dev server proxies `/api` and `/socket.io` to `http://localhost:3000`, so Nginx is not needed for local dev.

### Lint
Both packages define `npm run lint` (ESLint 9), but no `eslint.config.js` files exist in the repo — lint will error until config is added. This is a pre-existing issue.

### Tests
Backend: `cd backend && npx jest --passWithNoTests` (no tests written yet).

### Build
Frontend: `cd frontend && npx vite build` — produces `dist/`.

### Authentication
Discord OAuth2 is the only auth method. Without valid `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` credentials registered at https://discord.com/developers/applications, login will fail. The callback URL must match what's registered in the Discord app.

### Public IP for OAuth callback
The domain in the injected secrets likely doesn't point to the Cloud Agent VM. Use the VM's public IP (find via `curl -s ifconfig.me`) in `APP_URL` and `DISCORD_CALLBACK_URL` if you need OAuth to work, and update the Discord app's redirect URI accordingly.
