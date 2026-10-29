# Motion

Status: **draft. The open decisions (below) need Lucas.** The sources say
almost nothing about video motion; the store's one rule is for UI.

## From the sources (settled)

- **No bounce, overshoot or looping motion.** UI state changes are short
  (about 150 ms) transforms and colour fades. (store DESIGN.md)
- **Kodachrome soul, modern skeleton.** Neither half wins: a scene that reads
  as retro pastiche has lost the skeleton; one that reads as a SaaS promo has
  lost the soul. (store DESIGN.md)
- **Quiet chrome, loud images.** The photograph or the figure is always larger
  than what frames it; motion serves it and stays out of its way.
- **Data is not styling.** Computed colours (swatches, gamut points, patches)
  are shown exactly as computed, never eased through a token colour, never
  blended with a warm ground. Inside a figure the ground is neutral
  (`--viz-ground`). (Luke's Lab DESIGN.md)

## Working defaults (HyperFrames craft notes, adopted until a reason not to)

- Arrive slow, leave clean: exits about half the length of entrances.
- A landed title is dead still; the motion moves elsewhere.
- Overlap: the next element starts when the previous is 30-50% done.
- Read holds: `--hold-base` + `--hold-per-word` x words; the last line ≥ 2 s.
- 3-5 transition kinds per video, each caused by something on screen.
- Nothing a viewer reads is smaller than 2.6cqmin (28 px at 1080): the phone
  floor `hyperframes check` enforces.
- A reel's first frame is its thumbnail on social players: the title or key
  image is already on screen at 0 s. (Scenes inside a long video may develop
  in from nothing; the brand card does.)

## Open decisions

### 1. Easing character

| Option | Feel | Tokens |
| --- | --- | --- |
| **A. Darkroom calm** (in tokens now) | Long soft landings, nothing snaps. Matches "quiet". | enter `power3.out`, move `power2.inOut`, exit `power2.in` |
| B. Film transport | Mechanical and crisp: fast starts and hard stops, like a camera advancing a frame. Good for technical scenes. | enter `expo.out`, move `expo.inOut`, exit `power3.in` |
| C. Split by kind | A for artistic scenes, B for technical ones. | two sets: `--ease-*-art`, `--ease-*-tech` |

### 2. Pace

| Option | Enter / move / develop | Notes |
| --- | --- | --- |
| **A. Measured** (in tokens now) | 0.7 / 0.9 / 1.8 s | Tutorial pace; text has time to be read. |
| B. Brisk | 0.45 / 0.6 / 1.2 s | Reels pace; closer to HyperFrames' measured launch films. |
| C. Per format | A for long-form, B for reels | A `--pace` multiplier token set per render. |

### 3. Transition vocabulary (pick 3-5)

The photographic process gives transitions with a cause, unique to us:

- **Develop**: the next image comes up from the paper colour like a print in
  the tray (`--dur-develop`, `--ease-develop`). Proposed signature.
- **Film advance**: a horizontal move with a frame line between frames, like
  a strip through the gate. Hard ease (option B), fast.
- **Enlarger focus**: blur → sharp with a slight scale settle, as if focusing
  the grain on the easel. For reveals of a single image.
- **Safelight dip**: the outgoing frame darkens to `--darkroom` (with a faint
  red cast?) for 3 frames before a cut. A dip cut in brand colour.
- **Stripe wipe**: the four Kodachrome bands sweep across and leave the next
  scene. Risk: breaks the Rare Stripe Rule if overused; at most once a video.
- Plain cuts inside a scene; no crossfades between worlds (paper ↔ darkroom).

### 4. Ground for video

- A. **Darkroom by default** (images glow; YouTube is mostly dark-mode),
  paper for explanatory diagram scenes.
- B. Paper by default, darkroom for photographs, as on the store.

### 5. Grain on motion

- The store has a static SVG grain (0.18, overlay), currently turned off on
  the hero. On video, static grain reads as dirt on the lens; moving grain
  has to be seeded per frame (deterministic).
- A. None. B. Seeded per-frame grain on darkroom scenes only, at
  `--grain-opacity`. C. Real film grain from `colr` baked into image assets,
  none on graphics.

### 6. Data type

- A. Outfit with tabular numerals everywhere (store rule: one face).
- B. JetBrains Mono for numbers, codes and axis ticks (Lab rule). It is
  bundled in HyperFrames.
