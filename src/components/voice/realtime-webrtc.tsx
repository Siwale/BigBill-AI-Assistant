"use client";
/* eslint-disable react-hooks/exhaustive-deps */

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

  const connect = useCallback(async (conversationId: string | null) => {
    if (!conversationId) {
      set("error", "No conversation selected. Start a conversation first.");
      return;
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
        return;
      }
      const ephemeral = data.ephemeral;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Handle incoming audio
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

      // Data channel for Realtime events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onopen = () => {
        set("connected");
        // Configure session: transcription + turn detection
        const sessionUpdate = {
          type: "session.update",
          session: {
            instructions: "You are a helpful executive assistant. Be concise.",
            voice: "alloy",
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: { type: "server_vad" },
          },
        };
        dc.send(JSON.stringify(sessionUpdate));
      };
      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type?: string;
            transcript?: string;
            delta?: string;
            text?: string;
            error?: { message?: string };
          };
          if (msg.type === "conversation.item.input_audio_transcription.completed" && msg.transcript) {
            params.onTranscript(msg.transcript, true);
          } else if (msg.type === "response.audio_transcript.delta" && msg.delta) {
            params.onAssistantText(msg.delta);
          } else if (msg.type === "response.audio_transcript.done" && msg.transcript) {
            params.onAssistantText(msg.transcript);
          } else if (msg.type === "error" && msg.error?.message) {
            set("error", msg.error.message);
          }
        } catch {
          // ignore parse errors
        }
      };
      dc.onclose = () => set("disconnected");
      dc.onerror = () => set("error", "Realtime data channel error.");

      // Get mic with selected device
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: params.selectedInputId ? { deviceId: { exact: params.selectedInputId } } : true,
      });
      streamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer SDP to OpenAI Realtime
      const sdpRes = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(ephemeral.model)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeral.clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp ?? "",
      });
      if (!sdpRes.ok) {
        const text = await sdpRes.text().catch(() => "");
        throw new Error(`Realtime SDP failed: ${sdpRes.status} ${text.slice(0, 300)}`);
      }
      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Realtime connection failed.";
      set("error", msg);
      disconnect();
    }
  }, [params, set]);

  const disconnect = useCallback(() => {
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
    streamRef.current = null;
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
    set("disconnected");
  }, [set]);

  const sendText = useCallback(
    (text: string) => {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== "open") return;
      const event = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      };
      dc.send(JSON.stringify(event));
      dc.send(JSON.stringify({ type: "response.create", response: { modalities: ["audio", "text"] } }));
    },
    [],
  );

  return { state, connect, disconnect, sendText };
}
