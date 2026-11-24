-- Composite tenant integrity for Loop 2.2: ensure child rows cannot reference a parent from another tenant.
-- Service checks already enforce this; these constraints make future code paths safe.

CREATE UNIQUE INDEX IF NOT EXISTS "meeting_records_tenant_id_id_uq" ON "meeting_records" USING btree ("tenant_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_tenant_id_id_uq" ON "conversations" USING btree ("tenant_id", "id");
--> statement-breakpoint
-- Add composite FKs (defer adding if data is inconsistent — migration will fail with diagnostic)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meeting_segments_tenant_meeting_fk') THEN
    ALTER TABLE "meeting_transcript_segments"
      ADD CONSTRAINT "meeting_segments_tenant_meeting_fk"
      FOREIGN KEY ("tenant_id", "meeting_id") REFERENCES "meeting_records"("tenant_id", "id") ON DELETE cascade;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meeting_candidates_tenant_meeting_fk') THEN
    ALTER TABLE "meeting_action_candidates"
      ADD CONSTRAINT "meeting_candidates_tenant_meeting_fk"
      FOREIGN KEY ("tenant_id", "meeting_id") REFERENCES "meeting_records"("tenant_id", "id") ON DELETE cascade;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observations_tenant_conversation_fk') THEN
    ALTER TABLE "observations"
      ADD CONSTRAINT "observations_tenant_conversation_fk"
      FOREIGN KEY ("tenant_id", "conversation_id") REFERENCES "conversations"("tenant_id", "id") ON DELETE set null;
  END IF;
END $$;
