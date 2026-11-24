import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { visualSessions } from "@/db/schema";
import type { VisualSession } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/modules/audit/service";

export async function createVisualSession(params: {
  tenantId: string;
  userId: string;
  conversationId?: string | null;
  source: string;
  sampleIntervalMs?: number;
  maxDurationMs?: number;
  correlationId?: string;
}): Promise<VisualSession> {
  const allowed = ["camera", "screen", "upload"];
  if (!allowed.includes(params.source)) throw new ApiError(400, "Invalid source", "invalid_source");
  const interval = params.sampleIntervalMs ?? 2000;
  if (interval < 500 || interval > 10000) throw new ApiError(400, "Invalid interval", "invalid_interval");
  const maxDur = params.maxDurationMs ?? 120000;
  if (maxDur < 30000 || maxDur > 600000) throw new ApiError(400, "Invalid duration", "invalid_duration");
  if (params.conversationId) {
    const { conversations } = await import("@/db/schema");
    const rows = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, params.conversationId), eq(conversations.tenantId, params.tenantId)))
      .limit(1);
    if (!rows[0]) throw new ApiError(404, "Conversation not found", "conversation_not_found");
  }
  const [created] = await db
    .insert(visualSessions)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      conversationId: params.conversationId ?? null,
      source: params.source,
      status: "active",
      sampleIntervalMs: interval,
      maxDurationMs: maxDur,
      sampleCount: 0,
    })
    .returning();
  if (!created) throw new ApiError(500, "Could not create session", "visual_failed");
  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "visual.session_started",
    entityType: "visual_session",
    entityId: created.id,
    metadata: { source: params.source },
    correlationId: params.correlationId,
  });
  return created;
}

export async function listVisualSessions(tenantId: string, userId: string): Promise<VisualSession[]> {
  return db
    .select()
    .from(visualSessions)
    .where(and(eq(visualSessions.tenantId, tenantId), eq(visualSessions.userId, userId)))
    .orderBy(desc(visualSessions.createdAt))
    .limit(20);
}

export async function stopVisualSession(params: { tenantId: string; userId: string; sessionId: string; reason?: string; correlationId?: string }): Promise<VisualSession> {
  const rows = await db
    .select()
    .from(visualSessions)
    .where(and(eq(visualSessions.id, params.sessionId), eq(visualSessions.tenantId, params.tenantId), eq(visualSessions.userId, params.userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError(404, "Session not found", "visual_not_found");
  if (row.status !== "active") return row;
  const [updated] = await db
    .update(visualSessions)
    .set({ status: "stopped", endedAt: new Date(), endedReason: params.reason ?? "user_request" })
    .where(eq(visualSessions.id, row.id))
    .returning();
  if (!updated) throw new ApiError(500, "Stop failed", "visual_stop_failed");
  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "visual.session_stopped",
    entityType: "visual_session",
    entityId: updated.id,
    metadata: { reason: params.reason ?? "user_request" },
    correlationId: params.correlationId,
  });
  return updated;
}
