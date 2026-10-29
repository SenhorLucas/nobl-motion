// Collage system helpers (classic script, sets window.collage).
// The rules live in brand/collage/SYSTEM.md. The core one is enforced here:
// every accent needs an anchor (a named feature, a label element or a data
// point), and the call throws without one.
//
//   const c = collage.setup({ anchors });   // after document.fonts.ready;
//   anchors: assets/placeholder/anchors.json, imported as a JSON module
//   c.feature("camera", "taking-lens") -> [x, y] root px (named in anchors.json)
//   c.sunburst({ at, ... })  c.arrow({ from, to })  c.leader({ from, to })
//   c.ticks({ from, to, values, labels })  c.swatch({ sample, colour, label, at })  c.keeper({ around })
//   c.testStrip(el, opts)  c.negativeStrip(el, opts)
(function () {
  const NS = "http://www.w3.org/2000/svg";

  // Small deterministic PRNG (mulberry32) and a string hash for seeds.
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hash = (s) => [...String(s)].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7);

  function need(value, what) {
    if (value === undefined || value === null) throw new Error(`collage: ${what} needs an anchor (see brand/collage/SYSTEM.md)`);
    return value;
  }

  function setup({ anchors = {} } = {}) {
    const root = document.getElementById("root");
    const W = Number(root.dataset.width);
    const H = Number(root.dataset.height);
    const unit = Math.min(W, H) / 100; // px per cqmin
    const css = getComputedStyle(root);
    const tok = (name) => css.getPropertyValue(name).trim();

    // Sticker edge filter: 0.65cqmin of --surface white around every cutout.
    const defs = document.createElementNS(NS, "svg");
    defs.setAttribute("width", 0);
    defs.setAttribute("height", 0);
    defs.style.position = "absolute";
    defs.innerHTML = `<filter id="sticker" x="-10%" y="-10%" width="120%" height="120%">
      <feMorphology in="SourceAlpha" operator="dilate" radius="${(0.65 * unit).toFixed(1)}" result="grown" />
      <feFlood flood-color="${tok("--surface")}" result="white" />
      <feComposite in="white" in2="grown" operator="in" result="edge" />
      <feMerge><feMergeNode in="edge" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>`;
    document.body.append(defs);

    // Accents draw into one SVG on the type/accent depth plane.
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "accents");
    svg.setAttribute("data-depth", "3");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    root.append(svg);
    // One extra SVG per depth plane, made on first use (e.g. light behind a cutout).
    const planes = { 3: svg };
    const plane = (depth) => {
      if (!planes[depth]) {
        const p = document.createElementNS(NS, "svg");
        p.setAttribute("class", "accents");
        p.setAttribute("data-depth", String(depth));
        p.setAttribute("viewBox", `0 0 ${W} ${H}`);
        root.append(p);
        planes[depth] = p;
      }
      return planes[depth];
    };
    const add = (tag, attrs, parent = svg) => {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      parent.append(el);
      return el;
    };

    const rr = root.getBoundingClientRect();
    const scale = rr.width / root.offsetWidth || 1;
    const $ = (el) => (typeof el === "string" ? document.getElementById(el) : el);
    const box = (el) => {
      const r = $(el).getBoundingClientRect();
      return { x: (r.left - rr.left) / scale, y: (r.top - rr.top) / scale, w: r.width / scale, h: r.height / scale };
    };
    // Root px of a point given as fractions of an element's own box, through
    // any CSS transform on it (tilted cutouts): a marker reports its position.
    const at = (el, fx, fy) => {
      const host = $(el);
      const m = document.createElement("i");
      m.style.cssText = `position:absolute;left:${fx * 100}%;top:${fy * 100}%;width:0;height:0`;
      host.append(m);
      const b = box(m);
      m.remove();
      return [b.x, b.y];
    };
    // A named feature of a cutout, from anchors.json.
    const feature = (el, name) => {
      // Named by data-asset on the cutout (the bundler inlines img src as data URIs).
      const file = need($(el).dataset.asset, `data-asset on cutout #${$(el).id}`);
      const f = need(anchors[file]?.[name], `feature "${name}" of ${file}`);
      return at(el, f[0], f[1]);
    };

    const red = tok("--kodachrome-red");
    const ink = tok("--leader-black");

    // ---------- Accents ----------

    // Light: rays from a light source or optical point.
    // Default depth 1: behind the cutouts, so the light surrounds its source.
    function sunburst({ at: p, rays = 48, inner = 7, outer = [20, 26], colour = red, width = 0.35, depth = 1 }) {
      need(p, "sunburst");
      const g = add("g", { class: "sunburst" }, plane(depth));
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2;
        const r1 = (i % 2 ? outer[0] : outer[1]) * unit;
        add("line", { x1: p[0] + inner * unit * Math.cos(a), y1: p[1] + inner * unit * Math.sin(a), x2: p[0] + r1 * Math.cos(a), y2: p[1] + r1 * Math.sin(a), stroke: colour, "stroke-width": width * unit, "stroke-linecap": "round" }, g);
      }
      return g;
    }

    // A hand-drawn marker stroke: variable width, tapered ends, slight wobble.
    function handStroke(points, { w0 = 0.15, w1 = 0.75, colour = red, seed = 1 } = {}) {
      const r = rng(seed);
      const ph = [r() * 6.28, r() * 6.28];
      const n = points.length;
      const left = [], right = [];
      for (let i = 0; i < n; i++) {
        const [x, y] = points[i];
        const [xa, ya] = points[Math.max(0, i - 1)];
        const [xb, yb] = points[Math.min(n - 1, i + 1)];
        const tx = xb - xa, ty = yb - ya;
        const l = Math.hypot(tx, ty) || 1;
        const nx = -ty / l, ny = tx / l;
        const t = i / (n - 1);
        const wobble = (Math.sin(t * 7 + ph[0]) * 0.22 + Math.sin(t * 19 + ph[1]) * 0.1) * unit;
        const w = (w0 + (w1 - w0) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.6)) * unit / 2;
        left.push([x + nx * (w + wobble), y + ny * (w + wobble)]);
        right.push([x - nx * (w - wobble), y - ny * (w - wobble)]);
      }
      const d = "M" + [...left, ...right.reverse()].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z";
      return add("path", { d, fill: colour });
    }

    // Label -> exact feature. Starts on the label edge facing the target,
    // bends away from the text, ends just short of the feature.
    function arrow({ from, to, bend = 0.22, colour = red, seed }) {
      const lb = box(need(from, "arrow (from label)"));
      need(to, "arrow (to feature)");
      const c0 = [lb.x + lb.w / 2, lb.y + lb.h / 2];
      const dx = to[0] - c0[0], dy = to[1] - c0[1];
      const ex = Math.abs(dx) > 1e-6 ? lb.w / 2 / Math.abs(dx) : Infinity;
      const ey = Math.abs(dy) > 1e-6 ? lb.h / 2 / Math.abs(dy) : Infinity;
      const k = Math.min(ex, ey);
      const gap = 1.4 * unit;
      const len0 = Math.hypot(dx, dy);
      const s = [c0[0] + dx * k + (dx / len0) * gap, c0[1] + dy * k + (dy / len0) * gap];
      const e = [to[0] - (dx / len0) * gap, to[1] - (dy / len0) * gap];
      const len = Math.hypot(e[0] - s[0], e[1] - s[1]);
      const m = [(s[0] + e[0]) / 2 + ((e[1] - s[1]) / len) * len * bend, (s[1] + e[1]) / 2 - ((e[0] - s[0]) / len) * len * bend];
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        pts.push([(1 - t) ** 2 * s[0] + 2 * (1 - t) * t * m[0] + t * t * e[0], (1 - t) ** 2 * s[1] + 2 * (1 - t) * t * m[1] + t * t * e[1]]);
      }
      const sd = seed ?? hash($(from).id + to.join());
      const g = add("g", { class: "arrow" });
      g.append(handStroke(pts, { colour, seed: sd }));
      const ang = Math.atan2(e[1] - m[1], e[0] - m[0]);
      const head = 2.8 * unit;
      for (const side of [-0.5, 0.42]) {
        const hx = e[0] - head * Math.cos(ang + side), hy = e[1] - head * Math.sin(ang + side);
        const hp = [];
        for (let i = 0; i <= 8; i++) { const t = i / 8; hp.push([hx + (e[0] - hx) * t, hy + (e[1] - hy) * t]); }
        g.append(handStroke(hp, { colour, seed: sd + (side > 0 ? 3 : 5), w0: 0.25, w1: 0.55 }));
      }
      return g;
    }

    // Hairline connecting a label (or point) to a target, with a dot on it.
    function leader({ from, to, colour = ink, dot = true }) {
      need(from, "leader (from)"); need(to, "leader (to)");
      let p0 = from;
      if (!Array.isArray(from)) {
        const b = box(from);
        p0 = [to[0] < b.x ? b.x : to[0] > b.x + b.w ? b.x + b.w : b.x + b.w / 2, to[1] < b.y ? b.y : to[1] > b.y + b.h ? b.y + b.h : b.y + b.h / 2];
      }
      const g = add("g", { class: "leader" });
      add("line", { x1: p0[0], y1: p0[1], x2: to[0], y2: to[1], stroke: colour, "stroke-width": 0.18 * unit }, g);
      if (dot) add("circle", { cx: to[0], cy: to[1], r: 0.6 * unit, fill: colour }, g);
      return g;
    }

    // A scale that measures something real: ticks along from->to at the
    // given values (mapped linearly by `domain`), labelled.
    function ticks({ from, to, domain, values, labels = values.map(String), minor = [], colour = red }) {
      need(from, "ticks (from)"); need(to, "ticks (to)"); need(domain, "ticks (domain)");
      const g = add("g", { class: "ticks" });
      const pos = (v) => { const t = (v - domain[0]) / (domain[1] - domain[0]); return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]; };
      const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const nx = -(to[1] - from[1]) / len, ny = (to[0] - from[0]) / len;
      add("line", { x1: from[0], y1: from[1], x2: to[0], y2: to[1], stroke: colour, "stroke-width": 0.22 * unit }, g);
      const tick = (v, l) => { const [x, y] = pos(v); add("line", { x1: x, y1: y, x2: x + nx * l * unit, y2: y + ny * l * unit, stroke: colour, "stroke-width": 0.22 * unit }, g); };
      minor.forEach((v) => tick(v, 1));
      values.forEach((v, i) => {
        tick(v, 2);
        const [x, y] = pos(v);
        const t = add("text", { x: x + nx * 4.6 * unit, y: y + ny * 4.6 * unit + 0.9 * unit, "text-anchor": "middle", class: "scale-label" }, g);
        t.textContent = labels[i];
      });
      return g;
    }

    // A sampled colour: chip with its value, and a leader to where it was sampled.
    function swatch({ sample, colour, label, at: p, size = 5 }) {
      need(sample, "swatch (sample point)");
      const s = size * unit;
      const g = add("g", { class: "swatch" });
      leader({ from: [p[0] + s / 2, p[1]], to: sample });
      add("rect", { x: p[0], y: p[1] - s, width: s, height: s, fill: colour, stroke: tok("--surface"), "stroke-width": 0.5 * unit }, g);
      const t = add("text", { x: p[0] + s + 1.2 * unit, y: p[1] - 0.8 * unit, class: "swatch-label" }, g);
      t.textContent = label;
      return g;
    }

    // ---------- Textures (generated, the photographer's desk) ----------

    // An enlarger test strip: exposure doubles per band (one stop each). Tone
    // follows a sigmoid paper curve (density vs log exposure); reflectance
    // 10^-D is sRGB-encoded for display.
    function testStrip(el, { base = 2, steps = 6, dmin = 0.07, dmax = 2.0, k = 3.6 } = {}) {
      const host = $(el);
      host.classList.add("test-strip");
      const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
      const mid = ((steps - 1) / 2) * Math.log10(2);
      for (let i = 0; i < steps; i++) {
        const logE = i * Math.log10(2);
        const D = dmin + (dmax - dmin) / (1 + Math.exp(-k * (logE - mid) * 1.5));
        const v = Math.round(255 * enc(Math.pow(10, -D)));
        const band = document.createElement("div");
        band.style.background = `rgb(${v},${Math.round(v * 0.985)},${Math.round(v * 0.955)})`;
        const lab = document.createElement("span");
        lab.textContent = `${base * 2 ** i}s`;
        lab.style.color = v > 130 ? tok("--ink") : tok("--leader-cream");
        band.append(lab);
        host.append(band);
      }
    }

    // A negative strip: film base, perforations, frame numbers. Frames hold
    // an inverted screen-printed copy of an image if given.
    function negativeStrip(el, { frames = 4, start = 12, src = null, holes = 22 } = {}) {
      const host = $(el);
      host.classList.add("negative-strip");
      const perf = () => {
        const p = document.createElement("div");
        p.className = "perfs";
        for (let i = 0; i < holes; i++) p.append(document.createElement("i"));
        return p;
      };
      host.append(perf());
      const row = document.createElement("div");
      row.className = "frames";
      const list = [];
      for (let i = 0; i < frames; i++) {
        const f = document.createElement("div");
        f.className = "frame";
        if (src && i % 2 === 0) {
          const im = document.createElement("img");
          im.src = src;
          im.setAttribute("data-color-grading", JSON.stringify({ intensity: 1, effects: { monoScreen: 1, monoScreenSize: 0.2, monoScreenAngle: 0.25, monoScreenSpread: 0.3, monoScreenShape: 0, monoScreenInvert: 1 }, palette: [tok("--darkroom-raised"), tok("--paper-well")] }));
          f.append(im);
        }
        const n = document.createElement("span");
        n.textContent = i % 2 ? `${start + (i >> 1)}A` : `${start + (i >> 1)}`;
        f.append(n);
        row.append(f);
        list.push(f);
      }
      host.append(row);
      host.append(perf());
      return list;
    }

    // Keeper mark: the red grease-pencil box drawn around the chosen frame
    // on a contact sheet. Anchor: the frame it keeps.
    function keeper({ around, colour = red, pad = 1.2, seed }) {
      const b = box(need(around, "keeper (frame)"));
      const r = rng(seed ?? hash($(around).textContent));
      const p = pad * unit;
      const j = () => (r() - 0.5) * 1.2 * unit;
      const c4 = [[b.x - p + j(), b.y - p + j()], [b.x + b.w + p + j(), b.y - p + j()], [b.x + b.w + p + j(), b.y + b.h + p + j()], [b.x - p + j(), b.y + b.h + p + j()]];
      const pts = [];
      for (let k = 0; k <= 4; k++) {
        const a = c4[k % 4], z = c4[(k + 1) % 4];
        const steps = k === 4 ? 4 : 14; // overshoot past the first corner, like a hand closing the box
        for (let i = 0; i < steps; i++) { const t = i / 14; pts.push([a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t]); }
      }
      return handStroke(pts, { colour, seed: (seed ?? 3) + 1, w0: 0.35, w1: 0.7 });
    }

    return { root, W, H, unit, tok, svg, add, box, at, feature, sunburst, arrow, leader, ticks, swatch, keeper, testStrip, negativeStrip };
  }

  window.collage = { setup };
})();
