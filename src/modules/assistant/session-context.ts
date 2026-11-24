import type { Session } from "@/modules/auth/session";
import { getEffectiveAssistant } from "@/modules/profile/user-config";
import { getEnv } from "@/lib/env";

export type AssistantSessionContext = {
  assistant: { displayName: string; pronouns: string | null; gender: string | null; presentation: string | null; personaDescription: string | null };
  voice: { provider: string | null; voiceId: string | null; locale: string | null; rate: number | null; available: boolean };
  model: { provider: string | null; modelId: string | null };
  conversation: { id: string; archived: boolean };
  capabilities: string[];
};

export async function buildAssistantSessionContext(session: Session, conversationId: string): Promise<AssistantSessionContext> {
  const effective = await getEffectiveAssistant(session.user.tenantId, session.user.id);
  const env = getEnv();
  const provider = process.env.LLM_PROVIDER ?? "openai";
  const modelId = provider === "openai" ? env.OPENAI_MODEL : provider === "deepseek" ? env.DEEPSEEK_MODEL : env.OPENROUTER_MODEL;
  // Check voice availability: if provider is openai and key present, available
  const voiceAvailable = effective.voiceProvider ? true : false;
  return {
    assistant: {
      displayName: effective.displayName ?? session.profile.displayName ?? "your assistant",
      pronouns: effective.pronouns,
      gender: effective.gender,
      presentation: effective.presentation,
      personaDescription: effective.personaDescription,
    },
    voice: {
      provider: effective.voiceProvider,
      voiceId: effective.voiceId,
      locale: effective.voiceLocale,
      rate: effective.voiceRate,
      available: voiceAvailable,
    },
    model: { provider, modelId },
    conversation: { id: conversationId, archived: false },
    capabilities: ["tasks", "knowledge", "vision", "devices", "engineering"],
  };
}
