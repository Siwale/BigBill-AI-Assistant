# ADR-009 — Loop 4 Aida Command Environment & Forge Bridge

**Status:** Accepted for Loop 4
**Date:** 2026-11-24
**Branch:** `feat/loop4-aida-command-forge` base `6b93e95` (main) + `5339ce8` (Loop 3 voice fixes)
**Forge:** `0.6.0-pre-final` at `/home/bill/BigBill Systems/Forge` (Python >=3.12, FastAPI, Pydantic)

## Context
Loop 3 delivered Personal Environment (vision bounded sessions, device hub via companion, music/movies with legal gates). Loop 4 replaces the main app shell with a cinematic JARVIS-inspired command environment and adds secure, evidence-driven Forge repository review via the existing local companion. Qylon is reference-only (no code import).

Discovery:
- Aida app shell: `src/app/globals.css` (paper/mission-control/audio-simulator tokens), `src/app/app/layout.tsx` sidebar, `src/components/chat/chat-workspace.tsx` + `AudioVisualizer`, `live-webrtc.ts` (Live) / `realtime-webrtc.tsx` (Realtime), `Voice` fallback via Whisper/TTS. Tests 33/33.
- Forge API `src/forge/api/main.py` has in-memory `AUDITS`, no auth/tenant, path allowlist limited to `cases/...`, sync audit, simplistic trust enrichment. `tools.py`/`verification_engine.py` use `shell=True` — not safe for arbitrary repos. `sandbox.py` copies repo to temp (not OS isolation). `provider_manager.py` has fallback spend risk.
- Qylon local checkout not found (only `Documents/Qylon Frontend Development Tasks.pdf`); treat as reference, no runtime dependency.
- Companion: `companion/src/server.ts` binds `127.0.0.1:8787`, allowlisted `bluetoothctl/pactl/wpctl`, origin-bound sessions, `bluetoothctl:available` after fix, discovered `MB-M17pro`.

## Decision
Keep modular monolith, reuse companion, add typed bridge. No new paid service, no prod deploy.

**Shell:** Dark cinematic (near-black/navy, cyan/blue, amber approvals) design tokens, top command bar, left vertical rail, main stage, persistent command/voice dock. Original Aida Core (CSS/SVG/Canvas, no heavy WebGL) driven by real states: `idle/listening/thinking/searching/inspecting/verifying/speaking/waiting_approval/paused/error/disconnected`, single mic stream, `prefers-reduced-motion` static.

**Forge integration:**
```
Aida Web/API → Orchestrator (tenant, repo registry) → Companion (registered ID → canonical path) → Forge Aida Bridge (fixed `python -m forge.integrations.aida_bridge` via spawn, no shell) → Forge Core (recon, evidence validation, bounded) → sanitized v1 JSON + live stage events → Aida persistence/UI
```
- Versioned `ForgeAuditRequestV1`/`ForgeAuditResultV1` (Zod/Pydantic), `repositoryId` resolved server-side, realpath + allowed-root + symlink escape checks, snapshot hash, limits (maxFiles/Bytes/Duration), secret redaction, `capability_skipped` reasons.
- Start with read-only audit, no shell, no source mutation, no Qylon copy.

**Registry:** `engineering_repositories` (UUID, tenant/user, displayName, canonical path server-side, allowedRoot, remote URL redacted, branch/SHA, enabled), `engineering_audits`/`events`/`findings`/`artifacts` tenant-scoped, FK consistency.

## Consequences
- New default: Command (Aida Core) + Engineering workspace (Request, Core, Live Activity, Findings, Pipeline `REQUEST→CONNECT→MAP→ANALYSE→VERIFY→REPORT`, trust `SUPPORTED/CONFIRMED/PARTIALLY_CONFIRMED/UNVERIFIED/REJECTED` requiring artifact for `CONFIRMED`), Report view.
- Voice/text one conversation, permission-gated tools (`engineering.repositories.read`, `engineering.audit.run/read`), audit trail.
- Security: path traversal, symlink escape, tenant IDOR, secret redaction, sandbox disabled-network, resource limits — adversarial tests required.

## Alternatives
Iframe Forge UI rejected (no tenant, no evidence trust). Microservices rejected.

## Validation
- Contract tests for v1, no Forge checkout → Aida-side adapter + tests only, honest `Forge not available`.
- Provider disabled by default, explicit tenant permission + budget.

