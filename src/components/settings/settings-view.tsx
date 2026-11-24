"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Volume2 } from "lucide-react";

const VOICES = ["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"];

type Health = {
  status?: string;
  database?: boolean;
  model?: { configured?: boolean; provider?: string | null };
  speech?: { serverFallback?: boolean };
};

type Props = {
  assistantName: string;
  userName: string;
  userEmail: string;
  userRole: string;
  workspaceName: string;
  workspaceSlug: string;
  voice: { provider: string; voiceId: string; language: string; rate: number };
  persona: { tone: string };
};

export function SettingsView({
  assistantName,
  userName,
  userEmail,
  userRole,
  workspaceName,
  workspaceSlug,
  voice,
  persona,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(assistantName);
  const [savedName, setSavedName] = useState(assistantName);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameMessage, setNameMessage] = useState("");

  const [tone, setTone] = useState(persona.tone);
  const [personaBusy, setPersonaBusy] = useState(false);
  const [personaMessage, setPersonaMessage] = useState("");

  const [provider, setProvider] = useState(voice.provider);
  const [voiceId, setVoiceId] = useState(voice.voiceId);
  const [language, setLanguage] = useState(voice.language);
  const [rate, setRate] = useState(voice.rate);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceMessage, setVoiceMessage] = useState("");

  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then((response) => response.json() as Promise<Health>)
      .then((data) => {
        if (active) setHealth(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    setNameError("");
    setNameMessage("");
    setNameBusy(true);
    try {
      const response = await fetch("/api/profile/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { displayName?: string; error?: { message?: string } };
      if (!response.ok || !data.displayName) {
        setNameError(data.error?.message ?? "Could not rename the assistant.");
        return;
      }
      setSavedName(data.displayName);
      setName(data.displayName);
      setNameMessage("Name updated across the workspace, prompts and spoken replies.");
      router.refresh();
    } catch {
      setNameError("Could not rename the assistant.");
    } finally {
      setNameBusy(false);
    }
  }

  async function savePersona(event: React.FormEvent) {
    event.preventDefault();
    setPersonaBusy(true);
    setPersonaMessage("");
    try {
      const response = await fetch("/api/profile/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: { message?: string } };
        setNameError(data.error?.message ?? "Could not save the tone.");
        return;
      }
      setPersonaMessage("Tone saved.");
      router.refresh();
    } catch {
      setNameError("Could not save the tone.");
    } finally {
      setPersonaBusy(false);
    }
  }

  async function saveVoice(event: React.FormEvent) {
    event.preventDefault();
    setVoiceError("");
    setVoiceMessage("");
    setVoiceBusy(true);
    try {
      const response = await fetch("/api/profile/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider === "openai" ? "openai" : "browser",
          voiceId,
          ...(language.trim() ? { language: language.trim() } : {}),
          rate,
        }),
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setVoiceError(data.error?.message ?? "Could not save voice settings.");
        return;
      }
      setVoiceMessage("Voice settings saved.");
      router.refresh();
    } catch {
      setVoiceError("Could not save voice settings.");
    } finally {
      setVoiceBusy(false);
    }
  }

  function testVoice() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceError("This browser cannot speak aloud. Server speech is used when available.");
      return;
    }
    const synthesis = window.speechSynthesis;
    synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `Hello, I'm ${savedName || "your assistant"}. This is how I sound.`,
    );
    utterance.lang = language || navigator.language || "en-US";
    utterance.rate = rate;
    synthesis.speak(utterance);
  }

  return (
    <div className="stack">
      <div className="grid-2">
        <form className="card stack" onSubmit={saveName}>
          <div>
            <h2 className="section-title">Assistant name</h2>
            <p className="section-sub">
              Used in the interface, prompts and spoken greeting. There is no hardcoded default.
            </p>
          </div>
          {nameError ? <div className="error" role="alert">{nameError}</div> : null}
          {nameMessage ? <div className="banner info" role="status">{nameMessage}</div> : null}
          <div className="field">
            <label htmlFor="settings-name">Display name</label>
            <input
              id="settings-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              required
            />
            <span className="hint">Letters, spaces, apostrophes, periods and hyphens. Up to 40 characters.</span>
          </div>
          <div className="row">
            <button className="btn btn-primary" type="submit" disabled={nameBusy || name.trim() === savedName}>
              <Save size={14} /> {nameBusy ? "Saving…" : "Save name"}
            </button>
            <button className="btn" type="button" onClick={testVoice}>
              <Volume2 size={14} /> Hear it
            </button>
          </div>
        </form>

        <form className="card stack" onSubmit={saveVoice}>
          <div>
            <h2 className="section-title">Voice</h2>
            <p className="section-sub">
              Speech recognition and speech output run in the browser where supported. The authenticated
              server voice is the fallback; it is never a fake button.
            </p>
          </div>
          {voiceError ? <div className="error" role="alert">{voiceError}</div> : null}
          {voiceMessage ? <div className="banner info" role="status">{voiceMessage}</div> : null}
          <div className="grid-2">
            <div className="field">
              <label htmlFor="voice-provider">Preferred provider</label>
              <select id="voice-provider" value={provider} onChange={(event) => setProvider(event.target.value)}>
                <option value="browser">Browser speech</option>
                <option value="openai">Server voice (OpenAI)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="voice-id">Server voice</label>
              <select id="voice-id" value={voiceId} onChange={(event) => setVoiceId(event.target.value)}>
                {VOICES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="voice-language">Language</label>
              <input
                id="voice-language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                placeholder="Browser default, e.g. en-ZM"
                maxLength={12}
              />
            </div>
            <div className="field">
              <label htmlFor="voice-rate">Rate ({rate.toFixed(1)}×)</label>
              <input
                id="voice-rate"
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={rate}
                onChange={(event) => setRate(Number(event.target.value))}
              />
            </div>
          </div>
          <div>
            <button className="btn btn-primary" type="submit" disabled={voiceBusy}>
              <Save size={14} /> {voiceBusy ? "Saving…" : "Save voice settings"}
            </button>
          </div>
        </form>
      </div>

      <div className="grid-2">
        <form className="card stack" onSubmit={savePersona}>
          <div>
            <h2 className="section-title">Tone</h2>
            <p className="section-sub">A light preference included in the assistant&apos;s instructions.</p>
          </div>
          {personaMessage ? <div className="banner info" role="status">{personaMessage}</div> : null}
          <div className="field">
            <label htmlFor="persona-tone">Preferred tone</label>
            <select id="persona-tone" value={tone} onChange={(event) => setTone(event.target.value)}>
              <option value="">Balanced (default)</option>
              <option value="concise and direct">Concise and direct</option>
              <option value="warm and encouraging">Warm and encouraging</option>
              <option value="formal and precise">Formal and precise</option>
              <option value="plain and practical">Plain and practical</option>
            </select>
          </div>
          <div>
            <button className="btn" type="submit" disabled={personaBusy}>
              <Save size={14} /> {personaBusy ? "Saving…" : "Save tone"}
            </button>
          </div>
        </form>

        <section className="card stack">
          <div>
            <h2 className="section-title">Workspace</h2>
            <p className="section-sub">Server-resolved tenant and account details.</p>
          </div>
          <dl className="kv">
            <dt>Workspace</dt>
            <dd>{workspaceName}</dd>
            <dt>Workspace code</dt>
            <dd className="mono">{workspaceSlug}</dd>
            <dt>Signed in as</dt>
            <dd>
              {userName} · {userEmail}
            </dd>
            <dt>Role</dt>
            <dd>{userRole}</dd>
          </dl>
        </section>
      </div>

      <section className="card stack">
        <div>
          <h2 className="section-title">Runtime status</h2>
          <p className="section-sub">Measured now, not assumed.</p>
        </div>
        {health ? (
          <div className="grid-3">
            <div className="stat">
              <div className="stat-value">{health.database ? "OK" : "Down"}</div>
              <div className="stat-label">PostgreSQL</div>
            </div>
            <div className="stat">
              <div className="stat-value">{health.model?.configured ? "Ready" : "Off"}</div>
              <div className="stat-label">
                Model {health.model?.provider ? `· ${health.model.provider}` : ""}
              </div>
            </div>
            <div className="stat">
              <div className="stat-value">{health.speech?.serverFallback ? "Ready" : "Browser"}</div>
              <div className="stat-label">Speech fallback</div>
            </div>
          </div>
        ) : (
          <p className="muted">Checking runtime…</p>
        )}
        <p className="tiny muted">
          BOS, Khapy and MotherTracker remain not connected. Sending, publishing, spending and destructive
          actions remain disabled.
        </p>
      </section>
    </div>
  );
}
