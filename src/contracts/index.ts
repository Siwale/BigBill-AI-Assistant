import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);

export const signupSchema = z.object({
  workspaceName: z.string().trim().min(2, "Workspace name is too short.").max(80),
  fullName: z.string().trim().min(1, "Enter your name.").max(80),
  email: emailSchema,
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(200)
    .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), "Include at least one letter and one number."),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  workspaceSlug: z.string().trim().max(60).optional(),
});

export const assistantNameSchema = z.object({ name: z.unknown() });

export const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1, "Write a message.").max(8000),
  channel: z.enum(["text", "voice"]).default("text"),
});

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

export const taskUpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
});

export const memoryCreateSchema = z.object({
  category: z
    .enum(["user_preference", "organization_context", "project_context", "commitment", "decision", "short_lived"])
    .default("user_preference"),
  content: z.string().trim().min(1).max(1000),
});

export const memoryUpdateSchema = z.object({
  id: z.string().uuid(),
  content: z.string().trim().min(1).max(1000).optional(),
  enabled: z.boolean().optional(),
});

export const permissionGrantSchema = z.object({
  connectorId: z.string().min(1).max(60),
  scopes: z.array(z.string().min(1).max(80)).min(1).max(30),
});

export const permissionRevokeSchema = z.object({
  connectorId: z.string().min(1).max(60),
});

export const incidentActionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["acknowledge", "investigate", "resolve"]),
});

export const voiceConfigSchema = z.object({
  voiceId: z.string().max(200).optional(),
  language: z.string().max(12).optional(),
  rate: z.number().min(0.5).max(2).optional(),
  provider: z.enum(["browser", "openai"]).optional(),
});

export const voiceSessionSchema = z.object({
  conversationId: z.string().uuid(),
  mode: z.enum(["browser", "server"]).default("browser"),
});

export const voiceTranscribeSchema = z.object({
  language: z.string().max(12).optional(),
});

export const webhookSchema = z.object({
  tenantId: z.string().uuid(),
  source: z.string().min(1).max(60),
  eventType: z.string().min(1).max(100),
  externalEventId: z.string().min(1).max(200),
  payload: z.record(z.unknown()).default({}),
});

export type ChatInput = z.infer<typeof chatSchema>;
