import { z } from "zod";

export function haStatus(): { status: string; note: string; instanceUrl: string | null } {
  const url = process.env.HOME_ASSISTANT_URL ?? null;
  const token = process.env.HOME_ASSISTANT_TOKEN ?? null;
  if (!url || !token) return { status: "not_configured", note: "Home Assistant not connected. Set HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN (OAuth long-lived token) and verify instance.", instanceUrl: null };
  return { status: "configured", note: "Home Assistant credentials present — verify via GET /api/ status and WebSocket.", instanceUrl: url };
}

export async function haHealthCheck(): Promise<{ ok: boolean; status: number; text: string }> {
  const url = process.env.HOME_ASSISTANT_URL;
  const token = process.env.HOME_ASSISTANT_TOKEN;
  if (!url || !token) return { ok: false, status: 0, text: "not_configured" };
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000) });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, text: text.slice(0, 500) };
  } catch (e) {
    return { ok: false, status: 0, text: e instanceof Error ? e.message : String(e) };
  }
}

export const haEntitySchema = z.object({ entity_id: z.string(), state: z.string(), attributes: z.record(z.unknown()).optional() });
