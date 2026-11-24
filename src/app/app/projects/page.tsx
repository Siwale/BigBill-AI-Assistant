import { requireOnboardedPageSession } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await requireOnboardedPageSession();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 18, color: "var(--aida-cyan-4)", letterSpacing: 1 }}>Projects</h1>
      <section className="aida-panel" style={{ padding: 16 }}>
        <h3 className="aida-panel-title">Not connected</h3>
        <p className="aida-body" style={{ marginTop: 8 }}>
          Project tracking lives in tasks and drafts for now. A dedicated Projects workspace is not connected yet.
        </p>
        <p className="aida-meta">Use Command or the tasks workspace; nothing here is simulated.</p>
      </section>
    </div>
  );
}
