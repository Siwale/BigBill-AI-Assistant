# ADR-004 — First-Release Voice Path

**Status:** Accepted for Loop 1, with a documented deviation from the LiveKit baseline  
**Date:** 2026-11-23

## Context

The addendum makes voice a first-working-release requirement. The ADR prefers LiveKit Agents for Node.js + WebRTC. Phase 0 found:

- no LiveKit server, image, credentials or staged network;
- no Deepgram/ElevenLabs credentials;
- a valid OpenAI key;
- a Chrome-family user browser;
- no physical microphone available to the coding session.

LiveKit Cloud and new paid speech providers are not approved. Deploying an unvalidated media server is prohibited by the specification.

## Decision

Deliver **real voice** through two cooperating paths that share one conversation and one intelligence:

1. **Primary: browser speech session** — explicit push-to-talk/session start; `SpeechRecognition` for streaming interim and final transcripts; `speechSynthesis` for spoken replies; visible idle/listening/thinking/speaking/error states; stop control; barge-in cancels playback; transcript persisted in the same conversation with `channel = voice`.
2. **Fallback: server speech** — when browser recognition is unavailable, `MediaRecorder` sends push-to-talk audio to an authenticated endpoint that uses the same OpenAI account for transcription; replies can be spoken with OpenAI TTS if browser voices are unavailable.

Both paths call the same `/api/chat` orchestrator, profile, permissions, tools, memory, RAG and audit path as text. No separate voice assistant exists.

## Non-negotiable voice rules

- Microphone starts only after an explicit user action.
- A persistent visible indicator is shown while capture is active.
- Stop is immediate; no ambient/background recording.
- The spoken greeting uses the configured assistant name from the database.
- Voice commands cannot bypass authorization or approval.
- A failure is recoverable; the typed request/transcript is preserved and text fallback is offered.

## Why not LiveKit now

Integrating LiveKit without a staged server, verified UDP/TLS and approved speech vendors would produce an unverifiable, likely broken path and violate the deployment constraints. Browser-native speech is a real, inspectable implementation that can ship now.

## Consequences and upgrade path

- Recognition quality depends on the browser's speech service; the server fallback covers unsupported browsers.
- Barge-in is control-level (start/stop), not full-duplex semantic turn detection.
- LiveKit remains the production target: the voice module exposes a provider-neutral session boundary, and the shared conversation/tool contracts are already in place. A future ADR must record LiveKit server staging, measured latency/interruption results and provider costs before switching.
