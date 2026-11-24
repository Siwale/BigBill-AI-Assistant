import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { assistantProfiles, userAssistantConfigs } from "@/db/schema";
import type { UserAssistantConfig } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { validateDisplayName } from "@/lib/security/text";
import { recordAudit } from "@/modules/audit/service";

export type EffectiveAssistant = {
  displayName: string | null;
  pronouns: string | null;
  gender: string | null;
  presentation: string | null;
  personaDescription: string | null;
  voiceProvider: string | null;
  voiceId: string | null;
  voiceLocale: string | null;
  voiceRate: number | null;
  source: "user" | "tenant";
};

export async function getEffectiveAssistant(tenantId: string, userId: string): Promise<EffectiveAssistant> {
  const [userRow] = await db.select().from(userAssistantConfigs).where(and(eq(userAssistantConfigs.tenantId, tenantId), eq(userAssistantConfigs.userId, userId))).limit(1);
  const [tenantRow] = await db.select().from(assistantProfiles).where(eq(assistantProfiles.tenantId, tenantId)).limit(1);
  if (userRow?.displayName) {
    return {
      displayName: userRow.displayName,
      pronouns: userRow.pronouns ?? null,
      gender: userRow.gender ?? null,
      presentation: userRow.presentation ?? null,
      personaDescription: userRow.personaDescription ?? null,
      voiceProvider: userRow.voiceProvider ?? null,
      voiceId: userRow.voiceId ?? null,
      voiceLocale: userRow.voiceLocale ?? null,
      voiceRate: userRow.voiceRate ?? null,
      source: "user",
    };
  }
  return {
    displayName: tenantRow?.displayName ?? null,
    pronouns: (tenantRow?.personaConfig as { pronouns?: string })?.pronouns ?? null,
    gender: null,
    presentation: null,
    personaDescription: (tenantRow?.personaConfig as { greetingStyle?: string })?.greetingStyle ?? null,
    voiceProvider: (tenantRow?.voiceConfig as { provider?: string })?.provider ?? null,
    voiceId: (tenantRow?.voiceConfig as { voiceId?: string })?.voiceId ?? null,
    voiceLocale: (tenantRow?.voiceConfig as { language?: string })?.language ?? null,
    voiceRate: (tenantRow?.voiceConfig as { rate?: number })?.rate ?? null,
    source: "tenant",
  };
}

export async function upsertUserAssistantConfig(params: {
  tenantId: string;
  userId: string;
  displayName?: unknown;
  pronouns?: string | null;
  gender?: string | null;
  presentation?: string | null;
  personaDescription?: string | null;
  voiceProvider?: string | null;
  voiceId?: string | null;
  voiceLocale?: string | null;
  voiceRate?: number | null;
  correlationId?: string;
}): Promise<UserAssistantConfig> {
  if (params.displayName !== undefined) {
    const v = validateDisplayName(params.displayName);
    if (!v.ok) throw new ApiError(400, v.error, "invalid_assistant_name");
    params.displayName = v.value;
  }
  if (params.pronouns && params.pronouns.length > 30) throw new ApiError(400, "Pronouns too long", "invalid_pronouns");
  if (params.gender && !["female", "male", "non-binary", "neutral", "custom", "not_specified"].includes(params.gender)) throw new ApiError(400, "Invalid gender", "invalid_gender");
  if (params.voiceId && params.voiceId.length > 200) throw new ApiError(400, "Invalid voice", "invalid_voice");

  const [existing] = await db.select().from(userAssistantConfigs).where(and(eq(userAssistantConfigs.tenantId, params.tenantId), eq(userAssistantConfigs.userId, params.userId))).limit(1);
  if (existing) {
    const [updated] = await db.update(userAssistantConfigs).set({
      ...(params.displayName !== undefined ? { displayName: params.displayName as string } : {}),
      ...(params.pronouns !== undefined ? { pronouns: params.pronouns } : {}),
      ...(params.gender !== undefined ? { gender: params.gender } : {}),
      ...(params.presentation !== undefined ? { presentation: params.presentation } : {}),
      ...(params.personaDescription !== undefined ? { personaDescription: params.personaDescription } : {}),
      ...(params.voiceProvider !== undefined ? { voiceProvider: params.voiceProvider } : {}),
      ...(params.voiceId !== undefined ? { voiceId: params.voiceId } : {}),
      ...(params.voiceLocale !== undefined ? { voiceLocale: params.voiceLocale } : {}),
      ...(params.voiceRate !== undefined ? { voiceRate: params.voiceRate } : {}),
      updatedAt: new Date(),
    }).where(eq(userAssistantConfigs.id, existing.id)).returning();
    if (!updated) throw new ApiError(500, "Could not save assistant config", "config_update_failed");
    await recordAudit({ tenantId: params.tenantId, actorUserId: params.userId, eventType: "assistant.user_config_updated", entityType: "user_assistant_config", entityId: updated.id, metadata: { displayName: updated.displayName }, correlationId: params.correlationId });
    return updated;
  }
  const [created] = await db.insert(userAssistantConfigs).values({
    tenantId: params.tenantId,
    userId: params.userId,
    displayName: (params.displayName as string) ?? null,
    pronouns: params.pronouns ?? null,
    gender: params.gender ?? null,
    presentation: params.presentation ?? null,
    personaDescription: params.personaDescription ?? null,
    voiceProvider: params.voiceProvider ?? null,
    voiceId: params.voiceId ?? null,
    voiceLocale: params.voiceLocale ?? null,
    voiceRate: params.voiceRate ?? null,
  }).returning();
  if (!created) throw new ApiError(500, "Could not create assistant config", "config_create_failed");
  await recordAudit({ tenantId: params.tenantId, actorUserId: params.userId, eventType: "assistant.user_config_created", entityType: "user_assistant_config", entityId: created.id, metadata: {}, correlationId: params.correlationId });
  return created;
}
