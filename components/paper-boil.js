// paper-boil: the paper of a scene, alive without moving.
//
// Shows one sheet of a boil-texture set (assets/textures/<id>/) at a time and
// swaps to another sheet every --boil-every frames, in a seeded order that
// never shows the same sheet twice in a row. Nothing translates, scales or
// jitters: the fibres change, the frame stays still. Every frame is a
// function of time (hf-seek), so renders are deterministic.
//
//   import paper from "./assets/textures/paper-black-12/manifest.json" with { type: "json" };
//   import { paperBoil } from "./components/paper-boil.js";
//   paperBoil(document.getElementById("paper"), { manifest: paper });
//
// The element is the ground: paperBoil paints it (--paper for ground
// "light", --darkroom for "dark") and blends the texture into it, so it works
// inside transformed planes too. Put it at depth 0, under everything; the
// boil is never laid over cutouts, type or data.
//
// Options:
//   manifest  the set's manifest.json (imported as a JSON module)
//   ground    "light" (multiply a lifted texture) | "dark" (screen a lowered one)
//   strength  0..1, scales the preset; default the --boil-strength token
//   seed      changes the sheet order (two boils in one frame should differ)
//   tier      "master" | "web"; default master above a 1920 long edge
//
// Returns { frames, every, sheetAt(frame) }.

const GROUND = { light: "--paper", dark: "--darkroom" };
const IDENTITY = { multiply: 1, screen: 0 }; // texture value that leaves the ground unchanged

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function token(css, name) {
  const v = css.getPropertyValue(name).trim();
  if (!v) throw new Error(`paper-boil: missing token ${name} in brand/tokens.css`);
  return v;
}

export function paperBoil(el, { manifest, ground = "light", strength, seed = 1, tier } = {}) {
  if (!el) throw new Error("paper-boil: no element");
  if (manifest?.kind !== "boil-texture") throw new Error("paper-boil: pass a boil-texture manifest");
  const preset = manifest.presets?.[ground];
  if (!preset || !(preset.blend in IDENTITY)) throw new Error(`paper-boil: no usable "${ground}" preset in ${manifest.id}`);
  if (manifest.normalised.mean !== 0.5) throw new Error("paper-boil: expects sheets normalised to mean 0.5");

  const root = el.closest("[data-composition-id]");
  const W = Number(root.dataset.width), H = Number(root.dataset.height);
  const fps = Number(root.dataset.fps) || 24;
  const css = getComputedStyle(root);
  const every = Number(token(css, "--boil-every"));
  const s = strength ?? Number(token(css, "--boil-strength"));
  const n = manifest.frames;

  // Remap the normalised sheet (mean 0.5, sd manifest.normalised.std) to the
  // preset's mean and spread, scaled towards "no change" by strength:
  //   x' = m + (x - 0.5) * k   ==   brightness(2m) after contrast(k / 2m)
  const id = IDENTITY[preset.blend];
  const m = id + (preset.mean - id) * s;
  const k = (preset.spread * s) / manifest.normalised.std;
  const filter = m > 0 ? `contrast(${(k / (2 * m)).toFixed(4)}) brightness(${(2 * m).toFixed(4)})` : "brightness(0)";

  // Landscape sheets are turned a quarter for portrait frames, so they cover
  // the frame without being enlarged.
  const t = tier ?? (Math.max(W, H) > 1920 ? "master" : "web");
  const [sw, sh] = manifest[t].size;
  const turn = (sw > sh) !== (W > H) && W !== H;
  const base = `assets/textures/${manifest.id}/`;

  el.style.background = `var(${GROUND[ground]})`;
  el.style.overflow = "hidden";
  el.style.isolation = "isolate";
  const imgs = Array.from({ length: n }, (_, i) => {
    const img = document.createElement("img");
    img.src = base + manifest[t].pattern.replace("%02d", String(i + 1).padStart(2, "0"));
    img.alt = "";
    Object.assign(img.style, {
      position: "absolute", left: "50%", top: "50%",
      width: turn ? "100cqh" : "100cqw", height: turn ? "100cqw" : "100cqh",
      objectFit: "cover", translate: "-50% -50%", rotate: turn ? "90deg" : "0deg",
      mixBlendMode: preset.blend, filter, visibility: "hidden",
    });
    el.append(img);
    return img;
  });

  // Sheet order: a seeded shuffle per cycle of n swaps; a cycle never starts
  // on the sheet the previous one ended on.
  const cycles = new Map();
  const cycle = (c) => {
    if (cycles.has(c)) return cycles.get(c);
    const r = mulberry32(seed * 7919 + c * 104729);
    const p = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    if (c > 0 && p[0] === cycle(c - 1)[n - 1]) [p[0], p[1]] = [p[1], p[0]];
    cycles.set(c, p);
    return p;
  };
  const sheetAt = (frame) => { const swap = Math.floor(Math.max(0, frame) / every); return cycle(Math.floor(swap / n))[swap % n]; };

  let shown = -1;
  const show = (time) => {
    const i = sheetAt(Math.round(time * fps));
    if (i === shown) return;
    if (shown >= 0) imgs[shown].style.visibility = "hidden";
    imgs[i].style.visibility = "visible";
    shown = i;
  };
  show(0);
  window.addEventListener("hf-seek", (e) => show(e.detail.time));
  return { frames: n, every, sheetAt };
}
