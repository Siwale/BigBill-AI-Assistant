import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { recordAudit } from "@/modules/audit/service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const { id } = await context.params;
    const rows = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.tenantId, session.user.tenantId), eq(conversations.userId, session.user.id))).limit(1);
    const conv = rows[0];
    if (!conv) return NextResponse.json({ error: { code: "not_found", message: "Conversation not found" } }, { status: 404 });
    if (conv.archived) return NextResponse.json({ conversation: conv });
    const [updated] = await db.update(conversations).set({ archived: true, updatedAt: new Date() }).where(eq(conversations.id, id)).returning();
    // Create next active continuation internally
    const [next] = await db.insert(conversations).values({ tenantId: session.user.tenantId, userId: session.user.id, title: "Continuation", channel: "text", archived: false }).returning();
    await recordAudit({ tenantId: session.user.tenantId, actorUserId: session.user.id, eventType: "conversation.archived", entityType: "conversation", entityId: id, metadata: { nextId: next?.id }, correlationId });
    return NextResponse.json({ conversation: updated, next });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
