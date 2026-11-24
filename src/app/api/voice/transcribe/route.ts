import { NextResponse } from "next/server";
import { ApiError, assertSameOrigin, jsonError } from "@/lib/http";
import { correlationIdFor, rateLimitOrThrow } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { transcribeAudio } from "@/modules/assistant/model";
import { openIncident } from "@/modules/incidents/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  let tenantId: string | null = null;
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    tenantId = session.user.tenantId;
    rateLimitOrThrow(`stt:${session.user.id}`, 20, 60_000);

    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) throw new ApiError(400, "No audio was received.", "audio_required");
    if (file.size > 15_000_000) throw new ApiError(413, "Audio clip is too large.", "audio_too_large");
    const language = String(form.get("language") ?? "").trim() || undefined;

    const text = await transcribeAudio(file, language);
    if (!text) throw new ApiError(422, "No speech was recognised. Please try again.", "no_speech");
    return NextResponse.json({ text });
  } catch (error) {
    if (tenantId && error instanceof Error && !("status" in error)) {
      await openIncident({
        tenantId,
        severity: "info",
        title: "Voice transcription failed",
        description: "The server speech fallback could not transcribe an audio clip.",
        evidence: `correlationId=${correlationId}`,
        nextStep: "Continue in text or use browser speech recognition.",
        source: "voice",
        dedupeKey: "voice.stt.failed",
        correlationId,
      }).catch(() => undefined);
    }
    return jsonError(error, correlationId);
  }
}
