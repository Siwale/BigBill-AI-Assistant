import { requireOnboardedPageSession } from "@/modules/auth/session";
import { getConversation, listConversations, listMessages } from "@/modules/conversations/service";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { AidaAvatarStage } from "@/components/command/aida-avatar-stage";

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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
        <AidaAvatarStage state="idle" />
        <div className="command-env" style={{ background: "var(--cmd-surface)", border: "1px solid var(--cmd-line)", borderRadius: "var(--cmd-radius)", padding: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, letterSpacing: 1, color: "var(--cmd-cyan)" }}>Current Focus</h3>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--cmd-ink-soft)" }}>Ready for your next command. Ask {effective.displayName ?? session.profile.displayName ?? "your assistant"} to review a repository, prepare a briefing, or manage devices.</p>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, background: "rgba(0,229,255,0.1)", border: "1px solid var(--cmd-line)", padding: "4px 8px", borderRadius: 20 }}>Loop 4 · Engineering Intelligence</span>
            <span style={{ fontSize: 11, background: "rgba(255,204,0,0.1)", border: "1px solid rgba(255,204,0,0.2)", padding: "4px 8px", borderRadius: 20, color: "var(--cmd-amber)" }}>Voice + Text Unified</span>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--cmd-muted)" }}>{conversations.length} conversations • {initialMessages.length} messages in view</div>
        </div>
      </div>
      <ChatWorkspace
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
    </div>
  );
}
