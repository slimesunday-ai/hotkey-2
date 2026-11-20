#!/usr/bin/env python3
# (room-3) A fight's pictures from demo/tools/room-probe.mjs --strip <dir>, put together in one strip: each cropped
# round the fight's room, its ground drawn in red and its room's edge in yellow, the stage's clock in the corner.
#   python3 demo/tools/room-strip.py <dir>/fight-<k>.json <out.jpg> [--every 1] [--cols 6] [--tile 360] [--title "..."]
import json
import sys

from PIL import Image, ImageDraw


def opt(name, fallback):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else fallback


frames = json.load(open(sys.argv[1]))
out = sys.argv[2]
every = int(opt('--every', '1'))
cols = int(opt('--cols', '6'))
tile = int(opt('--tile', '360'))
title = opt('--title', '')
frames = [f for f in frames if f.get('edge')][::every]
if not frames:
    sys.exit('no pictures with a room in them')


def box_of(f):
    # (each picture cropped round its own room's edge (the camera moves), the edge a little over half its width, 16:10)
    xs = [p[0] for p in f['edge']]
    ys = [p[1] for p in f['edge']]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    w = max(max(xs) - min(xs), (max(ys) - min(ys)) * 1.6) * 1.8
    h = w / 1.6
    return [int(cx - w / 2), int(cy - h / 2), int(cx + w / 2), int(cy + h / 2)]

th = int(tile / 1.6)
rows = (len(frames) + cols - 1) // cols
head = 22 if title else 0
sheet = Image.new('RGB', (cols * tile, rows * th + head), (14, 14, 18))
d0 = ImageDraw.Draw(sheet)
if title:
    d0.text((6, 5), title, fill=(235, 235, 235))
for i, f in enumerate(frames):
    im = Image.open(f['file']).convert('RGB')
    dr = ImageDraw.Draw(im)
    for key, col in (('edge', (255, 214, 0)), ('ground', (230, 40, 40))):
        pts = [tuple(p) for p in f[key]]
        dr.line(pts + [pts[0]], fill=col, width=3)
    im = im.crop(box_of(f)).resize((tile, th), Image.LANCZOS)
    di = ImageDraw.Draw(im)
    di.rectangle([0, 0, 52, 13], fill=(0, 0, 0))
    di.text((3, 1), f"{f['t']:.1f}s", fill=(255, 255, 255))
    sheet.paste(im, ((i % cols) * tile, head + (i // cols) * th))
sheet.save(out, quality=88)
print(out, sheet.size)
