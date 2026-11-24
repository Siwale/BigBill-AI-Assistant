import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { permissionGrants } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/modules/audit/service";
import { CONNECTORS, findConnector, findScope } from "./catalog";

export type ActiveGrant = {
  id: string;
  connectorId: string;
  scopes: string[];
  grantedAt: Date;
  expiresAt: Date | null;
};

export async function listActiveGrants(tenantId: string, userId: string): Promise<ActiveGrant[]> {
  const rows = await db
    .select()
    .from(permissionGrants)
    .where(
      and(
        eq(permissionGrants.tenantId, tenantId),
        eq(permissionGrants.userId, userId),
        eq(permissionGrants.status, "active"),
        or(isNull(permissionGrants.expiresAt), sql`${permissionGrants.expiresAt} > now()`),
      ),
    );
  return rows.map((r) => ({
    id: r.id,
    connectorId: r.connectorId,
    scopes: r.scopes,
    grantedAt: r.grantedAt,
    expiresAt: r.expiresAt,
  }));
}

export async function getActiveScopeSet(tenantId: string, userId: string): Promise<Set<string>> {
  const grants = await listActiveGrants(tenantId, userId);
  return new Set(grants.flatMap((g) => g.scopes));
}

export async function hasScopes(tenantId: string, userId: string, required: string[]): Promise<boolean> {
  if (required.length === 0) return true;
  const active = await getActiveScopeSet(tenantId, userId);
  return required.every((s) => active.has(s));
}

export function validateGrantRequest(connectorId: string, scopes: string[]): void {
  const connector = findConnector(connectorId);
  if (!connector) throw new ApiError(404, "Unknown connection.", "connector_unknown");
  if (connector.state === "unavailable" || connector.state === "needs_credentials") {
    throw new ApiError(
      409,
      `${connector.name} is not connected. ${connector.stateNote}`,
      "connector_not_connected",
    );
  }
  for (const scopeId of scopes) {
    const found = findScope(scopeId);
    if (!found || found.connector.id !== connectorId) {
      throw new ApiError(400, `Unknown scope for ${connector.name}.`, "scope_unknown");
    }
    if (!found.scope.enabled) {
      throw new ApiError(
        403,
        `${found.scope.label} is disabled in this release.`,
        "scope_disabled",
      );
    }
  }
}

export async function grantPermissions(params: {
  tenantId: string;
  userId: string;
  connectorId: string;
  scopes: string[];
  correlationId?: string;
}): Promise<void> {
  validateGrantRequest(params.connectorId, params.scopes);
  const uniqueScopes = Array.from(new Set(params.scopes));

  const existing = await db
    .select()
    .from(permissionGrants)
    .where(
      and(
        eq(permissionGrants.tenantId, params.tenantId),
        eq(permissionGrants.userId, params.userId),
        eq(permissionGrants.connectorId, params.connectorId),
        eq(permissionGrants.status, "active"),
      ),
    )
    .limit(1);

  const current = existing[0];
  if (current) {
    const merged = Array.from(new Set([...current.scopes, ...uniqueScopes]));
    await db
      .update(permissionGrants)
      .set({ scopes: merged, grantedAt: new Date(), grantedBy: params.userId })
      .where(and(eq(permissionGrants.id, current.id), eq(permissionGrants.tenantId, params.tenantId)));
  } else {
    await db.insert(permissionGrants).values({
      tenantId: params.tenantId,
      userId: params.userId,
      connectorId: params.connectorId,
      scopes: uniqueScopes,
      status: "active",
      grantedBy: params.userId,
    });
  }

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "permission.granted",
    entityType: "connector",
    entityId: params.connectorId,
    metadata: { scopes: uniqueScopes },
    correlationId: params.correlationId,
  });
}

export async function revokePermissions(params: {
  tenantId: string;
  userId: string;
  connectorId: string;
  correlationId?: string;
}): Promise<void> {
  const connector = findConnector(params.connectorId);
  if (!connector) throw new ApiError(404, "Unknown connection.", "connector_unknown");

  const updated = await db
    .update(permissionGrants)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(
      and(
        eq(permissionGrants.tenantId, params.tenantId),
        eq(permissionGrants.userId, params.userId),
        eq(permissionGrants.connectorId, params.connectorId),
        eq(permissionGrants.status, "active"),
      ),
    )
    .returning({ id: permissionGrants.id });

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "permission.revoked",
    entityType: "connector",
    entityId: params.connectorId,
    metadata: { grantsRevoked: updated.length },
    correlationId: params.correlationId,
  });
}

export async function connectionOverview(tenantId: string, userId: string) {
  const grants = await listActiveGrants(tenantId, userId);
  return CONNECTORS.map((connector) => {
    const grant = grants.find((g) => g.connectorId === connector.id);
    return {
      ...connector,
      grantedScopes: grant?.scopes ?? [],
      grantedAt: grant?.grantedAt ?? null,
      expiresAt: grant?.expiresAt ?? null,
      connected: Boolean(grant),
    };
  });
}
