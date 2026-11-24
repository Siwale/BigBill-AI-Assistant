# Aida Avatar Replacement — Forensic Audit (Loop 4 Digital-Human)

**Date:** 2026-11-25
**Branch:** `feat/loop4-aida-exact-digital-human` at `6230ac6` (main) + `8150342` local
**Reference image:** `/home/bill/Downloads/Aida Digital Human Integration Pack.png` + `Aida Digital Human Technical Blueprint.png` (supplied 2026-11-25 01:38) — not yet at `Docs/Design/AIDA_Jarvis_HUD_Reference.png`

## 1. Current avatar stage component
- **File:** `src/components/command/aida-avatar-stage.tsx` (349 lines, Three.js 0.187)
- **Renderer:** `THREE.WebGLRenderer` antialias, `SRGB`, `cap pixelRatio 2`, `PerspectiveCamera 38°`, `Ambient + Key + Rim + Point` lights, `Orbit` not used, `requestAnimationFrame` loop, `visibilitychange` pause, `resize` handler, `dispose` on unmount, `webglcontextlost` fallback to static poster.
- **Geometry:** Procedural bust — `SphereGeometry(0.62)` head scaled `0.88,1.08,0.94`, `SphereGeometry(0.34)` chin, `SphereGeometry(0.09)` lips, `SphereGeometry(0.085)` eyes, `CylinderGeometry` neck/shoulders, `TorusGeometry` rings (3), `CylinderGeometry` pedestal, `Points` particles (120). No external GLB, no `GLTFLoader`, no `skeleton`, no `morphTargets`.
- **Materials:** `MeshStandardMaterial` skin `0xc9a186`, hair `0x14100d`, eye `0xf2f5f7`/`0x3a2a1c`, lip `0x8f4f4a`, shoulder `0x0a1a2e`, ring `MeshBasicMaterial` cyan `0x31baf2` opacity 0.4, pedestal emissive 0.5.

## 2. Procedural face/bust geometry
- Head: sphere scaled, no edge loops around eyelids/lips, no jaw/cheek deformation loops, no UVs beyond sphere.
- Eyes: separate spheres for white/iris/pupil, lids are scaled spheres toggled visible, not eyelid geometry following eye.
- Brows: scaled spheres, not hair cards.
- Nose: cone, ears: scaled spheres.
- Hair: two spheres (back volume + bun), not braided updo, no braid structure, no hairline detail, no cards/strands, silhouette incorrect vs reference (reference has neat braided bun, dark, defined).
- Neck/shoulders present (`CylinderGeometry`) — not floating head, but generic cylinder, not clavicle.

## 3. Three.js renderer
- **Library:** `three@0.187.0` + `@types/three` (added Loop 4), no `@react-three/fiber`/`drei` (kept isolated `aida-avatar-stage.tsx`).
- **Mount:** `div` 460px height, `canvas` appended, `setPixelRatio(min(devicePixelRatio,2))`, `setSize` on resize, `outputColorSpace = SRGB`.
- **No GLTFLoader** — no `GLB` loading, no `skeleton`, no `animation clips`.

## 4. Scene lighting/materials
- Key: `DirectionalLight 0xfff1e0 1.1` at (1.2,1.6,2.4), Rim: `0x31baf2 1.4` at (-1.8,0.6,-1.2), Under: `PointLight 0x48c9f4 0.7`, Ambient `0x33415e 0.7`. Warm key + cyan rim, acceptable but not PBR subsurface for skin, no normal/roughness/AO maps, face is flat single material.

## 5. Particle/ring/pedestal
- Rings: 3 `TorusGeometry` at y -0.35, emissive pedestal, 120 points random sphere — restrained, not fake activity, but not tied to Forge events.

## 6. Avatar presence/state controller
- **File:** `src/components/command/aida-core.tsx` defines `AidaCoreState` 10 states, `AidaAvatarStage` maps `stateRef` to head `position.y` breathing, `rotation.y` listening, `rings.rotation.z` searching, `jaw.position.y`/`mouth.scale` speaking. States: idle, listening, thinking, searching, inspecting, verifying, speaking, waiting_approval, paused, error, disconnected — wired in `CommandHome` via `onViseme/onLevel/onAvatarState` from `ChatWorkspace` `speak()` + `AudioContext` level. No shell interpolation, no model-supplied executable.

## 7. Viseme types and mapping
- **File:** `src/modules/voice/viseme.ts` — `Viseme` 9 groups, `phonemeToViseme`, `approximateVisemesFromText` (word-length duration, *approximate*), `visemeToMouthState` (jawOpen/mouthWidth). `POST /api/voice/visemes` returns `approximate:true`. `ChatWorkspace` fetches visemes before `audio.play()`, `AidaAvatarStage` interpolates `visemesRef` on audio clock `elapsed = Date.now() - audioStart`. No provider phoneme alignment (Level C fallback), correctly labelled approximate.

## 8. TTS audio playback clock
- `ChatWorkspace.speak()` → `POST /api/voice/speak` (`audio/mpeg`) + `POST /api/voice/visemes` parallel, `Audio` element `crossOrigin anonymous`, `setSinkId` where supported, `startPlaybackLevel` `MediaElementSource → AnalyserNode` for waveform, `onended`/`onerror` clears `onViseme(null)` + `idle`, interruption `speak()` cancels previous `speechSynthesis` and `audio.pause()`.

## 9. Voice provider adapter
- `src/modules/assistant/model.ts` gateway, `src/app/api/voice/speak` uses `synthesizeSpeech` with `profile.voiceConfig.voiceId`, `LIVE_VOICE_ENABLED` flag, no long-lived key in browser.

## 10. Existing profile/persona/voice persistence
- `assistant_profiles` (tenant) + `user_assistant_configs` (per-user name/pronouns/gender/presentation/voice) + `getEffectiveAssistant`, `POST /api/profile/identity` per-user, Settings → Assistant identity & voice with preview via real `POST /api/voice/speak`.

## 11. WebGL fallback and reduced-motion
- `prefers-reduced-motion` → static (no breathing/rotation), `webglcontextlost` → `setWebglFailed(true)` → poster fallback text "3D Aida is unavailable (WebGL context lost)." + static poster, `dispose` on unmount, `pause when hidden`.

## 12. Baseline behaviour (no screenshots, browser offline)
- Idle: subtle breathing, blink every 3-5s, gaze saccades, no bob.
- Listening: attentive gaze, head yaw 0.04, mouth at rest.
- Speaking: jaw `0.18 - jawOpen*0.09`, mouth `scale.y` viseme-driven, head scale not used.
- Thinking: brow focus (y 0.82-0.02), ring rotation.
- Error: muted core, disconnected status.
- No fake 17 findings, no simulated percentage, no shell interpolation, no Qylon copy.

## 13. Root cause for replacement
Procedural bust is **P0** blocker for Loop 4 Digital-Human: it lacks *all* Phase 3-5 requirements — no licensed human GLB, no facial topology, no UV/PBR textures, no skeleton, no blendshapes, no viseme morphs, no hair braid, no eye wetness. The viseme adapter is ready (9 groups, timed), but drives `jaw.position` on a sphere, not a rigged face. A real GLB must replace `head`/`jaw`/`lips`/`eyes`/`hair` meshes while preserving the existing `AidaAvatarStage` container, lighting, rings, pedestal, state controller, viseme pipeline, fallback and lifecycle.
