"use client";

import { useCallback, useRef, useState } from "react";

export type LiveState = "idle" | "requesting_permission" | "connecting" | "connected" | "listening" | "speaking" | "duplex" | "interrupted" | "muted" | "reconnecting" | "disconnected" | "error";

export function useLiveVoice(params: {
  selectedInputId?: string;
  selectedOutputId?: string;
  conversationId: string | null;
  onInputDelta: (text: string) => void;
  onInputFinal: (text: string) => void;
  onOutputDelta: (text: string) => void;
  onOutputFinal: (text: string) => void;
  onStateChange: (state: LiveState, message?: string) => void;
  onStream?: (stream: MediaStream | null, kind: "input" | "output") => void;
}) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<LiveState>("idle");
  const inputBufferRef = useRef("");
  const outputBufferRef = useRef("");

  const set = useCallback(
    (next: LiveState, msg?: string) => {
      setState(next);
      params.onStateChange(next, msg);
    },
    [params],
  );

  const cleanup = useCallback(() => {
    try {
      dcRef.current?.close();
    } catch {}
    dcRef.current = null;
    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const had = Boolean(streamRef.current);
    streamRef.current = null;
    if (had) params.onStream?.(null, "input");
    if (audioElRef.current) {
      audioElRef.current.pause();
      (audioElRef.current.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
      audioElRef.current.srcObject = null;
      audioElRef.current.remove();
      audioElRef.current = null;
      params.onStream?.(null, "output");
    }
    inputBufferRef.current = "";
    outputBufferRef.current = "";
  }, [params]);

  const connect = useCallback(async (): Promise<boolean> => {
    const conversationId = params.conversationId;
    if (!conversationId) {
      set("error", "No conversation selected.");
      return false;
    }
    set("requesting_permission");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: params.selectedInputId ? { deviceId: { exact: params.selectedInputId } } : true,
      });
    } catch (e) {
      set("error", e instanceof Error ? e.message : "Microphone permission denied.");
      return false;
    }
    streamRef.current = stream;
    params.onStream?.(stream, "input");
    set("connecting");

    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    // Remote audio
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;
      const audio = document.createElement("audio");
      audio.autoplay = true;
      if (params.selectedOutputId && typeof (audio as unknown as { setSinkId?: unknown }).setSinkId === "function") {
        (audio as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(params.selectedOutputId).catch(() => undefined);
      }
      audio.srcObject = remoteStream;
      audioElRef.current = audio;
      params.onStream?.(remoteStream, "output");
      void audio.play().catch(() => undefined);
      set("speaking");
    };

    let dcOpen = false;
    let pcConnected = false;
    const maybeConnected = () => {
      if (dcOpen && pcConnected) set("connected");
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "failed" || s === "closed") {
        set("error", `Peer ${s}`);
        cleanup();
        set("disconnected");
      } else if (s === "connected") {
        pcConnected = true;
        maybeConnected();
      } else if (s === "disconnected") {
        set("reconnecting");
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") set("error", "ICE failed");
    };

    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    const dc = pc.createDataChannel("live-events");
    dcRef.current = dc;

    // Create offer before server call so we can send it
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Server creates Live session and returns SDP answer
    try {
      const res = await fetch("/api/voice/live/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdpOffer: offer.sdp ?? "", conversationId }),
      });
      const data = (await res.json()) as { sdpAnswer?: string; error?: { message?: string } };
      if (!res.ok || !data.sdpAnswer) {
        // Fallback hint: if live not available, caller will try Realtime
        set("error", data.error?.message ?? "Live not available.");
        cleanup();
        set("disconnected");
        return false;
      }
      await pc.setRemoteDescription({ type: "answer", sdp: data.sdpAnswer });
    } catch (e) {
      set("error", e instanceof Error ? e.message : "Live session failed.");
      cleanup();
      set("disconnected");
      return false;
    }

    dc.onopen = () => {
      dcOpen = true;
      maybeConnected();
    };
    dc.onmessage = async (event) => {
      let msg: unknown;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (typeof msg !== "object" || msg === null || typeof (msg as { type?: unknown }).type !== "string") return;
      const t = (msg as { type: string; delta?: unknown; text?: unknown; transcript?: unknown; delegation_id?: unknown; id?: unknown; error?: { message?: unknown } }).type;
      const getStr = (v: unknown) => (typeof v === "string" ? v : "");

      if (t === "session.started") {
        set("connected");
      } else if (t === "session.input_transcript.delta") {
        const delta = getStr((msg as { delta?: unknown }).delta);
        if (delta) {
          inputBufferRef.current += delta;
          params.onInputDelta(delta);
          // Duplex: if we are speaking, show duplex
          set("duplex");
        }
      } else if (t === "session.input_transcript.done" || t === "session.input_transcript.completed") {
        const transcript = getStr((msg as { transcript?: unknown }).transcript) || inputBufferRef.current;
        if (transcript.trim()) params.onInputFinal(transcript.trim());
        inputBufferRef.current = "";
        set("listening");
      } else if (t === "session.output_transcript.delta") {
        const delta = getStr((msg as { delta?: unknown }).delta);
        if (delta) {
          outputBufferRef.current += delta;
          params.onOutputDelta(delta);
          set("speaking");
        }
      } else if (t === "session.output_transcript.done" || t === "session.output_transcript.completed") {
        const transcript = getStr((msg as { transcript?: unknown }).transcript) || outputBufferRef.current;
        if (transcript.trim()) params.onOutputFinal(transcript.trim());
        outputBufferRef.current = "";
        set("listening");
      } else if (t === "session.interrupted" || t === "input_audio_buffer.speech_started") {
        // Barge-in: user started speaking while Aida speaking
        set("interrupted");
        // Do not persist interrupted output as complete; buffer cleared
        outputBufferRef.current = "";
      } else if (t === "session.delegation.created") {
        const delegationId = getStr((msg as { delegation_id?: unknown }).delegation_id) || getStr((msg as { id?: unknown }).id);
        const transcript = inputBufferRef.current.trim() || getStr((msg as { transcript?: unknown }).transcript);
        // Call backend delegation (idempotent)
        try {
          const res = await fetch("/api/voice/live/delegation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId, delegationId, transcript: transcript.slice(0, 4000) }),
          });
          const data = (await res.json()) as { result?: string; error?: { message?: string } };
          const result = data.result ?? "I completed the workspace step.";
          // Send result back to Live session so it can speak it
          try {
            dc.send(JSON.stringify({ type: "session.delegation.result", delegation_id: delegationId, result }));
          } catch {}
          // Also persist as final output for transcript continuity
          params.onOutputFinal(result);
        } catch {
          try {
            dc.send(JSON.stringify({ type: "session.delegation.result", delegation_id: delegationId, result: "I could not complete that workspace step. Please try again." }));
          } catch {}
        }
      } else if (t === "error" && typeof (msg as { error?: { message?: unknown } }).error?.message === "string") {
        set("error", (msg as { error: { message: string } }).error.message);
      }
    };
    dc.onclose = () => {
      set("disconnected");
      cleanup();
    };
    dc.onerror = () => set("error", "Live data channel error");

    return true;
  }, [params, set, cleanup]);

  const disconnect = useCallback(() => {
    cleanup();
    set("disconnected");
  }, [cleanup, set]);

  const sendText = useCallback((text: string) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return;
    const trimmed = text.trim().slice(0, 4000);
    if (!trimmed) return;
    try {
      dc.send(JSON.stringify({ type: "session.input_text", text: trimmed }));
    } catch {}
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    set(muted ? "muted" : "listening");
    try {
      dcRef.current?.send(JSON.stringify({ type: muted ? "session.mute" : "session.unmute" }));
    } catch {}
  }, [set]);

  return { state, connect, disconnect, sendText, setMuted };
}
