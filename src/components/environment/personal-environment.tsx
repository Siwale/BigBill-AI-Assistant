"use client";

import { useEffect, useState } from "react";
import { VisionPanel } from "@/components/vision/vision-panel";
import { DevicePanel } from "@/components/device/device-panel";

type MusicFav = { id: string; title: string; provider: string };
type WatchlistEntry = { id: string; title: string; provider: string };

export function PersonalEnvironment() {
  const [music, setMusic] = useState<MusicFav[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [musicGate, setMusicGate] = useState<string>("");
  const [movieGate, setMovieGate] = useState<string>("");
  const [visualStatus] = useState<string>("idle");

  useEffect(() => {
    void fetch("/api/music/favorites").then((r) => r.json()).then((d) => { if (d.favorites) setMusic(d.favorites); if (d.gates) setMusicGate(JSON.stringify(d.gates)); }).catch(()=>{});
    void fetch("/api/movies/watchlist").then((r) => r.json()).then((d) => { if (d.watchlist) setWatchlist(d.watchlist); if (d.availability) setMovieGate(d.availability.note ?? ""); }).catch(()=>{});
  }, []);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="card">
        <h3 className="section-title">Vision</h3>
        <p className="tiny muted">One-shot + bounded sessions (1 frame/2s, 2-min limit, transient retention). GPT-Live does not see images directly — vision backend provides grounded observations.</p>
        <VisionPanel conversationId={null} />
        <div className="tiny muted" style={{ marginTop: 8 }}>Status: {visualStatus} — raw frames not persisted by default.</div>
      </section>

      <section className="card">
        <h3 className="section-title">Devices</h3>
        <p className="tiny muted">Capability registry: unsupported → available → permission_required → pairing → paired → connecting → connected → selected → active. Web Bluetooth is BLE GATT only — not A2DP speakers. Use OS companion for Bluetooth audio.</p>
        <DevicePanel />
      </section>

      <section className="card">
        <h3 className="section-title">Music</h3>
        <p className="tiny muted">Local library + Home Assistant media first. Spotify voice blocked until written permission. Apple Music gated behind legal review.</p>
        {musicGate ? <pre className="code-block" style={{ fontSize: 12 }}>{musicGate}</pre> : null}
        <div className="tiny">Favorites: {music.length ? music.map((m) => `${m.title} (${m.provider})`).join(", ") : "none"}</div>
        <p className="tiny muted">Play uses allowlisted `music.play` only on permitted adapters; no copyrighted bytes sent to model or uploaded.</p>
      </section>

      <section className="card">
        <h3 className="section-title">Movies</h3>
        <p className="tiny muted">Search + taste preferences + watchlist. Region default ZM. TMDB commercial license required; JustWatch partner contract required — otherwise official search handoff, availability unverified.</p>
        {movieGate ? <div className="banner info" style={{ fontSize: 12 }}>{movieGate}</div> : null}
        <div className="tiny">Watchlist: {watchlist.length ? watchlist.map((w) => w.title).join(", ") : "empty"}</div>
      </section>
    </div>
  );
}
