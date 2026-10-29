---
name: learn-from-luke
description: Turn feedback from Lucas into a durable rule in the right layer (tokens, motion, signatures, a component, a skill or CLAUDE.md) so he never has to give it twice. Use when Lucas corrects a look, timing or habit, especially the second time, or says "always"/"never"/"remember".
---

# learn-from-luke

Feedback that only fixes one scene gets forgotten. Feedback that **repeats**,
or that Lucas states as a rule, gets written down where the next task will
read it.

## 1. Decide if it is a rule

- Second time the same correction comes up, or Lucas says always / never /
  from now on: it is a rule.
- A one-off taste call for this scene: fix the scene only, don't write a rule.
- Not sure: ask in one line ("Rule for all scenes, or just this one?").

## 2. Pick the layer, the narrowest that covers it

| Feedback is about | Write it in |
| --- | --- |
| A value: colour, size, easing, duration, spacing | `brand/tokens.css` (change or add the token) |
| How things move: pacing, holds, transitions | `brand/motion.md` |
| A recurring detail to include | `brand/signatures.md` (one line) |
| How one component behaves | `components/<name>/` + its README |
| How a workflow runs (scaffold, render, check) | that skill's `SKILL.md` |
| Applies to every task | `CLAUDE.md` (keep it ≤ 50 lines; move detail out) |

## 3. Write it

- One line where possible, in Lucas's terms, with the reason if he gave it.
- Change the existing line if one covers it; don't add a second, conflicting one.
- Apply it to the current scene too, and grep for other scenes it affects.
  List them; don't change them silently.

## 4. Record

Add a line to today's lucas-os journal (`../../journal/YYYY-MM-DD.md`,
under "Decisions") naming the rule and the file it went into. Then tell Lucas
what changed and where, and that it is uncommitted.
