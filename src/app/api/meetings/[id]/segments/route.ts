import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { addTranscriptSegments, listSegments } from "@/modules/meetings/service";

const addSchema = z.object({
  segments: z
    .array(
      z.object({
        speaker: z.string().max(120).optional(),
        text: z.string().min(1).max(4000),
        startMs: z.number().int().min(0).optional(),
        endMs: z.number().int().min(0).optional(),
        provider: z.string().max(30).optional(),
      }),
    )
    .min(1)
    .max(200),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = correlationIdFor(request);
  try {
    const session = await requireApiSession();
    const { id } = await context.params;
    const segments = await listSegments(session.user.tenantId, id);
    return NextResponse.json({ segments });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const { id } = await context.params;
    const input = await parseJson(request, addSchema);
    const segments = await addTranscriptSegments({
      tenantId: session.user.tenantId,
      meetingId: id,
      segments: input.segments,
      correlationId,
    });
    return NextResponse.json({ segments }, { status: 201 });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
