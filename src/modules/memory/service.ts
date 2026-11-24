import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memoryEntries } from "@/db/schema";
import type { MemoryEntry } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { looksLikeSecret } from "@/lib/security/text";
import { recordAudit } from "@/modules/audit/service";

export const MEMORY_CATEGORIES = [
  "user_preference",
  "organization_context",
  "project_context",
  "commitment",
  "decision",
  "short_lived",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export async function createMemory(params: {
  tenantId: string;
  userId: string;
  category: MemoryCategory;
  content: string;
  source?: string;
  correlationId?: string;
}): Promise<MemoryEntry> {
  const content = params.content.trim();
  if (!content) throw new ApiError(400, "Memory content is empty.", "memory_empty");
  if (looksLikeSecret(content)) {
    throw new ApiError(
      400,
      "That looks like a credential or secret. The assistant does not store secrets in memory.",
      "memory_secret_rejected",
    );
  }
  const [entry] = await db
    .insert(memoryEntries)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      category: params.category,
      content,
      source: params.source ?? "explicit_user_request",
    })
    .returning();
  if (!entry) throw new ApiError(500, "Could not save memory.", "memory_create_failed");

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "memory.created",
    entityType: "memory_entry",
    entityId: entry.id,
    metadata: { category: entry.category, source: entry.source },
    correlationId: params.correlationId,
  });
  return entry;
}

export async function listMemory(tenantId: string, userId: string): Promise<MemoryEntry[]> {
  return db
    .select()
    .from(memoryEntries)
    .where(and(eq(memoryEntries.tenantId, tenantId), eq(memoryEntries.userId, userId)))
    .orderBy(asc(memoryEntries.category), asc(memoryEntries.createdAt));
}

export async function listEnabledMemory(tenantId: string, userId: string, limit = 30): Promise<MemoryEntry[]> {
  return db
    .select()
    .from(memoryEntries)
    .where(
      and(
        eq(memoryEntries.tenantId, tenantId),
        eq(memoryEntries.userId, userId),
        eq(memoryEntries.enabled, true),
      ),
    )
    .orderBy(asc(memoryEntries.createdAt))
    .limit(limit);
}

export async function updateMemory(params: {
  tenantId: string;
  userId: string;
  id: string;
  content?: string;
  enabled?: boolean;
  correlationId?: string;
}): Promise<MemoryEntry> {
  if (params.content !== undefined && looksLikeSecret(params.content)) {
    throw new ApiError(400, "That looks like a credential or secret.", "memory_secret_rejected");
  }
  const [updated] = await db
    .update(memoryEntries)
    .set({
      ...(params.content !== undefined ? { content: params.content.trim() } : {}),
      ...(params.enabled !== undefined ? { enabled: params.enabled } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(memoryEntries.id, params.id),
        eq(memoryEntries.tenantId, params.tenantId),
        eq(memoryEntries.userId, params.userId),
      ),
    )
    .returning();
  if (!updated) throw new ApiError(404, "Memory entry not found.", "memory_not_found");

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: params.enabled === false ? "memory.disabled" : "memory.updated",
    entityType: "memory_entry",
    entityId: updated.id,
    metadata: { category: updated.category },
    correlationId: params.correlationId,
  });
  return updated;
}

export async function deleteMemory(params: {
  tenantId: string;
  userId: string;
  id: string;
  correlationId?: string;
}): Promise<void> {
  const deleted = await db
    .delete(memoryEntries)
    .where(
      and(
        eq(memoryEntries.id, params.id),
        eq(memoryEntries.tenantId, params.tenantId),
        eq(memoryEntries.userId, params.userId),
      ),
    )
    .returning({ id: memoryEntries.id });
  if (deleted.length === 0) throw new ApiError(404, "Memory entry not found.", "memory_not_found");

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "memory.deleted",
    entityType: "memory_entry",
    entityId: params.id,
    metadata: {},
    correlationId: params.correlationId,
  });
}
