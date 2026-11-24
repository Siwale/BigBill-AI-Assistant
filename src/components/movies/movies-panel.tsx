"use client";
import { useEffect, useState } from "react";

type WatchlistEntry = { id: string; title: string; provider: string; year?: number | null };
type Prefs = { regionCode: string; favoriteGenres: string[] };

export function MoviesPanel() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [title, setTitle] = useState("");
  const [gate, setGate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/movies/preferences").then((r) => r.json()).then((d) => setPrefs(d.preferences)).catch(()=>{});
    void fetch("/api/movies/watchlist").then((r) => r.json()).then((d) => { setWatchlist(d.watchlist ?? []); setGate(d.availability?.note ?? ""); }).catch(()=>{});
  }, []);

  async function add() {
    setError("");
    const res = await fetch("/api/movies/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerTitleId: `manual-${Date.now()}`, title }) });
    const data = await res.json() as { entry?: WatchlistEntry; error?: { message?: string } };
    if (!res.ok) { setError(data.error?.message ?? "Failed"); return; }
    if (data.entry) setWatchlist((prev) => [data.entry!, ...prev]);
    setTitle("");
  }

  return (
    <div className="stack">
      {gate ? <div className="banner info" style={{ fontSize: 12 }}>{gate}</div> : null}
      <div className="tiny muted">Region: {prefs?.regionCode ?? "ZM"} • Genres: {prefs?.favoriteGenres?.join(", ") || "none"}</div>
      {error ? <div className="error">{error}</div> : null}
      <div className="row"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add film (manual until licensed TMDB)" style={{ flex: 1 }} /><button className="btn btn-primary btn-sm" onClick={add} disabled={!title.trim()}>Add to watchlist</button></div>
      <div className="list">{watchlist.length ? watchlist.map((w) => <div key={w.id} className="list-item"><span>{w.title} ({w.year ?? "—"}) — {w.provider}</span></div>) : <div className="empty">Watchlist empty. Search official services for legal watch options.</div>}</div>
    </div>
  );
}
