"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { AidaCoreState } from "./aida-core";

export function AidaAvatarStage({ state, level = 0 }: { state: AidaCoreState; level?: number }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020812);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 0.2, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(1, 1.5, 2);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x00e5ff, 0.6);
    rimLight.position.set(-1.5, 0.5, -1);
    scene.add(rimLight);
    scene.add(new THREE.AmbientLight(0x445588, 0.4));

    // Head — sphere as placeholder bust (licensed synthetic, not a real person)
    const headGeo = new THREE.SphereGeometry(0.85, 32, 32);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xd6b8a8, roughness: 0.5, metalness: 0.05 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.35;
    scene.add(head);

    // Shoulders
    const shoulderGeo = new THREE.CylinderGeometry(1.1, 1.3, 0.6, 32);
    const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x0a162a, roughness: 0.7 });
    const shoulders = new THREE.Mesh(shoulderGeo, shoulderMat);
    shoulders.position.y = -0.65;
    scene.add(shoulders);

    // Holographic rings
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i += 1) {
      const ringGeo = new THREE.TorusGeometry(1.05 + i * 0.18, 0.015, 8, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.15 - i * 0.05;
      rings.push(ring);
      scene.add(ring);
    }

    // Pedestal
    const pedestalGeo = new THREE.CylinderGeometry(1.4, 1.6, 0.15, 64);
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.3, transparent: true, opacity: 0.6 });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -1.05;
    scene.add(pedestal);

    let frame = 0;
    let isHidden = false;
    const onVisibility = () => {
      isHidden = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    const animate = () => {
      if (isHidden || prefersReduced) {
        // Reduced motion: static
        renderer.render(scene, camera);
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      frame += 1;
      // Breathing
      head.position.y = 0.35 + Math.sin(frame * 0.015) * 0.02;
      // Rings rotation for searching/inspecting
      if (state === "searching" || state === "inspecting") {
        rings.forEach((r, i) => (r.rotation.z += 0.005 + i * 0.002));
      }
      // Speaking viseme approximation: scale jaw (head) with level
      if (state === "speaking") {
        const s = 1 + level * 0.06;
        head.scale.set(1, s, 1);
      } else {
        head.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      }
      // Listening: subtle head orientation
      if (state === "listening") {
        head.rotation.y = Math.sin(frame * 0.01) * 0.05;
      } else {
        head.rotation.y *= 0.95;
      }
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      headGeo.dispose();
      headMat.dispose();
      shoulderGeo.dispose();
      shoulderMat.dispose();
      rings.forEach((r) => {
        (r.geometry as THREE.BufferGeometry).dispose();
        (r.material as THREE.Material).dispose();
      });
      pedestalGeo.dispose();
      pedestalMat.dispose();
      mount.removeChild(renderer.domElement);
      sceneRef.current = null;
      rendererRef.current = null;
    };
  }, [state, level]);

  return (
    <div ref={mountRef} style={{ width: "100%", height: 380, borderRadius: 16, overflow: "hidden", background: "var(--cmd-surface)", border: "1px solid var(--cmd-line)", position: "relative" }}>
      <div style={{ position: "absolute", top: 12, right: 12, fontSize: 10, color: "var(--cmd-muted)", letterSpacing: 1 }}>AIDA 3D • {state.toUpperCase()} • synthetic licensed</div>
      <div style={{ position: "absolute", bottom: 12, left: 12, fontSize: 10, color: "var(--cmd-muted)" }}>Fallback: static poster if WebGL unavailable</div>
    </div>
  );
}
