export type RiskLevel = "R0" | "R1" | "R2" | "R3" | "R4";

export type ScopeDefinition = {
  id: string;
  label: string;
  description: string;
  risk: RiskLevel;
  enabled: boolean;
};

export type ConnectorDefinition = {
  id: string;
  name: string;
  description: string;
  state: "available" | "draft_only" | "needs_credentials" | "unavailable";
  stateNote: string;
  scopes: ScopeDefinition[];
};

/**
 * Capability catalogue. R3/R4 scopes are visible so the user can see what the
 * product cannot do yet; they are never grantable in Loop 1.
 */
export const CONNECTORS: ConnectorDefinition[] = [
  {
    id: "workspace",
    name: "Assistant workspace",
    description: "Tasks, drafts, notes, knowledge and memory owned by this assistant.",
    state: "available",
    stateNote: "Built in. Data stays in this workspace.",
    scopes: [
      { id: "tasks.read", label: "Read tasks", description: "See tasks and reminders in this workspace.", risk: "R1", enabled: true },
      { id: "tasks.write", label: "Create and update tasks", description: "Add tasks, change status and due dates.", risk: "R2", enabled: true },
      { id: "drafts.create", label: "Create drafts", description: "Save email, WhatsApp and marketing drafts locally.", risk: "R2", enabled: true },
      { id: "knowledge.read", label: "Read knowledge", description: "Use approved workspace documents in answers.", risk: "R1", enabled: true },
      { id: "knowledge.write", label: "Add knowledge", description: "Ingest documents you upload into the workspace index.", risk: "R2", enabled: true },
      { id: "memory.read", label: "Use memory", description: "Recall enabled preferences and context you approved.", risk: "R1", enabled: true },
      { id: "memory.write", label: "Save memory", description: "Remember facts you explicitly ask it to keep.", risk: "R2", enabled: true },
      { id: "briefing.read", label: "Prepare briefings", description: "Summarise authorised workspace work.", risk: "R1", enabled: true },
      { id: "incidents.write", label: "Report incidents", description: "Record problems and blocked work for your attention.", risk: "R2", enabled: true },
    ],
  },
  {
    id: "email",
    name: "Email",
    description: "Prepare email drafts. Sending is not enabled in Loop 1.",
    state: "draft_only",
    stateNote: "Drafts only. No mailbox is connected.",
    scopes: [
      { id: "email.draft", label: "Draft email", description: "Create a local email draft for review.", risk: "R2", enabled: true },
      { id: "email.send", label: "Send email", description: "Would send through a connected mailbox.", risk: "R3", enabled: false },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Prepare WhatsApp message drafts. Sending is not enabled in Loop 1.",
    state: "draft_only",
    stateNote: "Drafts only. No WhatsApp account is connected.",
    scopes: [
      { id: "whatsapp.draft", label: "Draft WhatsApp message", description: "Create a local message draft for review.", risk: "R2", enabled: true },
      { id: "whatsapp.send", label: "Send WhatsApp", description: "Would send through a connected WhatsApp number.", risk: "R3", enabled: false },
    ],
  },
  {
    id: "marketing",
    name: "Marketing workspace",
    description: "Plan campaigns, prepare copy and produce a Khapy-ready creative brief draft.",
    state: "available",
    stateNote: "Local drafts only. Nothing is delivered to Khapy automatically.",
    scopes: [
      { id: "marketing.draft", label: "Draft marketing content", description: "Create campaign plans, copy and social drafts.", risk: "R2", enabled: true },
      { id: "khapy.brief.create", label: "Create Khapy brief draft", description: "Produce a structured creative brief for human handoff.", risk: "R2", enabled: true },
      { id: "social.publish", label: "Publish social content", description: "Would publish through a connected channel.", risk: "R3", enabled: false },
    ],
  },
  {
    id: "khapy",
    name: "Khapy",
    description: "Marketing execution platform. A real creative-brief API exists but needs credentials and organisation membership.",
    state: "needs_credentials",
    stateNote: "Not connected. No Khapy user token or organisation membership is configured.",
    scopes: [
      { id: "khapy.transfer", label: "Transfer brief to Khapy", description: "Would create a brief in Khapy's pipeline.", risk: "R3", enabled: false },
    ],
  },
  {
    id: "bos",
    name: "BigBill BOS",
    description: "Company records, leads and tasks live in BigBill BOS. Its admin API additionally requires an MFA session.",
    state: "needs_credentials",
    stateNote: "Not connected. Requires an approved service-auth path or MFA-bound session.",
    scopes: [
      { id: "bos.read", label: "Read BOS records", description: "Would read authorised leads, tasks and company data.", risk: "R1", enabled: false },
    ],
  },
  {
    id: "mothertracker",
    name: "MotherTracker",
    description: "Fleet operations remain authoritative in MotherTracker.",
    state: "needs_credentials",
    stateNote: "Not connected. Requires a dedicated tenant-scoped user token.",
    scopes: [
      { id: "mothertracker.read", label: "Read fleet data", description: "Would read authorised fleet summaries.", risk: "R1", enabled: false },
    ],
  },
  {
    id: "vision",
    name: "Vision",
    description: "Camera, screen share and document observation — user-initiated only, transient by default.",
    state: "available",
    stateNote: "Available. Requires explicit camera/screen permission per request.",
    scopes: [
      { id: "vision.capture", label: "Capture observation", description: "Create a camera/screen/upload observation and analyze it.", risk: "R2", enabled: true },
      { id: "vision.session", label: "Bounded visual session", description: "Start a time-limited visual sampling session.", risk: "R2", enabled: true },
    ],
  },
  {
    id: "devices",
    name: "Personal Devices",
    description: "Local device discovery, pairing and audio routing via browser and optional companion.",
    state: "available",
    stateNote: "Browser capabilities + optional Linux companion (BlueZ/PipeWire).",
    scopes: [
      { id: "devices.read", label: "Read devices", description: "List discovered devices and capabilities.", risk: "R1", enabled: true },
      { id: "devices.connect", label: "Connect device", description: "Pair/connect/select an audio output or device.", risk: "R2", enabled: true },
    ],
  },
  {
    id: "music",
    name: "Music",
    description: "Local library and Home Assistant media — Spotify voice blocked, Apple Music gated.",
    state: "available",
    stateNote: "Local + Home Assistant first. Spotify/Apple require approval.",
    scopes: [
      { id: "music.read", label: "Read music", description: "Search catalog and list favorites.", risk: "R1", enabled: true },
      { id: "music.play", label: "Control playback", description: "Play/pause/volume on permitted targets.", risk: "R2", enabled: true },
    ],
  },
  {
    id: "movies",
    name: "Movies",
    description: "Discovery, taste preferences and watchlist — legal availability only when licensed.",
    state: "available",
    stateNote: "Manual watchlist + handoff until TMDB/JustWatch licensed for ZM.",
    scopes: [
      { id: "movies.read", label: "Read movies", description: "Search and recommend titles.", risk: "R1", enabled: true },
      { id: "movies.write", label: "Manage watchlist", description: "Add/remove titles and set preferences.", risk: "R2", enabled: true },
    ],
  },
  {
    id: "home_assistant",
    name: "Home Assistant",
    description: "Optional local hub for media_player, camera and sensor state.",
    state: "needs_credentials",
    stateNote: "Not connected. Requires OAuth to user instance.",
    scopes: [{ id: "home_assistant.read", label: "Read HA entities", description: "Read entity state.", risk: "R1", enabled: false }],
  },
  {
    id: "engineering",
    name: "Engineering Intelligence",
    description: "Local repository review via Forge — read-only, evidence-driven, companion-mediated.",
    state: "available",
    stateNote: "Requires companion + Forge checkout. No shell, no source mutation.",
    scopes: [
      { id: "engineering.repositories.read", label: "Read repositories", description: "List and inspect registered local repositories.", risk: "R1", enabled: true },
      { id: "engineering.audit.read", label: "Read audits", description: "View audit status, events and findings.", risk: "R1", enabled: true },
      { id: "engineering.audit.run", label: "Run repository audit", description: "Start a read-only Forge audit (bounded, secret-redacted).", risk: "R2", enabled: true },
    ],
  },
];

export const DEFAULT_ONBOARDING_SCOPES = [
  "tasks.read",
  "tasks.write",
  "drafts.create",
  "knowledge.read",
  "knowledge.write",
  "memory.read",
  "memory.write",
  "briefing.read",
  "incidents.write",
  "email.draft",
  "whatsapp.draft",
  "marketing.draft",
  "khapy.brief.create",
];

export function allScopes(): ScopeDefinition[] {
  return CONNECTORS.flatMap((c) => c.scopes);
}

export function findConnector(connectorId: string): ConnectorDefinition | undefined {
  return CONNECTORS.find((c) => c.id === connectorId);
}

export function findScope(scopeId: string): { connector: ConnectorDefinition; scope: ScopeDefinition } | undefined {
  for (const connector of CONNECTORS) {
    const scope = connector.scopes.find((s) => s.id === scopeId);
    if (scope) return { connector, scope };
  }
  return undefined;
}
