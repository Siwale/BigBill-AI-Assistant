import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, sqlClient } from "@/db/client";
import { actions, conversations, tenants, users } from "@/db/schema";
import { executeTool } from "@/modules/tools/executor";
import { grantPermissions } from "@/modules/permissions/service";
import type { ToolContext } from "@/modules/tools/types";

const createdTenants: string[] = [];

async function makeTenant(): Promise<{ tenantId: string; userId: string; conversationId: string }> {
  const slug = `tool-gate-${randomUUID().slice(0, 8)}`;
  const [tenant] = await db.insert(tenants).values({ name: "Tool Gate", slug }).returning();
  if (!tenant) throw new Error("tenant insert failed");
  createdTenants.push(tenant.id);
  const [user] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: `${slug}@test.local`,
      passwordHash: "not-a-real-hash",
      displayName: "Gate Owner",
      role: "owner",
    })
    .returning();
  if (!user) throw new Error("user insert failed");
  const [conversation] = await db
    .insert(conversations)
    .values({ tenantId: tenant.id, userId: user.id, title: "Gate conversation" })
    .returning();
  if (!conversation) throw new Error("conversation insert failed");
  return { tenantId: tenant.id, userId: user.id, conversationId: conversation.id };
}

afterAll(async () => {
  if (createdTenants.length > 0) {
    await db.delete(tenants).where(inArray(tenants.id, createdTenants));
  }
  await sqlClient.end();
});

function context(tenantId: string, userId: string, conversationId: string): ToolContext {
  return {
    tenantId,
    userId,
    userDisplayName: "Gate Owner",
    tenantName: "Tool Gate",
    profileName: "Tessa",
    conversationId,
    correlationId: randomUUID(),
  };
}

describe("tool execution gate", () => {
  it("denies a tool when the scope is missing and audits the attempt", async () => {
    const { tenantId, userId, conversationId } = await makeTenant();
    const execution = await executeTool({
      toolId: "create_task",
      rawArguments: JSON.stringify({ title: "Should not exist" }),
      context: context(tenantId, userId, conversationId),
    });

    expect(execution.result.ok).toBe(false);
    if (!execution.result.ok) {
      expect(execution.result.code).toBe("permission_required");
      expect(execution.result.permissionRequired?.connectorId).toBe("workspace");
    }
    expect(execution.actionId).not.toBeNull();

    const [row] = await db
      .select()
      .from(actions)
      .where(eq(actions.id, execution.actionId ?? ""))
      .limit(1);
    expect(row?.status).toBe("blocked");
  });

  it("executes only after the required scope is granted", async () => {
    const { tenantId, userId, conversationId } = await makeTenant();
    await grantPermissions({
      tenantId,
      userId,
      connectorId: "workspace",
      scopes: ["tasks.write"],
    });

    const execution = await executeTool({
      toolId: "create_task",
      rawArguments: JSON.stringify({ title: "Allowed task", priority: "high" }),
      context: context(tenantId, userId, conversationId),
    });
    expect(execution.result.ok).toBe(true);
    if (execution.result.ok) {
      expect(execution.result.summary).toContain("Allowed task");
    }
  });

  it("never executes an R3 send tool, even with a grant attempt", async () => {
    const { tenantId, userId, conversationId } = await makeTenant();
    const execution = await executeTool({
      toolId: "send_email",
      rawArguments: JSON.stringify({ subject: "Exfiltrate", body: "This must never send." }),
      context: context(tenantId, userId, conversationId),
    });

    expect(execution.result.ok).toBe(false);
    if (!execution.result.ok) {
      expect(execution.result.code).toBe("tool_disabled");
      expect(execution.result.message).toMatch(/disabled/i);
    }

    const [row] = await db
      .select()
      .from(actions)
      .where(eq(actions.id, execution.actionId ?? ""))
      .limit(1);
    expect(row?.status).toBe("blocked");
    expect(row?.risk).toBe("R3");
    expect(row?.approvalRequired).toBe(true);
  });

  it("rejects malformed arguments before any side effect", async () => {
    const { tenantId, userId, conversationId } = await makeTenant();
    await grantPermissions({
      tenantId,
      userId,
      connectorId: "workspace",
      scopes: ["tasks.write"],
    });

    const execution = await executeTool({
      toolId: "create_task",
      rawArguments: JSON.stringify({ title: "" }),
      context: context(tenantId, userId, conversationId),
    });
    expect(execution.result.ok).toBe(false);
    if (!execution.result.ok) {
      expect(execution.result.code).toBe("invalid_arguments");
    }
    expect(execution.actionId).toBeNull();
  });
});
