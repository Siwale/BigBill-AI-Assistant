import { z } from "zod";

/**
 * Loop 2 shared contracts — one session/event model for text, voice, vision
 * and meetings. Every record that touches tenant data carries tenantId/userId
 * explicitly; device IDs are not stored as global identifiers.
 */

// ---- Devices & Presence ----

export const deviceKindSchema = z.enum(["audioinput", "audiooutput", "videoinput"]);
export type DeviceKind = z.infer<typeof deviceKindSchema>;

export const deviceCapabilitySchema = z.object({
  secureContext: z.boolean(),
  canGetUserMedia: z.boolean(),
  canGetDisplayMedia: z.boolean(),
  canEnumerateDevices: z.boolean(),
  canSelectAudioOutput: z.boolean(),
  canSetSinkId: z.boolean(),
  hasSpeechRecognition: z.boolean(),
  hasSpeechSynthesis: z.boolean(),
  hasWebRTC: z.boolean(),
  hasAudioWorklet: z.boolean(),
});
export type DeviceCapability = z.infer<typeof deviceCapabilitySchema>;

export const deviceStatusSchema = z.object({
  permission: z.enum(["prompt", "granted", "denied", "unknown"]),
  selectedInputId: z.string().optional(),
  selectedOutputId: z.string().optional(),
  inputLevel: z.number().min(0).max(1).optional(),
  isCapturing: z.boolean(),
  isPreviewing: z.boolean(),
  isSharing: z.boolean(),
  error: z.string().optional(),
});
export type DeviceStatus = z.infer<typeof deviceStatusSchema>;

export const audioStateSchema = z.enum([
  "idle",
  "requesting_permission",
  "listening",
  "transcribing",
  "thinking",
  "speaking",
  "interrupted",
  "meeting_connected",
  "reconnecting",
  "muted",
  "error",
]);
export type AudioState = z.infer<typeof audioStateSchema>;

// ---- Voice ----

export const voiceSessionSchema = z.object({
  id: z.string().uuid().optional(),
  conversationId: z.string().uuid(),
  mode: z.enum(["browser", "server", "realtime"]).default("browser"),
  ephemeral: z.boolean().optional(),
});
export type VoiceSessionInput = z.infer<typeof voiceSessionSchema>;

export const voiceEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("partial"), text: z.string(), ts: z.number() }),
  z.object({ type: z.literal("final"), text: z.string(), ts: z.number() }),
  z.object({ type: z.literal("audio"), chunkBase64: z.string(), mimeType: z.string(), ts: z.number() }),
  z.object({ type: z.literal("state"), state: audioStateSchema, message: z.string().optional() }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);
export type VoiceEvent = z.infer<typeof voiceEventSchema>;

// ---- Vision / Observation ----

export const observationSourceSchema = z.enum(["camera", "screen", "upload"]);
export type ObservationSource = z.infer<typeof observationSourceSchema>;

export const visionSessionSchema = z.object({
  conversationId: z.string().uuid(),
  source: observationSourceSchema,
  captureMode: z.enum(["snapshot", "bounded_live"]).default("snapshot"),
  samplingMs: z.number().int().min(500).max(10_000).optional(),
});
export type VisionSessionInput = z.infer<typeof visionSessionSchema>;

// ---- Meetings ----

export const meetingProviderSchema = z.enum(["zoom", "google_meet", "browser_companion", "manual"]);
export type MeetingProvider = z.infer<typeof meetingProviderSchema>;

export const meetingMediaSourceSchema = z.enum(["rtms", "rest_artifacts", "drive", "browser_share", "none"]);
export type MeetingMediaSource = z.infer<typeof meetingMediaSourceSchema>;

export const meetingConnectionSchema = z.object({
  provider: meetingProviderSchema,
  mediaSource: meetingMediaSourceSchema,
  status: z.enum(["not_connected", "connecting", "live_connected", "live_companion", "artifact_pending", "artifact_ready", "unsupported"]),
  statusNote: z.string().max(500),
  meetingUrl: z.string().url().optional(),
  lastSyncAt: z.string().datetime({ offset: true }).nullable().optional(),
});
export type MeetingConnection = z.infer<typeof meetingConnectionSchema>;

export const transcriptSegmentSchema = z.object({
  id: z.string(),
  speaker: z.string().max(120).optional(),
  text: z.string().min(1).max(4000),
  startMs: z.number().int().min(0).optional(),
  endMs: z.number().int().min(0).optional(),
  provider: meetingProviderSchema.optional(),
  sourceRef: z.string().max(300).optional(),
});
export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;

export const meetingRecordSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  provider: meetingProviderSchema,
  title: z.string().max(200),
  meetingUrl: z.string().url().optional(),
  startAt: z.string().datetime({ offset: true }).optional(),
  endAt: z.string().datetime({ offset: true }).optional(),
  attendees: z.array(z.string().max(120)).default([]),
  transcriptSource: z.string().max(200).optional(),
  decisions: z.array(z.string().max(1000)).default([]),
  questions: z.array(z.string().max(1000)).default([]),
  risks: z.array(z.string().max(1000)).default([]),
  createdAt: z.string().datetime({ offset: true }),
});
export type MeetingRecord = z.infer<typeof meetingRecordSchema>;

export const meetingActionCandidateSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  proposedOwner: z.string().max(120).optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  confidence: z.number().min(0).max(1).default(0.5),
  status: z.enum(["proposed", "approved", "rejected", "deferred"]).default("proposed"),
  evidenceSegmentIds: z.array(z.string()).default([]),
  evidenceQuote: z.string().max(500).optional(),
  meetingId: z.string().uuid().optional(),
});
export type MeetingActionCandidate = z.infer<typeof meetingActionCandidateSchema>;

// ---- Knowledge / Source freshness ----

export const knowledgeSourceSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  sourceType: z.string(),
  tenantId: z.string().uuid(),
  lastSyncAt: z.string().datetime({ offset: true }).nullable().optional(),
  freshness: z.enum(["fresh", "stale", "missing"]).default("fresh"),
});
export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;

export const evidenceReferenceSchema = z.object({
  sourceId: z.string(),
  title: z.string(),
  chunkIndex: z.number().int().min(0).optional(),
  page: z.number().int().min(1).optional(),
  timestampMs: z.number().int().min(0).optional(),
  url: z.string().url().optional(),
});
export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;
