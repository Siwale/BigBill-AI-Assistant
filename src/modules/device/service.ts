import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { devicePreferences } from "@/db/schema";
import type { DevicePreference } from "@/db/schema";
import { recordAudit } from "@/modules/audit/service";

export async function getDevicePreference(tenantId: string, userId: string): Promise<DevicePreference | null> {
  const rows = await db
    .select()
    .from(devicePreferences)
    .where(and(eq(devicePreferences.tenantId, tenantId), eq(devicePreferences.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertDevicePreference(params: {
  tenantId: string;
  userId: string;
  preferredInputLabel?: string | null;
  preferredOutputLabel?: string | null;
  lastTestResult?: Record<string, unknown>;
  correlationId?: string;
}): Promise<DevicePreference> {
  const existing = await getDevicePreference(params.tenantId, params.userId);
  if (existing) {
    const [updated] = await db
      .update(devicePreferences)
      .set({
        ...(params.preferredInputLabel !== undefined ? { preferredInputLabel: params.preferredInputLabel } : {}),
        ...(params.preferredOutputLabel !== undefined ? { preferredOutputLabel: params.preferredOutputLabel } : {}),
        ...(params.lastTestResult ? { lastTestResult: params.lastTestResult, lastTestAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(devicePreferences.id, existing.id))
      .returning();
    if (updated) {
      await recordAudit({
        tenantId: params.tenantId,
        actorUserId: params.userId,
        eventType: "device.preference_updated",
        entityType: "device_preference",
        entityId: updated.id,
        metadata: { hasInput: Boolean(params.preferredInputLabel), hasOutput: Boolean(params.preferredOutputLabel) },
        correlationId: params.correlationId,
      });
      return updated;
    }
  }
  const [created] = await db
    .insert(devicePreferences)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      preferredInputLabel: params.preferredInputLabel ?? null,
      preferredOutputLabel: params.preferredOutputLabel ?? null,
      lastTestResult: params.lastTestResult ?? {},
      lastTestAt: params.lastTestResult ? new Date() : null,
    })
    .returning();
  if (!created) throw new Error("device preference create failed");
  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "device.preference_created",
    entityType: "device_preference",
    entityId: created.id,
    metadata: {},
    correlationId: params.correlationId,
  });
  return created;
}
