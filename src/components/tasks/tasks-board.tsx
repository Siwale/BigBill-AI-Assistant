"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Plus, RotateCcw } from "lucide-react";

type TaskView = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: string;
  status: string;
  source: string;
  createdAt: string;
};

const FILTERS = ["all", "open", "in_progress", "done", "cancelled"] as const;

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "badge-danger",
  high: "badge-warn",
  normal: "badge-muted",
  low: "badge-muted",
};

function statusLabel(status: string): string {
  return status.replace("_", " ");
}

function dueLabel(dueAt: string | null): string {
  if (!dueAt) return "No due date";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(dueAt));
}

export function TasksBoard({ initialTasks }: { initialTasks: TaskView[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const visible = tasks.filter((task) => filter === "all" || task.status === filter);
  const now = Date.now();

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          ...(description.trim() ? { description } : {}),
          ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
          priority,
        }),
      });
      const data = (await response.json()) as { task?: TaskView; error?: { message?: string } };
      if (!response.ok || !data.task) {
        setError(data.error?.message ?? "Could not create the task.");
        return;
      }
      setTasks((previous) => [
        { ...data.task!, createdAt: data.task!.createdAt ?? new Date().toISOString() },
        ...previous,
      ]);
      setTitle("");
      setDescription("");
      setDueAt("");
      setPriority("normal");
      setShowForm(false);
      router.refresh();
    } catch {
      setError("Could not create the task.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(task: TaskView, status: string) {
    setError("");
    const previous = tasks;
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status } : item)));
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: { message?: string } };
        setTasks(previous);
        setError(data.error?.message ?? "Could not update the task.");
        return;
      }
      router.refresh();
    } catch {
      setTasks(previous);
      setError("Could not update the task.");
    }
  }

  return (
    <div className="stack">
      <div className="spread">
        <div className="filter-tabs" style={{ marginBottom: 0 }}>
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className={`filter-tab${filter === option ? " active" : ""}`}
              onClick={() => setFilter(option)}
            >
              {option === "all" ? "All" : statusLabel(option)}
              <span style={{ marginLeft: 6, opacity: 0.7 }}>
                {option === "all" ? tasks.length : tasks.filter((task) => task.status === option).length}
              </span>
            </button>
          ))}
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setShowForm(!showForm)}>
          <Plus size={15} /> {showForm ? "Close" : "New task"}
        </button>
      </div>

      {error ? <div className="error" role="alert">{error}</div> : null}

      {showForm ? (
        <form className="card stack" onSubmit={createTask}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="task-title">Task</label>
              <input
                id="task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What needs to happen?"
                required
                maxLength={200}
              />
            </div>
            <div className="field">
              <label htmlFor="task-due">Due</label>
              <input
                id="task-due"
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="task-description">Detail (optional)</label>
            <textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              placeholder="Context, owner or next step."
            />
          </div>
          <div className="row">
            <div className="field" style={{ maxWidth: 200 }}>
              <label htmlFor="task-priority">Priority</label>
              <select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Create task"}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {visible.length === 0 ? (
        <div className="empty">
          No tasks in this view. Ask your assistant to track something, or add one directly.
        </div>
      ) : (
        <div className="list">
          {visible.map((task) => {
            const overdue =
              task.dueAt &&
              new Date(task.dueAt).getTime() < now &&
              task.status !== "done" &&
              task.status !== "cancelled";
            return (
              <div className="list-item" key={task.id}>
                <div className="list-item-main">
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span className="list-item-title">{task.title}</span>
                    <span className={`badge ${PRIORITY_CLASS[task.priority] ?? "badge-muted"}`}>
                      {task.priority}
                    </span>
                    <span className={`badge ${task.status === "done" ? "badge-green" : overdue ? "badge-danger" : "badge-muted"}`}>
                      {statusLabel(task.status)}
                    </span>
                    {overdue ? <span className="badge badge-danger">overdue</span> : null}
                  </div>
                  {task.description ? <div className="list-item-meta">{task.description}</div> : null}
                  <div className="list-item-meta row" style={{ gap: 6 }}>
                    <CalendarClock size={12} /> {dueLabel(task.dueAt)} · {task.source === "assistant" ? "created by assistant" : "added by you"}
                  </div>
                </div>
                <div className="list-item-actions">
                  {task.status === "open" ? (
                    <button className="btn btn-sm" type="button" onClick={() => void updateStatus(task, "in_progress")}>
                      Start
                    </button>
                  ) : null}
                  {task.status !== "done" && task.status !== "cancelled" ? (
                    <button className="btn btn-sm btn-primary" type="button" onClick={() => void updateStatus(task, "done")}>
                      <Check size={13} /> Done
                    </button>
                  ) : (
                    <button className="btn btn-sm" type="button" onClick={() => void updateStatus(task, "open")}>
                      <RotateCcw size={13} /> Reopen
                    </button>
                  )}
                  {task.status !== "cancelled" && task.status !== "done" ? (
                    <button className="btn btn-sm btn-ghost" type="button" onClick={() => void updateStatus(task, "cancelled")}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
