import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { assistantProfiles, tenants, users } from "@/db/schema";
import type { User } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { slugify, validateDisplayName } from "@/lib/security/text";
import { recordAudit } from "@/modules/audit/service";

export async function createWorkspace(input: {
  workspaceName: string;
  fullName: string;
  email: string;
  password: string;
  correlationId?: string;
}): Promise<User> {
  const nameCheck = validateDisplayName(input.fullName);
  if (!nameCheck.ok) throw new ApiError(400, "Enter your name using letters and spaces.", "invalid_name");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const slug = `${slugify(input.workspaceName)}-${randomBytes(3).toString("hex")}`;

  const created = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: input.workspaceName.trim(), slug })
      .returning();
    if (!tenant) throw new ApiError(500, "Could not create the workspace.", "tenant_create_failed");

    const [user] = await tx
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: input.email,
        passwordHash,
        displayName: nameCheck.value,
        role: "owner",
      })
      .returning();
    if (!user) throw new ApiError(500, "Could not create the account.", "user_create_failed");

    await tx.insert(assistantProfiles).values({
      tenantId: tenant.id,
      ownerUserId: user.id,
      displayName: null,
      onboardingCompletedAt: null,
    });

    return { tenant, user };
  });

  await recordAudit({
    tenantId: created.tenant.id,
    actorUserId: created.user.id,
    eventType: "workspace.created",
    entityType: "tenant",
    entityId: created.tenant.id,
    metadata: { workspaceName: created.tenant.name },
    correlationId: input.correlationId,
  });
  await recordAudit({
    tenantId: created.tenant.id,
    actorUserId: created.user.id,
    eventType: "user.created",
    entityType: "user",
    entityId: created.user.id,
    metadata: { role: created.user.role },
    correlationId: input.correlationId,
  });

  return created.user;
}

export async function authenticate(input: {
  email: string;
  password: string;
  workspaceSlug?: string;
  correlationId?: string;
}): Promise<User> {
  const conditions = [sql`lower(${users.email}) = ${input.email.toLowerCase()}`];
  if (input.workspaceSlug) {
    conditions.push(eq(tenants.slug, input.workspaceSlug));
  }

  const rows = await db
    .select({ user: users, tenant: tenants })
    .from(users)
    .innerJoin(tenants, eq(users.tenantId, tenants.id))
    .where(and(...conditions))
    .limit(5);

  if (rows.length === 0) {
    throw new ApiError(401, "Email, password or workspace is incorrect.", "invalid_credentials");
  }
  if (rows.length > 1) {
    throw new ApiError(
      409,
      "More than one workspace uses this email. Enter the workspace code shown to you.",
      "workspace_required",
    );
  }

  const row = rows[0];
  if (!row) throw new ApiError(401, "Email, password or workspace is incorrect.", "invalid_credentials");
  const valid = await bcrypt.compare(input.password, row.user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Email, password or workspace is incorrect.", "invalid_credentials");
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, row.user.id));
  await recordAudit({
    tenantId: row.tenant.id,
    actorUserId: row.user.id,
    eventType: "user.signed_in",
    entityType: "user",
    entityId: row.user.id,
    metadata: {},
    correlationId: input.correlationId,
  });

  return row.user;
}
