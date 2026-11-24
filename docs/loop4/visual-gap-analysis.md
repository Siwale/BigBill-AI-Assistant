# Loop 4 — Visual Gap Analysis

**Date:** 2026-11-24
**Branch:** `feat/loop4-aida-command-forge` at `f4220fb` (base `6b93e95`)
**Reference image:** `AIDA_Jarvis_HUD_Reference.png` — **not present** in workspace (`Docs/Design/AIDA_Jarvis_HUD_Reference.png` missing, searched `find` 0 results). Analysis based on written Loop 4 spec + reference description.
**Browser capture:** **Blocked** — `browse.status` reports `paired-offline`, `reconnecting:true`, `tabs:[]`, `nextStep: The paired browser is reconnecting; try again in a few seconds.` No screenshots at `1672×941`, `1440×900`, `1024×768`, `390×844` could be captured. Diagnosis via code inspection.

## 1. Current app screenshots
- **Desktop 1672×941:** Not captured — browser offline. Fallback: inspected `src/components/command/command-shell.tsx` layout (top bar 56px, left rail 220px, main stage grid, bottom dock 72px) and `src/components/command/aida-core.tsx` canvas 320px height.
- **Tablet 1024×768 / Mobile 390×844:** Not captured — same fallback, responsive CSS `hide-mobile`/`show-mobile` at 900px breakpoint inspected.

## 2. Route and state for screenshots
- Intended routes: `/app` (Command Home with `AidaCore idle` + `ChatWorkspace`), `/app/engineering` (Engineering workspace), `/app/repositories`, `/app/history`. No running app to navigate due to browser offline.

## 3. Reference vs viewport
- Reference: 1672×941 cinematic 16:9 dark command centre, central holographic feminine bust dominant (35–45% width), top bar, left rail, left/right panels, bottom ribbon + composer.
- Current: `CommandShell` reproduces top bar, left rail, main stage grid, but centre stage is 2D `canvas` (320px) not 3D, panels are light `ChatWorkspace` inside dark shell (contrast mismatch), bottom ribbon is shell dock + chat composer duplicate.

## 4. Component tree and shell ownership
- **Shell owner:** `src/app/app/layout.tsx` now renders `CommandShell` (replaces `Sidebar`/`app-shell`). `CommandShell` owns top bar, left rail, main, dock. `ChatWorkspace` still owns its own `conv-rail` + `chat-main` + `composer-wrap` inside, causing duplicate nav/composer.
- **Tokens:** `src/app/globals.css` `.command-env` near-black `#020812`, cyan `#00e5ff`, amber `#ffcc00`, but `ChatWorkspace` still uses `paper` light tokens inside dark shell — conflict.
- **Aida Core:** `src/components/command/aida-core.tsx` is 2D canvas with rings/waveform, not 3D. States: `idle/listening/thinking/searching/inspecting/verifying/speaking/waiting_approval/paused/error/disconnected` implemented but `thinking` glow, `searching` orbit, `inspecting` scan are 2D canvas, not 3D blendshapes.

## 5. Avatar asset/rendering inventory
- **Current:** No 3D model, no `.glb`/`.gltf`, no `three`/`@react-three/fiber`, no `WebGL` canvas, no `AidaAvatarStage`. Only `aida-core.tsx` 2D canvas + `AudioVisualizer` level. No rig, no blendshapes, no visemes, no texture maps, no lighting. Fallback is static canvas, not poster.
- **Reference requires:** Rigged human head/shoulders, jaw/mouth rig, eyelids, blendshapes, viseme set, skin/hair materials, holographic lighting, pedestal, particle field, isolated `AidaAvatarRenderer` with disposal and `prefers-reduced-motion`.

## 6. Voice/TTS and audio event flow
- **Current:** `src/components/chat/chat-workspace.tsx` uses `SpeechRecognition` (continuous true) → `MediaRecorder` fallback → `POST /api/voice/transcribe` (Whisper), `speechSynthesis` → `POST /api/voice/speak` (TTS), `useLiveVoice`/`useRealtimeVoice` via `RTCPeerConnection` + `setSinkId`, `AudioContext` analyser for level. `live-webrtc.ts` handles `session.input_transcript.delta` etc., but `aida-core.tsx` level is from mic analyser only (single stream) — not from provider phoneme alignment.
- **Gap:** No phoneme/viseme timeline from TTS provider, no `AudioContext` → viseme mapping, mouth not driven by actual audio visemes, just waveform bars.

## 7. Activity event flow
- **Current:** `EngineeringWorkspace` uses hardcoded `activity` array and `PIPELINE` static, `Forge` bridge exists (`aida_bridge.py` via companion `spawn` no shell, versioned JSON, bounded) but UI does not subscribe to real `GET /api/engineering/audits/[id]/events` SSE (exists but not wired), no `Last-Event-ID` reconnect, no sanitized live feed. `AidaCore` state not driven by `assistant.listening.started` etc. events.

## 8. Existing CSS/theme conflicts
- `globals.css` has `.command-env` but `ChatWorkspace` still imports `paper` styles, `.conv-rail` light background inside dark shell causes contrast loss. Two shells: `CommandShell` + `ChatWorkspace`'s `chat-layout` both define layout, causing nested scroll and duplicate composers. No shared layout tokens for command centre grid, z-index, motion.

## 9. Performance baseline
- **Current:** 2D canvas at 320px, `requestAnimationFrame` per frame, `dpr` scaled, no WebGL, no texture memory, no GPU load. `pnpm build` ✅, `pnpm typecheck/lint` ✅, `pnpm test` 37/37, no console errors (except speech `network` fallback). No FPS measured (no running browser).
- **Risk:** Adding WebGL without `dispose`, `pause when hidden`, `cap pixel ratio`, `lazy-load` will cause stutter, memory leak, duplicate render loops.

## 10. Gap table (P0–P3)

| # | Area | Reference | Current | Severity | Root cause (file) |
|---|---|---|---|---|---|
| 1 | Avatar 3D | Central holographic bust, 35–45% width, rigged | 2D canvas 320px, no 3D, no blendshapes | **P0** | `aida-core.tsx:1` no Three.js, no model |
| 2 | Layout | Top bar + left rail + centre avatar dominant + left/right panels + bottom ribbon/composer, 16:9 | Top bar + left rail OK, centre avatar too small, left/right panels are `ChatWorkspace` light cards, duplicate composer, no pipeline ribbon in Command | **P0** | `command-shell.tsx:69` + `app/page.tsx:29` |
| 3 | CSS | Single `command-env` tokens, dark glass, no `paper` inside | `globals.css` has both `paper` and `command-env`, `ChatWorkspace` overrides with light surface | **P0** | `globals.css:1` + `chat-workspace.tsx:1131` |
| 4 | Voice/lip-sync | Mouth driven by provider viseme timeline, audio clock sync | Waveform bars from mic level only, no viseme, mouth not tied to TTS phonemes | **P0** | `chat-workspace.tsx:401` `speak()` no viseme |
| 5 | Activity | Real `assistant.*` events, SSE, pipeline `REQUEST→REPORT` | Hardcoded `activity` array, static `PIPELINE`, no SSE subscription | **P1** | `engineering-workspace.tsx:21` |
| 6 | Identity | Per-user displayName/pronouns/gender/voice persisted, no hardcoded Aida | `layout.tsx:14` uses `effective.displayName ?? "Aida"` but many labels still hardcode "Aida" | **P1** | `command-shell.tsx:33` `A` logo, `history/page.tsx` |
| 7 | Responsive | 1672×941 reference, tablet/mobile intentionally designed | `hide-mobile` at 900px only, no tablet drawer, avatar not dominant on mobile, no `visual-regression/` screenshots | **P1** | `command-shell.tsx:220` |
| 8 | Performance | Isolated `AidaAvatarStage`, dispose, pause when hidden, fallback tiers | No WebGL, so no fallback needed, but no `pause when hidden`, no `cap pixel ratio` | **P2** | `aida-core.tsx:14` |

## 11. Root cause
Spec treated as theme switch, not shell replacement + 3D pipeline. 2D `AidaCore` was built as `AudioVisualizer` extension, not as `AidaAvatarStage` with rig. Voice pipeline has no viseme alignment (provider returns audio only). Activity not wired to `GET /api/engineering/audits/[id]/events` SSE. CSS has two design systems (`paper` + `command-env`) with no single owner.

## 12. Minimal safe remediation
1. Keep `CommandShell` as single owner, remove `ChatWorkspace` light `paper` override inside (make chat use `command-env` surfaces or isolate via `className`).
2. Add licensed rigged `Aida` model (`.glb`) + `three` + `@react-three/fiber` behind `AidaAvatarStage` with `suspend`/`dispose`, `prefers-reduced-motion` poster, `cap pixel ratio 2`, `pause when hidden`, no heavy post-processing. Document licence.
3. Extend TTS provider to return `phonemes: [{viseme, start, end}]` or use `Web Audio` `AnalyserNode` → viseme approximation (label as approximate), drive `AidaAvatarRenderer` on audio clock, stop on `ended/cancel/error`.
4. Wire `EngineeringWorkspace` to real `GET /api/engineering/audits/[id]/events` SSE with `Last-Event-ID`, drive `AidaCore` states `searching/inspecting/verifying`, remove hardcoded `activity`.
5. Make `Command Home` 1672×941 reference viewport for visual regression, tune avatar 35–45% width, remove duplicate composer, ensure no `New conversation`.
6. Persist `user_assistant_configs` already done, but ensure `voiceId` actually used by `speak()` (check `voiceId` passed to `POST /api/voice/speak`).

**Blocker:** No browser to capture screenshots, no 3D model asset yet, no viseme-capable TTS alignment — report as not verified, do not claim pixel-perfect.

