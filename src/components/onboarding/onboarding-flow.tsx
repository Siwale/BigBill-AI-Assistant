"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Volume2 } from "lucide-react";
import { CONNECTORS, DEFAULT_ONBOARDING_SCOPES } from "@/modules/permissions/catalog";

type Props = {
  workspaceName: string;
  userName: string;
  existingName: string | null;
};

type Step = "name" | "permissions" | "ready";

type BrowserSpeech = {
  speak: (utterance: SpeechSynthesisUtterance) => void;
  cancel: () => void;
  getVoices: () => SpeechSynthesisVoice[];
};

function getSpeech(): BrowserSpeech | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis as unknown as BrowserSpeech;
}

export function OnboardingFlow({ workspaceName, userName, existingName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState(existingName ?? "");
  const [savedName, setSavedName] = useState(existingName ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [spoken, setSpoken] = useState(false);
  const [speechNote, setSpeechNote] = useState("");

  const onboardingScopes = useMemo(() => {
    const byConnector = new Map<string, string[]>();
    for (const scopeId of DEFAULT_ONBOARDING_SCOPES) {
      const connector = CONNECTORS.find((c) => c.scopes.some((s) => s.id === scopeId));
      if (!connector) continue;
      const current = byConnector.get(connector.id) ?? [];
      current.push(scopeId);
      byConnector.set(connector.id, current);
    }
    return Array.from(byConnector.entries());
  }, []);

  function speakGreeting(assistantName: string) {
    const speech = getSpeech();
    if (!speech) {
      setSpeechNote("This browser cannot speak aloud. Your assistant will still reply in text and can use server speech when available.");
      return;
    }
    try {
      speech.cancel();
      const utterance = new SpeechSynthesisUtterance(
        `Hello ${userName}, I'm ${assistantName}. I'm ready to help you run your day.`,
      );
      utterance.lang = navigator.language || "en-US";
      utterance.rate = 1;
      utterance.pitch = 1;
      speech.speak(utterance);
      setSpoken(true);
      setSpeechNote("");
    } catch {
      setSpeechNote("Speech output could not start. Check your browser's sound settings.");
    }
  }

  async function submitName(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/onboarding/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as {
        error?: { message?: string };
        profile?: { displayName?: string };
      };
      if (!response.ok) {
        setError(data.error?.message ?? "Could not save the name.");
        return;
      }
      const chosen = data.profile?.displayName ?? name.trim();
      setSavedName(chosen);
      setStep("permissions");
      speakGreeting(chosen);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPermissions() {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/onboarding/permissions", { method: "POST" });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setError(data.error?.message ?? "Could not save permissions.");
        return;
      }
      setStep("ready");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function enterWorkspace() {
    router.push("/app");
    router.refresh();
  }

  if (step === "ready") {
    return (
      <div className="onboarding-card">
        <p className="onboarding-kicker">Workspace ready</p>
        <h1>{savedName} is ready.</h1>
        <p className="lead">
          {savedName} works in {workspaceName} with the permissions you approved. The same conversation,
          memory and audit trail apply whether you type or speak.
        </p>
        <div className="banner info" style={{ marginTop: 22 }}>
          <strong>What is enabled:</strong> tasks, local drafts, knowledge, memory, briefings and incident
          reporting. Sending email or WhatsApp, publishing, spending and deleting are disabled in this
          release.
        </div>
        <div className="onboarding-actions">
          <button className="btn btn-primary" type="button" onClick={enterWorkspace}>
            Open {savedName}
          </button>
          <button className="btn" type="button" onClick={() => speakGreeting(savedName)}>
            <Volume2 size={16} /> Hear the greeting again
          </button>
        </div>
        {speechNote ? <p className="hint" style={{ marginTop: 14 }}>{speechNote}</p> : null}
      </div>
    );
  }

  if (step === "permissions") {
    return (
      <div className="onboarding-card">
        <p className="onboarding-kicker">Step 2 of 2 · Permissions</p>
        <h1>Decide what {savedName} may do.</h1>
        <p className="lead">
          These are the workspace permissions that make the assistant useful. They are granted to you,
          scoped to {workspaceName}, and can be revoked at any time.
        </p>
        <ul className="permission-list">
          {onboardingScopes.map(([connectorId, scopes]) => {
            const connector = CONNECTORS.find((c) => c.id === connectorId);
            if (!connector) return null;
            return (
              <li key={connectorId}>
                <Check size={16} />
                <span>
                  <strong>{connector.name}</strong> — {scopes.length} permission
                  {scopes.length === 1 ? "" : "s"}:{" "}
                  {scopes
                    .map((scopeId) => connector.scopes.find((s) => s.id === scopeId)?.label ?? scopeId)
                    .join(", ")}
                </span>
              </li>
            );
          })}
          <li>
            <Check size={16} />
            <span>
              <strong>Not enabled:</strong> sending, publishing, spending, destructive actions and any
              connection to BOS, Khapy or MotherTracker.
            </span>
          </li>
        </ul>
        {error ? <div className="error" role="alert" style={{ marginTop: 16 }}>{error}</div> : null}
        <div className="onboarding-actions">
          <button className="btn btn-primary" type="button" onClick={confirmPermissions} disabled={busy}>
            {busy ? "Saving permissions…" : "Approve and continue"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setStep("name")} disabled={busy}>
            Back
          </button>
        </div>
        {speechNote ? <p className="hint" style={{ marginTop: 14 }}>{speechNote}</p> : null}
      </div>
    );
  }

  return (
    <div className="onboarding-card">
      <p className="onboarding-kicker">Step 1 of 2 · Name your assistant</p>
      <h1>What should your assistant be called?</h1>
      <p className="lead">
        This name is yours to choose. It is stored in {workspaceName}, used in the interface, in every
        conversation and when your assistant speaks. You can change it later in Settings.
      </p>
      <form onSubmit={submitName}>
        {error ? <div className="error" role="alert">{error}</div> : null}
        <div className="field">
          <label htmlFor="assistant-name">Assistant name</label>
          <input
            id="assistant-name"
            className="name-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Amara, Tessa, Kofi"
            autoFocus
            maxLength={40}
            required
          />
          <span className="hint">Letters, spaces, apostrophes, periods and hyphens. Up to 40 characters.</span>
        </div>
        <div className="onboarding-actions">
          <button className="btn btn-primary" type="submit" disabled={busy || name.trim().length === 0}>
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
      <p className="hint" style={{ marginTop: 18 }}>
        No default name is used. The assistant stays “your assistant” until you choose.
      </p>
      {spoken ? <p className="hint">Spoken greeting played.</p> : null}
    </div>
  );
}
