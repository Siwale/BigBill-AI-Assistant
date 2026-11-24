import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { getEnv, hasOpenAiSpeech } from "@/lib/env";

const bodySchema = z.object({
  sdpOffer: z.string().min(10).max(200_000),
  conversationId: z.string().uuid(),
  voiceId: z.string().max(30).optional(),
  interjectionMode: z.enum(["patient", "conversational", "urgent_only"]).optional(),
});

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();

    if (process.env.LIVE_VOICE_ENABLED !== "true") {
      return NextResponse.json(
        { error: { code: "live_disabled", message: "Live voice is disabled. Enable LIVE_VOICE_ENABLED=true to use GPT-Live." } },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!hasOpenAiSpeech()) {
      return NextResponse.json(
        { error: { code: "speech_not_configured", message: "Server speech not configured." } },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const raw = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "invalid_body", message: "Invalid request body." } },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const { sdpOffer, conversationId, voiceId, interjectionMode } = parsed.data;

    // Validate conversation belongs to tenant
    const { conversations, assistantProfiles } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const { db } = await import("@/db/client");
    const rows = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, session.user.tenantId)))
      .limit(1);
    if (!rows[0]) {
      return NextResponse.json(
        { error: { code: "conversation_not_found", message: "Conversation not found for this tenant." } },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Load assistant profile for server-controlled instructions (never from browser)
    const profileRows = await db
      .select()
      .from(assistantProfiles)
      .where(eq(assistantProfiles.tenantId, session.user.tenantId))
      .limit(1);
    const assistantName = profileRows[0]?.displayName ?? "Aida";
    const tone = (profileRows[0]?.personaConfig as { tone?: string })?.tone ?? "concise and helpful";
    const mode = interjectionMode ?? "patient";
    const instructions = `You are ${assistantName}, a helpful executive assistant. Tone: ${tone}. Interjection mode: ${mode} (patient=wait, conversational=brief interjection at pauses, urgent_only=interrupt only for critical alerts). Listen while speaking (full-duplex). Delegate business work via client delegation; do not perform tools directly. Be concise.`;

    const env = getEnv();
    const liveModel = process.env.OPENAI_LIVE_MODEL ?? "gpt-live-1.1";
    const safetyId = createHash("sha256").update(`${session.user.tenantId}:${session.user.id}`).digest("hex").slice(0, 32);

    // Server creates GPT-Live WebRTC session; browser SDP offer is forwarded per WebRTC quickstart
    const liveRes = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": safetyId,
      },
      body: JSON.stringify({
        model: liveModel,
        transport: { type: "webrtc" },
        delegation: { type: "client" },
        audio: {
          input: { transcription: { model: "whisper-1" } },
          output: { voice: voiceId ?? "alloy" },
        },
        instructions,
        // SDP offer is exchanged via the live/calls endpoint after session creation in some flows;
        // for the documented WebRTC flow with transport webrtc, some implementations POST SDP to /v1/live/calls.
        // We support both: create session then exchange SDP via /v1/live/calls if needed.
      }),
    });

    if (!liveRes.ok) {
      const text = await liveRes.text().catch(() => "");
      // Map 404/403 to honest not_available without leaking raw key
      return NextResponse.json(
        {
          error: {
            code: "live_not_available",
            message: `GPT-Live not available for this account/model (${liveModel}). Use record/transcribe fallback. Details: ${text.slice(0, 500)}`,
          },
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const liveData = (await liveRes.json()) as {
      id?: string;
      session_id?: string;
      expires_at?: number;
      model?: string;
    };
    const sessionId = liveData.id ?? liveData.session_id ?? `live_${Date.now().toString(36)}`;
    const expiresAt = liveData.expires_at ? new Date(liveData.expires_at * 1000).toISOString() : new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Now exchange SDP: POST to /v1/live/calls with the offer
    const callsRes = await fetch("https://api.openai.com/v1/live/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/sdp",
        "OpenAI-Safety-Identifier": safetyId,
      },
      body: sdpOffer,
    });

    const ct = callsRes.headers.get("content-type") ?? "";
    if (!callsRes.ok || !ct.includes("application/sdp")) {
      const text = await callsRes.text().catch(() => "");
      return NextResponse.json(
        { error: { code: "live_sdp_failed", message: `Live SDP exchange failed: ${text.slice(0, 500)}` } },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
    const answerSdp = await callsRes.text();
    if (!answerSdp.trim().startsWith("v=")) {
      return NextResponse.json(
        { error: { code: "live_sdp_malformed", message: "Live SDP answer malformed." } },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        sessionId,
        model: liveData.model ?? liveModel,
        expiresAt,
        sdpAnswer: answerSdp,
        correlationId,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
