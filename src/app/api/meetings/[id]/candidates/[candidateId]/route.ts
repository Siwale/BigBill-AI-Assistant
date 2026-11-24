import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { actOnCandidate } from "@/modules/meetings/service";

const actionSchema = z.object({
  action: z.enum(["approve", "reject", "defer", "edit"]),
  patch: z
    .object({
      title: z.string().max(200).optional(),
      proposedOwner: z.string().max(120).nullable().optional(),
      dueAt: z.string().datetime({ offset: true }).nullable().optional(),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    })
    .optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; candidateId: string }> },
) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const { candidateId } = await context.params;
    const input = await parseJson(request, actionSchema);
    const candidate = await actOnCandidate({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      candidateId,
      action: input.action,
      patch: input.patch,
      correlationId,
    });
    return NextResponse.json({ candidate });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
