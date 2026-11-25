import { requireOnboardedPageSession } from "@/modules/auth/session";
import { PersonalEnvironment } from "@/components/environment/personal-environment";
import { createConversation, listConversations } from "@/modules/conversations/service";

export const dynamic = "force-dynamic";

export default async function EnvironmentPage() {
  const session = await requireOnboardedPageSession();
  const conversations = await listConversations(session.user.tenantId, session.user.id);
  const active = conversations.find((conversation) => !conversation.archived) ?? conversations[0] ?? null;
  const conversationId = active?.id ?? (await createConversation({ tenantId: session.user.tenantId, userId: session.user.id, channel: "text" })).id;
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Personal Environment</h1>
          <p>Aida sees only what you explicitly share. Devices, music and movies are shown with honest capability and licensing status.</p>
        </div>
      </header>
      <PersonalEnvironment tenantId={session.user.tenantId} userId={session.user.id} conversationId={conversationId} />
    </div>
  );
}
