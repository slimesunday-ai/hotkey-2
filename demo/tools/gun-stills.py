#!/usr/bin/env python3
"""THE GUN STILLS, AS ONE SHEET A GUN (anim-1; the pictures are demo/tools/gun-stills.mjs's): a row a moment, a column a
view, each picture cut round the body it is about.

  python3 demo/tools/gun-stills.py <dir of one gun> [--out sheet.jpg] [--box 520x440] [--scale 0.8]
"""
import json
import os
import sys

from PIL import Image, ImageDraw


def opt(name, fallback=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else fallback


def main():
    src = sys.argv[1].rstrip('/')
    idx = json.load(open(os.path.join(src, 'index.json')))
    bw, bh = (int(v) for v in opt('--box', '520x440').split('x'))
    k = float(opt('--scale', '0.8'))
    tw, th = int(bw * k), int(bh * k)
    rows = idx['moments']
    if opt('--moments'):
        rows = [r for r in rows if r['moment'] in opt('--moments').split(',')]
    if opt('--views'):
        for r in rows:
            r['views'] = [v for v in r['views'] if v['view'] in opt('--views').split(',')]
    cols = max(len(r['views']) for r in rows)
    sheet = Image.new('RGB', (tw * cols, th * len(rows)), (16, 16, 16))
    for j, r in enumerate(rows):
        for i, v in enumerate(r['views']):
            im = Image.open(v['file']).convert('RGB')
            W, H = im.size
            at = v.get('at') or {}
            cx, cy = at.get('x', W / 2), at.get('y', H / 2)
            x0 = int(max(0, min(W - bw, cx - bw / 2)))
            y0 = int(max(0, min(H - bh, cy - bh * float(opt('--above', '0.3')))))
            c = im.crop((x0, y0, x0 + bw, y0 + bh)).resize((tw, th))
            d = ImageDraw.Draw(c)
            d.rectangle((0, 0, 150, 13), fill=(0, 0, 0))
            d.text((3, 1), f"{r['moment']} · {v['view']}", fill=(255, 230, 60))
            sheet.paste(c, (i * tw, j * th))
    out = opt('--out', src + '.jpg')
    sheet.save(out, quality=86)
    print(out, sheet.size)


main()
