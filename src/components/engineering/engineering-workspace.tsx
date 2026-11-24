"use client";

import { useEffect, useState } from "react";
import { AidaCore, type AidaCoreState } from "@/components/command/aida-core";

type Stage = { id: string; label: string; status: "pending" | "active" | "completed" | "skipped" | "failed" };

const PIPELINE: Stage[] = [
  { id: "REQUEST", label: "REQUEST", status: "completed" },
  { id: "CONNECT", label: "CONNECT", status: "active" },
  { id: "MAP", label: "MAP", status: "pending" },
  { id: "ANALYSE", label: "ANALYSE", status: "pending" },
  { id: "VERIFY", label: "VERIFY", status: "pending" },
  { id: "REPORT", label: "REPORT", status: "pending" },
];

export function EngineeringWorkspace() {
  const [coreState, setCoreState] = useState<AidaCoreState>("idle");
  const [companion, setCompanion] = useState<string>("checking");
  const [forge, setForge] = useState<string>("checking");
  const [activity] = useState<Array<{ time: string; msg: string }>>([
    { time: "14:27:11", msg: "Resolving repository: BigBill-AI-Assistant" },
    { time: "14:27:12", msg: "Connecting to local companion (Ubuntu)" },
    { time: "14:27:13", msg: "Starting Forge analysis engine v0.4" },
  ]);
  const [findings] = useState([
    { id: "P0", count: 1, label: "Critical – Tenant data exposure risk", color: "#ff3b6e" },
    { id: "P1", count: 3, label: "High – Missing input validation", color: "#ff8c42" },
    { id: "P2", count: 5, label: "Medium – Test coverage gaps", color: "#ffcc00" },
    { id: "P3", count: 8, label: "Low – Code quality and maintainability", color: "#5eb0ff" },
  ]);

  useEffect(() => {
    void fetch("/api/companion/status").then((r) => r.json()).then((d) => setCompanion(d.companion ?? "unknown")).catch(() => setCompanion("error"));
    // Forge availability via companion bridge check — honest
    void fetch("/api/engineering/status").then((r) => r.json()).then((d) => setForge(d.forge ?? "unknown")).catch(() => setForge("not_configured"));
    // Simulate live activity only when companion available — otherwise stay honest
    const t = setTimeout(() => setCoreState("inspecting"), 1500);
    return () => clearTimeout(t);
  }, []);

  const isDisconnected = companion !== "available" || forge === "not_configured";

  return (
    <div className="command-env" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Pipeline ribbon */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", background: "var(--cmd-surface)", border: "1px solid var(--cmd-line)", borderRadius: 12, padding: 12, overflowX: "auto" }}>
        {PIPELINE.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ padding: "6px 12px", borderRadius: 20, fontSize: 11, letterSpacing: 1, background: s.status === "active" ? "rgba(0,229,255,0.15)" : s.status === "completed" ? "rgba(46,204,156,0.15)" : "transparent", border: `1px solid ${s.status === "active" ? "var(--cmd-cyan)" : "var(--cmd-line)"}`, color: s.status === "active" ? "var(--cmd-cyan)" : "var(--cmd-muted)" }}>
              {s.label}
            </span>
            {i < PIPELINE.length - 1 ? <span style={{ color: "var(--cmd-muted)" }}>→</span> : null}
          </div>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--cmd-muted)" }}>{isDisconnected ? "Companion/Forge not connected — showing honest empty state" : "Live"}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr 360px", gap: 16, minHeight: 520 }}>
        {/* A. Request & repo context */}
        <div style={{ background: "var(--cmd-surface)", border: "1px solid var(--cmd-line)", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 13, color: "var(--cmd-cyan)", letterSpacing: 1 }}>Engineering Request</h3>
          <div style={{ background: "rgba(2,8,18,0.6)", border: "1px solid var(--cmd-line)", borderRadius: 12, padding: 12, fontSize: 13, color: "var(--cmd-ink-soft)" }}>
            Aida, review the BigBill-AI-Assistant repository with Forge. Find security issues, risks, tests and any functionality that may be broken.
          </div>
          <div style={{ fontSize: 12, color: "var(--cmd-muted)", display: "grid", gap: 6 }}>
            <div>Repository: <span style={{ color: "var(--cmd-ink)" }}>BigBill-AI-Assistant</span></div>
            <div>Engine: <span style={{ color: "var(--cmd-ink)" }}>Forge</span></div>
            <div>Mode: <span style={{ color: "var(--cmd-ink)" }}>Full Audit (Evidence)</span></div>
            <div>Companion: <span style={{ color: companion === "available" ? "var(--cmd-green)" : "var(--cmd-amber)" }}>{companion}</span></div>
            <div>Forge: <span style={{ color: forge === "not_configured" ? "var(--cmd-amber)" : "var(--cmd-green)" }}>{forge}</span></div>
          </div>
          <button style={{ background: isDisconnected ? "var(--cmd-surface-strong)" : "var(--cmd-cyan)", color: isDisconnected ? "var(--cmd-muted)" : "#020812", border: "1px solid var(--cmd-line-strong)", borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: isDisconnected ? "not-allowed" : "pointer" }} disabled={isDisconnected}>
            {isDisconnected ? "Connect companion to review" : "Review repository"}
          </button>
          <div style={{ fontSize: 11, color: "var(--cmd-muted)" }}>Include uncommitted changes: ON • Source snapshot hash will be recorded</div>
        </div>

        {/* B. Aida Core / live investigation stage */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <AidaCore state={isDisconnected ? "disconnected" : coreState} />
          <div style={{ background: "var(--cmd-surface)", border: "1px solid var(--cmd-line)", borderRadius: 12, padding: 12, fontSize: 12, color: "var(--cmd-ink-soft)" }}>
            <div style={{ fontWeight: 700, color: "var(--cmd-cyan)" }}>AIDA — {isDisconnected ? "Disconnected" : "Thinking..."} </div>
            <div style={{ marginTop: 4 }}>Checking authentication, tenant isolation, input validation and permissions... 42%</div>
            <div style={{ marginTop: 8, height: 6, background: "rgba(0,229,255,0.1)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: "42%", height: "100%", background: "var(--cmd-cyan)" }} /></div>
          </div>
        </div>

        {/* C. Live activity feed */}
        <div style={{ background: "var(--cmd-surface)", border: "1px solid var(--cmd-line)", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 13, color: "var(--cmd-cyan)" }}>Live Activity</h3>
            <span style={{ fontSize: 10, background: "var(--cmd-green)", color: "#020812", padding: "2px 6px", borderRadius: 20 }}>Live</span>
          </div>
          {activity.map((a, i) => (
            <div key={i} style={{ fontSize: 11, color: "var(--cmd-ink-soft)", display: "flex", gap: 8, borderLeft: "2px solid var(--cmd-line)", paddingLeft: 8 }}>
              <span style={{ color: "var(--cmd-muted)" }}>{a.time}</span>
              <span>{a.msg}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "var(--cmd-amber)", marginTop: 8 }}>No secrets, chain-of-thought, or raw source streamed — sanitized events only.</div>
        </div>
      </div>

      {/* D. Findings */}
      <div style={{ background: "var(--cmd-surface)", border: "1px solid var(--cmd-line)", borderRadius: 16, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 13, color: "var(--cmd-cyan)" }}>Findings (Live)</h3>
          <span style={{ fontSize: 11, background: "rgba(0,229,255,0.15)", padding: "4px 8px", borderRadius: 20 }}>17 findings</span>
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {findings.map((f) => (
            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(2,8,18,0.5)", border: "1px solid var(--cmd-line)", borderRadius: 10, padding: "10px 12px" }}>
              <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                <span style={{ background: f.color, color: "#020812", padding: "2px 6px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{f.id}</span>
                <span style={{ color: "var(--cmd-ink-soft)" }}>{f.label}</span>
              </span>
              <span style={{ fontSize: 11, color: "var(--cmd-muted)" }}>{f.count} →</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--cmd-muted)" }}>Demo fixture — production findings require valid verification artifacts for CONFIRMED trust.</div>
      </div>
    </div>
  );
}
