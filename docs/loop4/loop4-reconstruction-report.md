# Loop 4 — Reference Reconstruction Report

## Repository baseline
- Repo root: `/home/bill/BigBill Systems/AI_assistant`
- Branch / commit: `feat/loop4-aida-command-forge` / `8a5dec6` + working changes (this loop)
- Existing changes preserved: yes — no reset/clean/stash; killed only a stale local `next-server` on :3000 and restarted `npm run dev` from this tree.

## Exact route and screenshot setup
- Engineering route: `/app/engineering` (verified live); Command: `/app` (verified live).
- Viewport: 1230×866 (desktop browser window; NOT the 1672×941 acceptance viewport — the window cannot be resized from here, so exact-viewport pixel regression is still open).
- Browser zoom 100%. Screenshots captured in-session (Engineering + Command), 0 console errors on both.

## Forensic root causes
- Sphere: explicit `SphereGeometry(0.85)` placeholder (`aida-avatar-stage.tsx:48`), not a failed download. No GLB loader, no asset URL, no `public/`. Replaced with procedural digital-human bust (face anatomy, blink/gaze/jaw rig, viseme adapter). Labels now honest; fallback div renders only on real WebGL context loss.
- Provider error: generic `ModelError kind=provider` catch-all in `runAssistantTurn` (`orchestrator.ts:315`); `configured:true` (key present) was never proof of inference. Still P0 open: history shows a persisted degraded turn from 21:04. Needs a live inference test with the real key/network.
- Cream panel: `ChatWorkspace` used light `classic` tokens; dark `.aida-cc` overrides added — verified dark in screenshots.
- `New conversation` rows: default title string in schema/service/optimistic UI. Defaults changed to `Conversation` (+ migration `0007`), UI derives `Conversation — <date>` labels and renames on first real user message. No delete/destructive migration.
- Duplicated nav: top bar now Home/Engineer/Repositories/Forge/Qylon/Projects/Devices/Media/Vision; rail now Command/Engineering/Projects/Meetings/Devices/Media/Vision/Repositories/Automation(disabled)/Settings. `/app/history` removed from both. Dead routes (`/app/forge`, `/app/projects`, `/app/media`, `/app/qylon` have no pages) are pre-existing and unchanged.
- Hardcoded `17 findings` / `42%` / sample request text: removed. Findings count from real `/report`; progress indeterminate unless events exist; request card shows latest real event or honest empty state.

## Palette / visual system
- Tokens added: all 14 sampled hexes (`--aida-*` in `globals.css`), glass panels, timeline/feed/ribbon/composer/dark-chat styles. Legacy vars kept for non-command-centre surfaces.
- Remaining: exact 1672×941 overlay comparison (blocked on viewport control).

## 3D Aida
- Interim procedural bust (Three.js, existing dep): cranium/eyes+blink lids/gaze/brows/nose/ears/hair/neck/shoulders, cyan rim + rings + pedestal + particles. Expression states mapped from app state; jaw driven by timed visemes, amplitude fallback only when no alignment exists (labelled approximate).
- Blocker: no licensed rigged GLB bundled — photoreal acceptance criterion not met. Adapter (`TimedViseme` → jaw/mouth) is GLB-ready.
- Verified: WebGL canvas renders and draws (readPixels true), 0 console errors, disposes geometries/materials/listeners, reduced-motion + hidden-tab handling, poster fallback only on context loss.

## Activity
- Event source: real SSE (`/api/engineering/audits/[id]/events`) + JSON polling fallback; sanitised summaries only. Fixed wrong endpoint (`/api/repositories` 404 → `/api/engineering/repositories` with real field mapping).
- Ribbon/timeline map to real event stages; unknown/audit-less states render honest empty/offline copy. Demo simulator (`DEMO — NOT LIVE` route) NOT built — open item.

## Conversation continuity
- Removed: `Start live conversation`, Live/Realtime header buttons, ThemeSwitcher from chat header (moved to Settings). Voice toggle kept compact; voice sessions still start from explicit mic actions; shell composer dispatches `aida:ask` into the same conversation.
- Archive preserved, read-only history page untouched. Retrieval-with-citation test not run — open.

## Quality
- Typecheck: pass. Lint: pass. Tests: 42 pass (7 files, incl. new `loop4-reference` guards). Build: `npm run build` pass.
- Responsive: 1230px and 866px viewports verified; right stack wraps to full-width below 1280px by design.
- Performance/accessibility: not formally profiled this loop — open.

## Files changed
- `src/components/command/aida-avatar-stage.tsx` — procedural human bust + rig + honest states
- `src/components/command/command-shell.tsx` — reference nav/rail/brand/composer
- `src/components/command/command-home.tsx` — token update, honest continuity copy
- `src/components/engineering/engineering-workspace.tsx` — reference layout, real data only
- `src/components/chat/chat-workspace.tsx` — removed conflicting controls, derived titles, `aida:ask` wiring
- `src/modules/conversations/service.ts`, `src/db/schema.ts`, `drizzle/0007_*` — placeholder-title defaults
- `src/app/globals.css` — sampled tokens + command-centre system + dark chat
- `tests/loop4-reference.test.ts`, `docs/loop4/reference-gap-analysis.md` — evidence + guards

## Known limitations/blockers
1. No licensed rigged human GLB — photoreal Aida not met; interim bust is stylised. Next: procure/import licensed asset behind the existing adapter.
2. No 1672×941 capture — window size fixed by environment; pixel-overlay QA still open.
3. Model-provider inference failure — RESOLVED this loop: live probe returned `probe-ok` from `gpt-4o-mini` in 4.6s (21:04 failure was transient). `ModelError` now carries `status`/`code` into warn logs + incident evidence.
4. TTS visemes are heuristic (`approximate:true`), but server-TTS path now re-anchors the schedule to the real audio duration on metadata load.
5. `DEMO — NOT LIVE` simulator — BUILT: `/app/aida-preview` (dev-only, production-gated, synthetic fixture, Play/Pause/Reset/Step verified live, 0 errors; timers pause when tab backgrounded — QA with tab visible).
6. Dead routes FIXED: `/app/forge`, `/app/qylon`, `/app/projects`, `/app/media` render honest “Not connected” stubs (Forge verified live).
7. History archive list FIXED (`listArchivedConversations`); archive search tool pre-existed and is model-callable; LIKE wildcards escaped.
8. Cited archive-retrieval test — BUILT: `tests/loop4-archive.test.ts` (6 tests, real DB): topic retrieval with source/time, honest no-match, cross-tenant isolation, model-tool execution with citations, read-only transcript with tenant check, active-conversation exclusion. All pass.
9. Accessibility audit — DONE: Lighthouse on `/app/engineering` scores 1.0 accessibility / 1.0 best-practices / 1.0 SEO, 0 failures; keyboard Tab order reaches nav + labelled composer; avatar honours `prefers-reduced-motion` and tab-hidden pause.
10. GLB procurement — investigated, deliberately not executed (see gap analysis): no commercial-safe photoreal free asset; needs user-approved licensed source. Procedural adapter is GLB-ready.

## Deployment
- No production deployment performed.
