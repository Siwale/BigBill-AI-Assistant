import { NextResponse } from "next/server";
import { taskCreateSchema, taskUpdateSchema } from "@/contracts";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { createTask, listTasks, parseDueAt, updateTask } from "@/modules/tasks/service";

export async function GET(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    const session = await requireApiSession();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const tasks = await listTasks({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      status: status && ["open", "in_progress", "done", "cancelled"].includes(status) ? status : undefined,
    });
    return NextResponse.json({ tasks });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, taskCreateSchema);
    const task = await createTask({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      title: input.title,
      description: input.description,
      dueAt: parseDueAt(input.dueAt),
      priority: input.priority,
      source: "user",
      correlationId,
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function PATCH(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, taskUpdateSchema);
    const task = await updateTask({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      id: input.id,
      title: input.title,
      description: input.description,
      dueAt: input.dueAt === undefined ? undefined : parseDueAt(input.dueAt),
      priority: input.priority,
      status: input.status,
      correlationId,
    });
    return NextResponse.json({ task });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
