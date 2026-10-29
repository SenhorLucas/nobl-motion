# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy>=1.26", "colour-science>=0.4.4"]
# ///
"""Compare rendered colour patches against their source sRGB values.

    uv run scripts/colour_check.py <render.mp4|frame.png> [patches.json]
        [--time 0.5] [--tolerance 2]

The image is decoded to 8-bit full-range RGB with FFmpeg. For video, the
decode states the BT.709 matrix and limited range explicitly, like a correct
player, rather than trusting defaults. The median of the central 40% of each
grid cell is compared to the patch's source value, in code values and as
CIEDE2000 (sRGB, D65). Exit status 1 if any channel is off by more than
--tolerance code values.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import colour
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PATCHES = ROOT / "brand/reference/colour-check/data/patches.json"

# A player that decodes Rec.709 SDR correctly: 709 matrix, limited range in,
# full-range RGB out, accurate rounding, full chroma interpolation.
DECODE_709 = (
    "scale=in_color_matrix=bt709:in_range=tv:out_range=pc"
    ":flags=accurate_rnd+full_chroma_int+full_chroma_inp,format=rgb24"
)


def probe_size(path: Path) -> tuple[int, int]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "json", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    s = json.loads(out)["streams"][0]
    return s["width"], s["height"]


def decode_frame(path: Path, time: float) -> np.ndarray:
    w, h = probe_size(path)
    video = path.suffix.lower() in {".mp4", ".mov", ".webm", ".mkv"}
    cmd = ["ffmpeg", "-v", "error"]
    if video:
        cmd += ["-ss", str(time)]
    cmd += ["-i", str(path), "-frames:v", "1",
            "-vf", DECODE_709 if video else "format=rgb24",
            "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3)


def sample(frame: np.ndarray, cols: int, rows: int, inset: float = 0.3) -> np.ndarray:
    h, w, _ = frame.shape
    out = []
    for i in range(cols * rows):
        r, c = divmod(i, cols)
        x0, x1 = w * (c + inset) / cols, w * (c + 1 - inset) / cols
        y0, y1 = h * (r + inset) / rows, h * (r + 1 - inset) / rows
        cell = frame[round(y0):round(y1), round(x0):round(x1)].reshape(-1, 3)
        out.append(np.median(cell, axis=0))
    return np.array(out)


def delta_e(expected: np.ndarray, measured: np.ndarray) -> np.ndarray:
    def lab(rgb8: np.ndarray) -> np.ndarray:
        xyz = colour.sRGB_to_XYZ(rgb8 / 255.0)
        return colour.XYZ_to_Lab(xyz, colour.CCS_ILLUMINANTS["CIE 1931 2 Degree Standard Observer"]["D65"])
    return colour.delta_E(lab(expected), lab(measured), method="CIE 2000")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("image", type=Path)
    ap.add_argument("patches", type=Path, nargs="?", default=DEFAULT_PATCHES)
    ap.add_argument("--time", type=float, default=0.5, help="seconds into a video to sample")
    ap.add_argument("--tolerance", type=int, default=2, help="max code-value error per channel")
    args = ap.parse_args()

    spec = json.loads(args.patches.read_text())
    expected = np.array([p["rgb"] for p in spec["patches"]], float)
    measured = sample(decode_frame(args.image, args.time), spec["cols"], spec["rows"])[: len(expected)]
    diff = measured - expected
    de = delta_e(expected, measured)

    print(f"{args.image.name}  (tolerance ±{args.tolerance} code values)")
    print(f"{'patch':<28}{'source':>15}{'measured':>17}{'delta':>17}{'ΔE00':>7}")
    worst = 0
    for p, e, m, d, dE in zip(spec["patches"], expected, measured, diff, de):
        bad = np.abs(d).max() > args.tolerance
        worst = max(worst, np.abs(d).max())
        fmt = lambda v: " ".join(f"{x:>4.0f}" for x in v)
        sign = lambda v: " ".join(f"{x:>+4.0f}" for x in v)
        print(f"{p['name']:<28}{fmt(e):>15}{fmt(m):>17}{sign(d):>17}{dE:>7.2f}{'  <--' if bad else ''}")
    ok = worst <= args.tolerance
    print(f"max |delta| {worst:.0f} code values, max ΔE00 {de.max():.2f}, mean ΔE00 {de.mean():.2f}: {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
