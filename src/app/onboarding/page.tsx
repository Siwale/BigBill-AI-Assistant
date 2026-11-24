import { redirect } from "next/navigation";
import { requirePageSession } from "@/modules/auth/session";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await requirePageSession();
  if (session.profile.onboardingCompletedAt && session.profile.displayName) redirect("/app");

  return (
    <main className="onboarding-shell">
      <OnboardingFlow
        workspaceName={session.tenant.name}
        userName={session.user.displayName}
        existingName={session.profile.displayName}
      />
    </main>
  );
}
