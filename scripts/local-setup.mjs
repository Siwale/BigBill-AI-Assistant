#!/usr/bin/env node
/**
 * Creates a git-ignored .env.local for local development.
 *
 * Usage:
 *   node scripts/local-setup.mjs [path-to-existing-env]
 *
 * If a source env file is provided, only the provider keys are copied. Values
 * are never printed. Existing .env.local is not overwritten unless --force is
 * passed.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const force = args.includes("--force");
const sourceArg = args.find((arg) => !arg.startsWith("--"));
const target = resolve(process.cwd(), ".env.local");

if (existsSync(target) && !force) {
  console.log(".env.local already exists; leaving it untouched.");
  process.exit(0);
}

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

const source = sourceArg && existsSync(sourceArg) ? parseEnv(readFileSync(sourceArg, "utf8")) : {};
const pick = (...names) => {
  for (const name of names) {
    if (source[name]) return source[name];
  }
  return "";
};

const lines = [
  "# Generated locally. Git-ignored. Never commit this file.",
  "DATABASE_URL=postgres://assistant:assistant_local_dev@127.0.0.1:5437/assistant",
  "REDIS_URL=redis://127.0.0.1:6384",
  `AUTH_SECRET=${randomBytes(32).toString("hex")}`,
  "APP_URL=http://localhost:3000",
  "NODE_ENV=development",
  "",
  "LLM_PROVIDER=openai",
  `OPENAI_API_KEY=${pick("OPENAI_API_KEY")}`,
  "OPENAI_MODEL=gpt-4o-mini",
  `DEEPSEEK_API_KEY=${pick("DEEPSEEK_API_KEY")}`,
  "DEEPSEEK_MODEL=deepseek-chat",
  `OPENROUTER_API_KEY=${pick("OPENROUTER_API_KEY")}`,
  "OPENROUTER_MODEL=openai/gpt-4o-mini",
  "",
  "OPENAI_STT_MODEL=whisper-1",
  "OPENAI_TTS_MODEL=gpt-4o-mini-tts",
  "EMBEDDING_MODEL=text-embedding-3-small",
  "",
  "WEBHOOK_SHARED_SECRET=",
  "",
];

writeFileSync(target, lines.join("\n"), { mode: 0o600 });
chmodSync(target, 0o600);
console.log(`Wrote ${target} (0600). Provider keys copied: ${Object.keys(source).filter((k) => k.endsWith("_API_KEY") && source[k]).length}.`);
