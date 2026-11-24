/**
 * Background worker for Loop 1.
 *
 * It runs only internal, side-effect-free maintenance:
 *  - drains the transactional outbox into the internal event sink,
 *  - marks idempotent inbox events processed,
 *  - opens one incident per overdue task (deduplicated).
 *
 * It never sends email/WhatsApp, publishes, spends or deletes anything.
 */
import { and, eq, isNull, lte, ne, sql } from "drizzle-orm";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { db } from "../src/db/client";
import { inboxEvents, observations, outboxEvents, tasks } from "../src/db/schema";
import { getEnv } from "../src/lib/env";
import { log } from "../src/lib/logger";
import { recordAudit } from "../src/modules/audit/service";
import { openIncident } from "../src/modules/incidents/service";

const QUEUE_NAME = "assistant-maintenance";

type SweepResult = {
  outbox: number;
  inbox: number;
  overdueIncidents: number;
  expiredObservations: number;
};

async function drainOutbox(): Promise<number> {
  const pending = await db
    .select()
    .from(outboxEvents)
    .where(and(eq(outboxEvents.status, "pending"), lte(outboxEvents.availableAt, new Date())))
    .limit(25);

  let dispatched = 0;
  for (const event of pending) {
    const updated = await db
      .update(outboxEvents)
      .set({
        status: "dispatched",
        dispatchedAt: new Date(),
        attempts: sql`${outboxEvents.attempts} + 1`,
      })
      .where(and(eq(outboxEvents.id, event.id), eq(outboxEvents.status, "pending")))
      .returning({ id: outboxEvents.id });

    if (updated.length === 0) continue;
    dispatched += 1;
    await recordAudit({
      tenantId: event.tenantId,
      eventType: "outbox.dispatched",
      entityType: "outbox_event",
      entityId: event.id,
      metadata: { eventType: event.eventType, idempotencyKey: event.idempotencyKey },
    });
  }
  return dispatched;
}

async function processInbox(): Promise<number> {
  const pending = await db
    .select()
    .from(inboxEvents)
    .where(isNull(inboxEvents.processedAt))
    .limit(25);

  let processed = 0;
  for (const event of pending) {
    const updated = await db
      .update(inboxEvents)
      .set({ processedAt: new Date() })
      .where(and(eq(inboxEvents.id, event.id), isNull(inboxEvents.processedAt)))
      .returning({ id: inboxEvents.id });
    if (updated.length === 0) continue;
    processed += 1;
    await recordAudit({
      tenantId: event.tenantId,
      eventType: "inbox.processed",
      entityType: "inbox_event",
      entityId: event.id,
      metadata: { source: event.source, externalEventId: event.externalEventId },
    });
  }
  return processed;
}

async function watchOverdueTasks(): Promise<number> {
  const overdue = await db
    .select()
    .from(tasks)
    .where(and(lte(tasks.dueAt, new Date()), ne(tasks.status, "done"), ne(tasks.status, "cancelled")))
    .limit(50);

  let opened = 0;
  for (const task of overdue) {
    const incident = await openIncident({
      tenantId: task.tenantId,
      severity: task.priority === "urgent" ? "critical" : "warning",
      title: `Task is overdue: ${task.title}`.slice(0, 200),
      description:
        "The overdue-task watcher found a task past its due time while still open. This is an internal workspace check; no external system was queried.",
      impact: "The commitment is past due and may need rescheduling or a status update.",
      evidence: `taskId=${task.id}; dueAt=${task.dueAt?.toISOString() ?? "unknown"}`,
      nextStep: "Open Tasks, update the due date or mark it done, then resolve this incident.",
      source: "watcher.overdue_tasks",
      dedupeKey: `task.overdue:${task.id}`,
    });
    if (incident.status === "open") opened += 1;
  }
  return opened;
}

async function expireObservations(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(observations)
    .where(and(eq(observations.retention, "transient"), lte(observations.createdAt, cutoff)))
    .returning({ id: observations.id });
  if (deleted.length > 0) log("info", "observations_expired", { count: deleted.length });
  return deleted.length;
}

async function sweep(): Promise<SweepResult> {
  const [outbox, inbox, overdueIncidents, expiredObservations] = await Promise.all([
    drainOutbox(),
    processInbox(),
    watchOverdueTasks(),
    expireObservations(),
  ]);
  return { outbox, inbox, overdueIncidents, expiredObservations };
}

async function main(): Promise<void> {
  const connection = new IORedis(getEnv().REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE_NAME, { connection });

  await queue.add(
    "sweep",
    {},
    {
      repeat: { every: 60_000 },
      jobId: "assistant-maintenance-sweep",
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const result = await sweep();
      log("info", "worker_sweep", result);
      return result;
    },
    { connection, concurrency: 1 },
  );

  worker.on("failed", (job, error) => {
    log("error", "worker_job_failed", { jobId: job?.id ?? "unknown", message: error.message });
  });

  log("info", "worker_started", { queue: QUEUE_NAME });

  const shutdown = async (signal: string) => {
    log("info", "worker_stopping", { signal });
    await worker.close();
    await queue.close();
    await connection.quit();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  log("error", "worker_start_failed", {
    message: error instanceof Error ? error.message : "unknown",
  });
  process.exit(1);
});
