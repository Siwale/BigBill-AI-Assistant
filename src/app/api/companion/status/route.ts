import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    await requireApiSession();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch("http://127.0.0.1:8787/status", { signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`companion status ${res.status}`);
      const data = await res.json() as Record<string, unknown>;
      return NextResponse.json({ companion: "available", details: data, honest: "Companion reachable on 127.0.0.1:8787 — Bluetooth audio via BlueZ/PipeWire allowlisted." });
    } catch {
      clearTimeout(t);
      return NextResponse.json({ companion: "not_installed", honest: "Companion not running on 127.0.0.1:8787 — install and run `pnpm --prefix companion dev` for Bluetooth audio. Browser audio via setSinkId still works where supported." });
    }
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
