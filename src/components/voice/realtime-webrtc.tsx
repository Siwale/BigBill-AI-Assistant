"use client";

import { useCallback, useRef, useState } from "react";

type RealtimeState = "idle" | "connecting" | "connected" | "disconnected" | "error";

type Ephemeral = {
  clientSecret: string;
  expiresAt: string;
  model: string;
  id: string;
};

export function useRealtimeVoice(params: {
  selectedInputId?: string;
  selectedOutputId?: string;
  onTranscript: (text: string, isFinal: boolean) => void;
  onAssistantText: (text: string) => void;
  onStateChange: (state: RealtimeState, message?: string) => void;
  onStream?: (stream: MediaStream | null) => void;
}) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<RealtimeState>("idle");

  const set = useCallback(
    (next: RealtimeState, msg?: string) => {
      setState(next);
      params.onStateChange(next, msg);
    },
    [params],
  );

  const cleanup = useCallback(() => {
    try {
      dcRef.current?.close();
    } catch {
      // ignore
    }
    dcRef.current = null;
    try {
      pcRef.current?.close();
    } catch {
      // ignore
    }
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const hadStream = Boolean(streamRef.current);
    streamRef.current = null;
    if (hadStream) params.onStream?.(null);
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.srcObject = null;
      audioElRef.current.remove();
      audioElRef.current = null;
    }
  }, [params]);

  const connect = useCallback(async (conversationId: string | null): Promise<boolean> => {
    if (!conversationId) {
      set("error", "No conversation selected. Start a conversation first.");
      return false;
    }
    set("connecting");
    try {
      const res = await fetch("/api/voice/ephemeral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = (await res.json()) as { ephemeral?: Ephemeral; error?: { message?: string; code?: string } };
      if (!res.ok || !data.ephemeral?.clientSecret) {
        set("error", data.error?.message ?? "Realtime not available. Using fallback.");
        return false;
      }
      const ephemeral = data.ephemeral;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      let dataChannelOpen = false;
      let peerConnected = false;
      const maybeSetConnected = () => {
        if (dataChannelOpen && peerConnected) set("connected");
      };

      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === "failed" || s === "disconnected" || s === "closed") {
          set("error", `Peer connection ${s}.`);
          cleanup();
          set("disconnected");
        } else if (s === "connected") {
          peerConnected = true;
          maybeSetConnected();
        }
      };
      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        if (s === "failed" || s === "disconnected") {
          set("error", `ICE ${s}.`);
        }
      };
      pc.onsignalingstatechange = () => {
        if (pc.signalingState === "closed") {
          set("disconnected");
        }
      };

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
        void audio.play().catch(() => undefined);
      };

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onopen = () => {
        dataChannelOpen = true;
        maybeSetConnected();
        // Server-controlled session config: transcription only, no autonomous
        // assistant audio — the existing orchestrator remains the sole reasoning
        // engine to avoid duplicate responses. Audio output is via selected
        // output device through orchestrator TTS.
        const sessionUpdate = {
          type: "session.update",
          session: {
            instructions: "You are a helpful executive assistant. Be concise and do not claim to perform business actions directly; route tool use via server.",
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: { type: "server_vad" },
          },
        };
        try {
          dc.send(JSON.stringify(sessionUpdate));
        } catch {
          set("error", "Failed to configure Realtime session.");
        }
      };
      dc.onmessage = (event) => {
        let msg: unknown;
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }
        if (typeof msg !== "object" || msg === null || typeof (msg as { type?: unknown }).type !== "string") return;
        const typed = msg as { type: string; transcript?: unknown; delta?: unknown; text?: unknown; error?: { message?: unknown } };
        // GA event names
        if (typed.type === "conversation.item.input_audio_transcription.completed" && typeof typed.transcript === "string" && typed.transcript.trim()) {
          params.onTranscript(typed.transcript.trim(), true);
        } else if (
          (typed.type === "response.output_audio_transcript.delta" || typed.type === "response.audio_transcript.delta") &&
          typeof typed.delta === "string" &&
          typed.delta
        ) {
          params.onAssistantText(typed.delta);
        } else if (
          (typed.type === "response.output_audio_transcript.done" || typed.type === "response.audio_transcript.done") &&
          typeof typed.transcript === "string" &&
          typed.transcript.trim()
        ) {
          params.onAssistantText(typed.transcript.trim());
        } else if (
          (typed.type === "response.output_text.delta" || typed.type === "response.text.delta") &&
          typeof typed.delta === "string" &&
          typed.delta
        ) {
          params.onAssistantText(typed.delta);
        } else if (typed.type === "error" && typeof typed.error?.message === "string") {
          set("error", typed.error.message);
        }
      };
      dc.onclose = () => {
        dataChannelOpen = false;
        set("disconnected");
        cleanup();
      };
      dc.onerror = () => set("error", "Realtime data channel error.");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: params.selectedInputId ? { deviceId: { exact: params.selectedInputId } } : true,
      });
      streamRef.current = stream;
      params.onStream?.(stream);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Current GA handshake
      const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeral.clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp ?? "",
      });
      if (!sdpRes.ok) {
        const text = await sdpRes.text().catch(() => "");
        throw new Error(`Realtime SDP failed: ${sdpRes.status} ${text.slice(0, 500)}`);
      }
      const answerSdp = await sdpRes.text();
      if (!answerSdp.trim().startsWith("v=")) {
        throw new Error(`Realtime SDP answer malformed (expected v=, got ${answerSdp.slice(0, 100)}).`);
      }
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Realtime connection failed.";
      set("error", msg);
      cleanup();
      set("disconnected");
      return false;
    }
  }, [params, set, cleanup]);

  const disconnect = useCallback(() => {
    cleanup();
    set("disconnected");
  }, [cleanup, set]);

  const sendText = useCallback(
    (text: string) => {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== "open") return;
      const trimmed = text.trim().slice(0, 4000);
      if (!trimmed) return;
      const event = {
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text: trimmed }] },
      };
      try {
        dc.send(JSON.stringify(event));
        dc.send(JSON.stringify({ type: "response.create", response: { modalities: ["audio", "text"] } }));
      } catch {
        // ignore
      }
    },
    [],
  );

  return { state, connect, disconnect, sendText };
}
