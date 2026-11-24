import { requireOnboardedPageSession } from "@/modules/auth/session";
import { getConversation, listConversations, listMessages } from "@/modules/conversations/service";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ c?: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AssistantPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireOnboardedPageSession();
  const { c } = await searchParams;

  const conversations = await listConversations(session.user.tenantId, session.user.id);
  let activeId = c && UUID.test(c) ? c : null;
  let initialMessages: Awaited<ReturnType<typeof listMessages>> = [];

  if (activeId) {
    try {
      await getConversation(session.user.tenantId, session.user.id, activeId);
      initialMessages = await listMessages(session.user.tenantId, activeId);
    } catch {
      activeId = null;
      initialMessages = [];
    }
  }

  return (
    <ChatWorkspace
      assistantName={session.profile.displayName ?? "your assistant"}
      userName={session.user.displayName}
      conversations={conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt.toISOString(),
      }))}
      activeConversationId={activeId}
      initialMessages={initialMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        channel: message.channel,
        citations: message.citations,
        toolActivity: message.toolActivity,
        createdAt: message.createdAt.toISOString(),
      }))}
      voice={{
        provider: session.profile.voiceConfig.provider,
        voiceId: session.profile.voiceConfig.voiceId,
        language: session.profile.voiceConfig.language,
        rate: session.profile.voiceConfig.rate,
      }}
    />
  );
}
