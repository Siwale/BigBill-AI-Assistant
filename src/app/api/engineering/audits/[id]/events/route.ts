import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { db } from "@/db/client";
import { engineeringAudits, engineeringAuditEvents } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = correlationIdFor(request);
  try {
    const session = await requireApiSession();
    const { id } = await context.params;
    const rows = await db.select().from(engineeringAudits).where(and(eq(engineeringAudits.id, id), eq(engineeringAudits.tenantId, session.user.tenantId))).limit(1);
    if (!rows[0]) return NextResponse.json({ error: { code: "not_found", message: "Audit not found" } }, { status: 404 });
    const url = new URL(request.url);
    const since = url.searchParams.get("since") ?? request.headers.get("last-event-id");
    let events = await db.select().from(engineeringAuditEvents).where(eq(engineeringAuditEvents.auditId, id)).orderBy(engineeringAuditEvents.createdAt);
    if (since) {
      const sinceTime = new Date(since);
      if (!isNaN(sinceTime.getTime())) events = events.filter((e) => e.createdAt > sinceTime);
    }
    // SSE or JSON fallback
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/event-stream")) {
      const stream = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          for (const e of events.slice(-100)) {
            controller.enqueue(enc.encode(`id: ${e.createdAt.toISOString()}\nevent: ${e.stage}\ndata: ${JSON.stringify({ stage: e.stage, status: e.status, message: e.message, createdAt: e.createdAt })}\n\n`));
          }
          controller.enqueue(enc.encode(`event: heartbeat\ndata: {}\n\n`));
          controller.close();
        },
      });
      return new NextResponse(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Contract-Version": "1" } });
    }
    return NextResponse.json({ events: events.slice(-100).map((e) => ({ id: e.createdAt.toISOString(), stage: e.stage, status: e.status, message: e.message, createdAt: e.createdAt })) });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
