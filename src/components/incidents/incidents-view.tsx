"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Search } from "lucide-react";

type IncidentView = {
  id: string;
  severity: string;
  title: string;
  description: string;
  impact: string | null;
  evidence: string | null;
  nextStep: string | null;
  source: string;
  status: string;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
};

const SEVERITY_CLASS: Record<string, string> = {
  critical: "badge-danger",
  warning: "badge-warn",
  info: "badge-info",
};

export function IncidentsView({ incidents }: { incidents: IncidentView[] }) {
  const router = useRouter();
  const [items, setItems] = useState(incidents);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"open" | "all">("open");

  const visible = filter === "open" ? items.filter((item) => item.status !== "resolved") : items;

  async function act(incident: IncidentView, action: "acknowledge" | "investigate" | "resolve") {
    setBusy(incident.id);
    setError("");
    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: incident.id, action }),
      });
      const data = (await response.json()) as {
        incident?: { status: string; acknowledgedAt: string | null; resolvedAt: string | null };
        error?: { message?: string };
      };
      if (!response.ok || !data.incident) {
        setError(data.error?.message ?? "Could not update the incident.");
        return;
      }
      setItems((current) =>
        current.map((item) =>
          item.id === incident.id
            ? {
                ...item,
                status: data.incident!.status,
                acknowledgedAt: data.incident!.acknowledgedAt,
                resolvedAt: data.incident!.resolvedAt,
              }
            : item,
        ),
      );
      router.refresh();
    } catch {
      setError("Could not update the incident.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      <div className="spread">
        <div className="filter-tabs" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`filter-tab${filter === "open" ? " active" : ""}`}
            onClick={() => setFilter("open")}
          >
            Open {items.filter((item) => item.status !== "resolved").length}
          </button>
          <button
            type="button"
            className={`filter-tab${filter === "all" ? " active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All {items.length}
          </button>
        </div>
      </div>

      {error ? <div className="error" role="alert">{error}</div> : null}

      {visible.length === 0 ? (
        <div className="empty">
          {filter === "open"
            ? "No open incidents. The assistant will record a problem here if a model, voice or tool step fails."
            : "No incidents have been recorded in this workspace."}
        </div>
      ) : (
        <div className="list">
          {visible.map((incident) => (
            <div className="list-item" key={incident.id}>
              <div className="list-item-main">
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <span className={`badge ${SEVERITY_CLASS[incident.severity] ?? "badge-muted"}`}>
                    {incident.severity}
                  </span>
                  <span className="list-item-title">{incident.title}</span>
                  <span className={`badge ${incident.status === "resolved" ? "badge-green" : "badge-muted"}`}>
                    {incident.status}
                  </span>
                </div>
                <div className="list-item-meta">{incident.description}</div>
                {incident.impact ? (
                  <div className="list-item-meta">
                    <strong>Impact:</strong> {incident.impact}
                  </div>
                ) : null}
                {incident.nextStep ? (
                  <div className="list-item-meta">
                    <strong>Next step:</strong> {incident.nextStep}
                  </div>
                ) : null}
                {incident.evidence ? (
                  <div className="list-item-meta mono">{incident.evidence}</div>
                ) : null}
                <div className="list-item-meta">
                  {incident.source} ·{" "}
                  {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
                    new Date(incident.createdAt),
                  )}
                </div>
              </div>
              <div className="list-item-actions">
                {incident.status === "open" ? (
                  <button
                    className="btn btn-sm"
                    type="button"
                    onClick={() => void act(incident, "acknowledge")}
                    disabled={busy === incident.id}
                  >
                    <AlertTriangle size={12} /> Acknowledge
                  </button>
                ) : null}
                {incident.status !== "resolved" ? (
                  <>
                    <button
                      className="btn btn-sm"
                      type="button"
                      onClick={() => void act(incident, "investigate")}
                      disabled={busy === incident.id}
                    >
                      <Search size={12} /> Investigating
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      type="button"
                      onClick={() => void act(incident, "resolve")}
                      disabled={busy === incident.id}
                    >
                      <CheckCircle2 size={12} /> Resolve
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
