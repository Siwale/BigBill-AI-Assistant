import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEvents } from "@/db/schema";
import { log } from "@/lib/logger";

export type AuditInput = {
  tenantId: string;
  actorUserId?: string | null;
  eventType: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
};

function scrub(metadata: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (/token|secret|password|authorization|cookie/i.test(key)) continue;
    if (typeof value === "string" && value.length > 500) {
      result[key] = `${value.slice(0, 500)}…`;
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Append-only from the application. There is intentionally no update/delete API. */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: scrub(input.metadata ?? {}),
      correlationId: input.correlationId ?? null,
    });
  } catch (error) {
    // An audit write failure must be visible, but must not crash the user's
    // request silently. The caller still receives its normal result.
    log("error", "audit_write_failed", {
      eventType: input.eventType,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function listAuditEvents(tenantId: string, limit = 100) {
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.tenantId, tenantId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(Math.min(limit, 200));
}
