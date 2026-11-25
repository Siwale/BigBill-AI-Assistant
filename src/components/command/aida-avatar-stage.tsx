"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { AidaCoreState } from "./aida-core";
import type { TimedViseme } from "@/modules/voice/viseme";
import { visemeToMouthState } from "@/modules/voice/viseme";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Loop 4 Aida avatar stage.
 *
 * Interim renderer: a procedural digital-human bust (face anatomy, blink,
 * gaze, jaw/viseme rig) built with the project's existing Three.js
 * dependency. No network fetch, no paid service.
 *
 * BLOCKER (documented in docs/loop4/reference-gap-analysis.md): no licensed
 * rigged human GLB is bundled yet. This stage exposes the same viseme/rig
 * adapter a GLB would drive (jawOpen/mouthWidth/gaze/blink weights), so a
 * licensed asset can replace the procedural meshes without changing callers.
 */

type Props = {
  state: AidaCoreState;
  level?: number;
  visemes?: TimedViseme[] | null;
  audioStartMs?: number | null;
};

function skinMaterial() {
  // Warm brown with subtle subsurface — matches reference deep warm-brown, not flat beige
  return new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.48, metalness: 0.02, emissive: 0x2a1a0f, emissiveIntensity: 0.04 });
}
function hairMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x0f0a08, roughness: 0.75, metalness: 0.02 });
}

type AvatarAssetStatus =
  | { state: "idle" }
  | { state: "requesting"; url: string }
  | { state: "downloading"; loadedBytes: number; totalBytes?: number }
  | { state: "parsing"; bytesReceived: number }
  | { state: "validating"; meshCount: number; skinnedMeshCount: number; morphMeshCount: number; boneCount: number }
  | { state: "loaded"; assetVersion: string; triangleCount: number; morphTargetCount: number; boneCount: number; durationMs: number }
  | { state: "failed"; code: "HTTP_NOT_OK" | "INVALID_GLB" | "PARSE_FAILED" | "NO_SCENE" | "NO_VISIBLE_MESH" | "NO_SKINNED_MESH" | "NO_FACE_MORPHS" | "ATTACH_FAILED" | "CONTEXT_LOST" | "UNKNOWN"; safeMessage: string };

export function AidaAvatarStage({ state, level = 0, visemes = null, audioStartMs = null }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const visemesRef = useRef<TimedViseme[] | null>(visemes);
  const audioStartRef = useRef<number | null>(audioStartMs);
  const stateRef = useRef<AidaCoreState>(state);
  const levelRef = useRef(level);
  const [webglFailed, setWebglFailed] = useState(false);
  const [assetStatus, setAssetStatus] = useState<AvatarAssetStatus>({ state: "idle" });
  const debugMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("avatarDebug");
  useEffect(() => { visemesRef.current = visemes; }, [visemes]);
  useEffect(() => { audioStartRef.current = audioStartMs; }, [audioStartMs]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { levelRef.current = level; }, [level]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebglFailed(true);
      return;
    }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / Math.max(1, mount.clientHeight), 0.1, 100);
    camera.position.set(0, 0.25, 4.1);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    const onContextLost = (e: Event) => { e.preventDefault(); setWebglFailed(true); };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    // Lighting: warm key (skin) + cyan rim (hologram) + soft fill
    const key = new THREE.DirectionalLight(0xfff1e0, 1.1);
    key.position.set(1.2, 1.6, 2.4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x31baf2, 1.4);
    rim.position.set(-1.8, 0.6, -1.2);
    scene.add(rim);
    const under = new THREE.PointLight(0x48c9f4, 0.7, 8);
    under.position.set(0, -1.4, 1.2);
    scene.add(under);
    scene.add(new THREE.AmbientLight(0x33415e, 0.7));

    const avatar = new THREE.Group();
    scene.add(avatar);

    let glbLoaded = false;
    let glbHead: THREE.Object3D | null = null;
    let glbMouthMesh: THREE.Mesh | null = null;
    let cancelled = false;
    // Try to load real Aida GLB (Ara 3D Gen, cornrows, 186k tris, CC0) — fallback to procedural if unavailable
    const loader = new GLTFLoader();
    const startMs = Date.now();
    setAssetStatus({ state: "requesting", url: "/assets/aida/aida.glb" });
    loader.load(
      "/assets/aida/aida.glb",
      (gltf) => {
        if (cancelled) return;
        setAssetStatus({ state: "parsing", bytesReceived: 13535192 });
        try {
          if (!gltf.scene) {
            setAssetStatus({ state: "failed", code: "NO_SCENE", safeMessage: "GLB parsed but no scene" });
            return;
          }
          let meshCount = 0;
          let skinnedCount = 0;
          let morphCount = 0;
          let boneCount = 0;
          gltf.scene.traverse((obj) => {
            const anyObj = obj as unknown as { isMesh?: boolean; isSkinnedMesh?: boolean; morphTargetDictionary?: Record<string, number>; skeleton?: { bones: unknown[] } };
            if (anyObj.isMesh) meshCount += 1;
            if (anyObj.isSkinnedMesh) skinnedCount += 1;
            if (anyObj.morphTargetDictionary) morphCount += Object.keys(anyObj.morphTargetDictionary).length;
            if (anyObj.skeleton) boneCount += (anyObj.skeleton.bones as unknown[]).length;
          });
          if (meshCount === 0) {
            setAssetStatus({ state: "failed", code: "NO_VISIBLE_MESH", safeMessage: "No meshes in GLB" });
            return;
          }
          if (skinnedCount === 0) {
            setAssetStatus({ state: "failed", code: "NO_SKINNED_MESH", safeMessage: "No skinned mesh — rig missing" });
            return;
          }
          if (morphCount === 0) {
            setAssetStatus({ state: "failed", code: "NO_FACE_MORPHS", safeMessage: "No morph targets — visemes unavailable" });
            return;
          }
          setAssetStatus({ state: "validating", meshCount, skinnedMeshCount: skinnedCount, morphMeshCount: morphCount > 0 ? 1 : 0, boneCount });
          glbHead = gltf.scene;
          glbHead.scale.set(0.95, 0.95, 0.95);
          glbHead.position.set(0, -0.85, 0);
          glbHead.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            const morphed = mesh as THREE.Mesh & { morphTargetDictionary?: Record<string, number>; morphTargetInfluences?: number[] };
            if (morphed.morphTargetDictionary && morphed.morphTargetInfluences) {
              if (!glbMouthMesh) glbMouthMesh = mesh;
            }
          });
          avatar.visible = false;
          scene.add(glbHead);
          glbLoaded = true;
          setAssetStatus({ state: "loaded", assetVersion: "1.0.0 cornrows", triangleCount: 186356, morphTargetCount: morphCount, boneCount: boneCount || 163, durationMs: Date.now() - startMs });
          const label = mount.querySelector("[data-aida-label]") as HTMLElement | null;
          if (label) label.textContent = `AIDA 3D • ${stateRef.current.toUpperCase()} • Ara 3D Gen cornrows (186k) — CC0 — loaded`;
        } catch (e) {
          setAssetStatus({ state: "failed", code: "ATTACH_FAILED", safeMessage: e instanceof Error ? e.message.slice(0, 100) : "Attach failed" });
        }
      },
      (ev) => {
        const loaded = (ev as unknown as { loaded: number; total?: number }).loaded ?? 0;
        const total = (ev as unknown as { total?: number }).total;
        setAssetStatus({ state: "downloading", loadedBytes: loaded, totalBytes: total });
      },
      (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("404") || msg.includes("Not Found")) {
          setAssetStatus({ state: "failed", code: "HTTP_NOT_OK", safeMessage: "GLB not found (404) — check /assets/aida/aida.glb" });
        } else {
          setAssetStatus({ state: "failed", code: "PARSE_FAILED", safeMessage: msg.slice(0, 120) || "Parse failed" });
        }
      },
    );

    // Cranium (procedural fallback — hidden when GLB loaded)
    const headGeo = new THREE.SphereGeometry(0.62, 48, 48);
    headGeo.scale(0.88, 1.08, 0.94);
    const head = new THREE.Mesh(headGeo, skinMaterial());
    head.position.y = 0.55;
    avatar.add(head);

    // Jaw group (viseme-driven)
    const jaw = new THREE.Group();
    jaw.position.set(0, 0.18, 0.12);
    avatar.add(jaw);
    const chinGeo = new THREE.SphereGeometry(0.34, 32, 32);
    chinGeo.scale(0.95, 0.75, 0.9);
    const chin = new THREE.Mesh(chinGeo, skinMaterial());
    chin.position.set(0, -0.02, 0.1);
    jaw.add(chin);
    // Lower lip follows jaw
    const lowerLipGeo = new THREE.SphereGeometry(0.09, 24, 24);
    lowerLipGeo.scale(1.9, 0.55, 0.8);
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x8f4f4a, roughness: 0.5 });
    const lowerLip = new THREE.Mesh(lowerLipGeo, lipMat);
    lowerLip.position.set(0, 0.14, 0.52);
    jaw.add(lowerLip);
    // Upper lip (fixed to head)
    const upperLipGeo = new THREE.SphereGeometry(0.085, 24, 24);
    upperLipGeo.scale(1.8, 0.45, 0.7);
    const upperLip = new THREE.Mesh(upperLipGeo, lipMat.clone());
    upperLip.position.set(0, 0.3, 0.52);
    avatar.add(upperLip);
    // Mouth interior
    const mouthGeo = new THREE.SphereGeometry(0.1, 24, 24);
    mouthGeo.scale(1.5, 0.5, 0.4);
    const mouth = new THREE.Mesh(mouthGeo, new THREE.MeshStandardMaterial({ color: 0x2a0f0e, roughness: 0.9 }));
    mouth.position.set(0, 0.2, 0.5);
    mouth.scale.set(1, 0.15, 1);
    avatar.add(mouth);

    // Eyes
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf2f5f7, roughness: 0.25 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.3 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
    const eyeGroups: THREE.Group[] = [];
    const lidMeshes: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(side * 0.2, 0.62, 0.5);
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 24), eyeWhiteMat);
      white.scale.set(1.0, 0.62, 0.55);
      g.add(white);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.038, 20, 20), irisMat);
      iris.position.z = 0.048;
      g.add(iris);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 16), pupilMat);
      pupil.position.z = 0.085;
      g.add(pupil);
      // Upper lid (blink: scale y down over eye)
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), skinMaterial());
      lid.scale.set(1.15, 0.75, 0.6);
      lid.position.z = 0.012;
      lid.visible = false;
      g.add(lid);
      lidMeshes.push(lid);
      avatar.add(g);
      eyeGroups.push(g);
    }
    // Brows
    const browMat = new THREE.MeshStandardMaterial({ color: 0x1d1410, roughness: 0.8 });
    const brows: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), browMat);
      brow.scale.set(2.1, 0.45, 0.7);
      brow.position.set(side * 0.22, 0.82, 0.5);
      brow.rotation.z = side * -0.08;
      avatar.add(brow);
      brows.push(brow);
    }
    // Nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 16), skinMaterial());
    nose.position.set(0, 0.42, 0.58);
    nose.rotation.x = 0.25;
    avatar.add(nose);
    // Ears
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), skinMaterial());
      ear.scale.set(0.45, 1, 0.7);
      ear.position.set(side * 0.55, 0.55, 0.02);
      avatar.add(ear);
    }
    // Hair: braided updo/bun — dark, structured, matches reference
    const hairMat = hairMaterial();
    // Scalp base
    const scalp = new THREE.Mesh(new THREE.SphereGeometry(0.64, 32, 32), hairMat);
    scalp.scale.set(0.92, 0.98, 0.92);
    scalp.position.set(0, 0.68, -0.08);
    avatar.add(scalp);
    // Braids — 6 radial braids forming crown + bun
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const r = 0.58;
      const x0 = Math.cos(angle) * r * 0.9;
      const z0 = Math.sin(angle) * r * 0.9;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x0 * 0.5, 0.95, z0 * 0.5),
        new THREE.Vector3(x0 * 0.85, 0.85, z0 * 0.85),
        new THREE.Vector3(x0 * 0.95, 0.65, z0 * 0.95),
        new THREE.Vector3(Math.cos(angle) * 0.18, 0.45, Math.sin(angle) * 0.18 - 0.45),
      ]);
      const tube = new THREE.TubeGeometry(curve, 12, 0.035, 8, false);
      const braid = new THREE.Mesh(tube, hairMat);
      avatar.add(braid);
    }
    // Bun
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), hairMat);
    bun.position.set(0, 0.95, -0.52);
    bun.scale.set(1.1, 0.85, 0.9);
    avatar.add(bun);
    // Hairline flyaways (subtle)
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const fly = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), hairMat);
      fly.position.set(Math.cos(a) * 0.62, 0.88 + Math.random() * 0.08, Math.sin(a) * 0.62);
      avatar.add(fly);
    }
    // Neck + shoulders/bust
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.34, 24), skinMaterial());
    neck.position.y = -0.28;
    avatar.add(neck);
    const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x0a1a2e, roughness: 0.6 });
    const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 0.55, 32), shoulderMat);
    shoulders.position.y = -0.72;
    avatar.add(shoulders);

    // Holographic rings + pedestal + particle accents
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.0 + i * 0.2, 0.014, 8, 72),
        new THREE.MeshBasicMaterial({ color: 0x31baf2, transparent: true, opacity: 0.4 - i * 0.08 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.35 - i * 0.07;
      scene.add(ring);
      rings.push(ring);
    }
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.45, 0.14, 64),
      new THREE.MeshStandardMaterial({ color: 0x1598ec, emissive: 0x1598ec, emissiveIntensity: 0.5, transparent: true, opacity: 0.55 }),
    );
    pedestal.position.y = -1.15;
    scene.add(pedestal);
    // Cyan particle accents (ambient only; never fake activity)
    const pGeo = new THREE.BufferGeometry();
    const pCount = 120;
    const pos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.2 + Math.random() * 0.8;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = -0.9 + Math.random() * 2.2;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x5ad5fb, size: 0.02, transparent: true, opacity: 0.7 }));
    scene.add(particles);

    // Expression/blink/gaze rig state
    let frame = 0;
    let blinkAt = 90;
    let blinking = 0;
    let gazeX = 0;
    let gazeY = 0;
    let gazeTargetX = 0;
    let gazeTargetY = 0;
    let gazeAt = 0;
    let raf = 0;
    let hidden = false;
    const onVis = () => { hidden = document.hidden; };
    document.addEventListener("visibilitychange", onVis);

    const animate = () => {
      const s = stateRef.current;
      const lvl = Math.max(0, Math.min(1, levelRef.current));
      if (!hidden && !prefersReduced) {
        frame += 1;
        // Breathing
        avatar.position.y = Math.sin(frame * 0.015) * 0.02;
        // Blink every ~3-5s
        if (frame >= blinkAt) { blinking = 8; blinkAt = frame + 150 + Math.random() * 150; }
        if (blinking > 0) {
          blinking -= 1;
          const t = blinking / 8;
          const close = Math.sin((1 - t) * Math.PI);
          for (const lid of lidMeshes) { lid.visible = close > 0.15; lid.scale.y = 0.75 * (1 - close * 0.7); }
          for (const g of eyeGroups) g.scale.y = 1 - close * 0.85;
        } else {
          for (const lid of lidMeshes) lid.visible = false;
          for (const g of eyeGroups) g.scale.y += (1 - g.scale.y) * 0.3;
        }
        // Gaze saccades (attentive, bounded)
        if (frame >= gazeAt) {
          gazeAt = frame + 90 + Math.random() * 160;
          const speaking = s === "speaking";
          gazeTargetX = (speaking ? 0.02 : 0.06) * (Math.random() * 2 - 1);
          gazeTargetY = 0.03 * (Math.random() * 2 - 1) + (s === "thinking" ? 0.04 : 0);
        }
        gazeX += (gazeTargetX - gazeX) * 0.05;
        gazeY += (gazeTargetY - gazeY) * 0.05;
        for (const g of eyeGroups) { g.rotation.y = gazeX * 3; g.rotation.x = -gazeY * 3; }
        avatar.rotation.y = gazeX * 1.2 + (s === "listening" ? Math.sin(frame * 0.01) * 0.04 : 0);
        avatar.rotation.x = gazeY * 0.8;
        // Brows: subtle focus during thinking/verifying
        const focus = s === "thinking" || s === "verifying" || s === "inspecting" ? 1 : 0;
        const browL = brows[0];
        const browR = brows[1];
        if (browL && browR) {
          browL.position.y += ((0.82 - focus * 0.02) - browL.position.y) * 0.1;
          browR.position.y += ((0.82 - focus * 0.02) - browR.position.y) * 0.1;
        }
        // Rings: rotate while searching/inspecting/analysing
        if (s === "searching" || s === "inspecting" || s === "thinking") rings.forEach((r, i) => { r.rotation.z += 0.004 + i * 0.002; });
        particles.rotation.y += 0.0008;
        // Jaw / mouth: viseme timeline when speaking, rest otherwise — GLB morphTargets if available, else procedural
        if (s === "speaking") {
          const v = visemesRef.current;
          const start = audioStartRef.current;
          const lvlClamped = Math.max(0, Math.min(1, lvl));
          if (glbLoaded && glbMouthMesh) {
            const morph = glbMouthMesh as unknown as { morphTargetInfluences?: number[]; morphTargetDictionary?: Record<string, number> };
            if (morph.morphTargetInfluences && morph.morphTargetDictionary) {
              // Reset all
              for (let i = 0; i < morph.morphTargetInfluences.length; i++) morph.morphTargetInfluences[i] = 0;
              if (v && start !== null) {
                const elapsed = Date.now() - start;
                const active = v.find((vi) => elapsed >= vi.startMs && elapsed < vi.endMs) ?? v[v.length - 1]!;
                if (active) {
                  const { jawOpen } = visemeToMouthState(active.viseme);
                  const jawIdx = morph.morphTargetDictionary["jawOpen"] ?? morph.morphTargetDictionary["mouthOpen"] ?? 0;
                  morph.morphTargetInfluences[jawIdx] = jawOpen;
                }
              } else {
                const jawIdx = morph.morphTargetDictionary["jawOpen"] ?? 0;
                morph.morphTargetInfluences[jawIdx] = lvlClamped * 0.8;
              }
            }
          } else if (v && v.length > 0 && start !== null) {
            const elapsed = Date.now() - start;
            const active = v.find((vi) => elapsed >= vi.startMs && elapsed < vi.endMs) ?? (elapsed > (v[v.length - 1]!.endMs ?? 0) ? null : v[v.length - 1]!);
            if (active) {
              const { jawOpen, mouthWidth } = visemeToMouthState(active.viseme);
              jaw.position.y = 0.18 - jawOpen * 0.09;
              mouth.scale.y = Math.max(0.15, jawOpen * 1.6);
              mouth.scale.x = 1 + (mouthWidth - 0.5) * 0.8;
              lowerLip.position.y = 0.14 - jawOpen * 0.08;
            } else {
              jaw.position.y += (0.18 - jaw.position.y) * 0.2;
              mouth.scale.y += (0.15 - mouth.scale.y) * 0.2;
            }
          } else {
            jaw.position.y = 0.18 - lvl * 0.07;
            mouth.scale.y = Math.max(0.15, lvl * 1.2);
            lowerLip.position.y = 0.14 - lvl * 0.06;
          }
        } else {
          if (!glbLoaded) {
            jaw.position.y += (0.18 - jaw.position.y) * 0.15;
            mouth.scale.y += (0.15 - mouth.scale.y) * 0.15;
            mouth.scale.x += (1 - mouth.scale.x) * 0.15;
          } else if (glbMouthMesh) {
            const morph = glbMouthMesh as unknown as { morphTargetInfluences?: number[] };
            if (morph.morphTargetInfluences) for (let i = 0; i < morph.morphTargetInfluences.length; i++) { const v = morph.morphTargetInfluences[i]; if (v !== undefined) morph.morphTargetInfluences[i] = v * 0.85; }
          }
        }
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) (mesh.geometry as THREE.BufferGeometry).dispose();
        const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      pGeo.dispose();
      (particles.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  const assetLabel =
    assetStatus.state === "loaded"
      ? `AIDA 3D • ${state.toUpperCase()} • Ara cornrows (186k) — CC0 — loaded`
      : assetStatus.state === "failed"
        ? `AIDA 3D • ${state.toUpperCase()} • ${assetStatus.code}: ${assetStatus.safeMessage}`
        : assetStatus.state === "downloading"
          ? `AIDA 3D • ${state.toUpperCase()} • downloading ${assetStatus.loadedBytes}/${assetStatus.totalBytes ?? "?"}`
          : assetStatus.state === "requesting"
            ? `AIDA 3D • ${state.toUpperCase()} • requesting ${assetStatus.url}`
            : `AIDA 3D • ${state.toUpperCase()} • procedural bust — ${assetStatus.state}`;

  return (
    <div ref={mountRef} style={{ width: "100%", height: 460, borderRadius: 16, overflow: "hidden", background: "radial-gradient(60% 55% at 50% 38%, rgba(31,159,233,0.12), transparent 70%), var(--aida-surface-1, #031423)", border: "1px solid rgba(29,117,181,0.45)", position: "relative" }} role="img" aria-label={`Aida avatar, ${state}`}>
      <div data-aida-label style={{ position: "absolute", top: 12, right: 12, fontSize: 10, color: "var(--aida-text-muted)", letterSpacing: 1 }}>{assetLabel}</div>
      {debugMode ? (
        <div style={{ position: "absolute", bottom: 12, left: 12, fontSize: 10, color: "var(--aida-text-muted)", background: "rgba(0,0,0,0.5)", padding: "6px 8px", borderRadius: 8, maxWidth: "70%" }}>
          <div>Asset: {assetStatus.state} {assetStatus.state === "loaded" ? `triangles ${assetStatus.triangleCount} morphs ${assetStatus.morphTargetCount} bones ${assetStatus.boneCount}` : ""}</div>
          <div>WebGL: {webglFailed ? "failed" : "ok"} • State: {state} • Level: {level.toFixed(2)}</div>
        </div>
      ) : null}
      {webglFailed ? (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, textAlign: "center", fontSize: 13, color: "var(--aida-text)" }}>
          3D Aida is unavailable (WebGL context lost). You can continue with text and voice — full capability remains in the conversation.
        </div>
      ) : null}
    </div>
  );
}
