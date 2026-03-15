# Companion App Source Provenance

This directory contains the **Companion App** source code imported from the external KRT-Com_Discord repository. The KRT-leadtool backend in this repo provides the server-side API and voice relay that this client connects to.

## Upstream

| Field | Value |
|-------|--------|
| **Repository** | https://github.com/davidertl/KRT-Com_Discord |
| **Branch** | `main-ai-audit-fix` |
| **Commit** | `cf1497f01e2b79846374c642569e910da886dda9` (at time of import) |
| **Import date** | 2026-03-15 |

## What was imported

- The `comp/` tree from the upstream repo (solution `CompanionApp.sln`, project `CompanionApp/`).
- No server code from upstream; the server used by this app is the KRT-leadtool backend in this repo (voice host).

## How to sync from upstream

1. Clone the upstream repo and check out the desired branch:
   ```bash
   git clone https://github.com/davidertl/KRT-Com_Discord.git krt-com-upstream
   cd krt-com-upstream
   git checkout main-ai-audit-fix
   ```
2. Copy the contents of `comp/` over this `companion/` directory (overwrite existing files). Exclude any `*.zip` build artifacts.
3. Update this file with the new commit SHA and date.
4. Run the companion build and tests to ensure compatibility with the KRT-leadtool backend.

## License

The Companion App is subject to the same license as the upstream repository (see upstream LICENSE). KRT-leadtool documentation and backend are under this repo’s LICENSE.
