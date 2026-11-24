"use client";

import { useState } from "react";
import { Activity } from "lucide-react";

type EventView = {
  id: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  actorUserId: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export function ActivityView({ events }: { events: EventView[] }) {
  const [filter, setFilter] = useState("");
  const visible = filter.trim()
    ? events.filter((event) =>
        `${event.eventType} ${event.entityType ?? ""} ${event.entityId ?? ""}`
          .toLowerCase()
          .includes(filter.trim().toLowerCase()),
      )
    : events;

  return (
    <div className="stack">
      <div className="spread">
        <div className="field" style={{ maxWidth: 360 }}>
          <label htmlFor="activity-filter">Filter events</label>
          <input
            id="activity-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="e.g. permission, task, voice"
          />
        </div>
        <span className="badge badge-muted">{visible.length} events</span>
      </div>

      {visible.length === 0 ? (
        <div className="empty">No audit events match.</div>
      ) : (
        <div className="list">
          {visible.map((event) => (
            <div className="list-item" key={event.id}>
              <div className="list-item-main">
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <Activity size={13} />
                  <span className="badge badge-info">{event.eventType}</span>
                  {event.entityType ? <span className="badge badge-muted">{event.entityType}</span> : null}
                  <span className="tiny muted">
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "medium",
                    }).format(new Date(event.createdAt))}
                  </span>
                </div>
                <div className="list-item-meta mono">
                  {event.entityId ? `entity ${event.entityId}` : "no entity"}
                  {event.correlationId ? ` · correlation ${event.correlationId}` : ""}
                </div>
                {Object.keys(event.metadata).length > 0 ? (
                  <div className="code-block" style={{ marginTop: 8, maxHeight: 180 }}>
                    {JSON.stringify(event.metadata, null, 2)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
