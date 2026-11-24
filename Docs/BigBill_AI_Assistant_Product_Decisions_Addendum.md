# BigBill AI Assistant — Product Decisions Addendum
## Executive Assistant, First-Use Naming, Project Folder and Voice in First Working Release

**Status:** User-approved product decisions  
**Applies with:** `BigBill_AI_Assistant_Loop1.md`, `BigBill_AI_Assistant_Technical_Workbook_Loop1.md`, and `BigBill_AI_Assistant_Stack_RAG_Watchers_Voice_ADR.md`.

Where this addendum conflicts with an earlier document on the decisions below, this addendum takes precedence.

---

# 1. Confirmed product decisions

The founder has confirmed:

1. The assistant is a **separate product**, not a feature embedded only in BigBill BOS, Khapy or MotherTracker.
2. The working folder is named exactly **`Ai-assitant`**. Preserve this spelling and use that folder as the project workspace. Do not create a duplicate folder.
3. The founder is the assistant's first user.
4. Her initial role is the founder's **Executive Assistant**.
5. **Voice must be part of the first working release**, not deferred to a later major release.
6. The assistant's displayed name is **not hardcoded**. On first use, the founder will give her a name. The name is saved as configuration, used consistently in chat and voice, and can be changed later.
7. The platform is intended to become a product configurable and sellable to other organizations.

# 2. Project directory instructions

The user's project folder is `Ai-assitant`.

At project start, the coordinator must:
- Confirm the current working directory and inspect the contents of `Ai-assitant`.
- Read all existing project instructions, `AGENTS.md`, README, package manifests and design/architecture files.
- Run `git status` if the folder is a Git repository; do not overwrite existing work.
- Determine whether the folder already contains a repository, code, or user files.
- If empty, propose and initialize the approved project scaffold inside this folder only after documenting the proposed layout.
- Do not silently create a repository elsewhere, clone into a nested duplicate folder, or rename the folder.
- Keep Loop 1 code, docs, tests and configuration in this workspace unless a repository boundary is explicitly approved.
- Never assume the user's local path on the coding machine. OpenCode should inspect its actual workspace.

The name `Ai-assitant` is the working directory name only. It is not automatically the public product brand or the assistant's personal name.

# 3. Product role: founder's Executive Assistant

The first deployment must be useful to the founder in day-to-day business coordination. It is not merely a general-purpose chatbot.

## 3.1 Initial responsibilities

### Executive organization
- Daily briefing and prioritized agenda.
- Tasks, due dates, reminders and follow-ups.
- Meeting preparation and action-item capture.
- Commitments and decisions tracking.
- Project status summaries and overdue-work identification.
- Weekly review and next-week planning.

### Sales and business development
- Prospect research briefs using sourced public information.
- Prospect segmentation and qualification.
- Follow-up recommendations.
- Personalized email and WhatsApp message drafts.
- Meeting and demonstration preparation.
- Quotation/proposal preparation support using approved data.
- Follow-up tasks and pipeline summaries using BOS data where integration is verified.

### Marketing coordination
- Plan campaigns for MotherTracker and Khapy.
- Prepare creative briefs and marketing copy.
- Hand off briefs to Khapy through a verified contract.
- Review campaign status and identify work awaiting approval.
- Prepare social content drafts and schedules.
- Do not duplicate Khapy's content studio, asset library, calendar or distribution workflows.

### Business operations
- Retrieve authorized information from BigBill BOS, MotherTracker and Khapy.
- Summarize incidents, failures and deadlines.
- Surface matters requiring founder attention.
- Keep important actions and decisions traceable.

## 3.2 Founder-first, commercial-ready

The first workspace may be configured for BigBill Systems and the founder's executive-assistant workflow. However:
- No hardcoded founder email, name, organization ID, personal preferences or business records in application logic.
- BigBill is configured as the first tenant through onboarding/seed configuration, not privileged conditional logic.
- A later customer tenant must configure its own assistant profile, name, voice, knowledge, permissions, integrations and workflows.
- Founder-only capabilities must be expressed as role/permission/configuration, not a global special case.

# 4. Assistant naming and first-use onboarding

This is a mandatory product requirement.

## 4.1 First-use experience

On the first authenticated entry into the assistant workspace, before opening the normal chat, present a short welcome/setup step:

> Welcome. Before we begin, what would you like to call me?

Provide a single name input and a clear confirmation action.

After the user supplies the name:
- Validate and normalize input safely without changing the chosen spelling unnecessarily.
- Persist it in the assistant profile for that tenant/workspace.
- Confirm the name to the user.
- Use it in the welcome message, chat UI, voice greeting and notification wording.
- Do not ask again unless the user chooses to rename the assistant or resets the profile.

Example only; do not prefill or hardcode this value:

> Lovely. I'll go by [user-provided name]. I'll help you organize your work, keep track of important matters and coordinate the systems you connect.

## 4.2 Name data model

The name belongs to configuration, not application source code.

Use an existing configuration/profile model if suitable; otherwise introduce a tenant-scoped assistant profile with fields conceptually equivalent to:

```ts
type AssistantProfile = {
  id: string;
  tenantId: string;
  displayName: string | null;
  ownerUserId: string | null;
  personaConfig: {
    tone?: string;
    pronouns?: string;
    greetingStyle?: string;
  };
  voiceConfig: {
    provider?: string;
    voiceId?: string;
    language?: string;
    rate?: number;
  };
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
```

This is illustrative. Follow the actual repository's type, ORM and naming conventions.

Rules:
- `displayName` is null until set by the user.
- No default human name in code, seed data, prompt templates or environment variables.
- Show a neutral fallback such as “your assistant” while onboarding is incomplete.
- `displayName` is tenant/workspace scoped. Another organization can choose a different name.
- The owner or appropriately authorized administrator can rename it.
- The chosen name must survive login, refresh, new conversation, device changes and voice sessions.
- The UI must display the configured name; the backend prompt builder must receive the same value from trusted profile data.
- User-generated name is display data, not a system prompt or instruction. Escape/sanitize it and never allow the name field to inject instructions.
- Validate length and reject control characters/markup. Do not require global uniqueness.
- Record profile changes in an audit trail.
- Do not store the name solely in local storage or browser state.

## 4.3 Multiple organizations

For the commercial product:
- Each tenant has an independently configurable assistant profile.
- An organization's administrator sets or changes the organization's assistant name.
- If user-specific assistants are supported later, use a separate profile scope rather than mixing user and organization names accidentally.
- Never leak one tenant's assistant name, persona, voice or memory into another tenant.

## 4.4 Acceptance tests

- Fresh tenant → onboarding name prompt appears.
- No source-code default name is shown.
- User submits name → saved in DB and audit event recorded.
- Page reload/new session → same name appears.
- Chat greeting uses saved name.
- Voice greeting uses saved name.
- Rename through settings updates chat and voice consistently.
- Tenant B may choose another name; Tenant A's name remains isolated.
- Malicious markup/instructions in the name are rendered safely and do not affect the model system prompt.

# 5. Voice requirement: first working release

Voice is now a **first working release requirement**. Do not mark Loop 1 complete with a text-only chat interface and a voice roadmap.

## 5.1 Required minimum voice experience

The first working release must support:
- User-initiated voice sessions (push-to-talk or explicit start/stop).
- Browser microphone permission request.
- Clear microphone/listening/thinking/speaking/disconnected indicators.
- Real-time audio input and spoken assistant output.
- Visible conversation transcript.
- The same conversation history as text mode.
- Ability to switch between typed and spoken input in the same conversation.
- User interruption/barge-in support, or a clearly documented minimum if provider support is limited.
- Voice greeting uses the user-assigned assistant name.
- Voice response uses the same trusted assistant profile and business context as text.
- Voice tool calls use exactly the same permission engine, tool registry, approval workflow and audit trail.
- Explicit spoken or on-screen confirmation before any consequential action; in Loop 1 consequential external actions remain disabled.
- Session end/stop control.
- Text fallback if microphone, network, voice provider or voice worker fails.
- Recoverable errors; user request/transcript should not be lost silently.
- Voice transcript retention controls and privacy disclosure.

## 5.2 Architecture decision

Preferred baseline:
- LiveKit Agents for Node.js.
- WebRTC for browser-to-agent audio.
- Provider adapters for streaming STT and TTS, with Deepgram and ElevenLabs as initial candidates subject to actual credentials, price, licensing, accent and latency tests.
- Existing provider-neutral assistant model gateway for reasoning; evaluate speech-to-speech provider adapter only if cost and quality tests justify it.
- Conversation ID shared across text and voice.
- Same orchestrator, RAG, policy and tool registry.

Do not deploy a voice server to the production VPS blindly. Validate UDP/TLS/network, CPU, memory, bandwidth and concurrency in staging. Preserve existing deployment patterns. Do not add paid LiveKit Cloud or new paid providers without explicit approval.

## 5.3 Voice is not covert listening

- No always-on microphone by default.
- Microphone active only after explicit user action.
- Show a persistent clear indicator while audio capture is active.
- Let user stop immediately.
- Do not record ambient audio in the background.
- Do not confuse business-system watchers with audio listening.
- Any future wake-word mode needs separate explicit opt-in, clear indication, documented retention and stop controls.

## 5.4 Voice quality test cases

Test:
- Zambian English accents and names.
- Names of local businesses, towns and people.
- Vehicle registrations and numbers.
- Currency amounts and dates.
- Noisy office conditions.
- Weak/unstable connectivity.
- User interruptions while assistant speaks.
- Long pauses and false turn boundaries.
- Microphone denial.
- Browser refresh/disconnect.
- STT/TTS provider outage.
- Session resumption and text fallback.
- Correct assistant display name in spoken greeting.
- Voice actions cannot bypass permission or approval requirements.

Record actual measures:
- connection establishment time;
- time to first transcript;
- time to first audio;
- end-to-end response latency;
- interruption recovery;
- transcription accuracy on a local test set;
- minutes and estimated cost per session.

Do not invent successful quality results; document measured evidence.

# 6. Revised Loop 1 implementation milestones

Loop 1 must deliver a useful founder executive assistant, including basic working voice.

## Phase 0 — Discovery (read-only)
Audit:
- current workspace contents and agent instructions;
- actual language/runtime/package manager;
- auth and tenant model;
- PostgreSQL and pgvector availability;
- Redis/BullMQ compatibility;
- model and embedding adapters;
- Tika/document processing;
- BOS/Khapy/MotherTracker integration contracts;
- LiveKit/network feasibility;
- current deployment and monitoring;
- test baseline.

No code edits until discovery is consolidated.

## Phase 1 — Product shell and assistant identity
- Standalone responsive assistant app.
- First-use name onboarding.
- Tenant-scoped assistant profile.
- Rename/settings.
- Conversation history.
- Same identity in text/voice.
- Founder-first executive-assistant home/overview.

## Phase 2 — Backend contracts, permissions and action framework
- Shared typed/runtime-validated contracts.
- Tenant context.
- Tool registry.
- Permission grant/revoke.
- Action preview/approval lifecycle.
- Audit trail.
- External send/publish/spend/delete disabled.

## Phase 3 — Chat and initial intelligence
- Provider-neutral model adapter.
- Conversation persistence.
- Prompt/context policy.
- Structured output validation.
- Text chat with errors, retries and cancellation.
- Daily briefing and task planning from available/verified sources.

## Phase 4 — First working voice
- LiveKit Node agent or approved existing compatible voice path.
- WebRTC client.
- User-initiated session and visible microphone status.
- STT + LLM + TTS.
- Live transcript and spoken output.
- Shared name/profile/context/history.
- Shared tool permissions and action preview.
- Text fallback.
- Staging deployment and measured voice tests.

## Phase 5 — Memory and RAG
- Tenant-scoped sources.
- Document ingestion.
- pgvector + lexical hybrid retrieval, if supported by existing DB.
- Source citations and freshness.
- ACL enforced before context reaches model.
- Memory inspect/edit/disable/delete controls.
- Retrieval evaluation and cross-tenant leakage tests.

## Phase 6 — Watchers and incident reporting
- Webhook inbox and outbox.
- BullMQ processing.
- Scheduled reconciliation.
- Permissioned source watches.
- Deduplication and retries.
- Priority classification and notification.
- Incident lifecycle and user acknowledgement.

## Phase 7 — Executive workflows and first integrations
Prioritize:
- daily executive briefing;
- task/commitment management;
- meeting preparation;
- sales follow-ups;
- prospect research briefs;
- email drafting;
- WhatsApp drafting;
- MotherTracker marketing planning;
- Khapy creative-brief handoff, only if real API verified;
- BOS/MotherTracker read access through real contracts.

## Phase 8 — Independent QA and release gate
Verify:
- all Loop 1 acceptance criteria;
- voice first-working-release criteria;
- assistant first-use naming;
- tenant separation;
- permission enforcement;
- RAG citations and ACL;
- watcher retries and event idempotency;
- tool/action audit;
- no external send/publish/spend actions;
- staging only.

**Loop 1 cannot be marked COMPLETE if the voice experience is only a mock, the assistant name is hardcoded, the first-use naming flow is missing, or cross-tenant permission boundaries are unverified.**

# 7. Revised Loop 1 agent assignments

| Agent | Additional responsibility |
|---|---|
| Product/UX agent | First-use name onboarding, assistant profile settings and founder executive-assistant home |
| Backend agent | Tenant-scoped assistant profile, display name persistence and rename audit |
| AI orchestration agent | Inject configured assistant name/persona from trusted profile, never hardcode |
| Voice agent | Deliver working voice in first release, shared session/tool/policy path |
| Security agent | Prove voice session identity and permissions match text; name field injection safety |
| DevOps agent | LiveKit staging/network/resource feasibility and deployment instructions |
| QA agent | First-use onboarding, persistence, multi-tenant names and real voice e2e tests |

Voice work must start early enough to prove feasibility. Do not leave all voice integration until the final stage.

# 8. Revised definition of the first working release

The first working release is accepted when the founder can:

1. Open the standalone assistant application.
2. Complete first-use onboarding and give the assistant her name.
3. See that chosen name persist after reload and in new sessions.
4. Start a text conversation.
5. Start a voice conversation through an explicit microphone action.
6. Speak naturally and receive a spoken response.
7. See a transcript and continue that same conversation by typing.
8. Ask for a daily briefing from real, authorized data sources.
9. Ask for tasks, reminders, meeting preparation and follow-up drafts.
10. Request a MotherTracker marketing plan and receive a structured draft/Khapy brief.
11. See when a connector or permission is missing.
12. Receive a useful incident/notification when a background job or integration fails.
13. Inspect and revoke permissions.
14. See an audit trail for permissions and proposed/approved actions.
15. Use the assistant without the system pretending an unconnected integration worked.

The system must also pass cross-tenant tests using at least two organizations. Voice must not grant additional authority. No external emails or WhatsApp messages are sent, no posts published, no money spent, no destructive actions and no production deployment in this loop.

# 9. Updated OpenCode coordinator prompt

```text
The founder has confirmed the following product decisions:

- The separate assistant product will be developed in the existing workspace
  folder named exactly `Ai-assitant`. Inspect this folder; do not create a
  duplicate folder or assume it is empty.
- The founder is the first user.
- The first role is Executive Assistant.
- VOICE IS REQUIRED IN THE FIRST WORKING RELEASE. It cannot be deferred
  to a later major release or represented by a mock.
- On first use, ask the founder what to call the assistant. The assistant's
  display name is user-assigned, persisted in tenant/workspace configuration,
  changeable later, and never hardcoded in source or prompts.
- The commercial platform must allow each tenant to configure its own
  assistant name/profile/voice.

Read all three original Loop 1 documents and this addendum.

Start with read-only discovery. Consolidate actual repository and
infrastructure findings before coding.

Implement the name onboarding and profile persistence as a real feature.
Use the same configured name in UI, assistant context and spoken greeting.

Deliver real browser voice in the first working release:
user-initiated microphone session, WebRTC, streaming STT/LLM/TTS,
transcript, spoken response, stop control, visible mic status, text/voice
continuity, and the shared permissions/tool engine. Use LiveKit Agents
for Node.js or an evidence-backed compatible existing voice stack.
Prove it in staging, not only with mocked tests.

The assistant's initial workflows must serve as the founder's executive
assistant: daily briefing, task/reminder management, meeting preparation,
sales follow-ups, email/WhatsApp drafting and marketing coordination.

Keep external sends/publishing/spend/destructive actions disabled for
Loop 1. No secret exposure, no covert microphone listening, no production
deployment, no new paid service without explicit approval.

Preserve the existing stack and infrastructure where they satisfy the
architecture. Use evidence-backed ADRs for any deviation.

Use parallel specialist agents with non-overlapping ownership and
independent QA. Do not mark Loop 1 complete without a real voice
demonstration, persisted first-use name, tenant isolation and full
acceptance evidence. Do not start Loop 2.
```

# 10. Final build principle

The assistant should feel like one consistent person across the product:

- She has a name chosen by her user.
- She has a configured voice and communication style.
- She understands the user's organization through authorized context.
- She can talk and listen during an explicitly started voice session.
- She knows what systems she can and cannot access.
- She watches connected business events within granted scopes.
- She prepares and coordinates work.
- She asks before consequential actions.
- She reports accurately when things fail.

**The assistant's identity is configurable. Her capabilities are modular. Her permissions are explicit. Her actions are auditable. Her voice is part of the first working product.**
