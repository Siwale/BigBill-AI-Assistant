import { NextResponse } from "next/server";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { getEnv, hasOpenAiSpeech } from "@/lib/env";

/**
 * Mint ephemeral client credentials for browser-side provider sessions.
 * For Loop 2 we return a narrow-scoped, short-lived token only when the
 * server has an OpenAI key. No long-lived secret is ever sent to the browser.
 */
export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    if (!hasOpenAiSpeech()) {
      return NextResponse.json(
        { error: { code: "speech_not_configured", message: "Server speech not configured." } },
        { status: 409 },
      );
    }
    const env = getEnv();
    // Optional conversation association for audit/transcript trail
    let conversationId: string | null = null;
    try {
      const body = (await request.clone().json().catch(() => null)) as { conversationId?: string } | null;
      if (body?.conversationId && /^[0-9a-f-]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.conversationId)) {
        conversationId = body.conversationId;
      }
    } catch {
      conversationId = null;
    }
    if (conversationId) {
      const { conversations } = await import("@/db/schema");
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
          { status: 404 },
        );
      }
    }

    const realtimeModel = process.env.OPENAI_REALTIME_MODEL ?? "gpt-4o-realtime-preview-2024-12-17";
    // Current GA: POST /v1/realtime/client_secrets — returns ephemeral client secret for WebRTC
    try {
      const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: realtimeModel,
            audio: {
              output: { voice: "alloy" },
            },
          },
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          id?: string;
          value?: string;
          client_secret?: { value?: string; expires_at?: number };
          expires_at?: number;
          session?: { id?: string; model?: string };
        };
        // GA returns { value, expires_at } at top level or nested
        const secret = data.value ?? data.client_secret?.value ?? null;
        if (!secret) {
          return NextResponse.json(
            { error: { code: "ephemeral_malformed", message: "Provider did not return a client secret." } },
            { status: 502 },
          );
        }
        const expiresAt = data.expires_at ?? data.client_secret?.expires_at ?? Math.floor(Date.now() / 1000) + 60;
        const ephemeral = {
          id: data.id ?? data.session?.id ?? `sess_${Date.now().toString(36)}`,
          provider: "openai-realtime",
          clientSecret: secret,
          expiresAt: new Date(expiresAt * 1000).toISOString(),
          model: data.session?.model ?? realtimeModel,
          voice: "alloy",
        };
        return NextResponse.json({ ephemeral, correlationId });
      }
      // Fallback to legacy /v1/realtime/sessions for accounts still on that path
      const legacyRes = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: realtimeModel, voice: "alloy" }),
      });
      if (legacyRes.ok) {
        const data = (await legacyRes.json()) as {
          id?: string;
          client_secret?: { value?: string; expires_at?: number };
          expires_at?: number;
        };
        const secret = data.client_secret?.value ?? null;
        if (!secret) {
          return NextResponse.json(
            { error: { code: "ephemeral_malformed", message: "Legacy provider did not return a client secret." } },
            { status: 502 },
          );
        }
        const expiresAt = data.client_secret?.expires_at ?? data.expires_at ?? Math.floor(Date.now() / 1000) + 60;
        const ephemeral = {
          id: data.id ?? `sess_${Date.now().toString(36)}`,
          provider: "openai-realtime",
          clientSecret: secret,
          expiresAt: new Date(expiresAt * 1000).toISOString(),
          model: realtimeModel,
          voice: "alloy",
        };
        return NextResponse.json({ ephemeral, correlationId });
      }
      const text = await legacyRes.text().catch(() => "");
      return NextResponse.json(
        {
          error: {
            code: "realtime_not_available",
            message:
              "Realtime voice is not enabled for this OpenAI account/model. Use browser capture + server transcription fallback. Details: " +
              text.slice(0, 500),
          },
        },
        { status: 409 },
      );
    } catch (e) {
      return NextResponse.json(
        {
          error: {
            code: "ephemeral_failed",
            message: e instanceof Error ? e.message : "Could not mint ephemeral session.",
          },
        },
        { status: 502 },
      );
    }
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
