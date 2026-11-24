import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { moviePreferences, movieWatchlist } from "@/db/schema";
import type { MoviePreference, MovieWatchlistEntry } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/modules/audit/service";

export async function getMoviePreferences(tenantId: string, userId: string): Promise<MoviePreference | null> {
  const rows = await db
    .select()
    .from(moviePreferences)
    .where(and(eq(moviePreferences.tenantId, tenantId), eq(moviePreferences.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertMoviePreferences(params: {
  tenantId: string;
  userId: string;
  likedTitles?: string[];
  dislikedTitles?: string[];
  favoriteGenres?: string[];
  favoriteActors?: string[];
  regionCode?: string;
  runtimeMin?: number | null;
  runtimeMax?: number | null;
  contentRating?: string | null;
  correlationId?: string;
}): Promise<MoviePreference> {
  const region = (params.regionCode ?? "ZM").toUpperCase().slice(0, 2);
  if (!/^[A-Z]{2}$/.test(region)) throw new ApiError(400, "Invalid region", "invalid_region");
  const existing = await getMoviePreferences(params.tenantId, params.userId);
  if (existing) {
    const [updated] = await db
      .update(moviePreferences)
      .set({
        likedTitles: params.likedTitles ?? existing.likedTitles,
        dislikedTitles: params.dislikedTitles ?? existing.dislikedTitles,
        favoriteGenres: params.favoriteGenres ?? existing.favoriteGenres,
        favoriteActors: params.favoriteActors ?? existing.favoriteActors,
        regionCode: region,
        runtimeMin: params.runtimeMin ?? existing.runtimeMin,
        runtimeMax: params.runtimeMax ?? existing.runtimeMax,
        contentRating: params.contentRating ?? existing.contentRating,
        updatedAt: new Date(),
      })
      .where(eq(moviePreferences.id, existing.id))
      .returning();
    return updated ?? existing;
  }
  const [created] = await db
    .insert(moviePreferences)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      likedTitles: params.likedTitles ?? [],
      dislikedTitles: params.dislikedTitles ?? [],
      favoriteGenres: params.favoriteGenres ?? [],
      favoriteActors: params.favoriteActors ?? [],
      regionCode: region,
      runtimeMin: params.runtimeMin ?? null,
      runtimeMax: params.runtimeMax ?? null,
      contentRating: params.contentRating ?? null,
    })
    .returning();
  if (!created) throw new ApiError(500, "Could not save preferences", "prefs_failed");
  return created;
}

export async function listWatchlist(tenantId: string, userId: string): Promise<MovieWatchlistEntry[]> {
  return db
    .select()
    .from(movieWatchlist)
    .where(and(eq(movieWatchlist.tenantId, tenantId), eq(movieWatchlist.userId, userId)))
    .orderBy(desc(movieWatchlist.addedAt))
    .limit(100);
}

export async function addToWatchlist(params: {
  tenantId: string;
  userId: string;
  provider?: string;
  providerTitleId: string;
  title: string;
  year?: number | null;
  correlationId?: string;
}): Promise<MovieWatchlistEntry> {
  const provider = params.provider ?? "manual";
  if (provider === "tmdb" && !process.env.TMDB_COMMERCIAL_LICENSED) {
    throw new ApiError(403, "TMDB commercial license required for production SaaS — use manual entry or search handoff.", "tmdb_blocked");
  }
  const [created] = await db
    .insert(movieWatchlist)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      provider,
      providerTitleId: params.providerTitleId,
      title: params.title.slice(0, 300),
      year: params.year ?? null,
      status: "want_to_watch",
    })
    .returning();
  if (!created) throw new ApiError(500, "Could not add to watchlist", "watchlist_failed");
  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "movie.watchlist_added",
    entityType: "movie_watchlist",
    entityId: created.id,
    metadata: { provider },
    correlationId: params.correlationId,
  });
  return created;
}

export async function whereToWatch(): { status: string; note: string } {
  const tmdbLicensed = Boolean(process.env.TMDB_COMMERCIAL_LICENSED);
  const justWatchPartner = Boolean(process.env.JUSTWATCH_PARTNER_KEY);
  if (!tmdbLicensed && !justWatchPartner) {
    return {
      status: "handoff",
      note: "No licensed provider active. Use official search handoff — availability unverified for ZM. TMDB requires commercial license; JustWatch requires partner contract.",
    };
  }
  return { status: "verified", note: "Licensed provider active — availability verified." };
}
