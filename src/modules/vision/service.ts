import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, observations } from "@/db/schema";
import type { Observation } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/modules/audit/service";
import { getEnv } from "@/lib/env";
import OpenAI from "openai";

const MAX_BYTES = 8_000_000;

export async function createObservation(params: {
  tenantId: string;
  userId: string;
  conversationId?: string | null;
  sourceType: "camera" | "screen" | "upload";
  mimeType: string;
  buffer: Buffer;
  caption?: string;
  correlationId?: string;
}): Promise<Observation> {
  if (params.buffer.length > MAX_BYTES) {
    throw new ApiError(413, "Image is too large. Use an image under 8 MB.", "observation_too_large");
  }
  if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(params.mimeType)) {
    throw new ApiError(415, "Only PNG, JPEG, WebP or GIF images are supported for vision in this release.", "unsupported_mime");
  }

  // For Loop 2 we store analysis inline and do not persist raw bytes to disk
  // beyond the DB row; retention is transient by default. This keeps tenant
  // isolation trivial and avoids a new object store dependency.
  let analysis: string | null = null;
  let analysisModel: string | null = null;
  const env = getEnv();
  if (env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 1 });
      const base64 = params.buffer.toString("base64");
      const dataUrl = `data:${params.mimeType};base64,${base64}`;
      const response = await openai.chat.completions.create({
        model: env.OPENAI_MODEL || "gpt-4o-mini",
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  params.caption?.trim() ||
                  "Describe only what you can actually see in this image. Be concise, factual, and list visible text, objects, and any warnings. If nothing is legible, say so. Do not invent details.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      });
      analysis = response.choices[0]?.message.content?.trim() ?? null;
      analysisModel = env.OPENAI_MODEL;
    } catch {
      analysis = null;
    }
  }

  if (params.conversationId) {
    const conv = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, params.conversationId), eq(conversations.tenantId, params.tenantId)))
      .limit(1);
    if (!conv[0]) throw new ApiError(404, "Conversation not found for this tenant.", "conversation_not_found");
  }

  const [row] = await db
    .insert(observations)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      conversationId: params.conversationId ?? null,
      sourceType: params.sourceType,
      mimeType: params.mimeType,
      byteSize: params.buffer.length,
      caption: params.caption?.slice(0, 500) ?? null,
      analysis,
      analysisModel,
      retention: "transient",
    })
    .returning();
  if (!row) throw new ApiError(500, "Could not save observation.", "observation_failed");

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "vision.observation_created",
    entityType: "observation",
    entityId: row.id,
    metadata: { sourceType: row.sourceType, mimeType: row.mimeType, hasAnalysis: Boolean(analysis) },
    correlationId: params.correlationId,
  });

  return row;
}

export async function listObservations(tenantId: string, userId: string, limit = 20): Promise<Observation[]> {
  return db
    .select()
    .from(observations)
    .where(and(eq(observations.tenantId, tenantId), eq(observations.userId, userId)))
    .orderBy(desc(observations.createdAt))
    .limit(Math.min(limit, 50));
}

export async function getObservation(tenantId: string, userId: string, id: string): Promise<Observation> {
  const rows = await db
    .select()
    .from(observations)
    .where(and(eq(observations.id, id), eq(observations.tenantId, tenantId), eq(observations.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError(404, "Observation not found.", "observation_not_found");
  return row;
}
