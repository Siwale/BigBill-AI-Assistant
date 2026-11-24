import { requireOnboardedPageSession } from "@/modules/auth/session";
import { connectionOverview } from "@/modules/permissions/service";
import { PermissionsView } from "@/components/permissions/permissions-view";

export const dynamic = "force-dynamic";

export default async function PermissionsPage() {
  const session = await requireOnboardedPageSession();
  const connections = await connectionOverview(session.user.tenantId, session.user.id);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Permissions</h1>
          <p>
            What your assistant may do in this workspace. Permissions are granted to you, scoped to this
            tenant, and can be revoked immediately.
          </p>
        </div>
      </header>
      <PermissionsView
        initialConnections={connections.map((connection) => ({
          id: connection.id,
          name: connection.name,
          description: connection.description,
          state: connection.state,
          stateNote: connection.stateNote,
          connected: connection.connected,
          grantedScopes: connection.grantedScopes,
          grantedAt: connection.grantedAt ? connection.grantedAt.toISOString() : null,
          scopes: connection.scopes.map((scope) => ({
            id: scope.id,
            label: scope.label,
            description: scope.description,
            risk: scope.risk,
            enabled: scope.enabled,
          })),
        }))}
      />
    </div>
  );
}
