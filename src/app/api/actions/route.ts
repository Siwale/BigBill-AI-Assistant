import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { actions } from "@/db/schema";
import { jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";

export async function GET(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    const session = await requireApiSession();
    const rows = await db
      .select()
      .from(actions)
      .where(eq(actions.tenantId, session.user.tenantId))
      .orderBy(desc(actions.createdAt))
      .limit(100);
    return NextResponse.json({ actions: rows });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
