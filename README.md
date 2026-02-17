# KRT-Leadtool

A web-based command & control tool for coordinating multi-crew operations in Star Citizen. Think of it as a lightweight ops table — you get a shared 3D map, unit tracking, and real-time sync across all connected browsers.

Built for org leaders who need to keep track of what's going on during large-scale operations (fleet fights, mining ops, SAR, convoys, etc.) without alt-tabbing into spreadsheets or Discord channels.

> **Status:** Early development. Core infrastructure and basic map/unit features work, but most of the planned feature set is still being built out. See the [roadmap](#whats-planned) below.

## What it does (right now)

- **3D space map** — React Three Fiber canvas with orbit controls, zoom, pan. Units show up as color-coded markers with heading indicators.
- **Units & groups** — Create ships/vehicles, assign them to groups (SAR, Fighter, Miner, Transport, Recon, Logistics, or custom). Track status (idle, en route, on station, engaged, RTB, disabled).
- **Real-time sync** — All changes push instantly to every connected client via WebSockets. Move a unit on your screen, everyone sees it.
- **Teams** — Create separate team workspaces. Invite people. Each team has its own units, groups, and waypoints.
- **Waypoints** — Set sequenced waypoints for units. Shows as path lines on the 3D map.
- **History & undo** — Every status/position change is logged. You can undo the last change on any unit.
- **Offline support** — IndexedDB cache + service worker. If you lose connection, the app still loads. It syncs back up when you reconnect (delta sync).
- **Discord login** — Auth via Discord OAuth2. No extra accounts needed.

## Tech stack

| Layer | What | Why |
|-------|------|-----|
| Frontend | React 18, Vite, Tailwind CSS | Fast build, easy styling |
| 3D | Three.js via @react-three/fiber + drei | WebGL without the pain |
| State | Zustand | Simple, no boilerplate |
| Backend | Node.js, Express, Socket.IO | Real-time + REST in one process |
| Database | PostgreSQL 16 + PostGIS | Spatial queries down the line |
| Cache | Valkey 8 | Redis-compatible but actually open source (BSD-3) |
| Auth | Passport + Discord OAuth2, JWT | Org members already have Discord |
| Proxy | Nginx | SSL termination, rate limiting |
| Infra | Docker Compose | Single server, keeps it simple |
| CI/CD | GitHub Actions → GHCR → Watchtower | Push to main, server updates itself |
| Monitoring | Uptime Kuma | Lightweight, self-hosted |

## Getting started

### Prerequisites

- Docker & Docker Compose
- A Discord application (for OAuth2) — [create one here](https://discord.com/developers/applications)
- A domain with DNS pointing to your server (for SSL)

### Setup

```bash
# Clone
git clone https://github.com/davidertl/KRT-leadtool.git
cd KRT-leadtool

# Configure
cp example.env .env
# Edit .env — fill in your Discord client ID/secret, domain, passwords, etc.

# Run
docker compose up -d
```

The first run will take a minute to pull images and build. After that, your app should be live at whatever domain you configured.

For SSL, you'll need to set up Certbot on the host — the `scripts/setup-server.sh` script handles that along with Docker installation and cron jobs for backups.

### Development

If you want to run things locally without Docker:

```bash
# Backend
cd backend
npm install
npm run dev   # starts with nodemon

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # Vite dev server with HMR
```

You'll need a local PostgreSQL and Valkey instance, or point the env vars at a Docker container running those.

## Project structure

```
├── backend/           # Express API + Socket.IO server
│   └── src/
│       ├── auth/      # Discord OAuth2, JWT middleware
│       ├── db/        # PostgreSQL + Valkey connections
│       ├── routes/    # REST endpoints (units, groups, teams, etc.)
│       └── socket.js  # WebSocket event handlers
├── frontend/          # React SPA
│   └── src/
│       ├── components/  # SpaceMap, UnitMarker, Sidebar, etc.
│       ├── pages/       # Login, Dashboard, Map
│       ├── stores/      # Zustand state management
│       └── lib/         # Socket client, offline DB
├── nginx/             # Reverse proxy config
├── postgres/          # DB init script (schema)
├── scripts/           # Server setup, backup scripts
├── docker-compose.yml
├── example.env
└── localdoc/          # Internal planning docs (not part of the app)
```

## What's planned

There's a detailed feature spec in `localdoc/features.md`, but the short version:

- [ ] **Contact tracking** — IFF (friend/foe/neutral/unknown), threat ratings, confidence levels, last sighted timestamps
- [ ] **Tasking system** — Assign missions to units (escort, intercept, patrol, QRF, etc.), Kanban/timeline views, approval workflows
- [ ] **Comms hub** — In-app messaging with channels, quick templates ("RTB", "Bingo Fuel", "Contact"), event timeline
- [ ] **Resources & logistics** — Fuel, ammo, medical supplies per unit. Bingo/Winchester warnings. Depot management.
- [ ] **Intel / SPOTREP** — Quick-entry intel reports, auto-placed on map, heatmaps of recent contacts
- [ ] **Multi-system navigation** — Star Citizen system/jump point database, QT route planning, convoy mode, ETA calculations
- [ ] **Op timer** — Shared mission clock with named phases
- [ ] **Drag & drop on map** — Move units by dragging them in 3D space (partially stubbed, not wired up yet)
- [ ] **Granular roles** — Commander, Ops Officer, Intel, Logistics, Unit Lead, Viewer (currently only admin/leader/member)
- [ ] **AAR & playback** — Replay past ops on a timeline, KPIs, lessons learned
- [ ] **QRF / MedEvac flows** — One-button scramble, casualty tracking
- [ ] **ROE presets** — Defensive / Aggressive / No Fire, assignable per unit or group
- [ ] **Operation templates** — Pre-built setups for common op types (bunker run, convoy escort, org event)

## Known issues

- `requireRole` middleware exists but isn't actually used on any route yet — so right now any logged-in user can do anything. Authorization enforcement is a priority fix.
- Drag & drop on the 3D map is stubbed (state + import exist) but not wired up.
- The Docker internal network blocks outbound traffic, which breaks Discord OAuth in production — needs a networking fix before deploying.
- No input validation on API endpoints (no Joi/Zod). On the list.
- No tests yet. Jest is configured but there are zero test files.

## Contributing

This is an org-internal tool but PRs are welcome if you find it useful. No formal contribution guide yet — just open an issue or PR and we'll figure it out.

## License

Apache 2.0 — see [LICENSE](LICENSE).
