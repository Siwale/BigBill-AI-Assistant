# ADR-008 — Loop 3 Personal Environment, Device Hub & Media Companion

**Status:** Accepted for Loop 3
**Date:** 2026-11-24
**Branch:** `feat/loop3-personal-device-media-hub` base `d43606a`

## Context
Loop 3 extends Aida to see user-shared content, manage local hardware, and discover lawful music/movies. Research 2026-11-24 confirms:
- GPT-Live 1.1 supports audio/text only (image/video unsupported); Realtime (`gpt-realtime`) supports image inputs — keep Live for voice, separate vision backend for images.
- Browser: `getUserMedia`/`getDisplayMedia`/`selectAudioOutput`/`setSinkId` work with permission; Web Bluetooth is BLE GATT only, not A2DP speakers; WebUSB/HID/Serial limited and secure-context gated.
- Linux Bluetooth audio via BlueZ D-Bus + PipeWire/WirePlumber (A2DP/headset profiles); Web Bluetooth not replacement.
- Home Assistant: REST + WebSocket, `media_player`/`media_source`, OAuth, Matter via server; Bluetooth Classic not supported — use OS bridge for audio.
- Spotify policy prohibits voice-controlled playback; Apple MusicKit requires user auth and commercial SaaS legal review; TMDB free key not for commercial SaaS, needs commercial license; JustWatch partner API needs contract + ZM coverage.

## Decision
Keep modular monolith, add typed adapter platform, no new paid service without approval.

**Vision:** One-shot camera/screen/upload + bounded visual session (1 frame/2s, 2-min limit, explicit start/stop, transient retention). GPT-Live delegation: vision backend (gpt-4o vision) returns grounded observation to same conversation. No raw frames stored by default.

**Device Hub:** Capability registry (`device_connections`) with states `unsupported→available→permission_required→pairing→paired→connecting→connected→selected→active→disconnected/error`, per-adapter capabilities, feature-detect at runtime, no assumptions.

**Bluetooth audio (Linux first):** Optional local companion on loopback, one-time pairing code, origin-bound signed session, allowlisted `discover/pair/connect/disconnect/getSinks/selectSink/volume/testTone` — no arbitrary D-Bus/shell. PipeWire sink verification. Windows/macOS interfaces stubbed `unsupported`.

**Home Assistant:** Optional OAuth, encrypted token storage, REST health + WebSocket subscriptions, allowlisted `media_player`/`camera`/`sensor`/`light/switch`/`Matter` capabilities, per-entity scopes.

**Music:** `MusicProviderAdapter` (`searchCatalog/getUserLibrary/getFavorites/getPlaylists/getDevices/getPlaybackState/play/pause/next/setVolume/openInProvider`). Local library + Home Assistant media first; Spotify voice blocked by policy guard (passive Open handoff only); Apple Music gated behind legal review.

**Movies:** `MovieDiscoveryAdapter` (search, recommend, whereToWatch by `regionCode` default `ZM`, freshness). `movie_preferences` + `movie_watchlist`. TMDB/JustWatch adapters disabled until commercial license/partner contract + ZM verified; fallback is user-entered titles + official search handoff. No scraping/pirate/DRM bypass.

## Consequences
- Vision, devices, music, movies share same assistant identity, conversation, permissions, approval, audit.
- Provider adapters are typed, Zod-validated, tenant-scoped, audited; no generic shell/D-Bus/HA service tool.
- Companion binds `127.0.0.1` only, DNS rebinding/CSRF/rate-limit protections, no secrets in logs.
- Tests cover tenant isolation, permission boundaries, policy gates, idempotency, retention, reconnect.

## Alternatives
Microservices rejected; native companion is optional, not required for browser-only features.
