import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { getObservation } from "@/modules/vision/service";
import { addMessage, getConversation } from "@/modules/conversations/service";

const schema = z.object({
  observationId: z.string().uuid(),
  conversationId: z.string().uuid(),
});

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, schema);
    // verify observation belongs to tenant/user and conversation belongs to same tenant
    const obs = await getObservation(session.user.tenantId, session.user.id, input.observationId);
    await getConversation(session.user.tenantId, session.user.id, input.conversationId);
    // bring observation into conversation as a system-visible message
    const content = `Observation from ${obs.sourceType} (${obs.mimeType}, ${obs.byteSize} bytes) at ${obs.createdAt.toISOString()}:\n${obs.analysis ?? "No analysis available."}`;
    const msg = await addMessage({
      tenantId: session.user.tenantId,
      conversationId: input.conversationId,
      role: "assistant",
      content,
      channel: "text",
    });
    return NextResponse.json({ message: msg, observation: obs });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
