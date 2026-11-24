import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, sqlClient } from "@/db/client";
import { conversations, tenants, users } from "@/db/schema";
import {
  addMessage,
  createConversation,
} from "@/modules/conversations/service";
import {
  getArchivedConversation,
  searchArchivedConversations,
} from "@/modules/conversations/archive";
import { searchArchivedConversationsTool } from "@/modules/tools/registry";

const suffix = randomUUID().slice(0, 8);
const createdTenants: string[] = [];

async function makeTenant(label: string): Promise<{ tenantId: string; userId: string }> {
  const [tenant] = await db
    .insert(tenants)
    .values({ name: `Archive ${label}`, slug: `archive-${label}-${suffix}` })
    .returning();
  if (!tenant) throw new Error("tenant insert failed");
  createdTenants.push(tenant.id);
  const [user] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: `${label}-${suffix}@archive.test`,
      passwordHash: "not-a-real-hash",
      displayName: `${label} Owner`,
      role: "owner",
    })
    .returning();
  if (!user) throw new Error("user insert failed");
  return { tenantId: tenant.id, userId: user.id };
}

async function seedArchivedConversation(tenantId: string, userId: string, marker: string) {
  const conv = await createConversation({ tenantId, userId, title: `Budget review ${marker}`, channel: "text" });
  await addMessage({ tenantId, conversationId: conv.id, role: "user", content: `What did we decide about the ${marker} budget quorum?`, channel: "text" });
  await addMessage({ tenantId, conversationId: conv.id, role: "assistant", content: `We agreed to cap the ${marker} spend at 40000.`, channel: "text" });
  await db.update(conversations).set({ archived: true }).where(eq(conversations.id, conv.id));
  return conv;
}

afterAll(async () => {
  if (createdTenants.length > 0) {
    await db.delete(tenants).where(inArray(tenants.id, createdTenants));
  }
  await sqlClient.end();
});

describe("Loop 4 archive retrieval with source references", () => {
  it("finds an archived discussion by topic with conversation source and time", async () => {
    const { tenantId, userId } = await makeTenant("alpha");
    const marker = `zebra-${suffix}`;
    const conv = await seedArchivedConversation(tenantId, userId, marker);

    const result = await searchArchivedConversations({ tenantId, userId, query: marker });
    expect(result.conversations.length).toBeGreaterThan(0);
    const hit = result.conversations.find((c) => c.id === conv.id);
    expect(hit?.title).toContain("Budget review");
    expect(hit?.updatedAt).toBeDefined();

    const byConv = result.messagesByConversation[conv.id] ?? [];
    expect(byConv.length).toBeGreaterThan(0);
    expect(byConv.some((m) => m.content.includes(marker))).toBe(true);
  });

  it("answers honestly when nothing matches", async () => {
    const { tenantId, userId } = await makeTenant("beta");
    const result = await searchArchivedConversations({ tenantId, userId, query: `no-such-topic-${suffix}` });
    expect(result.conversations).toHaveLength(0);
  });

  it("never leaks another tenant's archives", async () => {
    const alpha = await makeTenant("gamma");
    const beta = await makeTenant("delta");
    const marker = `quorum-${suffix}`;
    await seedArchivedConversation(alpha.tenantId, alpha.userId, marker);
    const cross = await searchArchivedConversations({ tenantId: beta.tenantId, userId: beta.userId, query: marker });
    expect(cross.conversations).toHaveLength(0);
    expect(Object.keys(cross.messagesByConversation)).toHaveLength(0);
  });

  it("model tool executes with tenant context and cites sources", async () => {
    const { tenantId, userId } = await makeTenant("epsilon");
    const marker = `harbor-${suffix}`;
    const conv = await seedArchivedConversation(tenantId, userId, marker);
    const out = await searchArchivedConversationsTool.execute(
      { query: marker },
      {
        tenantId,
        userId,
        userDisplayName: "Epsilon Owner",
        tenantName: "Archive epsilon",
        profileName: "Aida",
        conversationId: conv.id,
        correlationId: `test-${suffix}`,
      },
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.summary).toMatch(/Found \d+ archived/);
      const data = out.data as { conversations: Array<{ id: string; title: string }> };
      expect(data.conversations.some((c) => c.id === conv.id)).toBe(true);
    }
  });

  it("reads back a full archived transcript read-only with tenant check", async () => {
    const { tenantId, userId } = await makeTenant("zeta");
    const marker = `signal-${suffix}`;
    const conv = await seedArchivedConversation(tenantId, userId, marker);
    const full = await getArchivedConversation(tenantId, userId, conv.id);
    expect(full.messages.length).toBe(2);
    await expect(getArchivedConversation("00000000-0000-0000-0000-000000000000", userId, conv.id)).rejects.toThrow();
  });

  it("does not surface active conversations as archived results", async () => {
    const { tenantId, userId } = await makeTenant("eta");
    const marker = `active-${suffix}`;
    const conv = await createConversation({ tenantId, userId, title: `Active ${marker}`, channel: "text" });
    await addMessage({ tenantId, conversationId: conv.id, role: "user", content: `live talk about ${marker}`, channel: "text" });
    const result = await searchArchivedConversations({ tenantId, userId, query: marker });
    expect(result.conversations.find((c) => c.id === conv.id)).toBeUndefined();
  });
});
