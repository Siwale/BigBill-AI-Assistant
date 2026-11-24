import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { addToWatchlist, listWatchlist, whereToWatch } from "@/modules/movies/service";
import { db } from "@/db/client";
import { movieWatchlist } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const addSchema = z.object({
  provider: z.string().max(30).optional(),
  providerTitleId: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
});

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    const session = await requireApiSession();
    const [watchlist, availability] = await Promise.all([
      listWatchlist(session.user.tenantId, session.user.id),
      Promise.resolve(whereToWatch()),
    ]);
    return NextResponse.json({ watchlist, availability });
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
    const entry = await addToWatchlist({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      provider: input.provider,
      providerTitleId: input.providerTitleId,
      title: input.title,
      year: input.year ?? null,
      correlationId,
    });
    return NextResponse.json({ entry }, { status: 201 });
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
    const rows = await db.select().from(movieWatchlist).where(and(eq(movieWatchlist.id, id), eq(movieWatchlist.tenantId, session.user.tenantId))).limit(1);
    if (!rows[0]) return NextResponse.json({ error: { code: "not_found", message: "Not found" } }, { status: 404 });
    await db.delete(movieWatchlist).where(eq(movieWatchlist.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
