import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/logger";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "request_failed",
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonError(error: unknown, correlationId: string): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details }, correlationId },
      { status: error.status },
    );
  }
  log("error", "unhandled_api_error", {
    correlationId,
    message: error instanceof Error ? error.message : "unknown",
  });
  return NextResponse.json(
    { error: { code: "internal_error", message: "Something went wrong. Please try again." }, correlationId },
    { status: 500 },
  );
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/**
 * Cookies are SameSite=Lax + httpOnly. For state-changing requests we also
 * reject cross-origin browser requests. Non-browser clients without an Origin
 * header still need a valid session cookie.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin) {
    const allowed = new Set([getEnv().APP_URL]);
    const host = request.headers.get("host");
    if (host) {
      allowed.add(`http://${host}`);
      allowed.add(`https://${host}`);
    }
    if (!allowed.has(origin)) {
      throw new ApiError(403, "Cross-origin request rejected.", "origin_rejected");
    }
    return;
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    throw new ApiError(403, "Cross-origin request rejected.", "origin_rejected");
  }
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.", "invalid_json");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(400, "Please check the submitted values.", "validation_failed", result.error.flatten());
  }
  return result.data;
}
