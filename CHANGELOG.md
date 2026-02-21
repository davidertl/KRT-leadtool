# Changelog

All notable changes to the KRT-Leadtool project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-21

### Added
- App versioning — version displayed in frontend UI corner and backend `/api/health`
- CI support for semver Git tags (`v0.2.0` → Docker image tagged `0.2.0` and `0.2`)
- CHANGELOG.md for tracking releases

### Changed
- Comms panel: replaced old preset buttons (Check In, Check Out, RTB, BINGO, etc.) with unit status options from Class_setup.md (Boarding, Ready for Takeoff, On the Way, Arrived, Ready for Orders, In Combat, Heading Home, Disabled)
- Comms panel: "Under Attack" moved into the status button grid (was standalone panic button)
- Menu bar reordered: Operation → Group → Unit → Person → SPOTREP → Comms → Task → Event Log → Multiplayer → POI → Selection
- Renamed "IFF / Contacts" → "SPOTREP" and "Bookmarks" → "POI"
- Popup windows z-index increased to render above 3D starmap labels

### Fixed
- Nginx two-stage boot: HTTP-only mode when SSL certs don't exist yet (for Let's Encrypt bootstrap)
- Valkey healthcheck missing auth password
- Official nginx entrypoint interfering with custom template logic

## [0.1.0] - Initial Release

### Added
- Core application: Discord OAuth, mission management, 3D starmap, real-time multiplayer sync
- Docker Compose stack with nginx, PostgreSQL/PostGIS, Valkey, Certbot
- Navigation database with Stanton system seed data
