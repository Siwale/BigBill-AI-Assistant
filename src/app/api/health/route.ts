import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getLlmConfig, hasOpenAiSpeech } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = false;
  try {
    await db.execute(sql`select 1`);
    database = true;
  } catch {
    database = false;
  }
  const llm = getLlmConfig();
  return NextResponse.json(
    {
      status: database ? "ok" : "degraded",
      database,
      model: { configured: llm.configured, provider: llm.configured ? llm.provider : null },
      speech: { serverFallback: hasOpenAiSpeech() },
      loop: 1,
      time: new Date().toISOString(),
    },
    { status: database ? 200 : 503 },
  );
}
