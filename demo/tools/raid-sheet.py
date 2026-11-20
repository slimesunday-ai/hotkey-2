#!/usr/bin/env python3
# A RAID'S SHEET (raidfight-1): a film of demo/tools/fight-film.mjs as a grid of pictures every --step s over [--from,
# --to] (s from the first picture of the fight), each cropped to --box round --at, --cols a row, scaled by --scale.
#   python3 demo/tools/raid-sheet.py <case dir> <out.jpg> [--from 0] [--to 99] [--step 0.2] [--cols 5]
#          [--box 560x420] [--at 800x500] [--scale 1]
import json, sys, os
from PIL import Image, ImageDraw
d = sys.argv[1]; out = sys.argv[2]
a = dict(zip(sys.argv[3::2], sys.argv[4::2]))
fr, to, stp = float(a.get('--from', 0)), float(a.get('--to', 99)), float(a.get('--step', 0.2))
cols = int(a.get('--cols', 5)); bw, bh = (int(v) for v in a.get('--box', '560x420').split('x'))
cx, cy = (int(v) for v in a.get('--at', '800x500').split('x')); sc = float(a.get('--scale', 1))
J = json.load(open(os.path.join(d, 'film.json')))
F = J['frames']; t0 = F[0]['t']
# time zero: the first frame of the fight (marks), else the film's start
marks = J.get('marks') or []
z = next((m[0] / 1000 for m in marks if m[1] in ('fight',)), None)
if z is not None and a.get('--zero', 'fight') == 'fight': t0 = z
pick = []
t = fr
while t <= to + 1e-6:
    best = min(F, key=lambda f: abs(f['t'] - t0 - t))
    pick.append((t, best)); t += stp
W, H = int(bw * sc), int(bh * sc)
rows = (len(pick) + cols - 1) // cols
sheet = Image.new('RGB', (W * cols, H * rows), (16, 16, 16))
for k, (t, f) in enumerate(pick):
    im = Image.open(os.path.join(d, f['file'])).crop((cx - bw // 2, cy - bh // 2, cx + bw // 2, cy + bh // 2))
    if sc != 1: im = im.resize((W, H))
    dr = ImageDraw.Draw(im); dr.rectangle((0, 0, 58, 16), fill=(0, 0, 0)); dr.text((3, 2), f'{t:.2f}s', fill=(255, 255, 0))
    sheet.paste(im, ((k % cols) * W, (k // cols) * H))
sheet.save(out, quality=88)
print(out, len(pick), 'frames')
