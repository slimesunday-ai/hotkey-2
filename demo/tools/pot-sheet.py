#!/usr/bin/env python3
# THE FIRST COOK, ON ONE SHEET (pot-2): the pictures run-pot.mjs took, in the order a player meets them, from the
# shop at the trailer park to the sale in the crowd, each with a line of what it shows. One sheet, pot-screens.jpg.
#
#   python3 demo/tools/pot-sheet.py <dir of run-pot.mjs pictures> <out.jpg>
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

src = Path(sys.argv[1])
out = Path(sys.argv[2])
# (the picture's name after its number, and what it shows)
WALK = [
    ('shop-list', '1. Shop (B) at the trailer park: the hot plate first on the shelf, night tea and rave sticks with who sells them'),
    ('bought-what-goes-in', '2. Bought: the hot plate, two tins of night tea, two boxes of rave sticks'),
    ('pot-open', '3. Home, Cook (P): the shelf, the pot, the label'),
    ('label-zonk', '4. Night tea in the pot: the label says Zonked, what it does, how it can come out'),
    ('cooked-zonk', '5. Cooked: six bags of Zonked, said on the card'),
    ('label-disco-coma', '6. Both in the pot: Disco Coma, two lines, never cooked'),
    ('naming', '7. Name it: typed in the box'),
    ('named', '8. Named: Swamp Bedtime, everywhere'),
    ('stuff-row-belt', '9. Stuff (O): your bags, one row each; a bag on your belt'),
    ('home-slip-smell', '10. HOME (K): the smell of your cooking is a reason'),
    ('ahead-make', '11. Ahead (U): the fifth tree, Make, names only; a click, its card'),
    ('sale-card-bus-stop', '12. Next day, the bus stop: "Sell Zonked at the bus stop", he\'ll sleep 3 h'),
    ('sold-under-it', '13. Sold: the place says asleep 1; the notice says what came of it'),
    ('people-until-when', '14. You (C), People: asleep until when'),
    ('lift-picked', '15. Rob (R): his wallet while he sleeps, sure'),
    ('lifted', '16. Lifted'),
    ('sale-card-crowd', '17. The market: the bag changed with a click, he\'ll dance 2 h'),
    ('sold-crowd', '18. Sold in the crowd: dancing 1'),
]
files = {p.stem.split('-', 1)[1]: p for p in sorted(src.glob('*.jpg')) if '-' in p.stem}
tiles = [(files[k], cap) for k, cap in WALK if k in files]
if not tiles:
    sys.exit('no pictures')


def font(size):
    for f in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/Menlo.ttc']:
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


COLS = 3
TW = 760
first = Image.open(tiles[0][0])
TH = round(first.height * TW / first.width)
CAP = 46
PAD = 14
HEAD = 70
rows = (len(tiles) + COLS - 1) // COLS
sheet = Image.new('RGB', (COLS * TW + (COLS + 1) * PAD, HEAD + rows * (TH + CAP + PAD) + PAD), (244, 239, 226))
d = ImageDraw.Draw(sheet)
d.text((PAD, 18), 'The pot: a first cook, from the shop to the sale', fill=(20, 20, 20), font=font(34))
f = font(19)
for i, (p, cap) in enumerate(tiles):
    r, c = divmod(i, COLS)
    x = PAD + c * (TW + PAD)
    y = HEAD + r * (TH + CAP + PAD)
    im = Image.open(p).convert('RGB').resize((TW, TH), Image.LANCZOS)
    sheet.paste(im, (x, y))
    d.rectangle([x - 1, y - 1, x + TW, y + TH], outline=(20, 20, 20), width=2)
    # (the caption, wrapped to two lines at most)
    words, lines, line = cap.split(), [], ''
    for w in words:
        t = f'{line} {w}'.strip()
        if d.textlength(t, font=f) > TW - 8 and line:
            lines.append(line)
            line = w
        else:
            line = t
    lines.append(line)
    for k, l in enumerate(lines[:2]):
        d.text((x + 2, y + TH + 4 + k * 21), l, fill=(20, 20, 20), font=f)
sheet.save(out, quality=86)
print(out)
