import { z } from "zod";

export const deviceStatusSchema = z.enum([
  "unsupported",
  "available",
  "permission_required",
  "pairing",
  "paired",
  "connecting",
  "connected",
  "selected",
  "active",
  "disconnected",
  "error",
]);
export type DeviceStatus = z.infer<typeof deviceStatusSchema>;

export const deviceCapabilitySchema = z.enum([
  "discover",
  "pair",
  "connect",
  "disconnect",
  "read_state",
  "set_volume",
  "play",
  "pause",
  "seek",
  "select_source",
  "capture",
  "control",
]);
export type DeviceCapability = z.infer<typeof deviceCapabilitySchema>;

export const visualSessionSchema = z.object({
  source: z.enum(["camera", "screen", "upload"]),
  status: z.enum(["active", "paused", "stopped", "expired"]),
  sampleIntervalMs: z.number().int().min(500).max(10000).default(2000),
  maxDurationMs: z.number().int().min(30000).max(600000).default(120000),
});
export type VisualSessionInput = z.infer<typeof visualSessionSchema>;

export const musicProviderSchema = z.enum(["local", "home_assistant", "spotify", "apple_music"]);
export type MusicProvider = z.infer<typeof musicProviderSchema>;

export const movieRegionSchema = z.string().length(2).default("ZM");
export const watchStatusSchema = z.enum(["want_to_watch", "watched", "dropped"]);
