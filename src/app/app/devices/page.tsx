import { requireOnboardedPageSession } from "@/modules/auth/session";
import { DevicePanel } from "@/components/device/device-panel";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  await requireOnboardedPageSession();
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Devices & Presence</h1>
          <p>Test microphone, speakers, camera and screen share. Every control shows real capability and requires your explicit action.</p>
        </div>
      </header>
      <DevicePanel />
    </div>
  );
}
