#!/usr/bin/env python3
"""THE DRUG LOOKS ON ONE SHEET, FOR THE OWNER (looks-1): a row a look, each a few moments of its clip from the game's
camera (demo/tools/looks-film.mjs, then fight-film.py), labelled in plain words.

  python3 demo/tools/looks-sheet.py --out <sheet.jpg> \\
      --row "Zonked: falls asleep where they stand" <clip.mp4> 2,5,8,12,18,20 [--row ...] [--tile 360x270] [--zoom 1.6]

Each row: its words on the left, then one picture a moment (seconds into the clip), each with its time.
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

FFMPEG = '/opt/homebrew/bin/ffmpeg'


def opt(name, fallback=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else fallback


def font(size):
    for f in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc', '/Library/Fonts/Arial.ttf'):
        if os.path.exists(f):
            try:
                return ImageFont.truetype(f, size)
            except OSError:
                pass
    return ImageFont.load_default()


def frame(clip, t, tmp):
    out = os.path.join(tmp, f'{abs(hash((clip, t)))}.png')
    subprocess.run([FFMPEG, '-loglevel', 'error', '-y', '-ss', str(t), '-i', clip, '-frames:v', '1', out], check=True)
    return Image.open(out).convert('RGB')


def main():
    rows = []
    a = sys.argv
    for i, x in enumerate(a):
        if x == '--row':
            rows.append((a[i + 1], a[i + 2], [float(v) for v in a[i + 3].split(',')], a[i + 4] if i + 4 < len(a) and not a[i + 4].startswith('--') else ''))
    tw, th = (int(v) for v in opt('--tile', '360x270').split('x'))
    zoom = float(opt('--zoom', '1.0'))
    label_w = int(opt('--label', '300'))
    cols = max(len(r[2]) for r in rows)
    pad = 6
    W = label_w + cols * (tw + pad) + pad
    H = len(rows) * (th + pad) + pad + 50
    sheet = Image.new('RGB', (W, H), (18, 18, 22))
    d = ImageDraw.Draw(sheet)
    big, small, tiny = font(22), font(15), font(13)
    d.text((pad + 4, 12), opt('--title', 'THE RUN: the drug looks, from the game\'s own camera'), fill=(255, 255, 255), font=big)
    with tempfile.TemporaryDirectory() as tmp:
        for r, (words, clip, times, sub) in enumerate(rows):
            y = 50 + pad + r * (th + pad)
            # the name (before the colon) big, the rest wrapped under it
            name, _, rest = words.partition(':')
            lines, line = [], ''
            for word in rest.split():
                if len(line) + len(word) > 30:
                    lines.append(line)
                    line = word
                else:
                    line = f'{line} {word}'.strip()
            lines.append(line)
            d.text((pad + 6, y + 8), name.strip(), fill=(255, 236, 140), font=big)
            for k, ln in enumerate(lines):
                d.text((pad + 6, y + 40 + k * 21), ln, fill=(235, 235, 235), font=small)
            if sub:
                d.text((pad + 6, y + th - 22), sub, fill=(170, 170, 180), font=tiny)
            for c, t in enumerate(times):
                im = frame(clip, t, tmp)
                w, h = im.size
                cw, ch = int(tw / zoom), int(th / zoom)
                box = ((w - cw) // 2, (h - ch) // 2, (w - cw) // 2 + cw, (h - ch) // 2 + ch)
                im = im.crop(box).resize((tw, th), Image.LANCZOS)
                x = label_w + pad + c * (tw + pad)
                sheet.paste(im, (x, y))
                d.rectangle((x, y, x + 52, y + 18), fill=(0, 0, 0))
                d.text((x + 4, y + 2), f'{t:4.1f}s', fill=(255, 255, 0), font=tiny)
    out = opt('--out', 'looks-sheet.jpg')
    sheet.save(out, quality=88)
    print(f'{out}: {len(rows)} looks, {W}x{H}')


main()
