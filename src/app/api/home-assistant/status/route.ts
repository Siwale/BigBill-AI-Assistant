import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { haHealthCheck, haStatus } from "@/modules/home-assistant/service";

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    await requireApiSession();
    const status = haStatus();
    let health: Awaited<ReturnType<typeof haHealthCheck>> | null = null;
    if (status.status === "configured") health = await haHealthCheck();
    return NextResponse.json({ ha: status, health, honest: status.status === "not_configured" ? "Home Assistant optional hub — not connected. Provide OAuth to enable media_player/camera/sensor typed actions." : "Home Assistant credentials present — verify health." });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
