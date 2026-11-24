"use client";

import { useEffect, useRef } from "react";

type Props = {
  audioState: string;
  level?: number; // 0..1 supplied by analyser or speaking amplitude
  reducedMotion?: boolean;
};

export function AudioVisualizer({ audioState, level, reducedMotion }: Props) {
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
      ctx.clearRect(0, 0, width, height);

      // Determine true motion from state and level, never fake listening/speaking
      const isListening = audioState === "listening";
      const isSpeaking = audioState === "speaking";
      const isThinking = audioState === "thinking" || audioState === "transcribing";
      const isError = audioState === "error";
      const isIdle = audioState === "idle" || audioState === "muted";

      const baseLevel = level ?? (isSpeaking ? 0.6 : isListening ? 0.5 : isThinking ? 0.2 : 0.05);
      const clamped = Math.max(0, Math.min(1, baseLevel));

      // Background ring
      ctx.strokeStyle = isError ? "rgba(255,59,110,0.5)" : isListening ? "rgba(255,59,110,0.35)" : isSpeaking ? "rgba(0,229,255,0.35)" : "rgba(120,140,160,0.15)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2, Math.min(width, height) / 2 - 8, Math.min(width, height) / 2 - 8, 0, 0, Math.PI * 2);
      ctx.stroke();

      if (reducedMotion) {
        // Static level indicator for reduced-motion users
        ctx.fillStyle = isError ? "#ff3b6e" : isSpeaking ? "#00e5ff" : isListening ? "#ff3b6e" : "#6a8ab8";
        const barW = width * 0.6 * clamped;
        ctx.fillRect(width / 2 - barW / 2, height / 2 - 3, barW, 6);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Waveform bars driven by clamped level + time, not perpetual fake animation when idle
      const bars = 28;
      const gap = 4;
      const barW = (width - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        const phase = (i / bars) * Math.PI * 2;
        const pulse = isIdle ? clamped * 0.2 : clamped * (0.5 + 0.5 * Math.sin(frame * 0.12 + phase * 2));
        const h = 6 + pulse * (height * 0.7);
        const x = i * (barW + gap);
        const y = height / 2 - h / 2;
        const alpha = 0.55 + pulse * 0.45;
        ctx.fillStyle = isError ? `rgba(255,59,110,${alpha})` : isThinking ? `rgba(123,107,255,${alpha})` : isListening ? `rgba(255,59,110,${alpha})` : isSpeaking ? `rgba(0,229,255,${alpha})` : `rgba(100,130,160,${alpha * 0.6})`;
        // rounded bar
        const r = 3;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + barW, y, x + barW, y + h, r);
        ctx.arcTo(x + barW, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + barW, y, r);
        ctx.closePath();
        ctx.fill();
      }

      // Centre label reflects true state
      ctx.fillStyle = "rgba(200,220,240,0.9)";
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label =
        isListening ? "LISTENING" : isSpeaking ? "SPEAKING" : isThinking ? "THINKING" : isError ? "ERROR" : isIdle ? "IDLE" : audioState.toUpperCase();
      ctx.fillText(label, width / 2, height / 2 + Math.min(width, height) / 2 + 14);

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [audioState, level, reducedMotion]);

  return (
    <div
      role="img"
      aria-label={`Voice visualizer: ${audioState}${level !== undefined ? ` level ${Math.round((level ?? 0) * 100)}%` : ""}`}
      style={{ width: "100%", height: 120, border: "1px solid var(--aida-border-strong, rgba(29,117,181,0.45))", borderRadius: 12, background: "rgba(3,20,35,0.9)", padding: 8 }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <span className="tiny muted" style={{ position: "absolute", left: -9999 }}>
        Visualizer driven by actual audio session state: {audioState}
      </span>
    </div>
  );
}
