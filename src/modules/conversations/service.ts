import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, messages } from "@/db/schema";
import type { Conversation, Message } from "@/db/schema";
import { ApiError } from "@/lib/http";

export type MessageCitation = {
  sourceId: string;
  title: string;
  chunkIndex: number;
  source?: string;
};

export type ToolActivity = {
  toolId: string;
  status: string;
  summary?: string;
  permissionRequired?: { connectorId: string; connectorName: string; scopes: string[] };
};

export async function createConversation(params: {
  tenantId: string;
  userId: string;
  title?: string;
  channel?: "text" | "voice";
}): Promise<Conversation> {
  const [conversation] = await db
    .insert(conversations)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      title: params.title?.slice(0, 120) || "Conversation",
      channel: params.channel ?? "text",
    })
    .returning();
  if (!conversation) throw new ApiError(500, "Could not start a conversation.", "conversation_create_failed");
  return conversation;
}

export async function listConversations(tenantId: string, userId: string, limit = 40): Promise<Conversation[]> {
  return db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.userId, userId),
        eq(conversations.archived, false),
      ),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(Math.min(limit, 100));
}

export async function getConversation(tenantId: string, userId: string, id: string): Promise<Conversation> {
  const rows = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, id),
        eq(conversations.tenantId, tenantId),
        eq(conversations.userId, userId),
      ),
    )
    .limit(1);
  const conversation = rows[0];
  if (!conversation) throw new ApiError(404, "Conversation not found.", "conversation_not_found");
  return conversation;
}

export async function listMessages(
  tenantId: string,
  conversationId: string,
  limit = 200,
): Promise<Message[]> {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.tenantId, tenantId), eq(messages.conversationId, conversationId)))
    .orderBy(asc(messages.createdAt))
    .limit(Math.min(limit, 400));
}

export async function addMessage(params: {
  tenantId: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  channel?: "text" | "voice";
  citations?: MessageCitation[];
  toolActivity?: ToolActivity[];
}): Promise<Message> {
  const [message] = await db
    .insert(messages)
    .values({
      tenantId: params.tenantId,
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      channel: params.channel ?? "text",
      citations: params.citations ?? [],
      toolActivity: params.toolActivity ?? [],
    })
    .returning();
  if (!message) throw new ApiError(500, "Could not save the message.", "message_create_failed");

  await db
    .update(conversations)
    .set({ updatedAt: new Date(), channel: params.channel ?? "text" })
    .where(and(eq(conversations.id, params.conversationId), eq(conversations.tenantId, params.tenantId)));

  return message;
}

export async function maybeSetTitleFromMessage(
  tenantId: string,
  conversationId: string,
  userMessage: string,
): Promise<void> {
  const conversation = await db
    .select({ title: conversations.title })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)))
    .limit(1);
  if (conversation[0]?.title !== "New conversation" && conversation[0]?.title !== "Conversation") return;
  const title = userMessage.replace(/\s+/g, " ").trim().slice(0, 70) || "Conversation";
  await db
    .update(conversations)
    .set({ title })
    .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)));
}

export async function getRecentHistory(
  tenantId: string,
  conversationId: string,
  limit = 20,
): Promise<Message[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.conversationId, conversationId),
        eq(messages.role, "user"),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  const assistantRows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.conversationId, conversationId),
        eq(messages.role, "assistant"),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return [...rows, ...assistantRows]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(-limit);
}
