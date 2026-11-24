import { requireOnboardedPageSession } from "@/modules/auth/session";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { CommandShell } from "@/components/command/command-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOnboardedPageSession();
  const theme = (session.profile.personaConfig.theme as "classic" | "mission_control" | "audio_simulator" | undefined) ?? "classic";

  return (
    <ThemeProvider initialTheme={theme}>
      <CommandShell
        assistantName={session.profile.displayName ?? "Aida"}
        userName={session.user.displayName}
        userEmail={session.user.email}
        workspaceName={session.tenant.name}
        companionStatus="checking"
      >
        {children}
      </CommandShell>
    </ThemeProvider>
  );
}
