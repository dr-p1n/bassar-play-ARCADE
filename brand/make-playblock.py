#!/usr/bin/env python3
"""
BASSAR — the PLAY block of the lockup, regenerated.

The plate is the same height as the lowercase body of the wordmark (y 70→306
on the 306-tall art), sits on the same baseline, and carries PLAY knocked out
in a 5×7 arcade bitmap face. Drawn as rects, so there is no typeface at runtime
and nothing to load. Standard library only.

    python3 brand/make-playblock.py        # rewrites the lockup in site/index.html
"""
import pathlib, re

SITE = pathlib.Path(__file__).parent.parent / "site" / "index.html"

FONT = {  # 5 wide, 7 tall
  "P": ["XXXX.","X...X","X...X","XXXX.","X....","X....","X...."],
  "L": ["X....","X....","X....","X....","X....","X....","XXXXX"],
  "A": [".XXX.","X...X","X...X","XXXXX","X...X","X...X","X...X"],
  "Y": ["X...X","X...X",".X.X.","..X..","..X..","..X..","..X.."],
}
TEXT   = "PLAY"
MOD    = 26                  # module (plate.js reads data-* only; it assumes MOD=26); 7 rows * 26 = 182
PLATE_X, PLATE_Y, PLATE_H = 1134, 70, 236     # body of the wordmark: top of 'a' to baseline
PAD_X  = 30
GAP    = MOD                 # one module between letters
GLYPH_W = 5 * MOD
glyphs_w = len(TEXT) * GLYPH_W + (len(TEXT) - 1) * GAP
PLATE_W = glyphs_w + 2 * PAD_X
VB_W    = PLATE_X + PLATE_W
top     = PLATE_Y + (PLATE_H - 7 * MOD) // 2

rects = []   # (x, y, w, h, row, letter)
for i, ch in enumerate(TEXT):
    ox = PLATE_X + PAD_X + i * (GLYPH_W + GAP)
    for r, row in enumerate(FONT[ch]):
        c = 0
        while c < 5:                     # merge horizontal runs
            if row[c] == "X":
                s = c
                while c < 5 and row[c] == "X": c += 1
                rects.append((ox + s * MOD, top + r * MOD, (c - s) * MOD, MOD, r, i))
            else: c += 1

clip = f'<clipPath id="plateClip"><rect x="{PLATE_X}" y="{PLATE_Y}" width="{PLATE_W}" height="{PLATE_H}"/></clipPath>'
plate = clip + f'<rect class="plate" x="{PLATE_X}" y="{PLATE_Y}" width="{PLATE_W}" height="{PLATE_H}"/>'
# data-r / data-l let plate.js tear rows and drop letters; clip keeps a tear inside the plate
ko = '<g class="ko" clip-path="url(#plateClip)">' + "".join(f'<rect data-r="{r}" data-l="{l}" x="{x}" y="{y}" width="{w}" height="{h}"/>' for x, y, w, h, r, l in rects) + "</g>"

s = SITE.read_text(encoding="utf-8")
s2, n = re.subn(r'(?:<clipPath id="plateClip">.*?</clipPath>)?<rect class="plate".*?</g></svg>', lambda m: plate + ko + "</svg>", s, count=1, flags=re.S)
assert n == 1, "plate not found in index.html"
s2, n = re.subn(r'viewBox="0 0 \d+ 306" role="img" aria-label="BASSAR PLAY"',
                f'viewBox="0 0 {VB_W} 306" role="img" aria-label="BASSAR PLAY"', s2, count=1)
assert n == 1, "lockup viewBox not found"
SITE.write_text(s2, encoding="utf-8")
print(f"plate {PLATE_W}x{PLATE_H}, lockup viewBox 0 0 {VB_W} 306  (css width scale {VB_W/1490:.3f}x)")
