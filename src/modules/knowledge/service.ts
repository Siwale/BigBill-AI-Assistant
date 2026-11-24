import { and, desc, eq } from "drizzle-orm";
import { db, sqlClient } from "@/db/client";
import { knowledgeChunks, knowledgeDocuments } from "@/db/schema";
import type { KnowledgeDocument } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { sha256 } from "@/lib/security/text";
import { embedTexts } from "@/modules/assistant/model";
import { recordAudit } from "@/modules/audit/service";
import { openIncident } from "@/modules/incidents/service";

export type KnowledgeHit = {
  chunkId: string;
  documentId: string;
  title: string;
  sourceType: string;
  chunkIndex: number;
  content: string;
  score: number;
};

export type CitationView = {
  sourceId: string;
  title: string;
  chunkIndex: number;
  source?: string;
};

const MAX_CHUNKS = 40;

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const piece = paragraph.trim();
    if (!piece) continue;
    if (piece.length > 1600) {
      // Split long paragraphs on sentence-ish boundaries.
      const sentences = piece.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if ((current + " " + sentence).trim().length > 1200 && current) {
          chunks.push(current.trim());
          current = "";
        }
        current = `${current} ${sentence}`.trim();
      }
      continue;
    }
    if ((current + "\n\n" + piece).trim().length > 1200 && current) {
      chunks.push(current.trim());
      current = piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
    if (chunks.length >= MAX_CHUNKS) break;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.slice(0, MAX_CHUNKS);
}

function vectorLiteral(values: number[]): string {
  return `[${values.map((v) => Number(v.toFixed(8))).join(",")}]`;
}

export async function ingestDocument(params: {
  tenantId: string;
  userId: string;
  title: string;
  content: string;
  mimeType: string;
  correlationId?: string;
}): Promise<KnowledgeDocument> {
  const content = params.content.trim();
  if (content.length < 20) throw new ApiError(400, "The document is too short to index.", "document_too_short");
  if (content.length > 1_500_000) throw new ApiError(413, "The document is too large.", "document_too_large");

  const chunks = chunkText(content);
  if (chunks.length === 0) throw new ApiError(400, "No indexable text was found.", "document_empty");

  const [document] = await db
    .insert(knowledgeDocuments)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      title: params.title.trim().slice(0, 200) || "Untitled document",
      mimeType: params.mimeType,
      content,
      contentHash: sha256(content),
      status: "ready",
    })
    .returning();
  if (!document) throw new ApiError(500, "Could not save the document.", "document_create_failed");

  const embeddings = await embedTexts(chunks);
  if (!embeddings) {
    await db
      .update(knowledgeDocuments)
      .set({ errorMessage: "Indexed for lexical search only; embeddings are not configured." })
      .where(and(eq(knowledgeDocuments.id, document.id), eq(knowledgeDocuments.tenantId, params.tenantId)));
  }

  await db.insert(knowledgeChunks).values(
    chunks.map((chunk, index) => ({
      tenantId: params.tenantId,
      documentId: document.id,
      chunkIndex: index,
      content: chunk,
      // Drizzle's pgvector column accepts a number[] at this boundary.
      embedding: embeddings?.[index] ?? null,
    })),
  );

  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "knowledge.document_ingested",
    entityType: "knowledge_document",
    entityId: document.id,
    metadata: { chunks: chunks.length, vector: Boolean(embeddings) },
    correlationId: params.correlationId,
  });

  return document;
}

export async function listDocuments(tenantId: string, limit = 50): Promise<KnowledgeDocument[]> {
  return db
    .select()
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.tenantId, tenantId))
    .orderBy(desc(knowledgeDocuments.createdAt))
    .limit(Math.min(limit, 100));
}

export async function deleteDocument(params: {
  tenantId: string;
  userId: string;
  id: string;
  correlationId?: string;
}): Promise<void> {
  const deleted = await db
    .delete(knowledgeDocuments)
    .where(
      and(
        eq(knowledgeDocuments.id, params.id),
        eq(knowledgeDocuments.tenantId, params.tenantId),
        eq(knowledgeDocuments.userId, params.userId),
      ),
    )
    .returning({ id: knowledgeDocuments.id });
  if (deleted.length === 0) throw new ApiError(404, "Document not found.", "document_not_found");
  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "knowledge.document_deleted",
    entityType: "knowledge_document",
    entityId: params.id,
    metadata: {},
    correlationId: params.correlationId,
  });
}

type LexicalRow = {
  chunk_id: string;
  document_id: string;
  title: string;
  source_type: string;
  chunk_index: number;
  content: string;
  rank: number;
};

type VectorRow = LexicalRow;

/**
 * Hybrid retrieval: lexical FTS plus pgvector, combined with Reciprocal Rank
 * Fusion. The tenant filter is inside both SQL queries, before any content can
 * reach the model.
 */
export async function searchKnowledge(params: {
  tenantId: string;
  query: string;
  limit?: number;
}): Promise<KnowledgeHit[]> {
  const query = params.query.trim().slice(0, 500);
  if (query.length < 2) return [];
  const limit = Math.min(params.limit ?? 6, 12);

  let lexical: LexicalRow[] = [];
  try {
    lexical = await sqlClient<LexicalRow[]>`
      SELECT c.id AS chunk_id,
             c.document_id,
             d.title,
             d.source_type,
             c.chunk_index,
             c.content,
             ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', ${query})) AS rank
      FROM knowledge_chunks c
      JOIN knowledge_documents d ON d.id = c.document_id
      WHERE c.tenant_id = ${params.tenantId}
        AND d.tenant_id = ${params.tenantId}
        AND d.status = 'ready'
        AND to_tsvector('english', c.content) @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT 20
    `;
  } catch {
    lexical = [];
  }

  let vector: VectorRow[] = [];
  const queryEmbeddings = await embedTexts([query]);
  const queryVector = queryEmbeddings?.[0];
  if (queryVector) {
    try {
      const literal = vectorLiteral(queryVector);
      vector = await sqlClient<VectorRow[]>`
        SELECT c.id AS chunk_id,
               c.document_id,
               d.title,
               d.source_type,
               c.chunk_index,
               c.content,
               0::float8 AS rank
        FROM knowledge_chunks c
        JOIN knowledge_documents d ON d.id = c.document_id
        WHERE c.tenant_id = ${params.tenantId}
          AND d.tenant_id = ${params.tenantId}
          AND d.status = 'ready'
          AND c.embedding IS NOT NULL
        ORDER BY c.embedding <=> ${literal}::vector
        LIMIT 20
      `;
    } catch {
      vector = [];
    }
  }

  const fused = new Map<string, { row: LexicalRow; score: number }>();
  lexical.forEach((row, index) => {
    fused.set(row.chunk_id, { row, score: 1 / (60 + index + 1) });
  });
  vector.forEach((row, index) => {
    const existing = fused.get(row.chunk_id);
    const score = 1 / (60 + index + 1);
    if (existing) existing.score += score;
    else fused.set(row.chunk_id, { row, score });
  });

  return Array.from(fused.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      title: row.title,
      sourceType: row.source_type,
      chunkIndex: row.chunk_index,
      content: row.content,
      score,
    }));
}

export function toCitations(hits: KnowledgeHit[]): CitationView[] {
  return hits.slice(0, 6).map((hit) => ({
    sourceId: hit.documentId,
    title: hit.title,
    chunkIndex: hit.chunkIndex,
    source: hit.sourceType,
  }));
}

export async function recordEmbeddingFailure(tenantId: string, correlationId?: string): Promise<void> {
  await openIncident({
    tenantId,
    severity: "info",
    title: "Knowledge index is lexical-only",
    description: "Document search is working without vector embeddings because the embedding provider is unavailable.",
    impact: "Semantic recall is reduced; exact keyword search still works.",
    nextStep: "Configure an embedding provider or continue with lexical search.",
    source: "knowledge",
    dedupeKey: "knowledge.embeddings.unconfigured",
    correlationId,
  });
}
