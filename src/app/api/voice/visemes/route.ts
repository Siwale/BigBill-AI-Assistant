import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor, rateLimitOrThrow } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { approximateVisemesFromText } from "@/modules/voice/viseme";

const schema = z.object({ text: z.string().trim().min(1).max(4000), durationMs: z.number().min(500).max(30000).optional() });

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    await requireApiSession();
    rateLimitOrThrow(`visemes:${correlationId}`, 20, 60_000);
    const input = await parseJson(request, schema);
    // Try to get real phoneme alignment from provider if available — for now approximate and label as approximate
    const durationMs = input.durationMs ?? Math.max(1500, input.text.length * 65);
    const visemes = approximateVisemesFromText(input.text, durationMs);
    return NextResponse.json({ visemes, approximate: true, durationMs, correlationId });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
