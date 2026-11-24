"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, Unplug } from "lucide-react";

type ScopeView = {
  id: string;
  label: string;
  description: string;
  risk: string;
  enabled: boolean;
};

type ConnectionView = {
  id: string;
  name: string;
  description: string;
  state: string;
  stateNote: string;
  connected: boolean;
  grantedScopes: string[];
  grantedAt: string | null;
  scopes: ScopeView[];
};

const STATE_LABEL: Record<string, string> = {
  available: "Available",
  draft_only: "Drafts only",
  needs_credentials: "Not connected",
  unavailable: "Unavailable",
};

const STATE_CLASS: Record<string, string> = {
  available: "badge-green",
  draft_only: "badge-info",
  needs_credentials: "badge-warn",
  unavailable: "badge-muted",
};

export function PermissionsView({ initialConnections }: { initialConnections: ConnectionView[] }) {
  const router = useRouter();
  const [connections, setConnections] = useState(initialConnections);
  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(initialConnections.map((connection) => [connection.id, connection.grantedScopes])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function toggleScope(connectionId: string, scopeId: string) {
    setSelected((current) => {
      const active = current[connectionId] ?? [];
      return {
        ...current,
        [connectionId]: active.includes(scopeId)
          ? active.filter((id) => id !== scopeId)
          : [...active, scopeId],
      };
    });
  }

  async function save(connection: ConnectionView) {
    setError("");
    setMessage("");
    const scopes = selected[connection.id] ?? [];
    if (scopes.length === 0) {
      await revoke(connection);
      return;
    }
    setBusy(connection.id);
    try {
      const response = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorId: connection.id, scopes }),
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setError(data.error?.message ?? "Could not save permissions.");
        return;
      }
      setConnections((current) =>
        current.map((item) =>
          item.id === connection.id
            ? { ...item, connected: true, grantedScopes: scopes, grantedAt: new Date().toISOString() }
            : item,
        ),
      );
      setMessage(`${connection.name} permissions updated.`);
      router.refresh();
    } catch {
      setError("Could not save permissions.");
    } finally {
      setBusy(null);
    }
  }

  async function revoke(connection: ConnectionView) {
    setError("");
    setMessage("");
    setBusy(connection.id);
    try {
      const response = await fetch("/api/permissions?action=revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorId: connection.id }),
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setError(data.error?.message ?? "Could not revoke permissions.");
        return;
      }
      setConnections((current) =>
        current.map((item) =>
          item.id === connection.id ? { ...item, connected: false, grantedScopes: [], grantedAt: null } : item,
        ),
      );
      setSelected((current) => ({ ...current, [connection.id]: [] }));
      setMessage(`${connection.name} permissions revoked.`);
      router.refresh();
    } catch {
      setError("Could not revoke permissions.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="banner info" role="status">{message}</div> : null}
      <div className="banner warn">
        <strong>Deny by default.</strong> Sending email or WhatsApp, publishing, spending and destructive
        actions are disabled in Loop 1. BOS, Khapy and MotherTracker are not connected.
      </div>

      {connections.map((connection) => {
        const grantable = connection.state === "available" || connection.state === "draft_only";
        const active = selected[connection.id] ?? [];
        return (
          <section className="connector-card" key={connection.id}>
            <div className="connector-head">
              <div>
                <h3>{connection.name}</h3>
                <div className="row" style={{ marginTop: 6, gap: 7 }}>
                  <span className={`badge ${STATE_CLASS[connection.state] ?? "badge-muted"}`}>
                    {STATE_LABEL[connection.state] ?? connection.state}
                  </span>
                  {connection.connected ? (
                    <span className="badge badge-green">
                      <ShieldCheck size={11} /> granted
                    </span>
                  ) : (
                    <span className="badge badge-muted">no grant</span>
                  )}
                </div>
              </div>
              {!grantable ? (
                <span className="badge badge-warn">
                  <Unplug size={11} /> {STATE_LABEL[connection.state]}
                </span>
              ) : null}
            </div>
            <p className="connector-note">{connection.description}</p>
            <p className="connector-note" style={{ color: "var(--ink-soft)" }}>
              {connection.stateNote}
            </p>

            <div>
              {connection.scopes.map((scope) => (
                <label
                  key={scope.id}
                  className="scope-row"
                  style={{ opacity: scope.enabled && grantable ? 1 : 0.6 }}
                >
                  <input
                    type="checkbox"
                    checked={active.includes(scope.id)}
                    disabled={!scope.enabled || !grantable || busy === connection.id}
                    onChange={() => toggleScope(connection.id, scope.id)}
                  />
                  <span>
                    <span className="scope-label">
                      {scope.label} <span className="badge badge-muted">{scope.risk}</span>
                      {!scope.enabled ? (
                        <span className="badge badge-warn" style={{ marginLeft: 6 }}>
                          <Lock size={10} /> disabled
                        </span>
                      ) : null}
                    </span>
                    <span className="scope-desc">{scope.description}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="row" style={{ marginTop: 14 }}>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={() => void save(connection)}
                disabled={!grantable || busy === connection.id}
              >
                {busy === connection.id ? "Saving…" : "Save permissions"}
              </button>
              {connection.connected ? (
                <button
                  className="btn btn-sm btn-danger"
                  type="button"
                  onClick={() => void revoke(connection)}
                  disabled={busy === connection.id}
                >
                  Revoke all
                </button>
              ) : null}
              {connection.grantedAt ? (
                <span className="tiny muted">
                  Granted {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(connection.grantedAt))}
                </span>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
