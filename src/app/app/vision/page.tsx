import { requireOnboardedPageSession } from "@/modules/auth/session";
import { VisionPanel } from "@/components/vision/vision-panel";
import { createConversation, listConversations } from "@/modules/conversations/service";

export const dynamic = "force-dynamic";

export default async function VisionPage() {
  const session = await requireOnboardedPageSession();
  const conversations = await listConversations(session.user.tenantId, session.user.id);
  const active = conversations.find((conversation) => !conversation.archived) ?? conversations[0] ?? null;
  const conversationId = active?.id ?? (await createConversation({ tenantId: session.user.tenantId, userId: session.user.id, channel: "text" })).id;
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Vision</h1>
          <p>Show the assistant something with the camera, screen share, or an upload. It answers only from what it can actually see.</p>
        </div>
      </header>
      <VisionPanel conversationId={conversationId} />
    </div>
  );
}
