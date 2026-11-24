# ADR-005 — Tenant-Scoped Memory and Hybrid RAG

**Status:** Accepted for Loop 1  
**Date:** 2026-11-23

## Decision

- Knowledge is tenant-scoped: `knowledge_documents` → `knowledge_chunks` with `tenant_id` on every row.
- Ingestion: validated text/markdown upload, SHA-256 content hash, structure-aware-ish chunking (paragraph-aware, ~1,200 characters with small overlap), optional OpenAI `text-embedding-3-small` embeddings (1,536 dimensions) stored in pgvector.
- Retrieval: PostgreSQL full-text search plus vector similarity, combined with Reciprocal Rank Fusion. Tenant filter and document ACL are applied in SQL **before** content enters model context. Lexical retrieval remains available if embeddings fail.
- Citations carry document title, chunk index, source and retrieval time; the UI shows the sources used.
- Memory entries are explicit, categorised, provenance-tagged, editable, disable-able and deletable. The prompt includes only enabled entries for the current tenant/user.
- Secrets are never accepted as memory. Credential-like patterns are rejected and an incident is recorded if a user tries.
- Retrieved content is labelled untrusted in the prompt and cannot grant permissions or change policy.

## Out of scope for this loop

- Connector-sourced ingestion (BOS/Khapy/MotherTracker) until verified contracts exist.
- Reranking until an evaluation set demonstrates a benefit.
- PDF/OCR ingestion; only text/markdown is accepted, and the UI says so.
