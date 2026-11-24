import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { createVisualSession, listVisualSessions, stopVisualSession } from "@/modules/visual/service";

const createSchema = z.object({
  source: z.enum(["camera", "screen", "upload"]),
  conversationId: z.string().uuid().optional(),
  sampleIntervalMs: z.number().int().min(500).max(10000).optional(),
  maxDurationMs: z.number().int().min(30000).max(600000).optional(),
});
const stopSchema = z.object({ sessionId: z.string().uuid(), reason: z.string().max(100).optional() });

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    const session = await requireApiSession();
    const sessions = await listVisualSessions(session.user.tenantId, session.user.id);
    return NextResponse.json({ sessions });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, createSchema);
    const visual = await createVisualSession({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      conversationId: input.conversationId ?? null,
      source: input.source,
      sampleIntervalMs: input.sampleIntervalMs,
      maxDurationMs: input.maxDurationMs,
      correlationId,
    });
    return NextResponse.json({ session: visual }, { status: 201 });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
export async function PATCH(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, stopSchema);
    const updated = await stopVisualSession({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      sessionId: input.sessionId,
      reason: input.reason,
      correlationId,
    });
    return NextResponse.json({ session: updated });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
