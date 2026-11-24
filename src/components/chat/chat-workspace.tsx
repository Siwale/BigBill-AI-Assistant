"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  Check,
  Mic,
  MonitorUp,
  Plus,
  Send,
  ShieldAlert,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AudioVisualizer } from "@/components/voice/audio-visualizer";
import { ThemeSwitcher } from "@/components/theme/theme-provider";
import { useRealtimeVoice } from "@/components/voice/realtime-webrtc";
import { useLiveVoice } from "@/components/voice/live-webrtc";

type Citation = { sourceId: string; title: string; chunkIndex: number; source?: string };
type PermissionRequest = { connectorId: string; connectorName: string; scopes: string[] };
type ToolActivity = {
  toolId: string;
  status: string;
  summary?: string;
  permissionRequired?: PermissionRequest;
};
type ChatMessage = {
  id: string;
  role: string;
  content: string;
  channel: string;
  citations: Citation[];
  toolActivity: ToolActivity[];
  createdAt: string;
};
type ConversationSummary = { id: string; title: string; updatedAt: string };
type VoiceConfig = { provider?: string; voiceId?: string; language?: string; rate?: number };
type VoiceState = "idle" | "listening" | "transcribing" | "thinking" | "speaking" | "error";

type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string }; length: number };
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
};
type SpeechRecognitionErrorLike = { error: string; message?: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function getSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function MessageText({ content }: { content: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {items.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
  };

  content.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (/^[-*]\s+/.test(trimmed)) {
      bullets.push(trimmed.replace(/^[-*]\s+/, ""));
      return;
    }
    flushBullets();
    if (!trimmed) {
      blocks.push(<div key={`space-${index}`} style={{ height: 7 }} />);
      return;
    }
    if (trimmed.startsWith("### ")) {
      blocks.push(<h3 key={index}>{renderInline(trimmed.slice(4))}</h3>);
      return;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push(<h2 key={index}>{renderInline(trimmed.slice(3))}</h2>);
      return;
    }
    if (trimmed.startsWith("# ")) {
      blocks.push(<h2 key={index}>{renderInline(trimmed.slice(2))}</h2>);
      return;
    }
    blocks.push(
      <p key={index} style={{ margin: "3px 0" }}>
        {renderInline(line)}
      </p>,
    );
  });
  flushBullets();
  return <>{blocks}</>;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function toolLabel(toolId: string): string {
  return toolId.replace(/_/g, " ");
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}

const QUICK_PROMPTS = [
  { title: "Prepare my daily briefing", body: "Prepare my daily briefing from the workspace." },
  { title: "What are my open tasks?", body: "What are my open tasks, and which ones are overdue?" },
  { title: "Draft a client follow-up", body: "Draft a short follow-up email to a client I have not heard from this week." },
  { title: "What can't you do yet?", body: "Which integrations and actions are not available in this release?" },
];

export function ChatWorkspace({
  assistantName,
  userName,
  conversations: initialConversations,
  activeConversationId,
  initialMessages,
  voice,
}: {
  assistantName: string;
  userName: string;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  initialMessages: ChatMessage[];
  voice: VoiceConfig;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations);
  const [conversationId, setConversationIdState] = useState<string | null>(activeConversationId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [degraded, setDegraded] = useState(false);
  const [voiceMode, setVoiceModeState] = useState(false);
  const [voiceState, setVoiceStateRaw] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [granting, setGranting] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [devicePrefs, setDevicePrefs] = useState<{ inputId?: string; outputId?: string }>({});

  const conversationIdRef = useRef<string | null>(activeConversationId);
  const voiceModeRef = useRef(false);
  const sendingRef = useRef(false);
  const voiceStateRef = useRef<VoiceState>("idle");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const finalTranscriptRef = useRef("");
  const shouldSendRef = useRef(false);
  const voiceSessionRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micRafRef = useRef<number | null>(null);
  const micLevelStreamRef = useRef<MediaStream | null>(null);
  const playbackAnalyserRef = useRef<AnalyserNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackRafRef = useRef<number | null>(null);

  // Load saved device prefs for actual voice transport (honest, not diagnostics-only)
  const resolveDevicePrefs = useCallback(async () => {
    try {
      const data = (await fetch("/api/devices").then((r) =>
        r.json() as Promise<{ preference?: { preferredInputLabel?: string; preferredOutputLabel?: string } | null }>,
      )) as { preference?: { preferredInputLabel?: string; preferredOutputLabel?: string } | null };
      if (!data.preference) return;
      const devs = await navigator.mediaDevices.enumerateDevices();
      const input = devs.find((d) => d.kind === "audioinput" && d.label === data.preference?.preferredInputLabel);
      const output = devs.find((d) => d.kind === "audiooutput" && d.label === data.preference?.preferredOutputLabel);
      setDevicePrefs({ inputId: input?.deviceId, outputId: output?.deviceId });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void resolveDevicePrefs();
    const handler = () => void resolveDevicePrefs();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
  }, [resolveDevicePrefs]);

  const [liveEnabled, setLiveEnabled] = useState(false);
  const [liveCaption, setLiveCaption] = useState<{ input: string; output: string }>({ input: "", output: "" });
  const liveInputRef = useRef("");
  const liveOutputRef = useRef("");

  const live = useLiveVoice({
    selectedInputId: devicePrefs.inputId,
    selectedOutputId: devicePrefs.outputId,
    conversationId: conversationIdRef.current,
    onInputDelta: (delta) => {
      liveInputRef.current += delta;
      setLiveCaption((prev) => ({ ...prev, input: liveInputRef.current.slice(-500) }));
      setTranscript(liveInputRef.current.slice(-500));
    },
    onInputFinal: (text) => {
      liveInputRef.current = "";
      setLiveCaption((prev) => ({ ...prev, input: "" }));
      // Persist as single user message (channel live) without duplicate model call
      void sendMessage(text, "voice");
    },
    onOutputDelta: (delta) => {
      liveOutputRef.current += delta;
      setLiveCaption((prev) => ({ ...prev, output: liveOutputRef.current.slice(-800) }));
    },
    onOutputFinal: (text) => {
      liveOutputRef.current = "";
      setLiveCaption((prev) => ({ ...prev, output: "" }));
      // Live assistant transcript: persist once as assistant message via same conversation
      setMessages((prev) => [
        ...prev,
        {
          id: `live-assistant-${Date.now()}`,
          role: "assistant",
          content: text,
          channel: "live",
          citations: [],
          toolActivity: [],
          createdAt: new Date().toISOString(),
        },
      ]);
      setVoiceState("listening");
    },
    onStateChange: (state, msg) => {
      if (state === "connected" || state === "listening" || state === "duplex" || state === "speaking") {
        setVoiceState(state === "duplex" ? "listening" : (state as VoiceState));
        if (state === "duplex") setAudioLevel(0.7);
      } else if (state === "interrupted") {
        setVoiceState("listening");
        setTranscript("Interrupted — listening");
        setTimeout(() => setTranscript(""), 1500);
      } else if (state === "error") {
        setVoiceError(msg ?? "Live error");
        setVoiceState("error");
      } else if (state === "disconnected") {
        setVoiceState("idle");
        setLiveEnabled(false);
      }
    },
    onStream: (stream, kind) => {
      if (kind === "input") {
        if (!stream) {
          stopMicLevel();
          return;
        }
        try {
          if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
          if (micAudioContextRef.current) {
            void micAudioContextRef.current.close().catch(() => undefined);
            micAudioContextRef.current = null;
          }
          micAnalyserRef.current = null;
          const ac = new AudioContext();
          micAudioContextRef.current = ac;
          if (ac.state === "suspended") void ac.resume().catch(() => undefined);
          const source = ac.createMediaStreamSource(stream);
          const analyser = ac.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          micAnalyserRef.current = analyser;
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!micAnalyserRef.current) return;
            micAnalyserRef.current.getByteFrequencyData(data);
            const avg = data.reduce((s, v) => s + v, 0) / data.length / 255;
            setAudioLevel(avg);
            micRafRef.current = requestAnimationFrame(tick);
          };
          tick();
        } catch {}
      } else if (kind === "output") {
        // Output level handled via playback analyser if available, else system default
        if (!stream) setAudioLevel(0);
      }
    },
  });

  const realtime = useRealtimeVoice({
    selectedInputId: devicePrefs.inputId,
    selectedOutputId: devicePrefs.outputId,
    onStream: (stream) => {
      if (!stream) {
        stopMicLevel();
        return;
      }
      try {
        if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
        if (micAudioContextRef.current) {
          void micAudioContextRef.current.close().catch(() => undefined);
          micAudioContextRef.current = null;
        }
        micAnalyserRef.current = null;
        const ac = new AudioContext();
        micAudioContextRef.current = ac;
        if (ac.state === "suspended") void ac.resume().catch(() => undefined);
        const source = ac.createMediaStreamSource(stream);
        const analyser = ac.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        micAnalyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!micAnalyserRef.current) return;
          micAnalyserRef.current.getByteFrequencyData(data);
          const avg = data.reduce((s, v) => s + v, 0) / data.length / 255;
          setAudioLevel(avg);
          micRafRef.current = requestAnimationFrame(tick);
        };
        tick();
        stream.getTracks().forEach((t) => {
          const prev = t.onended as unknown as ((ev: Event) => void) | null;
          t.onended = (ev: Event) => {
            if (typeof prev === "function") prev(ev);
            stopMicLevel();
          };
        });
      } catch {
        // best effort
      }
    },
    onTranscript: (text, isFinal) => {
      if (isFinal) void sendMessage(text, "voice");
      else setTranscript(text);
    },
    onAssistantText: (text) => {
      setTranscript((prev) => (prev ? `${prev} ${text}` : text));
    },
    onStateChange: (state, msg) => {
      if (state === "connected") {
        setVoiceState("listening");
        setVoiceError("");
      } else if (state === "error") {
        setVoiceError(msg ?? "Realtime error. Falling back to server transcription.");
        setVoiceState("error");
        setRealtimeEnabled(false);
      } else if (state === "disconnected") {
        setVoiceState("idle");
        setRealtimeEnabled(false);
      }
    },
  });

  function setVoiceState(next: VoiceState) {
    voiceStateRef.current = next;
    setVoiceStateRaw(next);
  }

  function setVoiceMode(next: boolean) {
    voiceModeRef.current = next;
    setVoiceModeState(next);
  }

  function setConversationId(next: string | null) {
    conversationIdRef.current = next;
    setConversationIdState(next);
  }

  const stopMicLevel = useCallback(() => {
    if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
    micRafRef.current = null;
    micAnalyserRef.current = null;
    if (micAudioContextRef.current) {
      void micAudioContextRef.current.close().catch(() => undefined);
      micAudioContextRef.current = null;
    }
    micLevelStreamRef.current?.getTracks().forEach((t) => t.stop());
    micLevelStreamRef.current = null;
    setAudioLevel(0);
  }, []);

  const stopPlaybackLevel = useCallback(() => {
    if (playbackRafRef.current) cancelAnimationFrame(playbackRafRef.current);
    playbackRafRef.current = null;
    playbackAnalyserRef.current = null;
    if (playbackContextRef.current) {
      void playbackContextRef.current.close().catch(() => undefined);
      playbackContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startPlaybackLevel = useCallback((audio: HTMLAudioElement) => {
    try {
      const ac = new AudioContext();
      playbackContextRef.current = ac;
      const source = ac.createMediaElementSource(audio);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(ac.destination);
      playbackAnalyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!playbackAnalyserRef.current) return;
        playbackAnalyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length / 255;
        setAudioLevel(avg);
        playbackRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // playback level is best-effort
    }
  }, []);

  const startMicLevel = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: devicePrefs.inputId ? { deviceId: { exact: devicePrefs.inputId } } : true,
      });
      micLevelStreamRef.current = stream;
      const ac = new AudioContext();
      micAudioContextRef.current = ac;
      const source = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      micAnalyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!micAnalyserRef.current) return;
        micAnalyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length / 255;
        setAudioLevel(avg);
        micRafRef.current = requestAnimationFrame(tick);
      };
      tick();
      stream.getTracks().forEach((t) => {
        const prev = t.onended;
        t.onended = (ev: Event) => {
          if (typeof prev === "function") (prev as unknown as (ev: Event) => void)(ev);
          stopMicLevel();
        };
      });
    } catch {
      // level metering is best-effort; listening still works without it
    }
  }, [stopMicLevel]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, sending]);

  useEffect(() => {
    return () => {
      if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
      if (playbackRafRef.current) cancelAnimationFrame(playbackRafRef.current);
      if (micAudioContextRef.current) void micAudioContextRef.current.close().catch(() => undefined);
      if (playbackContextRef.current) void playbackContextRef.current.close().catch(() => undefined);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      micLevelStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioRef.current) {
        audioRef.current.pause();
        try {
          URL.revokeObjectURL(audioRef.current.src);
        } catch {
          // ignore
        }
      }
      realtime.disconnect();
      live.disconnect();
      const synth = getSynthesis();
      if (synth) synth.cancel();
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    stopPlaybackLevel();
    const synthesis = getSynthesis();
    if (synthesis) synthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (voiceStateRef.current === "speaking") setVoiceState("idle");
  }, []);

  const endVoiceSession = useCallback(async () => {
    const id = voiceSessionRef.current;
    if (!id) return;
    voiceSessionRef.current = null;
    try {
      await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", sessionId: id }),
        keepalive: true,
      });
    } catch {
      // Session bookkeeping is best effort; the local state already stopped.
    }
  }, []);

  const speak = useCallback(
    (text: string) => {
      const clean = text.replace(/[#*_`>]/g, "").trim();
      if (!clean) {
        setVoiceState("idle");
        return;
      }
      setVoiceState("speaking");
      const synthesis = getSynthesis();
      if (synthesis) {
        try {
          synthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(clean.slice(0, 1400));
          utterance.lang = voice.language || navigator.language || "en-US";
          utterance.rate = voice.rate ?? 1;
          if (voice.voiceId) {
            const match = synthesis
              .getVoices()
              .find((candidate) => candidate.name === voice.voiceId || candidate.voiceURI === voice.voiceId);
            if (match) utterance.voice = match;
          }
          utterance.onend = () => {
            if (voiceStateRef.current === "speaking") setVoiceState("idle");
          };
          utterance.onerror = () => {
            void speakWithServer(clean);
          };
          synthesis.speak(utterance);
          return;
        } catch {
          // Fall through to the authenticated server voice.
        }
      }
      void speakWithServer(clean);
    },
    [voice.language, voice.rate, voice.voiceId],
  );

  async function speakWithServer(text: string) {
    try {
      const response = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 4000) }),
      });
      if (!response.ok) throw new Error("tts failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.crossOrigin = "anonymous";
      if (devicePrefs.outputId && typeof (audio as unknown as { setSinkId?: unknown }).setSinkId === "function") {
        try {
          await (audio as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(devicePrefs.outputId);
        } catch {
          // fallback to system default, visible via device panel
        }
      }
      audioRef.current = audio;
      audio.onended = () => {
        stopPlaybackLevel();
        URL.revokeObjectURL(url);
        audioRef.current = null;
        if (voiceStateRef.current === "speaking") setVoiceState("idle");
      };
      audio.onerror = () => {
        stopPlaybackLevel();
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setVoiceError("Spoken reply is unavailable in this browser. The text reply is above.");
        setVoiceState("idle");
      };
      try {
        startPlaybackLevel(audio);
      } catch {
        // ignore
      }
      await audio.play();
    } catch {
      setVoiceError("Spoken reply is unavailable right now. The text reply is above.");
      setVoiceState("idle");
    }
  }

  const sendMessage = useCallback(
    async (rawText: string, channel: "text" | "voice") => {
      const text = rawText.trim();
      if (!text || sendingRef.current) return;
      sendingRef.current = true;
      setSending(true);
      setError("");
      setDegraded(false);

      const optimistic: ChatMessage = {
        id: `local-${Date.now()}`,
        role: "user",
        content: text,
        channel,
        citations: [],
        toolActivity: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((previous) => [...previous, optimistic]);

      try {
        let id = conversationIdRef.current;
        if (!id) {
          const created = await fetch("/api/conversations", { method: "POST" });
          const createdData = (await created.json()) as {
            conversation?: { id: string };
            error?: { message?: string };
          };
          if (!created.ok || !createdData.conversation) {
            throw new Error(createdData.error?.message ?? "Could not start a conversation.");
          }
          id = createdData.conversation.id;
          const newId = createdData.conversation.id;
          setConversationId(newId);
          setConversations((previous) => [
            { id: newId, title: "New conversation", updatedAt: new Date().toISOString() },
            ...previous,
          ]);
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", `/app?c=${newId}`);
          }
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: id, message: text, channel }),
        });
        const data = (await response.json()) as {
          conversationId?: string;
          content?: string;
          citations?: Citation[];
          toolActivity?: ToolActivity[];
          degraded?: boolean;
          error?: { message?: string };
        };
        if (!response.ok || !data.content) {
          setError(data.error?.message ?? "The assistant could not answer. Please try again.");
          setMessages((previous) => previous.filter((message) => message.id !== optimistic.id));
          setVoiceState("idle");
          return;
        }

        setMessages((previous) => [
          ...previous,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.content ?? "",
            channel,
            citations: data.citations ?? [],
            toolActivity: data.toolActivity ?? [],
            createdAt: new Date().toISOString(),
          },
        ]);
        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.id === id
              ? {
                  ...conversation,
                  title: conversation.title === "New conversation" ? text.slice(0, 70) : conversation.title,
                  updatedAt: new Date().toISOString(),
                }
              : conversation,
          ),
        );
        setDegraded(Boolean(data.degraded));

        if (channel === "voice" || voiceModeRef.current) {
          speak(data.content ?? "");
        } else if (voiceStateRef.current === "thinking") {
          setVoiceState("idle");
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not reach the assistant. Please try again.");
        setMessages((previous) => previous.filter((message) => message.id !== optimistic.id));
        setVoiceState("idle");
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [speak],
  );

  async function startVoiceSession(id: string, mode: "browser" | "server") {
    try {
      const response = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", conversationId: id, mode }),
      });
      if (response.ok) {
        const data = (await response.json()) as { voiceSession?: { id: string } };
        voiceSessionRef.current = data.voiceSession?.id ?? null;
      }
    } catch {
      voiceSessionRef.current = null;
    }
  }

  async function ensureConversationForVoice(): Promise<string | null> {
    if (conversationIdRef.current) return conversationIdRef.current;
    try {
      const created = await fetch("/api/conversations", { method: "POST" });
      const data = (await created.json()) as { conversation?: { id: string }; error?: { message?: string } };
      if (!created.ok || !data.conversation) {
        setVoiceError(data.error?.message ?? "Could not start a conversation.");
        return null;
      }
      setConversationId(data.conversation.id);
      setConversations((previous) => [
        { id: data.conversation!.id, title: "New conversation", updatedAt: new Date().toISOString() },
        ...previous,
      ]);
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `/app?c=${data.conversation.id}`);
      }
      return data.conversation.id;
    } catch {
      setVoiceError("Could not start a conversation.");
      return null;
    }
  }

  async function startListening() {
    if (realtimeEnabled) {
      const id = conversationIdRef.current || (await ensureConversationForVoice());
      if (!id) return;
      if (realtime.state !== "connected") {
        const ok = await realtime.connect(id);
        if (ok) return;
        setVoiceError((prev) => prev || "Realtime unavailable — using server transcription fallback.");
        // fall through to legacy path automatically
      } else {
        return;
      }
    }
    if (voiceStateRef.current === "listening") return;
    stopSpeaking();
    setVoiceError("");
    setTranscript("");
    setVoiceMode(true);

    const id = await ensureConversationForVoice();
    if (!id) return;

    const Recognition = getRecognitionCtor();
    if (Recognition) {
      await startVoiceSession(id, "browser");
      const recognition = new Recognition();
      recognition.lang = voice.language || navigator.language || "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      finalTranscriptRef.current = "";
      shouldSendRef.current = true;

      recognition.onresult = (event) => {
        let interim = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const piece = result?.[0]?.transcript ?? "";
          if (result?.isFinal) finalTranscriptRef.current += `${piece} `;
          else interim += piece;
        }
        setTranscript(`${finalTranscriptRef.current}${interim}`.trim());
      };

      recognition.onerror = (event) => {
        shouldSendRef.current = false;
        stopMicLevel();
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setVoiceError("Microphone permission was blocked. Allow the microphone in your browser, or type instead.");
        } else if (event.error === "no-speech") {
          setVoiceError("No speech was heard. Try again or type instead.");
        } else if (event.error === "audio-capture") {
          setVoiceError("No microphone was found. Check your device, or type instead.");
        } else if (event.error !== "aborted") {
          setVoiceError("Speech recognition stopped. You can try again or type.");
        }
        setVoiceState("idle");
        void endVoiceSession();
      };

      recognition.onend = () => {
        stopMicLevel();
        if (voiceStateRef.current === "listening") setVoiceState("idle");
        void endVoiceSession();
        const text = finalTranscriptRef.current.trim();
        if (shouldSendRef.current && text) {
          shouldSendRef.current = false;
          setVoiceState("thinking");
          void sendMessage(text, "voice");
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setVoiceState("listening");
        void startMicLevel();
      } catch {
        setVoiceError("The microphone could not start. Check your browser permissions.");
        setVoiceState("idle");
        void endVoiceSession();
      }
      return;
    }

    // Fallback: record audio and transcribe with the authenticated server voice.
    await startVoiceSession(id, "server");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: devicePrefs.inputId ? { deviceId: { exact: devicePrefs.inputId } } : true,
      });
      streamRef.current = stream;
      // real level from the same stream (honest, not fake)
      try {
        const ac = new AudioContext();
        micAudioContextRef.current = ac;
        const source = ac.createMediaStreamSource(stream);
        const analyser = ac.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        micAnalyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!micAnalyserRef.current) return;
          micAnalyserRef.current.getByteFrequencyData(data);
          const avg = data.reduce((s, v) => s + v, 0) / data.length / 255;
          setAudioLevel(avg);
          micRafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // level is best-effort
      }
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stopMicLevel();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) {
          setVoiceState("idle");
          void endVoiceSession();
          return;
        }
        setVoiceState("transcribing");
        const form = new FormData();
        form.append("audio", blob, "speech.webm");
        if (voice.language) form.append("language", voice.language);
        try {
          const response = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          const data = (await response.json()) as { text?: string; error?: { message?: string } };
          if (!response.ok || !data.text) {
            setVoiceError(data.error?.message ?? "Could not transcribe the recording.");
            setVoiceState("idle");
            return;
          }
          setTranscript(data.text);
          setVoiceState("thinking");
          void sendMessage(data.text, "voice");
        } catch {
          setVoiceError("Could not transcribe the recording. Please try again or type.");
          setVoiceState("idle");
        } finally {
          void endVoiceSession();
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setVoiceState("listening");
    } catch {
      setVoiceError("Microphone access was blocked. Allow the microphone or type your message.");
      setVoiceState("idle");
      void endVoiceSession();
    }
  }

  function stopListening() {
    if (realtimeEnabled) {
      realtime.disconnect();
      stopMicLevel();
      setVoiceState("idle");
      setRealtimeEnabled(false);
      void endVoiceSession();
      return;
    }
    stopMicLevel();
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        setVoiceState("idle");
      }
      return;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      recorderRef.current = null;
      return;
    }
    setVoiceState("idle");
    void endVoiceSession();
  }

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        try {
          recognition.abort();
        } catch {
          // ignore
        }
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const synthesis = getSynthesis();
      if (synthesis) synthesis.cancel();
      if (audioRef.current) audioRef.current.pause();
      const id = voiceSessionRef.current;
      if (id) {
        voiceSessionRef.current = null;
        void fetch("/api/voice/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end", sessionId: id }),
          keepalive: true,
        }).catch(() => undefined);
      }
    };
  }, []);

  function submitText(event: React.FormEvent) {
    event.preventDefault();
    const text = input;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    if (liveEnabled && text.trim()) {
      live.sendText(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `live-user-${Date.now()}`,
          role: "user",
          content: text,
          channel: "live",
          citations: [],
          toolActivity: [],
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }
    void sendMessage(text, "text");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitText(event);
    }
  }

  function resizeTextarea() {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 180)}px`;
  }

  async function newConversation() {
    try {
      const response = await fetch("/api/conversations", { method: "POST" });
      const data = (await response.json()) as { conversation?: { id: string }; error?: { message?: string } };
      if (!response.ok || !data.conversation) {
        setError(data.error?.message ?? "Could not start a conversation.");
        return;
      }
      setConversationId(data.conversation.id);
      setConversations((previous) => [
        { id: data.conversation!.id, title: "New conversation", updatedAt: new Date().toISOString() },
        ...previous,
      ]);
      setMessages([]);
      setError("");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `/app?c=${data.conversation.id}`);
      }
    } catch {
      setError("Could not start a conversation.");
    }
  }

  async function grantPermission(request: PermissionRequest) {
    setGranting(request.connectorId);
    setError("");
    try {
      const response = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorId: request.connectorId, scopes: request.scopes }),
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setError(data.error?.message ?? "Could not grant the permission.");
        return;
      }
      setMessages((previous) =>
        previous.map((message) => ({
          ...message,
          toolActivity: message.toolActivity.map((activity) =>
            activity.permissionRequired?.connectorId === request.connectorId
              ? { ...activity, status: "completed", summary: `Permission granted for ${request.connectorName}. Ask again to continue.` }
              : activity,
          ),
        })),
      );
    } catch {
      setError("Could not grant the permission.");
    } finally {
      setGranting(null);
    }
  }

  const voiceLabel =
    voiceState === "listening"
      ? "Listening — speak now"
      : voiceState === "transcribing"
        ? "Transcribing your speech…"
        : voiceState === "thinking"
          ? `${assistantName} is working on it…`
          : voiceState === "speaking"
            ? `${assistantName} is speaking`
            : voiceState === "error"
              ? "Voice needs attention"
              : "";

  const voiceClass =
    voiceState === "listening"
      ? "voice-bar listening"
      : voiceState === "speaking"
        ? "voice-bar speaking"
        : voiceState === "error"
          ? "voice-bar error"
          : "voice-bar";

  return (
    <div className="chat-layout">
      <aside className="conv-rail" aria-label="Conversations">
        <div className="conv-rail-head">
          <button className="btn btn-primary btn-sm" type="button" onClick={newConversation}>
            <Plus size={14} /> New conversation
          </button>
          <p className="tiny muted" style={{ margin: 0 }}>
            Text and voice share every conversation.
          </p>
        </div>
        <div className="conv-list">
          {conversations.length === 0 ? (
            <p className="conv-empty">No conversations yet. Say hello below.</p>
          ) : (
            conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/app?c=${conversation.id}`}
                className={`conv-item${conversation.id === conversationId ? " active" : ""}`}
                title={conversation.title}
              >
                {conversation.title}
              </Link>
            ))
          )}
        </div>
      </aside>

      <section className="chat-main">
        <header className="chat-head">
          <div>
            <h1>{assistantName}</h1>
            <p className="chat-head-sub">
              Executive Assistant · {userName} · {voice.provider === "openai" ? "Server voice fallback ready" : "Browser voice preferred"}
            </p>
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <ThemeSwitcher small />
            <button
              className={`btn btn-sm ${liveEnabled ? "btn-primary" : ""}`}
              type="button"
              onClick={async () => {
                if (liveEnabled) {
                  live.disconnect();
                  setLiveEnabled(false);
                  setVoiceState("idle");
                } else {
                  const id = conversationIdRef.current || (await ensureConversationForVoice());
                  if (!id) return;
                  setLiveEnabled(true);
                  const ok = await live.connect();
                  if (!ok) {
                    setLiveEnabled(false);
                    // Fallback to Realtime if Live not available
                    setRealtimeEnabled(true);
                    await realtime.connect(id);
                  }
                }
              }}
              title={liveEnabled ? "Live connected — full-duplex, barge-in ready" : "Start live conversation (GPT-Live full-duplex)"}
            >
              {liveEnabled ? "Live ●" : "Start live conversation"}
            </button>
            {liveEnabled ? (
              <button className="btn btn-sm" type="button" onClick={() => live.setMuted(true)} title="Mute microphone (keep session)">
                Mute
              </button>
            ) : null}
            {liveEnabled ? (
              <button className="btn btn-sm" type="button" onClick={() => live.setMuted(false)} title="Unmute">
                Unmute
              </button>
            ) : null}
            <button
              className={`btn btn-sm ${realtimeEnabled ? "btn-primary" : ""}`}
              type="button"
              onClick={async () => {
                if (realtimeEnabled) {
                  realtime.disconnect();
                  setRealtimeEnabled(false);
                  setVoiceState("idle");
                } else {
                  const id = conversationIdRef.current || (await ensureConversationForVoice());
                  if (!id) return;
                  setRealtimeEnabled(true);
                  await realtime.connect(id);
                }
              }}
              title={realtimeEnabled ? "Realtime connected" : "Realtime fallback (record/transcribe)"}
            >
              {realtimeEnabled ? "Realtime on" : "Realtime"}
            </button>
            <button
              className={`voice-toggle${voiceMode ? " on" : ""}`}
              type="button"
              onClick={() => setVoiceMode(!voiceMode)}
              title="Speak every assistant reply aloud"
            >
              {voiceMode ? <Volume2 size={14} /> : <VolumeX size={14} />}
              Voice replies {voiceMode ? "on" : "off"}
            </button>
          </div>
        </header>

        <div className="chat-scroll" ref={scrollRef}>
          <div className="chat-inner">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <div className="mark" aria-hidden>
                  {assistantName.slice(0, 1).toUpperCase()}
                </div>
                <h2>Hello {userName.split(" ")[0]}. I&apos;m {assistantName}.</h2>
                <p>
                  Ask me to organise your day, prepare a briefing, track a task or draft something. You can
                  type or press the microphone and speak. I will tell you when something is not connected or
                  not allowed.
                </p>
                <div className="quick-grid">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.title}
                      className="quick-btn"
                      type="button"
                      onClick={() => void sendMessage(prompt.body, "text")}
                    >
                      <strong>{prompt.title}</strong>
                      {prompt.body}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const isAssistant = message.role === "assistant";
                const permissions = message.toolActivity
                  .map((activity) => activity.permissionRequired)
                  .filter((request): request is PermissionRequest => Boolean(request))
                  .filter(
                    (request, index, list) =>
                      list.findIndex((candidate) => candidate.connectorId === request.connectorId) === index,
                  );
                return (
                  <article className="message" key={message.id}>
                    <div className={`message-avatar ${isAssistant ? "assistant" : "user"}`} aria-hidden>
                      {isAssistant ? assistantName.slice(0, 1).toUpperCase() : initials(userName)}
                    </div>
                    <div className="message-body">
                      <div className="message-meta">
                        <strong>{isAssistant ? assistantName : userName}</strong>
                        <span>{formatTime(message.createdAt)}</span>
                        {message.channel === "voice" ? <span className="badge badge-green">voice</span> : null}
                      </div>
                      <div className="message-text">
                        <MessageText content={message.content} />
                      </div>
                      {message.toolActivity.length > 0 ? (
                        <div className="tool-strip">
                          {message.toolActivity.map((activity, index) => (
                            <span
                              key={`${activity.toolId}-${index}`}
                              className={`tool-chip${
                                activity.status === "completed"
                                  ? " ok"
                                  : activity.status === "permission_required" || activity.status === "failed"
                                    ? " warn"
                                    : ""
                              }`}
                              title={activity.summary ?? activity.toolId}
                            >
                              {activity.status === "completed" ? <Check size={11} /> : <AlertTriangle size={11} />}
                              {toolLabel(activity.toolId)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {message.citations.length > 0 ? (
                        <div className="citation-row">
                          {message.citations.map((citation, index) => (
                            <span key={`${citation.sourceId}-${index}`} className="citation">
                              {citation.title} · chunk {citation.chunkIndex + 1}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {permissions.map((request) => (
                        <div className="permission-card" key={request.connectorId}>
                          <span>
                            <ShieldAlert size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                            Permission needed for {request.connectorName}: {request.scopes.join(", ")}.
                          </span>
                          <button
                            className="btn btn-sm btn-primary"
                            type="button"
                            onClick={() => void grantPermission(request)}
                            disabled={granting === request.connectorId}
                          >
                            {granting === request.connectorId ? "Granting…" : "Grant"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })
            )}
            {sending ? (
              <div className="message">
                <div className="message-avatar assistant" aria-hidden>
                  {assistantName.slice(0, 1).toUpperCase()}
                </div>
                <div className="message-body">
                  <div className="message-meta">
                    <strong>{assistantName}</strong>
                  </div>
                  <div className="thinking" aria-label="Working">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="composer-wrap">
          {degraded ? (
            <div className="banner warn" style={{ maxWidth: 760, margin: "0 auto 10px" }}>
              This reply is degraded: the assistant could not complete a verified model or tool step. Your
              message was saved.
            </div>
          ) : null}
          {error ? (
            <div className="error" role="alert" style={{ maxWidth: 760, margin: "0 auto 10px" }}>
              {error}
            </div>
          ) : null}
          <div style={{ maxWidth: 760, margin: "0 auto 10px" }}>
            <AudioVisualizer audioState={liveEnabled ? "duplex" : voiceState} level={audioLevel} />
          </div>
          {liveEnabled ? (
            <div className="banner info" style={{ maxWidth: 760, margin: "0 auto 10px", fontSize: 13 }}>
              <div><strong>You:</strong> {liveCaption.input || <span className="tiny muted">listening…</span>}</div>
              <div><strong>Aida:</strong> {liveCaption.output || <span className="tiny muted">—</span>}</div>
              <div className="tiny muted">Full-duplex • barge-in: speak to interrupt • typed messages stay in same conversation</div>
            </div>
          ) : null}
          {voiceState !== "idle" || voiceError ? (
            <div className={voiceClass} role="status" aria-live="polite">
              <span className="voice-indicator">
                {voiceState === "listening" || voiceState === "speaking" ? (
                  <span className="wave" aria-hidden>
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                ) : voiceState === "transcribing" || voiceState === "thinking" ? (
                  <span className="thinking" style={{ padding: 0 }}>
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  <AlertTriangle size={15} />
                )}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{voiceLabel}</div>
                {transcript ? <div className="voice-transcript">{transcript}</div> : null}
                {voiceError ? <div className="tiny">{voiceError}</div> : null}
              </div>
              <div className="voice-actions">
                {voiceState === "listening" ? (
                  <button className="btn btn-sm" type="button" onClick={stopListening}>
                    <Square size={12} /> Stop &amp; send
                  </button>
                ) : null}
                {voiceState === "speaking" ? (
                  <button className="btn btn-sm" type="button" onClick={stopSpeaking}>
                    <Square size={12} /> Stop speaking
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <form className="composer" onSubmit={submitText}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                resizeTextarea();
              }}
              onKeyDown={onKeyDown}
              placeholder={`Message ${assistantName}…`}
              rows={1}
              aria-label={`Message ${assistantName}`}
              disabled={sending}
            />
            <div className="composer-bar">
              <div className="composer-tools">
                <button
                  className={`btn btn-icon${voiceState === "listening" ? " btn-danger" : ""}`}
                  type="button"
                  onClick={() => (voiceState === "listening" ? stopListening() : void startListening())}
                  title={voiceState === "listening" ? "Stop listening and send" : "Speak to your assistant"}
                  aria-label={voiceState === "listening" ? "Stop listening" : "Start voice input"}
                  aria-pressed={voiceState === "listening"}
                >
                  {voiceState === "listening" ? <Square size={15} /> : <Mic size={16} />}
                </button>
                <a href="/app/devices" className="btn btn-sm btn-ghost" title="Test devices"><MonitorUp size={14} /> Devices</a>
                <a href="/app/vision" className="btn btn-sm btn-ghost" title="Show vision"><Camera size={14} /> Vision</a>
                <span className="composer-note">
                  {voiceState === "listening"
                    ? "Listening. Press stop when you finish."
                    : "Type, mic, or show something."}
                </span>
              </div>
              <button
                className="send-btn"
                type="submit"
                disabled={sending || input.trim().length === 0}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
          <p className="tiny muted" style={{ maxWidth: 760, margin: "8px auto 0", textAlign: "center" }}>
            No sending, publishing, spending or destructive actions are enabled in this release.
          </p>
        </div>
      </section>
    </div>
  );
}
