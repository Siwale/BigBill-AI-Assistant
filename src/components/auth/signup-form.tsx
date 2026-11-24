"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignupForm() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceName, fullName, email, password }),
      });
      const data = (await response.json()) as { error?: { message?: string }; redirect?: string };
      if (!response.ok) {
        setError(data.error?.message ?? "Could not create the workspace.");
        return;
      }
      router.push(data.redirect ?? "/onboarding");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <div className="field">
        <label htmlFor="signup-workspace">Workspace name</label>
        <input
          id="signup-workspace"
          value={workspaceName}
          onChange={(event) => setWorkspaceName(event.target.value)}
          placeholder="Your organization or team"
          required
          minLength={2}
        />
      </div>
      <div className="field">
        <label htmlFor="signup-name">Your name</label>
        <input
          id="signup-name"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={10}
        />
        <span className="hint">At least 10 characters, including a letter and a number.</span>
      </div>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Creating workspace…" : "Create workspace"}
      </button>
    </form>
  );
}
