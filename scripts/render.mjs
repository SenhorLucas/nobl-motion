#!/usr/bin/env node
// Render one composition at every requested ratio from its single index.html.
//
//   node scripts/render.mjs <composition-dir> [--ratios 16x9,9x16,1x1]
//        [--long-edge 1920|3840] [--quality draft|looks|delivery]
//
// For each ratio it stages the composition as the root index.html at the
// target size (scripts/stage.mjs), renders it, and checks the output's colour
// tags with ffprobe. It leaves the composition staged at 16:9 afterwards.
//
// Output: renders/<video>_<scene>_<ratio>_<width>_v<n>.mp4. All ratios from one
// run share the same <n>. Rendering brand/reference/colour-check also runs the
// patch comparison (scripts/colour_check.py) on every output.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { RATIOS, ROOT, stage } from "./stage.mjs";

const HYPERFRAMES = "hyperframes@0.8.212";
const RENDERS = join(ROOT, "renders");
const PATCH_CHECK = join("brand", "reference", "colour-check");

// Every delivery must carry these. FFmpeg defaults RGB->YUV to the BT.601
// matrix, which shifts hues; HyperFrames sets 709 explicitly, and this guards it.
const EXPECTED_TAGS = {
  color_space: "bt709",
  color_primaries: "bt709",
  color_transfer: "bt709",
  color_range: "tv",
};

function parseArgs(argv) {
  const args = { ratios: Object.keys(RATIOS), longEdge: 1920, quality: "delivery" };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--ratios") args.ratios = argv[++i].split(",");
    else if (a === "--long-edge") args.longEdge = Number(argv[++i]);
    else if (a === "--quality") args.quality = argv[++i];
    else rest.push(a);
  }
  if (rest.length !== 1) {
    console.error("usage: node scripts/render.mjs <composition-dir> [--ratios 16x9,9x16,1x1] [--long-edge 1920|3840] [--quality delivery]");
    process.exit(2);
  }
  args.dir = resolve(rest[0]);
  for (const r of args.ratios) if (!RATIOS[r]) throw new Error(`unknown ratio ${r}; use ${Object.keys(RATIOS).join(", ")}`);
  return args;
}

// scenes/<video>/<scene> -> [video, scene]; anything else (e.g.
// brand/reference/brand-card) -> [first segment, last segment].
function names(dir) {
  const parts = relative(ROOT, dir).split(sep);
  if (parts[0] === "scenes" && parts.length === 3) return [parts[1], parts[2]];
  return [parts[0], parts[parts.length - 1]];
}

function nextVersion(prefix) {
  if (!existsSync(RENDERS)) return 1;
  const re = new RegExp(`^${prefix}_[0-9x]+_\\d+_v(\\d+)\\.mp4$`);
  const versions = readdirSync(RENDERS).map((f) => f.match(re)?.[1]).filter(Boolean).map(Number);
  return versions.length ? Math.max(...versions) + 1 : 1;
}

function checkTags(file) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", `stream=${Object.keys(EXPECTED_TAGS).join(",")}`,
    "-of", "json", file,
  ]);
  const stream = JSON.parse(out).streams[0];
  let ok = true;
  for (const [k, v] of Object.entries(EXPECTED_TAGS)) {
    if (stream[k] !== v) ok = false;
    console.log(`  ${k}=${stream[k]}${stream[k] === v ? "" : `  <-- expected ${v}`}`);
  }
  return ok;
}

const args = parseArgs(process.argv.slice(2));
const [video, scene] = names(args.dir);
const prefix = `${video}_${scene}`;
const version = nextVersion(prefix);
mkdirSync(RENDERS, { recursive: true });

let failed = false;
try {
  for (const ratio of args.ratios) {
    const [w, h] = RATIOS[ratio](args.longEdge).map(Math.round);
    const out = join(RENDERS, `${prefix}_${ratio}_${w}_v${version}.mp4`);
    stage(args.dir, w, h);
    console.log(`\n${relative(ROOT, out)}  (${w}x${h}, ${args.quality})`);
    const r = spawnSync("npx", ["--yes", HYPERFRAMES, "render", ".", "-o", out, "-q", args.quality, "--strict", "--quiet"], { cwd: ROOT, stdio: "inherit" });
    if (r.status !== 0) { failed = true; continue; }
    if (!checkTags(out)) failed = true;
    if (relative(ROOT, args.dir) === PATCH_CHECK) {
      const c = spawnSync("uv", ["run", "--quiet", "scripts/colour_check.py", out], { cwd: ROOT, stdio: "inherit", env: { ...process.env, PYTHONWARNINGS: "ignore" } });
      if (c.status !== 0) failed = true;
    }
  }
} finally {
  stage(args.dir, ...RATIOS["16x9"](1920));
}
process.exit(failed ? 1 : 0);
