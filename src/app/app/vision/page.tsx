import { requireOnboardedPageSession } from "@/modules/auth/session";
import { VisionPanel } from "@/components/vision/vision-panel";

export const dynamic = "force-dynamic";

export default async function VisionPage() {
  await requireOnboardedPageSession();
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Vision</h1>
          <p>Show the assistant something with the camera, screen share, or an upload. It answers only from what it can actually see.</p>
        </div>
      </header>
      <VisionPanel conversationId={null} />
    </div>
  );
}
