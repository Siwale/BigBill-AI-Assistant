"use client";

import { useEffect, useRef, useState } from "react";
import { AidaAvatarStage } from "@/components/command/aida-avatar-stage";
import type { AidaCoreState } from "@/components/command/aida-core";
import { approximateVisemesFromText, type TimedViseme } from "@/modules/voice/viseme";

type Step = { state: AidaCoreState; label: string; note: string; speak?: boolean };

const FIXTURE_LINE = "Presence preview. My expressions follow the real assistant state.";

const SCRIPT: Step[] = [
  { state: "idle", label: "Idle", note: "Relaxed neutral face, occasional blink, gentle breathing." },
  { state: "listening", label: "Listening", note: "Attentive eyes, slight head orientation, lips at rest." },
  { state: "thinking", label: "Thinking", note: "Gaze shift, restrained brow focus. Amber stage glow." },
  { state: "searching", label: "Searching", note: "Attentive gaze; cyan ring rotation while retrieving." },
  { state: "inspecting", label: "Analysing", note: "Concentrated gaze, stable head, analysis running." },
  { state: "verifying", label: "Verifying", note: "Steady gaze; no success cue until verification completes." },
  { state: "speaking", label: "Speaking", note: "Mouth driven by viseme schedule anchored to audio clock.", speak: true },
  { state: "idle", label: "Acknowledging", note: "Brief settled state after the event completes." },
];

export function PresencePreview() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [level] = useState(0);
  const [visemes, setVisemes] = useState<TimedViseme[] | null>(null);
  const [audioStartMs, setAudioStartMs] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step = SCRIPT[index] ?? SCRIPT[0]!;

  function clearTimer() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function runStep(i: number) {
    const s = SCRIPT[i];
    if (!s) {
      setPlaying(false);
      setVisemes(null);
      return;
    }
    setIndex(i);
    if (s.speak) {
      const v = approximateVisemesFromText(FIXTURE_LINE, 4000);
      setVisemes(v);
      setAudioStartMs(Date.now());
      if ("speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(FIXTURE_LINE);
          u.onend = () => setVisemes(null);
          window.speechSynthesis.speak(u);
        } catch { /* silent viseme-only preview */ }
      }
    } else {
      setVisemes(null);
      setAudioStartMs(null);
      if ("speechSynthesis" in window) {
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }
      }
    }
  }

  useEffect(() => {
    if (!playing) {
      clearTimer();
      return;
    }
    timerRef.current = setTimeout(() => {
      if (index + 1 >= SCRIPT.length) {
        setPlaying(false);
        setVisemes(null);
      } else {
        runStep(index + 1);
      }
    }, step.speak ? 4500 : 2200);
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index]);

  useEffect(() => () => {
    clearTimer();
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "rgba(190,141,89,0.12)", border: "1px solid var(--aida-amber)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "var(--aida-amber-bright)", fontWeight: 700, letterSpacing: 1 }}>
        DEMO — NOT LIVE · Synthetic fixture only · Nothing here touches production conversations, activity or findings
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
        <div>
          <AidaAvatarStage state={step.state} level={level} visemes={visemes} audioStartMs={audioStartMs} />
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 3, color: "var(--aida-text-strong)" }}>AIDA</div>
            <div className="aida-meta">{step.label} — {step.note}</div>
          </div>
        </div>
        <div className="aida-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <h3 className="aida-panel-title">Scenario controls</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => { if (index >= SCRIPT.length - 1) { runStep(0); } setPlaying(true); }}>{playing ? "Playing…" : "Repeat"}</button>
            <button type="button" className="btn btn-sm" onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</button>
            <button type="button" className="btn btn-sm" onClick={() => { setPlaying(false); runStep(0); }}>Reset</button>
            <button type="button" className="btn btn-sm" onClick={() => { setPlaying(false); runStep(Math.min(index + 1, SCRIPT.length - 1)); }}>Step ▸</button>
          </div>
          <label className="aida-meta" htmlFor="presence-state">Jump to state</label>
          <select
            id="presence-state"
            value={index}
            onChange={(e) => { setPlaying(false); runStep(Number(e.target.value)); }}
            style={{ background: "rgba(2,8,18,0.6)", border: "1px solid var(--aida-border)", borderRadius: 8, padding: "8px 10px", color: "var(--aida-text)" }}
          >
            {SCRIPT.map((s, i) => (
              <option key={`${s.label}-${i}`} value={i}>{i + 1}. {s.label}</option>
            ))}
          </select>
          <ol className="aida-timeline" style={{ marginTop: 4 }}>
            {SCRIPT.map((s, i) => (
              <li key={`${s.label}-${i}`}>
                <span className={`aida-dot${i < index ? " done" : i === index ? " active" : ""}`}>{i < index ? "✓" : i === index ? "●" : ""}</span>
                <span style={{ color: i === index ? "var(--aida-cyan-4)" : "var(--aida-text-muted)" }}>{s.label}</span>
              </li>
            ))}
          </ol>
          <p className="aida-meta">Fixture line: “{FIXTURE_LINE}” Viseme schedule is heuristic and labelled approximate — not provider phoneme alignment.</p>
        </div>
      </div>
    </div>
  );
}
