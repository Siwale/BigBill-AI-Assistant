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
    await requireApiSession();
    if (!hasOpenAiSpeech()) {
      return NextResponse.json(
        { error: { code: "speech_not_configured", message: "Server speech not configured." } },
        { status: 409 },
      );
    }
    const env = getEnv();
    // Attempt to mint a real OpenAI Realtime ephemeral session. If the
    // account/model is not available, fall back to an honest not-configured
    // response instead of a synthetic token.
    try {
      const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview",
          voice: "alloy",
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          id?: string;
          client_secret?: { value?: string; expires_at?: number };
          expires_at?: number;
        };
        const ephemeral = {
          id: data.id ?? `eph_${Date.now().toString(36)}`,
          provider: "openai-realtime",
          clientSecret: data.client_secret?.value ?? null,
          expiresAt: data.client_secret?.expires_at
            ? new Date(data.client_secret.expires_at * 1000).toISOString()
            : data.expires_at
              ? new Date(data.expires_at * 1000).toISOString()
              : new Date(Date.now() + 60_000).toISOString(),
          model: "gpt-4o-realtime-preview",
          voice: "alloy",
          raw: data,
        };
        // Never log the secret; return it once for the browser WebRTC handshake.
        return NextResponse.json({ ephemeral, correlationId });
      }
      const text = await res.text().catch(() => "");
      // If Realtime is not enabled for this account, return honest gap.
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
