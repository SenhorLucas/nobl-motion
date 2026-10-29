# Components

One line per component: `name` — what it is — props — ratios. A component is
made on an element's second appearance (`promote-component`); registry blocks
installed with `npx hyperframes add` are listed here too once a scene uses them.

- `paper-boil` (`components/paper-boil.js`) — the scene's paper: cycles a boil-texture set's sheets every `--boil-every` frames, never moves — `manifest`, `ground` light|dark, `strength`, `seed`, `tier` — all ratios (turns landscape sheets for 9:16).
