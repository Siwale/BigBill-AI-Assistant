# Aida Avatar Validation — Blocked

**Tests not run (no GLB):**
- [ ] GLB loads in `AidaAvatarStage` without console error
- [ ] `skeleton`/`skinWeights` work, `morphTargetDictionary` enumerated
- [ ] `eyeBlinkLeft/Right` closes lids over eyeball
- [ ] `jawOpen` does not detach lower face
- [ ] `mouthSmile` does not produce grotesque deformation
- [ ] All required expression states transition without stuck weights
- [ ] Viseme timeline drives lips, mouth stops on audio end/cancel
- [ ] `prefers-reduced-motion` static, `WebGL` fallback poster works
- [ ] GPU dispose on unmount, no duplicate canvas
- [ ] Performance at 1672×941 < 16ms frame, no memory leak

**Current validation (procedural):**
- `pnpm typecheck` ✅ (after `aida-avatar-replacement-audit.md`)
- `pnpm lint` ✅
- `pnpm build` ✅
- `WebGL` fallback text shown when `webglcontextlost`

**Blocker:** No `aida.glb` — cannot run rig/viseme validation. Procedural bust passes interim checks but is **not** the acceptance deliverable.
