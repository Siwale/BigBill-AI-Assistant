# Integration Audit — Read-Only Evidence

**Date:** 2026-11-23  
**Method:** independent specialist sub-agent, bounded read-only inspection. No secrets printed. No files modified in sibling repositories.

## Summary

| System | Actual location | Real API? | Auth | Loop 1 decision |
|---|---|---|---|---|
| BigBill BOS | `/home/bill/BigBill Systems/bigbill-corporate` (`/admin/bos`, `/api/admin/bos/*`) | Yes | Admin session cookie or bearer **plus signed MFA cookie** (`catalog-admin-mfa`) | **Not connected.** Displayed as “needs credentials + MFA”; no fake data. |
| Khapy | `/home/bill/BigBill Systems/Khapy` | Yes | Bearer JWT (15 min) + refresh; organisation membership; CORS allowlist; no service-account API key | **Contract + creative-brief draft only.** No live call in Loop 1; connection shown as not configured. |
| MotherTracker | `/home/bill/BigBill Systems/rushtrucking` | Yes | Custom HMAC bearer with `tenantId`/`userId`/`roles`; tenant-scoped | **Not connected.** Fleet data remains authoritative in MotherTracker. |

No OpenAPI document exists for any of the three. No connector was exercised against a live environment.

## Khapy evidence

- API: Express mount table in `apps/api/src/main.ts`, prefix `/api/v1`.
- Creative brief: `POST /api/v1/creative-intelligence/briefs` in `apps/api/src/creative-intelligence/router.ts`; canonical schema in `apps/api/src/campaign-media/creative-brief.ts`; evidence-gated (`400 NO_EVIDENCE`).
- Campaign creation: `apps/api/src/campaigns-v2/router.ts`.
- Media creation/approval: `apps/api/src/campaign-media/router.ts`.
- Auth: `packages/auth/src/jwt.ts`; memberships re-checked per route.
- Gap: no API-key/service-token path; a dedicated Khapy user and CORS addition would be required. No credentials were supplied, so no live integration is claimed.

## BigBill BOS evidence

- Leads: `src/app/api/admin/bos/crm/route.ts`, `src/lib/bos/crm.ts`.
- Tasks: `src/app/api/admin/bos/tasks/route.ts`.
- Company data: `settings`, `finance`, `customers`, `quotes`, `invoices`, `campaigns`, `marketing` under `src/app/api/admin/bos/`.
- Auth: `src/lib/auth.ts`, `src/lib/catalog/queries.ts`, `src/lib/catalog/admin-mfa.ts`.
- Gap: `canManageBos` requires an MFA cookie in addition to the session/bearer. A headless server-to-server integration is not possible without a new service auth path or an explicitly approved MFA flow.

## MotherTracker evidence

- API: Fastify bootstrap `apps/api/src/index.ts`, local port 4100, no `/api` prefix.
- Fleet: `/fleet/live`, `/fleet/live/delta`, `/fleet/positions/latest`, `/fleet/registry`, `/fleet/summary`, `/vehicles`, `/trips`.
- Auth: `apps/api/src/middleware/auth.ts`, `apps/api/src/lib/auth.ts`. Bearer payload contains tenant/user/roles.
- Gap: needs a dedicated tenant-scoped user token; no read-only service abstraction found.

## Messaging / email

Existing providers in sibling products: Meta WhatsApp Cloud API, Khapy channel adapters, Telnyx SMS (Khapy auth/delivery), SMTP (Titan/Bluehost), Brevo (BOS), Mailpit locally. The assistant does **not** reuse any of these in Loop 1 because no verified, least-privilege assistant credentials exist. Drafts are local only; sending is disabled.

## Model providers

Khapy contains the only existing multi-provider AI abstraction (`packages/ai/src/providers/*`). The assistant implements a small provider-neutral adapter over OpenAI-compatible APIs rather than importing Khapy's monorepo package, which would couple this product to another repository. Supported by configuration: OpenAI, DeepSeek, OpenRouter. No provider is hardcoded into domain logic.

## Deployment conventions observed

Coolify + Traefik on a VPS, Docker containers, migration-on-deploy, separate Postgres/Redis, health checks, `concurrent_builds = 1`. The assistant is prepared as a single Next image plus a worker process, with `/api/health`; it is **not deployed** in this loop.

## Loop 1 honesty rules derived from this audit

1. BOS, Khapy and MotherTracker must appear as “not connected / needs credentials” in the Connections UI.
2. A Khapy creative-brief can be produced as a local structured draft; the UI must say it was not delivered to Khapy.
3. No email/WhatsApp/social send is executed.
4. Daily briefings state that their sources are the assistant workspace only, with an “as of” timestamp.
