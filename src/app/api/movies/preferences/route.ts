import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { getMoviePreferences, upsertMoviePreferences } from "@/modules/movies/service";

const prefSchema = z.object({
  likedTitles: z.array(z.string().max(200)).max(50).optional(),
  dislikedTitles: z.array(z.string().max(200)).max(50).optional(),
  favoriteGenres: z.array(z.string().max(30)).max(20).optional(),
  favoriteActors: z.array(z.string().max(100)).max(20).optional(),
  regionCode: z.string().length(2).optional(),
  runtimeMin: z.number().int().min(30).max(400).nullable().optional(),
  runtimeMax: z.number().int().min(30).max(600).nullable().optional(),
  contentRating: z.string().max(10).nullable().optional(),
});

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    const session = await requireApiSession();
    const prefs = await getMoviePreferences(session.user.tenantId, session.user.id);
    return NextResponse.json({ preferences: prefs });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, prefSchema);
    const prefs = await upsertMoviePreferences({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      likedTitles: input.likedTitles,
      dislikedTitles: input.dislikedTitles,
      favoriteGenres: input.favoriteGenres,
      favoriteActors: input.favoriteActors,
      regionCode: input.regionCode,
      runtimeMin: input.runtimeMin,
      runtimeMax: input.runtimeMax,
      contentRating: input.contentRating,
      correlationId,
    });
    return NextResponse.json({ preferences: prefs });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
