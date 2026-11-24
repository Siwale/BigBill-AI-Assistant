import { requireOnboardedPageSession } from "@/modules/auth/session";
import { SettingsView } from "@/components/settings/settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireOnboardedPageSession();

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Your assistant&apos;s identity, voice and workspace details. Changes are audited.</p>
        </div>
      </header>
      <SettingsView
        assistantName={session.profile.displayName ?? ""}
        userName={session.user.displayName}
        userEmail={session.user.email}
        userRole={session.user.role}
        workspaceName={session.tenant.name}
        workspaceSlug={session.tenant.slug}
        voice={{
          provider: session.profile.voiceConfig.provider ?? "browser",
          voiceId: session.profile.voiceConfig.voiceId ?? "alloy",
          language: session.profile.voiceConfig.language ?? "",
          rate: session.profile.voiceConfig.rate ?? 1,
        }}
        persona={{ tone: session.profile.personaConfig.tone ?? "" }}
      />
    </div>
  );
}
