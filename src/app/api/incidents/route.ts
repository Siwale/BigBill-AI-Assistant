import { NextResponse } from "next/server";
import { incidentActionSchema } from "@/contracts";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { actOnIncident, listIncidents } from "@/modules/incidents/service";

export async function GET(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    const session = await requireApiSession();
    const incidents = await listIncidents(session.user.tenantId);
    return NextResponse.json({ incidents });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, incidentActionSchema);
    const incident = await actOnIncident({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      id: input.id,
      action: input.action,
      correlationId,
    });
    return NextResponse.json({ incident });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
