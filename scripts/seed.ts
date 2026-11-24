/**
 * Seeds two synthetic test tenants for cross-tenant QA.
 *
 * No assistant display name is seeded: the first-use naming flow must be
 * exercised by the user/QA. Credentials are local test-only and must never be
 * used outside this machine.
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { assistantProfiles, incidents, tasks, tenants, users } from "../src/db/schema";

const TEST_PASSWORD = process.env.SEED_PASSWORD ?? "Loop1-Test-Pass-2026";

async function seedTenant(params: {
  name: string;
  slug: string;
  email: string;
  userName: string;
  taskTitle: string;
  incidentTitle: string;
}) {
  const existing = await db.select().from(tenants).where(eq(tenants.slug, params.slug)).limit(1);
  if (existing[0]) {
    console.log(`Skipping ${params.slug} (already exists).`);
    return;
  }

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: params.name, slug: params.slug })
      .returning();
    if (!tenant) throw new Error("tenant insert failed");

    const [user] = await tx
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: params.email,
        passwordHash,
        displayName: params.userName,
        role: "owner",
      })
      .returning();
    if (!user) throw new Error("user insert failed");

    await tx.insert(assistantProfiles).values({
      tenantId: tenant.id,
      ownerUserId: user.id,
      displayName: null,
      onboardingCompletedAt: null,
    });

    await tx.insert(tasks).values({
      tenantId: tenant.id,
      userId: user.id,
      title: params.taskTitle,
      description: "Synthetic QA task. Safe to delete with the test database.",
      priority: "high",
      status: "open",
      source: "user",
      dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    await tx.insert(incidents).values({
      tenantId: tenant.id,
      severity: "info",
      title: params.incidentTitle,
      description: "Synthetic QA incident for tenant-isolation tests.",
      source: "qa_seed",
      status: "open",
      dedupeKey: "qa.seed.incident",
    });
  });
  console.log(`Seeded ${params.slug}.`);
}

async function main() {
  await seedTenant({
    name: "Alpha Test Workspace",
    slug: "alpha-test",
    email: "owner@alpha.test",
    userName: "Alpha Owner",
    taskTitle: "Alpha-only task",
    incidentTitle: "Alpha-only incident",
  });
  await seedTenant({
    name: "Beta Test Workspace",
    slug: "beta-test",
    email: "owner@beta.test",
    userName: "Beta Owner",
    taskTitle: "Beta-only task",
    incidentTitle: "Beta-only incident",
  });
  console.log(`Test password for both seeded users: ${TEST_PASSWORD}`);
  console.log("Assistant display names remain NULL so onboarding can be tested.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Seed failed:", error instanceof Error ? error.message : "unknown error");
    process.exit(1);
  });
