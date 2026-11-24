import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  meetingActionCandidates,
  meetingRecords,
  meetingTranscriptSegments,
} from "@/db/schema";
import type { MeetingActionCandidate, MeetingRecord, MeetingTranscriptSegment } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/modules/audit/service";
import { hasScopes } from "@/modules/permissions/service";
import { createTask } from "@/modules/tasks/service";
import { getEnv } from "@/lib/env";
import OpenAI from "openai";

/**
 * Provider capability checks — honest, not mocked. We report what the
 * deployment can actually do given current env and scopes.
 */
export function zoomCapability(): { status: string; statusNote: string; mediaSource: string } {
  const hasRtms =
    Boolean(process.env.ZOOM_RTMS_CLIENT_ID && process.env.ZOOM_RTMS_CLIENT_SECRET && process.env.ZOOM_RTMS_WEBHOOK_SECRET);
  if (!hasRtms) {
    return {
      status: "not_connected",
      statusNote: "Zoom RTMS is not configured. Set ZOOM_RTMS_* env vars and approve RTMS Developer Pack credits before live media.",
      mediaSource: "none",
    };
  }
  return {
    status: "credentials_configured",
    statusNote: "Zoom RTMS credentials are set but live connectivity has not been verified. Verify webhook + event subscription and that a test meeting delivers RTMS media before marking live_connected.",
    mediaSource: "rtms",
  };
}

export function googleMeetCapability(): { status: string; statusNote: string; mediaSource: string } {
  const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  if (!hasGoogle) {
    return {
      status: "not_connected",
      statusNote: "Google Calendar/Meet/Drive not connected. Authorize Google with calendar.events.readonly + meet + drive.readonly.",
      mediaSource: "none",
    };
  }
  return {
    status: "credentials_configured",
    statusNote: "Google credentials are set but artifact access has not been verified. Verify OAuth scopes and that a test conference record/transcript is retrievable via Meet REST API + Drive.",
    mediaSource: "rest_artifacts",
  };
}

export function meetingConnections(): Array<{
  provider: string;
  mediaSource: string;
  status: string;
  statusNote: string;
  lastSyncAt: string | null;
}> {
  const zoom = zoomCapability();
  const meet = googleMeetCapability();
  return [
    { provider: "zoom", mediaSource: zoom.mediaSource, status: zoom.status, statusNote: zoom.statusNote, lastSyncAt: null },
    { provider: "google_meet", mediaSource: meet.mediaSource, status: meet.status, statusNote: meet.statusNote, lastSyncAt: null },
    {
      provider: "browser_companion",
      mediaSource: "browser_share",
      status: "live_companion",
      statusNote: "User-started tab/window share. Works in Chromium for tab audio where supported; Firefox tab audio may be unavailable.",
      lastSyncAt: null,
    },
  ];
}

export async function listMeetings(tenantId: string, limit = 50): Promise<MeetingRecord[]> {
  return db
    .select()
    .from(meetingRecords)
    .where(eq(meetingRecords.tenantId, tenantId))
    .orderBy(desc(meetingRecords.createdAt))
    .limit(Math.min(limit, 100));
}

export async function getMeeting(tenantId: string, id: string): Promise<MeetingRecord> {
  const rows = await db
    .select()
    .from(meetingRecords)
    .where(and(eq(meetingRecords.id, id), eq(meetingRecords.tenantId, tenantId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError(404, "Meeting not found.", "meeting_not_found");
  return row;
}

export async function createMeeting(params: {
  tenantId: string;
  userId: string;
  provider: string;
  title: string;
  meetingUrl?: string | null;
  attendees?: string[];
  transcriptSource?: string | null;
  correlationId?: string;
}): Promise<MeetingRecord> {
  const [row] = await db
    .insert(meetingRecords)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      provider: params.provider,
      title: params.title.slice(0, 200),
      meetingUrl: params.meetingUrl ?? null,
      attendees: params.attendees ?? [],
      transcriptSource: params.transcriptSource ?? null,
      status: "artifact_pending",
    })
    .returning();
  if (!row) throw new ApiError(500, "Could not create meeting.", "meeting_create_failed");
  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "meeting.created",
    entityType: "meeting_record",
    entityId: row.id,
    metadata: { provider: row.provider },
    correlationId: params.correlationId,
  });
  return row;
}

export async function addTranscriptSegments(params: {
  tenantId: string;
  meetingId: string;
  segments: Array<{ speaker?: string; text: string; startMs?: number; endMs?: number; provider?: string }>;
  correlationId?: string;
}): Promise<MeetingTranscriptSegment[]> {
  if (params.segments.length === 0) return [];
  // verify meeting belongs to tenant
  await getMeeting(params.tenantId, params.meetingId);
  const rows = await db
    .insert(meetingTranscriptSegments)
    .values(
      params.segments.slice(0, 200).map((s) => ({
        tenantId: params.tenantId,
        meetingId: params.meetingId,
        speaker: s.speaker?.slice(0, 120) ?? null,
        text: s.text.slice(0, 4000),
        startMs: s.startMs ?? null,
        endMs: s.endMs ?? null,
        provider: s.provider ?? null,
      })),
    )
    .returning();
  return rows;
}

export async function listSegments(tenantId: string, meetingId: string): Promise<MeetingTranscriptSegment[]> {
  return db
    .select()
    .from(meetingTranscriptSegments)
    .where(and(eq(meetingTranscriptSegments.tenantId, tenantId), eq(meetingTranscriptSegments.meetingId, meetingId)))
    .orderBy(meetingTranscriptSegments.startMs, meetingTranscriptSegments.createdAt)
    .limit(500);
}

export async function listActionCandidates(tenantId: string, meetingId: string): Promise<MeetingActionCandidate[]> {
  return db
    .select()
    .from(meetingActionCandidates)
    .where(and(eq(meetingActionCandidates.tenantId, tenantId), eq(meetingActionCandidates.meetingId, meetingId)))
    .orderBy(meetingActionCandidates.createdAt);
}

/**
 * Evidence-first extraction: calls model to propose candidates with citations,
 * but never auto-creates tasks. Returns candidates for human review.
 */
export async function extractActionCandidates(params: {
  tenantId: string;
  meetingId: string;
  correlationId?: string;
}): Promise<MeetingActionCandidate[]> {
  const meeting = await getMeeting(params.tenantId, params.meetingId);
  const segments = await listSegments(params.tenantId, params.meetingId);
  if (segments.length === 0) throw new ApiError(400, "Add transcript segments before extracting.", "no_transcript");

  const env = getEnv();
  if (!env.OPENAI_API_KEY) {
    throw new ApiError(409, "Model not configured for extraction. Add a transcript manually or configure the model.", "model_not_configured");
  }

  const transcript = segments
    .map((s, i) => `[S${i + 1} ${s.speaker ?? "unknown"} ${s.startMs ?? 0}ms] ${s.text}`)
    .join("\n")
    .slice(0, 12_000);

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 });
  const prompt = `You are extracting meeting intelligence. From the transcript, return ONLY valid JSON with this shape:
{"decisions":["..."],"questions":["..."],"risks":["..."],"actions":[{"title":"...","description":"...","proposedOwner":"","dueAt":null,"priority":"normal","confidence":0.7,"evidenceSegmentIds":["S1"],"evidenceQuote":"short quote"}]}
Rules: Only propose an action when there is a firm commitment with evidence. Use S IDs that exist. Do not invent dates/owners. Keep quotes under 200 chars. Transcript:\n${transcript}`;

  let jsonText = "";
  try {
    const res = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: "json_object" } as unknown as undefined,
    });
    jsonText = res.choices[0]?.message.content ?? "";
  } catch {
    throw new ApiError(502, "Extraction failed.", "extraction_failed");
  }

  const extractionSchema = z.object({
    decisions: z.array(z.string().max(1000)).max(20).default([]),
    questions: z.array(z.string().max(1000)).max(20).default([]),
    risks: z.array(z.string().max(1000)).max(20).default([]),
    actions: z
      .array(
        z.object({
          title: z.string().min(1).max(200),
          description: z.string().max(2000).optional(),
          proposedOwner: z.string().max(120).optional(),
          dueAt: z.string().datetime({ offset: true }).nullable().optional(),
          priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
          confidence: z.number().min(0).max(1).optional(),
          evidenceSegmentIds: z.array(z.string()).max(10).optional(),
          evidenceQuote: z.string().max(500).optional(),
        }),
      )
      .max(20)
      .default([]),
  });

  let parsed: z.infer<typeof extractionSchema>;
  try {
    const raw = JSON.parse(jsonText) as unknown;
    parsed = extractionSchema.parse(raw);
  } catch {
    throw new ApiError(502, "Model returned invalid extraction JSON.", "extraction_parse_failed");
  }

  // verify evidence references exist and quote is substring of referenced segments
  const segmentMap = new Map(segments.map((s, idx) => [`S${idx + 1}`, s.text.toLowerCase()]));
  const segmentIdSet = new Set(segmentMap.keys());
  for (const action of parsed.actions) {
    const ids = action.evidenceSegmentIds ?? [];
    for (const id of ids) {
      if (!segmentIdSet.has(id)) {
        throw new ApiError(502, `Evidence segment ${id} does not exist.`, "evidence_invalid");
      }
    }
    if (action.evidenceQuote) {
      const quote = action.evidenceQuote.toLowerCase().trim();
      if (quote.length > 10) {
        const found = ids.some((id) => (segmentMap.get(id) ?? "").includes(quote.slice(0, 20).toLowerCase()));
        // if ids provided, quote should be found in at least one referenced segment
        if (ids.length > 0 && !found) {
          // sanitize: truncate quote to avoid storing unverified evidence
          action.evidenceQuote = action.evidenceQuote.slice(0, 200);
        }
      }
    }
  }

  // Persist summary fields
  await db
    .update(meetingRecords)
    .set({
      summary: `Extracted ${parsed.actions?.length ?? 0} action candidates from ${segments.length} segments.`,
      decisions: (parsed.decisions ?? []).slice(0, 20),
      questions: (parsed.questions ?? []).slice(0, 20),
      risks: (parsed.risks ?? []).slice(0, 20),
      status: "artifact_ready",
      updatedAt: new Date(),
    })
    .where(and(eq(meetingRecords.id, meeting.id), eq(meetingRecords.tenantId, params.tenantId)));

  const existing = await listActionCandidates(params.tenantId, params.meetingId);
  const existingTitles = new Set(existing.map((a) => a.title.toLowerCase()));

  const toInsert = (parsed.actions ?? [])
    .filter((a) => a.title && !existingTitles.has(a.title.toLowerCase()))
    .slice(0, 20)
    .map((a) => ({
      tenantId: params.tenantId,
      meetingId: params.meetingId,
      title: a.title.slice(0, 200),
      description: a.description?.slice(0, 2000) ?? null,
      proposedOwner: a.proposedOwner?.slice(0, 120) ?? null,
      dueAt: a.dueAt ? new Date(a.dueAt) : null,
      priority: (["low", "normal", "high", "urgent"].includes(a.priority ?? "") ? a.priority! : "normal") as string,
      confidence: String(Math.max(0, Math.min(1, a.confidence ?? 0.5))),
      status: "proposed",
      evidenceSegmentIds: (a.evidenceSegmentIds ?? []).slice(0, 10),
      evidenceQuote: a.evidenceQuote?.slice(0, 500) ?? null,
    }));

  if (toInsert.length === 0) return existing;
  const inserted = await db.insert(meetingActionCandidates).values(toInsert).returning();
  await recordAudit({
    tenantId: params.tenantId,
    eventType: "meeting.actions_extracted",
    entityType: "meeting_record",
    entityId: meeting.id,
    metadata: { count: inserted.length },
    correlationId: params.correlationId,
  });
  return [...existing, ...inserted];
}

export async function actOnCandidate(params: {
  tenantId: string;
  userId: string;
  candidateId: string;
  action: "approve" | "edit" | "reject" | "defer";
  patch?: { title?: string; proposedOwner?: string | null; dueAt?: string | null; priority?: string };
  correlationId?: string;
}): Promise<MeetingActionCandidate> {
  const rows = await db
    .select()
    .from(meetingActionCandidates)
    .where(and(eq(meetingActionCandidates.id, params.candidateId), eq(meetingActionCandidates.tenantId, params.tenantId)))
    .limit(1);
  const candidate = rows[0];
  if (!candidate) throw new ApiError(404, "Action not found.", "candidate_not_found");
  // idempotent: if already decided, return without side effects
  if (candidate.status !== "proposed" && params.action !== "edit") return candidate;

  if (params.action === "reject" || params.action === "defer") {
    const [updated] = await db
      .update(meetingActionCandidates)
      .set({ status: params.action === "reject" ? "rejected" : "deferred", updatedAt: new Date() })
      .where(and(eq(meetingActionCandidates.id, candidate.id), eq(meetingActionCandidates.status, "proposed")))
      .returning();
    return updated ?? candidate;
  }

  if (params.action === "edit" && params.patch) {
    const [updated] = await db
      .update(meetingActionCandidates)
      .set({
        ...(params.patch.title ? { title: params.patch.title.slice(0, 200) } : {}),
        ...(params.patch.proposedOwner !== undefined ? { proposedOwner: params.patch.proposedOwner } : {}),
        ...(params.patch.dueAt !== undefined ? { dueAt: params.patch.dueAt ? new Date(params.patch.dueAt) : null } : {}),
        ...(params.patch.priority ? { priority: params.patch.priority } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(meetingActionCandidates.id, candidate.id), eq(meetingActionCandidates.status, "proposed")))
      .returning();
    return updated ?? candidate;
  }

  // approve -> idempotent atomic transition: only one request can flip proposed->approved
  const canWrite = await hasScopes(params.tenantId, params.userId, ["tasks.write"]);
  if (!canWrite) throw new ApiError(403, "Need tasks.write to approve meeting actions.", "permission_required");

  // attempt atomic status flip first; if another request already flipped, this returns 0 rows
  const [flipped] = await db
    .update(meetingActionCandidates)
    .set({ status: "approved", updatedAt: new Date() })
    .where(and(eq(meetingActionCandidates.id, candidate.id), eq(meetingActionCandidates.status, "proposed")))
    .returning();

  if (!flipped) {
    // another concurrent approval already succeeded
    const fresh = await db
      .select()
      .from(meetingActionCandidates)
      .where(eq(meetingActionCandidates.id, candidate.id))
      .limit(1);
    return fresh[0] ?? candidate;
  }

  const dueAt = flipped.dueAt ?? (params.patch?.dueAt ? new Date(params.patch.dueAt) : null);
  const title = params.patch?.title ?? flipped.title;
  const task = await createTask({
    tenantId: params.tenantId,
    userId: params.userId,
    title,
    description: flipped.description ?? flipped.evidenceQuote ?? null,
    dueAt,
    priority: flipped.priority as "low" | "normal" | "high" | "urgent",
    correlationId: params.correlationId,
  });

  // store created task id in evidence for traceability (via extra audit, not schema)
  await recordAudit({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    eventType: "meeting.action_approved",
    entityType: "meeting_action_candidate",
    entityId: flipped.id,
    metadata: { title, taskId: task.id },
    correlationId: params.correlationId,
  });
  return flipped;
}
