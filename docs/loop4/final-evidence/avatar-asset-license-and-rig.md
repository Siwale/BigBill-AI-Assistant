# Aida avatar asset — licence and rig investigation

- Date: 2026-11-25. Method: web research with evidence URLs; nothing downloaded; nothing bundled.
- Requirement: realistic adult feminine-presenting rigged digital human (GLB/GLTF), facial
  blendshapes/morphs (blink, jaw/visemes, gaze), PBR skin/hair/eye materials, head + hair + neck +
  shoulders, clearly commercial-safe licence for multi-tenant browser delivery. No real-person likeness,
  no copyrighted characters.

## Candidates — all FAIL (do not use)

1. **three.js `Michelle.glb`** — FAIL licence + rig. Added Mar 2023 in
   https://github.com/mrdoob/three.js/pull/25654 (replaced a Mixamo FBX in WebGPU skinning examples;
   name matches Mixamo's "Michelle" female character). No licence file for `examples/models/gltf/`, no
   credit line. Upstream Mixamo terms are royalty-free but prohibit redistributing raw character files
   (https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html); serving the GLB to browsers is
   redistribution. Mixamo skeletons have body animation only — no facial blendshapes — and are stylised
   full-body figures, not a realistic bust.
2. **three.js `Xbot.glb`** — FAIL identity + licence. Mixamo's stylised *male robot* (credit line in
   `webgl_animation_skinning_additive_blending` example). Same redistribution restriction, body-skeleton only.
3. **Quaternius Ultimate Animated Character Pack** — FAIL content (licence PASS: CC0/QAL,
   https://quaternius.com/faq.html, https://quaternius.com/license.html). Low-poly stylised blocky
   characters, body rigs only, no facial blendshapes, flat atlas textures, ships as .blend/FBX.
4. **Ready Player Me** — FAIL (platform shut down 31 Jan 2026 after Netflix acquisition; was stylised,
   ToS-governed, and required RPM's network service). Do not build on it.
5. **Microsoft Rocketbox** — FAIL licence ambiguity (repo root LICENSE.md reads MIT, but Microsoft
   Research frames release as "free research and academic use" and the repo is archived) + unsuitable
   content (115 low-poly stylised game characters, generally no ARKit-grade facial rigs, FBX/Unity).
6. **Khronos glTF-Sample-Models** — FAIL content. Only humanoid is Cesium_Man (CC-BY 4.0, low-poly uniformed
   man, skeletal anim only).
7. **BlendSwap CC0 free female characters** — FAIL verification (unfinished face rigs, old Blender versions,
   no asset verifiably passes all four criteria).
8. **Renderpeople free samples** — FAIL licence for this use. GTC §4 prohibits real-time rendering
   (AR/VR/XR/games) without express written consent (https://renderpeople.com/general-terms-and-conditions),
   which a real-time browser app requires.
9. **three.js near-misses** (`facecap.glb`, `LeePerrySmith`, `readyplayer.me.glb`) — male, stylised, or
   service-dependent, with no clear commercial grant.

## What is actually serving today (interim, labelled)
- Procedural Three.js bust in `src/components/command/aida-avatar-stage.tsx`: face anatomy, blink lids,
  gaze saccades, brow focus, jaw + viseme adapter (`TimedViseme` → jaw/mouth), cyan rim, rings, pedestal,
  particles. Label: "procedural bust — rigged GLB pending". No network fetch, no paid service.
- The adapter is GLB-ready: a licensed asset plugs into the existing viseme/rig weights without
  changing callers.

## Recommended next action (single, needs approval)
**Buy, don't borrow: purchase one rigged photorealistic female scan from Renderpeople Rigged People
(https://renderpeople.com) and, before building, obtain written real-time/web-use consent from
info@renderpeople.com as their GTC §4.2 requires for interactive SaaS use.** Approval needed: (a) budget
sign-off for a paid asset/licence; (b) legal review confirming the consent covers multi-tenant browser
delivery of a shared assistant avatar. Fallback if terms stall: Reallusion ActorCore/Character Creator
content, whose EULA (https://www.reallusion.com/Content/EULA/EULA.htm) expressly permits royalty-free
commercial interactive software. Either way the GLB is self-hosted — no vendor network dependency.

## Status
- Phase 3 gate: **BLOCKED** — no suitable licensed asset acquirable in-loop without procurement approval.
  The product UI labels the interim honestly and must not be described as a finished digital human.
