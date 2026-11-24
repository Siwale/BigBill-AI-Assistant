import { and, asc, desc, eq, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { tasks } from "@/db/schema";
import type { Task } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/modules/audit/service";

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_STATUSES = ["open", "in_progress", "done", "cancelled"] as const;

export async function createTask(params: {
  tenantId: string;
  userId: string;
  title: string;
  description?: string | null;
  dueAt?: Date | null;
  priority?: TaskPriority;
  conversationId?: string | null;
  source?: "assistant" | "user";
  correlationId?: string;
}): Promise<Task> {
  const title = params.title.trim();
  if (!title) throw new ApiError(400, "A task needs a title.", "task_title_required");
  if (title.length > 200) throw new ApiError(400, "Task title is too long.", "task_title_too_long");

  const [task] = await db
    .insert(tasks)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      conversationId: params.conversationId ?? null,
      title,
      description: params.description?.trim() || null,
      dueAt: params.dueAt ?? null,
      priority: params.priority ?? "normal",
      status: "open",
      source: params.source ?? "assistant",
    })
    .returning();
  if (!task) throw new ApiError(500, "Could not create the task.", "task_create_failed");

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "task.created",
    entityType: "task",
    entityId: task.id,
    metadata: { priority: task.priority, dueAt: task.dueAt?.toISOString() ?? null, source: task.source },
    correlationId: params.correlationId,
  });
  return task;
}

export async function listTasks(params: {
  tenantId: string;
  userId: string;
  status?: string;
  dueBefore?: Date;
  limit?: number;
}): Promise<Task[]> {
  const conditions = [eq(tasks.tenantId, params.tenantId), eq(tasks.userId, params.userId)];
  if (params.status) conditions.push(eq(tasks.status, params.status));
  if (params.dueBefore) conditions.push(lte(tasks.dueAt, params.dueBefore));
  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(asc(tasks.dueAt), desc(tasks.priority), desc(tasks.createdAt))
    .limit(Math.min(params.limit ?? 100, 200));
}

export async function getTask(tenantId: string, userId: string, id: string): Promise<Task> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId), eq(tasks.userId, userId)))
    .limit(1);
  const task = rows[0];
  if (!task) throw new ApiError(404, "Task not found.", "task_not_found");
  return task;
}

export async function updateTask(params: {
  tenantId: string;
  userId: string;
  id: string;
  title?: string;
  description?: string | null;
  dueAt?: Date | null;
  priority?: TaskPriority;
  status?: string;
  correlationId?: string;
}): Promise<Task> {
  await getTask(params.tenantId, params.userId, params.id);
  const [updated] = await db
    .update(tasks)
    .set({
      ...(params.title !== undefined ? { title: params.title.trim().slice(0, 200) } : {}),
      ...(params.description !== undefined ? { description: params.description } : {}),
      ...(params.dueAt !== undefined ? { dueAt: params.dueAt } : {}),
      ...(params.priority !== undefined ? { priority: params.priority } : {}),
      ...(params.status !== undefined ? { status: params.status } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, params.id), eq(tasks.tenantId, params.tenantId), eq(tasks.userId, params.userId)))
    .returning();
  if (!updated) throw new ApiError(500, "Could not update the task.", "task_update_failed");

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "task.updated",
    entityType: "task",
    entityId: updated.id,
    metadata: { status: updated.status, priority: updated.priority },
    correlationId: params.correlationId,
  });
  return updated;
}

export async function taskSummary(tenantId: string, userId: string) {
  const rows = await db
    .select({
      status: tasks.status,
      count: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.userId, userId)))
    .groupBy(tasks.status);

  const now = new Date();
  const overdue = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(
      and(
        eq(tasks.tenantId, tenantId),
        eq(tasks.userId, userId),
        lte(tasks.dueAt, now),
        ne(tasks.status, "done"),
        ne(tasks.status, "cancelled"),
      ),
    );

  return {
    byStatus: Object.fromEntries(rows.map((r) => [r.status, r.count])) as Record<string, number>,
    overdue: overdue[0]?.count ?? 0,
  };
}

export function parseDueAt(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, "Due date is invalid.", "invalid_due_date");
  return date;
}
