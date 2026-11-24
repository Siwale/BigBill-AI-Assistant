import { NextResponse } from "next/server";
import { permissionGrantSchema, permissionRevokeSchema } from "@/contracts";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import {
  connectionOverview,
  grantPermissions,
  revokePermissions,
} from "@/modules/permissions/service";

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    const session = await requireApiSession();
    const connections = await connectionOverview(session.user.tenantId, session.user.id);
    return NextResponse.json({ connections });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const url = new URL(request.url);
    if (url.searchParams.get("action") === "revoke") {
      const input = await parseJson(request, permissionRevokeSchema);
      await revokePermissions({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        connectorId: input.connectorId,
        correlationId,
      });
      return NextResponse.json({ ok: true, revoked: input.connectorId });
    }
    const input = await parseJson(request, permissionGrantSchema);
    await grantPermissions({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      connectorId: input.connectorId,
      scopes: input.scopes,
      correlationId,
    });
    return NextResponse.json({ ok: true, granted: input });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
