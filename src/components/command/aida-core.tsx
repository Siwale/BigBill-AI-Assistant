"use client";

import { useEffect, useRef } from "react";

export type AidaCoreState =
  | "idle"
  | "listening"
  | "thinking"
  | "searching"
  | "inspecting"
  | "verifying"
  | "speaking"
  | "waiting_approval"
  | "paused"
  | "error"
  | "disconnected";

const LABEL: Record<AidaCoreState, string> = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  searching: "Searching sources",
  inspecting: "Inspecting repository",
  verifying: "Verifying findings",
  speaking: "Speaking",
  waiting_approval: "Waiting for your approval",
  paused: "Paused",
  error: "Needs attention",
  disconnected: "Companion disconnected",
};

export function AidaCore({
  state,
  level = 0,
  reducedMotion,
}: {
  state: AidaCoreState;
  level?: number;
  reducedMotion?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    let frame = 0;
    const draw = () => {
      frame += 1;
      const { width, height } = canvas.getBoundingClientRect();
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width, height) * 0.32;
      ctx.clearRect(0, 0, width, height);

      // Background grid
      ctx.strokeStyle = "rgba(0,229,255,0.06)";
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 40, cy - r - 20);
        ctx.lineTo(cx + i * 40, cy + r + 20);
        ctx.stroke();
      }

      const clamped = Math.max(0, Math.min(1, level));
      const isListening = state === "listening";
      const isSpeaking = state === "speaking";
      const isThinking = state === "thinking";
      const isSearching = state === "searching";
      const isInspecting = state === "inspecting";
      const isVerifying = state === "verifying";
      const isError = state === "error";
      const isPaused = state === "paused";
      const isDisconnected = state === "disconnected";

      // Outer rings
      const rings = isSearching ? 4 : isVerifying ? 3 : 2;
      for (let i = 0; i < rings; i += 1) {
        const rr = r + 18 + i * 14 + (reducedMotion ? 0 : Math.sin(frame * 0.02 + i) * 2);
        ctx.strokeStyle =
          isError ? "rgba(255,59,110,0.4)" : isDisconnected ? "rgba(90,122,184,0.2)" : isInspecting ? "rgba(0,229,255,0.5)" : "rgba(0,229,255,0.25)";
        ctx.lineWidth = isInspecting ? 2 : 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
        // Scan arc for inspecting
        if (isInspecting && !reducedMotion) {
          ctx.strokeStyle = "rgba(0,229,255,0.8)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          const a0 = (frame * 0.03 + i) % (Math.PI * 2);
          ctx.arc(cx, cy, rr, a0, a0 + 0.6);
          ctx.stroke();
        }
      }

      // Core glow
      const glow = isError ? "rgba(255,59,110,0.5)" : isPaused ? "rgba(90,122,184,0.2)" : isSpeaking ? `rgba(0,229,255,${0.4 + clamped * 0.4})` : "rgba(0,229,255,0.35)";
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * (0.85 + (reducedMotion ? 0 : clamped * 0.08 + Math.sin(frame * 0.02) * 0.02)), 0, Math.PI * 2);
      ctx.fill();

      // Waveform bars for speaking/listening (real level, not fake when idle)
      if (!reducedMotion && (isSpeaking || isListening)) {
        const bars = 24;
        const gap = 3;
        const barW = (width * 0.6) / bars;
        const baseY = cy + r + 22;
        for (let i = 0; i < bars; i += 1) {
          const phase = (i / bars) * Math.PI * 2;
          const h = 4 + clamped * 18 * (0.5 + 0.5 * Math.sin(frame * 0.15 + phase));
          const x = cx - (bars * (barW + gap)) / 2 + i * (barW + gap);
          ctx.fillStyle = isListening ? `rgba(255,204,0,${0.6 + clamped * 0.4})` : `rgba(0,229,255,${0.6 + clamped * 0.4})`;
          ctx.fillRect(x, baseY - h / 2, barW, h);
        }
      } else if (isSearching && !reducedMotion) {
        // Orbiting dots
        for (let i = 0; i < 6; i += 1) {
          const ang = frame * 0.02 + (i * Math.PI * 2) / 6;
          const rr = r + 30;
          const x = cx + Math.cos(ang) * rr;
          const y = cy + Math.sin(ang) * rr;
          ctx.fillStyle = "rgba(0,229,255,0.9)";
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Center label
      ctx.fillStyle = isError ? "#ff3b6e" : isDisconnected ? "#5a7ab8" : "#d6e8ff";
      ctx.font = "600 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(LABEL[state].toUpperCase(), cx, cy + r + 48);

      // Reduced motion static bar
      if (reducedMotion && (isSpeaking || isListening)) {
        ctx.fillStyle = isListening ? "#ffcc00" : "#00e5ff";
        const w = width * 0.4 * clamped;
        ctx.fillRect(cx - w / 2, cy + r + 22 - 3, w, 6);
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [state, level, reducedMotion]);

  return (
    <div
      role="img"
      aria-label={`Aida Core: ${LABEL[state]}`}
      className="command-env"
      style={{
        width: "100%",
        height: 320,
        borderRadius: 16,
        background: "var(--cmd-surface)",
        border: "1px solid var(--cmd-line)",
        boxShadow: "var(--cmd-glow)",
        padding: 12,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <div style={{ position: "absolute", top: 12, right: 12, fontSize: 10, color: "var(--cmd-muted)", letterSpacing: 1 }}>AIDA CORE • {state.toUpperCase()}</div>
    </div>
  );
}
