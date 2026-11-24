import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/modules/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.profile.onboardingCompletedAt ? "/app" : "/onboarding");

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-mark">
          <span>E</span> Executive Assistant
        </div>
        <div>
          <h1>Work with an assistant that keeps the thread.</h1>
          <p>
            Tasks, briefings, follow-ups and drafts in one private workspace. She can speak and listen,
            and she asks before doing anything consequential.
          </p>
        </div>
        <p className="tiny" style={{ marginTop: 0 }}>
          Your workspace. Your permissions. Your assistant&apos;s name.
        </p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <h2>Welcome back</h2>
          <p className="muted">Sign in to continue with your executive assistant.</p>
          <LoginForm />
          <p className="auth-foot">
            New here? <Link href="/signup">Create a workspace</Link>
          </p>
          <p className="auth-note">
            This release can draft and prepare work. Sending, publishing, spending and destructive
            actions remain disabled.
          </p>
        </div>
      </section>
    </main>
  );
}
