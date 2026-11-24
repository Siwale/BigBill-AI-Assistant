import { requireOnboardedPageSession } from "@/modules/auth/session";
import { listMemory } from "@/modules/memory/service";
import { MemoryView } from "@/components/memory/memory-view";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const session = await requireOnboardedPageSession();
  const memory = await listMemory(session.user.tenantId, session.user.id);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Memory</h1>
          <p>
            Facts you explicitly asked the assistant to keep. Disable anything you no longer want used, or
            delete it. Secrets are rejected.
          </p>
        </div>
      </header>
      <MemoryView
        initialMemory={memory.map((entry) => ({
          id: entry.id,
          category: entry.category,
          content: entry.content,
          source: entry.source,
          enabled: entry.enabled,
          createdAt: entry.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
