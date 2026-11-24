import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { correlationIdFor } from "@/lib/api-utils";
import { requireApiSession } from "@/modules/auth/session";
import { db } from "@/db/client";
import { engineeringAudits, engineeringFindings, engineeringRepositories } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlationId = correlationIdFor(request);
  try {
    const session = await requireApiSession();
    const { id } = await context.params;
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "json";
    const auditRows = await db.select().from(engineeringAudits).where(and(eq(engineeringAudits.id, id), eq(engineeringAudits.tenantId, session.user.tenantId))).limit(1);
    const audit = auditRows[0];
    if (!audit) return NextResponse.json({ error: { code: "not_found", message: "Audit not found" } }, { status: 404 });
    const repoRows = await db.select().from(engineeringRepositories).where(eq(engineeringRepositories.id, audit.repositoryId)).limit(1);
    const findings = await db.select().from(engineeringFindings).where(and(eq(engineeringFindings.auditId, id), eq(engineeringFindings.tenantId, session.user.tenantId)));
    // Enforce trust gate: CONFIRMED requires verification artifact, otherwise downgrade to UNVERIFIED (do not trust bridge shortcut)
    const sanitized = findings.map((f) => {
      const needsArtifact = f.trustState === "CONFIRMED";
      const hasArtifact = Boolean(f.verification && (f.verification as { artifactId?: string }).artifactId);
      const trustState = needsArtifact && !hasArtifact ? "UNVERIFIED" : f.trustState;
      const evidence = (f.evidence as Array<{ file: string; lineStart?: number; lineEnd?: number; symbol?: string; excerpt?: string; valid: boolean }>).map((e) => ({ ...e, excerpt: e.excerpt ? e.excerpt.slice(0, 200) : "" }));
      return { ...f, trustState, evidence };
    });
    if (format === "markdown") {
      const md = `# Engineering Audit Report — ${audit.id.slice(0, 8)}\n\n**Repository:** ${repoRows[0]?.displayName ?? audit.repositoryId} • **Branch:** ${audit.branch ?? "—"} • **Commit:** ${audit.commitSha?.slice(0, 7) ?? "—"} • **Dirty:** ${audit.dirty ? "yes" : "no"} • **Snapshot:** ${audit.snapshotSha256 ?? "—"}\n\n**Scope:** ${audit.scopeType} ${audit.scopeTarget ?? ""} • **Profile:** ${audit.reviewProfile} • **Status:** ${audit.status}\n\n**Findings:** ${sanitized.length} — ${sanitized.filter((f) => f.trustState === "CONFIRMED").length} CONFIRMED (artifact required)\n\n${sanitized.map((f) => `## ${f.severity.toUpperCase()} — ${f.title}\n*${f.category} • ${f.trustState}*\n\n${f.description}\n\nEvidence: ${f.evidence.map((e) => `${e.file}:${e.lineStart ?? 1} ${e.symbol ?? ""}`).join(", ")}\n`).join("\n")}\n`;
      return new NextResponse(md, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="audit-${audit.id.slice(0, 8)}.md"` } });
    }
    return NextResponse.json({ audit, repository: repoRows[0], findings: sanitized, meta: { forgeVersion: audit.forgeVersion, adapterVersion: audit.adapterVersion, snapshotSha256: audit.snapshotSha256 } });
  } catch (e) {
    return jsonError(e, correlationId);
  }
}
