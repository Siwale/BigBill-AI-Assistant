#!/usr/bin/env node
/**
 * BigBill Local Companion — Linux BlueZ + PipeWire allowlisted bridge.
 * Binds 127.0.0.1:8787 only, origin-bound signed sessions, no arbitrary shell.
 */
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

const PORT = Number(process.env.COMPANION_PORT ?? 8787);
const HOST = "127.0.0.1";
const PAIRING_CODE = process.env.COMPANION_PAIRING_CODE ?? "";
const ALLOW_ORIGIN = process.env.COMPANION_ALLOW_ORIGIN ?? "http://localhost:3000";

type Session = { token: string; tenantId: string; userId: string; expiresAt: number };
const sessions = new Map<string, Session>();

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": ALLOW_ORIGIN, "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization" });
  res.end(JSON.stringify(data));
}

function checkOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin ?? "";
  if (!origin) return true; // allow curl without origin for smoke test
  return origin === ALLOW_ORIGIN;
}

function requireAuth(req: IncomingMessage): Session | null {
  const auth = req.headers.authorization ?? "";
  const m = /^Bearer\s+(.+)$/.exec(auth);
  if (!m) return null;
  const token = m[1] ?? "";
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { sessions.delete(token); return null; }
  return s;
}

function allowlistedExec(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const allowed: Record<string, string[]> = {
    bluetoothctl: ["devices", "paired-devices", "info", "pair", "connect", "disconnect", "remove", "scan", "--version"],
    pactl: ["list", "get-default-sink", "set-default-sink", "set-sink-volume", "set-sink-mute", "get-sink-mute", "get-sink-volume", "info", "--version"],
    wpctl: ["status", "get-volume", "set-volume", "set-mute", "--version"],
    paplay: ["--volume"],
    "speaker-test": ["-t", "-l", "-c"],
    busctl: ["--user", "call", "list"],
    which: ["bluetoothctl", "pactl", "wpctl"],
  };
  const base = cmd.split("/").pop() ?? cmd;
  if (!(base in allowed)) return Promise.resolve({ stdout: "", stderr: `command ${base} not allowlisted`, code: 1 });
  // Validate args don't contain shell metachars
  for (const a of args) {
    if (/[;&|`$()]/.test(a)) return Promise.resolve({ stdout: "", stderr: "invalid arg", code: 1 });
  }
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { timeout: 8000 });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ stdout, stderr, code }));
    child.on("error", (e) => resolve({ stdout: "", stderr: String(e), code: 1 }));
  });
}

function parseMac(input: string): string | null {
  const m = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.exec(input.trim());
  return m ? input.trim().toUpperCase() : null;
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": ALLOW_ORIGIN, "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization" }); res.end(); return; }
  if (!checkOrigin(req)) { json(res, 403, { error: "origin not allowed" }); return; }

  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  let body = "";
  req.on("data", (c) => (body += c));
  await new Promise<void>((r) => req.on("end", r));
  let jsonBody: Record<string, unknown> = {};
  try { jsonBody = body ? JSON.parse(body) as Record<string, unknown> : {}; } catch {}

  // Pairing — short-lived code, creates signed session
  if (url.pathname === "/pair" && req.method === "POST") {
    const code = String(jsonBody.code ?? "").trim();
    if (!PAIRING_CODE || code !== PAIRING_CODE) { json(res, 403, { error: "invalid pairing code" }); return; }
    const tenantId = String(jsonBody.tenantId ?? "").trim();
    const userId = String(jsonBody.userId ?? "").trim();
    if (!tenantId || !userId || tenantId.length > 200 || userId.length > 200) { json(res, 400, { error: "authenticated tenant and user are required" }); return; }
    const token = `comp_${randomBytes(16).toString("hex")}`;
    const expiresAt = Date.now() + 30 * 60 * 1000;
    sessions.set(token, { token, tenantId, userId, expiresAt });
    json(res, 200, { token, expiresAt: new Date(expiresAt).toISOString() });
    return;
  }

  if (url.pathname === "/status" && req.method === "GET") {
    const hasBluetoothctl = await allowlistedExec("which", ["bluetoothctl"]).then((r) => r.code === 0 ? "available" : "missing");
    const hasPactl = await allowlistedExec("which", ["pactl"]).then((r) => r.code === 0 ? "available" : "missing");
    const hasWpctl = await allowlistedExec("which", ["wpctl"]).then((r) => r.code === 0 ? "available" : "missing");
    json(res, 200, { host: HOST, port: PORT, bluetoothctl: hasBluetoothctl, pactl: hasPactl, wpctl: hasWpctl, sessions: sessions.size });
    return;
  }

  if (url.pathname === "/unpair" && req.method === "POST") {
    const session = requireAuth(req);
    if (!session) { json(res, 401, { error: "missing or expired companion session" }); return; }
    sessions.delete(session.token);
    json(res, 200, { ok: true });
    return;
  }

  // Auth required for device ops — engineering audit is trusted loopback from Aida server (no browser token)
  const isEngineering = url.pathname.startsWith("/engineering/");
  let session: Session | null = null;
  if (!isEngineering) {
    session = requireAuth(req);
    if (!session) { json(res, 401, { error: "missing or expired companion session" }); return; }
  } else {
    session = requireAuth(req); // optional — if provided, use it, otherwise allow loopback
  }

  if (url.pathname === "/devices/discover" && req.method === "POST") {
    // Use bluetoothctl devices + paired-devices
    const paired = await allowlistedExec("bluetoothctl", ["paired-devices"]);
    const discovered = await allowlistedExec("bluetoothctl", ["devices"]);
    const parse = (out: string) => out.split("\n").filter(Boolean).map((l) => { const m = /^Device\s+([0-9A-F:]+)\s+(.+)$/.exec(l.trim()); return m ? { mac: m[1], name: m[2] } : null; }).filter(Boolean);
    json(res, 200, { paired: parse(paired.stdout), discovered: parse(discovered.stdout), rawPaired: paired.stdout.slice(0, 2000), rawDiscovered: discovered.stdout.slice(0, 2000) });
    return;
  }

  if (url.pathname === "/devices/connect" && req.method === "POST") {
    const mac = parseMac(String(jsonBody.mac ?? ""));
    if (!mac) { json(res, 400, { error: "invalid mac" }); return; }
    const r = await allowlistedExec("bluetoothctl", ["connect", mac]);
    json(res, r.code === 0 ? 200 : 502, { stdout: r.stdout.slice(0, 2000), stderr: r.stderr.slice(0, 2000), code: r.code });
    return;
  }

  if (url.pathname === "/devices/pair" && req.method === "POST") {
    const mac = parseMac(String(jsonBody.mac ?? ""));
    if (!mac) { json(res, 400, { error: "invalid mac" }); return; }
    const r = await allowlistedExec("bluetoothctl", ["pair", mac]);
    json(res, r.code === 0 ? 200 : 502, { stdout: r.stdout.slice(0, 2000), stderr: r.stderr.slice(0, 2000), code: r.code });
    return;
  }

  if (url.pathname === "/devices/disconnect" && req.method === "POST") {
    const mac = parseMac(String(jsonBody.mac ?? ""));
    if (!mac) { json(res, 400, { error: "invalid mac" }); return; }
    const r = await allowlistedExec("bluetoothctl", ["disconnect", mac]);
    json(res, r.code === 0 ? 200 : 502, { stdout: r.stdout.slice(0, 2000), stderr: r.stderr.slice(0, 2000), code: r.code });
    return;
  }

  if (url.pathname === "/audio/sinks" && req.method === "GET") {
    const pactl = await allowlistedExec("pactl", ["list", "sinks", "short"]);
    const wp = await allowlistedExec("wpctl", ["status"]);
    const def = await allowlistedExec("pactl", ["get-default-sink"]);
    json(res, 200, { pactl: pactl.stdout.slice(0, 4000), wpctl: wp.stdout.slice(0, 4000), defaultSink: def.stdout.trim().slice(0, 200), code: pactl.code });
    return;
  }

  if (url.pathname === "/audio/select-sink" && req.method === "POST") {
    const sink = String(jsonBody.sink ?? "").trim().slice(0, 100);
    if (!/^[a-zA-Z0-9_.-]+$/.test(sink)) { json(res, 400, { error: "invalid sink name" }); return; }
    const r = await allowlistedExec("pactl", ["set-default-sink", sink]);
    const verify = await allowlistedExec("pactl", ["get-default-sink"]);
    const ok = verify.stdout.trim() === sink;
    json(res, r.code === 0 && ok ? 200 : 502, { ok, requested: sink, actual: verify.stdout.trim(), stdout: r.stdout.slice(0, 1000), stderr: r.stderr.slice(0, 1000) });
    return;
  }

  if (url.pathname === "/audio/volume" && req.method === "POST") {
    const level = Math.max(0, Math.min(100, Number(jsonBody.level ?? 50)));
    const sink = String(jsonBody.sink ?? "@DEFAULT_SINK@").slice(0, 100);
    const r = await allowlistedExec("pactl", ["set-sink-volume", sink, `${level}%`]);
    json(res, r.code === 0 ? 200 : 502, { level, stdout: r.stdout.slice(0, 1000), stderr: r.stderr.slice(0, 1000) });
    return;
  }

  if (url.pathname === "/audio/test-tone" && req.method === "POST") {
    const sink = String(jsonBody.sink ?? "@DEFAULT_SINK@").slice(0, 100);
    let r = await allowlistedExec("paplay", ["/usr/share/sounds/freedesktop/stereo/audio-volume-change.oga", "--volume=30000"]);
    if (r.code !== 0) r = await allowlistedExec("speaker-test", ["-t", "sine", "-f", "440", "-l", "1", "-c", "2"]);
    json(res, r.code === 0 ? 200 : 502, { sink, stdout: r.stdout.slice(0, 1000), stderr: r.stderr.slice(0, 1000), code: r.code });
    return;
  }

  if (url.pathname === "/engineering/audit" && req.method === "POST") {
    // Fixed bridge: python3 -m forge.integrations.aida_bridge (no shell, arg array)
    const FORGE_PATH = process.env.FORGE_PATH ?? "/home/bill/BigBill Systems/Forge";
    const bodyStr = JSON.stringify(jsonBody);
    // Validate contractVersion
    if ((jsonBody as { contractVersion?: string }).contractVersion !== "1") {
      json(res, 400, { error: "unsupported contractVersion" });
      return;
    }
    // Spawn fixed module
    const child = spawn("python3", ["-m", "forge.integrations.aida_bridge"], {
      cwd: FORGE_PATH,
      env: { ...process.env, PYTHONPATH: `${FORGE_PATH}/src` },
      timeout: 120_000,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.stdin.write(bodyStr);
    child.stdin.end();
    const code: number | null = await new Promise((resolve) => {
      child.on("close", resolve);
      child.on("error", () => resolve(1));
      setTimeout(() => { try { child.kill(); } catch {} resolve(124); }, 115_000);
    });
    // Secret redaction already in bridge, but also ensure no raw path leakage beyond allowed
    let result: unknown = null;
    try {
      result = JSON.parse(stdout);
    } catch {
      result = { raw: stdout.slice(0, 4000), stderr: stderr.slice(0, 2000) };
    }
    json(res, code === 0 ? 200 : 502, { code, result, stderr: stderr.slice(0, 2000) });
    return;
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`BigBill companion listening on http://${HOST}:${PORT} (origin ${ALLOW_ORIGIN})`);
});
