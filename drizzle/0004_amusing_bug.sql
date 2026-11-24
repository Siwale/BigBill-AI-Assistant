CREATE TABLE "device_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"adapter" text NOT NULL,
	"transport" text NOT NULL,
	"device_class" text NOT NULL,
	"provider_device_id_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"friendly_name" text,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"diagnostic" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_companion_pairings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"machine_label" text NOT NULL,
	"public_key_fingerprint" text NOT NULL,
	"status" text DEFAULT 'paired' NOT NULL,
	"paired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movie_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"liked_titles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"disliked_titles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"favorite_genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"favorite_actors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"region_code" text DEFAULT 'ZM' NOT NULL,
	"runtime_min" integer,
	"runtime_max" integer,
	"content_rating" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movie_watchlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"provider_title_id" text NOT NULL,
	"title" text NOT NULL,
	"year" integer,
	"status" text DEFAULT 'want_to_watch' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"watched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "music_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"item_type" text NOT NULL,
	"provider_item_id" text NOT NULL,
	"title" text NOT NULL,
	"artist" text,
	"artwork_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visual_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"source" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sample_interval_ms" integer DEFAULT 2000 NOT NULL,
	"max_duration_ms" integer DEFAULT 120000 NOT NULL,
	"sample_count" integer DEFAULT 0 NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_connections" ADD CONSTRAINT "device_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_connections" ADD CONSTRAINT "device_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_companion_pairings" ADD CONSTRAINT "local_companion_pairings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_companion_pairings" ADD CONSTRAINT "local_companion_pairings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_preferences" ADD CONSTRAINT "movie_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_preferences" ADD CONSTRAINT "movie_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_watchlist" ADD CONSTRAINT "movie_watchlist_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_watchlist" ADD CONSTRAINT "movie_watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_favorites" ADD CONSTRAINT "music_favorites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_favorites" ADD CONSTRAINT "music_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_sessions" ADD CONSTRAINT "visual_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_sessions" ADD CONSTRAINT "visual_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_sessions" ADD CONSTRAINT "visual_sessions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_connections_tenant_idx" ON "device_connections" USING btree ("tenant_id","user_id","adapter");--> statement-breakpoint
CREATE INDEX "local_companion_pairings_tenant_idx" ON "local_companion_pairings" USING btree ("tenant_id","user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "movie_preferences_tenant_user_uq" ON "movie_preferences" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "movie_watchlist_tenant_user_title_uq" ON "movie_watchlist" USING btree ("tenant_id","user_id","provider_title_id");--> statement-breakpoint
CREATE INDEX "movie_watchlist_tenant_idx" ON "movie_watchlist" USING btree ("tenant_id","user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "music_favorites_tenant_user_item_uq" ON "music_favorites" USING btree ("tenant_id","user_id","provider","provider_item_id");--> statement-breakpoint
CREATE INDEX "visual_sessions_tenant_idx" ON "visual_sessions" USING btree ("tenant_id","created_at");