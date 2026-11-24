# Loop 4 — Reference Gap Analysis (Phase 0 forensic baseline)

- Date: 2026-11-24
- Branch: `feat/loop4-aida-command-forge`
- Baseline commit: `8a5dec6`
- Reference: 1672×941 Engineering command-centre artwork (AIDA Jarvis HUD)
- Current evidence: app `/app` (Command view) in ~1000×764 split browser pane

## Root causes (confirmed in source)

| # | Symptom | Root cause | Evidence |
|---|---|---|---|
| 1 | Grey/brown sphere instead of human Aida | Explicit `SphereGeometry(0.85)` placeholder, not a failed download. Comment says so. No GLB/GLTF loader, no asset URL, no `public/` dir. | `src/components/command/aida-avatar-stage.tsx:47-52` |
| 2 | `AIDA 3D • … synthetic licensed` label | Static overlay; no licensed asset is loaded. Label asserts what the renderer does not do. | `aida-avatar-stage.tsx:164` |
| 3 | `Fallback: static poster if WebGL unavailable` always visible | Unconditional overlay div, not gated on fallback state. No WebGL-loss detection. | `aida-avatar-stage.tsx:165` |
| 4 | Cream/white conversation panel (~25% near-white) | `ChatWorkspace` uses light `classic` theme tokens (`--surface:#fffdf8`, `--paper:#f5f2ea`); dark `--cmd-*` tokens never applied to chat classes. | `src/app/globals.css:1-29,755-766,837-901,1105-1118`; `app/app/layout.tsx:10` defaults `classic` |
| 5 | `Classic / Mission Control / Audio Simulator / Realtime / Voice replies off` dominate main view | `ThemeSwitcher` rendered in chat header; Live/Realtime buttons in chat header; voice toggle hard-default `false`. Dev/preview controls mixed into production UI. | `chat-workspace.tsx:1186,1187-1249`; `useState(false):192` |
| 6 | `Start live conversation` contradicts continuity model | Explicit button in chat header. No `New conversation`/`Clear chat` buttons exist — but the *title string* `New conversation` repeats as placeholder titles. | `chat-workspace.tsx:1208-1210`; `db/schema.ts:109`; `modules/conversations/service.ts:32,126-127`; `chat-workspace.tsx:710,807` |
| 7 | `8 conversations • N messages in view` | Count line in `CommandHome` exposes internal record count as UX. | `command-home.tsx:35` |
| 8 | `I could not reach the model provider` | Generic `ModelError kind=provider` catch-all (DNS/fetch/5xx collapse) in `runAssistantTurn`; persisted as degraded assistant message. `configured:true` (key present) is not inference success. | `modules/assistant/orchestrator.ts:279-325`; `modules/assistant/model.ts:54-72`; `lib/env.ts:45-97` |
| 9 | `Voice replies off` default | Hard `useState(false)`, not persisted; TTS is OpenAI-only (`hasOpenAiSpeech`), DeepSeek/OpenRouter keys don't enable speech. | `chat-workspace.tsx:192,763`; `model.ts:134-181`; `lib/env.ts:99-101` |
| 10 | Duplicated navigation + dead routes | `TOP_NAV` and `RAIL` both list Command/History/Engineering/Repositories/Devices/Media/Vision; label mismatch `Engineer` vs `Engineering`; `/app/forge`, `/app/projects`, `/app/media` have no pages (404). | `command-shell.tsx:34-57,97-172` |
| 11 | Engineering view: hardcoded `17 findings`, `42%` progress, sample request text | Findings badge hardcoded `17`; progress bar hardcoded `42%`; request card is static sample text not backed by audit record. | `engineering-workspace.tsx:145-158,181` |
| 12 | Double composer | `CommandShell` footer dock + inner `ChatWorkspace` composer both render. | `command-shell.tsx:192-225`; `chat-workspace.tsx:1435+` |
| 13 | Placeholder brand mark | Rounded cyan tile with letter `A`, not the triangular AIDA mark. | `command-shell.tsx:91` |

## Viewport note

Comparison is Command-view @ ~1000×764 vs Engineering reference @ 1672×941. Visual regression must be re-captured on the Engineering route at 1672×941, zoom 100%.

## Asset / integration blockers

- No licensed rigged human GLB is bundled or fetched (no network, no paid services per AGENTS.md). Interim: procedural Three.js digital-human bust with documented rig adapter (blink/gaze/jaw/visemes). Blocker recorded: approved rigged GLB still required for full photoreal acceptance.
- GLB procurement decision (2026-11-24, investigated, not executed): `GLTFLoader` is available in the installed `three` package and the avatar stage exposes a viseme/rig adapter a GLB can drive. No suitable asset was imported because (a) no photorealistic female-presenting rigged human exists under a clearly commercial-safe free licence from an accessible source — CC0 stylised packs (e.g. Quaternius) would not meet the photoreal design bar, and Mixamo-derived binaries carry unclear redistribution terms; (b) quality licensed assets require procurement/budget approval, and AGENTS.md forbids new paid services without explicit approval. Recommended next step: user approves a licensed source (e.g. commercial character licence), then the adapter accepts `jawOpen/mouthWidth/gaze/blink` weights directly.
- TTS alignment: `/api/voice/visemes` returns `approximate:true` heuristic (word-length timing), not provider phoneme alignment. Labelled as approximate; not phoneme-accurate.
- Forge/companion: honest disconnected states required until real handshake succeeds.
