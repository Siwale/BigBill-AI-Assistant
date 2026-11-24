import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { correlationIdFor, rateLimitOrThrow } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { runAssistantTurn } from "@/modules/assistant/orchestrator";

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  delegationId: z.string().min(5).max(100),
  transcript: z.string().min(1).max(4000),
  idempotencyKey: z.string().min(5).max(100).optional(),
});

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    rateLimitOrThrow(`live-delegation:${session.user.id}`, 20, 60_000);

    const raw = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "invalid_body", message: "Invalid delegation payload." } }, { status: 400 });
    }
    const { conversationId, transcript, delegationId } = parsed.data;

    // Validate conversation ownership
    const { getConversation } = await import("@/modules/conversations/service");
    await getConversation(session.user.tenantId, session.user.id, conversationId);

    // Idempotency: if same delegationId already processed, return cached result
    const { db } = await import("@/db/client");
    const { auditEvents } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const existing = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.tenantId, session.user.tenantId), eq(auditEvents.entityId, delegationId)))
      .limit(1);
    if (existing[0]?.metadata && typeof (existing[0].metadata as Record<string, unknown>).result === "string") {
      const cached = (existing[0].metadata as Record<string, unknown>).result as string;
      return NextResponse.json({ delegationId, result: cached, cached: true, correlationId });
    }

    const outcome = await runAssistantTurn({
      session,
      conversationId,
      message: transcript,
      channel: "voice",
      correlationId,
    });

    // Persist delegation result idempotently via audit (not as separate message duplication)
    const { recordAudit } = await import("@/modules/audit/service");
    await recordAudit({
      tenantId: session.user.tenantId,
      actorUserId: session.user.id,
      eventType: "live.delegation_completed",
      entityType: "live_delegation",
      entityId: delegationId,
      metadata: { conversationId, transcript: transcript.slice(0, 200), result: outcome.content.slice(0, 8000) },
      correlationId,
    });

    return NextResponse.json({
      delegationId,
      result: outcome.content,
      citations: outcome.citations,
      toolActivity: outcome.toolActivity,
      correlationId,
    });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
