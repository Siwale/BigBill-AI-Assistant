# BigBill Systems — AI Personal Assistant (Loop 1)
## Product foundation, architecture, permissions, and first operational vertical

**Loop:** 01 — Foundation & Safe Personal Assistant Core  
**Product codename:** BigBill Assistant (working name; naming/branding decision deferred)  
**Execution style:** Multi-agent, incremental, evidence-driven  
**Primary objective:** Build a reusable, separately deployable AI assistant service with its own chat interface, permission system, action framework, audit trail, and incident communication—then integrate it into BigBill Systems first.

---

## 0. Mission

Build a separate assistant entity that can be embedded or connected to business systems without being tightly coupled to any one product.

It should be capable of:
- Conversationally understanding requests and asking clarifying questions.
- Drafting email, WhatsApp, social posts, documents, plans, reports, and task lists.
- Preparing actions for approval before execution.
- Using connected tools only within granted permissions.
- Remembering relevant business/user context according to explicit memory controls.
- Notifying the user about important incidents, failures, approvals, blockers, and outcomes.
- Working with Khapy to create marketing material and campaign assets.
- Eventually being packaged and sold to other organizations as a configurable assistant product.

**Loop 1 does not build every assistant capability.** It establishes a secure, testable product foundation and proves a bounded workflow end-to-end.

## 1. Product principles (non-negotiable)

1. **Separate product, not a feature welded into one app.** Assistant service, API, data model, permission engine, tool registry, conversation interface, and action lifecycle must have clean boundaries.
2. **Integrate through explicit contracts.** Existing BigBill systems remain authoritative for their own data. The assistant must not duplicate business records as its own shadow CRM, finance, marketing calendar, or fleet database.
3. **Least privilege.** No access is granted by default. Every connector/tool has a clear permission scope, purpose, and owner.
4. **Approval before consequential action.** Drafting is safe by default; sending messages, spending money, publishing, deleting, changing access, or making irreversible changes requires explicit approval unless a future narrowly scoped policy allows it.
5. **Transparent action.** The assistant must show what it plans to do, what it used, what it changed, and the result.
6. **No fabricated completion.** If an action failed, was not available, or was not verified, say so.
7. **Human escalation for incidents.** The assistant surfaces security, integration, data, operational, and workflow incidents with severity, impact, evidence, suggested next step, and status.
8. **Tenant isolation from day one.** No cross-organization context, files, memories, connector tokens, tool calls, or audit data.
9. **Portable and sellable.** BigBill is the first tenant/customer, not a privileged hardcoded special case. Organization-level configuration must be separate from core code.
10. **Reuse existing systems.** Before building a capability, inspect existing BigBill, Khapy, and other systems for reusable APIs/workflows. Do not duplicate them.

## 2. Proposed architecture boundary

Create a separately deployable assistant service (use repository/monorepo conventions discovered during audit; do not prematurely impose a new stack).

### Core components

- **Assistant Core/API:** conversation orchestration, intent classification, planning, response generation, action lifecycle.
- **Chat Interface:** standalone assistant surface first; responsive web UI, accessible, can later embed into BigBill products through a documented integration contract.
- **Organization & Workspace Context:** organizations, workspaces, users, membership, roles, policies, preferences.
- **Permission & Consent Center:** connector/tool permissions with scopes, grant/revoke, expiration, and visibility.
- **Tool/Connector Registry:** metadata, schema, required permissions, risk classification, idempotency behavior, and execution contract.
- **Action Queue:** proposed → awaiting approval → approved → executing → completed/failed/cancelled; persist action state.
- **Audit Trail:** conversation/action linkage, actor, permission decision, tool, scope, approval, timestamps, outcome. Redact secrets and sensitive payloads.
- **Incident/Notification Center:** assistant informs user when blocked, failed, unusual, or consequential; incident states and acknowledgements.
- **Memory/Context Store:** tenant-separated, explicit categories, user/org context; user can inspect, edit, disable, and delete according to policy. No secrets stored in memory.
- **Integration Gateway:** connector credentials and provider calls isolated server-side; credential encryption at rest; never return secrets to UI or logs.
- **Observability:** correlation IDs, structured logs, action metrics, health checks, failure alerts.

Do not create every component as a microservice automatically. The first implementation may be a modular service/package with clean internal boundaries and a deployable unit. Choose the smallest architecture consistent with the existing repo and operational reality.

## 3. Permission model

### Permission flow
1. Assistant determines a task may need a tool/connector.
2. It explains **what access is needed, why, which data/actions it enables, and whether it is read-only or write-capable**.
3. User sees permission request with scopes and duration options.
4. User grants or denies.
5. Grant is stored with tenant/user, connector, scopes, grant date, optional expiry, and revocation state.
6. Assistant checks the permission on every execution—not just when connector is first connected.
7. Revocation takes effect promptly and prevents future tool use.
8. Permission changes and action outcomes are audit logged.

### Permission levels
- **L0 — No connection:** no data access.
- **L1 — Read:** retrieve/inspect scoped information.
- **L2 — Draft:** create drafts or proposed records without external publication.
- **L3 — Execute with approval:** perform an action only after user approves the specific preview.
- **L4 — Bounded automation (future, not Loop 1):** only defined tasks, scopes, limits, and policy; never a blanket grant.

### Risk classes
- **R0:** answer using current conversation / approved context.
- **R1:** read scoped data.
- **R2:** create internal draft/task.
- **R3:** send/publish/modify external or business data—approval required.
- **R4:** money movement, destructive operations, security/access changes—strong confirmation and potentially disallowed in assistant.

The UI must clearly distinguish **connected**, **permission granted**, **action approved**, and **action completed**.

## 4. First vertical slice: BigBill founder assistant

Build the first useful workflow for BigBill without pretending every integration exists.

### Loop 1 must demonstrate
1. User opens standalone assistant chat.
2. Assistant can create and manage a simple task/reminder using the assistant's own task store (only if a task subsystem exists; otherwise implement the minimal audited task capability).
3. User asks: “Prepare an outreach campaign for MotherTracker.”
4. Assistant uses available BigBill/MotherTracker approved context, asks only for missing material inputs, and generates:
   - campaign plan,
   - segmented target audience,
   - personalized email draft,
   - WhatsApp draft,
   - social post draft,
   - follow-up schedule,
   - draft asset brief for Khapy.
5. Assistant presents the outputs and action previews; nothing is sent or published.
6. It can create a task for review/approval, and show its status.
7. A connector/tool is unavailable or permission denied; assistant explains the blocker and offers the next safe step.
8. An integration/action failure creates a visible incident and informs the user through the in-app notification/chat—not silently.
9. User can inspect/revoke the granted permissions.
10. A second organization test tenant demonstrates isolation.

**Do not claim Khapy integration in Loop 1 unless a real API/connector exists and has been audited.** If unavailable, produce a ready-to-use creative brief and a clear integration gap.

## 5. Initial tool registry (stub-safe)

Loop 1 should define the contract and implement only the tools actually supported after repo audit.

| Tool | Risk | Required permission | Loop 1 |
|---|---:|---|---|
| Read approved assistant context | R0/R1 | context scope | Implement |
| Create assistant task | R2 | task.create | Implement if compatible with repo |
| Read task list/status | R1 | task.read | Implement |
| Draft email | R2 | email.draft | Local draft output; connector optional |
| Draft WhatsApp message | R2 | whatsapp.draft | Local draft output |
| Draft marketing content | R2 | marketing.draft | Implement in assistant |
| Create Khapy creative brief | R2 | khapy.brief.create | Contract/stub until verified integration |
| Send email | R3 | email.send + specific approval | Not implemented/disabled |
| Send WhatsApp | R3 | whatsapp.send + specific approval | Not implemented/disabled |
| Publish social content | R3 | social.publish + specific approval | Not implemented/disabled |
| Paid advertising / spend | R4 | ads.manage + spend limit + approval | Not implemented |
| Delete data/change access | R4 | admin scope + step-up confirmation | Not implemented |

## 6. Khapy integration

Khapy should be treated as a connected marketing execution platform, not replaced by assistant-generated duplicate features.

Future integration contract should enable:
- Generate creative briefs from campaign context.
- Pass campaign objective, audience, brand voice, product, offer, platform, format, and constraints.
- Request Khapy to create content/assets using its own capability pipeline.
- Return asset/content IDs, preview, status, and link to the source object.
- Schedule or publish only after explicit approval and existing Khapy workflow checks.

For Loop 1:
- Audit Khapy repo access, existing APIs, auth, campaign/content/asset data model, and current creation pipeline.
- Produce an integration proposal and gap list.
- Do not implement duplicate content studio, calendar, media library, or distribution functionality.

## 7. Incident communication

Assistant must report incidents using a consistent format:

- **Title**
- **Severity:** info / warning / critical
- **What happened**
- **What is affected**
- **Evidence / correlation ID**
- **What I tried**
- **Recommended next step**
- **Needs your decision?**
- **Status:** open / acknowledged / resolved

Examples:
- Connector authorization expired → warning; action blocked; reauthorize link.
- Email draft could not be saved → warning; preserve draft text locally and offer retry.
- Permission denied → informational/warning; never attempt bypass.
- Unexpected tenant/context mismatch → critical; stop action, block tool execution, alert.
- Tool execution timed out → warning; check idempotency before retry.

No assistant should use an incident message to pressure user into approving access. Give clear choices: approve, deny, retry, or handle manually.

## 8. Security and privacy requirements

- Tenant/organization ID required on all persisted assistant records and connector grants.
- Enforce tenant isolation at service and storage query boundaries; test cross-tenant denial.
- Role-based permissions with clear default-deny policy.
- Connector OAuth/token storage encrypted at rest and access restricted to backend.
- No tokens, passwords, secrets, private keys, or raw authentication payloads in logs, prompt history, model context, or frontend.
- Sanitize and minimize tool-returned data before sending to models.
- Treat retrieved web/email/document content as untrusted; protect against prompt injection.
- External tool calls require server-side permission check and policy check.
- Action previews show target, content/data changes, scope, and consequences.
- Audit all grants/revokes, approvals, action execution, failures, and retries.
- Rate-limit and budget-limit model/tool calls.
- Explicit user controls for memory/context retention.
- Deletion/export behavior must be documented and tenant-safe.
- Provide a security threat model for tool injection, unauthorized action, cross-tenant leakage, connector compromise, model/provider failure, and misuse.

## 9. Multi-agent execution plan

Use agents for independent discovery and verification, not to edit the same files concurrently.

### Agent A — Repository and architecture reconnaissance
- Identify repo(s), stack, conventions, auth, deployment, tests, DB, UI patterns.
- Identify existing assistant/agent/chat code and reusable components.
- Produce evidence-backed architecture recommendation.
- No edits initially.

### Agent B — Product and UX definition
- Define chat shell, conversation list, assistant status, tool/action preview, permission center, incident card, task panel.
- Use current design system.
- Avoid decorative AI gradients, oversized cards, and redundant navigation.
- Deliver a concise interaction spec and implement only after architecture is agreed.

### Agent C — Permission/security architecture
- Define organization/user/role permission model, grant lifecycle, tool-risk taxonomy, approvals, revocation, audit.
- Threat-model prompt injection, tool abuse, secrets, tenant isolation.
- Implement security-critical primitives with tests after scope approval.

### Agent D — Integration audit
- Audit BigBill BOS, Khapy, MotherTracker and existing messaging/email systems for API contracts and reusable workflows.
- No duplicate features.
- Return a connector matrix: available, usable, missing, needs credentials, unsafe, or blocked.

### Agent E — QA/verification
- Create independent test plan and acceptance matrix.
- Verify every permission denial, tenant isolation, tool failure, action approval state, incident lifecycle, UI behavior, and build/test health.
- Review final changes independently; do not rely on implementation agent's self-report.

Coordinator must consolidate findings before parallel implementation. After scope and design are agreed, assign bounded implementation tasks with non-overlapping files/modules. QA must run independently.

## 10. Loop 1 phases

### Phase 0 — Baseline and discovery (no implementation)
- Read repository agent instructions and conventions.
- Identify canonical repo and branches. Never assume.
- Inventory current assistant-related code, auth, UI, DB, deployment and test commands.
- Audit BigBill, Khapy and MotherTracker integrations.
- Record current branch, clean/dirty state, tests/build/typecheck status.
- Identify existing email/WhatsApp draft flows and permission model.
- Identify usable task/reminder/notification systems.
- Report gaps, risks, and a proposed file/module plan.
- Stop and ask only if a critical architectural choice cannot be inferred safely.

**Phase 0 deliverable:** evidence-based discovery report, architecture proposal, bounded implementation plan, and list of approvals/unknowns. Do not modify files.

### Phase 1 — Assistant product skeleton
After Phase 0 review:
- Create assistant module/service boundary with typed contracts.
- Create tenant/workspace/user/membership schema or reuse existing identity/tenant primitives.
- Create conversation/message persistence with tenant-safe access.
- Create standalone responsive chat UI using existing design system.
- Include empty state, conversation history, loading/streaming state if supported, retry, error state.
- Add assistant profile/configuration per organization, but avoid complex agent marketplace or builder.
- Add API contracts and tests.

### Phase 2 — Permission and tool/action framework
- Implement permission scopes and grant/revoke.
- Implement tool registry metadata (name, description, input schema, risk, permission scopes, idempotency).
- Enforce permission checks server-side before execution.
- Implement action preview and approval state.
- Implement audit events.
- Loop 1 external send/publish actions remain disabled.

### Phase 3 — Tasks and incidents
- Implement minimal task/reminder capability or reuse existing.
- Tasks have title, description, owner, due date, priority, status, source conversation, tenant.
- Implement incident records and in-chat/in-app notifications for blocked/failing integrations.
- Acknowledge/resolve workflow.
- Ensure assistant cannot silently dismiss critical incidents.

### Phase 4 — BigBill founder assistant workflows
- Add safe workflows for:
  - task planning and task creation,
  - meeting agenda/prep,
  - follow-up reminders,
  - prospect research brief,
  - MotherTracker/Khapy campaign planning,
  - email/WhatsApp/social draft generation.
- Use approved context sources only.
- Provide an action plan and approval boundary for each workflow.
- No sending or publishing.

### Phase 5 — Khapy integration discovery/prototype
- Confirm API and existing campaign/content creation pipeline.
- If accessible and stable, implement a permissioned “create creative brief” integration first.
- Avoid duplicate content studio, calendar, distribution, scheduling, or asset library.
- If API not available, document integration contract and leave feature visibly unavailable (no fake success).

### Phase 6 — QA, security review, staging
- Independent agent reviews architecture and implementation.
- Cross-tenant tests for conversations, memories, tasks, connectors, and incidents.
- Permission denied tests, revoked grant tests, expired grant tests.
- Action-preview/approval tests.
- Prompt-injection tests using malicious content from retrieved documents/webpages.
- Secret redaction tests.
- Tool timeout/retry and idempotency tests.
- Test staging with two organizations and at least two roles each.
- Confirm no external messages or social posts sent.
- Report production readiness as blocked/ready with evidence.

## 11. Loop 1 acceptance criteria

Loop 1 is complete only when:

- [ ] Assistant is a separate, clearly bounded product/module/service.
- [ ] A standalone chat interface works and is responsive.
- [ ] Conversation persistence is tenant-safe.
- [ ] Organization/workspace context is isolated.
- [ ] Permission request/grant/deny/revoke UI works.
- [ ] Server enforces permissions on every tool execution.
- [ ] Tool registry includes risk, scope, schema, idempotency and status.
- [ ] Action lifecycle includes preview, approval, execution state; external send/publish is disabled.
- [ ] Tasks can be created/listed/updated, or an existing task system is reused with verified evidence.
- [ ] Incidents surface to the user with severity, evidence, next steps, and acknowledgement.
- [ ] Draft email, WhatsApp and marketing content can be produced without external execution.
- [ ] Khapy integration is audited and not falsely claimed; creative brief integration is implemented only if a real API is verified.
- [ ] Two test organizations prove cross-tenant isolation.
- [ ] Audit events exist for permissions, approvals, actions, and incidents.
- [ ] Tests, typecheck, lint, and build pass for touched scopes.
- [ ] QA report and remaining gaps are documented.
- [ ] No messages sent, posts published, ads created, money spent, destructive operations executed, or production deployment performed.

## 12. Operational and deployment constraints

- Preserve existing working CI/deployment workflows.
- No paid CI, new paid infrastructure, or external service added without explicit approval.
- Prefer existing hosting, DB, auth, and observability systems after discovery.
- Avoid experimental architecture changes.
- Keep production deployment out of this loop.
- Use feature flags for incomplete integration capability.
- Maintain migrations and rollback notes.
- If the repository baseline is broken, report and isolate; do not broaden the scope into unrelated repairs.

## 13. Required final report

Coordinator must deliver:

1. Discovery and baseline summary.
2. Architecture diagram or Mermaid flow.
3. Modules/packages/files created or modified.
4. Permission scopes and risk classifications implemented.
5. Existing integrations reused.
6. Khapy integration status and exact gaps.
7. Task/incident capability status.
8. Test evidence: commands and outcomes.
9. Security review and tenant-isolation evidence.
10. Screenshots or visual QA evidence of chat, permission center, action preview and incident UI.
11. Remaining issues ranked by severity.
12. Explicit decision: **Loop 1 COMPLETE / PARTIAL / BLOCKED**.
13. Recommended Loop 2 scope—do not start Loop 2 automatically.

## 14. Coordinator start prompt

```text
Execute BigBill Systems AI Personal Assistant — Loop 1 from
the attached Loop 1 specification.

First perform Phase 0 discovery with multiple read-only agents.
Do not edit files until the coordinator has consolidated the
findings and proposed architecture.

Then proceed through the bounded implementation phases,
assigning agents non-overlapping ownership and requiring
independent QA.

The assistant must be a separate product entity with its own
chat interface, permission/consent center, tool/action
framework, tenant isolation, task capability and incident
communication. BigBill is the first tenant, not a hardcoded
special case.

Integrate with existing systems through verified APIs and
contracts. Reuse current workflows; do not duplicate Khapy,
MotherTracker, BOS, email, WhatsApp, calendars, content
studios, or task systems.

Default to draft-only and read-only. Sending email/WhatsApp,
publishing, spending, deleting, changing permissions, or other
consequential actions must be disabled in Loop 1.

Do not fabricate tool availability or completion. Report blockers
and incidents honestly.

Preserve existing stable infrastructure and CI/deployment
patterns. No paid services or production deployment without
explicit approval.

Finish with the full acceptance matrix, independent QA/security
evidence, and a Loop 1 COMPLETE/PARTIAL/BLOCKED report.
Do not start Loop 2.
```

---

## 15. What Loop 1 intentionally leaves for later

- Autonomous inbox management and sending.
- WhatsApp live connector.
- Email sending integration.
- Calendar write access.
- Khapy asset creation API and execution.
- Social publishing and ad management.
- Voice input/output.
- Mobile app.
- Proactive background agent.
- Agent marketplace / custom agent builder.
- Billing, subscriptions, and customer onboarding for external organizations.
- Organization-specific workflow automation and policies.

These are future loops, contingent on the secure foundation and real integration contracts being verified.
