"use client";

import { useCallback, useEffect, useState } from "react";

type Device = { mac: string; name: string };
type Discovery = { paired: Device[]; discovered: Device[] };
type Props = { tenantId: string; userId: string };
const BASE = "http://127.0.0.1:8787";
const TOKEN_KEY = "aida.local-companion.session";

export function BluetoothCompanion({ tenantId, userId }: Props) {
  const [token, setToken] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [status, setStatus] = useState("checking");
  const [devices, setDevices] = useState<Discovery>({ paired: [], discovered: [] });
  const [sinks, setSinks] = useState<Array<{ id: string; name: string }>>([]);
  const [defaultSink, setDefaultSink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const request = useCallback(async (path: string, method: "GET" | "POST", body?: Record<string, unknown>) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error(String(data.error ?? `Companion request failed (${res.status})`));
    return data;
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    try {
      const saved = sessionStorage.getItem(TOKEN_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { token: string; expiresAt: string };
        if (Date.parse(parsed.expiresAt) > Date.now()) setToken(parsed.token);
        else sessionStorage.removeItem(TOKEN_KEY);
      }
    } catch { sessionStorage.removeItem(TOKEN_KEY); }
    void fetch(`${BASE}/status`).then((r) => r.json()).then((d: { bluetoothctl?: string }) => { if (!cancelled) setStatus(d.bluetoothctl === "available" ? "available" : "bluetooth unavailable"); }).catch(() => { if (!cancelled) setStatus("local companion unavailable"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!token) return;
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() }));
  }, [token]);

  const pairCompanion = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch(`${BASE}/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: pairingCode, tenantId, userId }) });
      const data = await res.json() as { token?: string; expiresAt?: string; error?: string };
      if (!res.ok || !data.token) throw new Error(data.error ?? "Pairing failed. Check the pairing code and companion origin.");
      setToken(data.token);
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: data.token, expiresAt: data.expiresAt }));
      setPairingCode(""); setMessage("Local companion paired for this browser session (30 minutes).");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not pair local companion."); }
    finally { setBusy(false); }
  };

  const discover = async () => {
    setBusy(true); setError("");
    try {
      const [found, audio] = await Promise.all([request("/devices/discover", "POST"), request("/audio/sinks", "GET")]);
      const parsed = found as unknown as Discovery;
      setDevices({ paired: parsed.paired ?? [], discovered: parsed.discovered ?? [] });
      const pactl = String(audio.pactl ?? "");
      const parsedSinks = pactl.split("\n").filter(Boolean).map((line) => {
        const columns = line.trim().split(/\s+/);
        return columns.length >= 2 ? { id: columns[1]!, name: columns.slice(1).join(" ") } : null;
      }).filter((item): item is { id: string; name: string } => Boolean(item));
      setSinks(parsedSinks); setDefaultSink(String(audio.defaultSink ?? ""));
      setMessage(`Found ${parsed.discovered?.length ?? 0} nearby and ${parsed.paired?.length ?? 0} paired Bluetooth device(s).`);
    } catch (e) { setError(e instanceof Error ? e.message : "Discovery failed."); }
    finally { setBusy(false); }
  };

  const deviceAction = async (action: "pair" | "connect" | "disconnect", device: Device) => {
    setBusy(true); setError("");
    try {
      await request(`/devices/${action}`, "POST", { mac: device.mac });
      setMessage(`${action[0]!.toUpperCase()}${action.slice(1)} request sent for ${device.name}.`);
      await discover();
    } catch (e) { setError(e instanceof Error ? e.message : `Could not ${action} device.`); }
    finally { setBusy(false); }
  };

  const selectSink = async (sink: string) => {
    setBusy(true); setError("");
    try { await request("/audio/select-sink", "POST", { sink }); setDefaultSink(sink); setMessage(`Default audio output set to ${sink}.`); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not select output."); }
    finally { setBusy(false); }
  };

  const unpair = async () => {
    setBusy(true); setError("");
    try { await request("/unpair", "POST"); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not revoke companion session."); }
    finally { setToken(""); sessionStorage.removeItem(TOKEN_KEY); setDevices({ paired: [], discovered: [] }); setSinks([]); setMessage("Local companion session revoked."); setBusy(false); }
  };

  return <section className="card stack" aria-label="Bluetooth audio companion">
    <div className="spread"><h3 className="section-title">Bluetooth audio · local companion</h3><span className="badge">{token ? "paired for this session" : status}</span></div>
    <p className="tiny muted">Uses the Linux computer running Aida’s local companion (BlueZ and PipeWire). Pairing and device changes happen only when you press a control.</p>
    {error ? <div className="error" role="alert">{error}</div> : null}
    {message ? <div className="banner info" role="status">{message}</div> : null}
    {!token ? <div className="row" style={{ flexWrap: "wrap" }}><label className="field" style={{ flex: "1 1 220px" }}>Companion pairing code<input type="password" autoComplete="off" value={pairingCode} onChange={(e) => setPairingCode(e.target.value)} placeholder="Enter local pairing code" /></label><button className="btn btn-primary btn-sm" type="button" disabled={busy || !pairingCode.trim() || status !== "available"} onClick={() => void pairCompanion()}>Pair companion</button></div> : <>
      <div className="row"><button className="btn btn-sm" type="button" disabled={busy} onClick={() => void discover()}>Discover devices & audio outputs</button><button className="btn btn-sm btn-ghost" type="button" disabled={busy} onClick={() => void unpair()}>Disconnect companion</button></div>
      <div className="stack" style={{ gap: 8 }}>{[...devices.paired, ...devices.discovered.filter((d) => !devices.paired.some((p) => p.mac === d.mac))].map((device) => <div className="spread" key={device.mac} style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}><span>{device.name}<small className="muted" style={{ display: "block" }}>{device.mac}</small></span><div className="row">{!devices.paired.some((p) => p.mac === device.mac) ? <button className="btn btn-sm" disabled={busy} onClick={() => void deviceAction("pair", device)}>Pair device</button> : null}<button className="btn btn-sm btn-primary" disabled={busy} onClick={() => void deviceAction("connect", device)}>Connect</button><button className="btn btn-sm" disabled={busy} onClick={() => void deviceAction("disconnect", device)}>Disconnect</button></div></div>)}</div>
      <label className="field">System audio output<select disabled={busy || !sinks.length} value={defaultSink} onChange={(e) => void selectSink(e.target.value)}><option value="">Discover outputs first</option>{sinks.map((sink) => <option key={sink.id} value={sink.id}>{sink.name}</option>)}</select></label>
    </>}
  </section>;
}
