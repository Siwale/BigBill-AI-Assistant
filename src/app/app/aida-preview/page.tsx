import { requireOnboardedPageSession } from "@/modules/auth/session";
import { PresencePreview } from "@/components/dev/presence-preview";

export const dynamic = "force-dynamic";

export default async function AidaPreviewPage() {
  await requireOnboardedPageSession();
  if (process.env.NODE_ENV === "production") {
    return (
      <div className="aida-panel" style={{ padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 18, color: "var(--aida-text-strong)" }}>Preview unavailable</h1>
        <p className="aida-meta">The Aida presence preview is a development-only harness and is disabled in production builds.</p>
      </div>
    );
  }
  return <PresencePreview />;
}
