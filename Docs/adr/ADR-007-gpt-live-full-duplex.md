# ADR-007 — GPT-Live Full-Duplex Voice with Client Delegation

**Status:** Proposed for Loop 2.4
**Date:** 2026-11-24
**Deciders:** Coordinator / Voice transport / Conversation delegation

## Context
Loop 2.3 stabilized Realtime GA (`/v1/realtime/client_secrets` → `POST /v1/realtime/calls`) as a record/transcribe fallback. Loop 2.4 requires true full-duplex: user and Aida speak simultaneously, barge-in yields immediately, interjections at natural pauses, one unified BigBill assistant identity/conversation/tools/audit.

Official OpenAI docs now list **GPT-Live 1.1 (`gpt-live-1.1`)** as the full-duplex model (listen while speaking, client delegation to app backend). Docs to verify at implementation:
- https://developers.openai.com/api/docs/guides/live
- https://developers.openai.com/api/docs/guides/voice-webrtc
- https://developers.openai.com/api/docs/guides/live-conversations (session.transcript deltas)
- https://developers.openai.com/api/docs/guides/live-delegation (`delegation: {type:"client"}`)
- https://developers.openai.com/api/docs/models/gpt-live-1.1
- https://developers.openai.com/api/docs/pricing

Fallback candidate if GPT-Live unavailable: `gpt-realtime-2.1` with current GA Realtime WebRTC/VAD.

## Decision
Select **GPT-Live 1.1** as primary, with server-mediated WebRTC.

Flow:
1. User clicks **Start live conversation** → browser requests mic (selected device) → creates `RTCPeerConnection` + data channel → sends SDP offer to BigBill `POST /api/voice/live/session`.
2. Server validates authenticated session, `tenantId/userId/conversationId` ownership, feature flag `LIVE_VOICE_ENABLED`, per-session max duration (e.g. 10 min), concurrent cap (1), rate limit.
3. Server creates GPT-Live session via `POST https://api.openai.com/v1/live/sessions` with `{model:"gpt-live-1.1", transport:{type:"webrtc"}, delegation:{type:"client"}, audio:{input:{transcription:{model:"whisper-1"}}, output:{voice:"alloy"}}, instructions: tenant assistant profile + persona (bounded)}` using long-lived project key + `OpenAI-Safety-Identifier` hash. Returns only SDP answer + `sessionId/model/expiresAt` with `Cache-Control: no-store`.
4. Browser sets remote description, waits for `session.started`, marks `connected` (not just peer created). Remote audio → `audio` element with `setSinkId(selectedOutputId)` where supported, else system default visibly labeled.
5. Transcripts: aggregate `session.input_transcript.delta` (user) and `session.output_transcript.delta` (Aida) by `eventId`, persist once as normal `messages` rows (`channel=live`, `provider=gpt-live-1.1`) with idempotency on `eventId+sessionId`. Incomplete/interrupted fragments saved with `interrupted` marker, not as complete messages.
6. Delegation: on `session.delegation.created` ({delegation_id}) correlate with recent transcript + conversation history, call existing `assistant/orchestrator` + `toolRegistry` + `permission/approval` + `audit` server-side, return `delegation.result` with verified text. No second `sendMessage()` for same turn.

If GPT-Live 1.1 returns 404/403 or model not enabled, server returns 409 `live_not_available` with honest message; UI falls back to record/transcribe mode labeled **record/transcribe fallback**, never “live”.

## Consequences
- One response invariant: one user message + one assistant message per turn, even with live acknowledgements. Provider event IDs prevent duplicates.
- Business context stays server-side; browser never sees DB credentials or BOS/Khapy secrets.
- Cost: billed by session duration (active vs standby per-minute rates from pricing page) + delegation/model usage. Feature flag + visible elapsed timer + max duration + auto-close on stop/logout/navigation/inactivity. No paid sessions in CI; manual smoke test only with explicit founder approval.
- Hardware: single mic stream → peer + `AnalyserNode` (MIC IN) and remote stream → `AnalyserNode` (AIDA OUT) for duplex visualizer states `DUPLEX/INTERRUPTED`.
- Pricing/availability to be re-checked at implementation and recorded here with short-session estimate before any live billing.

## Alternatives considered
- Keep Realtime 2.1: lacks true full-duplex listen-while-speaking, still half-duplex turn-taking.
- Two parallel providers: rejected — keep provider boundary small.

## Validation
- Contract tests mock provider HTTP (client_secrets, live/sessions, SDP, delegation events) — no billable minutes.
- Manual full-duplex acceptance script (Loop 2.4 §6) only after explicit approval.
