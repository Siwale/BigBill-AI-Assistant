import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { DEFAULT_ONBOARDING_SCOPES, findScope } from "@/modules/permissions/catalog";
import { grantPermissions } from "@/modules/permissions/service";

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();

    const grouped = new Map<string, string[]>();
    for (const scope of DEFAULT_ONBOARDING_SCOPES) {
      const found = findScope(scope);
      if (!found || !found.scope.enabled) continue;
      const current = grouped.get(found.connector.id) ?? [];
      current.push(scope);
      grouped.set(found.connector.id, current);
    }

    for (const [connectorId, scopes] of grouped) {
      await grantPermissions({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        connectorId,
        scopes,
        correlationId,
      });
    }

    return NextResponse.json({ ok: true, granted: Array.from(grouped.entries()) });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
