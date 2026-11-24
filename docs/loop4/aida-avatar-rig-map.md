# Aida Avatar Rig Map — Pending Real GLB

**Status:** BLOCKED — no GLB loaded, procedural bust active.

**Procedural bust rig (current, interim):**
- Head: `SphereGeometry` scaled, no blendshapes
- Jaw: `Group` `jaw.position.y = 0.18 - jawOpen*0.09` (viseme-driven)
- Mouth: `SphereGeometry` scale.y viseme, lowerLip follows jaw
- Eyes: `Group` per side, `lidMesh.visible` blink, `eyeGroups.rotation` gaze, `brows` y offset for focus
- No skeleton, no morphTargets, no ARKit 52

**Required for real GLB:**
- Inspect `aida.glb` with `GLTFLoader` + `console.log(gltf.scene)` to enumerate `mesh.morphTargetDictionary` and `skeleton.bones`
- Map canonical visemes: `sil`, `PP`, `FF`, `TH`, `DD`, `kk`, `CH`, `SS`, `aa`, `E`, `I`, `O`, `U` → model blendshape names (e.g. `jawOpen`, `mouthClose`, `mouthFunnel`, `mouthPucker`, etc.)
- Map expression morphs: `eyeBlinkLeft/Right`, `browInnerUp`, `mouthSmileLeft/Right`, etc. — document actual names, do not hardcode unverified names

**Next:** When `aida.glb` is provided, run `?avatarDebug=1` to list morph targets and populate this map, then drive `mesh.morphTargetInfluences` instead of procedural jaw scale.
