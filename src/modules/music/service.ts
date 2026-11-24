import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { musicFavorites } from "@/db/schema";
import type { MusicFavorite } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/modules/audit/service";

export function spotifyVoiceBlocked(): boolean {
  return true; // hard gate: voice control prohibited until written permission
}
export function appleMusicGate(): { allowed: boolean; reason: string } {
  return { allowed: false, reason: "Apple Music requires legal/terms review for commercial SaaS — disabled until approved." };
}

export async function listFavorites(tenantId: string, userId: string): Promise<MusicFavorite[]> {
  return db
    .select()
    .from(musicFavorites)
    .where(and(eq(musicFavorites.tenantId, tenantId), eq(musicFavorites.userId, userId)))
    .orderBy(desc(musicFavorites.createdAt))
    .limit(100);
}

export async function addFavorite(params: {
  tenantId: string;
  userId: string;
  provider: string;
  itemType: string;
  providerItemId: string;
  title: string;
  artist?: string;
  artworkUrl?: string;
  correlationId?: string;
}): Promise<MusicFavorite> {
  if (params.provider === "spotify") throw new ApiError(403, "Spotify voice control is blocked by developer policy until written permission.", "spotify_blocked");
  if (params.provider === "apple_music") {
    const gate = appleMusicGate();
    if (!gate.allowed) throw new ApiError(403, gate.reason, "apple_music_blocked");
  }
  const allowedProviders = ["local", "home_assistant", "spotify", "apple_music"];
  if (!allowedProviders.includes(params.provider)) throw new ApiError(400, "Unsupported provider", "invalid_provider");
  const [created] = await db
    .insert(musicFavorites)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      provider: params.provider,
      itemType: params.itemType,
      providerItemId: params.providerItemId,
      title: params.title.slice(0, 200),
      artist: params.artist?.slice(0, 200) ?? null,
      artworkUrl: params.artworkUrl?.slice(0, 500) ?? null,
    })
    .returning();
  if (!created) throw new ApiError(500, "Could not save favorite", "favorite_failed");
  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "music.favorite_added",
    entityType: "music_favorite",
    entityId: created.id,
    metadata: { provider: params.provider },
    correlationId: params.correlationId,
  });
  return created;
}

export async function removeFavorite(tenantId: string, userId: string, id: string): Promise<void> {
  const rows = await db
    .select()
    .from(musicFavorites)
    .where(and(eq(musicFavorites.id, id), eq(musicFavorites.tenantId, tenantId), eq(musicFavorites.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new ApiError(404, "Favorite not found", "favorite_not_found");
  await db.delete(musicFavorites).where(eq(musicFavorites.id, id));
  await recordAudit({ tenantId, actorUserId: userId, eventType: "music.favorite_removed", entityType: "music_favorite", entityId: id, metadata: {} });
}
