# Loop 4 — Exact Reference Reconstruction Report (follow-up branch)

## Repository state
- Repo root: `/home/bill/BigBill Systems/AI_assistant`
- Branch: `feat/loop4-aida-exact-digital-human` (fresh from `main` @ merge of PR #11)
- Start commit: `436dc73`. End commit: (this loop's commit; see log)
- PR #8/#9/#10/#11 state: all MERGED. New PR: to open against `main`.
- Existing user changes preserved: working tree was clean at branch point; no reset/clean/stash/force-push.

## Screenshots (all app-only, no browser chrome, no terminal pane)
Exact viewports via headless-Chrome CDP + seeded synthetic QA tenant (`owner@alpha.test`):
- `final-evidence/engineering-1672x941.png` (viewport verified 1672×941)
- `final-evidence/command-1672x941.png` (viewport verified 1672×941)
- `final-evidence/engineering-1081x762.png` (viewport verified 1081×762)
- `final-evidence/engineering-1080x767.png` (viewport verified 1080×767)
- `final-evidence/engineering-mobile-390x844.png` (viewport verified 390×844)
- `final-evidence/reference-1672x941.png` (approved reference, exact)
- Overlays: `engineering-1672x941-overlay.png` (50% blend), `-sidebyside.png`, `-diff.png`
  (grayscale absolute difference; includes headless-compositor noise — use overlay/side-by-side for judgement).
- `final-evidence/avatar-{idle,listening,thinking,speaking}.png` — avatar state clips.
- `final-evidence/demo-live-activity.png` — deterministic demo at fixed-clock step 5 with fixture findings.
- `final-evidence/provider-success-or-redacted-blocker.png` — `/api/health` (booleans only, no secrets).

## Engineering layout
- Header: 88px; brand mark rebuilt (gradient metallic triangle, 30px wordmark); top nav Home…Vision with
  Engineer active; bell/settings/profile visible; loop badge (hidden ≤1280px to protect narrow layouts).
- Left navigation: `clamp(96px, 9.45vw, 158px)` rail (158px at reference), order
  Command/Engineering/Projects/Meetings/Devices/Media/Vision/Automation/Settings; **Repositories removed
  from the rail** (top-nav destination only); Engineering selected; Automation honestly disabled with reason.
- Request card: live latest event or honest empty state; Repository card: real registry fields
  (branch/commit/health/updated; files/languages "not scanned yet" when unavailable); Current Focus: honest
  idle indeterminate state, never a fabricated percentage.
- Centre avatar stage: procedural bust (interim, labelled) + AIDA/state label + 7-step vertical timeline
  (green done / cyan active / red failed connection / grey pending — event- and health-driven).
- Live Activity (Offline badge honest for the seeded tenant without companion) + Findings (Live) with honest
  "no audit yet" (never the reference's sample 17).
- Bottom: 5-stage ribbon (event-driven, calm when idle) + luminous cyan composer pill (mic + input + affordance).
- Scroll/overflow: 1672×941 → scrollW 1657 < 1672, scrollH == innerH (no page scroll). 1081×762 → scrollW
  1066 < 1081 (vertical scroll by design as right stack wraps). 390×844 → scrollW 375 < 390 (stacked; ribbon
  scrolls internally by design). Re-measured live after fixes, not assumed.

## Colour / typography
- Token source: `:root` canonical block incl. §6.1 aliases (single source of truth).
- Cream theme leak root cause: `AudioVisualizer` container used light `var(--surface-2)`/`var(--line)` inline
  tokens (cream `#faf7f0`) with no `.aida-cc` override — the reported ~640×107 cream block with dashed
  waveform track + pale ring. Fixed at source (dark glass container); feature retained (real levels only).
  Full DOM investigation: `final-evidence/cream-placeholder-dom-investigation.md`. Legacy light surfaces that
  can render inside the shell (cards/forms/banners/lists/stats) remapped under `.aida-cc`.
- Overlay/dimming root cause (prior round, stands): tokens were scoped in `.command-env`, shell renders
  `.aida-cc`; fixed. No global scrim (computed opacity 1, filter none).
- Contrast verification (live computed style): panelTitle 9.69:1, body 6.38:1, meta 5.86:1, rail/topnav
  6.23:1, composer 16.23:1 — all pass WCAG AA.
- Remaining differences: reference has photographic background plate + photoreal avatar (asset-blocked, below);
  palette/tokens/typography hierarchy match.

## Aida digital human — EXPLICITLY BLOCKED (Phase 3 gate fails)
- Asset: none bundled. Licence: n/a. Rig/blendshapes: procedural interim only.
- What changed this round: independent licence/rig audit of every viable free source
  (`final-evidence/avatar-asset-license-and-rig.md`): three.js Michelle (no licence, Mixamo redistribution
  ban, no facial rig), Xbot (male robot, same ban), Quaternius (CC0 but stylised, no face rig), Ready Player
  Me (service shut down 31 Jan 2026), Rocketbox (research-only framing + unsuitable content), Khronos samples
  (no feminine human), BlendSwap (unverified), Renderpeople free (GTC §4 bans real-time use without consent),
  three.js near-misses (male/stylised/service-bound).
- Recommended next action: buy a Renderpeople rigged scan + obtain written real-time/web-use consent
  (info@renderpeople.com, GTC §4.2); needs budget sign-off + legal review. Fallback: Reallusion
  ActorCore/Character Creator (EULA permits royalty-free commercial interactive use). GLB self-hosted either way.
- Current interim (labelled, not claimed): procedural bust — anatomy, blink lids, gaze saccades, brow focus,
  jaw + viseme adapter, cyan rim, rings, pedestal, particles; three-quarter-capable orientation; honest
  "procedural bust — rigged GLB pending" label; WebGL-loss poster fallback only.
- Side-by-side verdict: composition/palette/navigation recognisably match; the avatar is visibly stylised vs
  the photoreal reference. **Do not mark complete.**

## Facial animation / voice
- State machine: idle/listening/thinking/searching/inspecting/verifying/speaking + reduced-motion + hidden-tab
  pause; priority stop > visemes > listening > task > idle; calm error state.
- Blink/gaze: varied-interval lids, bounded saccades, damped head motion; no perpetual loops.
- TTS provider/voice: server TTS (OpenAI) with user-persisted voice; browser speechSynthesis preferred path per
  profile; preview uses the real voice; gender-incongruent silent fallback removed earlier (persists).
- Viseme alignment source: heuristic (`approximate:true`), server path re-anchored to real audio duration on
  metadata load; mouth returns to rest on end/cancel; no autoplay. Phoneme-accurate alignment still open
  (no provider API).
- Interrupt/stop: tested paths — utterance onend/onerror and audio onended/onerror reset mouth + state.
- ASR name recognition (new): browser `SpeechGrammarList` JSGF hint with the configured assistant name
  (Chrome where supported; transcript stays editable); server Whisper path passes a server-composed
  vocabulary prompt (assistant + product names, from session profile, never client input). "Aida"/"Ida"
  mitigation in place on both paths.

## Live and demo
- SSE real connection: existing `/api/engineering/audits/[id]/events` + polling fallback; Live badge reflects
  connection; seeded tenant honestly Offline (companion `not_installed`).
- Live event replay: Last-Event-ID/polling dedupe (prior round, unchanged).
- Findings source: real `/report` only; honest empty state.
- Demo route: `/app/aida-preview` unchanged shell + NEW deterministic engineering demo section: fixed script on
  fixture `demo-repository` (branch main, commit demo0000), fixed clock (12:00:00 + 8s steps), fixture timeline /
  activity / P0-P2 fixture findings with DEMO marks, Play/Pause/Resume/**Step**/Reset (Step added this round for
  timer-independent repeatable screenshots). DEMO label: page banner + panel badge; no Live badge anywhere.
- Demo isolation: pure local `useState` fixtures; zero fetches; no provider/tool/shell/production-DB contact.

## Model provider
- Provider/model: openai / gpt-4o-mini (health: configured:true).
- Tested successfully: live `runChatCompletion` probe → `probe-ok` in 2.3s this round (transient 21:04 failure
  from the screenshots not reproduced). Health screenshot in evidence (booleans only).
- Error category: `ModelError` kind/status/code taxonomy with safe user messages + redacted logs (prior round).
- Fallback/spend: configured provider only; no silent switching; no paid additions.

## Conversation / archive
- No-new-conversation control: verified (regression-tested).
- Continuous active identity: preserved; cross-route shell composer hands into `/app?ask|?mic=1`, consumed
  once, URL cleaned (verified live).
- Archive/history: listArchivedConversations + read-only history route + `search_archived_conversations` tool;
  6 real-DB e2e tests pass. History has no rail entry and no permanent Engineering panel (by design).
- Retrieval source references: service + tool return conversation id/title/time/message excerpts; model-side
  cited-answer test still open.

## Quality
- Typecheck: pass. Lint: pass (exit codes checked directly). Tests: 54 pass (8 files) + new source assertions
  this round (visualizer tokens, rail contents, ASR hint, ask/mic wiring, `:root` tokens).
- Build: `npm run build` pass.
- Console: 0 errors on engineering/command/preview/forge/history (attached + headless, fresh server).
- Responsive: measured above; 1080×767 wraps right stack below centre, no page horizontal scroll.
- Accessibility: Lighthouse 1.0/1.0/1.0 (prior round, unchanged paths); contrast re-measured this round;
  keyboard Tab reaches nav + labelled composer; reduced-motion honoured.
- FPS/memory: renderer disposes geometries/materials/listeners/loops on unmount, pauses when hidden, caps
  pixel ratio; no formal FPS bench this round (unchanged renderer).

## Changed files
- `src/app/globals.css` — visualizer-independent: `:root` tokens kept; responsive topbar/nav/rail/grid/centre
  rules; legacy card/form/banner/list/stat/draft/code/kv dark remaps; `aida-centre` stacking.
- `src/components/command/command-shell.tsx` — gradient brand mark, Repositories removed from rail.
- `src/components/voice/audio-visualizer.tsx` — dark glass container (cream root cause fix).
- `src/components/engineering/engineering-workspace.tsx` — `aida-centre` class for stacking.
- `src/components/chat/chat-workspace.tsx` — JSGF grammar hint (Chrome) for the configured assistant name.
- `src/modules/assistant/model.ts` — `transcribeAudio` vocabulary-hint param → Whisper `prompt`.
- `src/app/api/voice/transcribe/route.ts` — server-composed vocabulary hint from session profile.
- `src/components/dev/presence-preview.tsx` — deterministic demo section (timeline/activity/findings, fixed
  clock, Step control) + demo timer cleanup.
- `src/app/app/page.tsx`, `command-home.tsx` — unchanged this round (ask/mic handoff from prior round).
- `tests/loop4-reference.test.ts` — new assertions (visualizer, rail, ASR, `:root` tokens).
- `docs/loop4/final-evidence/*` — 17 files per §20 + reference copy.

## Blockers
1. Photorealistic rigged GLB (Phase 3 gate). Evidence: side-by-side avatar region + `avatar-asset-license-and-rig.md`.
   Next: user-approved licensed source (Renderpeople + written consent, or Reallusion); then adapter import.
2. Phoneme-accurate lip-sync (heuristic + duration-anchored; no provider alignment API).
3. Model-side cited archive answer e2e (service/tool proven; conversation-level test open).
4. Formal FPS bench (unchanged renderer; disposal + visibility pause in place).

## Deployment
- No production deployment performed.
