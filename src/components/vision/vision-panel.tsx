"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  conversationId: string | null;
};

export function VisionPanel({ conversationId }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [sourceType, setSourceType] = useState<"camera" | "screen">("camera");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [observationId, setObservationId] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [attachMessage, setAttachMessage] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [visualSessionId, setVisualSessionId] = useState<string | null>(null);
  const [boundedActive, setBoundedActive] = useState(false);
  const boundedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const boundedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void navigator.mediaDevices
      .enumerateDevices()
      .then((list) => setDevices(list as MediaDeviceInfo[]))
      .catch(() => undefined);
  }, []);

  const start = useCallback(async () => {
    setError("");
    setMessage("");
    setAnalysis(null);
    setObservationId(null);
    setAttachMessage("");
    setCaptured(null);
    try {
      let stream: MediaStream;
      if (sourceType === "camera") {
        stream = await navigator.mediaDevices.getUserMedia({
          video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        } as DisplayMediaStreamOptions);
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setActive(true);
      setMessage(
        sourceType === "camera"
          ? "Camera active — you are visible in the preview. Capture an image to analyze."
          : "Screen share active — the browser picker chose what is shared. Stop to end.",
      );
      // handle track ended (user stops sharing via browser UI)
      stream.getVideoTracks().forEach((t) => {
        t.onended = () => {
          setActive(false);
          setMessage("Share ended.");
          streamRef.current = null;
        };
      });
    } catch (e) {
      const err = e as DOMException;
      if (err.name === "NotAllowedError") setError("Permission denied. Allow the camera/screen share and try again.");
      else if (err.name === "NotFoundError") setError("No camera found.");
      else setError(`Could not start ${sourceType}: ${err.message || err.name}`);
      setActive(false);
    }
  }, [selectedCamera, sourceType]);

  const startBounded = useCallback(async () => {
    setError(""); setMessage("Starting bounded visual session (1 frame/2s, 2-min limit)…");
    try {
      const res = await fetch("/api/visual/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: sourceType, conversationId: conversationId ?? undefined, sampleIntervalMs: 2000, maxDurationMs: 120000 }) });
      const data = await res.json() as { session?: { id: string } };
      if (!res.ok || !data.session) throw new Error("Could not create visual session");
      setVisualSessionId(data.session.id);
      await start();
      setBoundedActive(true);
      setMessage("Bounded session active — sampling 1 frame every 2s. Stop anytime.");
      const doCapture = async () => {
        const video = videoRef.current; const canvas = canvasRef.current;
        if (!video || !canvas || !streamRef.current) return;
        canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d"); if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7));
        if (!blob) return;
        const form = new FormData(); form.append("image", blob, "bounded.jpg"); form.append("sourceType", sourceType);
        if (conversationId) form.append("conversationId", conversationId);
        form.append("caption", "Bounded session frame — describe concisely");
        try { const r = await fetch("/api/vision/observe", { method: "POST", body: form }); const d = await r.json() as { observation?: { analysis?: string } }; if (d.observation?.analysis) setAnalysis(d.observation.analysis); } catch {}
      };
      boundedTimerRef.current = setInterval(() => { void doCapture(); }, 2000);
      boundedTimeoutRef.current = setTimeout(() => {
        setBoundedActive(false);
        setMessage("Bounded session reached 2-min limit — stopped. Ask to extend if needed.");
        void fetch("/api/visual/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: data.session!.id, reason: "timeout" }) }).catch(()=>{});
        if (boundedTimerRef.current) clearInterval(boundedTimerRef.current);
        setVisualSessionId(null);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setActive(false);
      }, 120000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bounded session failed");
    }
  }, [sourceType, conversationId, start]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setBoundedActive(false);
    if (boundedTimerRef.current) { clearInterval(boundedTimerRef.current); boundedTimerRef.current = null; }
    if (boundedTimeoutRef.current) { clearTimeout(boundedTimeoutRef.current); boundedTimeoutRef.current = null; }
    if (visualSessionId) {
      void fetch("/api/visual/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: visualSessionId, reason: "user_request" }) }).catch(()=>{});
      setVisualSessionId(null);
    }
    setMessage("Stopped. No frames are being sent.");
  }, [visualSessionId]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !active) {
      setError("Start the camera or share first.");
      return;
    }
    setError("");
    setMessage("Capturing and analyzing…");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) {
      setError("Could not capture image.");
      return;
    }
    const previewUrl = URL.createObjectURL(blob);
    setCaptured(previewUrl);
    const form = new FormData();
    form.append("image", blob, "capture.jpg");
    form.append("sourceType", sourceType);
    if (conversationId) form.append("conversationId", conversationId);
    form.append("caption", `Analyze this ${sourceType} capture concisely.`);
    try {
      const res = await fetch("/api/vision/observe", { method: "POST", body: form });
      const data = (await res.json()) as {
        observation?: { id: string; analysis?: string | null };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? "Analysis failed.");
        setMessage("");
        return;
      }
      setObservationId(data.observation?.id ?? null);
      setAnalysis(data.observation?.analysis ?? "No analysis returned.");
      setMessage("Captured. Analysis below is only from this image — nothing is inferred beyond what is visible.");
    } catch {
      setError("Could not upload for analysis.");
    }
  }, [active, conversationId, sourceType]);

  const onUpload = useCallback(
    async (file: File) => {
      setError("");
      setMessage("Uploading and analyzing…");
      setAnalysis(null);
      setObservationId(null);
      setAttachMessage("");
      const previewUrl = URL.createObjectURL(file);
      setCaptured(previewUrl);
      const form = new FormData();
      form.append("image", file);
      form.append("sourceType", "upload");
      if (conversationId) form.append("conversationId", conversationId);
      form.append("caption", "Describe only what you can actually see in this image.");
      try {
        const res = await fetch("/api/vision/observe", { method: "POST", body: form });
        const data = (await res.json()) as {
          observation?: { id: string; analysis?: string | null };
          error?: { message?: string };
        };
        if (!res.ok) {
          setError(data.error?.message ?? "Analysis failed.");
          return;
        }
        setObservationId(data.observation?.id ?? null);
        setAnalysis(data.observation?.analysis ?? "No analysis returned.");
        setMessage("Upload analyzed. Shown source is the file you selected.");
      } catch {
        setError("Upload failed.");
      }
    },
    [conversationId],
  );

  const attachToConversation = useCallback(async () => {
    if (!observationId || !conversationId) {
      setError("Open a conversation in the Assistant and capture again, or paste the observation ID manually.");
      return;
    }
    setError("");
    setAttachMessage("Attaching to conversation…");
    try {
      const res = await fetch("/api/vision/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observationId, conversationId }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Could not attach to conversation.");
        setAttachMessage("");
        return;
      }
      setAttachMessage("Attached — the assistant can now reason about this observation in that conversation.");
    } catch {
      setError("Attach failed.");
      setAttachMessage("");
    }
  }, [conversationId, observationId]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (boundedTimerRef.current) clearInterval(boundedTimerRef.current);
      if (boundedTimeoutRef.current) clearTimeout(boundedTimeoutRef.current);
      if (captured) URL.revokeObjectURL(captured);
    };
  }, [captured]);

  return (
    <div className="stack">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="banner info" role="status">{message}</div> : null}

      <div className="card stack">
        <div className="spread">
          <h3 className="section-title">Vision</h3>
          <span className={`badge ${active ? "badge-green" : "badge-muted"}`}>{active ? `active: ${sourceType}` : "off — no frames are being sent"}</span>
        </div>
        <p className="section-sub">Camera and screen share start only after you click. Analysis uses only the captured source, shown below.</p>

        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value as typeof sourceType)}>
            <option value="camera">Camera</option>
            <option value="screen">Screen / tab / window</option>
          </select>
          {sourceType === "camera" ? (
            <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
              <option value="">Default camera</option>
              {devices.filter((d) => d.kind === "videoinput").map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 6)}`}</option>
              ))}
            </select>
          ) : null}
          {!active ? (
            <>
              <button className="btn btn-primary btn-sm" type="button" onClick={start}>
                Use {sourceType}
              </button>
              <button className="btn btn-sm" type="button" onClick={startBounded}>
                Watch briefly (2 min)
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary btn-sm" type="button" onClick={capture}>Capture & analyze</button>
              {boundedActive ? <span className="badge badge-green">bounded sampling 1/2s</span> : null}
              <button className="btn btn-sm btn-danger" type="button" onClick={stop}>Stop</button>
            </>
          )}
        </div>

        <div style={{ position: "relative", background: "#060e0b", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)", minHeight: 220 }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", display: active ? "block" : "none", maxHeight: 360, objectFit: "contain" }} />
          {!active ? <div className="empty" style={{ margin: 12 }}>Preview appears here when you start the camera or share. Nothing is captured until you press Capture or upload a file.</div> : null}
          {active ? <span className="badge badge-danger" style={{ position: "absolute", top: 10, left: 10 }}>● {sourceType} active</span> : null}
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />

        <div className="field">
          <label>Or upload an image/document (PNG, JPEG, WebP, GIF)</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
            }}
          />
        </div>

        {captured ? (
          <div>
            <p className="tiny muted">Captured source (shown exactly as sent):</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={captured} alt="Captured source" style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--line)", marginTop: 6 }} />
          </div>
        ) : null}

        {analysis ? (
          <div className="card" style={{ background: "var(--surface-2)" }}>
            <h4 style={{ marginBottom: 6 }}>What the assistant can see</h4>
            <p style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{analysis}</p>
            {observationId ? (
              <div style={{ marginTop: 10 }}>
                {conversationId ? (
                  <button className="btn btn-primary btn-sm" type="button" onClick={attachToConversation}>
                    Bring into conversation
                  </button>
                ) : (
                  <span className="tiny muted">Open a conversation in the Assistant, then return to attach. ID: {observationId.slice(0, 8)}</span>
                )}
                {attachMessage ? <span className="tiny muted" style={{ marginLeft: 8 }}>{attachMessage}</span> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
