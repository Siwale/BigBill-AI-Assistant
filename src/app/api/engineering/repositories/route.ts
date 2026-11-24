import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { db } from "@/db/client";
import { engineeringRepositories } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { recordAudit } from "@/modules/audit/service";
import { realpathSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const registerSchema = z.object({
  displayName: z.string().min(1).max(100),
  canonicalPath: z.string().min(1).max(500),
  allowedRootId: z.string().min(1).max(100),
});

function isPathAllowed(canonical: string, allowedRoot: string): boolean {
  // Allow only approved roots — for demo, allow /home/bill/BigBill Systems/AI_assistant and /home/bill/BigBill Systems/Forge and /tmp
  const allowed = ["/home/bill/BigBill Systems/AI_assistant", "/home/bill/BigBill Systems/Forge", "/tmp"];
  const root = allowed.find((r) => canonical.startsWith(r));
  if (!root) return false;
  if (allowedRoot && !root.includes(allowedRoot) && allowedRoot !== "default") return false;
  return true;
}

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    const session = await requireApiSession();
    const rows = await db.select().from(engineeringRepositories).where(eq(engineeringRepositories.tenantId, session.user.tenantId)).limit(50);
    return NextResponse.json({ repositories: rows });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, registerSchema);
    let canonical: string;
    try {
      const resolved = resolve(input.canonicalPath);
      if (!existsSync(resolved)) throw new Error("Path does not exist");
      canonical = realpathSync(resolved);
    } catch {
      return NextResponse.json({ error: { code: "invalid_path", message: "Path does not exist or cannot be resolved" } }, { status: 400 });
    }
    if (canonical.includes("..") || canonical.includes("\0")) {
      return NextResponse.json({ error: { code: "invalid_path", message: "Path traversal rejected" } }, { status: 400 });
    }
    if (!isPathAllowed(canonical, input.allowedRootId)) {
      return NextResponse.json({ error: { code: "forbidden_root", message: "Path outside approved roots" } }, { status: 403 });
    }
    // Check symlink escape: realpath already resolves, and we checked prefix
    const existing = await db.select().from(engineeringRepositories).where(and(eq(engineeringRepositories.tenantId, session.user.tenantId), eq(engineeringRepositories.canonicalPath, canonical))).limit(1);
    if (existing[0]) return NextResponse.json({ repository: existing[0] });
    const [created] = await db.insert(engineeringRepositories).values({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      displayName: input.displayName,
      canonicalPath: canonical,
      allowedRootId: input.allowedRootId,
      enabled: true,
    }).returning();
    if (!created) throw new Error("Create failed");
    await recordAudit({ tenantId: session.user.tenantId, actorUserId: session.user.id, eventType: "engineering.repository_registered", entityType: "engineering_repository", entityId: created.id, metadata: { displayName: input.displayName }, correlationId });
    return NextResponse.json({ repository: created }, { status: 201 });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
