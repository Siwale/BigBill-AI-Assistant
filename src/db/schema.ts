import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/**
 * Every tenant-owned table carries tenant_id explicitly. There is no implicit
 * "current tenant": services must always pass the server-resolved tenant.
 */

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tenants_slug_uq").on(t.slug)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_tenant_email_uq").on(t.tenantId, t.email),
    index("users_tenant_idx").on(t.tenantId),
  ],
);

export const assistantProfiles = pgTable(
  "assistant_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    personaConfig: jsonb("persona_config")
      .$type<{ tone?: string; pronouns?: string; greetingStyle?: string; theme?: string }>()
      .notNull()
      .default({}),
    voiceConfig: jsonb("voice_config")
      .$type<{ provider?: string; voiceId?: string; language?: string; rate?: number }>()
      .notNull()
      .default({}),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("assistant_profiles_tenant_uq").on(t.tenantId)],
);

export const userAssistantConfigs = pgTable(
  "user_assistant_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    pronouns: text("pronouns"),
    gender: text("gender"),
    presentation: text("presentation"),
    personaDescription: text("persona_description"),
    voiceProvider: text("voice_provider"),
    voiceId: text("voice_id"),
    voiceLocale: text("voice_locale"),
    voiceRate: integer("voice_rate"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_assistant_configs_tenant_user_uq").on(t.tenantId, t.userId)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    channel: text("channel").notNull().default("text"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("conversations_tenant_user_idx").on(t.tenantId, t.userId, t.updatedAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    channel: text("channel").notNull().default("text"),
    citations: jsonb("citations")
      .$type<Array<{ sourceId: string; title: string; chunkIndex: number; source?: string }>>()
      .notNull()
      .default([]),
    toolActivity: jsonb("tool_activity")
      .$type<
        Array<{
          toolId: string;
          status: string;
          summary?: string;
          permissionRequired?: { connectorId: string; connectorName: string; scopes: string[] };
        }>
      >()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_conversation_idx").on(t.tenantId, t.conversationId, t.createdAt),
  ],
);

export const permissionGrants = pgTable(
  "permission_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectorId: text("connector_id").notNull(),
    scopes: text("scopes").array().notNull(),
    status: text("status").notNull().default("active"),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    index("permission_grants_lookup_idx").on(t.tenantId, t.userId, t.status),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    priority: text("priority").notNull().default("normal"),
    status: text("status").notNull().default("open"),
    source: text("source").notNull().default("assistant"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tasks_tenant_status_idx").on(t.tenantId, t.status, t.dueAt)],
);

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("drafts_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    severity: text("severity").notNull().default("warning"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    impact: text("impact"),
    evidence: text("evidence"),
    nextStep: text("next_step"),
    source: text("source").notNull().default("assistant"),
    status: text("status").notNull().default("open"),
    dedupeKey: text("dedupe_key"),
    correlationId: text("correlation_id"),
    acknowledgedBy: uuid("acknowledged_by").references(() => users.id, {
      onDelete: "set null",
    }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("incidents_tenant_status_idx").on(t.tenantId, t.status, t.createdAt),
    uniqueIndex("incidents_dedupe_uq").on(t.tenantId, t.dedupeKey),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    correlationId: text("correlation_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_events_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const memoryEntries = pgTable(
  "memory_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull().default("user_preference"),
    content: text("content").notNull(),
    source: text("source").notNull().default("user"),
    confidence: text("confidence").notNull().default("explicit"),
    enabled: boolean("enabled").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("memory_entries_tenant_user_idx").on(t.tenantId, t.userId, t.enabled)],
);

export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sourceType: text("source_type").notNull().default("upload"),
    mimeType: text("mime_type").notNull().default("text/plain"),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    status: text("status").notNull().default("ready"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("knowledge_documents_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // The migration adds a functional GIN index on to_tsvector(content) for
  // lexical retrieval; Drizzle does not model expression indexes here.
  (t) => [index("knowledge_chunks_tenant_doc_idx").on(t.tenantId, t.documentId)],
);

export const actions = pgTable(
  "actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    toolId: text("tool_id").notNull(),
    risk: text("risk").notNull(),
    status: text("status").notNull().default("proposed"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    preview: jsonb("preview").$type<Record<string, unknown>>().notNull().default({}),
    payloadHash: text("payload_hash").notNull(),
    approvalRequired: boolean("approval_required").notNull().default(false),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("actions_tenant_status_idx").on(t.tenantId, t.status, t.createdAt)],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("outbox_events_idem_uq").on(t.idempotencyKey),
    index("outbox_events_pending_idx").on(t.status, t.availableAt),
  ],
);

export const inboxEvents = pgTable(
  "inbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    source: text("source").notNull(),
    externalEventId: text("external_event_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("inbox_events_source_event_uq").on(t.source, t.externalEventId),
    index("inbox_events_tenant_idx").on(t.tenantId),
  ],
);

export const voiceSessions = pgTable(
  "voice_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    mode: text("mode").notNull().default("browser"),
    status: text("status").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index("voice_sessions_tenant_idx").on(t.tenantId, t.userId, t.startedAt)],
);

export const modelUsage = pgTable(
  "model_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    purpose: text("purpose").notNull().default("chat"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("model_usage_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const devicePreferences = pgTable(
  "device_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    preferredInputLabel: text("preferred_input_label"),
    preferredOutputLabel: text("preferred_output_label"),
    lastTestAt: timestamp("last_test_at", { withTimezone: true }),
    lastTestResult: jsonb("last_test_result").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("device_preferences_tenant_user_uq").on(t.tenantId, t.userId)],
);

export const meetingRecords = pgTable(
  "meeting_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    title: text("title").notNull(),
    meetingUrl: text("meeting_url"),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    attendees: jsonb("attendees").$type<string[]>().notNull().default([]),
    transcriptSource: text("transcript_source"),
    summary: text("summary"),
    decisions: jsonb("decisions").$type<string[]>().notNull().default([]),
    questions: jsonb("questions").$type<string[]>().notNull().default([]),
    risks: jsonb("risks").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("artifact_pending"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("meeting_records_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const meetingTranscriptSegments = pgTable(
  "meeting_transcript_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetingRecords.id, { onDelete: "cascade" }),
    speaker: text("speaker"),
    text: text("text").notNull(),
    startMs: integer("start_ms"),
    endMs: integer("end_ms"),
    provider: text("provider"),
    sourceRef: text("source_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("meeting_segments_meeting_idx").on(t.meetingId, t.startMs)],
);

export const meetingActionCandidates = pgTable(
  "meeting_action_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetingRecords.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    proposedOwner: text("proposed_owner"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    priority: text("priority").notNull().default("normal"),
    confidence: text("confidence").notNull().default("0.5"),
    status: text("status").notNull().default("proposed"),
    evidenceSegmentIds: jsonb("evidence_segment_ids").$type<string[]>().notNull().default([]),
    evidenceQuote: text("evidence_quote"),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("meeting_actions_meeting_idx").on(t.meetingId, t.status),
    uniqueIndex("meeting_candidates_task_uq").on(t.taskId),
  ],
);

export const observations = pgTable(
  "observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    sourceType: text("source_type").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull().default(0),
    storageKey: text("storage_key"),
    caption: text("caption"),
    analysis: text("analysis"),
    analysisModel: text("analysis_model"),
    retention: text("retention").notNull().default("transient"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("observations_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const visualSessions = pgTable(
  "visual_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    source: text("source").notNull(),
    status: text("status").notNull().default("active"),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull().defaultNow(),
    sampleIntervalMs: integer("sample_interval_ms").notNull().default(2000),
    maxDurationMs: integer("max_duration_ms").notNull().default(120000),
    sampleCount: integer("sample_count").notNull().default(0),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedReason: text("ended_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("visual_sessions_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const deviceConnections = pgTable(
  "device_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    adapter: text("adapter").notNull(),
    transport: text("transport").notNull(),
    deviceClass: text("device_class").notNull(),
    providerDeviceIdHash: text("provider_device_id_hash").notNull(),
    displayName: text("display_name").notNull(),
    friendlyName: text("friendly_name"),
    capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("available"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    diagnostic: text("diagnostic"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("device_connections_tenant_idx").on(t.tenantId, t.userId, t.adapter)],
);

export const localCompanionPairings = pgTable(
  "local_companion_pairings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    machineLabel: text("machine_label").notNull(),
    publicKeyFingerprint: text("public_key_fingerprint").notNull(),
    status: text("status").notNull().default("paired"),
    pairedAt: timestamp("paired_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("local_companion_pairings_tenant_idx").on(t.tenantId, t.userId, t.status)],
);

export const musicFavorites = pgTable(
  "music_favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    itemType: text("item_type").notNull(),
    providerItemId: text("provider_item_id").notNull(),
    title: text("title").notNull(),
    artist: text("artist"),
    artworkUrl: text("artwork_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("music_favorites_tenant_user_item_uq").on(t.tenantId, t.userId, t.provider, t.providerItemId)],
);

export const moviePreferences = pgTable(
  "movie_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    likedTitles: jsonb("liked_titles").$type<string[]>().notNull().default([]),
    dislikedTitles: jsonb("disliked_titles").$type<string[]>().notNull().default([]),
    favoriteGenres: jsonb("favorite_genres").$type<string[]>().notNull().default([]),
    favoriteActors: jsonb("favorite_actors").$type<string[]>().notNull().default([]),
    regionCode: text("region_code").notNull().default("ZM"),
    runtimeMin: integer("runtime_min"),
    runtimeMax: integer("runtime_max"),
    contentRating: text("content_rating"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("movie_preferences_tenant_user_uq").on(t.tenantId, t.userId)],
);

export const movieWatchlist = pgTable(
  "movie_watchlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("manual"),
    providerTitleId: text("provider_title_id").notNull(),
    title: text("title").notNull(),
    year: integer("year"),
    status: text("status").notNull().default("want_to_watch"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    watchedAt: timestamp("watched_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("movie_watchlist_tenant_user_title_uq").on(t.tenantId, t.userId, t.providerTitleId), index("movie_watchlist_tenant_idx").on(t.tenantId, t.userId, t.status)],
);

export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type AssistantProfile = typeof assistantProfiles.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type MemoryEntry = typeof memoryEntries.$inferSelect;
export type PermissionGrant = typeof permissionGrants.$inferSelect;
export type ActionRecord = typeof actions.$inferSelect;
export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type VoiceSession = typeof voiceSessions.$inferSelect;
export type DevicePreference = typeof devicePreferences.$inferSelect;
export type MeetingRecord = typeof meetingRecords.$inferSelect;
export type MeetingTranscriptSegment = typeof meetingTranscriptSegments.$inferSelect;
export type MeetingActionCandidate = typeof meetingActionCandidates.$inferSelect;
export type Observation = typeof observations.$inferSelect;
export const engineeringRepositories = pgTable(
  "engineering_repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    canonicalPath: text("canonical_path").notNull(),
    allowedRootId: text("allowed_root_id").notNull(),
    remoteUrlRedacted: text("remote_url_redacted"),
    branch: text("branch"),
    commitSha: text("commit_sha"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastHealthAt: timestamp("last_health_at", { withTimezone: true }),
    lastHealthStatus: text("last_health_status"),
  },
  (t) => [index("engineering_repos_tenant_idx").on(t.tenantId, t.userId), uniqueIndex("engineering_repos_tenant_path_uq").on(t.tenantId, t.canonicalPath)],
);

export const engineeringAudits = pgTable(
  "engineering_audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id").notNull().references(() => engineeringRepositories.id, { onDelete: "cascade" }),
    scopeType: text("scope_type").notNull().default("whole_repository"),
    scopeTarget: text("scope_target"),
    reviewProfile: text("review_profile").notNull().default("standard"),
    includeWorkingChanges: boolean("include_working_changes").notNull().default(true),
    status: text("status").notNull().default("pending"),
    forgeVersion: text("forge_version"),
    adapterVersion: text("adapter_version").notNull().default("1.0.0"),
    snapshotSha256: text("snapshot_sha256"),
    branch: text("branch"),
    commitSha: text("commit_sha"),
    dirty: boolean("dirty"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("engineering_audits_tenant_idx").on(t.tenantId, t.repositoryId, t.createdAt)],
);

export const engineeringAuditEvents = pgTable(
  "engineering_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    auditId: uuid("audit_id").notNull().references(() => engineeringAudits.id, { onDelete: "cascade" }),
    stage: text("stage").notNull(),
    status: text("status").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("engineering_audit_events_audit_idx").on(t.auditId, t.createdAt)],
);

export const engineeringFindings = pgTable(
  "engineering_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    auditId: uuid("audit_id").notNull().references(() => engineeringAudits.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    trustState: text("trust_state").notNull(),
    evidence: jsonb("evidence").$type<Array<{ file: string; lineStart?: number; lineEnd?: number; symbol?: string; excerpt?: string; valid: boolean }>>().notNull().default([]),
    verification: jsonb("verification").$type<{ method: string; status: string; artifactId?: string; summary: string } | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("engineering_findings_audit_idx").on(t.auditId, t.severity)],
);

export type VisualSession = typeof visualSessions.$inferSelect;
export type DeviceConnection = typeof deviceConnections.$inferSelect;
export type LocalCompanionPairing = typeof localCompanionPairings.$inferSelect;
export type MusicFavorite = typeof musicFavorites.$inferSelect;
export type MoviePreference = typeof moviePreferences.$inferSelect;
export type MovieWatchlistEntry = typeof movieWatchlist.$inferSelect;
export type EngineeringRepository = typeof engineeringRepositories.$inferSelect;
export type EngineeringAudit = typeof engineeringAudits.$inferSelect;
export type EngineeringAuditEvent = typeof engineeringAuditEvents.$inferSelect;
export type EngineeringFinding = typeof engineeringFindings.$inferSelect;
export type UserAssistantConfig = typeof userAssistantConfigs.$inferSelect;
