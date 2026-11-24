import { NextResponse } from "next/server";
import { signupSchema } from "@/contracts";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { clientIp, correlationIdFor, rateLimitOrThrow } from "@/lib/api-utils";
import { createWorkspace } from "@/modules/auth/service";
import { setSessionCookie } from "@/modules/auth/session";

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    rateLimitOrThrow(`signup:${clientIp(request)}`, 8, 15 * 60_000);
    const input = await parseJson(request, signupSchema);
    const user = await createWorkspace({ ...input, correlationId });
    await setSessionCookie(user);
    return NextResponse.json({ ok: true, redirect: "/onboarding" }, { status: 201 });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
