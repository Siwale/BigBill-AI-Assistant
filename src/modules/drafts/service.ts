import { desc, eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { drafts } from "@/db/schema";
import type { Draft } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/modules/audit/service";

export const DRAFT_KINDS = ["email", "whatsapp", "social", "marketing_plan", "khapy_brief"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export async function createDraft(params: {
  tenantId: string;
  userId: string;
  conversationId?: string | null;
  kind: DraftKind;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}): Promise<Draft> {
  const body = params.body.trim();
  if (!body) throw new ApiError(400, "A draft cannot be empty.", "draft_empty");
  if (body.length > 30_000) throw new ApiError(400, "Draft is too long.", "draft_too_long");

  const [draft] = await db
    .insert(drafts)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      conversationId: params.conversationId ?? null,
      kind: params.kind,
      title: params.title.trim().slice(0, 200) || "Untitled draft",
      body,
      metadata: params.metadata ?? {},
    })
    .returning();
  if (!draft) throw new ApiError(500, "Could not save the draft.", "draft_create_failed");

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "draft.created",
    entityType: "draft",
    entityId: draft.id,
    metadata: { kind: draft.kind, title: draft.title },
    correlationId: params.correlationId,
  });
  return draft;
}

export async function listDrafts(tenantId: string, userId: string, limit = 50): Promise<Draft[]> {
  return db
    .select()
    .from(drafts)
    .where(and(eq(drafts.tenantId, tenantId), eq(drafts.userId, userId)))
    .orderBy(desc(drafts.createdAt))
    .limit(Math.min(limit, 100));
}

export async function getDraft(tenantId: string, userId: string, id: string): Promise<Draft> {
  const rows = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.id, id), eq(drafts.tenantId, tenantId), eq(drafts.userId, userId)))
    .limit(1);
  const draft = rows[0];
  if (!draft) throw new ApiError(404, "Draft not found.", "draft_not_found");
  return draft;
}
