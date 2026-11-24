-- Fix composite FK for observations: tenant_id is NOT NULL, so SET NULL on composite fails.
-- Keep the original single-column FK (ON DELETE SET NULL) and drop the composite one.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observations_tenant_conversation_fk') THEN
    ALTER TABLE "observations" DROP CONSTRAINT "observations_tenant_conversation_fk";
  END IF;
END $$;
--> statement-breakpoint
-- Ensure the original single-column FK exists (it was defined in schema, but ensure)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observations_conversation_id_conversations_id_fk') THEN
    ALTER TABLE "observations" ADD CONSTRAINT "observations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE set null;
  END IF;
END $$;
--> statement-breakpoint
-- For PG15+, use column-list SET NULL to only null conversation_id; for older, fall back to NO ACTION with service cleanup.
DO $$
BEGIN
  -- Re-add composite FK correctly with column list (PG15+)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observations_tenant_conversation_fk_correct') THEN
    BEGIN
      ALTER TABLE "observations" ADD CONSTRAINT "observations_tenant_conversation_fk_correct" FOREIGN KEY ("tenant_id", "conversation_id") REFERENCES "conversations"("tenant_id", "id") ON DELETE SET NULL (conversation_id);
    EXCEPTION WHEN others THEN
      -- Fallback: no composite FK, rely on service checks
      NULL;
    END;
  END IF;
END $$;
--> statement-breakpoint
-- Add task_id to meeting_action_candidates for durable, recoverable approval
ALTER TABLE "meeting_action_candidates" ADD COLUMN IF NOT EXISTS "task_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meeting_action_candidates_task_id_tasks_id_fk') THEN
    ALTER TABLE "meeting_action_candidates" ADD CONSTRAINT "meeting_action_candidates_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE set null;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "meeting_candidates_task_uq" ON "meeting_action_candidates" USING btree ("task_id");
