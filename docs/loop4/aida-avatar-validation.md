# Aida Avatar Validation

**Status:** GLB asset verified; browser visual acceptance remains pending.

## Asset checks

- `public/assets/aida/aida.glb` exists (13,535,192 bytes) and has a valid glTF 2 binary header.
- SHA-256: `8f7959d02e4113bef58be8919c1e30b600d9afc24f74246a0dfe7a752e08b858`.
- The GLB contains one scene, a skinned character mesh with 26 primitives, one skin with 165 joints, and 34 facial morph targets.
- The morph list includes all 14 documented `viseme_*` speech targets.
- Asset metadata reports 186,356 triangles, embedded PBR textures, and the `cornrows` hair variant.

These are file-level checks. They do not prove that a browser fetched, parsed, attached, and rendered the character.

## Runtime changes

- `AidaAvatarStage` now loads the bundled GLB and frames it from measured geometry bounds.
- The procedural mannequin group remains hidden. The supplied portrait is shown while loading and whenever WebGL or GLB loading fails.
- The loader checks for visible geometry, skinning, usable bounds, and the complete 14-target speech set before switching to the GLB.
- Runtime statistics are derived from the parsed GLB rather than hard-coded.
- The viseme adapter applies the canonical speech group to the matching GLB morph across all morphed primitives.

## Browser acceptance still needed

- [ ] On the authenticated `/app` route, confirm the Network panel returns the full GLB with HTTP 200.
- [ ] Confirm the debug state reaches `loaded` and reports runtime mesh, morph, triangle, and joint counts.
- [ ] Capture the rendered model at the reference viewport and compare it with the approved Aida portrait and HUD.
- [ ] Confirm blink and speech morphs deform the face correctly and the stage has no browser console errors.
- [ ] Confirm context loss leaves the portrait fallback visible.

The local app route could not be visually inspected in this session because it returned 404 without an authenticated session. No runtime visual claim is made here.
