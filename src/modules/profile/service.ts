import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { assistantProfiles } from "@/db/schema";
import type { AssistantProfile } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { validateDisplayName } from "@/lib/security/text";
import { recordAudit } from "@/modules/audit/service";

export type VoiceConfig = {
  provider?: string;
  voiceId?: string;
  language?: string;
  rate?: number;
};

export async function getAssistantProfile(tenantId: string): Promise<AssistantProfile> {
  const rows = await db
    .select()
    .from(assistantProfiles)
    .where(eq(assistantProfiles.tenantId, tenantId))
    .limit(1);
  const profile = rows[0];
  if (!profile) {
    throw new ApiError(500, "Assistant profile is missing for this workspace.", "profile_missing");
  }
  return profile;
}

/**
 * The user-assigned assistant name is validated, stored and audited. It is
 * never defaulted or hardcoded; a null display name means onboarding is not
 * complete and the UI must say "your assistant".
 */
export async function setAssistantName(params: {
  tenantId: string;
  userId: string;
  rawName: unknown;
  correlationId?: string;
}): Promise<AssistantProfile> {
  const validation = validateDisplayName(params.rawName);
  if (!validation.ok) {
    throw new ApiError(400, validation.error, "invalid_assistant_name");
  }

  const existing = await getAssistantProfile(params.tenantId);
  const [updated] = await db
    .update(assistantProfiles)
    .set({
      displayName: validation.value,
      onboardingCompletedAt: existing.onboardingCompletedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(assistantProfiles.tenantId, params.tenantId), eq(assistantProfiles.id, existing.id)))
    .returning();

  if (!updated) throw new ApiError(500, "Could not save the assistant profile.", "profile_update_failed");

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: existing.displayName ? "assistant.renamed" : "assistant.named",
    entityType: "assistant_profile",
    entityId: updated.id,
    metadata: {
      previousName: existing.displayName,
      newName: updated.displayName,
    },
    correlationId: params.correlationId,
  });

  return updated;
}

export async function updateVoiceConfig(params: {
  tenantId: string;
  userId: string;
  config: VoiceConfig;
  correlationId?: string;
}): Promise<AssistantProfile> {
  if (params.config.rate !== undefined && (params.config.rate < 0.5 || params.config.rate > 2)) {
    throw new ApiError(400, "Speech rate must be between 0.5 and 2.", "invalid_voice_rate");
  }
  if (params.config.language && !/^[a-zA-Z-]{2,12}$/.test(params.config.language)) {
    throw new ApiError(400, "Invalid language code.", "invalid_language");
  }
  if (params.config.voiceId && params.config.voiceId.length > 200) {
    throw new ApiError(400, "Invalid voice selection.", "invalid_voice");
  }

  const existing = await getAssistantProfile(params.tenantId);
  const nextConfig = {
    ...existing.voiceConfig,
    ...params.config,
  };
  const [updated] = await db
    .update(assistantProfiles)
    .set({ voiceConfig: nextConfig, updatedAt: new Date() })
    .where(eq(assistantProfiles.tenantId, params.tenantId))
    .returning();

  if (!updated) throw new ApiError(500, "Could not save voice settings.", "voice_update_failed");

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "assistant.voice_settings_updated",
    entityType: "assistant_profile",
    entityId: updated.id,
    metadata: { provider: nextConfig.provider, language: nextConfig.language, rate: nextConfig.rate },
    correlationId: params.correlationId,
  });
  return updated;
}

export async function updatePersona(params: {
  tenantId: string;
  userId: string;
  tone?: string;
  greetingStyle?: string;
  correlationId?: string;
}): Promise<AssistantProfile> {
  const existing = await getAssistantProfile(params.tenantId);
  const tone = params.tone?.slice(0, 60);
  const greetingStyle = params.greetingStyle?.slice(0, 120);
  const [updated] = await db
    .update(assistantProfiles)
    .set({
      personaConfig: { ...existing.personaConfig, ...(tone ? { tone } : {}), ...(greetingStyle ? { greetingStyle } : {}) },
      updatedAt: new Date(),
    })
    .where(eq(assistantProfiles.tenantId, params.tenantId))
    .returning();
  if (!updated) throw new ApiError(500, "Could not save persona settings.", "persona_update_failed");
  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "assistant.persona_updated",
    entityType: "assistant_profile",
    entityId: updated.id,
    metadata: { tone, greetingStyle },
    correlationId: params.correlationId,
  });
  return updated;
}
