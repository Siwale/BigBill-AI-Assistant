import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { createMeeting, listMeetings, meetingConnections } from "@/modules/meetings/service";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  provider: z.enum(["zoom", "google_meet", "browser_companion", "manual"]).default("manual"),
  meetingUrl: z.string().url().optional(),
  attendees: z.array(z.string().max(120)).max(50).optional(),
  transcriptSource: z.string().max(200).optional(),
});

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    const session = await requireApiSession();
    const [meetings, connections] = await Promise.all([
      listMeetings(session.user.tenantId),
      Promise.resolve(meetingConnections()),
    ]);
    return NextResponse.json({ meetings, connections });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, createSchema);
    const meeting = await createMeeting({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      provider: input.provider ?? "manual",
      title: input.title,
      meetingUrl: input.meetingUrl ?? null,
      attendees: input.attendees ?? [],
      transcriptSource: input.transcriptSource ?? null,
      correlationId,
    });
    return NextResponse.json({ meeting }, { status: 201 });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
