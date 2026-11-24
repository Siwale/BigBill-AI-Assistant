import type { z } from "zod";
import type { CitationView } from "@/modules/knowledge/service";

export type ToolRisk = "R0" | "R1" | "R2" | "R3" | "R4";

export type ToolContext = {
  tenantId: string;
  userId: string;
  userDisplayName: string;
  tenantName: string;
  profileName: string;
  conversationId: string;
  correlationId: string;
};

export type PermissionRequest = {
  connectorId: string;
  connectorName: string;
  scopes: string[];
};

export type ToolSuccess = {
  ok: true;
  summary: string;
  data?: Record<string, unknown>;
  citations?: CitationView[];
};

export type ToolFailure = {
  ok: false;
  code: string;
  message: string;
  permissionRequired?: PermissionRequest;
};

export type ToolResult = ToolSuccess | ToolFailure;

export type ToolDefinition = {
  id: string;
  name: string;
  description: string;
  connectorId: string;
  risk: ToolRisk;
  requiredScopes: string[];
  enabled: boolean;
  disabledReason?: string;
  idempotency: "naturally_idempotent" | "not_idempotent" | "required";
  timeoutMs: number;
  inputSchema: z.ZodTypeAny;
  parameters: Record<string, unknown>;
  summarize: (input: unknown) => string;
  execute: (input: unknown, context: ToolContext) => Promise<ToolSuccess>;
};
