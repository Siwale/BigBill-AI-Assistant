import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { getEnv } from "../src/lib/env";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? getEnv().DATABASE_URL;
  const client = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    await client`create extension if not exists vector`;
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
