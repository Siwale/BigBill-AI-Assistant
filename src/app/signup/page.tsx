import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/modules/auth/session";
import { SignupForm } from "@/components/auth/signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect(session.profile.onboardingCompletedAt ? "/app" : "/onboarding");

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-mark">
          <span>E</span> Executive Assistant
        </div>
        <div>
          <h1>Start with your work, not a setup manual.</h1>
          <p>
            Create your workspace, then give your assistant her name. From that point she uses the same
            identity, memory and permissions whether you type or speak.
          </p>
        </div>
        <p className="tiny" style={{ marginTop: 0 }}>
          You are the first user of this workspace. Nothing is shared with another organization.
        </p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <h2>Create your workspace</h2>
          <p className="muted">You will name your assistant in the next step.</p>
          <SignupForm />
          <p className="auth-foot">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
