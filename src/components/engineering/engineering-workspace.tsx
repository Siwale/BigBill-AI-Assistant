"use client";

import { useEffect, useMemo, useState } from "react";
import { AidaAvatarStage } from "@/components/command/aida-avatar-stage";
import type { AidaCoreState } from "@/components/command/aida-core";

type StageStatus = "pending" | "active" | "completed" | "skipped" | "failed";
type Stage = { id: string; label: string; status: StageStatus };

type TimelineItem = { id: string; label: string; status: StageStatus };

const TIMELINE_ORDER = [
  { id: "REQUEST", label: "Received request" },
  { id: "CONNECT", label: "Connected to local engineering companion" },
  { id: "INIT", label: "Initialising Forge" },
  { id: "MAP", label: "Analysing repository" },
  { id: "VERIFY", label: "Verifying findings" },
  { id: "EVIDENCE", label: "Building evidence" },
  { id: "REPORT", label: "Composing report" },
] as const;

const RIBBON_ORDER = ["THINKING", "SEARCHING", "ANALYSING", "VERIFYING", "REPORTING"] as const;

type FeedEvent = { time: string; msg: string };
type FindingGroup = { id: string; count: number; label: string; color: string; bg: string };

export function EngineeringWorkspace() {
  const [companion, setCompanion] = useState<string>("checking");
  const [forge, setForge] = useState<string>("checking");
  const [activity, setActivity] = useState<FeedEvent[]>([]);
  const [findings, setFindings] = useState<FindingGroup[]>([]);
  const [totalFindings, setTotalFindings] = useState<number | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [repo, setRepo] = useState<{ name: string; branch: string; commit: string; files: number | null; languages: string; health: string | null; updated: string } | null>(null);
  const [stages, setStages] = useState<Record<string, StageStatus>>({ REQUEST: "completed" });
  const [coreState, setCoreState] = useState<AidaCoreState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/companion/status").then((r) => r.json()).then((d) => { if (!cancelled) setCompanion(d.companion ?? "unknown"); }).catch(() => { if (!cancelled) setCompanion("error"); });
    void fetch("/api/engineering/status").then((r) => r.json()).then((d) => { if (!cancelled) setForge(d.forge ?? "unknown"); }).catch(() => { if (!cancelled) setForge("not_configured"); });
    // Live repository overview from the registered-repo snapshot (never fabricated)
    void fetch("/api/engineering/repositories").then((r) => r.json()).then((d) => {
      if (cancelled) return;
      const first = d.repositories?.[0] as { displayName?: string; branch?: string | null; commitSha?: string | null; lastHealthStatus?: string | null; updatedAt?: string } | undefined;
      if (first) {
        setRepo({
          name: first.displayName ?? "—",
          branch: first.branch ?? "—",
          commit: first.commitSha?.slice(0, 7) ?? "—",
          files: null,
          languages: "—",
          health: first.lastHealthStatus ?? null,
          updated: first.updatedAt ? new Date(first.updatedAt).toLocaleString() : "—",
        });
      } else {
        setRepo(null);
      }
    }).catch(() => { if (!cancelled) setRepo(null); });
    return () => { cancelled = true; };
  }, []);

  // Real live activity: SSE with Last-Event-ID semantics + polling fallback (existing route)
  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function pollJson(id: string) {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/engineering/audits/${id}/events`);
        const data = (await res.json()) as { events?: Array<{ stage: string; status: string; message: string; createdAt: string }> };
        if (data.events && !cancelled) {
          setActivity(data.events.map((e) => ({ time: new Date(e.createdAt).toLocaleTimeString(), msg: e.message })));
          setLiveConnected(true);
          const latest = data.events.length > 0 ? data.events[data.events.length - 1] : undefined;
          setLastEventAt(latest ? new Date(latest.createdAt).toLocaleTimeString() : null);
          applyStages(data.events.map((e) => ({ stage: e.stage, status: e.status })));
        }
        const reportRes = await fetch(`/api/engineering/audits/${id}/report`);
        const report = (await reportRes.json()) as { findings?: Array<{ severity: string; title?: string }> };
        if (report.findings && !cancelled) {
          const bySev: Record<string, number> = {};
          for (const f of report.findings) bySev[f.severity] = (bySev[f.severity] ?? 0) + 1;
          const groups: FindingGroup[] = [
            { id: "P0", count: bySev.critical ?? 0, label: "Critical", color: "#E85B62", bg: "rgba(232,91,98,0.15)" },
            { id: "P1", count: bySev.high ?? 0, label: "High", color: "#BE8D59", bg: "rgba(190,141,89,0.15)" },
            { id: "P2", count: bySev.medium ?? 0, label: "Medium", color: "#DBAE7D", bg: "rgba(219,174,125,0.12)" },
            { id: "P3", count: (bySev.low ?? 0) + (bySev.info ?? 0), label: "Low", color: "#48C9F4", bg: "rgba(72,201,244,0.12)" },
          ].filter((f) => f.count > 0);
          setFindings(groups);
          setTotalFindings(report.findings.length);
        }
      } catch {
        if (!cancelled) setLiveConnected(false);
      }
      if (!cancelled) pollTimer = setTimeout(() => void pollJson(id), 5000);
    }

    function applyStages(events: Array<{ stage: string; status: string }>) {
      setStages((prev) => {
        const next: Record<string, StageStatus> = { ...prev };
        for (const e of events) {
          const key = e.stage.toUpperCase();
          if (e.status === "completed" || e.status === "complete") next[key] = "completed";
          else if (e.status === "active" || e.status === "running") next[key] = "active";
          else if (e.status === "failed" || e.status === "error") next[key] = "failed";
          else if (e.status === "skipped") next[key] = "skipped";
        }
        return next;
      });
      const last = events[events.length - 1];
      if (last) {
        const s = last.stage.toUpperCase();
        if (s.includes("MAP") || s.includes("ANALY")) setCoreState("inspecting");
        else if (s.includes("SEARCH")) setCoreState("searching");
        else if (s.includes("VERIFY")) setCoreState("verifying");
        else if (s.includes("REPORT")) setCoreState("idle");
        else setCoreState("thinking");
      }
    }

    async function loadLatest() {
      try {
        const auditsRes = await fetch("/api/engineering/audits");
        const auditsData = (await auditsRes.json()) as { audits?: Array<{ id: string }> };
        const auditId = auditsData.audits?.[0]?.id;
        if (!auditId) {
          if (!cancelled) { setActivity([]); setCoreState("idle"); }
          return;
        }
        try {
          es = new EventSource(`/api/engineering/audits/${auditId}/events`);
          es.onmessage = (ev) => {
            try {
              const data = JSON.parse(ev.data) as { stage: string; status: string; message: string; createdAt: string };
              if (cancelled) return;
              setActivity((prev) => [...prev.slice(-50), { time: new Date(data.createdAt).toLocaleTimeString(), msg: data.message }]);
              setLiveConnected(true);
              setLastEventAt(new Date(data.createdAt).toLocaleTimeString());
              applyStages([{ stage: data.stage, status: data.status }]);
            } catch { /* ignore malformed event */ }
          };
          es.onerror = () => { es?.close(); es = null; if (!cancelled) setLiveConnected(false); void pollJson(auditId); };
          es.onopen = () => { if (!cancelled) setLiveConnected(true); };
        } catch {
          void pollJson(auditId);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load engineering activity.");
      }
    }
    void loadLatest();
    return () => { cancelled = true; es?.close(); if (pollTimer) clearTimeout(pollTimer); };
  }, []);

  const isDisconnected = companion !== "available" || forge === "not_configured" || forge === "unknown";

  const timeline: TimelineItem[] = useMemo(() => TIMELINE_ORDER.map((t) => {
    let status: StageStatus = stages[t.id] ?? "pending";
    if (t.id === "CONNECT" && status === "pending") status = companion === "available" ? "completed" : companion === "checking" ? "active" : "failed";
    if (t.id === "INIT" && status === "pending") status = forge === "not_configured" ? "failed" : forge === "checking" ? "active" : status;
    return { ...t, status };
  }), [stages, companion, forge]);

  const ribbon: Stage[] = useMemo(() => {
    const mapActive: Record<string, AidaCoreState> = { THINKING: "thinking", SEARCHING: "searching", ANALYSING: "inspecting", VERIFYING: "verifying", REPORTING: "idle" };
    return RIBBON_ORDER.map((id) => {
      let status: StageStatus = "pending";
      if (id === "THINKING" && (coreState === "thinking")) status = "active";
      if (id === "SEARCHING" && coreState === "searching") status = "active";
      if (id === "ANALYSING" && coreState === "inspecting") status = "active";
      if (id === "VERIFYING" && coreState === "verifying") status = "active";
      void mapActive;
      return { id, label: id, status };
    });
  }, [coreState]);

  const focusLabel = coreState === "idle" ? "Ready" : coreState === "inspecting" ? "Security analysis" : coreState === "searching" ? "Searching sources" : coreState === "verifying" ? "Verifying findings" : coreState === "thinking" ? "Thinking" : coreState;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="aida-grid-eng">
        {/* LEFT STACK */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="aida-panel" style={{ padding: 16 }} aria-label="Engineering request">
            <h3 className="aida-panel-title">Engineering Request</h3>
            <div style={{ marginTop: 10, background: "rgba(2,8,18,0.6)", border: "1px solid var(--aida-border)", borderRadius: 12, padding: 12, fontSize: 13, color: "var(--aida-text)" }}>
              {activity.length > 0 ? (activity[activity.length - 1]?.msg ?? "") : "No active audit. Start a review from the command composer or connect the engineering companion."}
            </div>
            <div className="aida-meta" style={{ marginTop: 10, display: "grid", gap: 6 }}>
              <div>Engine: <span style={{ color: "var(--aida-text)" }}>{forge === "not_configured" ? "Forge (not connected)" : `Forge (${forge})`}</span></div>
              <div>Companion: <span style={{ color: companion === "available" ? "var(--aida-success)" : "var(--aida-amber)" }}>{companion}</span></div>
              <div>Mode: <span style={{ color: "var(--aida-text)" }}>Full Audit (Evidence)</span></div>
            </div>
          </section>

          <section className="aida-panel" style={{ padding: 16 }} aria-label="Repository overview">
            <h3 className="aida-panel-title">Repository Overview</h3>
            {repo ? (
              <dl className="aida-meta" style={{ marginTop: 10, display: "grid", gridTemplateColumns: "110px 1fr", gap: "6px 10px" }}>
                <dt>Repository</dt><dd style={{ margin: 0, color: "var(--aida-text)" }}>{repo.name}</dd>
                <dt>Branch</dt><dd style={{ margin: 0, color: "var(--aida-text)" }}>{repo.branch}</dd>
                <dt>Commit</dt><dd style={{ margin: 0, color: "var(--aida-text)", fontFamily: "monospace" }}>{repo.commit}</dd>
                <dt>Files</dt><dd style={{ margin: 0, color: "var(--aida-text)" }}>{repo.files ?? "not scanned yet"}</dd>
                <dt>Languages</dt><dd style={{ margin: 0, color: "var(--aida-text)" }}>{repo.languages === "—" ? "not scanned yet" : repo.languages}</dd>
                <dt>Health</dt><dd style={{ margin: 0, color: "var(--aida-text)" }}>{repo.health ?? "unknown"}</dd>
                <dt>Last Updated</dt><dd style={{ margin: 0, color: "var(--aida-text)" }}>{repo.updated}</dd>
              </dl>
            ) : (
              <p className="aida-meta" style={{ marginTop: 10 }}>No registered repository snapshot yet. Register a repository to see branch, commit and file counts here.</p>
            )}
          </section>

          <section className="aida-panel" style={{ padding: 16 }} aria-label="Current focus">
            <h3 className="aida-panel-title">Current Focus</h3>
            <div className="aida-body" style={{ marginTop: 6, color: "var(--aida-cyan-2)" }}>{focusLabel}</div>
            <div className="aida-meta" style={{ marginTop: 4 }}>
              {activity.length > 0 ? (activity[activity.length - 1]?.msg ?? "") : "Idle — no analysis running."}
            </div>
            <div style={{ marginTop: 10, height: 6, background: "rgba(31,159,233,0.12)", borderRadius: 999, overflow: "hidden" }} role="progressbar" aria-label="Analysis progress" aria-valuetext={activity.length > 0 ? "in progress" : "idle"}>
              {activity.length > 0 ? <div style={{ width: "100%", height: "100%", background: "linear-gradient(90deg, var(--aida-cyan-2), var(--aida-cyan-4))", opacity: 0.7 }} /> : null}
            </div>
          </section>
        </div>

        {/* CENTRE: Aida stage + vertical timeline */}
        <div style={{ display: "flex", gap: 16, alignItems: "stretch", minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <AidaAvatarStage state={coreState} />
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 3, color: "var(--aida-text-strong)" }}>AIDA</div>
              <div className="aida-meta">{coreState === "idle" ? "Ready" : `${coreState.charAt(0).toUpperCase()}${coreState.slice(1)}…`}</div>
            </div>
          </div>
          <ol className="aida-timeline" aria-label="Engineering progress" style={{ width: 210, flex: "0 0 auto", paddingTop: 8 }}>
            {timeline.map((t) => (
              <li key={t.id}>
                <span className={`aida-dot${t.status === "completed" ? " done" : t.status === "active" ? " active" : t.status === "failed" ? " failed" : ""}`} aria-hidden>
                  {t.status === "completed" ? "✓" : t.status === "active" ? "●" : t.status === "failed" ? "!" : ""}
                </span>
                <span style={{ color: t.status === "active" ? "var(--aida-cyan-4)" : t.status === "completed" ? "var(--aida-text)" : "var(--aida-text-muted)" }}>{t.label}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* RIGHT STACK */}
        <div className="aida-right-stack" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="aida-panel" style={{ padding: 16, maxHeight: 340, overflow: "auto" }} aria-label="Live activity">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="aida-panel-title">› Live Activity</h3>
              <span style={{ fontSize: 10, background: liveConnected ? "var(--aida-success)" : "var(--aida-amber)", color: "#020812", padding: "2px 8px", borderRadius: 20 }}>● {liveConnected ? "Live" : "Offline"}</span>
            </div>
            {error ? <p className="aida-meta">{error}</p> : null}
            <div className="aida-feed" style={{ marginTop: 10 }}>
              {activity.length === 0 ? (
                <p className="aida-meta" style={{ fontFamily: "inherit" }}>
                  {isDisconnected ? "Engineering companion or Forge is not connected — no live events. Connect to begin." : "No events yet for the latest audit."}
                  {lastEventAt ? ` Last event ${lastEventAt}.` : ""}
                </p>
              ) : activity.map((a, i) => (
                <div className="aida-feed-row" key={`${a.time}-${i}`}>
                  <time>{a.time}</time>
                  <span>&gt; {a.msg}</span>
                </div>
              ))}
            </div>
            <p className="aida-meta" style={{ marginTop: 8, fontSize: 10 }}>Sanitised summaries only — no secrets, prompts or raw source.</p>
          </section>

          <section className="aida-panel" style={{ padding: 16 }} aria-label="Findings">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="aida-panel-title">Findings (Live)</h3>
              <span style={{ fontSize: 11, background: "rgba(31,159,233,0.15)", padding: "4px 10px", borderRadius: 20, color: "var(--aida-text)" }}>
                {totalFindings === null ? "no audit yet" : `${totalFindings} finding${totalFindings === 1 ? "" : "s"}`}
              </span>
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {findings.length === 0 ? (
                <p className="aida-meta">No verified findings yet. Findings appear here only from real audit reports with evidence.</p>
              ) : findings.map((f) => (
                <button key={f.id} type="button" className="aida-finding">
                  <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                    <span className="aida-sev" style={{ background: f.color }}>{f.id}</span>
                    <span style={{ background: f.bg, borderRadius: 6, padding: "2px 6px", fontSize: 11 }}>{f.count}</span>
                    <span>{f.label}</span>
                  </span>
                  <span aria-hidden>›</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* BOTTOM RIBBON — real pipeline state only, no timers */}
      <div className="aida-panel aida-ribbon" role="status" aria-label="Pipeline stages">
        {ribbon.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            <div className={`aida-stage${s.status === "active" && s.id === "THINKING" ? " active-thinking" : s.status === "active" ? " active" : s.status === "completed" ? " done" : ""}`} style={{ flex: 1 }}>
              {s.status === "completed" ? "✓ " : ""}{s.label}
            </div>
            {i < ribbon.length - 1 ? <span style={{ color: "var(--aida-border-strong)" }}>›</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
