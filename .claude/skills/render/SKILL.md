---
name: render
description: Render a scene or brand composition to MP4 at every requested ratio and size, with versioned file names and the colour check. Use whenever Lucas asks to render, export, preview a ratio, or deliver a scene.
---

# render

Always through `scripts/render.mjs`, never bare `hyperframes render`: it
stages each ratio, names the files and checks the colour tags.

## 1. Before rendering

- `node scripts/stage.mjs --pull` if Lucas edited in the HyperFrames app.
  Staging refuses to overwrite unpulled edits in the root `index.html`.
- `npm run check` with the composition staged
  (`node scripts/stage.mjs <dir>`). Fix every error.
- **Once per session, before any delivery render**, and after any HyperFrames
  or FFmpeg upgrade: `npm run colour-check`. It must PASS at all three
  ratios. If it fails, stop and show Lucas the table. Never deliver around it.

## 2. Render

```bash
node scripts/render.mjs <dir>                      # 16x9, 9x16, 1x1 at 1920 long edge
node scripts/render.mjs <dir> --ratios 9x16        # only what was asked
node scripts/render.mjs <dir> --long-edge 3840     # 4K, only when asked
node scripts/render.mjs <dir> --quality draft      # quick look; never deliver a draft
```

Output: `renders/<video>_<scene>_<ratio>_<width>_v<n>.mp4` (all ratios of one
run share `<n>`; 1:1 is 1920×1920 by default). `renders/` is gitignored, so
say where the files are.

## 3. Check every output

`render.mjs` prints the ffprobe tags. All four must read
`color_space=bt709`, `color_primaries=bt709`, `color_transfer=bt709`,
`color_range=tv`; it exits non-zero otherwise.

Then look: pull frames at the beats (`ffmpeg -ss <t> -i <mp4> -frames:v 1`)
or `npx hyperframes snapshot --at …` with the ratio staged. Check that
nothing is cut off at 9:16 and 1:1.

## The colour pipeline, for reference

- Chrome draws sRGB code values; HyperFrames converts RGB→YUV with the BT.709
  matrix, limited range, 4:2:0, and tags primaries/transfer/matrix as bt709.
  The code values pass through unchanged (no sRGB→BT.1886 re-encode), which
  is what YouTube, browsers and phones expect. No grading downstream.
- `scripts/colour_check.py` decodes a frame as a correct 709 player would and
  compares 20 known patches. Pass: every channel within ±2 code values.
  Baseline (28 Oct 2026, hyperframes 0.8.212, FFmpeg 8.0): max 2 code values,
  max ΔE00 1.15, mean 0.23. Chrome's own capture is bit-exact; the residue is
  8-bit 4:2:0 quantisation. A 601-matrix mistake shows up as about 20 code
  values on saturated reds and greens.
- It also checks single PNGs: `uv run scripts/colour_check.py <frame.png>`.

## 4. Report

Files, sizes, the tag lines, the colour-check result if run, and anything that
looked wrong in the frames.
