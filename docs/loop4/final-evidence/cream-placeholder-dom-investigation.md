# Cream placeholder — DOM forensic investigation

- Date: 2026-11-25. Investigator: coordinator, live DOM + source.
- Reported shape: large cream/ivory rounded rectangle (~640×107 in a ~1081px viewport) with a dashed
  horizontal segmented track and a pale circular outline, sitting between the conversation transcript and
  the dark message composer on the scrolled Command page.

## Identification (source evidence, not a guess)
- Component: `AudioVisualizer` in `src/components/voice/audio-visualizer.tsx`.
- Rendered by `ChatWorkspace` above the composer (`chat-workspace.tsx`, wraps it in a max-width-760 container —
  760px minus padding/border ≈ the reported ~640px visible width at that viewport; container height 120px
  ≈ the reported ~107px).
- The "dashed track" is the canvas waveform: 28 rounded bars drawn across the midline
  (`audio-visualizer.tsx:64-85`), quiet at idle (`pulse = clamped * 0.2`).
- The "pale circular outline" is the canvas background ring (`ellipse` stroke at `:48-52`).
- Root cause: the container used light-theme tokens — `background: var(--surface-2)` (= `#faf7f0` cream
  from `:root`) and `border: var(--line)` — which resolve to cream even inside the dark command centre,
  because no `.aida-cc` override covered this component's inline style. The canvas art itself already uses
  dark-safe rgba strokes; only the container fill was wrong.

## Fix at source (this loop)
- Container now uses the command-centre glass directly:
  `background: rgba(3,20,35,0.9); border: 1px solid var(--aida-border-strong, …)` in
  `src/components/voice/audio-visualizer.tsx:110`.
- Idle rendering is honest: quiet low bars + `IDLE` label driven by the real `audioState`/`level`
  (analyser-backed when active, near-flat when idle) — never a fake active waveform.
- The feature was NOT removed: the visualizer is a required capability (real capture/playback levels).
- Sweep: legacy light surfaces that can render inside the shell (`.card`, `.page-header`, `.field`,
  `.banner`, `.error`, `.list-item`, `.stat`, `.empty`, `.code-block`, `.kv`, draft/connector cards) are
  remapped to the dark palette under `.aida-cc` in `src/app/globals.css`, so no other route can produce
  an arbitrary cream panel inside the Aida experience.

## Verification
- `npm run typecheck`, `lint`, `vitest` (54 tests incl. a new source assertion that the visualizer no
  longer references light surface tokens).
- Live headless capture of the Command route at 1672×941: composer zone renders dark glass, no cream block.
