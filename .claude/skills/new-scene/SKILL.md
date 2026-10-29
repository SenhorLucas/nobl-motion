---
name: new-scene
description: Scaffold a new scene in scenes/<video>/<scene>/ from a spec - checks the brand, the component index and existing scenes first so nothing is duplicated. Use when Lucas asks for a new scene, animation, shot or graphic.
---

# new-scene

## 1. Get the spec

The scene lives in `scenes/<video>/<scene>/`. If `spec.md` doesn't exist,
write it with Lucas from this template (v0; let it evolve):

```markdown
---
id: <scene>
video: <video>
ratios: [16:9, 9:16, 1:1]
duration: 20s            # or "from VO"
sync: free               # free | vo
vo: path/to/vo.wav       # if sync: vo
data: data/foo.json      # if technical
web: false               # true if it also needs a website version
---

## Purpose
One sentence.

## Beats
- 0.0s — …

## Notes
Signatures to include, references, constraints.
```

## 2. Read, cheapest first

`CLAUDE.md` → `brand/tokens.css` + `brand/motion.md` + `brand/signatures.md`
→ `components/COMPONENTS.md`. Then the `hyperframes` skill.

## 3. Check for duplicates. This step is not optional.

For each visual element in the beats (an axis, a film strip, a light beam, a
gamut plot…):

1. Is it in `COMPONENTS.md`? Use the component.
2. `grep -ril "<element keywords>" scenes/ --include=index.html`. If another
   scene already has it inline, **stop**: tell Lucas which scene, and propose
   `promote-component` before writing this one. Don't write a second copy.
3. Named visuals (grain, chart, transition) not found locally:
   `npx hyperframes catalog --query <x> --json` before building by hand.

## 4. Scaffold

- Copy the head, root and timeline pattern of `brand/reference/brand-card/index.html`:
  tokens.css link, `container-type: size` root at 1920×1080, one paused
  root timeline on `window.__timelines`, registered last.
- Paths are written from the repo root (the scene is staged as the root
  `index.html`): `brand/tokens.css`, `assets/...`.
- Technical data: JSON in `data/`, imported in a module script with
  `import data from "./scenes/<video>/<scene>/data/x.json" with { type: "json" };`.
- `sync: vo`: transcribe with the `media-use` skill (Whisper) into
  `data/transcript.json`; place beats at word timestamps from it.
- Only tokens: no hex, px font sizes, easings or durations in the scene.

## 5. Verify

`node scripts/stage.mjs scenes/<video>/<scene>`, `npm run check`, then
`npx hyperframes snapshot --at <beats>` and look at the frames. Stage 9x16
and 1x1 and snapshot again before calling it done.
