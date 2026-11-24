import { requireOnboardedPageSession } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function ForgePage() {
  await requireOnboardedPageSession();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 18, color: "var(--aida-cyan-4)", letterSpacing: 1 }}>Forge</h1>
      <section className="aida-panel" style={{ padding: 16 }}>
        <h3 className="aida-panel-title">Not connected</h3>
        <p className="aida-body" style={{ marginTop: 8 }}>
          The Forge specialist engine is not connected in this workspace. Engineering reviews stay in an honest
          disconnected state until a real health handshake succeeds — nothing is simulated.
        </p>
        <p className="aida-meta">Gap: install and register the local Forge checkout, then retry the companion handshake.</p>
      </section>
    </div>
  );
}
