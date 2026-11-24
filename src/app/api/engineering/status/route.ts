import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    await requireApiSession();
    // Honest: Forge local checkout availability check
    let forge: string = "not_configured";
    try {
      const { existsSync } = await import("node:fs");
      if (existsSync("/home/bill/BigBill Systems/Forge/src/forge/api/main.py")) forge = "available";
    } catch {}
    return NextResponse.json({ forge, companion: "use /api/companion/status for live companion state", honest: forge === "not_configured" ? "Forge not connected — install local checkout at /home/bill/BigBill Systems/Forge" : "Forge available" });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
