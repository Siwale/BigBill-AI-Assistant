import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { createConversation, listConversations } from "@/modules/conversations/service";

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    const session = await requireApiSession();
    const conversations = await listConversations(session.user.tenantId, session.user.id);
    return NextResponse.json({ conversations });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const conversation = await createConversation({
      tenantId: session.user.tenantId,
      userId: session.user.id,
    });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
