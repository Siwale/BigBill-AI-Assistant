import { requireOnboardedPageSession } from "@/modules/auth/session";
import { listDocuments } from "@/modules/knowledge/service";
import { KnowledgeView } from "@/components/knowledge/knowledge-view";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const session = await requireOnboardedPageSession();
  const documents = await listDocuments(session.user.tenantId);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Knowledge</h1>
          <p>
            Approved text and Markdown documents, indexed per tenant. Retrieved passages are treated as
            untrusted reference data, never as instructions.
          </p>
        </div>
      </header>
      <KnowledgeView
        initialDocuments={documents.map((document) => ({
          id: document.id,
          title: document.title,
          mimeType: document.mimeType,
          status: document.status,
          errorMessage: document.errorMessage,
          createdAt: document.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
