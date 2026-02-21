# KRT-Leadtool

A web-based command & control tool for coordinating multi-crew operations in Star Citizen. Think of it as a lightweight ops table — you get a shared 3D map, unit tracking, operations management, and real-time sync across all connected browsers.

Built for org leaders who need to keep track of what's going on during large-scale operations (fleet fights, mining ops, SAR, convoys, etc.) without alt-tabbing into spreadsheets or Discord channels.

Warning! This is a WIP project in active development. For this early version my todo is a local list, still you can report bu

> **Status:** Active development. Core infrastructure, 3D map, unit/person management, operations system, navigation database, real-time comms with system status automation, and floating popup window UI are all implemented. See the [roadmap](#whats-planned) for remaining work.

## Features

### Map & Visualization
- **3D space map** — React Three Fiber canvas with orbit controls, zoom, pan. Units, contacts, tasks, and waypoints render as color-coded markers with heading indicators. Map takes full screen width with floating popup windows.
- **Stanton system navigation** — Full celestial body rendering (Stanton star, 4 planets, 12 moons) with scaled 3D spheres, labels, and orbital marker rings. Auto-seeded on first startup with manual "Update Starmap" reset option.
- **Navigation points** — Stations, rest stops, Lagrange points, comm arrays, jump points, and outposts displayed with type-specific 3D geometries and danger indicators.
- **Waypoint paths** — Sequenced waypoints per unit, rendered as path lines on the map.

### Units & Persons
- **Separated units and persons** — Ships/vehicles and persons have dedicated panels with type-appropriate fields. Persons omit fuel, ammo, hull, and crew fields; ships show full resource tracking.
- **Unit management** — Create ships/vehicles with VHF-Freq, ship type, role, crew count, and status tracking (boarding, ready for takeoff, on the way, arrived, ready for orders, in combat, heading home, disabled).
- **Person management** — Dedicated Persons menu (Alt+2) with person-specific detail panel. Persons can be assigned aboard ships via parent unit linking.
- **Resource tracking** — Fuel, ammo, and hull percentage bars per ship/vehicle with visual warnings at ≤25%. Bingo/Winchester indicators in unit lists.
- **ROE presets** — Rules of engagement per unit: weapons free, weapons tight, weapons hold, defensive, aggressive, no fire.
- **Groups** — Organize units into fleets by mission type (SAR, Fighter, Miner, Transport, Recon, Logistics, Custom). Edit VHF channel, ROE, and unit assignments per group.
- **Axis-locked drag** — Map drag constrained to one axis at a time (X or Z) based on initial drag direction for precise positioning.

### Contact Tracking (IFF / SPOTREP)
- **IFF classification** — Friend, hostile, neutral, unknown. Threat levels from none to critical.
- **Confidence levels** — Unconfirmed, hearsay, comms, visual, confirmed — with colored badges.
- **Movement vectors** — Estimated velocity (X/Y/Z) for contact trajectory tracking.
- **SPOTREP form** — Quick-entry intel reports with position, threat, ship type, and notes. Auto-generated naming: `[threat] RefPoint distance`.

### Tasking System
- **16 task types** — Escort, intercept, recon, pickup, dropoff, hold, patrol, screen, QRF, rescue, repair, refuel, medevac, supply run, move, custom.
- **Scheduling** — "Start now" checkbox (pre-checked by default), start at/due at datetime pickers, task dependencies (depends-on linking).
- **Priority & ROE** — Per-task priority (low/normal/high/critical) and ROE assignment.
- **Assignment** — Assign tasks to individual units or groups with target coordinates and contact references.
- **Nav point targeting** — Dropdown to select navigation points as target position, auto-filling coordinates. Button to auto-fill from source contact.
- **Source contact linking** — SPOTREP → Task transformation with automatic data copy.

### Operations & Timeline
- **Operation phases** — Customizable multi-phase progression with default templates (Planning → Briefing → Phase 1–4 → Extraction → Debrief → Complete). Add, remove, and toggle start/end phases. Double-create prevention.
- **Mission timer** — Shared countdown with preset durations (5/10/15/30 min), start/pause/reset controls, red pulse at ≤60 seconds.
- **Event log** — Real-time mission timeline with typed entries (contact, kill, loss, rescue, task update, position report, intel, check-in/out, phase change, alert, custom). Filters for time range, event type, unit/group, keyword search. Manual entry creation and JSON export.
- **Debrief** — Past operations accessible in the debriefing section with timestamps, tasks, and units/groups summary. Notes per phase/task with user attribution.

### Communications
- **System status automation** — Status preset buttons (Boarding, Ready for Takeoff, On the Way, Arrived, Ready for Orders, In Combat, Heading Home, Disabled) auto-update the reporting unit's status in the database when sent via "System" mode (default).
- **Ship status aggregation** — When all persons aboard a ship report the same status, the ship's status auto-updates. Ship status can still be manually overridden.
- **Recipient modes** — Send To: System (default, updates status silently), Lead (visible to leaders only), All, specific Unit, or Group.
- **Under Attack panic button** — Full-width emergency alert with pulse animation.
- **Custom messages** — Free text input alongside quick-send status buttons.
- **Message feed** — Color-coded message display with timestamps. System status messages filtered from feed (they update unit status, not chat).

### Map Bookmarks
- **Save locations** — Bookmark map positions with custom names, icons (10 emoji options), and coordinates.
- **Sharing** — Toggle bookmarks between private and team-visible.

### Infrastructure
- **Real-time sync** — All changes push instantly to every connected client via WebSockets (Socket.IO). Units, messages, events, contacts, tasks, and operations all broadcast updates.
- **Offline support** — IndexedDB cache (Dexie) + service worker. App loads offline and delta-syncs on reconnect.
- **Discord login** — Auth via Discord OAuth2. No extra accounts needed. JWT session tokens.
- **Teams** — Isolated team workspaces with separate units, groups, contacts, and tasks.
- **History & undo** — Every status/position change is logged in status_history. Undo last change on any unit.
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
│       ├── auth/          # Discord OAuth2, JWT middleware, team auth
│       ├── db/            # PostgreSQL + Valkey connections, seed logic
│       ├── helpers/       # Event log helper
│       ├── routes/        # REST endpoints
│       │   ├── units.js           # Unit CRUD + resources/ROE/status history
│       │   ├── groups.js          # Fleet/group management + VHF/ROE
│       │   ├── teams.js           # Team workspaces
│       │   ├── contacts.js        # IFF/SPOTREP tracking
│       │   ├── tasks.js           # Mission tasking
│       │   ├── operations.js      # Op lifecycle + timer
│       │   ├── operationPhases.js # Phase CRUD
│       │   ├── operationRoe.js    # Per-group/unit/all ROE
│       │   ├── operationNotes.js  # Phase/task notes
│       │   ├── navigation.js      # Star systems, bodies, nav points, reset/reseed
│       │   ├── events.js          # Mission timeline/event log + filters + export
│       │   ├── messages.js        # Quick comms + system status automation
│       │   ├── bookmarks.js       # Map bookmarks
│       │   ├── waypoints.js       # Unit waypoint sequences
│       │   ├── history.js         # Undo/status history
│       │   ├── sync.js            # Delta sync for offline clients
│       │   ├── members.js         # Mission membership
│       │   ├── missions.js        # Mission CRUD + public/private
│       │   └── shipImages.js      # Ship image cache
│       ├── validation/    # Zod schemas + middleware
│       └── socket.js      # WebSocket event handlers + broadcasting
├── frontend/              # React SPA
│   └── src/
│       ├── components/
│       │   ├── SpaceMap.jsx           # 3D map canvas (Three.js)
│       │   ├── MenuBar.jsx            # Top navigation bar with hotkeys
│       │   ├── PopupWindow.jsx        # Reusable draggable/resizable window
│       │   ├── PopupPanels.jsx        # All popup window contents (units, persons, groups, tasks, etc.)
│       │   ├── UnitMarker.jsx         # 3D unit markers
│       │   ├── ContactMarker.jsx      # IFF contact markers
│       │   ├── TaskMarker.jsx         # Task target markers
│       │   ├── NavPointMarker.jsx     # Celestial bodies + nav points
│       │   ├── WaypointLine.jsx       # Waypoint path lines
│       │   ├── UnitDetailPanel.jsx    # Ship/vehicle detail + resource bars
│       │   ├── PersonDetailPanel.jsx  # Person detail (no ship-specific fields)
│       │   ├── TaskForm.jsx           # Task creation/edit form
│       │   ├── SpotrepForm.jsx        # SPOTREP/contact entry
│       │   ├── OperationPanel.jsx     # Phase management + timer + debrief
│       │   ├── EventLog.jsx           # Mission timeline with filters
│       │   ├── QuickMessages.jsx      # Military comms + system status
│       │   ├── BookmarkPanel.jsx      # Map bookmark manager
│       │   ├── MultiplayerPanel.jsx   # Mission sharing, public/private toggle
│       │   ├── SearchFilter.jsx       # Global search
│       │   ├── ConnectionStatus.jsx   # WebSocket connection indicator
│       │   └── OnlineUsers.jsx        # Connected users display
│       ├── pages/         # Login, Dashboard, Map
│       ├── stores/        # Zustand (authStore, missionStore, popupStore)
│       ├── hooks/         # Custom hooks (useVehicleData)
│       └── lib/           # Socket client, offline DB (Dexie)
├── localdoc/              # Internal documentation
│   ├── Class_setup.md         # Data model & enum definitions
│   ├── features.md            # Feature spec (German)
│   ├── GeneralPlan.md         # Architecture plan
│   └── to-do.md               # Feature roadmap & bug tracker
├── nginx/                 # Reverse proxy config
├── postgres/
│   ├── init.sql           # Full DB schema (enums, tables, indexes, triggers)
│   └── seed_stanton.sql   # Stanton system navigation data
├── scripts/               # Server setup, SSL init, backup scripts
├── docker-compose.yml
└── example.env
```

## Navigation Database

Right now the navigation database is seeded with the Stanton system (star, planets, moons) and a selection of nav points (stations, rest stops, Lagrange points, comm arrays, jump points, outposts).
All Ships, Persons, POIs or Coordinates are in meters (system-local). The 3D map uses a 1:1,000,000 scale factor for rendering. (?)

**note for myself** - need to verify the scale factor and coordinate system with in-game data, 'may' require adjustments. ;-) 

## What's planned

- [ ] **Per-unit task tracking** — When a task is assigned to a group, list all member units with individual completion status and allow leads to unattend units
- [ ] **Phase rename & task listing** — Inline rename for operation phases and display of tasks assigned to each phase
- [ ] **Drag & drop on map** — Move units by dragging them in 3D space (partially stubbed)
- [ ] **Granular roles** — Commander, Ops Officer, Intel, Logistics, Unit Lead, Viewer (currently admin/leader/member)
- [ ] **AAR & playback** — Replay past ops on a timeline, KPIs, lessons learned
- [ ] **QRF / MedEvac flows** — One-button scramble, casualty tracking
- [ ] **Operation templates** — Pre-built setups for common op types (bunker run, convoy escort, org event)
- [ ] **QT route planning** — Dijkstra pathfinding with convoy mode and ETA calculations (backend ready, UI pending)
- [ ] **Contact heatmaps** — Visualize recent contact density on the map
- [ ] **Kanban task view** — Alternative task visualization alongside map markers
- [ ] **Multi-system support** — Pyro and future systems (schema supports it, data needed)
- [ ] **Mobile UI** — Responsive design for tablets and phones (map view + key panels)

## Known issues

- `requireRole` middleware exists but isn't used on most routes — any logged-in user can perform any action. Authorization enforcement is a priority fix, but not fully planned yet.
- Drag & drop on the 3D map works only on x/y axes bot z axis.
- No tested yet.


## Contributing

This is an org-internal tool but PRs are welcome if you find it useful. No formal contribution guide yet — just open an issue or PR and we'll figure it out.

## License

Apache 2.0 — see [LICENSE](LICENSE).
