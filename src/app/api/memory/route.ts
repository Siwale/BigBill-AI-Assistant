import { NextResponse } from "next/server";
import { memoryCreateSchema, memoryUpdateSchema } from "@/contracts";
import { ApiError, assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { createMemory, deleteMemory, listMemory, updateMemory } from "@/modules/memory/service";

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    const session = await requireApiSession();
    const memory = await listMemory(session.user.tenantId, session.user.id);
    return NextResponse.json({ memory });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, memoryCreateSchema);
    const entry = await createMemory({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      category: input.category ?? "user_preference",
      content: input.content,
      source: "user",
      correlationId,
    });
    return NextResponse.json({ memory: entry }, { status: 201 });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function PATCH(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, memoryUpdateSchema);
    const entry = await updateMemory({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      id: input.id,
      content: input.content,
      enabled: input.enabled,
      correlationId,
    });
    return NextResponse.json({ memory: entry });
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
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(400, "Invalid memory id.", "invalid_id");
    await deleteMemory({
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
