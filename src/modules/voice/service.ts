import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { voiceSessions } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/modules/audit/service";
import { getConversation } from "@/modules/conversations/service";

export async function startVoiceSession(params: {
  tenantId: string;
  userId: string;
  conversationId: string;
  mode: "browser" | "server";
  correlationId?: string;
}) {
  await getConversation(params.tenantId, params.userId, params.conversationId);
  const [session] = await db
    .insert(voiceSessions)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      conversationId: params.conversationId,
      mode: params.mode,
      status: "active",
      metadata: { initiatedBy: "explicit_user_action" },
    })
    .returning();
  if (!session) throw new ApiError(500, "Could not start the voice session.", "voice_session_failed");

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "voice.session_started",
    entityType: "voice_session",
    entityId: session.id,
    metadata: { mode: session.mode },
    correlationId: params.correlationId,
  });
  return session;
}

export async function endVoiceSession(params: {
  tenantId: string;
  userId: string;
  id: string;
  correlationId?: string;
}) {
  const [session] = await db
    .update(voiceSessions)
    .set({ status: "ended", endedAt: new Date() })
    .where(
      and(
        eq(voiceSessions.id, params.id),
        eq(voiceSessions.tenantId, params.tenantId),
        eq(voiceSessions.userId, params.userId),
      ),
    )
    .returning();
  if (!session) throw new ApiError(404, "Voice session not found.", "voice_session_not_found");

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "voice.session_ended",
    entityType: "voice_session",
    entityId: session.id,
    metadata: { mode: session.mode },
    correlationId: params.correlationId,
  });
  return session;
}

export async function listVoiceSessions(tenantId: string, userId: string, limit = 20) {
  return db
    .select()
    .from(voiceSessions)
    .where(and(eq(voiceSessions.tenantId, tenantId), eq(voiceSessions.userId, userId)))
    .orderBy(voiceSessions.startedAt)
    .limit(limit);
}
