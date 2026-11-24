import { requireOnboardedPageSession } from "@/modules/auth/session";
import { PersonalEnvironment } from "@/components/environment/personal-environment";

export const dynamic = "force-dynamic";

export default async function EnvironmentPage() {
  await requireOnboardedPageSession();
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Personal Environment</h1>
          <p>Aida sees only what you explicitly share. Devices, music and movies are shown with honest capability and licensing status.</p>
        </div>
      </header>
      <PersonalEnvironment />
    </div>
  );
}
