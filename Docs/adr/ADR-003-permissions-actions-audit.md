# ADR-003 — Permissions, Tools, Actions and Audit

**Status:** Accepted for Loop 1  
**Date:** 2026-11-23

## Decision

- Deny by default. Every tool declares risk (R0–R4), required scopes, input schema, idempotency, availability and a server-side executor.
- Scopes are granted per tenant/user/connector in `permission_grants`; revocation is immediate and checked on **every** execution.
- Loop 1 registers only R0–R2 tools as available. R3/R4 tools (email send, WhatsApp send, social publish, ad spend, destructive/access changes) are registered as **disabled** so the UI can explain the capability without pretending it works.
- Tool arguments produced by a model are validated with Zod, then authorized, then executed with a timeout. Model output is never authorization.
- `actions` persists proposed/awaiting/approved/rejected/executing/completed/failed states and a SHA-256 payload hash. Approval (in a later loop) is bound to that hash; editing the payload invalidates approval.
- For Loop 1, any attempt at an R3/R4 tool is blocked and audited. No external effect occurs.
- `audit_events` is append-only through the application; it records grants, revocations, assistant renames, tool attempts, blocked actions, incidents and voice session lifecycle.
- Secrets and full message bodies are not written to logs or audit metadata.

## Consequences

- Voice uses the same registry/policy path as text; voice cannot obtain additional authority.
- Tests can assert denied execution with no connector call.
- Action approval UI can be added in Loop 2 without schema redesign.
