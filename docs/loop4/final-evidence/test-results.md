# Loop 4 exact-reconstruction — test results (2026-11-25, follow-up branch)

## Automated suite: 54/54 pass (8 files)
- `tests/loop4-reference.test.ts` — 9 assertions: no sphere placeholder, no unconditional fallback note,
  no New-conversation/Start-live-conversation/ThemeSwitcher UX, real counts only, exact palette tokens,
  no cream surfaces, DEMO gating, stub routes, error codes, archive tools, **cross-route ask/mic handoff**,
  **`:root` canonical tokens**, **visualizer dark tokens**, **rail without Repositories**, **ASR hint wiring**.
- `tests/loop4-archive.test.ts` — 6 real-DB e2e: topic retrieval with source/time, honest no-match,
  cross-tenant isolation, model-tool execution with citations, read-only transcript with tenant check,
  active-conversation exclusion.
- `tests/loop4-security.test.ts`, `permissions.test.ts`, `security.test.ts`, `tool-gate.test.ts`,
  `tenant-isolation.test.ts`, `loop22-remediation.test.ts` — all pass (no regressions).

## Typecheck / lint / build
- `npm run typecheck` — pass (exit 0, checked directly).
- `npm run lint` — pass, 0 errors 0 warnings (exit 0, checked directly).
- `npm run build` — pass.

## Live verification (headless CDP + attached browser, fresh dev server)
- Engineering @1672×941: scrollW 1657 < 1672, scrollH == innerH → no page scroll. Console 0 errors.
- Command @1672×941: rendered, dark, no cream block after visualizer fix.
- Engineering @1081×762: scrollW 1066 < 1081 → no horizontal scroll (vertical scroll by design).
- Engineering @390×844: scrollW 375 < 390 → no horizontal scroll (stacked; ribbon internally scrollable).
- Cross-route composer: trusted fill+Enter on Engineering → `/app` (clean URL) → message auto-sent, 0 errors.
- Avatar states (idle/listening/thinking/speaking): clips captured; speaking shows viseme-driven open mouth.
- Demo: stepped deterministically to fixed-clock step 5 with fixture findings; Play/Pause/Step/Reset verified.
- Provider: live `runChatCompletion` probe → `probe-ok` from gpt-4o-mini in 2.3s; `/api/health` shows
  configured:true (booleans only, screenshot in evidence).
- Contrast (computed style): 5.86–16.23:1 across text roles — all WCAG AA.
- ASR hints: code paths added (JSGF grammar + Whisper prompt); recognition accuracy itself needs a human-voice
  test (open — requires a speaker + mic, not scriptable here).
- Lighthouse: 1.0/1.0/1.0 carried from prior round (paths unchanged except styling tokens).

## Not covered by automation (documented as open)
- Phoneme-accurate lip-sync (no provider alignment API exists to test against).
- Human-voice ASR "Aida" recognition check.
- Formal FPS bench (renderer unchanged; disposal + visibility pause reviewed in code).
- Model-side cited archive answer in a live conversation (service/tool proven at unit level).
