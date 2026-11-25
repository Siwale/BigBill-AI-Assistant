# Aida Avatar Rig Map

**Asset:** `public/assets/aida/aida.glb` (Ara 3D Gen `cornrows`, high detail)

The GLB's glTF JSON declares one skinned character mesh with 26 primitives, one skin with 165 joints, and 34 morph targets. Each primitive receives its own Three.js mesh after loading, so the runtime adapter collects and updates every mesh with morph influences.

## Expression targets in the asset

`eyeBlinkLeft`, `eyeBlinkRight`, `eyeWideLeft`, `eyeWideRight`, `eyeSquintLeft`, `eyeSquintRight`, `browDownLeft`, `browDownRight`, `browInnerUp`, `browOuterUpLeft`, `browOuterUpRight`, `jawOpen`, `mouthSmile`, `mouthFrown`, `mouthPucker`, `mouthPress`, `mouthStretch`, `noseSneerLeft`, `noseSneerRight`, `mouthUpperUp`.

## Speech targets in the asset

| GLB target | Current canonical `Viseme` group |
| --- | --- |
| `viseme_PP` | `bilabial` |
| `viseme_FF` | `labiodental` |
| `viseme_TH` | `dental` |
| `viseme_DD` | `alveolar` |
| `viseme_kk` | `alveolar` (current app schema has no separate velar group) |
| `viseme_CH` | `alveolar` (current app schema has no separate affricate group) |
| `viseme_SS` | `alveolar` (current app schema has no separate sibilant group) |
| `viseme_nn` | `neutral` |
| `viseme_RR` | `alveolar` |
| `viseme_aa` | `open` |
| `viseme_E` | `wide` |
| `viseme_I` | `wide` |
| `viseme_O` | `rounded` |
| `viseme_U` | `rounded` |

The current application timeline groups phonemes into nine broad viseme categories, so it cannot select every one of the 14 Ara targets independently. The adapter maps those available categories onto actual Ara morph names and adds `jawOpen` where appropriate. This is approximate timing and phoneme grouping, not a claim of phoneme-accurate lip sync.

## Runtime notes

- The loader requires a skinned mesh, nonempty geometry bounds, and all 14 speech target names before marking the GLB loaded.
- The approved portrait stays visible until those checks and scene attachment succeed.
- Blink and subtle brow state are sent to the GLB's expression morphs.
- Browser deform verification for every expression and speech target remains pending.
