import { requireOnboardedPageSession } from "@/modules/auth/session";
import { listDrafts } from "@/modules/drafts/service";
import { DraftsView } from "@/components/drafts/drafts-view";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  const session = await requireOnboardedPageSession();
  const drafts = await listDrafts(session.user.tenantId, session.user.id);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Drafts</h1>
          <p>
            Everything your assistant prepared for review. Nothing here has been sent, published or handed to
            an external system.
          </p>
        </div>
      </header>
      <DraftsView
        drafts={drafts.map((draft) => ({
          id: draft.id,
          kind: draft.kind,
          title: draft.title,
          body: draft.body,
          metadata: draft.metadata,
          createdAt: draft.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
