import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { addFavorite, listFavorites, removeFavorite } from "@/modules/music/service";

const addSchema = z.object({
  provider: z.string().min(2).max(30),
  itemType: z.string().min(2).max(30),
  providerItemId: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  artist: z.string().max(200).optional(),
  artworkUrl: z.string().url().max(500).optional(),
});

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    const session = await requireApiSession();
    const favorites = await listFavorites(session.user.tenantId, session.user.id);
    return NextResponse.json({ favorites, gates: { spotifyVoiceBlocked: true, appleMusic: { allowed: false } } });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, addSchema);
    const fav = await addFavorite({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      provider: input.provider,
      itemType: input.itemType,
      providerItemId: input.providerItemId,
      title: input.title,
      artist: input.artist,
      artworkUrl: input.artworkUrl,
      correlationId,
    });
    return NextResponse.json({ favorite: fav }, { status: 201 });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
export async function DELETE(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: { code: "missing_id", message: "Missing id" } }, { status: 400 });
    await removeFavorite(session.user.tenantId, session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
