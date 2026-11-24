"use client";

import { useEffect, useRef, useState } from "react";
import { AidaAvatarStage } from "@/components/command/aida-avatar-stage";
import type { AidaCoreState } from "@/components/command/aida-core";
import { approximateVisemesFromText, type TimedViseme } from "@/modules/voice/viseme";

type Step = { state: AidaCoreState; label: string; note: string; speak?: boolean };

const FIXTURE_LINE = "Presence preview. My expressions follow the real assistant state.";

/* Deterministic engineering demo fixture. Every value is synthetic, fixed and
   labelled DEMO — it never touches production audits, repos or findings. */
const DEMO_BASE_MS = Date.UTC(2026, 10, 25, 12, 0, 0);
const DEMO_STAGES = [
  { id: "REQUEST", label: "Received request", atSec: 0, event: "Received demo request (DEMO)" },
  { id: "CONNECT", label: "Connected to local engineering companion", atSec: 8, event: "Connected to demo companion sandbox (DEMO)" },
  { id: "INIT", label: "Initialising Forge", atSec: 16, event: "Initialised demo Forge adapter (DEMO)" },
  { id: "MAP", label: "Analysing repository", atSec: 24, event: "Mapped demo-repository structure (DEMO)" },
  { id: "VERIFY", label: "Verifying findings", atSec: 32, event: "Verified 3 demo findings against fixture evidence (DEMO)" },
  { id: "EVIDENCE", label: "Building evidence", atSec: 40, event: "Built demo evidence bundle (DEMO)" },
  { id: "REPORT", label: "Composing report", atSec: 48, event: "Composed demo report (DEMO)" },
] as const;
const DEMO_FINDINGS = [
  { id: "P0", count: 1, label: "Critical (demo fixture)" },
  { id: "P1", count: 1, label: "High (demo fixture)" },
  { id: "P2", count: 1, label: "Medium (demo fixture)" },
] as const;
function demoClock(sec: number): string {
  return new Date(DEMO_BASE_MS + sec * 1000).toISOString().slice(11, 19);
}

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
  const [demoStep, setDemoStep] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step = SCRIPT[index] ?? SCRIPT[0]!;

  function clearTimer() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  // Deterministic demo scenario: fixed fixture steps, fixed clock, no provider/tool calls.
  useEffect(() => {
    if (!demoPlaying) {
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
      demoTimerRef.current = null;
      return;
    }
    demoTimerRef.current = setTimeout(() => {
      setDemoStep((s) => {
        if (s + 1 >= DEMO_STAGES.length) {
          setDemoPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 1500);
    return () => {
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
      demoTimerRef.current = null;
    };
  }, [demoPlaying, demoStep]);

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
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
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

      {/* Deterministic engineering demo: fixed fixture, fixed clock, DEMO marks everywhere. */}
      <div className="aida-panel" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h3 className="aida-panel-title">Deterministic engineering demo</h3>
          <span style={{ fontSize: 10, background: "var(--aida-amber)", color: "#020812", padding: "2px 8px", borderRadius: 20, fontWeight: 800 }}>DEMO — NOT LIVE</span>
        </div>
        <p className="aida-meta" style={{ marginTop: 6 }}>
          Fixed script on fixture repo <strong>demo-repository</strong> (branch main, commit <span className="mono">demo0000</span>).
          No provider calls, no shell execution, no production writes. Timestamps are a fixed clock for repeatable screenshots.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => { setDemoStep(0); setDemoPlaying(true); }}>{demoPlaying ? "Playing…" : "Play demo"}</button>
          <button type="button" className="btn btn-sm" onClick={() => setDemoPlaying(!demoPlaying)}>{demoPlaying ? "Pause" : "Resume"}</button>
          <button type="button" className="btn btn-sm" onClick={() => { setDemoPlaying(false); setDemoStep((s) => Math.min(s + 1, DEMO_STAGES.length - 1)); }}>Step ▸</button>
          <button type="button" className="btn btn-sm" onClick={() => { setDemoPlaying(false); setDemoStep(0); }}>Reset</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
          <div>
            <div className="aida-meta" style={{ marginBottom: 6 }}>Demo timeline (fixed clock)</div>
            <ol className="aida-timeline">
              {DEMO_STAGES.map((s, i) => (
                <li key={s.id}>
                  <span className={`aida-dot${i < demoStep ? " done" : i === demoStep ? " active" : ""}`}>{i < demoStep ? "✓" : i === demoStep ? "●" : ""}</span>
                  <span style={{ color: i === demoStep ? "var(--aida-cyan-4)" : "var(--aida-text-muted)" }}>{demoClock(s.atSec)} · {s.label}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <div className="aida-meta" style={{ marginBottom: 6 }}>Demo live activity (fixture)</div>
            <div className="aida-feed">
              {DEMO_STAGES.slice(0, demoStep + 1).map((s) => (
                <div className="aida-feed-row" key={s.id}>
                  <time>{demoClock(s.atSec)}</time>
                  <span>&gt; {s.event}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="aida-meta" style={{ marginBottom: 6 }}>Demo findings (fixture)</div>
            {demoStep >= 4 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {DEMO_FINDINGS.map((f) => (
                  <div className="aida-finding" key={f.id} aria-label={`Demo finding ${f.id}`}>
                    <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                      <span className="aida-sev" style={{ background: "var(--aida-amber)" }}>{f.id}</span>
                      <span>{f.count} · {f.label}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="aida-meta">Findings appear at the verify step — fixture only, never production data.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
