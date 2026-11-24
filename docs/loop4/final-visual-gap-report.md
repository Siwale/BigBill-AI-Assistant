# Loop 4 — Final Visual Fidelity and Embodiment Report (follow-up branch)

## Repository / PR baseline
- Actual repository: `/home/bill/BigBill Systems/AI_assistant`
- Branch: `feat/loop4-aida-visual-finalization` (fresh, from `main` @ merge of PR #10)
- Starting commit: `b347d58` (Merge PR #10)
- PR #8 state: MERGED 19:07Z. PR #9 state: MERGED 21:07Z. PR #10 state: MERGED 21:48Z (all on `main`).
- User work preserved: working tree was clean at branch point; no reset/clean/stash used.

## Same-viewport forensics
- Harness: headless Chrome (SwiftShader) driven over CDP with the seeded synthetic QA tenant
  (`owner@alpha.test`, local-only test password); login + onboarding completed in-page; no prod data touched.
- Command capture: `final-visual-regression/command-1672x941.png` (viewport verified 1672×941).
- Engineering captures: `engineering-1672x941.png` (1672×941), `engineering-1080x767.png` (1080×767),
  `engineering-mobile-390x844.png` (390×844).
- Reference: `reference-1672x941.png` (1672×941, exact). Overlay: `engineering-overlay.png` (50% blend).
  Side-by-side: `engineering-sidebyside.png`. Diff: `engineering-diff.png` (grayscale absolute difference).
- Mobile note: an early `mobile:true` emulation run reported 494×1070; re-ran with desktop UA at 390×844
  and verified innerWidth 390. The 390 file in the folder is the corrected one.

## Current root causes (all verified in code + live DOM)
1. **Dim/illegible UI — FIXED.** `--aida-*` sampled tokens were scoped inside the `.command-env` rule,
   but the shell renders `.aida-cc`, so every `var(--aida-*)` resolved to nothing (verified:
   `getComputedStyle(document.documentElement).getPropertyValue('--aida-cyan-4') === ''`,
   panel titles computed as dark `rgb(27,35,31)` on dark panels). Fix: canonical token block moved to
   `:root` (`src/app/globals.css`), single source of truth including the §7.1 aliases. Post-fix measured
   contrast on live DOM: panelTitle 9.69:1, body 6.38:1, meta 5.86:1, rail/topnav 6.23:1, composer 16.23:1 —
   all pass WCAG AA (4.5:1).
2. **Shell composer dead on non-Command routes — FIXED.** The Engineering footer dispatched `aida:ask`
   with no listener mounted. Fix: `command-shell.tsx` hides the shell footer on `/app` (Command owns the
   full composer → exactly one composer per screen) and on other routes navigates to `/app?ask=<text>` /
   `/app?mic=1`; `app/app/page.tsx` + `command-home.tsx` + `chat-workspace.tsx` consume once, auto-send,
   clean the URL (no resend on refresh), and show an explicit mic-tap hint (no autoplay, gesture preserved).
   Verified live with trusted fill+Enter: Engineering → `/app` (clean URL) → message auto-sent, 0 console errors.
3. **Mobile horizontal overflow — FIXED.** At 390px CSS the document scrolled to 494px (loop badge 200px +
   topbar no-wrap + grid children min-width auto + centre avatar/timeline row). Fix: badge hidden ≤720px,
   `.aida-grid-eng > * { min-width: 0 }`, centre row stacks ≤720px, topbar tightened. Re-measured:
   document scrollWidth 375 < 390. The 5-stage ribbon keeps contained `overflow-x:auto` by design.
4. **No page scroll at 1672×941:** `documentElement.scrollHeight (941) === innerHeight (941)`. Gate passes.
5. **"N" glyph artifact in headless full-page captures — capture-pipeline noise, NOT a product defect.**
   Evidence: exhaustive DOM enumeration finds no such text node; `elementsFromPoint` hits the rail aside;
   clip captures of the identical region are clean; real-GPU attached-browser screenshots never show it;
   blank page is clean. Attributed to SwiftShader sticky/fixed-layer miscomposite (footer is sticky,
   vignette overlays are fixed). It pollutes `engineering-diff.png` slightly; called out here, not treated
   as product signal.

## Engineering composition (1672×941 live capture)
- Active top navigation: Engineer underlined/glowing; rail: Engineering selected. No History duplication.
- Left stack: Engineering Request (live latest event or honest empty) / Repository Overview (real registry
  fields, "not scanned yet" where unavailable) / Current Focus (live state, indeterminate bar unless events).
- Centre: procedural bust + AIDA/state label + 7-step vertical timeline (green done / cyan active / red failed
  connection / grey pending — all event- or health-driven).
- Right: Live Activity (Offline badge honest — companion `not_installed` for the seeded tenant) + Findings
  (Live) with honest "no audit yet" (never the reference's sample 17).
- Bottom: 5-stage ribbon (all idle-pending, honest) + luminous cyan composer pill (mic + input + search affordance).
- No horizontal overflow; no page vertical scrollbar; no cream surfaces.

## Colour and legibility
- Tokens: `:root` canonical block, §7.1 aliases included; legacy `.command-env --cmd-*` retained for older surfaces.
- Overlay/dimming root cause: unresolved custom properties (above), not a scrim layer. No global opacity/filter
  on `.aida-cc` (computed `opacity: 1`, `filter: none`).
- Contrast: measured above, all AA. Screenshots: overlay + side-by-side + diff in `final-visual-regression/`.

## Digital-human asset — STILL BLOCKED (explicit, per §6 gate)
- Asset name/source: none bundled. Licence: n/a. Format/rig/morphs: procedural interim only.
- What was investigated: `GLTFLoader` is available in the installed `three` package; the avatar stage exposes
  a viseme/rig adapter (`TimedViseme` → jaw/mouth/gaze/blink) a GLB can drive. No photorealistic
  feminine-presenting rigged human exists under a clearly commercial-safe free licence (CC0 packs are
  stylised; Mixamo-derived binaries have unclear redistribution terms). Quality assets need procurement
  approval (AGENTS.md forbids new paid services without approval).
- Rendered interim: procedural bust (face anatomy, blink/gaze/jaw, cyan rim, rings, pedestal, particles),
  honest "procedural bust — rigged GLB pending" label, WebGL-loss poster fallback only.
- Side-by-side verdict: composition/palette/navigation recognisably match the reference; the avatar is visibly
  stylised vs the photoreal reference. Phase 3 gate does NOT pass — recorded as the single largest blocker.

## Facial animation / audio
- States: idle/listening/thinking/searching/inspecting/verifying/speaking + reduced-motion + hidden-tab pause.
- Blink (varied interval), gaze saccades, damped head motion, brow focus, breathing.
- Visemes: heuristic (`approximate:true`); server-TTS path re-anchors to real audio duration on metadata load;
  mouth returns to rest on end/cancel; no autoplay. Phoneme-accurate alignment still open (no provider API).

## Activity
- SSE: existing `/api/engineering/audits/[id]/events` + polling fallback verified (Live badge reflects
  connection; Offline shown honestly for the seeded tenant without companion).
- Demo: `/app/aida-preview` unchanged this round (dev-only, production-gated, DEMO banner, Play/Pause/Reset/Step
  verified previously). Demo events cannot reach production stores (no shared code path writes).

## Model provider
- Configured: openai / gpt-4o-mini (`/api/health`: configured:true). Previous round proved live inference
  (`probe-ok`, 4.6s). `ModelError` carries status/code into logs + incident evidence.
- Not re-probed this round (no code change on that path); failure taxonomy in orchestrator unchanged.

## Conversation / archive
- No `New conversation` / `Start live conversation` / `Clear chat` in UI (regression-tested).
- Cross-route ask/mic handoff added (above); continuous identity preserved; URL cleaned after consume.
- Archive: `listArchivedConversations` + read-only history + `search_archived_conversations` tool + 6 real-DB
  e2e tests (previous round). History has no rail entry and no permanent Engineering panel.

## Quality
- Typecheck: pass. Lint: pass (exit codes checked directly). Tests: 52 pass (8 files) + new ask-flow source
  assertions below. Build: re-run at the end.
- Browser console: 0 errors on engineering/command/preview/forge/history routes (attached + headless).
- Responsive: 1672×941 no page scroll; 1080×767 wraps right stack below centre (by design ≤1280px), no page
  horizontal overflow; 390×844 stacks, composer usable, ribbon internally scrollable.
- Accessibility: Lighthouse 1.0/1.0/1.0 on Engineering (previous round); contrast re-measured this round (above);
  keyboard Tab reaches nav + labelled composer; avatar honours reduced-motion.
- GPU/perf: no new profiling this round (unchanged renderer with disposal + visibility pause).

## Changed files (this branch)
- `src/app/globals.css` — tokens to `:root` (+§7.1 aliases), responsive fixes (badge, grid min-width,
  centre stacking), dark chat/button overrides retained.
- `src/components/command/command-shell.tsx` — footer hidden on `/app`; ask/mic handoff with navigation.
- `src/app/app/page.tsx` — `ask`/`mic` search params (bounded, 2000 chars).
- `src/components/command/command-home.tsx` — forward `initialAsk`/`initialMic`.
- `src/components/chat/chat-workspace.tsx` — consume-once ask effect, `aida:mic` listener, mic hint banner.
- `src/components/engineering/engineering-workspace.tsx` — `aida-centre` class for stacking.
- `tests/loop4-reference.test.ts` — ask/mic wiring + `:root` token assertions.
- `docs/loop4/final-visual-regression/*` — reference + 4 captures + overlay + side-by-side + diff.
- `docs/loop4/final-visual-gap-report.md` — this file.

## Remaining blockers
1. Licensed rigged photoreal GLB (Phase 3 gate fails). Evidence: side-by-side avatar region. Next: user-approved
   licensed source → adapter-ready import (jaw/mouth/gaze/blink weights).
2. Phoneme-accurate lip-sync (heuristic labelled; server path duration-anchored).
3. `engineering-diff.png` contains headless-compositor noise (the "N" artifact + SwiftShader shading
   differences) — use overlay/side-by-side for judgement, not the raw diff metric.
4. Cited archive-retrieval conversation test at model-behaviour level; renderer perf profiling.

## Deployment
- No production deployment performed.
