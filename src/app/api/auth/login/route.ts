import { NextResponse } from "next/server";
import { loginSchema } from "@/contracts";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { clientIp, correlationIdFor, rateLimitOrThrow } from "@/lib/api-utils";
import { authenticate } from "@/modules/auth/service";
import { setSessionCookie } from "@/modules/auth/session";

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    rateLimitOrThrow(`login:${clientIp(request)}`, 10, 5 * 60_000);
    const input = await parseJson(request, loginSchema);
    const user = await authenticate({ ...input, correlationId });
    await setSessionCookie(user);
    return NextResponse.json({ ok: true, redirect: "/app" });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
