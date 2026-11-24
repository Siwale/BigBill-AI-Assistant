import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { getEffectiveAssistant, upsertUserAssistantConfig } from "@/modules/profile/user-config";

const identitySchema = z.object({
  displayName: z.string().min(1).max(40).optional(),
  pronouns: z.string().max(30).nullable().optional(),
  gender: z.enum(["female", "male", "non-binary", "neutral", "custom", "not_specified"]).nullable().optional(),
  presentation: z.string().max(40).nullable().optional(),
  personaDescription: z.string().max(200).nullable().optional(),
  voiceProvider: z.string().max(30).nullable().optional(),
  voiceId: z.string().max(200).nullable().optional(),
  voiceLocale: z.string().max(12).nullable().optional(),
  voiceRate: z.number().min(0.5).max(2).nullable().optional(),
});

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    const session = await requireApiSession();
    const effective = await getEffectiveAssistant(session.user.tenantId, session.user.id);
    return NextResponse.json({ effective });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, identitySchema);
    const updated = await upsertUserAssistantConfig({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.pronouns !== undefined ? { pronouns: input.pronouns } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}),
      ...(input.presentation !== undefined ? { presentation: input.presentation } : {}),
      ...(input.personaDescription !== undefined ? { personaDescription: input.personaDescription } : {}),
      ...(input.voiceProvider !== undefined ? { voiceProvider: input.voiceProvider } : {}),
      ...(input.voiceId !== undefined ? { voiceId: input.voiceId } : {}),
      ...(input.voiceLocale !== undefined ? { voiceLocale: input.voiceLocale } : {}),
      ...(input.voiceRate !== undefined ? { voiceRate: input.voiceRate } : {}),
      correlationId,
    });
    const effective = await getEffectiveAssistant(session.user.tenantId, session.user.id);
    return NextResponse.json({ config: updated, effective });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
