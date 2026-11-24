import { requireOnboardedPageSession } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  await requireOnboardedPageSession();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 18, color: "var(--aida-cyan-4)", letterSpacing: 1 }}>Media</h1>
      <section className="aida-panel" style={{ padding: 16 }}>
        <h3 className="aida-panel-title">Not connected</h3>
        <p className="aida-body" style={{ marginTop: 8 }}>
          The Media workspace is not connected yet. Voice, vision and device capabilities remain available from
          Command, Devices and Vision.
        </p>
        <p className="aida-meta">Nothing here is simulated.</p>
      </section>
    </div>
  );
}
