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
    // For now we issue a synthetic ephemeral id; a future provider-specific
    // mint (e.g., OpenAI Realtime ephemeral) can replace this without changing
    // the client contract. Expiry is intentionally short.
    const ephemeral = {
      id: `eph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      provider: "openai",
      expiresAt: new Date(Date.now() + 90_000).toISOString(),
      model: env.OPENAI_MODEL,
      voice: "alloy",
    };
    return NextResponse.json({ ephemeral, correlationId });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
