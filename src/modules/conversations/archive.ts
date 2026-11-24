import { and, eq, ilike, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, messages } from "@/db/schema";
import { ApiError } from "@/lib/http";

export async function searchArchivedConversations(params: { tenantId: string; userId: string; query: string; limit?: number }) {
  const q = params.query.trim();
  if (q.length < 2) throw new ApiError(400, "Query too short", "invalid_query");
  const limit = Math.min(params.limit ?? 5, 10);
  // Search archived conversations by title and message content (bounded)
  const convs = await db.select().from(conversations).where(and(eq(conversations.tenantId, params.tenantId), eq(conversations.userId, params.userId), eq(conversations.archived, true))).orderBy(desc(conversations.updatedAt)).limit(50);
  // Simple keyword match on title
  const matched = convs.filter((c) => c.title.toLowerCase().includes(q.toLowerCase())).slice(0, limit);
  const safe = q.replace(/[%_\\]/g, (c) => `\\${c}`);
  // Also search messages for keyword
  const msgMatches = await db.select({ conversationId: messages.conversationId, content: messages.content, createdAt: messages.createdAt }).from(messages).where(and(eq(messages.tenantId, params.tenantId), ilike(messages.content, `%${safe}%`))).limit(20);
  const byConv = new Map<string, typeof msgMatches>();
  for (const m of msgMatches) {
    const arr = byConv.get(m.conversationId) ?? [];
    arr.push(m);
    byConv.set(m.conversationId, arr);
  }
  return { conversations: matched, messagesByConversation: Object.fromEntries(byConv) };
}

export async function getArchivedConversation(tenantId: string, userId: string, conversationId: string) {
  const rows = await db.select().from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId), eq(conversations.userId, userId), eq(conversations.archived, true))).limit(1);
  const conv = rows[0];
  if (!conv) throw new ApiError(404, "Archived conversation not found", "not_found");
  const msgs = await db.select().from(messages).where(and(eq(messages.tenantId, tenantId), eq(messages.conversationId, conversationId))).orderBy(messages.createdAt).limit(100);
  return { conversation: conv, messages: msgs };
}
