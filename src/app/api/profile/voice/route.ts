import { NextResponse } from "next/server";
import { voiceConfigSchema } from "@/contracts";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireOwner } from "@/modules/auth/session";
import { updateVoiceConfig } from "@/modules/profile/service";

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireOwner();
    const input = await parseJson(request, voiceConfigSchema);
    const profile = await updateVoiceConfig({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      config: input,
      correlationId,
    });
    return NextResponse.json({ ok: true, voiceConfig: profile.voiceConfig });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
