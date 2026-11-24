import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

type DbBundle = ReturnType<typeof createDb>;
type SqlClient = ReturnType<typeof postgres>;

function createDb() {
  const client = postgres(getEnv().DATABASE_URL, {
    max: 8,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return { db: drizzle(client, { schema }), sqlClient: client };
}

const globalForDb = globalThis as unknown as { __assistantDbBundle?: DbBundle };

const created: DbBundle = globalForDb.__assistantDbBundle ?? createDb();

export const db = created.db;
export const sqlClient: SqlClient = created.sqlClient;

if (process.env.NODE_ENV !== "production") {
  globalForDb.__assistantDbBundle = created;
}

export { schema };
