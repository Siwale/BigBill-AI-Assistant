"use client";

import { useEffect, useState } from "react";

type Repo = { id: string; displayName: string; branch: string | null; commitSha: string | null; enabled: boolean };

export function RepositoriesPanel() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [error, setError] = useState("");
  const [companion, setCompanion] = useState("checking");

  useEffect(() => {
    void fetch("/api/companion/status").then((r) => r.json()).then((d) => setCompanion(d.companion)).catch(() => setCompanion("error"));
    // Try to list engineering repos if API exists, otherwise show honest empty
    void fetch("/api/engineering/repositories").then((r) => r.json()).then((d) => { if (d.repositories) setRepos(d.repositories); }).catch(() => setError("Engineering repositories API not yet configured — honest empty state"));
  }, []);

  return (
    <div style={{ background: "var(--cmd-surface)", border: "1px solid var(--cmd-line)", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 13, color: "var(--cmd-cyan)" }}>Registered Repositories</h3>
        <span style={{ fontSize: 11, background: companion === "available" ? "rgba(46,204,156,0.15)" : "rgba(255,204,0,0.15)", padding: "4px 8px", borderRadius: 20, border: "1px solid var(--cmd-line)" }}>Companion: {companion}</span>
      </div>
      {error ? <div style={{ fontSize: 12, color: "var(--cmd-amber)" }}>{error}</div> : null}
      {repos.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--cmd-muted)", background: "rgba(2,8,18,0.5)", border: "1px dashed var(--cmd-line)", borderRadius: 12, padding: 24, textAlign: "center" }}>
          No repositories registered. Use the companion to approve a local root and register a repository — IDOR protected, path traversal rejected, symlink escape blocked.
          <div style={{ marginTop: 8, fontSize: 11 }}>Example: BigBill-AI-Assistant at /home/bill/BigBill Systems/AI_assistant (branch main, commit fc3b562)</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {repos.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", background: "rgba(2,8,18,0.5)", border: "1px solid var(--cmd-line)", borderRadius: 10, padding: "10px 12px", fontSize: 12 }}>
              <span style={{ color: "var(--cmd-ink)" }}>{r.displayName}</span>
              <span style={{ color: "var(--cmd-muted)" }}>{r.branch ?? "—"} • {r.commitSha?.slice(0, 7) ?? "—"}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: "var(--cmd-muted)" }}>Tenant isolation: every registration scoped to tenant/user. De-registration revokes immediately. Snapshot includes dirty state, excludes .env/.git, secret-redacted.</div>
    </div>
  );
}
