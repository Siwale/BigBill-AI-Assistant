import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://assistant:assistant_local_dev@127.0.0.1:5437/assistant",
  },
  strict: true,
  verbose: true,
});
