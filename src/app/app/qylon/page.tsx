import { requireOnboardedPageSession } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function QylonPage() {
  await requireOnboardedPageSession();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 18, color: "var(--aida-cyan-4)", letterSpacing: 1 }}>Qylon</h1>
      <section className="aida-panel" style={{ padding: 16 }}>
        <h3 className="aida-panel-title">Not connected</h3>
        <p className="aida-body" style={{ marginTop: 8 }}>
          Qylon is not connected in this workspace. No capability is implied until a real integration check succeeds.
        </p>
        <p className="aida-meta">Gap: no verified Qylon integration for this product. Shows “not connected” by design.</p>
      </section>
    </div>
  );
}
