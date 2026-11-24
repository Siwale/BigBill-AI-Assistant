/**
 * Minimal structured logger. Never pass message bodies, credentials, tokens
 * or personal content. Metadata should be identifiers and outcomes only.
 */
type Level = "info" | "warn" | "error";

export function log(level: Level, event: string, meta: Record<string, unknown> = {}): void {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (/token|secret|password|authorization|cookie|content|body/i.test(key)) continue;
    if (typeof value === "string" && value.length > 200) {
      safe[key] = `${value.slice(0, 200)}…`;
    } else {
      safe[key] = value;
    }
  }
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...safe });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
