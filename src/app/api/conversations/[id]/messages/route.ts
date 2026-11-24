import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { getConversation, listMessages } from "@/modules/conversations/service";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = correlationIdFor(request);
  try {
    const session = await requireApiSession();
    const { id } = await context.params;
    await getConversation(session.user.tenantId, session.user.id, id);
    const messages = await listMessages(session.user.tenantId, id);
    return NextResponse.json({ messages });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
