#!/usr/bin/env node
// Stage one composition as the project's root index.html, at a given size.
//
//   node scripts/stage.mjs <composition-dir> [16x9|9x16|1x1] [--long-edge 1920]
//   node scripts/stage.mjs --pull
//
// HyperFrames' check, snapshot, preview and render all work on the project's
// index.html, and refuse paths that climb above the project root. So every
// composition lives in its own folder (scenes/<video>/<scene>/index.html),
// writes its paths from the repo root (brand/tokens.css,
// ./scenes/<video>/<scene>/data/x.json), and is copied to the root index.html
// to be worked on. The root index.html is generated and gitignored.
//
// Edits made in the HyperFrames app land in the root index.html. Staging
// refuses to overwrite them; --pull copies them back into the source file
// (at its authored 1920x1080).

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "..");
const INDEX = join(ROOT, "index.html");
const STATE = join(ROOT, ".stage.json");
const AUTHORED = [1920, 1080];
const BANNER = /<!-- STAGED from (\S+) by scripts\/stage\.mjs[^\n]*-->\n/;

export const RATIOS = {
  "16x9": (long) => [long, (long * 9) / 16],
  "9x16": (long) => [(long * 9) / 16, long],
  "1x1": (long) => [long, long],
};

const sha = (s) => createHash("sha256").update(s).digest("hex");

export function resize(html, w, h) {
  const root = /(data-composition-id="[^"]+"[^>]*?)data-width="\d+"([^>]*?)data-height="\d+"/;
  if (!root.test(html)) throw new Error("root element needs data-composition-id, data-width and data-height, in that order");
  return html
    .replace(root, `$1data-width="${w}"$2data-height="${h}"`)
    .replace(/<meta name="viewport" content="width=\d+, height=\d+"/, `<meta name="viewport" content="width=${w}, height=${h}"`);
}

function readState() {
  return existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null;
}

// True when the root index.html has edits that were never pulled back.
export function hasUnpulledEdits() {
  const state = readState();
  if (!existsSync(INDEX)) return false;
  if (!state) return true; // an index.html we didn't write
  return sha(readFileSync(INDEX, "utf8")) !== state.hash;
}

export function stage(dir, w, h, { force = false } = {}) {
  if (!force && hasUnpulledEdits()) {
    throw new Error("index.html has edits that were never pulled back. Run `node scripts/stage.mjs --pull` first (or delete index.html to discard them).");
  }
  const source = join(resolve(dir), "index.html");
  const rel = relative(ROOT, source);
  const banner = `<!-- STAGED from ${rel} by scripts/stage.mjs. Edit that file, not this one. -->\n`;
  const html = resize(readFileSync(source, "utf8"), w, h).replace(/^(<!doctype html>\n)/i, `$1${banner}`);
  writeFileSync(INDEX, html);
  writeFileSync(STATE, JSON.stringify({ source: rel, width: w, height: h, hash: sha(html) }, null, 2) + "\n");
  return rel;
}

export function pull() {
  const state = readState();
  if (!state || !existsSync(INDEX)) throw new Error("nothing staged");
  if (!hasUnpulledEdits()) return null;
  const html = readFileSync(INDEX, "utf8");
  const source = html.match(BANNER)?.[1] ?? state.source;
  writeFileSync(join(ROOT, source), resize(html.replace(BANNER, ""), ...AUTHORED));
  stage(join(ROOT, source, ".."), state.width, state.height, { force: true });
  return source;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  if (argv[0] === "--pull") {
    const source = pull();
    console.log(source ? `pulled edits back into ${source}` : "no edits to pull");
  } else {
    const [dir, ratio = "16x9"] = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--long-edge");
    const li = argv.indexOf("--long-edge");
    const long = li >= 0 ? Number(argv[li + 1]) : 1920;
    if (!dir || !RATIOS[ratio]) {
      console.error("usage: node scripts/stage.mjs <composition-dir> [16x9|9x16|1x1] [--long-edge 1920] | --pull");
      process.exit(2);
    }
    const [w, h] = RATIOS[ratio](long).map(Math.round);
    console.log(`staged ${stage(dir, w, h)} at ${w}x${h} as index.html`);
  }
}
