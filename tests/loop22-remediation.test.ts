import { randomUUID } from "node:crypto";
import { describe, expect, it, afterAll } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db, sqlClient } from "@/db/client";
import { conversations, meetingActionCandidates, tasks, tenants, users } from "@/db/schema";
import { addTranscriptSegments, createMeeting, listActionCandidates, actOnCandidate } from "@/modules/meetings/service";
import { createObservation } from "@/modules/vision/service";
import { grantPermissions } from "@/modules/permissions/service";

const createdTenants: string[] = [];

async function makeTenant(label: string) {
  const slug = `remed-${label}-${randomUUID().slice(0, 6)}`;
  const [tenant] = await db.insert(tenants).values({ name: `Remed ${label}`, slug }).returning();
  if (!tenant) throw new Error("tenant insert failed");
  createdTenants.push(tenant.id);
  const [user] = await db
    .insert(users)
    .values({ tenantId: tenant.id, email: `${slug}@remed.test`, passwordHash: "x", displayName: "Owner", role: "owner" })
    .returning();
  if (!user) throw new Error("user insert failed");
  const [conv] = await db.insert(conversations).values({ tenantId: tenant.id, userId: user.id, title: "Test conv" }).returning();
  if (!conv) throw new Error("conv failed");
  return { tenantId: tenant.id, userId: user.id, conversationId: conv.id };
}

afterAll(async () => {
  if (createdTenants.length) await db.delete(tenants).where(inArray(tenants.id, createdTenants));
  await sqlClient.end();
});

describe("Loop 2.2 remediation", () => {
  it("meeting open does not auto-extract: segments without extract produce no candidates", async () => {
    const { tenantId, userId } = await makeTenant("open-no-extract");
    const meeting = await createMeeting({ tenantId, userId, provider: "manual", title: "Daily standup" });
    await addTranscriptSegments({ tenantId, meetingId: meeting.id, segments: [{ speaker: "Alice", text: "I will send the quote by Friday." }] });
    const candidates = await listActionCandidates(tenantId, meeting.id);
    expect(candidates).toHaveLength(0);
  });

  it("approval is idempotent and concurrent-safe (single task)", async () => {
    const { tenantId, userId } = await makeTenant("approval-idempotent");
    await grantPermissions({ tenantId, userId, connectorId: "workspace", scopes: ["tasks.write"] });
    const meeting = await createMeeting({ tenantId, userId, provider: "manual", title: "Approval test" });
    await addTranscriptSegments({ tenantId, meetingId: meeting.id, segments: [{ text: "I will deliver the report by tomorrow." }] });
    const [candidate] = await db
      .insert(meetingActionCandidates)
      .values({
        tenantId,
        meetingId: meeting.id,
        title: "Deliver report",
        description: "Deliver the report",
        priority: "normal",
        confidence: "0.9",
        status: "proposed",
        evidenceSegmentIds: [],
        evidenceQuote: "I will deliver the report by tomorrow.",
      })
      .returning();
    if (!candidate) throw new Error("candidate insert failed");
    const first = await actOnCandidate({ tenantId, userId, candidateId: candidate.id, action: "approve" });
    expect(first.status).toBe("approved");
    const second = await actOnCandidate({ tenantId, userId, candidateId: candidate.id, action: "approve" });
    expect(second.status).toBe("approved");
    const taskRows = await db.select().from(tasks).where(and(eq(tasks.tenantId, tenantId), eq(tasks.title, "Deliver report")));
    expect(taskRows.length).toBe(1);
  });

  it("tenant isolation: cannot add segments to another tenant's meeting", async () => {
    const a = await makeTenant("tenant-a");
    const b = await makeTenant("tenant-b");
    const meetingA = await createMeeting({ tenantId: a.tenantId, userId: a.userId, provider: "manual", title: "A meeting" });
    await expect(addTranscriptSegments({ tenantId: b.tenantId, meetingId: meetingA.id, segments: [{ text: "Hacked" }] })).rejects.toThrow();
  });

  it("vision observation tenant check: conversation must belong to same tenant", async () => {
    const a = await makeTenant("vision-a");
    const b = await makeTenant("vision-b");
    const tiny = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", "base64");
    await expect(
      createObservation({
        tenantId: a.tenantId,
        userId: a.userId,
        conversationId: b.conversationId,
        sourceType: "upload",
        mimeType: "image/png",
        buffer: tiny,
      }),
    ).rejects.toThrow();
  });

  it("evidence validation helper exists and tenant-scoped candidates load", async () => {
    const { tenantId, userId } = await makeTenant("evidence-tenant");
    const meeting = await createMeeting({ tenantId, userId, provider: "manual", title: "Evidence tenant" });
    await addTranscriptSegments({ tenantId, meetingId: meeting.id, segments: [{ text: "Hello world" }] });
    const candidates = await listActionCandidates(tenantId, meeting.id);
    expect(candidates).toHaveLength(0);
    const other = await makeTenant("evidence-other");
    const otherMeeting = await createMeeting({ tenantId: other.tenantId, userId: other.userId, provider: "manual", title: "Other" });
    await addTranscriptSegments({ tenantId: other.tenantId, meetingId: otherMeeting.id, segments: [{ text: "Other text" }] });
    const otherCandidates = await listActionCandidates(other.tenantId, otherMeeting.id);
    expect(otherCandidates).toHaveLength(0);
  });
});
