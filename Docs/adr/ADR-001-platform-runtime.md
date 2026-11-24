# ADR-001 — Modular Monolith, Next.js, PostgreSQL and Redis

**Status:** Accepted for Loop 1  
**Date:** 2026-11-23

## Context

The workspace was empty apart from specifications. The ADR baseline recommends TypeScript end-to-end, Next.js App Router, PostgreSQL, pgvector, Redis/BullMQ and modular boundaries. Local evidence confirms Node 22.23.2, PostgreSQL with pgvector 0.8.1, Redis 7 and Docker.

## Decision

Build a modular monolith:

- `apps/web` — Next.js App Router UI + HTTP API (one deployable unit).
- `apps/worker` — TypeScript background worker using BullMQ and the same database/domain modules.
- `src/modules/*` — explicit domain boundaries: identity, assistant profile, conversations, permissions, tools, actions, tasks, drafts, incidents, audit, memory, knowledge/RAG, voice.
- `src/contracts/*` — Zod runtime contracts shared by server routes, tools and tests.
- `src/db` — Drizzle ORM schema and migrations against PostgreSQL + pgvector.

No separate API service, no second ORM, no agent framework, no microservice split. The orchestrator is a compact in-house loop with typed tool calls and persisted state.

## Consequences

- Simple local and VPS deployment; one build artifact plus one worker.
- Boundaries are enforced by module ownership and imports, not network hops.
- A future service split is possible along existing module boundaries.
- Worker must never duplicate domain logic; it imports the same services.

## Alternatives rejected

- Separate Express/Next APIs: unnecessary operational duplication at this scale.
- Agent framework (LangChain/LangGraph/Mastra): adds a second orchestration model; not justified.
- Hosted vector database: pgvector is available and sufficient.
- Starting with LiveKit as a required process: blocked by absent credentials and unverified network; see ADR-004.
