import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inboxEvents, outboxEvents, tenants } from "@/db/schema";
import { webhookSchema } from "@/contracts";
import { getEnv } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { ApiError } from "@/lib/http";

export const runtime = "nodejs";

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const provided = header.replace(/^sha256=/, "").trim();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/**
 * Synthetic webhook ingress used to prove the idempotent inbox/outbox path.
 * It is disabled unless WEBHOOK_SHARED_SECRET is configured, and it performs
 * no external side effects.
 */
export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    const secret = getEnv().WEBHOOK_SHARED_SECRET;
    if (!secret) throw new ApiError(404, "Webhook ingress is not enabled.", "webhook_disabled");

    const rawBody = await request.text();
    if (!verifySignature(rawBody, request.headers.get("x-assistant-signature"), secret)) {
      throw new ApiError(401, "Invalid webhook signature.", "invalid_signature");
    }
    let json: unknown;
    try {
      json = JSON.parse(rawBody) as unknown;
    } catch {
      throw new ApiError(400, "Webhook body must be JSON.", "invalid_json");
    }
    const parsed = webhookSchema.safeParse(json);
    if (!parsed.success) throw new ApiError(400, "Webhook payload is invalid.", "validation_failed");

    const tenant = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, parsed.data.tenantId))
      .limit(1);
    if (!tenant[0]) throw new ApiError(404, "Unknown tenant.", "tenant_unknown");

    const inserted = await db
      .insert(inboxEvents)
      .values({
        tenantId: parsed.data.tenantId,
        source: parsed.data.source,
        externalEventId: parsed.data.externalEventId,
        payload: parsed.data.payload,
      })
      .onConflictDoNothing()
      .returning({ id: inboxEvents.id });

    if (inserted.length === 0) {
      return NextResponse.json({ ok: true, duplicate: true, correlationId }, { status: 200 });
    }

    await db
      .insert(outboxEvents)
      .values({
        tenantId: parsed.data.tenantId,
        eventType: parsed.data.eventType,
        payload: parsed.data.payload,
        idempotencyKey: `${parsed.data.source}:${parsed.data.externalEventId}`,
      })
      .onConflictDoNothing();

    return NextResponse.json({ ok: true, accepted: true, correlationId }, { status: 202 });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
