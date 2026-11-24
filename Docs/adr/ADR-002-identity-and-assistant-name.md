# ADR-002 — Tenant Identity and Assistant Naming

**Status:** Accepted for Loop 1  
**Date:** 2026-11-23

## Context

The assistant is a separate multi-tenant product. The founder is tenant one, but BigBill must not be privileged in code. The assistant's display name is assigned during first use, stored in the database, changeable, used by text and voice, and independently configurable per tenant. It must never be hardcoded in prompts, environment variables or seed data.

## Decision

- Email/password authentication with bcrypt hashes and a signed, httpOnly JWT session cookie (`jose`, HS256).
- The first user of a new workspace becomes its `owner`; a workspace is created with a neutral slug.
- `assistant_profiles` is tenant-scoped (`tenant_id` unique) with nullable `display_name`, persona JSON, voice JSON and `onboarding_completed_at`.
- A fresh profile has `display_name = NULL`; the UI shows “your assistant” until naming completes.
- The name is validated (1–40 characters, no control characters or markup), normalized only by trimming/collapsing whitespace, persisted, audited and re-read from the database on every request.
- The model prompt builder receives the name as **quoted data**, not as instructions. The name field is never concatenated into system instructions unescaped.
- Rename is available to the owner/admin in Settings and records an audit event.
- Every tenant-owned row carries `tenant_id`; every service query filters by the server-resolved tenant. Client-supplied tenant IDs are never trusted.

## Consequences

- No source default name exists anywhere.
- Onboarding can be tested by asserting NULL profile names in seeds and a redirect to `/onboarding`.
- Two tenants can choose different names without leakage.
- Session invalidation requires changing `AUTH_SECRET` or rotating a future session version; acceptable for Loop 1.
