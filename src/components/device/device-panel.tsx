"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioVisualizer } from "@/components/voice/audio-visualizer";

type Capability = {
  secureContext: boolean;
  canGetUserMedia: boolean;
  canGetDisplayMedia: boolean;
  canEnumerateDevices: boolean;
  canSelectAudioOutput: boolean;
  canSetSinkId: boolean;
  hasSpeechRecognition: boolean;
  hasSpeechSynthesis: boolean;
  hasWebRTC: boolean;
  hasAudioWorklet: boolean;
};

function detectCapabilities(): Capability {
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  const mediaDevices = navigator.mediaDevices as unknown as {
    selectAudioOutput?: unknown;
  };
  const audioEl = document.createElement("audio") as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
  return {
    secureContext: window.isSecureContext,
    canGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
    canGetDisplayMedia: Boolean(navigator.mediaDevices?.getDisplayMedia),
    canEnumerateDevices: Boolean(navigator.mediaDevices?.enumerateDevices),
    canSelectAudioOutput: typeof mediaDevices?.selectAudioOutput === "function",
    canSetSinkId: typeof audioEl.setSinkId === "function",
    hasSpeechRecognition: Boolean(w.SpeechRecognition || w.webkitSpeechRecognition),
    hasSpeechSynthesis: "speechSynthesis" in window,
    hasWebRTC: Boolean(window.RTCPeerConnection),
    hasAudioWorklet: Boolean(window.AudioWorkletNode),
  };
}

type DeviceInfo = MediaDeviceInfo;

export function DevicePanel() {
  const [cap, setCap] = useState<Capability | null>(null);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>("");
  const [selectedOutput, setSelectedOutput] = useState<string>("");
  const [permission, setPermission] = useState<"prompt" | "granted" | "denied" | "unknown">("unknown");
  const [level, setLevel] = useState(0);
  const [audioState, setAudioState] = useState<string>("idle");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const outputAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setCap(detectCapabilities());
    void refreshDevices();
    if (navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((p) => {
          setPermission(p.state as typeof permission);
          p.onchange = () => setPermission(p.state as typeof permission);
        })
        .catch(() => setPermission("unknown"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list as DeviceInfo[]);
      const pref = await fetch("/api/devices").then((r) => r.json()).catch(() => null);
      const label = (pref as { preference?: { preferredInputLabel?: string; preferredOutputLabel?: string } })?.preference;
      if (label?.preferredInputLabel) {
        const match = (list as DeviceInfo[]).find((d) => d.label === label.preferredInputLabel);
        if (match) setSelectedInput(match.deviceId);
      }
      if (label?.preferredOutputLabel) {
        const match = (list as DeviceInfo[]).find((d) => d.label === label.preferredOutputLabel);
        if (match) setSelectedOutput(match.deviceId);
      }
    } catch {
      setError("Device enumeration is not available in this browser.");
    }
  }, []);

  const startMicTest = useCallback(async () => {
    setError("");
    setMessage("Requesting microphone permission…");
    setAudioState("requesting_permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedInput ? { deviceId: { exact: selectedInput } } : true,
      });
      streamRef.current = stream;
      setAudioState("listening");
      setMessage("Microphone active — speak to see the level meter.");
      const ac = new AudioContext();
      const source = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length / 255;
        setLevel(avg);
        requestAnimationFrame(tick);
      };
      tick();
      // persist preference label
      const dev = devices.find((d) => d.deviceId === selectedInput);
      if (dev?.label) {
        await fetch("/api/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferredInputLabel: dev.label }),
        });
      }
    } catch (e) {
      const err = e as DOMException;
      if (err.name === "NotAllowedError") {
        setError("Microphone permission was denied. Allow it in your browser settings and retry. Text chat remains usable.");
        setPermission("denied");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Check your device.");
      } else if (err.name === "NotReadableError") {
        setError("Microphone is busy (another app may be using it).");
      } else {
        setError(`Microphone error: ${err.message || err.name}`);
      }
      setAudioState("error");
    }
  }, [devices, selectedInput]);

  const stopMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    setLevel(0);
    setAudioState("idle");
    setMessage("Microphone stopped.");
  }, []);

  const testOutput = useCallback(async () => {
    setError("");
    const audio = outputAudioRef.current ?? new Audio();
    outputAudioRef.current = audio;
    if (selectedOutput && typeof (audio as unknown as { setSinkId?: (id: string) => Promise<void> }).setSinkId === "function") {
      try {
        await (audio as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(selectedOutput);
      } catch {
        setError("Could not route to the selected output. Using system default.");
      }
    }
    audio.src = "data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVQAAAAAAA=="; // short silent wav; real TTS below
    try {
      await audio.play();
      // also do a short TTS playback as real audible test
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "This is your assistant speaking through the selected output." }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audio.src = url;
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();
        setAudioState("speaking");
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setAudioState("idle");
        };
        setMessage("Output test playing. If you hear nothing, check volume and output selection.");
        const dev = devices.find((d) => d.deviceId === selectedOutput);
        if (dev?.label) {
          await fetch("/api/devices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preferredOutputLabel: dev.label }),
          });
        }
      } else {
        setError("Server speech not configured. Browser speech synthesis is the fallback.");
      }
    } catch (e) {
      const err = e as Error;
      if (err.name === "NotAllowedError") {
        setError("Autoplay was blocked. Interact with the page and press Test again.");
      } else {
        setError(`Playback failed: ${err.message}`);
      }
      setAudioState("error");
    }
  }, [devices, selectedOutput]);

  const selectAudioOutput = useCallback(async () => {
    const md = navigator.mediaDevices as unknown as { selectAudioOutput?: () => Promise<MediaDeviceInfo> };
    if (!md.selectAudioOutput) {
      setError("Output selection is not supported in this browser. System default will be used.");
      return;
    }
    try {
      const dev = await md.selectAudioOutput();
      setSelectedOutput(dev.deviceId);
      setMessage(`Selected output: ${dev.label || dev.deviceId}`);
    } catch (e) {
      const err = e as DOMException;
      if (err.name !== "NotAllowedError") setError(`Output selection failed: ${err.message}`);
    }
  }, []);

  const runDiagnostics = useCallback(async () => {
    const c = detectCapabilities();
    const result: Record<string, unknown> = {
      secureContext: c.secureContext,
      permission,
      canGetUserMedia: c.canGetUserMedia,
      canEnumerateDevices: c.canEnumerateDevices,
      canSelectAudioOutput: c.canSelectAudioOutput,
      canSetSinkId: c.canSetSinkId,
      hasSpeechRecognition: c.hasSpeechRecognition,
      hasSpeechSynthesis: c.hasSpeechSynthesis,
      deviceCount: devices.length,
      selectedInput: selectedInput || "(default)",
      selectedOutput: selectedOutput || "(system default)",
      time: new Date().toISOString(),
    };
    setTestResult(result);
    await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastTestResult: result }),
    });
    setMessage("Diagnostics saved. You can copy the result for troubleshooting.");
  }, [devices.length, permission, selectedInput, selectedOutput]);

  if (!cap) return <div className="card">Detecting capabilities…</div>;

  return (
    <div className="stack">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="banner info" role="status">{message}</div> : null}

      <div className="card">
        <h3 className="section-title">Browser capabilities</h3>
        <p className="section-sub">Detected at runtime, not assumed. “Not supported” means this browser cannot provide that API.</p>
        <div className="grid-3" style={{ fontSize: 13 }}>
          <div><strong>Secure context:</strong> {cap.secureContext ? "yes (required for mic/camera/output)" : "no — use HTTPS or localhost"}</div>
          <div><strong>getUserMedia:</strong> {cap.canGetUserMedia ? "yes" : "no"}</div>
          <div><strong>getDisplayMedia:</strong> {cap.canGetDisplayMedia ? "yes" : "no"}</div>
          <div><strong>enumerateDevices:</strong> {cap.canEnumerateDevices ? "yes" : "no"}</div>
          <div><strong>selectAudioOutput:</strong> {cap.canSelectAudioOutput ? "yes" : "no (system default only)"}</div>
          <div><strong>setSinkId:</strong> {cap.canSetSinkId ? "yes" : "no"}</div>
          <div><strong>SpeechRecognition:</strong> {cap.hasSpeechRecognition ? "yes" : "no — server fallback will be used"}</div>
          <div><strong>speechSynthesis:</strong> {cap.hasSpeechSynthesis ? "yes" : "no"}</div>
          <div><strong>WebRTC:</strong> {cap.hasWebRTC ? "yes" : "no"}</div>
        </div>
        <div style={{ marginTop: 12 }}>
          <AudioVisualizer audioState={audioState} level={level} />
        </div>
      </div>

      <div className="grid-2">
        <div className="card stack">
          <h3 className="section-title">Microphone</h3>
          <p className="tiny muted">Starts only after you click. Shows permission, device, level, mute/stop.</p>
          <div className="field">
            <label>Input device</label>
            <select value={selectedInput} onChange={(e) => setSelectedInput(e.target.value)}>
              <option value="">System default</option>
              {devices.filter((d) => d.kind === "audioinput").map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 6)}`}</option>
              ))}
            </select>
          </div>
          <div className="row">
            <span className="badge">Permission: {permission}</span>
            <span className="badge">{audioState === "listening" ? "capturing" : "idle"}</span>
          </div>
          <div style={{ height: 10, background: "var(--surface-2)", borderRadius: 999, overflow: "hidden", border: "1px solid var(--line)" }}>
            <div style={{ width: `${Math.round(level * 100)}%`, height: "100%", background: "var(--accent)", transition: "width 80ms linear" }} />
          </div>
          <div className="row">
            <button className="btn btn-primary btn-sm" type="button" onClick={startMicTest}>Start mic test</button>
            <button className="btn btn-sm" type="button" onClick={stopMic}>Stop</button>
            <button className="btn btn-sm btn-ghost" type="button" onClick={refreshDevices}>Refresh devices</button>
          </div>
          <p className="hint">If denied, allow the microphone in your browser’s site settings and reload.</p>
        </div>

        <div className="card stack">
          <h3 className="section-title">Speakers / headphones</h3>
          <p className="tiny muted">System default always works. Selection requires a secure context and permission.</p>
          <div className="field">
            <label>Output device</label>
            <select value={selectedOutput} onChange={(e) => setSelectedOutput(e.target.value)}>
              <option value="">System default</option>
              {devices.filter((d) => d.kind === "audiooutput").map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Output ${d.deviceId.slice(0, 6)}`}</option>
              ))}
            </select>
          </div>
          <div className="row">
            <button className="btn btn-sm" type="button" onClick={selectAudioOutput}>Choose output (supported browsers)</button>
            <button className="btn btn-primary btn-sm" type="button" onClick={testOutput}>Test output</button>
          </div>
          <audio ref={outputAudioRef} controls style={{ width: "100%", marginTop: 4 }} />
        </div>
      </div>

      <div className="card stack">
        <h3 className="section-title">Diagnostics</h3>
        <div className="row">
          <button className="btn btn-sm" type="button" onClick={runDiagnostics}>Run & save diagnostics</button>
          {testResult ? (
            <button
              className="btn btn-sm btn-ghost"
              type="button"
              onClick={() => navigator.clipboard.writeText(JSON.stringify(testResult, null, 2))}
            >
              Copy result
            </button>
          ) : null}
        </div>
        {testResult ? <pre className="code-block">{JSON.stringify(testResult, null, 2)}</pre> : null}
      </div>
    </div>
  );
}
