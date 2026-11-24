import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { actions } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { log } from "@/lib/logger";
import { payloadHash } from "@/lib/security/text";
import { recordAudit } from "@/modules/audit/service";
import { hasScopes } from "@/modules/permissions/service";
import { findConnector } from "@/modules/permissions/catalog";
import { findTool } from "./registry";
import type { ToolContext, ToolResult } from "./types";

export type ToolExecution = {
  result: ToolResult;
  actionId: string | null;
  durationMs: number;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ApiError(504, "The tool timed out.", "tool_timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function recordAction(params: {
  context: ToolContext;
  toolId: string;
  risk: string;
  status: string;
  payload: unknown;
  preview: Record<string, unknown>;
  approvalRequired: boolean;
  error?: string;
}): Promise<string> {
  const [action] = await db
    .insert(actions)
    .values({
      tenantId: params.context.tenantId,
      userId: params.context.userId,
      conversationId: params.context.conversationId,
      toolId: params.toolId,
      risk: params.risk,
      status: params.status,
      payload: params.payload as Record<string, unknown>,
      preview: params.preview,
      payloadHash: payloadHash(params.payload),
      approvalRequired: params.approvalRequired,
      completedAt: params.status === "completed" ? new Date() : null,
      error: params.error ?? null,
    })
    .returning({ id: actions.id });
  return action?.id ?? "";
}

async function updateAction(actionId: string, status: string, error?: string): Promise<void> {
  if (!actionId) return;
  await db
    .update(actions)
    .set({
      status,
      error: error ?? null,
      completedAt: status === "completed" || status === "failed" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(actions.id, actionId));
}

/**
 * The single execution gate for text, voice and any future surface.
 * Model output is untrusted: arguments are schema-validated, authorization is
 * checked server-side on every call, and R3/R4 never execute in Loop 1.
 */
export async function executeTool(params: {
  toolId: string;
  rawArguments: string;
  context: ToolContext;
}): Promise<ToolExecution> {
  const started = Date.now();
  const tool = findTool(params.toolId);

  if (!tool) {
    await recordAudit({
      tenantId: params.context.tenantId,
      actorUserId: params.context.userId,
      eventType: "tool.unknown",
      entityType: "tool",
      entityId: params.toolId,
      metadata: {},
      correlationId: params.context.correlationId,
    });
    return {
      result: { ok: false, code: "unknown_tool", message: "That capability does not exist." },
      actionId: null,
      durationMs: Date.now() - started,
    };
  }

  let parsedArguments: unknown;
  try {
    parsedArguments = JSON.parse(params.rawArguments || "{}") as unknown;
  } catch {
    return {
      result: { ok: false, code: "invalid_arguments", message: "The tool arguments were not valid JSON." },
      actionId: null,
      durationMs: Date.now() - started,
    };
  }

  const preview = {
    tool: tool.name,
    target: tool.connectorId,
    risk: tool.risk,
    requiredScopes: tool.requiredScopes,
    argumentKeys: Object.keys(parsedArguments as Record<string, unknown>).slice(0, 20),
    summary: tool.summarize(parsedArguments),
  };

  if (!tool.enabled || tool.risk === "R3" || tool.risk === "R4") {
    const actionId = await recordAction({
      context: params.context,
      toolId: tool.id,
      risk: tool.risk,
      status: "blocked",
      payload: parsedArguments,
      preview,
      approvalRequired: true,
      error: tool.disabledReason ?? "Disabled in Loop 1.",
    });
    await recordAudit({
      tenantId: params.context.tenantId,
      actorUserId: params.context.userId,
      eventType: "tool.blocked",
      entityType: "tool",
      entityId: tool.id,
      metadata: { risk: tool.risk, reason: "disabled_in_loop_1", actionId },
      correlationId: params.context.correlationId,
    });
    return {
      result: {
        ok: false,
        code: "tool_disabled",
        message: tool.disabledReason ?? "That capability is disabled in this release.",
      },
      actionId,
      durationMs: Date.now() - started,
    };
  }

  const validation = tool.inputSchema.safeParse(parsedArguments);
  if (!validation.success) {
    await recordAudit({
      tenantId: params.context.tenantId,
      actorUserId: params.context.userId,
      eventType: "tool.validation_failed",
      entityType: "tool",
      entityId: tool.id,
      metadata: { issueCount: validation.error.issues.length },
      correlationId: params.context.correlationId,
    });
    return {
      result: {
        ok: false,
        code: "invalid_arguments",
        message: "The tool arguments did not match the required schema. Check the fields and try again.",
      },
      actionId: null,
      durationMs: Date.now() - started,
    };
  }

  const authorized = await hasScopes(params.context.tenantId, params.context.userId, tool.requiredScopes);
  if (!authorized) {
    const actionId = await recordAction({
      context: params.context,
      toolId: tool.id,
      risk: tool.risk,
      status: "blocked",
      payload: parsedArguments,
      preview,
      approvalRequired: false,
      error: "Permission not granted.",
    });
    await recordAudit({
      tenantId: params.context.tenantId,
      actorUserId: params.context.userId,
      eventType: "tool.denied",
      entityType: "tool",
      entityId: tool.id,
      metadata: { risk: tool.risk, requiredScopes: tool.requiredScopes, actionId },
      correlationId: params.context.correlationId,
    });
    return {
      result: {
        ok: false,
        code: "permission_required",
        message: `I need permission to ${tool.name.toLowerCase()}. Grant it in Permissions, then ask again.`,
        permissionRequired: {
          connectorId: tool.connectorId,
          connectorName: findConnector(tool.connectorId)?.name ?? tool.connectorId,
          scopes: tool.requiredScopes,
        },
      },
      actionId,
      durationMs: Date.now() - started,
    };
  }

  const actionId = await recordAction({
    context: params.context,
    toolId: tool.id,
    risk: tool.risk,
    status: "proposed",
    payload: parsedArguments,
    preview,
    approvalRequired: false,
  });

  try {
    const success = await withTimeout(
      tool.execute(validation.data, params.context),
      tool.timeoutMs || 15_000,
    );
    await updateAction(actionId, "completed");
    await recordAudit({
      tenantId: params.context.tenantId,
      actorUserId: params.context.userId,
      eventType: "tool.executed",
      entityType: "tool",
      entityId: tool.id,
      metadata: { risk: tool.risk, actionId, durationMs: Date.now() - started },
      correlationId: params.context.correlationId,
    });
    return { result: success, actionId, durationMs: Date.now() - started };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error && /timeout/i.test(error.message)
          ? "The tool timed out."
          : "The tool failed.";
    await updateAction(actionId, "failed", message);
    await recordAudit({
      tenantId: params.context.tenantId,
      actorUserId: params.context.userId,
      eventType: "tool.failed",
      entityType: "tool",
      entityId: tool.id,
      metadata: { risk: tool.risk, actionId, durationMs: Date.now() - started },
      correlationId: params.context.correlationId,
    });
    log("warn", "tool_failed", { toolId: tool.id, actionId });
    return {
      result: { ok: false, code: "tool_failed", message },
      actionId,
      durationMs: Date.now() - started,
    };
  }
}

export async function listActions(tenantId: string, limit = 50) {
  return db
    .select()
    .from(actions)
    .where(eq(actions.tenantId, tenantId))
    .orderBy(actions.createdAt)
    .limit(Math.min(limit, 100));
}

export async function getAction(tenantId: string, id: string) {
  const rows = await db
    .select()
    .from(actions)
    .where(and(eq(actions.id, id), eq(actions.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}
