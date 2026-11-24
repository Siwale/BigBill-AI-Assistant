import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { incidents } from "@/db/schema";
import type { Incident } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/modules/audit/service";

export type Severity = "info" | "warning" | "critical";

export async function openIncident(params: {
  tenantId: string;
  severity?: Severity;
  title: string;
  description: string;
  impact?: string;
  evidence?: string;
  nextStep?: string;
  source?: string;
  dedupeKey?: string;
  correlationId?: string;
}): Promise<Incident> {
  if (params.dedupeKey) {
    const existing = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.tenantId, params.tenantId), eq(incidents.dedupeKey, params.dedupeKey)))
      .limit(1);
    if (existing[0]) return existing[0];
  }

  const [incident] = await db
    .insert(incidents)
    .values({
      tenantId: params.tenantId,
      severity: params.severity ?? "warning",
      title: params.title.slice(0, 200),
      description: params.description.slice(0, 2000),
      impact: params.impact?.slice(0, 1000) ?? null,
      evidence: params.evidence?.slice(0, 500) ?? null,
      nextStep: params.nextStep?.slice(0, 1000) ?? null,
      source: params.source ?? "assistant",
      dedupeKey: params.dedupeKey ?? null,
      correlationId: params.correlationId ?? null,
      status: "open",
    })
    .onConflictDoNothing()
    .returning();

  if (!incident) {
    // Lost a concurrent dedupe race: fetch the row that won.
    const rows = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.tenantId, params.tenantId), eq(incidents.dedupeKey, params.dedupeKey ?? "")))
      .limit(1);
    if (rows[0]) return rows[0];
    throw new ApiError(500, "Could not record the incident.", "incident_create_failed");
  }

  await recordAudit({
    tenantId: params.tenantId,
    eventType: "incident.opened",
    entityType: "incident",
    entityId: incident.id,
    metadata: { severity: incident.severity, title: incident.title, source: incident.source },
    correlationId: params.correlationId,
  });

  return incident;
}

export async function listIncidents(tenantId: string, limit = 50): Promise<Incident[]> {
  return db
    .select()
    .from(incidents)
    .where(eq(incidents.tenantId, tenantId))
    .orderBy(desc(incidents.createdAt))
    .limit(Math.min(limit, 100));
}

export async function openIncidentCount(tenantId: string): Promise<number> {
  const rows = await db
    .select({ id: incidents.id })
    .from(incidents)
    .where(and(eq(incidents.tenantId, tenantId), eq(incidents.status, "open")));
  return rows.length;
}

export async function actOnIncident(params: {
  tenantId: string;
  userId: string;
  id: string;
  action: "acknowledge" | "investigate" | "resolve";
  correlationId?: string;
}): Promise<Incident> {
  const rows = await db
    .select()
    .from(incidents)
    .where(and(eq(incidents.id, params.id), eq(incidents.tenantId, params.tenantId)))
    .limit(1);
  const incident = rows[0];
  if (!incident) throw new ApiError(404, "Incident not found.", "incident_not_found");
  if (incident.status === "resolved") return incident;

  const now = new Date();
  const patch =
    params.action === "acknowledge"
      ? { status: "acknowledged", acknowledgedAt: now, acknowledgedBy: params.userId }
      : params.action === "investigate"
        ? { status: "investigating" }
        : { status: "resolved", resolvedAt: now, acknowledgedBy: incident.acknowledgedBy ?? params.userId };

  const [updated] = await db
    .update(incidents)
    .set(patch)
    .where(and(eq(incidents.id, params.id), eq(incidents.tenantId, params.tenantId)))
    .returning();
  if (!updated) throw new ApiError(500, "Could not update the incident.", "incident_update_failed");

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: `incident.${params.action}`,
    entityType: "incident",
    entityId: updated.id,
    metadata: { severity: updated.severity },
    correlationId: params.correlationId,
  });
  return updated;
}
