import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { getEnv, hasOpenAiSpeech } from "@/lib/env";

/**
 * Mint ephemeral client credentials for browser-side provider sessions.
 * For Loop 2 we return a narrow-scoped, short-lived token only when the
 * server has an OpenAI key. No long-lived secret is ever sent to the browser.
 */
const bodySchema = z.object({ conversationId: z.string().uuid().optional() });

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    if (!hasOpenAiSpeech()) {
      return NextResponse.json(
        { error: { code: "speech_not_configured", message: "Server speech not configured." } },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    const env = getEnv();

    let parsed: z.infer<typeof bodySchema> = {};
    try {
      const raw = await request.json();
      const result = bodySchema.safeParse(raw);
      if (!result.success) {
        return NextResponse.json(
          { error: { code: "invalid_body", message: "Invalid request body." } },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      parsed = result.data;
    } catch {
      parsed = {};
    }

    if (parsed.conversationId) {
      const { conversations } = await import("@/db/schema");
      const { and, eq } = await import("drizzle-orm");
      const { db } = await import("@/db/client");
      const rows = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, parsed.conversationId), eq(conversations.tenantId, session.user.tenantId)))
        .limit(1);
      if (!rows[0]) {
        return NextResponse.json(
          { error: { code: "conversation_not_found", message: "Conversation not found for this tenant." } },
          { status: 404, headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    const realtimeModel = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime";
    const safetyId = createHash("sha256")
      .update(`${session.user.tenantId}:${session.user.id}`)
      .digest("hex")
      .slice(0, 32);

    try {
      const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Safety-Identifier": safetyId,
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: realtimeModel,
            audio: { output: { voice: "alloy" } },
          },
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return NextResponse.json(
          {
            error: {
              code: "realtime_not_available",
              message: "Realtime voice is not enabled for this account/model. Use fallback. Details: " + text.slice(0, 500),
            },
          },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      const data = (await res.json()) as {
        id?: string;
        value?: string;
        client_secret?: { value?: string; expires_at?: number };
        expires_at?: number;
        session?: { id?: string; model?: string };
      };
      const secret = data.value ?? data.client_secret?.value ?? null;
      const expiresAt = data.expires_at ?? data.client_secret?.expires_at ?? null;
      if (!secret || !expiresAt) {
        return NextResponse.json(
          { error: { code: "ephemeral_malformed", message: "Provider did not return a client secret or expiry." } },
          { status: 502, headers: { "Cache-Control": "no-store" } },
        );
      }
      const ephemeral = {
        id: data.id ?? data.session?.id ?? `sess_${Date.now().toString(36)}`,
        provider: "openai-realtime",
        clientSecret: secret,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        model: data.session?.model ?? realtimeModel,
        voice: "alloy",
      };
      return NextResponse.json({ ephemeral, correlationId }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      return NextResponse.json(
        {
          error: {
            code: "ephemeral_failed",
            message: e instanceof Error ? e.message : "Could not mint ephemeral session.",
          },
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
