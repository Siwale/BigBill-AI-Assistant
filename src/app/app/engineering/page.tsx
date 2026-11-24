import { requireOnboardedPageSession } from "@/modules/auth/session";
import { EngineeringWorkspace } from "@/components/engineering/engineering-workspace";

export const dynamic = "force-dynamic";

export default async function EngineeringPage() {
  await requireOnboardedPageSession();
  // Engineering workspace is the centrepiece — shows honest disconnected/empty states when companion/Forge not configured
  return <EngineeringWorkspace />;
}
