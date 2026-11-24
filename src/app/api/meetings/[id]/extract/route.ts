import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { extractActionCandidates } from "@/modules/meetings/service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const { id } = await context.params;
    const candidates = await extractActionCandidates({
      tenantId: session.user.tenantId,
      meetingId: id,
      correlationId,
    });
    return NextResponse.json({ candidates });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
