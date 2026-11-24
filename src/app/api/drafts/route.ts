import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { listDrafts } from "@/modules/drafts/service";

export async function GET(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    const session = await requireApiSession();
    const drafts = await listDrafts(session.user.tenantId, session.user.id);
    return NextResponse.json({ drafts });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
