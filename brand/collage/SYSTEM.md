# Collage system

Status: **proposed** (28 Oct 2026). A Vox-style explainer collage with Bauhaus
geometry, built on the store's palette and Outfit. Reference stills:
`brand/reference/collage/` (`sheet-elements`, `sheet-depth`, three frames).
Code: `brand/collage/collage.css` and `collage.js`.

## The rule

**Every mark has a job and an anchor.** An accent exists only if it points
at, measures, frames or samples one specific thing in the frame: a named
feature of a cutout, a label, or a data point. `collage.js` throws when an
accent is called without its anchor, so a decorative mark cannot be built.

We explain photography and colour. We don't report news: no newsprint, no
found text. Textures come from the photographer's desk.

## Elements

| # | Element | Job | Anchor | Max per frame |
| --- | --- | --- | --- | --- |
| 01 | Circle field (yellow) | The subject of the beat sits on it | Centred on the hero cutout's mass (`collage.js` places it) | 1 |
| 02 | Block field (blue) | Grounds a second object or groups a data panel | Snaps to the grid; touches a frame edge or the hero | 1 |
| 03 | Giant numeral (blue) | Type as shape: a number that matters (ISO, stop, year) | Behind the hero; it is the beat's number | 1 |
| 04 | Highlight (yellow) | The one word the narrator stresses | That word | 1 |
| 05 | Sunburst (red) | **Light**, radiating from its source | A lens, flash, lamp or enlarger head (`sunburst({ at })`) | 1 per section |
| 06 | Arrow (red, hand-drawn) | From a label to the exact feature it names | Label element → feature point (`arrow({ from, to })`) | 1 |
| 07 | Leader line (black hairline) | Ties a name to its target | Both ends anchored (`leader({ from, to })`) | 2 |
| 08 | Tick scale (red) | Measures something real: stops, nm, frame numbers | Along the thing it measures, with values and unit (`ticks()`) | 1 |
| 09 | Swatch chip | A sampled colour, with its value | Leader to the sample point (`swatch({ sample })`) | 3 |
| 10 | Keeper mark (red grease pencil) | The chosen frame on a contact sheet or negative strip | The frame (`keeper({ around })`) | 1 |
| 11 | Labels | Chapter numeral ("01."), label box (black), tracked eyebrow | Chapter top-left; labels next to or leading to their target | 2 labels + 1 eyebrow |
| 12 | Desk textures | Grid paper, enlarger test strip, negative strip, paper (boil set) | Under the content (depth 0); paper is `components/paper-boil.js` on a set from `assets/textures/`; test strips and negatives are generated from parameters | — |

Composition: **one hero, one field, at most one secondary object, at most two
accents beyond the type.** Empty paper is a feature, not a gap to fill.

## Colour roles

- **Yellow**: the subject (circle field, highlight).
- **Red**: light and emphasis (sunburst, arrow, ticks, keeper mark).
- **Blue**: structure and data (block field, giant numeral).
- **Black**: naming (label boxes, leader lines, chapter numeral).
- **Green**: only as a data channel (R/G/B traces).
- **Computed colours** (swatches, spectral colours, test-strip tones) are data
  and are shown exactly as computed, never as tokens.
- **Exception to sign off:** the store's Rare Stripe Rule keeps Kodachrome
  hues off large areas. This system needs large flat fields, so in motion the
  circle, block and numeral may be area fills. Everything else still follows
  the store.

## Type

Outfit only.
- **Headline:** 700, display or headline size, sentence case, with one
  yellow highlight.
- **Labels:** 600, uppercase, tracked, or white on black in a label box.
- **Body:** 500 at annotation size.
- **Numbers:** tabular.
- **Floor:** nothing a viewer reads is below 2.6cqmin.

## Cutouts

Black-and-white halftone (HyperFrames *Monochrome Screen Print*, palette ink
`#1A1714` / paper `#FAF6EC`, cell size about 0.2), a white sticker edge
(0.65cqmin), and a soft paper shadow.

- Each cutout names its file with `data-asset`. Its features (lens, flash,
  face) are fractions of the image in `assets/placeholder/anchors.json`;
  accents anchor to those names.
- Cut out with Apple Vision (subject lift). HyperFrames' `remove-background`
  is made for video portraits and fails on stills.

## Grid and depth

- **Grid:** 12 columns × 6 rows at 16:9, 4 × 8 at 9:16, inside the 90%
  action-safe box. Place with `class="g"` and `--c`/`--r`, size with
  `class="gs"` and `--cs`/`--rs`.
- **What snaps:** fields, blocks, labels and textures snap to the grid. Only
  cutouts and arrows may break it.
- **Depth:** every element has `data-depth`. It sets paint order now and
  parallax later.

| depth | Plane | Parallax factor (push-through only) |
| --- | --- | --- |
| 0 | Paper, textures, grid paper | 0.2× |
| 1 | Fields, numeral, sunburst | 0.5× |
| 2 | Cutouts | 1× |
| 3 | Type and accents | never transformed |

## Motion

Revised 29 Oct 2026 after the first sample: the background jitter and the
slow push-ins read as shaky and unpolished, and scaling text made it shimmer.

- **Frame rate: 24 fps.**
- **The camera holds still.** No drift, no push-in inside a beat. A landed
  frame is dead still; motion comes from elements being placed.
- **Camera moves are transitions, not ambience.** A push-through (the dive
  into a lens) or a reframe between two compositions: one eased move, then
  hold. Planes 0-2 move by their parallax factor; plane 3 stays put.
- **Text never scales.** Type is rendered at its final size and never takes
  a `scale` transform (subpixel re-rasterising makes glyph edges crawl).
  Text that must leave during a camera move is hidden first.
- **The paper boils; nothing jitters.** The organic feel comes from texture
  boil: the paper is swapped for another sheet of the same stock every
  `--boil-every` frames (3 = 8 swaps a second), in a seeded order, while
  everything stays exactly where it is (`components/paper-boil.js`). No
  translate/offset jitter on paper, accents or edges. Boil lives only in
  paper and texture layers, never on type, cutouts or data.
- **Placed, not tweened:** elements arrive over 2–3 held frames
  (`steps()`), like paper put down by hand.
- **Line boil (open):** a 1-2 px seeded displacement on hand-drawn strokes
  every 3 frames is allowed as an opt-in per stroke; not built yet. Try it
  on the arrow first, and only if the strokes look too dead.
- **Transitions,** each caused by something on screen:
  - **Match cut on shape:** the circle field becomes the lens; a swatch chip
    becomes the next field.
  - **Push through:** the camera dives into a detail (the lens, a negative
    frame, a swatch) and comes out in the next scene.
  - **Paper slide or wipe:** a new sheet slides in over the old one, or a
    paper edge wipes across.
  - **No crossfades.**
- **Pace is the narrator's:**
  - The VO is transcribed with Whisper (`media-use` skill) into
    `data/transcript.json`.
  - Each beat in `data/cues.json` starts on a word index, not a second.
  - The highlight lands on the stressed word; arrows and keeper marks draw
    on the word that names their target.
  - Nothing has a fixed duration. If the narration changes, the timing
    follows.

## Open

- Boil strength: `--boil-strength` (1 = the set's preset). Judge it on a
  real render at 1920 on a phone and a monitor; the noise should be felt,
  not seen.

- Lucas's own cutouts and contact sheets replace the public-domain
  placeholders.
- Sign-off on the Rare Stripe exception.
- A motion proof: 10–15 s on one of the frames, with a narration line.
