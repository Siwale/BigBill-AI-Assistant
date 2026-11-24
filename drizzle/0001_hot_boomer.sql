CREATE TABLE "device_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"preferred_input_label" text,
	"preferred_output_label" text,
	"last_test_at" timestamp with time zone,
	"last_test_result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_action_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"proposed_owner" text,
	"due_at" timestamp with time zone,
	"priority" text DEFAULT 'normal' NOT NULL,
	"confidence" text DEFAULT '0.5' NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"evidence_segment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_quote" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"title" text NOT NULL,
	"meeting_url" text,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"attendees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"transcript_source" text,
	"summary" text,
	"decisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'artifact_pending' NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_transcript_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"speaker" text,
	"text" text NOT NULL,
	"start_ms" integer,
	"end_ms" integer,
	"provider" text,
	"source_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"source_type" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer DEFAULT 0 NOT NULL,
	"storage_key" text,
	"caption" text,
	"analysis" text,
	"analysis_model" text,
	"retention" text DEFAULT 'transient' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_preferences" ADD CONSTRAINT "device_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_preferences" ADD CONSTRAINT "device_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_action_candidates" ADD CONSTRAINT "meeting_action_candidates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_action_candidates" ADD CONSTRAINT "meeting_action_candidates_meeting_id_meeting_records_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_records" ADD CONSTRAINT "meeting_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_records" ADD CONSTRAINT "meeting_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_transcript_segments" ADD CONSTRAINT "meeting_transcript_segments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_transcript_segments" ADD CONSTRAINT "meeting_transcript_segments_meeting_id_meeting_records_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_preferences_tenant_user_uq" ON "device_preferences" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "meeting_actions_meeting_idx" ON "meeting_action_candidates" USING btree ("meeting_id","status");--> statement-breakpoint
CREATE INDEX "meeting_records_tenant_idx" ON "meeting_records" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "meeting_segments_meeting_idx" ON "meeting_transcript_segments" USING btree ("meeting_id","start_ms");--> statement-breakpoint
CREATE INDEX "observations_tenant_idx" ON "observations" USING btree ("tenant_id","created_at");