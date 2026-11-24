"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(workspaceSlug.trim() ? { workspaceSlug: workspaceSlug.trim() } : {}),
        }),
      });
      const data = (await response.json()) as { error?: { message?: string }; redirect?: string };
      if (!response.ok) {
        setError(data.error?.message ?? "Could not sign in.");
        return;
      }
      router.push(data.redirect ?? "/app");
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
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      <details className="workspace-code">
        <summary>I belong to more than one workspace</summary>
        <div className="field">
          <label htmlFor="login-workspace">Workspace code</label>
          <input
            id="login-workspace"
            value={workspaceSlug}
            onChange={(event) => setWorkspaceSlug(event.target.value)}
            placeholder="Shown in workspace settings"
          />
        </div>
      </details>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
