"use client";

import { useState } from "react";
import { AidaAvatarStage } from "./aida-avatar-stage";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import type { TimedViseme } from "@/modules/voice/viseme";
import type { AidaCoreState } from "./aida-core";

type Props = {
  assistantName: string;
  userName: string;
  conversations: { id: string; title: string; updatedAt: string }[];
  activeConversationId: string | null;
  initialMessages: { id: string; role: string; content: string; channel: string; citations: { sourceId: string; title: string; chunkIndex: number; source?: string }[]; toolActivity: { toolId: string; status: string; summary?: string; permissionRequired?: { connectorId: string; connectorName: string; scopes: string[] } }[]; createdAt: string }[];
  voice: { provider?: string; voiceId?: string; language?: string; rate?: number };
  initialAsk?: string | null;
  initialMic?: boolean;
};

export function CommandHome({ assistantName, userName, conversations, activeConversationId, initialMessages, voice, initialAsk, initialMic }: Props) {
  const [visemes, setVisemes] = useState<TimedViseme[] | null>(null);
  const [audioStartMs, setAudioStartMs] = useState<number | null>(null);
  const [avatarState, setAvatarState] = useState<AidaCoreState>("idle");
  const [level, setLevel] = useState(0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
        <AidaAvatarStage state={avatarState} height={340} level={level} visemes={visemes} audioStartMs={audioStartMs} />
        <div className="aida-panel" style={{ padding: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, letterSpacing: 1, color: "var(--aida-cyan-4)" }}>Current Focus</h3>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--aida-text)" }}>Ready for your next command. Ask {assistantName} to review a repository, prepare a briefing, or manage devices.</p>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, background: "rgba(31,159,233,0.1)", border: "1px solid var(--aida-border)", padding: "4px 8px", borderRadius: 20, color: "var(--aida-text)" }}>Loop 4 · Engineering Intelligence</span>
            <span style={{ fontSize: 11, background: "rgba(190,141,89,0.12)", border: "1px solid var(--aida-amber)", padding: "4px 8px", borderRadius: 20, color: "var(--aida-amber-bright)" }}>Voice + Text Unified</span>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--aida-text-muted)" }}>One continuous conversation — older turns are archived and stay searchable.</div>
        </div>
      </div>
      <ChatWorkspace
        assistantName={assistantName}
        userName={userName}
        conversations={conversations}
        activeConversationId={activeConversationId}
        initialMessages={initialMessages}
        voice={voice}
        initialAsk={initialAsk ?? null}
        initialMic={initialMic ?? false}
        onViseme={(v, start) => {
          setVisemes(v);
          setAudioStartMs(start);
          if (v) setAvatarState("speaking");
          else setAvatarState("idle");
        }}
        onLevel={(l) => setLevel(l)}
        onAvatarState={(s) => setAvatarState(s as AidaCoreState)}
      />
    </div>
  );
}
