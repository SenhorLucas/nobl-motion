# nobl-motion — bootstrap brief for Claude Code


## Context

- Owner: Lucas (Nobl Studios). Colour scientist and photographer. Rigor in small details matters.
- Purpose: on-brand motion graphics for YouTube long-form, reels and the website, generated with HyperFrames (HTML + GSAP + Three.js) and Claude Code.
- Two kinds of animation: **technical** (number-driven charts, 3D colour spaces) and **artistic** (camera, film, light, darkroom).
- First real scene: the analog process (photo → negative → develop → enlarger → paper → develop → final image), reusable across videos and on the website.

## 1. Repo

- Empty repo exists on GitHub: github.com/SenhorLucas/nobl-motion. Add to lucas-os as a submodule (same pattern as the other repos).
- Requirements: Node ≥ 22, FFmpeg. Run `npx hyperframes doctor` and fix anything it reports.
- `npx hyperframes init` inside the repo.
- `renders/` is gitignored.

## 2. Skills (keep the set small)

Install the HyperFrames skills (`npx skills add heygen-com/hyperframes`), then keep only:

- `hyperframes` — composition authoring
- `hyperframes-cli` — init, lint, inspect, preview, render
- `hyperframes-media` — Whisper transcription for VO timestamps
- `hyperframes-registry` — catalog blocks
- `gsap` — timelines
- `three` — Three.js scenes seeked by the HyperFrames clock

Remove the rest (website-to-hyperframes, remotion-to-hyperframes, lottie, animejs, waapi, css-animations). They are irrelevant here and only add trigger noise. Re-add one if a real need appears.

Then create four **project skills** in `.claude/skills/`, each SKILL.md under ~60 lines:

- `new-scene` — scaffold `scenes/<video>/<scene>/` from a spec; read `brand/` and `components/COMPONENTS.md` first; check whether any element of the spec already exists in another scene (see §5).
- `promote-component` — extract a repeated element into `components/<name>/`, parameterise it, add one line to `COMPONENTS.md`, and replace every usage.
- `render` — render a scene at all requested ratios and sizes, name outputs `<video>_<scene>_<ratio>_<width>_v<n>.mp4`, and run the colour check from §4 on the result.
- `learn-from-luke` - repeated feedback from Lucas should be incorporated into the context, as a brand, component, skill or scene update. Or even CLAUDE.md itself.

## 3. Layout and context layering

```
nobl-motion/
  CLAUDE.md              # ≤ 50 lines: what this is, where things live, the rules below
  brand/
    tokens.css           # colours, fonts, spacing, radii, easing, durations as CSS custom properties
    motion.md            # motion principles, short
    signatures.md        # recurring "Moses' pinky" details, one line each
    reference/           # brand reference frame renders (see §4)
  components/
    COMPONENTS.md        # index: one line per component (name, what it is, props, ratios)
    <name>/              # index.html|js + short README
  scenes/<video>/<scene>/
    spec.md
    index.html
    data/                # JSON from lucas-os/scripts or generated in place
  scripts/
  renders/               # gitignored
```

Reading order for any task, cheapest first: `CLAUDE.md` → `brand/tokens.css` + `brand/motion.md` → `COMPONENTS.md` → only the component or scene files the task touches. Never load other scenes' code wholesale; search them.

Rules for CLAUDE.md:
- No hard-coded colours, fonts, easings or durations in scenes. Everything comes from `tokens.css`.
- Every composition must work at 16:9, 9:16 and 1:1 (responsive layout driven by the composition size, not three separate files).
- Render targets: 1920 long edge by default, 3840 when asked.
- Data for technical scenes comes from JSON files in `data/`, never from numbers typed into the composition.
- Colour accuracy is non-negotiable (see §4).

## 4. Brand layer

1. Read `repos/lukes-lab` and `repos/squarespace-boltons` (and anything relevant the lucas-os context points to). Extract colours, typefaces, type scale, spacing, and any motion or interaction patterns.
2. Write `brand/tokens.css`, `brand/motion.md`, `brand/signatures.md`. Where the sources disagree or say nothing (motion is the likely gap), **list the gap and propose options; do not invent silently.**
3. Build `brand/reference/brand-card` — one composition showing type, palette, a chart axis, a 3D colour-space snippet and a sample transition. Render it at 16:9, 9:16 and 1:1. This becomes the brand reference frame.
4. Colour pipeline check (Rec.709 delivery, no grading downstream): build a test composition with known sRGB patches (primaries, secondaries, greys, a skin tone), render it, then:
   - `ffprobe` must show `color_primaries=bt709`, `color_space=bt709` (YUV matrix) and a 709 transfer tag. FFmpeg can default to the BT.601 matrix, which shifts hues; make the render config set it explicitly.
   - Decode a frame back to RGB and compare patch values to the source within a small tolerance. Report the deltas.
   - Fold this check into the `render` skill.
5. Stop and show Lucas the tokens, the gaps, the brand card renders, and the colour check results.

## 5. Component strategy

- Rule: **the second appearance makes a component.** The first time, write it inline in the scene.
- `new-scene` checks the spec against `COMPONENTS.md` and greps existing scenes for similar elements. If something already exists inline elsewhere, it stops and proposes `promote-component` before writing a duplicate.
- Components take props (data, size, timing, tokens override) and must render at all three ratios.

## 6. Scene spec v0

Start simple; it will evolve.

```markdown
---
id: analog-process
video: nobl-film-tutorial
ratios: [16:9, 9:16, 1:1]
duration: 20s            # or "from VO"
sync: free | vo
vo: path/to/vo.wav       # if sync: vo — transcribe with Whisper for word timestamps
data: data/foo.json      # if technical
web: true                # also needs a website version
---

## Purpose
One sentence.

## Beats
- 0.0s — …
- 3.0s — …

## Notes
Signatures to include, references, constraints.
```

## 7. Website delivery

Prefer embedding the composition with `@hyperframes/player` (live HTML: crisp at any size, small). Check performance on a mid-range phone, especially Three.js scenes. If it is heavy, fall back to a short, muted, looping H.264/AV1 render with a poster frame.

## 8. Done when

- Repo exists as a submodule with the trimmed skill set and the three project skills.
- Brand tokens, motion notes and signatures exist and Lucas has approved them.
- Brand card renders at three ratios; colour check passes.
- Then: start `scenes/nobl-film-tutorial/analog-process/` from its spec.
