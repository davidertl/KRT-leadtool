# KRT-Leadtool

A web-based command & control tool for coordinating multi-crew operations in Star Citizen. Think of it as a lightweight ops table — you get a shared 3D map, unit tracking, operations management, and real-time sync across all connected browsers.

Built for org leaders who need to keep track of what's going on during large-scale operations (fleet fights, mining ops, SAR, convoys, etc.) without alt-tabbing into spreadsheets or Discord channels.

> **Status:** Active development. Core infrastructure, 3D map, unit/contact/task management, operations system, navigation database, and real-time comms are implemented. See the [roadmap](#whats-planned) for remaining work.

## Features

### Map & Visualization
- **3D space map** — React Three Fiber canvas with orbit controls, zoom, pan. Units, contacts, tasks, and waypoints render as color-coded markers with heading indicators.
- **Stanton system navigation** — Full celestial body rendering (Stanton star, 4 planets, 12 moons) with scaled 3D spheres, labels, and orbital marker rings.
- **Navigation points** — Stations, rest stops, Lagrange points, comm arrays, jump points, and outposts displayed with type-specific 3D geometries and danger indicators.
- **Waypoint paths** — Sequenced waypoints per unit, rendered as path lines on the map.

### Units & Groups
- **Unit management** — Create ships/vehicles/squads/persons/markers with callsign, ship type, role, crew count, and status tracking (idle, en route, on station, engaged, RTB, disabled).
- **Resource tracking** — Fuel, ammo, and hull percentage bars per unit with visual warnings at ≤25%. Bingo/Winchester indicators in unit lists.
- **ROE presets** — Rules of engagement per unit: weapons free, weapons tight, weapons hold, defensive, aggressive, no fire.
- **Groups** — Organize units into fleets by mission type (SAR, Fighter, Miner, Transport, Recon, Logistics, Custom).

### Contact Tracking (IFF / SPOTREP)
- **IFF classification** — Friend, hostile, neutral, unknown. Threat levels from none to critical.
- **Confidence levels** — Unconfirmed, hearsay, comms, visual, confirmed — with colored badges.
- **Movement vectors** — Estimated velocity (X/Y/Z) for contact trajectory tracking.
- **SPOTREP form** — Quick-entry intel reports with position, threat, ship type, and notes.

### Tasking System
- **15 task types** — Escort, intercept, recon, pickup, dropoff, hold, patrol, screen, QRF, rescue, repair, refuel, medevac, supply run, custom.
- **Scheduling** — Start at/due at datetime pickers, task dependencies (depends-on linking).
- **Priority & ROE** — Per-task priority (low/normal/high/critical) and ROE assignment.
- **Assignment** — Assign tasks to individual units or groups with target coordinates and contact references.

### Operations & Timeline
- **Operation phases** — 9-phase progression: Planning → Briefing → Phase 1–4 → Extraction → Debrief → Complete. Clickable phase bar with advancement controls.
- **Mission timer** — Shared countdown with preset durations (5/10/15/30 min), start/pause/reset controls, red pulse at ≤60 seconds.
- **Event log** — Mission timeline with typed entries (contact, kill, loss, rescue, task update, position report, intel, check-in/out, phase change, alert, custom) and time-ago formatting.

### Communications
- **Quick messages** — One-click military comms: Check In, Check Out, RTB, BINGO, WINCHESTER, HOLD, Contact, Status. Optional unit selector for attribution.
- **Custom messages** — Free text input alongside quick-send buttons.
- **Message feed** — Color-coded message display with timestamps.

### Map Bookmarks
- **Save locations** — Bookmark map positions with custom names, icons (10 emoji options), and coordinates.
- **Sharing** — Toggle bookmarks between private and team-visible.

### Infrastructure
- **Real-time sync** — All changes push instantly to every connected client via WebSockets (Socket.IO).
- **Offline support** — IndexedDB cache (Dexie) + service worker. App loads offline and delta-syncs on reconnect.
- **Discord login** — Auth via Discord OAuth2. No extra accounts needed. JWT session tokens.
- **Teams** — Isolated team workspaces with separate units, groups, contacts, and tasks.
- **History & undo** — Every status/position change is logged. Undo last change on any unit.
- **Input validation** — Zod schemas on all API endpoints with structured error responses.

## Tech stack

| Layer | What | Why |
|-------|------|-----|
| Frontend | React 18, Vite 5, Tailwind CSS 3 | Fast build, utility CSS |
| 3D | Three.js via @react-three/fiber + drei | WebGL without the pain |
| State | Zustand 5 | Simple, no boilerplate |
| Offline | Dexie 4 (IndexedDB) | Offline-first data cache |
| Backend | Node.js 20, Express 4, Socket.IO 4 | Real-time + REST in one process |
| Validation | Zod 3 | Type-safe request validation |
| Database | PostgreSQL 16 + PostGIS 3.4 | Spatial queries, robust relational |
| Cache | Valkey 8 | Redis-compatible, open source (BSD-3) |
| Auth | Passport + Discord OAuth2, JWT | Org members already have Discord |
| Proxy | Nginx | SSL termination, rate limiting |
| Infra | Docker Compose (8 services) | Single server, keeps it simple |
| CI/CD | GitHub Actions → GHCR → Watchtower | Push to main, server updates itself |
| SSL | Let's Encrypt + Certbot | Automated certificate renewal |
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

The first run will take a minute to pull images and build. The database schema (`init.sql`) and Stanton system seed data (`seed_stanton.sql`) are loaded automatically on first startup.

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

### Database Reset

If you've updated the schema or seed data, you need to wipe the Postgres volume:

```bash
docker compose down
docker volume rm krt-leadtool_postgres-data
docker compose up -d
```

## Project structure

```
├── backend/               # Express API + Socket.IO server
│   └── src/
│       ├── auth/          # Discord OAuth2, JWT middleware
│       ├── db/            # PostgreSQL + Valkey connections
│       ├── routes/        # REST endpoints
│       │   ├── units.js       # Unit CRUD + resources/ROE
│       │   ├── groups.js      # Fleet/group management
│       │   ├── teams.js       # Team workspaces
│       │   ├── contacts.js    # IFF/SPOTREP tracking
│       │   ├── tasks.js       # Mission tasking
│       │   ├── operations.js  # Op phases + timer
│       │   ├── navigation.js  # Star systems, bodies, nav points, routing
│       │   ├── events.js      # Mission timeline/event log
│       │   ├── messages.js    # Quick comms
│       │   ├── bookmarks.js   # Map bookmarks
│       │   ├── waypoints.js   # Unit waypoint sequences
│       │   ├── history.js     # Undo/status history
│       │   ├── sync.js        # Delta sync for offline clients
│       │   └── shipImages.js  # Ship image cache
│       ├── validation/    # Zod schemas + middleware
│       └── socket.js      # WebSocket event handlers
├── frontend/              # React SPA
│   └── src/
│       ├── components/
│       │   ├── SpaceMap.jsx         # 3D map canvas (Three.js)
│       │   ├── UnitMarker.jsx       # 3D unit markers
│       │   ├── ContactMarker.jsx    # IFF contact markers
│       │   ├── TaskMarker.jsx       # Task target markers
│       │   ├── NavPointMarker.jsx   # Celestial bodies + nav points
│       │   ├── WaypointLine.jsx     # Waypoint path lines
│       │   ├── Sidebar.jsx          # Main sidebar (9 tabs)
│       │   ├── UnitDetailPanel.jsx  # Unit info + resource bars
│       │   ├── TaskForm.jsx         # Task creation form
│       │   ├── SpotrepForm.jsx      # SPOTREP/contact entry
│       │   ├── OperationPanel.jsx   # Phase management + timer
│       │   ├── EventLog.jsx         # Mission timeline
│       │   ├── QuickMessages.jsx    # Military comms panel
│       │   └── BookmarkPanel.jsx    # Map bookmark manager
│       ├── pages/         # Login, Dashboard, Map
│       ├── stores/        # Zustand (authStore, missionStore)
│       └── lib/           # Socket client, offline DB (Dexie)
├── nginx/                 # Reverse proxy config
├── postgres/
│   ├── init.sql           # Full DB schema (enums, tables, indexes, triggers)
│   └── seed_stanton.sql   # Stanton system navigation data
├── scripts/               # Server setup, SSL init, backup scripts
├── docker-compose.yml
└── example.env
```

## Navigation Database

The Stanton system comes pre-seeded with:

| Category | Count | Examples |
|----------|-------|---------|
| Star | 1 | Stanton |
| Planets | 4 | Hurston, Crusader, ArcCorp, microTech |
| Moons | 12 | Daymar, Cellin, Yela, Lyria, Wala, Aberdeen, Arial, Ita, Magda, Calliope, Clio, Euterpe |
| Stations | 8 | Everus Harbor, Seraphim Station, Baijini Point, Port Tressler, + landing zones |
| Rest Stops | 10 | HUR-L1 through L5, CRU-L1/L4/L5, ARC-L1, MIC-L1/L2 |
| Comm Arrays | 4 | One per planet |
| Outposts/POIs | 4 | GrimHEX, Klescher, Security Post Kareah, Delamar |
| Jump Points | 3 | Stanton–Pyro, Stanton–Magnus, Stanton–Terra |
| QT Routes | 24 | Connecting all major locations |

Coordinates are in meters (system-local). The 3D map uses a 1:1,000,000 scale factor for rendering.

## What's planned

- [ ] **Drag & drop on map** — Move units by dragging them in 3D space (partially stubbed)
- [ ] **Granular roles** — Commander, Ops Officer, Intel, Logistics, Unit Lead, Viewer (currently admin/leader/member)
- [ ] **AAR & playback** — Replay past ops on a timeline, KPIs, lessons learned
- [ ] **QRF / MedEvac flows** — One-button scramble, casualty tracking
- [ ] **Operation templates** — Pre-built setups for common op types (bunker run, convoy escort, org event)
- [ ] **QT route planning** — Dijkstra pathfinding with convoy mode and ETA calculations (backend ready, UI pending)
- [ ] **Contact heatmaps** — Visualize recent contact density on the map
- [ ] **Kanban task view** — Alternative task visualization alongside map markers
- [ ] **Multi-system support** — Pyro and future systems (schema supports it, data needed)

## Known issues

- `requireRole` middleware exists but isn't used on most routes — any logged-in user can perform any action. Authorization enforcement is a priority fix.
- Drag & drop on the 3D map is stubbed (state + import exist) but not wired up.
- No tests yet. Jest is configured but there are zero test files.

## Contributing

This is an org-internal tool but PRs are welcome if you find it useful. No formal contribution guide yet — just open an issue or PR and we'll figure it out.

## License

Apache 2.0 — see [LICENSE](LICENSE).
