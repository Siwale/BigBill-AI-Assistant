import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { endVoiceSession, startVoiceSession } from "@/modules/voice/service";

const sessionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    conversationId: z.string().uuid(),
    mode: z.enum(["browser", "server"]).default("browser"),
  }),
  z.object({ action: z.literal("end"), sessionId: z.string().uuid() }),
]);

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, sessionSchema);
    if (input.action === "start") {
      const voice = await startVoiceSession({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        conversationId: input.conversationId,
        mode: input.mode ?? "browser",
        correlationId,
      });
      return NextResponse.json({ voiceSession: voice }, { status: 201 });
    }
    const voice = await endVoiceSession({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      id: input.sessionId,
      correlationId,
    });
    return NextResponse.json({ voiceSession: voice });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
