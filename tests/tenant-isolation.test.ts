import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db, sqlClient } from "@/db/client";
import { knowledgeDocuments, tenants, users } from "@/db/schema";
import { createTask, getTask, listTasks } from "@/modules/tasks/service";
import { createMemory, listMemory } from "@/modules/memory/service";
import { listIncidents, openIncident } from "@/modules/incidents/service";
import { listDocuments } from "@/modules/knowledge/service";
import {
  grantPermissions,
  hasScopes,
  revokePermissions,
} from "@/modules/permissions/service";

const suffix = randomUUID().slice(0, 8);
const createdTenants: string[] = [];

async function makeTenant(label: string): Promise<{ tenantId: string; userId: string }> {
  const [tenant] = await db
    .insert(tenants)
    .values({ name: `Isolation ${label}`, slug: `isolation-${label}-${suffix}` })
    .returning();
  if (!tenant) throw new Error("tenant insert failed");
  createdTenants.push(tenant.id);
  const [user] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: `${label}-${suffix}@isolation.test`,
      passwordHash: "not-a-real-hash",
      displayName: `${label} Owner`,
      role: "owner",
    })
    .returning();
  if (!user) throw new Error("user insert failed");
  return { tenantId: tenant.id, userId: user.id };
}

afterAll(async () => {
  if (createdTenants.length > 0) {
    await db.delete(tenants).where(inArray(tenants.id, createdTenants));
  }
  await sqlClient.end();
});

describe("tenant isolation", () => {
  it("never returns another tenant's tasks or allows cross-tenant reads", async () => {
    const alpha = await makeTenant("alpha");
    const beta = await makeTenant("beta");

    const task = await createTask({
      tenantId: alpha.tenantId,
      userId: alpha.userId,
      title: "Alpha-only task",
      source: "user",
    });

    const alphaTasks = await listTasks({ tenantId: alpha.tenantId, userId: alpha.userId });
    const betaTasks = await listTasks({ tenantId: beta.tenantId, userId: beta.userId });

    expect(alphaTasks.map((item) => item.id)).toContain(task.id);
    expect(betaTasks.map((item) => item.id)).not.toContain(task.id);
    await expect(getTask(beta.tenantId, beta.userId, task.id)).rejects.toMatchObject({ status: 404 });
  });

  it("scopes memory and incidents to the owning tenant", async () => {
    const alpha = await makeTenant("memory-alpha");
    const beta = await makeTenant("memory-beta");

    await createMemory({
      tenantId: alpha.tenantId,
      userId: alpha.userId,
      category: "user_preference",
      content: "Alpha prefers Monday briefings.",
    });
    await openIncident({
      tenantId: alpha.tenantId,
      title: "Alpha-only incident",
      description: "Synthetic isolation check.",
      source: "test",
      dedupeKey: `isolation-${suffix}-alpha`,
    });

    expect(await listMemory(beta.tenantId, beta.userId)).toHaveLength(0);
    const betaIncidents = await listIncidents(beta.tenantId);
    expect(betaIncidents.map((incident) => incident.title)).not.toContain("Alpha-only incident");
  });

  it("scopes knowledge documents before retrieval", async () => {
    const alpha = await makeTenant("knowledge-alpha");
    const beta = await makeTenant("knowledge-beta");

    await db.insert(knowledgeDocuments).values({
      tenantId: alpha.tenantId,
      userId: alpha.userId,
      title: "Alpha private document",
      content: "Alpha-only content that must never reach beta.",
      contentHash: `alpha-${suffix}`,
      status: "ready",
    });
    await db.insert(knowledgeDocuments).values({
      tenantId: beta.tenantId,
      userId: beta.userId,
      title: "Beta private document",
      content: "Beta-only content.",
      contentHash: `beta-${suffix}`,
      status: "ready",
    });

    const alphaDocs = await listDocuments(alpha.tenantId);
    const betaDocs = await listDocuments(beta.tenantId);
    expect(alphaDocs.map((document) => document.title)).toEqual(["Alpha private document"]);
    expect(betaDocs.map((document) => document.title)).toEqual(["Beta private document"]);
  });

  it("does not leak grants across tenants and blocks immediately after revoke", async () => {
    const alpha = await makeTenant("grants-alpha");
    const beta = await makeTenant("grants-beta");

    await grantPermissions({
      tenantId: alpha.tenantId,
      userId: alpha.userId,
      connectorId: "workspace",
      scopes: ["tasks.read"],
    });

    expect(await hasScopes(alpha.tenantId, alpha.userId, ["tasks.read"])).toBe(true);
    expect(await hasScopes(beta.tenantId, beta.userId, ["tasks.read"])).toBe(false);

    await revokePermissions({
      tenantId: alpha.tenantId,
      userId: alpha.userId,
      connectorId: "workspace",
    });
    expect(await hasScopes(alpha.tenantId, alpha.userId, ["tasks.read"])).toBe(false);
  });
});
