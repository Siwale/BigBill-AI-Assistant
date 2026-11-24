import { requireOnboardedPageSession } from "@/modules/auth/session";
import { listAuditEvents } from "@/modules/audit/service";
import { ActivityView } from "@/components/activity/activity-view";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const session = await requireOnboardedPageSession();
  const events = await listAuditEvents(session.user.tenantId, 200);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Activity</h1>
          <p>
            Append-only audit events for this tenant. They record identifiers and outcomes, not message
            bodies or secrets.
          </p>
        </div>
      </header>
      <ActivityView
        events={events.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          entityType: event.entityType,
          entityId: event.entityId,
          actorUserId: event.actorUserId,
          correlationId: event.correlationId,
          metadata: event.metadata,
          createdAt: event.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
