import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { getDevicePreference, upsertDevicePreference } from "@/modules/device/service";

const patchSchema = z.object({
  preferredInputLabel: z.string().max(200).nullable().optional(),
  preferredOutputLabel: z.string().max(200).nullable().optional(),
  lastTestResult: z.record(z.unknown()).optional(),
});

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    const session = await requireApiSession();
    const pref = await getDevicePreference(session.user.tenantId, session.user.id);
    return NextResponse.json({ preference: pref });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, patchSchema);
    const pref = await upsertDevicePreference({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      ...(input.preferredInputLabel !== undefined ? { preferredInputLabel: input.preferredInputLabel } : {}),
      ...(input.preferredOutputLabel !== undefined ? { preferredOutputLabel: input.preferredOutputLabel } : {}),
      ...(input.lastTestResult ? { lastTestResult: input.lastTestResult as Record<string, unknown> } : {}),
      correlationId,
    });
    return NextResponse.json({ preference: pref });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
