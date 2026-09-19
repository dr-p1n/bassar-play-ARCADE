#!/usr/bin/env python3
"""
BASSAR — brand assets. Regenerates everything in site/ that is derived from the
source wordmark art in this folder.

    python3 brand/make-assets.py

Kept separate from build.py on purpose: build.py is standard-library only and
runs anywhere, and this needs Pillow (`pip install Pillow`). Brand art changes
once in a blue moon; the client changes constantly.

Source art is two pure colours with no anti-aliasing, which is what makes the
SVG trace exact rather than approximate — every rect lands on a pixel boundary.
If the art is ever re-exported WITH anti-aliasing, the trace will explode into
thousands of rects and the ink test below will start dropping edge pixels. The
script checks for that and refuses rather than writing a silently worse asset.
"""
import pathlib, sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("needs Pillow:  pip install Pillow")

HERE = pathlib.Path(__file__).parent
SITE = HERE.parent / "site"
SRC  = HERE / "bassar-black.png"

BONE = (230, 230, 224)   # matches h1 in site/bassar.css
PINK = (240, 10, 80)     # measured off bassar-pink.png
INK  = (0, 0, 0)

MARK_MIN_PX = 140        # measured legibility floor: below this the counters fill in


def load():
    im = Image.open(SRC).convert("RGB")
    w, h = im.size
    px = im.load()
    colours = {px[x, y] for y in range(h) for x in range(w)}
    if not colours <= {INK, (255, 255, 255)}:
        sys.exit(f"{SRC.name}: expected two pure colours, found {len(colours)}. "
                 "Re-export without anti-aliasing, or the trace will not be exact.")
    return im, w, h, px


def rows_of_ink(w, h, px):
    rows = []
    for y in range(h):
        runs, s = [], None
        for x in range(w):
            if px[x, y] == INK and s is None: s = x
            elif px[x, y] != INK and s is not None: runs.append((s, x)); s = None
        if s is not None: runs.append((s, w))
        rows.append(runs)
    return rows


def trace(rows, w, h):
    """Merge identical horizontal runs down consecutive rows into rects.
    The sentinel empty row at the end closes whatever is still open."""
    open_r, out = {}, []
    for y, runs in enumerate(rows + [[]]):
        cur = set(runs)
        for key in [k for k in open_r if k not in cur]:
            x0, x1 = key
            y0 = open_r.pop(key)
            out.append((x0, y0, x1 - x0, y - y0))
        for key in runs:
            open_r.setdefault(key, y)
    return out


def verify(rects, rows, w, h):
    a = Image.new("1", (w, h), 0); da = ImageDraw.Draw(a)
    for x, y, rw, rh in rects: da.rectangle([x, y, x + rw - 1, y + rh - 1], fill=1)
    b = Image.new("1", (w, h), 0); db = ImageDraw.Draw(b)
    for y, runs in enumerate(rows):
        for x0, x1 in runs: db.rectangle([x0, y, x1 - 1, y], fill=1)
    diff = sum(1 for p, q in zip(list(a.tobytes()), list(b.tobytes())) if p != q)
    if diff: sys.exit(f"trace is not pixel-exact: {diff} differing pixels")
    return diff


def tint(w, h, px, rgb):
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0)); o = out.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == INK: o[x, y] = (*rgb, 255)
    return out


def main() -> int:
    im, w, h, px = load()
    rows = rows_of_ink(w, h, px)
    rects = trace(rows, w, h)
    verify(rects, rows, w, h)
    print(f"{SRC.name}: {w}x{h}, two colours -> {len(rects)} rects, pixel-exact")

    body = "".join(f'<rect x="{x}" y="{y}" width="{rw}" height="{rh}"/>' for x, y, rw, rh in rects)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
           f'role="img" aria-label="BASSAR"><title>BASSAR</title>'
           f'<g fill="currentColor">{body}</g></svg>')
    (SITE / "bassar-wordmark.svg").write_text(svg)

    tint(w, h, px, BONE).save(SITE / "bassar-wordmark-bone.png")
    tint(w, h, px, PINK).save(SITE / "bassar-wordmark-pink.png")

    # favicon: the 'b' alone. Six letters at 16px is mush.
    bw = next(x for x in range(w) if all(px[x, y] != INK for y in range(h)))
    PAD = 40; side = h + PAD * 2; off = (side - bw) // 2
    fbody = "".join(f'<rect x="{x+off}" y="{y+PAD}" width="{rw}" height="{rh}"/>'
                    for x, y, rw, rh in rects if x < bw)
    (SITE / "favicon.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side} {side}" '
        f'role="img" aria-label="BASSAR">'
        f'<rect width="{side}" height="{side}" fill="#000"/>'
        f'<g fill="rgb{PINK}">{fbody}</g></svg>')

    # og:image. Scanlines go UNDER the mark — over the glyphs they stripe it.
    OW, OH = 1200, 630
    og = Image.new("RGBA", (OW, OH), (0, 0, 0, 255)); d = og.load()
    for y in range(0, OH, 3):
        for x in range(OW): d[x, y] = (10, 10, 9, 255)
    m = tint(w, h, px, BONE)
    tw = 860
    m = m.resize((tw, round(h * tw / w)), Image.LANCZOS)
    og.alpha_composite(m, ((OW - m.width) // 2, (OH - m.height) // 2))
    og.convert("RGB").save(SITE / "og.png", optimize=True)

    for f in ("bassar-wordmark.svg", "bassar-wordmark-bone.png", "bassar-wordmark-pink.png",
              "favicon.svg", "og.png"):
        print(f"  site/{f:26s} {(SITE / f).stat().st_size:>7,} bytes")
    print(f"\nmark stays legible down to ~{MARK_MIN_PX}px wide; the header clamps above that.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
