import { newCorrelationId } from "@/lib/security/text";
import { ApiError } from "@/lib/http";
import { checkRateLimit } from "@/lib/security/rate-limit";

export function correlationIdFor(request: Request): string {
  const incoming = request.headers.get("x-correlation-id");
  if (incoming && /^[a-zA-Z0-9_-]{8,64}$/.test(incoming)) return incoming;
  return newCorrelationId();
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "local";
}

export function rateLimitOrThrow(key: string, limit: number, windowMs: number): void {
  const result = checkRateLimit(key, limit, windowMs);
  if (!result.allowed) {
    throw new ApiError(429, "Too many requests. Please wait a moment.", "rate_limited", {
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}
