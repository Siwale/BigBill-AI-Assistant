"use client";
import { useEffect, useState } from "react";

type Fav = { id: string; provider: string; title: string; artist?: string | null };

export function MusicPanel() {
  const [favs, setFavs] = useState<Fav[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { void fetch("/api/music/favorites").then((r) => r.json()).then((d) => setFavs(d.favorites ?? [])).catch(()=>{}); }, []);
  async function add() {
    setError("");
    const res = await fetch("/api/music/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "local", itemType: "track", providerItemId: `local-${Date.now()}`, title }) });
    const data = await res.json() as { favorite?: Fav; error?: { message?: string } };
    if (!res.ok) { setError(data.error?.message ?? "Failed"); return; }
    if (data.favorite) setFavs((prev) => [data.favorite!, ...prev]);
    setTitle("");
  }
  return (
    <div className="stack">
      <div className="banner warn" style={{ fontSize: 13 }}>Spotify voice control is blocked by policy until written permission. Apple Music gated behind legal review. Use local or Home Assistant media.</div>
      {error ? <div className="error">{error}</div> : null}
      <div className="row"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Favorite title (local)" style={{ flex: 1 }} /><button className="btn btn-primary btn-sm" onClick={add} disabled={!title.trim()}>Add</button></div>
      <div className="list">{favs.length ? favs.map((f) => <div key={f.id} className="list-item"><span>{f.title} — {f.provider}{f.artist ? ` • ${f.artist}` : ""}</span></div>) : <div className="empty">No favorites yet.</div>}</div>
    </div>
  );
}
