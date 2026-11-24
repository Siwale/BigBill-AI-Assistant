import { requireOnboardedPageSession } from "@/modules/auth/session";
import { taskSummary } from "@/modules/tasks/service";
import { openIncidentCount } from "@/modules/incidents/service";
import { Sidebar } from "@/components/app/sidebar";
import { ThemeProvider } from "@/components/theme/theme-provider";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOnboardedPageSession();
  const [tasks, incidents] = await Promise.all([
    taskSummary(session.user.tenantId, session.user.id),
    openIncidentCount(session.user.tenantId),
  ]);

  const openTasks = (tasks.byStatus.open ?? 0) + (tasks.byStatus.in_progress ?? 0);
  const theme = (session.profile.personaConfig.theme as "classic" | "mission_control" | "audio_simulator" | undefined) ?? "classic";

  return (
    <ThemeProvider initialTheme={theme}>
      <div className="app-shell">
        <Sidebar
          assistantName={session.profile.displayName ?? "your assistant"}
          userName={session.user.displayName}
          userEmail={session.user.email}
          workspaceName={session.tenant.name}
          workspaceSlug={session.tenant.slug}
          openTasks={openTasks}
          openIncidents={incidents}
        />
        <div className="main">{children}</div>
      </div>
    </ThemeProvider>
  );
}
