# Phase 0 — Read-Only Discovery Findings

**Date:** 2026-11-23  
**Coordinator workspace:** `/home/bill/BigBill Systems/AI_assistant`  
**Status:** Discovery complete. No application code existed before this report.

## 1. Workspace reality

| Check | Evidence | Finding |
|---|---|---|
| Actual workspace path | `pwd` → `/home/bill/BigBill Systems/AI_assistant` | The folder on disk is **`AI_assistant`**, while the addendum text names it `Ai-assitant`. Per the addendum's "inspect the actual workspace, never assume the path" rule, the actual folder is used and **not renamed**. |
| Initial contents | `Docs/` only (4 specification files) | Greenfield workspace. No pre-existing application, no `AGENTS.md`, no README, no manifests, no user code to preserve. |
| Git | `git status` → `fatal: not a git repository` | Repository did not exist. Initialized locally on branch `main` at the user's explicit request. |
| Disk / memory / CPU | `free -h`, `nproc` | 15 GiB RAM, 8 vCPU. ~2.6 GiB was available during discovery; local services kept deliberately small. |

## 2. Actual runtime and tooling

| Component | Version / evidence | Decision |
|---|---|---|
| Node.js | `v22.23.2` | Matches the ADR's known BigBill/Khapy baseline. Use it. |
| npm | `10.9.8` | Package manager for this greenfield repo (npm workspaces). |
| pnpm | `9.15.4` | Available but not required. No mixing. |
| TypeScript | installed per project | Strict mode. |
| PostgreSQL client | `psql 16.15` | Client only; local host server requires unknown credentials. |
| Redis | `redis-server 7.0.15`, `redis-cli ping` → `PONG` | Existing host Redis exists; project uses an isolated instance instead. |
| Docker | `29.1.3` | Available; `pgvector/pgvector:pg15` and `redis:7-alpine` images already present locally. |
| ffmpeg | present | Available for audio conversion/QA if needed. |
| Network | npm registry and GitHub returned HTTP 200 | Dependency installation and provider calls are possible. |

### Project-provisioned services

To avoid touching other products' databases or Redis namespaces:

- PostgreSQL 15 + pgvector **0.8.1** in container `bigbill-assistant-db`, host port `5437`.
- Redis 7 in container `bigbill-assistant-redis`, host port `6384`.

Both are defined in `docker-compose.yml`. `CREATE EXTENSION vector` succeeds, so the ADR's hybrid RAG foundation is feasible.

## 3. Credentials and providers

Credential names were inspected; **values were never printed or committed**. Validated by HTTP status only:

| Provider | Availability | Validation |
|---|---|---|
| OpenAI | key present in local sibling environment | `GET /v1/models` → **200** |
| DeepSeek | key present | `GET /models` → **200** |
| OpenRouter | key present | `GET /api/v1/key` → **200** |
| Anthropic | key declared but empty | not usable |
| Gemini | key present | not required for Loop 1 |
| Deepgram / ElevenLabs / LiveKit | no credentials found | not usable without approval/purchase |

Local runtime credentials are copied into a **git-ignored `.env.local`** by a setup script. No secret is written to source, docs, logs or client bundles.

## 4. Voice feasibility

| Check | Finding |
|---|---|
| LiveKit server | Not installed locally; image not present. Self-hosting is possible but requires UDP/TLS network validation and consumes additional memory. |
| LiveKit credentials | None. LiveKit Cloud would be a new paid service and is explicitly not approved. |
| Browser speech APIs | Available in Chrome-family browsers (the user's in-app browser is Chrome-based). Real `SpeechRecognition` and `speechSynthesis` are supported. |
| Server speech fallback | OpenAI key is valid; push-to-talk audio can be transcribed and spoken server-side through the same provider account. |
| Microphone in this headless environment | No physical microphone is available to the coding session. End-to-end acoustic testing must be performed by the user in a real browser; UI/state/stream logic can be verified programmatically. |

**Decision:** deliver real, user-initiated voice in the first release through a browser-native streaming speech path, with a server-side OpenAI STT/TTS fallback for unsupported browsers. LiveKit remains the preferred production transport and is documented as the next voice milestone. This is recorded in ADR-004 as an explicit, evidence-backed deviation; it is **not** a mock or a decorative microphone.

## 5. Integration audit status

| System | Availability | Loop 1 handling |
|---|---|---|
| BigBill BOS | No dedicated BOS application repository found in the immediate workspace inventory during initial scan | Not connected. Displayed honestly as unavailable. Read-only contract only. |
| Khapy | Repository present at `/home/bill/BigBill Systems/Khapy` | Audited read-only by an independent specialist; no real creative-brief API is claimed unless evidence supports it. |
| MotherTracker | No MotherTracker repository found in the workspace inventory | Not connected. Displayed honestly as unavailable. |
| Email | No verified assistant-side connector | Drafts only. Sending disabled. |
| WhatsApp | No verified assistant-side connector | Drafts only. Sending disabled. |
| Calendar | No verified connector | Not claimed. |

The detailed Khapy/BOS/MotherTracker evidence table is consolidated in `Docs/Discovery/INTEGRATION_AUDIT.md`. Where an integration is not verified, the product says so and offers the safe next step; it never simulates success.

## 6. Baseline quality gates

No application existed, therefore there was no pre-existing test/lint/typecheck/build baseline. The new baseline is established by this loop and recorded in the final QA report.

## 7. Architectural decision

A modular monolith is the smallest architecture consistent with the evidence: one Next.js application containing clearly bounded domain modules, plus one background worker process and one database. No microservice fleet, no second framework, no new paid infrastructure.

## 8. Known risks and constraints

1. **No physical microphone** in the coding environment; acoustic quality must be verified by the founder.
2. **LiveKit not staged**; browser voice is the working first-release path and LiveKit is a documented upgrade.
3. **Business connectors are unverified**; Loop 1 must not pretend BOS/Khapy/MotherTracker data is available.
4. **Local credentials are shared from a sibling project**; they are not committed and must be replaced by dedicated production secrets before deployment.
5. **No production deployment** will be performed. Staging/production readiness is reported with evidence and gaps.
6. The folder spelling differs from the addendum; renaming was explicitly forbidden, so the real path is authoritative.
