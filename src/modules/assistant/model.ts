import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { getLlmConfig, getEnv } from "@/lib/env";

export type ModelToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type ModelResult = {
  content: string;
  toolCalls: ModelToolCall[];
  usage: { promptTokens: number; completionTokens: number };
  model: string;
  provider: string;
};

export class ModelError extends Error {
  constructor(
    public kind: "unconfigured" | "auth" | "rate_limit" | "timeout" | "provider" | "invalid",
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ModelError";
  }
}

let client: OpenAI | null = null;
let clientKey = "";

function getClient(): OpenAI {
  const config = getLlmConfig();
  if (!config.configured) {
    throw new ModelError("unconfigured", "No model provider is configured for this deployment.");
  }
  const cacheKey = `${config.provider}:${config.apiKey.slice(-6)}:${config.baseUrl}`;
  if (!client || clientKey !== cacheKey) {
    client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: 45_000,
      maxRetries: 1,
      defaultHeaders:
        config.provider === "openrouter"
          ? { "HTTP-Referer": getEnv().APP_URL, "X-Title": "BigBill AI Assistant" }
          : undefined,
    });
    clientKey = cacheKey;
  }
  return client;
}

function normalizeError(error: unknown): ModelError {
  if (error instanceof ModelError) return error;
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) {
      return new ModelError("auth", "The model provider rejected the configured credentials.", error.status ?? undefined, error.code ?? undefined);
    }
    if (error.status === 429) {
      return new ModelError("rate_limit", "The model provider is rate limiting requests.", error.status ?? undefined, error.code ?? undefined);
    }
    if (error.status === 408 || error.code === "ETIMEDOUT") {
      return new ModelError("timeout", "The model provider timed out.", error.status ?? undefined, error.code ?? undefined);
    }
    return new ModelError("provider", `The model provider returned an error (${error.status ?? "unknown"}).`, error.status ?? undefined, error.code ?? undefined);
  }
  if (error instanceof Error && /abort|timeout/i.test(error.message)) {
    return new ModelError("timeout", "The model request timed out.", undefined, "ABORT_OR_TIMEOUT");
  }
  const code = error instanceof Error ? (error as Error & { code?: string }).code ?? error.name : "UNKNOWN";
  return new ModelError("provider", "The model provider could not be reached.", undefined, code);
}

export async function runChatCompletion(params: {
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
}): Promise<ModelResult> {
  const config = getLlmConfig();
  try {
    const response = await getClient().chat.completions.create(
      {
        model: config.model,
        messages: params.messages,
        tools: params.tools.length > 0 ? params.tools : undefined,
        tool_choice: params.tools.length > 0 ? "auto" : undefined,
        temperature: 0.3,
        max_tokens: 1400,
      },
      { signal: AbortSignal.timeout(45_000) },
    );

    const choice = response.choices[0];
    if (!choice) throw new ModelError("invalid", "The model returned no response.");
    const message = choice.message;
    const toolCalls: ModelToolCall[] = (message.tool_calls ?? [])
      .filter((call): call is typeof call & { type: "function" } => call.type === "function")
      .map((call) => ({ id: call.id, name: call.function.name, arguments: call.function.arguments }));

    return {
      content: message.content ?? "",
      toolCalls,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
      },
      model: response.model || config.model,
      provider: config.provider,
    };
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * Embeddings use OpenAI when that key exists. If another chat provider is
 * configured, lexical retrieval still works and the UI labels the index as
 * lexical-only. No silent fake vectors.
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const env = getEnv();
  if (!env.OPENAI_API_KEY) return null;
  try {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 1 });
    const response = await openai.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  } catch {
    return null;
  }
}

const ALLOWED_TTS_VOICES = new Set([
  "alloy",
  "ash",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
]);

export function safeTtsVoice(voiceId: string | undefined): string {
  return voiceId && ALLOWED_TTS_VOICES.has(voiceId) ? voiceId : "alloy";
}

export async function transcribeAudio(file: File, language?: string): Promise<string> {
  const env = getEnv();
  if (!env.OPENAI_API_KEY) throw new ModelError("unconfigured", "Server speech transcription is not configured.");
  try {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 1 });
    const result = await openai.audio.transcriptions.create({
      file,
      model: env.OPENAI_STT_MODEL,
      ...(language ? { language } : {}),
    });
    return result.text.trim();
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function synthesizeSpeech(text: string, voiceId?: string): Promise<Buffer> {
  const env = getEnv();
  if (!env.OPENAI_API_KEY) throw new ModelError("unconfigured", "Server speech synthesis is not configured.");
  try {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 1 });
    const response = await openai.audio.speech.create({
      model: env.OPENAI_TTS_MODEL,
      voice: safeTtsVoice(voiceId),
      input: text.slice(0, 4000),
      response_format: "mp3",
    });
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    throw normalizeError(error);
  }
}

export function modelConfigured(): boolean {
  return getLlmConfig().configured;
}
