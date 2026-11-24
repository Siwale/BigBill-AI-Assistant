import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { listActionCandidates } from "@/modules/meetings/service";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = correlationIdFor(request);
  try {
    const session = await requireApiSession();
    const { id } = await context.params;
    const candidates = await listActionCandidates(session.user.tenantId, id);
    return NextResponse.json({ candidates });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
