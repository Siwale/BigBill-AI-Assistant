# Aida Avatar Asset Provenance

**Date:** 2026-11-25
**Branch:** `feat/loop4-aida-exact-digital-human` at `6230ac6`
**Reference:** `AIDA_Digital_Human_Character_Reference.png` (supplied 2026-11-25)

## Asset status — BLOCKED

**No licensed rigged GLB is bundled.**

- Searched repository: `find . -name "*.glb" -o -name "*.gltf"` → 0 results
- Searched `public/assets/aida/` → does not exist
- Searched Downloads: `Aida_DigitalHuman_Loop4.zip` **not found** (`ls -lh /home/bill/Downloads` 2026-11-25 01:38 shows no ZIP for Aida)
- Checked `Forge` and `Qylon` — no Aida character asset
- Blender: `which blender` → not found — cannot locally model Path B without tool

**Current stage:** `src/components/command/aida-avatar-stage.tsx` is procedural bust (Sphere/Cylinder/Points) with viseme adapter `jawOpen/mouthWidth` — **not a digital human**. It is documented as interim with banner `procedural bust — rigged GLB pending` and exposes the same `visemesRef`/`audioStartRef`/`stateRef` a GLB would drive.

## Required asset (per integration pack — not yet acquired)

**Pack contents (expected, from supplied UI reference):**
- `aida-avatar/model/aida.glb` — fully rigged, PBR materials, 52 ARKit blendshapes, viseme morphs, skeleton, hair braided updo
- `aida-avatar/textures/` — `albedo.jpg` (4K), `normal.jpg`, `roughness.jpg`, `specular.jpg` (2K)
- `aida-avatar/animations/` — `idle.glb`, `listen.glb`, etc. (optional)
- `aida-avatar/visemes/viseme_map.json` — provider phoneme → blendshape mapping
- `aida-avatar/integration/Aida_Integration_Loop4.md` — steps

**Licence requirements for SaaS:**
- Commercial use in BigBill AI Assistant SaaS
- Modification/optimisation permission
- Redistribution/embedding as browser-delivered GLB
- No real-person likeness without consent

## Next action

1. **User to provide** `Aida_DigitalHuman_Loop4.zip` via Downloads or `Docs/Design/` (do not commit large binaries without LFS review)
2. Coordinator to verify licence (`LICENSE.txt`), file size/hash, morph target list (`aida-avatar-rig-map.md`), then replace procedural meshes in `aida-avatar-stage.tsx` while preserving lighting/rings/pedestal/state/viseme/fallback lifecycle
3. If no owned/licensed asset and no Blender/tool, **stop and report blocker** — do not fabricate GLB, do not use PNG on plane, do not claim mannequin complete

**No GLB committed, no texture committed, no licence violated.**
