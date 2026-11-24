import { createHash, randomUUID } from "node:crypto";

const NAME_PATTERN = /^[\p{L}\p{M}\p{N} .'’\-]+$/u;

export type NameValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * Assistant and user display names are untrusted display data. They must never
 * be able to inject markup or instructions into a prompt. We allow human name
 * characters only and store the user's chosen spelling except for trimming and
 * whitespace normalization.
 */
export function validateDisplayName(raw: unknown): NameValidation {
  if (typeof raw !== "string") return { ok: false, error: "Enter a name." };
  const normalized = raw.normalize("NFC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim().replace(/\s+/g, " ");
  if (normalized.length === 0) return { ok: false, error: "Enter a name." };
  if (normalized.length > 40) return { ok: false, error: "Use 40 characters or fewer." };
  if (!NAME_PATTERN.test(normalized)) {
    return {
      ok: false,
      error: "Use letters, numbers, spaces, apostrophes, periods or hyphens only.",
    };
  }
  if (!/\p{L}/u.test(normalized)) {
    return { ok: false, error: "The name needs at least one letter." };
  }
  return { ok: true, value: normalized };
}

export function safeFallbackName(displayName: string | null | undefined): string {
  return displayName?.trim() || "your assistant";
}

export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "workspace";
}

export function newCorrelationId(): string {
  return randomUUID();
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Deterministic JSON for approval hashes: key order must not change the hash. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export function payloadHash(payload: unknown): string {
  return sha256(canonicalJson(payload));
}

const SECRET_PATTERN =
  /(sk-[A-Za-z0-9_-]{16,}|sk_live_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:password|passwd|secret|api[_ -]?key)\s*[:=]\s*\S{6,})/i;

export function looksLikeSecret(content: string): boolean {
  return SECRET_PATTERN.test(content);
}

/** Escape a display name for inline inclusion in a prompt. */
export function quoteAsData(value: string): string {
  return JSON.stringify(value);
}
