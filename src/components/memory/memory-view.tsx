"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Plus, Trash2 } from "lucide-react";

type MemoryViewItem = {
  id: string;
  category: string;
  content: string;
  source: string;
  enabled: boolean;
  createdAt: string;
};

const CATEGORIES = [
  "user_preference",
  "organization_context",
  "project_context",
  "commitment",
  "decision",
  "short_lived",
] as const;

function categoryLabel(category: string): string {
  return category.replace(/_/g, " ");
}

export function MemoryView({ initialMemory }: { initialMemory: MemoryViewItem[] }) {
  const router = useRouter();
  const [memory, setMemory] = useState(initialMemory);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("user_preference");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, content }),
      });
      const data = (await response.json()) as {
        memory?: { id: string; category: string; content: string; source: string; enabled: boolean; createdAt: string };
        error?: { message?: string };
      };
      if (!response.ok || !data.memory) {
        setError(data.error?.message ?? "Could not save memory.");
        return;
      }
      setMemory((current) => [data.memory!, ...current]);
      setContent("");
      setMessage("Saved. It will be used only when memory is enabled for this workspace.");
      router.refresh();
    } catch {
      setError("Could not save memory.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(entry: MemoryViewItem) {
    setError("");
    setMessage("");
    const next = !entry.enabled;
    setMemory((current) => current.map((item) => (item.id === entry.id ? { ...item, enabled: next } : item)));
    try {
      const response = await fetch("/api/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, enabled: next }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: { message?: string } };
        setMemory((current) => current.map((item) => (item.id === entry.id ? { ...item, enabled: entry.enabled } : item)));
        setError(data.error?.message ?? "Could not update memory.");
        return;
      }
      router.refresh();
    } catch {
      setMemory((current) => current.map((item) => (item.id === entry.id ? { ...item, enabled: entry.enabled } : item)));
      setError("Could not update memory.");
    }
  }

  async function remove(entry: MemoryViewItem) {
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/memory?id=${entry.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json()) as { error?: { message?: string } };
        setError(data.error?.message ?? "Could not delete memory.");
        return;
      }
      setMemory((current) => current.filter((item) => item.id !== entry.id));
      setMessage("Memory deleted.");
      router.refresh();
    } catch {
      setError("Could not delete memory.");
    }
  }

  return (
    <div className="stack">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="banner info" role="status">{message}</div> : null}

      <form className="card stack" onSubmit={add}>
        <div>
          <h2 className="section-title">Add memory</h2>
          <p className="section-sub">Only save what you want the assistant to recall. It is per user and per tenant.</p>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="memory-category">Category</label>
            <select
              id="memory-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}
            >
              {CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {categoryLabel(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="memory-content">What should be remembered?</label>
            <input
              id="memory-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="e.g. Weekly leadership meeting is Monday at 08:30."
              required
              maxLength={1000}
            />
          </div>
        </div>
        <div>
          <button className="btn btn-primary" type="submit" disabled={busy || content.trim().length === 0}>
            <Plus size={15} /> {busy ? "Saving…" : "Save memory"}
          </button>
        </div>
      </form>

      {memory.length === 0 ? (
        <div className="empty">
          No memory yet. The assistant does not silently build a profile; add facts here or ask it to remember
          something explicitly.
        </div>
      ) : (
        <div className="list">
          {memory.map((entry) => (
            <div className="list-item" key={entry.id}>
              <div className="list-item-main">
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <Brain size={14} />
                  <span className="badge badge-muted">{categoryLabel(entry.category)}</span>
                  <span className={`badge ${entry.enabled ? "badge-green" : "badge-warn"}`}>
                    {entry.enabled ? "in use" : "disabled"}
                  </span>
                  <span className="badge badge-info">{entry.source.replace(/_/g, " ")}</span>
                </div>
                <div className="list-item-title" style={{ marginTop: 6 }}>
                  {entry.content}
                </div>
                <div className="list-item-meta">
                  Saved{" "}
                  {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
                    new Date(entry.createdAt),
                  )}
                </div>
              </div>
              <div className="list-item-actions">
                <button className="btn btn-sm" type="button" onClick={() => void toggle(entry)}>
                  {entry.enabled ? "Disable" : "Enable"}
                </button>
                <button className="btn btn-sm btn-danger" type="button" onClick={() => void remove(entry)}>
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
