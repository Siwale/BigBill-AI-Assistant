# BigBill AI Assistant — Loop 1

A standalone, multi-tenant executive assistant with real text and voice. This repository is the Loop 1
release: one assistant per workspace, a user-assigned name, permissions, memory, knowledge retrieval,
tasks, drafts, incidents and an append-only audit trail.

Loop 2 has not been started. External sending, publishing, spending and destructive actions are
deliberately disabled.

## What works in Loop 1

- Email/password signup and login with an httpOnly, SameSite=Lax session cookie.
- First-use onboarding that asks the user to name the assistant. The name is stored in
  `assistant_profiles.display_name`, scoped to the tenant, used in the UI, prompts and spoken greeting,
  and can be changed in Settings. There is no hardcoded default.
- One conversation shared by text and voice, with the same profile, memory, permissions, tools and audit.
- Real speech input and output:
  - Browser `SpeechRecognition` where supported, with an authenticated OpenAI Whisper fallback.
  - Browser `speechSynthesis` where supported, with an authenticated OpenAI TTS fallback.
  - Visible listening/speaking/error states, interim transcript, stop-and-send and stop-speaking.
- Tasks (create, start, complete, reopen, cancel), local drafts (email, WhatsApp, marketing, Khapy brief),
  knowledge upload + hybrid search, memory, incident reporting and an audit view.
- Tenant-filtered hybrid retrieval (PostgreSQL FTS + pgvector, RRF), with lexical-only fallback when
  embeddings are unavailable.
- Permissioned tool execution: deny by default, scope checks server-side, schema validation, payload
  hashing, action records, and R3/R4 tools registered but blocked.
- Background worker for outbox dispatch, inbox processing and deduplicated overdue-task incidents.
- Health endpoint reporting measured database, model and speech-fallback status.

## Explicitly not connected

| System | Status | Gap |
| --- | --- | --- |
| BigBill BOS | Not connected | Admin API requires an approved service-auth path or an MFA-bound session. |
| Khapy | Not connected | Needs a member JWT, organisation membership and CORS approval. Local brief drafts only. |
| MotherTracker | Not connected | Needs a dedicated tenant-scoped user token. |

The UI and the assistant report these gaps; nothing is simulated.

## Stack

- Next.js 15 App Router, React 19, TypeScript strict.
- PostgreSQL 16 + pgvector, Drizzle ORM.
- Redis 7 + BullMQ for the worker.
- Provider-neutral model gateway (OpenAI, DeepSeek or OpenRouter).
- Zod contracts at every external boundary.

## Local setup

```bash
# 1. Start the local services
docker compose up -d

# 2. Install dependencies (pnpm is the package manager for this repo)
pnpm install

# 3. Create a git-ignored .env.local with a random AUTH_SECRET.
#    Optionally copy provider keys from an existing local env file without printing them:
node scripts/local-setup.mjs /path/to/existing/.env

# 4. Apply migrations and seed two synthetic QA tenants
pnpm db:migrate
pnpm db:seed

# 5. Run the app and the worker
pnpm dev
pnpm worker:dev
```

Open <http://localhost:3000>, create a workspace, name the assistant, approve the workspace permissions,
and start a conversation. Press the microphone to speak. Browser speech is used where available; the
server voice is the fallback.

Seeded QA accounts (local only): `owner@alpha.test` and `owner@beta.test` with the password printed by
`pnpm db:seed`. They have no assistant name, so the onboarding flow can be tested. Never use these
credentials outside this machine.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The tests cover name sanitisation and injection resistance, secret rejection, canonical payload hashing,
chunking, permission-catalogue invariants, tenant isolation across tasks/memory/incidents/knowledge/grants,
and the tool execution gate (permission denial, post-grant execution, R3 blocking, invalid arguments).

## Security invariants

- Every tenant-owned query is scoped by the server-resolved tenant. Client-supplied tenant IDs are not
  trusted.
- Model output is never authorization. Tool arguments are schema-validated and scopes are checked on every
  call.
- Retrieved documents and tool output are untrusted data, never instructions.
- Audit writes contain identifiers and outcomes, not message bodies or secrets.
- Approval records are bound to tenant, user, tool and a canonical payload hash; revoked grants block
  immediately.
- No always-on microphone. Capture starts only after an explicit click and shows a visible indicator.
- No secrets in the repository. `.env.local` is git-ignored and created with mode `0600`.

## Repository layout

```
src/app/            App Router pages and API routes
src/components/     Client UI (onboarding, chat, voice, workspace pages)
src/contracts/      Zod schemas and the creative-brief contract
src/db/             Drizzle schema and client
src/lib/            Env, HTTP, logging and security helpers
src/modules/        Auth, profile, assistant, conversations, permissions, tools,
                    tasks, drafts, knowledge, memory, incidents, audit, voice
worker/             BullMQ maintenance worker
scripts/            Migration, seed and local setup scripts
tests/              Unit and database integration tests
Docs/               Product, architecture, discovery and ADR material
```

The workspace directory is `AI_assistant` (not `Ai-assitant`); the repository was not renamed.
