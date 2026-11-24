CREATE TABLE "user_assistant_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text,
	"pronouns" text,
	"gender" text,
	"presentation" text,
	"persona_description" text,
	"voice_provider" text,
	"voice_id" text,
	"voice_locale" text,
	"voice_rate" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_assistant_configs" ADD CONSTRAINT "user_assistant_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_assistant_configs" ADD CONSTRAINT "user_assistant_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_assistant_configs_tenant_user_uq" ON "user_assistant_configs" USING btree ("tenant_id","user_id");