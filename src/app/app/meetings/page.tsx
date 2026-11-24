import { requireOnboardedPageSession } from "@/modules/auth/session";
import { MeetingCentre } from "@/components/meetings/meeting-centre";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  await requireOnboardedPageSession();
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Meeting Centre</h1>
          <p>Connect Zoom via RTMS or Google Meet via REST/Drive artifacts. Browser companion is the honest live fallback. Actions are evidence-linked and approval-gated.</p>
        </div>
      </header>
      <MeetingCentre />
    </div>
  );
}
