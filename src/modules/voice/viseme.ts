/**
 * Viseme mapping for lip-sync — standard groups, provider-agnostic.
 * If provider returns timed phonemes, map to visemes; otherwise approximate from audio level.
 */
export type Viseme = "rest" | "bilabial" | "labiodental" | "dental" | "alveolar" | "rounded" | "open" | "wide" | "neutral";

const PHONEME_TO_VISEME: Record<string, Viseme> = {
  p: "bilabial", b: "bilabial", m: "bilabial",
  f: "labiodental", v: "labiodental",
  th: "dental", dh: "dental",
  t: "alveolar", d: "alveolar", s: "alveolar", z: "alveolar", n: "alveolar", l: "alveolar",
  r: "alveolar",
  w: "rounded", uw: "rounded", ow: "rounded",
  aa: "open", ae: "open", ah: "open",
  ao: "wide", aw: "wide", ay: "wide",
  ih: "neutral", eh: "neutral", iy: "neutral",
};

export function phonemeToViseme(phoneme: string): Viseme {
  const key = phoneme.toLowerCase().trim();
  return PHONEME_TO_VISEME[key] ?? "neutral";
}

export type TimedViseme = { viseme: Viseme; startMs: number; endMs: number };

/**
 * Approximate visemes from text when provider alignment not available.
 * Simple: split text into words, assign viseme per word based on dominant phoneme, duration proportional to length.
 * Labeled as approximate — never claim phoneme-accurate.
 */
export function approximateVisemesFromText(text: string, totalDurationMs: number): TimedViseme[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [{ viseme: "rest", startMs: 0, endMs: totalDurationMs }];
  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  let cursor = 0;
  const out: TimedViseme[] = [];
  for (const word of words) {
    const dur = Math.max(80, (word.length / totalChars) * totalDurationMs);
    const viseme = phonemeToViseme(word.slice(0, 2).toLowerCase());
    out.push({ viseme, startMs: cursor, endMs: cursor + dur });
    cursor += dur;
  }
  // Ensure end aligns
  if (out.length) out[out.length - 1]!.endMs = totalDurationMs;
  return out;
}

/**
 * Map viseme to morph target weights for the rig.
 * Our placeholder head has no blendshapes, so we map to jaw scale and mouth openness.
 * Real model would have morph targets: jawOpen, mouthClose, mouthFunnel, etc.
 */
export function visemeToMouthState(viseme: Viseme): { jawOpen: number; mouthWidth: number } {
  switch (viseme) {
    case "bilabial": return { jawOpen: 0.1, mouthWidth: 0.9 };
    case "labiodental": return { jawOpen: 0.3, mouthWidth: 1.0 };
    case "dental": return { jawOpen: 0.4, mouthWidth: 1.0 };
    case "alveolar": return { jawOpen: 0.5, mouthWidth: 1.0 };
    case "rounded": return { jawOpen: 0.4, mouthWidth: 0.7 };
    case "open": return { jawOpen: 0.9, mouthWidth: 1.1 };
    case "wide": return { jawOpen: 0.7, mouthWidth: 1.3 };
    case "neutral": return { jawOpen: 0.5, mouthWidth: 1.0 };
    case "rest":
    default: return { jawOpen: 0.0, mouthWidth: 1.0 };
  }
}
