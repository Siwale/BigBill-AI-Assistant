import { NextResponse } from "next/server";
import { chatSchema } from "@/contracts";
import { ApiError, assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor, rateLimitOrThrow } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { runAssistantTurn } from "@/modules/assistant/orchestrator";

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    if (!session.profile.onboardingCompletedAt || !session.profile.displayName) {
      throw new ApiError(409, "Complete onboarding before chatting.", "onboarding_required");
    }
    rateLimitOrThrow(`chat:${session.user.id}`, 20, 60_000);
    const input = await parseJson(request, chatSchema);
    const outcome = await runAssistantTurn({
      session,
      conversationId: input.conversationId,
      message: input.message,
      channel: input.channel ?? "text",
      correlationId,
    });
    return NextResponse.json(outcome);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
