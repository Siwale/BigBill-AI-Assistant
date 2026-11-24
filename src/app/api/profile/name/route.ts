import { NextResponse } from "next/server";
import { assistantNameSchema } from "@/contracts";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireOwner } from "@/modules/auth/session";
import { setAssistantName } from "@/modules/profile/service";

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireOwner();
    const input = await parseJson(request, assistantNameSchema);
    const profile = await setAssistantName({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      rawName: input.name,
      correlationId,
    });
    return NextResponse.json({ ok: true, displayName: profile.displayName });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
