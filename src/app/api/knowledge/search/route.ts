import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor, rateLimitOrThrow } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { searchKnowledge, toCitations } from "@/modules/knowledge/service";

export const runtime = "nodejs";

const searchSchema = z.object({ query: z.string().trim().min(2).max(500) });

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    rateLimitOrThrow(`knowledge-search:${session.user.id}`, 30, 60_000);
    const input = await parseJson(request, searchSchema);
    const hits = await searchKnowledge({
      tenantId: session.user.tenantId,
      query: input.query,
      limit: 8,
    });
    return NextResponse.json({
      hits: hits.map((hit) => ({
        chunkId: hit.chunkId,
        documentId: hit.documentId,
        title: hit.title,
        chunkIndex: hit.chunkIndex,
        content: hit.content,
        score: hit.score,
      })),
      citations: toCitations(hits),
    });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
