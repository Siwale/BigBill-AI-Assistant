import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor, rateLimitOrThrow } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { synthesizeSpeech } from "@/modules/assistant/model";
import { getAssistantProfile } from "@/modules/profile/service";

export const runtime = "nodejs";

const speakSchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    rateLimitOrThrow(`tts:${session.user.id}`, 20, 60_000);
    const input = await parseJson(request, speakSchema);
    const profile = await getAssistantProfile(session.user.tenantId);
    const audio = await synthesizeSpeech(input.text, profile.voiceConfig.voiceId);
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Correlation-Id": correlationId,
      },
    });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
