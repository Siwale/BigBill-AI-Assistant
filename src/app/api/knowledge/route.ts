import { NextResponse } from "next/server";
import { ApiError, assertSameOrigin, jsonError } from "@/lib/http";
import { correlationIdFor, rateLimitOrThrow } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { deleteDocument, ingestDocument, listDocuments } from "@/modules/knowledge/service";

export const runtime = "nodejs";

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    const session = await requireApiSession();
    const documents = await listDocuments(session.user.tenantId);
    return NextResponse.json({ documents });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

const ALLOWED_TYPES = new Set(["text/plain", "text/markdown", "text/x-markdown"]);

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    rateLimitOrThrow(`knowledge:${session.user.id}`, 10, 10 * 60_000);

    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose a text or markdown file.", "file_required");
    if (file.size > 1_500_000) throw new ApiError(413, "File is larger than 1.5 MB.", "file_too_large");
    if (!ALLOWED_TYPES.has(file.type) && !/\.(txt|md|markdown)$/i.test(file.name)) {
      throw new ApiError(415, "Only .txt and .md files are supported in this release.", "unsupported_file");
    }
    const content = await file.text();
    const document = await ingestDocument({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      title: title || file.name,
      content,
      mimeType: file.type || "text/plain",
      correlationId,
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function DELETE(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(400, "Invalid document id.", "invalid_id");
    await deleteDocument({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      id,
      correlationId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
