import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, parseJson } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { db } from "@/db/client";
import { engineeringAudits, engineeringAuditEvents, engineeringFindings, engineeringRepositories } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { recordAudit } from "@/modules/audit/service";

const startSchema = z.object({
  repositoryId: z.string().uuid(),
  scopeType: z.enum(["whole_repository", "feature", "file", "directory", "api", "function", "class", "question"]).default("whole_repository"),
  scopeTarget: z.string().max(200).optional(),
  reviewProfile: z.enum(["standard", "security", "regression", "architecture"]).default("standard"),
  includeWorkingChanges: z.boolean().default(true),
});

export async function GET() {
  const correlationId = correlationIdFor(new Request("http://localhost"));
  try {
    const session = await requireApiSession();
    const rows = await db.select().from(engineeringAudits).where(eq(engineeringAudits.tenantId, session.user.tenantId)).orderBy(desc(engineeringAudits.createdAt)).limit(50);
    return NextResponse.json({ audits: rows });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = correlationIdFor(request);
  try {
    assertSameOrigin(request);
    const session = await requireApiSession();
    const input = await parseJson(request, startSchema);
    // Validate repository ownership
    const repoRows = await db.select().from(engineeringRepositories).where(and(eq(engineeringRepositories.id, input.repositoryId), eq(engineeringRepositories.tenantId, session.user.tenantId))).limit(1);
    const repo = repoRows[0];
    if (!repo) return NextResponse.json({ error: { code: "not_found", message: "Repository not found for this tenant" } }, { status: 404 });
    if (!repo.enabled) return NextResponse.json({ error: { code: "disabled", message: "Repository disabled" } }, { status: 403 });

    // Create audit row pending
    const [audit] = await db.insert(engineeringAudits).values({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      repositoryId: repo.id,
      scopeType: input.scopeType,
      scopeTarget: input.scopeTarget ?? null,
      reviewProfile: input.reviewProfile,
      includeWorkingChanges: input.includeWorkingChanges,
      status: "pending",
      adapterVersion: "1.0.0",
      branch: repo.branch,
      commitSha: repo.commitSha,
    }).returning();
    if (!audit) throw new Error("Create audit failed");
    await db.insert(engineeringAuditEvents).values({ tenantId: session.user.tenantId, auditId: audit.id, stage: "REQUEST", status: "completed", message: "Request accepted" });
    await db.insert(engineeringAuditEvents).values({ tenantId: session.user.tenantId, auditId: audit.id, stage: "CONNECT", status: "active", message: "Connecting to companion" });

    // Call companion bridge (honest: if companion not available, mark failed)
    let companionResult: unknown = null;
    let companionStatus = 0;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 110_000);
      const res = await fetch("http://127.0.0.1:8787/engineering/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractVersion: "1",
          auditId: audit.id,
          repositoryId: repo.id,
          repositoryPath: repo.canonicalPath,
          scope: { type: input.scopeType, target: input.scopeTarget },
          reviewProfile: input.reviewProfile,
          includeWorkingChanges: input.includeWorkingChanges,
          limits: { maxFiles: 3000, maxFileBytes: 500_000, maxSnapshotBytes: 30_000_000, maxDurationSeconds: 90, maxFindings: 50 },
          correlationId,
        }),
        signal: controller.signal,
      });
      clearTimeout(t);
      companionStatus = res.status;
      const text = await res.text();
      try { companionResult = JSON.parse(text); } catch { companionResult = { raw: text.slice(0, 4000) }; }
    } catch (e) {
      companionResult = { error: e instanceof Error ? e.message : String(e) };
      companionStatus = 502;
    }

    // Persist result — if companion succeeded, store findings with hardened trust gate
    if (companionStatus === 200 && companionResult && typeof companionResult === "object" && (companionResult as { result?: unknown }).result) {
      const r = (companionResult as { result: { findings?: Array<Record<string, unknown>>; source?: Record<string, unknown>; summary?: unknown; stages?: unknown; forgeVersion?: string; adapterVersion?: string; status?: string; skippedChecks?: Array<{ check: string; reason: string }> } }).result;
      const findings = (r.findings ?? []) as Array<Record<string, unknown>>;
      // Hardened verification: require artifact for CONFIRMED, otherwise downgrade
      const skipped = (r as { skippedChecks?: Array<{ check: string; reason: string }> }).skippedChecks ?? [];
      // If sandbox not available, mark verification as skipped
      const hasDocker = false; // honest: Docker sandbox not configured in this loop — verification is static + pytest only, network disabled
      if (!hasDocker) skipped.push({ check: "runtime_verification", reason: "Runtime verification skipped: Docker unavailable — network disabled, no Docker socket" });
      await db.update(engineeringAudits).set({ status: (r.status as string) ?? "completed", forgeVersion: (r.forgeVersion as string) ?? null, snapshotSha256: (r.source as { snapshotSha256?: string })?.snapshotSha256 ?? null, completedAt: new Date(), updatedAt: new Date() }).where(eq(engineeringAudits.id, audit.id));
      for (const f of findings.slice(0, 50)) {
        let trustState = String(f.trustState ?? "UNVERIFIED");
        const verification = f.verification as { method: string; status: string; artifactId?: string; summary: string } | null;
        // Enforce artifact requirement
        if (trustState === "CONFIRMED" && (!verification || !verification.artifactId)) {
          trustState = "UNVERIFIED";
        }
        // Also ensure evidence valid
        const evidence = (f.evidence as Array<{ file: string; lineStart?: number; lineEnd?: number; symbol?: string; excerpt?: string; valid: boolean }>) ?? [];
        const validEvidence = evidence.filter((e) => e.valid !== false).map((e) => ({ ...e, excerpt: e.excerpt ? e.excerpt.slice(0, 200) : "" }));
        await db.insert(engineeringFindings).values({
          tenantId: session.user.tenantId,
          auditId: audit.id,
          category: String(f.category ?? "general"),
          severity: String(f.severity ?? "info"),
          title: String(f.title ?? f.description ?? "Finding").slice(0, 200),
          description: String(f.description ?? "").slice(0, 2000),
          trustState,
          evidence: validEvidence,
          verification: verification ? { ...verification, summary: verification.summary.slice(0, 500) } : null,
        });
      }
      if (skipped.length) {
        for (const s of skipped) {
          await db.insert(engineeringAuditEvents).values({ tenantId: session.user.tenantId, auditId: audit.id, stage: "VERIFY", status: "skipped", message: `${s.check}: ${s.reason}` });
        }
      }
      await db.insert(engineeringAuditEvents).values({ tenantId: session.user.tenantId, auditId: audit.id, stage: "REPORT", status: "completed", message: `Audit completed: ${findings.length} findings` });
    } else {
      // Honest failure — companion not available or Forge not configured
      await db.update(engineeringAudits).set({ status: "failed", updatedAt: new Date(), completedAt: new Date() }).where(eq(engineeringAudits.id, audit.id));
      await db.insert(engineeringAuditEvents).values({ tenantId: session.user.tenantId, auditId: audit.id, stage: "CONNECT", status: "failed", message: companionResult ? JSON.stringify(companionResult).slice(0, 500) : "Companion unavailable" });
    }

    const updated = await db.select().from(engineeringAudits).where(eq(engineeringAudits.id, audit.id)).limit(1);
    await recordAudit({ tenantId: session.user.tenantId, actorUserId: session.user.id, eventType: "engineering.audit_started", entityType: "engineering_audit", entityId: audit.id, metadata: { repositoryId: repo.id, scopeType: input.scopeType }, correlationId });
    return NextResponse.json({ audit: updated[0], companionResult }, { status: 201 });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
