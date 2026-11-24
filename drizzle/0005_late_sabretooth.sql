CREATE TABLE "engineering_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"audit_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineering_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"scope_type" text DEFAULT 'whole_repository' NOT NULL,
	"scope_target" text,
	"review_profile" text DEFAULT 'standard' NOT NULL,
	"include_working_changes" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"forge_version" text,
	"adapter_version" text DEFAULT '1.0.0' NOT NULL,
	"snapshot_sha256" text,
	"branch" text,
	"commit_sha" text,
	"dirty" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "engineering_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"audit_id" uuid NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"trust_state" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verification" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineering_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"canonical_path" text NOT NULL,
	"allowed_root_id" text NOT NULL,
	"remote_url_redacted" text,
	"branch" text,
	"commit_sha" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_health_at" timestamp with time zone,
	"last_health_status" text
);
--> statement-breakpoint
ALTER TABLE "engineering_audit_events" ADD CONSTRAINT "engineering_audit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_audit_events" ADD CONSTRAINT "engineering_audit_events_audit_id_engineering_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."engineering_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_audits" ADD CONSTRAINT "engineering_audits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_audits" ADD CONSTRAINT "engineering_audits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_audits" ADD CONSTRAINT "engineering_audits_repository_id_engineering_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."engineering_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_findings" ADD CONSTRAINT "engineering_findings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_findings" ADD CONSTRAINT "engineering_findings_audit_id_engineering_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."engineering_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_repositories" ADD CONSTRAINT "engineering_repositories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_repositories" ADD CONSTRAINT "engineering_repositories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "engineering_audit_events_audit_idx" ON "engineering_audit_events" USING btree ("audit_id","created_at");--> statement-breakpoint
CREATE INDEX "engineering_audits_tenant_idx" ON "engineering_audits" USING btree ("tenant_id","repository_id","created_at");--> statement-breakpoint
CREATE INDEX "engineering_findings_audit_idx" ON "engineering_findings" USING btree ("audit_id","severity");--> statement-breakpoint
CREATE INDEX "engineering_repos_tenant_idx" ON "engineering_repositories" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "engineering_repos_tenant_path_uq" ON "engineering_repositories" USING btree ("tenant_id","canonical_path");