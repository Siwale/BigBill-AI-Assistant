"use client";

import { useEffect, useState } from "react";

type Connection = { provider: string; mediaSource: string; status: string; statusNote: string; lastSyncAt: string | null };
type Meeting = {
  id: string;
  provider: string;
  title: string;
  meetingUrl?: string | null;
  attendees: string[];
  status: string;
  transcriptSource?: string | null;
  createdAt: string;
};
type Segment = { id: string; speaker?: string | null; text: string; startMs?: number | null };
type Candidate = {
  id: string;
  title: string;
  description?: string | null;
  proposedOwner?: string | null;
  dueAt?: string | null;
  priority: string;
  confidence: string;
  status: string;
  evidenceQuote?: string | null;
  evidenceSegmentIds: string[];
};

export function MeetingCentre() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("manual");
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [newSpeaker, setNewSpeaker] = useState("");
  const [newText, setNewText] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [companionStream, setCompanionStream] = useState<MediaStream | null>(null);
  const [companionError, setCompanionError] = useState("");

  const load = async () => {
    const res = await fetch("/api/meetings");
    const data = (await res.json()) as { meetings?: Meeting[]; connections?: Connection[]; error?: { message?: string } };
    if (data.meetings) setMeetings(data.meetings);
    if (data.connections) setConnections(data.connections);
  };

  useEffect(() => {
    void load();
  }, []);

  const createMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, provider }),
    });
    const data = (await res.json()) as { meeting?: Meeting; error?: { message?: string } };
    if (!res.ok) {
      setError(data.error?.message ?? "Could not create meeting.");
      return;
    }
    setTitle("");
    setMessage("Meeting created. Add transcript segments, then extract.");
    void load();
  };

  const openMeeting = async (m: Meeting) => {
    setSelected(m);
    setSegments([]);
    setCandidates([]);
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/meetings/${m.id}/segments`).then((r) => r.json() as Promise<{ segments?: Segment[] }>),
      fetch(`/api/meetings/${m.id}/candidates`).then((r) => r.json() as Promise<{ candidates?: Candidate[] }>).catch(() => ({ candidates: [] as Candidate[] })),
    ]);
    if (sRes.segments) setSegments(sRes.segments);
    if (cRes.candidates) setCandidates(cRes.candidates);
  };

  const addSegment = async () => {
    if (!selected || !newText.trim()) return;
    setError("");
    const res = await fetch(`/api/meetings/${selected.id}/segments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments: [{ speaker: newSpeaker || undefined, text: newText }] }),
    });
    const data = (await res.json()) as { segments?: Segment[]; error?: { message?: string } };
    if (!res.ok) {
      setError(data.error?.message ?? "Could not add segment.");
      return;
    }
    setNewText("");
    const list = await fetch(`/api/meetings/${selected.id}/segments`).then((r) => r.json() as Promise<{ segments?: Segment[] }>);
    if (list.segments) setSegments(list.segments);
  };

  const extract = async () => {
    if (!selected) return;
    setError("");
    setMessage("Extracting…");
    const res = await fetch(`/api/meetings/${selected.id}/extract`, { method: "POST" });
    const data = (await res.json()) as { candidates?: Candidate[]; error?: { message?: string } };
    if (!res.ok) {
      setError(data.error?.message ?? "Extraction failed. Ensure transcript exists and model is configured.");
      setMessage("");
      return;
    }
    setCandidates(data.candidates ?? []);
    setMessage(`Extracted ${data.candidates?.length ?? 0} candidates. Review and approve to create tasks.`);
  };

  const act = async (c: Candidate, action: "approve" | "reject" | "defer") => {
    setError("");
    const res = await fetch(`/api/meetings/${selected?.id}/candidates/${c.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = (await res.json()) as { candidate?: Candidate; error?: { message?: string } };
    if (!res.ok) {
      setError(data.error?.message ?? "Action failed.");
      return;
    }
    setCandidates((prev) => prev.map((x) => (x.id === c.id ? (data.candidate ?? x) : x)));
    if (action === "approve") setMessage(`Approved “${c.title}” — task created.`);
  };

  return (
    <div className="stack">
      <div className="banner warn">
        Meeting capture is explicit and visible. The assistant is only “listening” when a live media source is actually connected. Live Zoom requires RTMS with approved credits; Google Meet artifacts are post-meeting via REST/Drive.
      </div>

      <div className="grid-3">
        {connections.map((c) => (
          <div key={c.provider} className="card">
            <h4 style={{ textTransform: "capitalize" }}>{c.provider.replace("_", " ")}</h4>
            <span className={`badge ${c.status === "not_connected" ? "badge-warn" : c.status.includes("live") ? "badge-green" : "badge-info"}`}>{c.status}</span>
            <p className="tiny muted" style={{ marginTop: 8 }}>{c.statusNote}</p>
            <p className="tiny muted">Media: {c.mediaSource}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="section-title">Browser companion (honest live fallback)</h3>
        <p className="tiny muted">Join your Zoom/Meet call normally, then share the meeting tab/window here. The app receives only what you explicitly share; tab audio is Chromium-supported and may be unavailable in Firefox.</p>
        {companionError ? <div className="error" role="alert">{companionError}</div> : null}
        <div className="row" style={{ marginTop: 8 }}>
          {!companionStream ? (
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={async () => {
                setCompanionError("");
                try {
                  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true } as DisplayMediaStreamOptions);
                  setCompanionStream(stream);
                  stream.getVideoTracks().forEach((t) => {
                    t.onended = () => setCompanionStream(null);
                  });
                  stream.getAudioTracks().forEach((t) => {
                    t.onended = () => setCompanionError("Audio track ended.");
                  });
                } catch (e) {
                  const err = e as DOMException;
                  if (err.name === "NotAllowedError") setCompanionError("Share cancelled or permission denied.");
                  else setCompanionError(`Companion failed: ${err.message || err.name}. Tab audio may not be supported in this browser.`);
                }
              }}
            >
              Start companion — share meeting tab
            </button>
          ) : (
            <button
              className="btn btn-sm btn-danger"
              type="button"
              onClick={() => {
                companionStream.getTracks().forEach((t) => t.stop());
                setCompanionStream(null);
              }}
            >
              Stop companion
            </button>
          )}
          <span className={`badge ${companionStream ? "badge-green" : "badge-muted"}`}>{companionStream ? "capturing" : "not capturing"}</span>
        </div>
        {companionStream ? (
          <div style={{ marginTop: 8, border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
            <video
              ref={(el) => {
                if (el && companionStream) {
                  el.srcObject = companionStream;
                  void el.play().catch(() => undefined);
                }
              }}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", maxHeight: 240, objectFit: "contain", background: "#060e0b" }}
            />
            <p className="tiny muted" style={{ padding: 6 }}>Preview of the shared source. Only this media is available to the assistant. Stop to end capture. Audio tracks: {companionStream.getAudioTracks().length} (0 means tab audio was not shared — use manual transcript entry below).</p>
          </div>
        ) : null}
      </div>

      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="banner info" role="status">{message}</div> : null}

      <form className="card stack" onSubmit={createMeeting}>
        <h3 className="section-title">New meeting</h3>
        <div className="grid-2">
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly ops review" required />
          </div>
          <div className="field">
            <label>Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="manual">Manual / browser companion</option>
              <option value="zoom">Zoom</option>
              <option value="google_meet">Google Meet</option>
              <option value="browser_companion">Browser companion</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" type="submit">Create meeting</button>
      </form>

      <div className="grid-2">
        <div className="card stack">
          <h3 className="section-title">Meetings</h3>
          {meetings.length === 0 ? <div className="empty">No meetings yet.</div> : (
            <div className="list">
              {meetings.map((m) => (
                <button key={m.id} type="button" onClick={() => void openMeeting(m)} className={`list-item ${selected?.id === m.id ? "active" : ""}`} style={{ textAlign: "left", cursor: "pointer" }}>
                  <div className="list-item-main">
                    <div className="list-item-title">{m.title}</div>
                    <div className="list-item-meta">{m.provider} · {m.status} · {new Date(m.createdAt).toLocaleString()}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card stack">
          <h3 className="section-title">Transcript & extraction</h3>
          {!selected ? <div className="empty">Select a meeting.</div> : (
            <>
              <p className="tiny muted">Add segments with speaker and timestamp evidence. Extraction will cite S IDs.</p>
              <div className="grid-2">
                <input placeholder="Speaker (optional)" value={newSpeaker} onChange={(e) => setNewSpeaker(e.target.value)} />
                <input placeholder="Text" value={newText} onChange={(e) => setNewText(e.target.value)} />
              </div>
              <div className="row">
                <button className="btn btn-sm" type="button" onClick={addSegment}>Add segment</button>
                <button className="btn btn-primary btn-sm" type="button" onClick={extract}>Extract decisions & actions</button>
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
                {segments.length === 0 ? <span className="tiny muted">No segments.</span> : segments.map((s, i) => (
                  <div key={s.id} className="tiny" style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
                    <strong>[S{i + 1} {s.speaker ?? "unknown"}]</strong> {s.text}
                  </div>
                ))}
              </div>

              {candidates.length > 0 ? (
                <div className="stack">
                  <h4>Candidates (approve to create task)</h4>
                  {candidates.map((c) => (
                    <div key={c.id} className="card" style={{ padding: 12 }}>
                      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                        <strong>{c.title}</strong>
                        <span className="badge">{c.priority}</span>
                        <span className="badge badge-muted">{c.status}</span>
                        <span className="badge badge-info">conf {c.confidence}</span>
                      </div>
                      {c.evidenceQuote ? <p className="tiny muted" style={{ marginTop: 4 }}>Evidence: “{c.evidenceQuote}” [{c.evidenceSegmentIds.join(", ")}]</p> : null}
                      <div className="row" style={{ marginTop: 6 }}>
                        <button className="btn btn-primary btn-sm" type="button" onClick={() => void act(c, "approve")} disabled={c.status !== "proposed"}>Approve → task</button>
                        <button className="btn btn-sm" type="button" onClick={() => void act(c, "defer")}>Defer</button>
                        <button className="btn btn-sm btn-ghost" type="button" onClick={() => void act(c, "reject")}>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
