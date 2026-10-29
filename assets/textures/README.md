# Textures

Boil-texture sets: several sheets of one material (paper, later film grain),
prepared so they can be swapped every few frames without flicker. Used by
`components/paper-boil.js`.

## For Claude Code

- Read a set's `manifest.json` and look at its `contact.jpg`. Never open the
  frames themselves (they are 5-15 MB each).
- Use the set's presets through the component; don't hand-tune blend modes
  or opacity in a scene. Strength goes through `--boil-strength`.

## Sets

| id | Sheets | What it looks like | Licence |
| --- | --- | --- | --- |
| `paper-black-12` | 12 | Black art paper, fine even fibres (default) | unknown: private renders only until checked |
| `paper-construction-31` | 31 | Construction paper, coarser and blotchier (from a stop-motion loop) | PremiumBeat free asset: use in videos, no redistribution |

## Making a set

    python3 scripts/prepare_textures.py <folder-or-video> --id <name>-<count> \
        --licence "..." --origin "..." [--own] [--notes "..."]
    python3 scripts/prepare_textures.py --rebuild <id>

Each sheet becomes luma, is flattened (lighting falloff removed) and is
normalised to mean 0.5 and standard deviation 0.1, so the sheets match each
other and any set works on any ground. Output: `master/` (full resolution,
for 3840 renders), `web/` (short edge 1440, for 1920 renders and the
website), `contact.jpg` and `manifest.json`. A video source keeps only its
distinct frames (stop-motion loops hold each one for several frames).

Own material: shoot or scan 4-12 sheets of one stock under identical light
(or crop one big scan into sheets) and pass `--own`.

## Git

The raw sources stay outside the repo; the manifest records their path.

- **Third-party sets:** only `manifest.json` is tracked (each set has its own
  `.gitignore`). Their licences allow use in renders, not redistribution, and
  this repo is on GitHub. Rebuild them from the source with `--rebuild`.
- **Own sets (`--own`):** `web/`, `contact.jpg` and the manifest are tracked;
  `master/` is regenerated.
