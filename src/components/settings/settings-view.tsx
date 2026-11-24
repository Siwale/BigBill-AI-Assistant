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

  const [pronouns, setPronouns] = useState("");
  const [gender, setGender] = useState("not_specified");
  const [presentation, setPresentation] = useState("");
  const [personaDescription, setPersonaDescription] = useState("");

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

  useEffect(() => {
    void fetch("/api/profile/identity").then((r) => r.json()).then((d) => {
      const e = d.effective;
      if (e) {
        if (e.displayName) { setName(e.displayName); setSavedName(e.displayName); }
        if (e.pronouns) setPronouns(e.pronouns);
        if (e.gender) setGender(e.gender);
        if (e.presentation) setPresentation(e.presentation);
        if (e.personaDescription) setPersonaDescription(e.personaDescription);
        if (e.voiceProvider) setProvider(e.voiceProvider);
        if (e.voiceId) setVoiceId(e.voiceId);
        if (e.voiceLocale) setLanguage(e.voiceLocale);
        if (e.voiceRate) setRate(e.voiceRate);
      }
    }).catch(()=>{});
  }, []);

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

  async function saveIdentity(event: React.FormEvent) {
    event.preventDefault();
    setNameError("");
    setNameMessage("");
    setNameBusy(true);
    try {
      const response = await fetch("/api/profile/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, pronouns: pronouns || null, gender: gender || null, presentation: presentation || null, personaDescription: personaDescription || null }),
      });
      const data = (await response.json()) as { effective?: { displayName?: string }; error?: { message?: string } };
      if (!response.ok) {
        setNameError(data.error?.message ?? "Could not save identity.");
        return;
      }
      setSavedName(data.effective?.displayName ?? name);
      setNameMessage(`Saved as ${data.effective?.displayName ?? name}${pronouns ? ` (${pronouns})` : ""} — voice will be checked for match on next save.`);
      router.refresh();
    } catch {
      setNameError("Could not save identity.");
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
      // Persist exact provider/voiceId for per-user voice — check provider metadata match with gender
      const response = await fetch("/api/profile/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceProvider: provider === "openai" ? "openai" : "browser",
          voiceId,
          voiceLocale: language.trim() || null,
          voiceRate: rate,
        }),
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setVoiceError(data.error?.message ?? "Could not save voice settings.");
        return;
      }
      // Also keep tenant voice for backward compat
      await fetch("/api/profile/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider === "openai" ? "openai" : "browser", voiceId, ...(language.trim() ? { language: language.trim() } : {}), rate }),
      }).catch(() => {});
      setVoiceMessage("Voice saved — spoken replies will use this exact voice. If mismatched with gender, audition and re-save.");
      router.refresh();
    } catch {
      setVoiceError("Could not save voice settings.");
    } finally {
      setVoiceBusy(false);
    }
  }

  async function testVoice() {
    setVoiceError("");
    // Try real provider voice first (server TTS), fallback to browser
    try {
      if (provider === "openai") {
        const res = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `Hello, I'm ${savedName || "your assistant"}. This is how I sound.`, voiceId }) });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          if (typeof (audio as unknown as { setSinkId?: unknown }).setSinkId === "function" && language) {
            try { await (audio as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(language); } catch {}
          }
          audio.onended = () => URL.revokeObjectURL(url);
          await audio.play();
          return;
        }
        throw new Error("Server voice unavailable");
      }
    } catch {
      // fallback to browser
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceError("This browser cannot speak aloud. Server speech is used when available.");
      return;
    }
    const synthesis = window.speechSynthesis;
    synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`Hello, I'm ${savedName || "your assistant"}. This is how I sound.`);
    utterance.lang = language || navigator.language || "en-US";
    utterance.rate = rate;
    synthesis.speak(utterance);
  }

  return (
    <div className="stack">
      <div className="grid-2">
        <form className="card stack" onSubmit={saveIdentity}>
          <div>
            <h2 className="section-title">Assistant identity & voice</h2>
            <p className="section-sub">
              Per-user display name, pronouns, gender/persona and voice — tenant defaults are inherited unless you override. Preview uses the real provider voice.
            </p>
          </div>
          {nameError ? <div className="error" role="alert">{nameError}</div> : null}
          {nameMessage ? <div className="banner info" role="status">{nameMessage}</div> : null}
          <div className="field">
            <label htmlFor="settings-name">Display name</label>
            <input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required />
            <span className="hint">Preview: “Hello, I’m {name || "your assistant"}{pronouns ? ` (${pronouns})` : ""}.” — saved per user, not tenant.</span>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="settings-pronouns">Pronouns (optional)</label>
              <input id="settings-pronouns" value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="she/her, he/him, they/them" maxLength={30} />
            </div>
            <div className="field">
              <label htmlFor="settings-gender">Gender / persona</label>
              <select id="settings-gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="not_specified">Not specified</option>
                <option value="female">Female / feminine</option>
                <option value="male">Male / masculine</option>
                <option value="non-binary">Non-binary / neutral</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="settings-presentation">Presentation (optional)</label>
            <input id="settings-presentation" value={presentation} onChange={(e) => setPresentation(e.target.value)} placeholder="e.g. professional, friendly" maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="settings-persona">Short role description (optional, bounded)</label>
            <textarea id="settings-persona" value={personaDescription} onChange={(e) => setPersonaDescription(e.target.value)} maxLength={200} rows={2} placeholder="Guides tone and self-introduction, cannot override policy/tools." />
          </div>
          <div className="row">
            <button className="btn btn-primary" type="submit" disabled={nameBusy}>
              <Save size={14} /> {nameBusy ? "Saving…" : "Save identity"}
            </button>
            <button className="btn" type="button" onClick={testVoice}>
              <Volume2 size={14} /> Preview voice
            </button>
          </div>
          <p className="tiny muted">Voice must match chosen gender/persona — if no suitable voice, audition/select before saving. Saved voice is used consistently for speech.</p>
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
