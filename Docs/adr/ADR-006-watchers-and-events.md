# ADR-006 — Watchers, Outbox and Incidents

**Status:** Accepted for Loop 1 (bounded)  
**Date:** 2026-11-23

## Decision

- Use the project Redis instance with BullMQ for background processing; queue names are namespaced.
- The database is the source of truth: `outbox_events` rows are written in the same transaction as domain changes; a worker dispatches them idempotently.
- `inbox_events` stores provider events with a unique `(source, external_event_id)` constraint to make webhook ingestion idempotent.
- A scheduled overdue-task watcher creates deduplicated incidents for overdue commitments.
- Incidents have a lifecycle (`open → acknowledged → investigating → resolved`) and are visible in-app and in chat when relevant.
- Watchers only operate on explicitly granted internal scopes. No external connector is polled in Loop 1 because none is verified.
- No "always-on microphone" is part of watcher behaviour.

## Consequences

- The event path is testable locally with synthetic events.
- At-least-once delivery is assumed; handlers must be idempotent.
- External webhook signature verification is implemented behind an environment secret and disabled unless configured.
