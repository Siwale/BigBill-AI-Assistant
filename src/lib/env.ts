import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default(
    "postgres://assistant:assistant_local_dev@127.0.0.1:5437/assistant",
  ),
  REDIS_URL: z.string().min(1).default("redis://127.0.0.1:6384"),
  AUTH_SECRET: z
    .string()
    .min(32)
    .default("development-only-secret-change-me-0123456789"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  LLM_PROVIDER: z.enum(["openai", "deepseek", "openrouter"]).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("openai/gpt-4o-mini"),
  OPENAI_STT_MODEL: z.string().default("whisper-1"),
  OPENAI_TTS_MODEL: z.string().default("gpt-4o-mini-tts"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  WEBHOOK_SHARED_SECRET: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join("."));
    throw new Error(`Invalid environment configuration: ${names.join(", ")}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.AUTH_SECRET.includes("development-only")) {
    throw new Error("AUTH_SECRET must be replaced in production.");
  }
  cached = parsed.data;
  return cached;
}

export type LlmConfig = {
  provider: "openai" | "deepseek" | "openrouter";
  apiKey: string;
  baseUrl: string;
  model: string;
  configured: boolean;
};

/**
 * Provider-neutral model selection. Values are read only on the server.
 * If no key is configured the assistant reports degraded mode instead of
 * fabricating model output.
 */
export function getLlmConfig(): LlmConfig {
  const env = getEnv();
  const preferred = env.LLM_PROVIDER;

  if ((preferred === "openai" || !preferred) && env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: env.OPENAI_API_KEY,
      baseUrl: "https://api.openai.com/v1",
      model: env.OPENAI_MODEL,
      configured: true,
    };
  }
  if ((preferred === "deepseek" || !preferred) && env.DEEPSEEK_API_KEY) {
    return {
      provider: "deepseek",
      apiKey: env.DEEPSEEK_API_KEY,
      baseUrl: "https://api.deepseek.com/v1",
      model: env.DEEPSEEK_MODEL,
      configured: true,
    };
  }
  if ((preferred === "openrouter" || !preferred) && env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      apiKey: env.OPENROUTER_API_KEY,
      baseUrl: "https://openrouter.ai/api/v1",
      model: env.OPENROUTER_MODEL,
      configured: true,
    };
  }

  return {
    provider: preferred ?? "openai",
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: env.OPENAI_MODEL,
    configured: false,
  };
}

export function hasOpenAiSpeech(): boolean {
  return Boolean(getEnv().OPENAI_API_KEY);
}
