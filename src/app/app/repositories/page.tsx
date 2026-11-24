import { requireOnboardedPageSession } from "@/modules/auth/session";
import { RepositoriesPanel } from "@/components/repositories/repositories-panel";

export const dynamic = "force-dynamic";

export default async function RepositoriesPage() {
  await requireOnboardedPageSession();
  return (
    <div className="command-env" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 18, color: "var(--cmd-cyan)", letterSpacing: 1 }}>Repositories</h1>
      <p style={{ margin: 0, fontSize: 12, color: "var(--cmd-muted)" }}>Registered local repositories via companion — tenant-scoped, path-bounded, secret-redacted snapshots.</p>
      <RepositoriesPanel />
    </div>
  );
}
