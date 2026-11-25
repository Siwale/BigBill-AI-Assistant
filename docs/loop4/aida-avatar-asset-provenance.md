# Aida Avatar Asset Provenance

**Date:** 2026-11-25
**Branch:** `feat/loop4-aida-exact-digital-human` at `65fa09e` → `aida.glb` integrated
**Reference:** `AIDA_Digital_Human_Character_Reference.png` (2026-11-25) + `Loop4_Aida_Ara3D_Digital_Human_Pack` (0.16.0)

## Asset status — DELIVERED (Ara 3D Gen, CC0)

**GLB bundled:** `public/assets/aida/aida.glb` (13.5 MB, 186,356 tris, `cornrows` variant, `high` detail) — generated 2026-11-25 via `npx --yes ara3d@0.16.0 export --params aida-cornrows.params.json --formats glb,zip --detail high --no-animations`

**Source:** Ara 3D Gen `0.16.0` (MakeHuman CC0 character data, MIT generator), preset `The Female Executive`, `young_african_female` skin `darkbrown` eyes, `cornrows` hair `171116`, `faceShapes:true` `speechShapes:true`, `rig:full` 163 bones, `detail:high`, seed `20261125`

**Licence:** `public/assets/aida/LICENSE.txt` — MakeHuman CC0 1.0 (public domain) by Data Collection AB, Joel Palmius, Jonas Hauquier — free for commercial SaaS, no attribution required, modification/redistribution permitted. CMU mocap data in `Aida_rigged_all.zip` retained for reference only.

**Files:**
- `aida.glb` (13,535,192 bytes, sha256 `8f7959d02e4113bef58be8919c1e30b600d9afc24f74246a0dfe7a752e08b858`)
- `aida-poster.png` (2.2 MB, reference portrait fallback)
- `aida.params.json` (Ara params, seed, hair, skin, rig)
- `asset-manifest.json` (version, hash, rig, blendShapes 34, textures embedded)
- `LICENSE.txt` (CC0)

**Stage integration:** `src/components/command/aida-avatar-stage.tsx` now `GLTFLoader` loads `/assets/aida/aida.glb`, `avatar.visible=false` when `glbLoaded`, `glbMouthMesh.morphTargetDictionary["jawOpen"]` driven by `visemeToMouthState` on audio clock, fallback to procedural `jaw` if load fails. Lighting/rings/pedestal/state/viseme/fallback lifecycle preserved.

**Next:** Verify 34 blendshapes (20 expression + 14 speech) via `?avatarDebug=1`, tune scale `0.95` and camera `z 4.1` against 1672×941 reference, record screenshots in `docs/loop4/visual-regression/`.
