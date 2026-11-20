#!/usr/bin/env python3
"""THE SHEETS of demo/tools/fight-sheet.mjs: its pictures cut to the fight and laid out in rows, each with its moment.

  python3 demo/tools/fight-sheet.py <dir>/<name> [--cols 10] [--tile 240] [--views game,close] [--zoom-game 2]

One sheet per view: <dir>/<name>-<view>.jpg. The game's view is cut to the box round the fight's ground and shown at
--zoom-game times its size on the page (default 2: what is there, big enough to look at; a 1 says what the player sees).
A moment a blow lands on is marked.
"""
import json
import os
import sys

from PIL import Image, ImageDraw


def opt(name, fallback=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else fallback


def main():
    src = sys.argv[1].rstrip('/')
    S = json.load(open(os.path.join(src, 'sheet.json')))
    cols = int(opt('--cols', '10'))
    views = opt('--views', ','.join(sorted(set(r['view'] for r in S['rows'])))).split(',')
    zg = float(opt('--zoom-game', '2'))
    beats = S['cast']['beats']
    for view in views:
        rows = [r for r in S['rows'] if r['view'] == view]
        if not rows:
            continue
        # one box for the whole sheet: round every picture's own
        x0 = min(r['box'][0] for r in rows)
        y0 = min(r['box'][1] for r in rows)
        x1 = max(r['box'][2] for r in rows)
        y1 = max(r['box'][3] for r in rows)
        first = Image.open(rows[0]['file'])
        W, H = first.size
        pad = 6
        box = (int(max(0, x0 - pad)), int(max(0, y0 - pad)), int(min(W, x1 + pad)), int(min(H, y1 + pad)))
        bw, bh = box[2] - box[0], box[3] - box[1]
        if view == 'game':
            tw, th = int(bw * zg), int(bh * zg)
        else:
            tw = int(opt('--tile', '300'))
            th = int(tw * bh / bw)
        n = len(rows)
        sheet = Image.new('RGB', (cols * tw, ((n + cols - 1) // cols) * th), (18, 18, 18))
        d = ImageDraw.Draw(sheet)
        for i, r in enumerate(rows):
            im = Image.open(r['file']).convert('RGB').crop(box).resize((tw, th), Image.LANCZOS if view != 'game' else Image.NEAREST)
            x, y = (i % cols) * tw, (i // cols) * th
            sheet.paste(im, (x, y))
            hit = next((b for b in beats if abs(b['t'] - r['t']) < 0.017), None)
            label = f"{r['t']:+.2f}" + (f"  {hit['by']} {'LANDS' if hit['hit'] else 'thrown'}" if hit else '')
            d.rectangle((x, y, x + 8 + 6 * len(label), y + 13), fill=(200, 30, 30) if hit and hit['hit'] else (0, 0, 0))
            d.text((x + 3, y + 1), label, fill=(255, 255, 255) if hit else (255, 240, 60))
        out = f'{src}-{view}.jpg'
        sheet.save(out, quality=90)
        print(f'{out}  {sheet.size[0]}x{sheet.size[1]}  ({n} moments, box {bw}x{bh})')


main()
