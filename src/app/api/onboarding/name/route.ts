import { NextResponse } from "next/server";
import { assistantNameSchema } from "@/contracts";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor, rateLimitOrThrow } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { setAssistantName } from "@/modules/profile/service";

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    rateLimitOrThrow(`name:${session.user.id}`, 10, 10 * 60_000);
    const input = await parseJson(request, assistantNameSchema);
    const profile = await setAssistantName({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      rawName: input.name,
      correlationId,
    });
    return NextResponse.json({
      ok: true,
      profile: { displayName: profile.displayName, onboardingCompletedAt: profile.onboardingCompletedAt },
    });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
