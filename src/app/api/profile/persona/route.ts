import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireOwner } from "@/modules/auth/session";
import { updatePersona } from "@/modules/profile/service";

const personaSchema = z.object({
  tone: z.string().trim().max(60).optional(),
  greetingStyle: z.string().trim().max(120).optional(),
});

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireOwner();
    const input = await parseJson(request, personaSchema);
    const profile = await updatePersona({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      tone: input.tone,
      greetingStyle: input.greetingStyle,
      correlationId,
    });
    return NextResponse.json({ ok: true, persona: profile.personaConfig });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
