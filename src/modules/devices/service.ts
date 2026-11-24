import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { deviceConnections } from "@/db/schema";
import type { DeviceConnection } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/modules/audit/service";
import { createHash } from "node:crypto";

export async function listDevices(tenantId: string, userId: string): Promise<DeviceConnection[]> {
  return db
    .select()
    .from(deviceConnections)
    .where(and(eq(deviceConnections.tenantId, tenantId), eq(deviceConnections.userId, userId)))
    .orderBy(desc(deviceConnections.updatedAt))
    .limit(100);
}

export async function registerDevice(params: {
  tenantId: string;
  userId: string;
  adapter: string;
  transport: string;
  deviceClass: string;
  providerDeviceId: string;
  displayName: string;
  friendlyName?: string;
  capabilities: string[];
  status?: string;
  diagnostic?: string;
  correlationId?: string;
}): Promise<DeviceConnection> {
  if (params.providerDeviceId.length > 500) throw new ApiError(400, "Device ID too long", "invalid_device_id");
  const hash = createHash("sha256").update(params.providerDeviceId).digest("hex").slice(0, 32);
  const existing = await db
    .select()
    .from(deviceConnections)
    .where(
      and(
        eq(deviceConnections.tenantId, params.tenantId),
        eq(deviceConnections.userId, params.userId),
        eq(deviceConnections.providerDeviceIdHash, hash),
      ),
    )
    .limit(1);
  if (existing[0]) {
    const [updated] = await db
      .update(deviceConnections)
      .set({
        adapter: params.adapter,
        transport: params.transport,
        deviceClass: params.deviceClass,
        displayName: params.displayName,
        friendlyName: params.friendlyName ?? existing[0].friendlyName,
        capabilities: params.capabilities,
        status: params.status ?? existing[0].status,
        diagnostic: params.diagnostic ?? existing[0].diagnostic,
        updatedAt: new Date(),
        lastSeenAt: new Date(),
      })
      .where(eq(deviceConnections.id, existing[0].id))
      .returning();
    return updated ?? existing[0];
  }
  const [created] = await db
    .insert(deviceConnections)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      adapter: params.adapter,
      transport: params.transport,
      deviceClass: params.deviceClass,
      providerDeviceIdHash: hash,
      displayName: params.displayName,
      friendlyName: params.friendlyName ?? null,
      capabilities: params.capabilities,
      status: params.status ?? "available",
      diagnostic: params.diagnostic ?? null,
      lastSeenAt: new Date(),
    })
    .returning();
  if (!created) throw new ApiError(500, "Could not register device", "device_failed");
  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "device.registered",
    entityType: "device_connection",
    entityId: created.id,
    metadata: { adapter: params.adapter, deviceClass: params.deviceClass },
    correlationId: params.correlationId,
  });
  return created;
}

export async function updateDeviceStatus(params: {
  tenantId: string;
  userId: string;
  deviceId: string;
  status: string;
  diagnostic?: string;
  correlationId?: string;
}): Promise<DeviceConnection> {
  const rows = await db
    .select()
    .from(deviceConnections)
    .where(
      and(
        eq(deviceConnections.id, params.deviceId),
        eq(deviceConnections.tenantId, params.tenantId),
        eq(deviceConnections.userId, params.userId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError(404, "Device not found", "device_not_found");
  const allowed = [
    "unsupported",
    "available",
    "permission_required",
    "pairing",
    "paired",
    "connecting",
    "connected",
    "selected",
    "active",
    "disconnected",
    "error",
  ];
  if (!allowed.includes(params.status)) throw new ApiError(400, "Invalid status", "invalid_status");
  const [updated] = await db
    .update(deviceConnections)
    .set({ status: params.status, diagnostic: params.diagnostic ?? row.diagnostic, updatedAt: new Date(), lastSeenAt: new Date() })
    .where(eq(deviceConnections.id, row.id))
    .returning();
  if (!updated) throw new ApiError(500, "Update failed", "device_update_failed");
  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "device.status_updated",
    entityType: "device_connection",
    entityId: updated.id,
    metadata: { status: params.status },
    correlationId: params.correlationId,
  });
  return updated;
}

export function capabilityMatrix(): Record<string, string> {
  return {
    browser_media: "available",
    web_bluetooth: "limited_ble_gatt_only",
    webusb: "available_with_permission",
    webhid: "available_with_permission",
    webserial: "available_with_permission",
    linux_bluez: "available_via_companion",
    pipewire: "available_via_companion",
    home_assistant: "optional_oauth",
  };
}
