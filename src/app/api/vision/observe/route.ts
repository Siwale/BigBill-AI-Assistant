import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { correlationIdFor, rateLimitOrThrow } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { createObservation } from "@/modules/vision/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    rateLimitOrThrow(`vision:${session.user.id}`, 20, 60_000);

    const form = await request.formData();
    const sourceType = String(form.get("sourceType") ?? "upload");
    if (!["camera", "screen", "upload"].includes(sourceType)) {
      return NextResponse.json({ error: { code: "invalid_source", message: "Invalid source." } }, { status: 400 });
    }
    const conversationId = form.get("conversationId");
    const caption = String(form.get("caption") ?? "");
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: { code: "image_required", message: "Attach an image." } }, { status: 400 });
    }
    if (file.size > 8_000_000) {
      return NextResponse.json({ error: { code: "too_large", message: "Image too large (max 8 MB)." } }, { status: 413 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const observation = await createObservation({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      conversationId: typeof conversationId === "string" && conversationId ? conversationId : null,
      sourceType: sourceType as "camera" | "screen" | "upload",
      mimeType: file.type || "image/jpeg",
      buffer,
      caption,
      correlationId,
    });

    return NextResponse.json(
      {
        observation: {
          id: observation.id,
          sourceType: observation.sourceType,
          mimeType: observation.mimeType,
          byteSize: observation.byteSize,
          caption: observation.caption,
          analysis: observation.analysis,
          analysisModel: observation.analysisModel,
          createdAt: observation.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
