#!/usr/bin/env python3
# THE NAMED CAST LINEUP's picture (named-1, cast-lineup.mjs): the game's own picture of the rows, cropped to them, each
# row at the game's true size, with every one's name and size under their feet (three staggered lines: the names are
# wider than the gap between two people at the game's size). Also a copy twice the size, to look closer.
#   python3 cast-lineup.py <raw.png> <lineup.json> <day|night> <out.jpg>
import json, sys
from PIL import Image, ImageDraw, ImageFont

raw, data_path, which, out = sys.argv[1:5]
data = json.load(open(data_path))
img = Image.open(raw).convert('RGB')
at = {a['id']: a for a in data['at']}
rows = {}
for r in data['rows']:
    rows.setdefault(r['row'], []).append({**r, **at[r['id']]})

def font(px):
    for name in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc', '/Library/Fonts/Arial.ttf']:
        try:
            return ImageFont.truetype(name, px)
        except OSError:
            pass
    return ImageFont.load_default()

F = font(12)
TITLE = font(15)
LINE = 15
strips = []
for r, people in sorted(rows.items()):
    xs = [p['feet'][0] for p in people]
    top = min(p['head'][1] for p in people) - 18
    bottom = max(p['feet'][1] for p in people) + 40   # (room below the feet: the cart man's cart, pushed toward the camera)
    left, right = max(0, min(xs) - 56), min(img.width, max(xs) + 56)
    crop = img.crop((left, max(0, top), right, min(img.height, bottom)))
    in_game = any(p['inGame'] for p in people if p['inGame'] is not None)
    title = ('In the game' if in_game else 'Drawn, not in the game') + f' · row {r + 1} · the game\'s camera, its own size · {which}'
    band = 3 * LINE + 8
    strip = Image.new('RGB', (crop.width, 22 + crop.height + band), (23, 23, 27))
    d = ImageDraw.Draw(strip)
    d.text((8, 3), title, fill=(255, 194, 26), font=TITLE)
    strip.paste(crop, (0, 22))
    for k, p in enumerate(people):
        x = p['feet'][0] - left
        label = 'standard 1.0' if p['key'] == 'std' else f"{p['name']} {p['size']:g}"
        w = d.textlength(label, font=F)
        y = 22 + crop.height + 4 + (k % 3) * LINE
        d.line([(x, 22 + crop.height), (x, y + 2)], fill=(90, 90, 100))
        d.text((x - w / 2, y), label, fill=(170, 170, 180) if p['key'] == 'std' else (245, 241, 234), font=F)
    strips.append(strip)

W = max(s.width for s in strips)
H = sum(s.height for s in strips) + 6 * (len(strips) - 1)
sheet = Image.new('RGB', (W, H), (12, 12, 14))
y = 0
for s in strips:
    sheet.paste(s, (0, y))
    y += s.height + 6
sheet.save(out, quality=90)
big = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST)
big.save(out.replace('.jpg', '-x2.jpg'), quality=88)
print(f'cast-lineup.py: {out} ({sheet.width}x{sheet.height}) and its x2')
