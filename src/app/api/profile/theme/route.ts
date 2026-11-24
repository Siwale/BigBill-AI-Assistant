import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireOwner } from "@/modules/auth/session";
import { updatePersona } from "@/modules/profile/service";
import { db } from "@/db/client";
import { assistantProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

const schema = z.object({ theme: z.enum(["classic", "mission_control", "audio_simulator"]) });

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireOwner();
    const input = await parseJson(request, schema);
    // store theme inside personaConfig.theme for tenant-scoped persistence
    const existing = session.profile.personaConfig as Record<string, unknown>;
    await db
      .update(assistantProfiles)
      .set({ personaConfig: { ...existing, theme: input.theme }, updatedAt: new Date() })
      .where(eq(assistantProfiles.tenantId, session.user.tenantId));
    // also use persona service audit path
    await updatePersona({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      correlationId,
    });
    return NextResponse.json({ ok: true, theme: input.theme });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
