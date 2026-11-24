import { requireOnboardedPageSession } from "@/modules/auth/session";
import { getConversation, listConversations, listMessages } from "@/modules/conversations/service";
import { CommandHome } from "@/components/command/command-home";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ c?: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AssistantPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireOnboardedPageSession();
  const effective = await (await import("@/modules/profile/user-config")).getEffectiveAssistant(session.user.tenantId, session.user.id);
  const { c } = await searchParams;

  const conversations = await listConversations(session.user.tenantId, session.user.id);
  // Continuous active conversation: default to most recent non-archived, or create one internally
  let activeId: string | null = c && UUID.test(c) ? c : null;
  let initialMessages: Awaited<ReturnType<typeof listMessages>> = [];

  if (!activeId) {
    const active = conversations.find((conv) => !conv.archived) ?? conversations[0] ?? null;
    if (active) {
      activeId = active.id;
    } else {
      // No conversation exists — create the initial active one internally (not a user New conversation action)
      const created = await (await import("@/modules/conversations/service")).createConversation({
        tenantId: session.user.tenantId,
        userId: session.user.id,
        channel: "text",
      });
      activeId = created.id;
      conversations.unshift(created);
    }
  }

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
    <CommandHome
      assistantName={effective.displayName ?? session.profile.displayName ?? "your assistant"}
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
