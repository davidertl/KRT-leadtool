# KRT-Leadtool Companion App

Desktop (WPF) client for voice and status sync when using a KRT-leadtool server with the **voice** module. Connect to the server’s **voice host** for login, voice relay, and optional mission status updates.

Voice audio is **end-to-end encrypted** (per-frequency AES-256-GCM). The server distributes keys over TLS and relays encrypted frames without decrypting; the app encrypts before send and decrypts on receive when a key is available for the frequency.

## Requirements

- **OS:** Windows 10/11 (64-bit)
- **Runtime:** .NET 10 (Windows Desktop)
- **Server:** A KRT-leadtool deployment with `APP_MODULES` including `voice`, and a reachable **voice host** (e.g. `https://voice.yourdomain.com`).

## Server URL

In the app settings, use the **voice host** URL, not the main WebUI URL:

- **Correct:** `https://voice.yourdomain.com` (or your actual `VOICE_DOMAIN`)
- **Wrong:** `https://yourdomain.com` (main app; no companion API there)

The voice host serves:

- Companion Discord OAuth: redirect and callback
- REST: `/api/companion/server-status`, `/api/companion/privacy-policy`, `/api/companion/auth/*`, `/api/voice/*`
- WebSocket: `/voice` (audio relay)

## Discord OAuth

Operators must register the companion callback in the Discord application:

- **Redirect URI:** `https://voice.<your-domain>/api/companion/auth/callback`

Same Discord app can have both the main WebUI callback and the companion callback.

## Build (local)

1. Install [.NET 10 SDK](https://dotnet.microsoft.com/download) (Windows).
2. From this directory:
   ```bash
   dotnet build CompanionApp.sln -c Release
   ```
3. Run:
   ```bash
   dotnet run --project CompanionApp --configuration Release
   ```
   Or open `CompanionApp.sln` in Visual Studio and run the WPF app.

## Packaging / release

Release artifacts (e.g. Windows installer or portable build) are produced by CI from this repo; see the repository root README and `.github/workflows` for how to obtain published builds.

## Source provenance

See [PROVENANCE.md](PROVENANCE.md) for upstream repository, branch, and sync instructions.
