#!/usr/bin/env python3
# Lays out the clip sheets from what clip-sheet.mjs took (its frames.json): one sheet per group, a few clips to a
# page, each clip two rows of its frames: the game's own camera (cropped round the two at 1:1, nothing scaled) and the
# close side view (cropped round them and scaled down). Under each frame: the lead's clip clock and the partner's.
#
#   python3 demo/tools/clip-sheet.py <dir>     (the --out of clip-sheet.mjs; the sheets are written beside frames.json)
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1])
clips = json.loads((root / 'frames.json').read_text())
GROUPS = [('hits', 'Hits'), ('threats', 'Threats and grabs'), ('reactions', 'Reactions'), ('down', 'Going down and getting up'), ('handover', 'Hand-overs and searches')]
PER_PAGE = 4
TW, GH, CH = 340, 250, 300  # a tile's width, the game row's height, the close row's
LABEL = 250
CAP = 34


def font(size):
    for f in ['/System/Library/Fonts/Menlo.ttc', '/System/Library/Fonts/Monaco.ttf']:
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


F, FB, FS = font(15), font(19), font(13)


def crop(file, box, w, h, scale):
    im = Image.open(file).convert('RGB')
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    cw, chh = w * scale, h * scale
    x0, y0 = int(cx - cw / 2), int(cy - chh / 2)
    x0 = max(0, min(im.width - int(cw), x0))
    y0 = max(40, min(im.height - 90 - int(chh), y0))  # (clear of the run's top bar and its bottom menu)
    tile = im.crop((x0, y0, x0 + int(cw), y0 + int(chh)))
    return tile if scale == 1 else tile.resize((w, h), Image.LANCZOS)


written = []
for key, title in GROUPS:
    group = [c for c in clips if c['group'] == key]
    for page in range(0, len(group), PER_PAGE):
        part = group[page:page + PER_PAGE]
        n = max(len(c['rows']) // 2 for c in part)
        W = LABEL + n * TW
        H = 50 + sum(GH + CH + 2 * CAP + 14 for _ in part)
        sheet = Image.new('RGB', (W, H), (24, 25, 32))
        d = ImageDraw.Draw(sheet)
        pages = (len(group) + PER_PAGE - 1) // PER_PAGE
        d.text((14, 14), f'{title}{f"  ({page // PER_PAGE + 1}/{pages})" if pages > 1 else ""}   top row: the game camera, 1:1 crop · bottom row: close side view', fill=(240, 240, 240), font=FB)
        y = 50
        for c in part:
            game = sorted([r for r in c['rows'] if r['view'] == 'game'], key=lambda r: r['k'])
            close = sorted([r for r in c['rows'] if r['view'] == 'close'], key=lambda r: r['k'])
            d.rectangle((0, y, W, y + GH + CH + 2 * CAP + 8), outline=(70, 72, 90))
            lines = [c['lead'], f"{c['dur']} s{' loop' if c['loop'] else ''}"]
            if c['partner']:
                lines.append(f"with {c['partner']}")
                lines.append(f"partner from {c['delay']} s")
            else:
                lines.append('alone')
            if c['contact'] is not None:
                lines.append(f"contact {c['contact']} s")
            if c['live']:
                lines.append('played live (walks)')
            if c.get('note'):
                lines += [c['note'][i:i + 28] for i in range(0, len(c['note']), 28)]
            for i, ln in enumerate(lines):
                d.text((12, y + 12 + i * 22), ln, fill=(255, 220, 120) if i == 0 else (220, 220, 220), font=FB if i == 0 else F)
            for k, r in enumerate(game):
                x = LABEL + k * TW
                sheet.paste(crop(r['file'], r['box'], TW - 6, GH, 1), (x + 3, y + 4))
                hit = c['contact'] is not None and abs(r['t'] - c['contact']) < 1e-6
                cap = f"t {r['t']:.2f}{'  CONTACT' if hit else ''}"
                d.text((x + 6, y + GH + 8), cap, fill=(255, 120, 120) if hit else (230, 230, 230), font=F)
            for k, r in enumerate(close):
                x = LABEL + k * TW
                sheet.paste(crop(r['file'], r['box'], TW - 6, CH, 2.6), (x + 3, y + GH + CAP + 4))
                cap = f"{r['lead']}" + (f" | {r['partner']}" if r['partner'] else '')
                d.text((x + 6, y + GH + CAP + CH + 8), cap[:44], fill=(200, 200, 210), font=FS)
            y += GH + CH + 2 * CAP + 14
        name = root / f"sheet-{key}{f'-{page // PER_PAGE + 1}' if pages > 1 else ''}.jpg"
        sheet.save(name, quality=90)
        written.append(str(name))
print('\n'.join(written))
