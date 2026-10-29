#!/usr/bin/env python3
"""Turn a raw texture source into a boil-texture set under assets/textures/.

    python3 scripts/prepare_textures.py <source> --id paper-black-12 \
        --licence "..." [--origin "..."] [--own] [--notes "..."]
    python3 scripts/prepare_textures.py --rebuild paper-black-12

<source> is a folder of images (one sheet per file) or a video. A video's
held frames are collapsed: only frames that differ from the previous one
become sheets (stop-motion loops hold each drawing for 2-4 frames).

Every sheet is made the same way, so a set can be cycled without flicker:
  1. luma (Rec.709 weights on the code values), as single-channel grey;
  2. flattened: large-scale shading (lighting falloff, vignette, folds wider
     than --flatten x long edge) is removed, so only the paper's own
     structure is left;
  3. normalised to mean 0.5 and standard deviation 0.1 (code values / 255),
     per sheet, so no sheet is brighter or busier than another.
How strongly the texture shows, and how it blends, is decided where it is
used (components/paper-boil.js, from the manifest's presets), not here.

Output, in assets/textures/<id>/:
  master/NN.png   full resolution (long edge up to 5120), lossless
  web/NN.webp     short edge 1440, for 1920 renders and the website
  contact.jpg     one small grid of sheets: look at this, not the frames
  manifest.json   what the set is, where it came from, how to use it
  .gitignore      third-party sets: everything except the manifest;
                  own sets (--own): only master/

The raw source stays outside the repo; the manifest records its path, so
--rebuild <id> remakes the set after a change to this script.

Needs numpy and Pillow (and ffmpeg for video sources).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TEXTURES = ROOT / "assets" / "textures"

MEAN, STD = 0.5, 0.1          # every sheet is normalised to this
MASTER_MAX = 5120             # long edge cap for master/
WEB_SHORT = 1440              # short edge for web/
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"}
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm"}

# How the texture is shown on each ground (read by components/paper-boil.js).
# On near-white paper only darkening shows (soft-light/overlay barely touch
# values near 1), so the light preset multiplies a texture lifted towards
# white; the dark preset screens one pushed towards black. mean/spread are
# the remapped texture's mean and standard deviation, 0..1.
PRESETS = {
    "light": {"blend": "multiply", "mean": 0.97, "spread": 0.022},
    "dark": {"blend": "screen", "mean": 0.03, "spread": 0.018},
}
SWAP_NOTE = "Swap cadence is the --boil-every token (brand/tokens.css), not per set."


def luma(im: Image.Image) -> np.ndarray:
    """Single-channel float luma, 0..1, from any PIL image."""
    if im.mode in ("I;16", "I;16B", "I"):
        a = np.asarray(im, dtype=np.float32)
        return a / (65535.0 if a.max() > 255 else 255.0)
    rgb = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0
    return rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


def fit(a: np.ndarray, long_edge: int) -> np.ndarray:
    h, w = a.shape
    s = long_edge / max(h, w)
    if s >= 1:
        return a
    im = Image.fromarray(a, mode="F").resize((round(w * s), round(h * s)), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32)


def flatten(a: np.ndarray, frac: float) -> np.ndarray:
    """Remove shading wider than frac x long edge (blurred at 1/8 size)."""
    if frac <= 0:
        return a - a.mean()
    h, w = a.shape
    k = 8
    small = np.asarray(Image.fromarray(a, mode="F").resize((max(1, w // k), max(1, h // k)), Image.BOX))
    low = gaussian(small, frac * max(h, w) / k)
    low = Image.fromarray(low.astype(np.float32), mode="F").resize((w, h), Image.BILINEAR)
    return a - np.asarray(low, dtype=np.float32)


def gaussian(a: np.ndarray, sigma: float) -> np.ndarray:
    """Separable Gaussian blur with edge padding (small images only)."""
    r = max(1, int(3 * sigma))
    x = np.arange(-r, r + 1)
    k = np.exp(-0.5 * (x / sigma) ** 2)
    k /= k.sum()
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (r, r)
        b = np.pad(a, pad, mode="reflect" if a.shape[axis] > r else "edge")
        a = np.apply_along_axis(lambda v: np.convolve(v, k, mode="valid"), axis, b)
    return a


def normalise(a: np.ndarray) -> np.ndarray:
    a = a - a.mean()
    s = a.std()
    return np.clip(MEAN + a * (STD / s if s > 0 else 0), 0, 1)


def to8(a: np.ndarray) -> Image.Image:
    return Image.fromarray(np.round(a * 255).astype(np.uint8), mode="L")


def sheets_from_folder(src: Path):
    files = sorted(p for p in src.iterdir() if p.suffix.lower() in IMAGE_EXT and not p.name.startswith("."))
    if not files:
        sys.exit(f"no images in {src}")
    for f in files:
        yield f.name, luma(Image.open(f))


def sheets_from_video(src: Path, threshold: float):
    """Decode every frame; keep a frame only when it differs from the last kept one."""
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-vsync", "0", f"{tmp}/%05d.bmp"], check=True)
        last = None
        for f in sorted(Path(tmp).glob("*.bmp")):
            a = luma(Image.open(f))
            h, w = (d // 8 * 8 for d in a.shape)
            probe = a[:h, :w].reshape(h // 8, 8, w // 8, 8).mean((1, 3))  # block means: ignore codec noise
            if last is not None and np.abs(probe - last).mean() * 255 < threshold:
                continue
            last = probe
            yield f.name, a


def contact_sheet(frames: list[np.ndarray], out: Path, cols: int = 4, width: int = 1200) -> None:
    pick = frames if len(frames) <= 12 else [frames[round(i * (len(frames) - 1) / 11)] for i in range(12)]
    tw = width // cols
    h, w = pick[0].shape
    th = round(tw * h / w)
    rows = -(-len(pick) // cols)
    sheet = Image.new("L", (tw * cols, th * rows), 128)
    for i, a in enumerate(pick):
        sheet.paste(to8(a).resize((tw - 4, th - 4), Image.LANCZOS), ((i % cols) * tw + 2, (i // cols) * th + 2))
    sheet.save(out, quality=88)


def build(src: Path, set_id: str, *, licence: str, origin: str, own: bool, notes: str,
          flatten_frac: float, threshold: float, record_source: str | None) -> dict:
    src = src.expanduser().resolve()
    if not src.exists():
        sys.exit(f"source not found: {src}")
    is_video = src.is_file() and src.suffix.lower() in VIDEO_EXT
    raw = sheets_from_video(src, threshold) if is_video else sheets_from_folder(src)

    out = TEXTURES / set_id
    for sub in ("master", "web"):
        (out / sub).mkdir(parents=True, exist_ok=True)

    frames, names = [], []
    for i, (name, a) in enumerate(raw, start=1):
        a = normalise(flatten(fit(a, MASTER_MAX), flatten_frac))
        to8(a).save(out / "master" / f"{i:02d}.png", compress_level=6)
        h, w = a.shape
        s = WEB_SHORT / min(h, w)
        web = to8(a).resize((round(w * s), round(h * s)), Image.LANCZOS) if s < 1 else to8(a)
        web.save(out / "web" / f"{i:02d}.webp", quality=72, method=4)
        frames.append(fit(a, 1200))
        names.append(name)
        print(f"  {i:02d} <- {name}")
    if len(frames) < 2:
        sys.exit("a boil set needs at least 2 sheets")

    # Sheets left over from an earlier, longer build of this set.
    for sub, ext in (("master", "png"), ("web", "webp")):
        for f in (out / sub).glob(f"*.{ext}"):
            if f.stem.isdigit() and int(f.stem) > len(frames):
                try:
                    f.unlink()
                except OSError as e:
                    print(f"  could not remove stale {f.relative_to(ROOT)}: {e}", file=sys.stderr)
    contact_sheet(frames, out / "contact.jpg")
    mh, mw = np.asarray(Image.open(out / "master" / "01.png")).shape
    wh, ww = np.asarray(Image.open(out / "web" / "01.webp").convert("L")).shape
    manifest = {
        "id": set_id,
        "kind": "boil-texture",
        "frames": len(frames),
        "master": {"pattern": "master/%02d.png", "size": [mw, mh]},
        "web": {"pattern": "web/%02d.webp", "size": [ww, wh]},
        "contact_sheet": "contact.jpg",
        "normalised": {"mean": MEAN, "std": STD, "flatten": flatten_frac},
        "presets": PRESETS,
        "swap": SWAP_NOTE,
        "source": {
            "path": record_source or str(src),
            "kind": "video" if is_video else "folder",
            "files": names if not is_video else f"{len(names)} distinct frames of {src.name}",
            "threshold": threshold if is_video else None,
            "origin": origin,
        },
        "licence": licence,
        "own": own,
        "notes": notes,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")
    (out / ".gitignore").write_text(
        "# Own material: masters are large and regenerated by scripts/prepare_textures.py\nmaster/\n"
        if own else
        "# Third-party: never committed. Only the manifest is tracked; rebuild with\n"
        "# python3 scripts/prepare_textures.py --rebuild <id>\n*\n!manifest.json\n!.gitignore\n"
    )
    return manifest


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("source", nargs="?", type=Path)
    p.add_argument("--id", help="set id, e.g. paper-black-12 (kebab-case; end with the frame count)")
    p.add_argument("--rebuild", metavar="ID", help="remake a set from the source in its manifest")
    p.add_argument("--licence", default="unknown: check before any use outside private renders")
    p.add_argument("--origin", default="", help="where the raw source came from (pack name, URL)")
    p.add_argument("--own", action="store_true", help="Lucas's own scans or photos (web tier gets committed)")
    p.add_argument("--notes", default="")
    p.add_argument("--flatten", type=float, default=0.03, help="remove shading wider than this x long edge (0 = off)")
    p.add_argument("--threshold", type=float, default=1.0, help="video: mean code-value change that counts as a new sheet")
    p.add_argument("--record-source", help="path to write in the manifest, when it differs from where this ran")
    a = p.parse_args()

    if a.rebuild:
        m = json.loads((TEXTURES / a.rebuild / "manifest.json").read_text())
        s = m["source"]
        build(Path(s["path"]), m["id"], licence=m["licence"], origin=s.get("origin", ""), own=m["own"],
              notes=m["notes"], flatten_frac=m["normalised"]["flatten"], threshold=s.get("threshold") or a.threshold,
              record_source=None)
        return
    if not (a.source and a.id):
        p.error("give <source> and --id, or --rebuild <id>")
    m = build(a.source, a.id, licence=a.licence, origin=a.origin, own=a.own, notes=a.notes,
              flatten_frac=a.flatten, threshold=a.threshold, record_source=a.record_source)
    print(f"{m['frames']} sheets -> assets/textures/{m['id']}/")


if __name__ == "__main__":
    main()
