import { requireOnboardedPageSession } from "@/modules/auth/session";
import { listIncidents } from "@/modules/incidents/service";
import { IncidentsView } from "@/components/incidents/incidents-view";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const session = await requireOnboardedPageSession();
  const incidents = await listIncidents(session.user.tenantId);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Incidents</h1>
          <p>
            Problems the assistant or the platform recorded, with impact and the exact next step. Resolving one
            here does not hide the underlying evidence.
          </p>
        </div>
      </header>
      <IncidentsView
        incidents={incidents.map((incident) => ({
          id: incident.id,
          severity: incident.severity,
          title: incident.title,
          description: incident.description,
          impact: incident.impact,
          evidence: incident.evidence,
          nextStep: incident.nextStep,
          source: incident.source,
          status: incident.status,
          createdAt: incident.createdAt.toISOString(),
          acknowledgedAt: incident.acknowledgedAt ? incident.acknowledgedAt.toISOString() : null,
          resolvedAt: incident.resolvedAt ? incident.resolvedAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
