---
name: promote-component
description: Extract an element that appears in a second scene into components/<name>/, parameterise it, index it in COMPONENTS.md and replace every inline copy. Use when new-scene finds a duplicate, or Lucas asks to make something reusable.
---

# promote-component

The rule: **the second appearance makes a component.** The first stays inline.

## 1. Find every copy

`grep -rn` the element across `scenes/` and `brand/reference/`. List each
file and line range. Note how the copies differ: those differences become the
props.

## 2. Build `components/<name>/`

Components are **ES modules**, not HyperFrames `<template>` sub-compositions
(tested: those keep their own size inside a host and don't run module
scripts, so they break the one-file-three-ratios rule and JSON data).

- `index.js` exports `mount(container, props, tl, t0 = 0)`: builds its DOM
  inside `container`, adds its tweens to the scene's timeline `tl` at absolute
  times from `t0`, and returns anything the scene needs (e.g. a
  `renderAt(t)` for Three.js, which the scene calls from its `hf-seek`
  listener). Styles in `style.css`, linked by the scene.
- Scenes import it: `import { mount } from "./components/<name>/index.js";`
- **Props**: data, timing (start, duration scale) and token overrides. Read
  tokens with `getComputedStyle(container)`; never hard-code values.
- Size from the container (`cqw`/`cqh`/`cqmin`, or the container's measured
  box), never from 1920. It must work at 16:9, 9:16 and 1:1.
- `README.md`, 15 lines or fewer: what it is, its props with defaults, one mount example.

## 3. Index it

Add one line to `components/COMPONENTS.md`:

`name` — what it is — props — ratios

## 4. Replace every copy

Swap each inline copy for an embed. Then, for every touched scene:
stage it (`node scripts/stage.mjs <dir>`), `npm run check`, and
`npx hyperframes snapshot` at the same times before and after. The frames must match; any difference is a bug, unless
Lucas asked for the change.

## 5. Report

Which scenes changed, the props, and any visual difference found.
