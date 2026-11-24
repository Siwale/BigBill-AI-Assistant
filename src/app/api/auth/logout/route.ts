import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { clearSessionCookie } from "@/modules/auth/session";

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    await clearSessionCookie();
    return NextResponse.json({ ok: true, redirect: "/login" });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
