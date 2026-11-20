#!/usr/bin/env python3
"""A FILMED FIGHT, MADE INTO A CLIP AND A STRIP (anim-1; the frames are demo/tools/fight-film.mjs's).

  python3 demo/tools/fight-film.py <case dir> [--out <dir>] [--box 760x560] [--fps 30] [--strip 0.1] [--from s] [--to s]
          [--label "words"] [--zoom 1]

The clip plays at the speed the page showed it: each frame of the clip is the picture that was on the page at that
moment (the browser's own times), 30 a second. The picture is cut to a box round the fight (where the bodies' heads
were, with room), never scaled unless --zoom says so. The strip is one row of pictures every --strip seconds over
[--from, --to] of the film (default: the whole fight), for looking at one blow frame by frame.
Writes <out>/<case>.mp4, <out>/<case>-strip.jpg.
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw

FFMPEG = '/opt/homebrew/bin/ffmpeg'


def opt(name, fallback=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else fallback


def main():
    src = sys.argv[1].rstrip('/')
    out = opt('--out', os.path.dirname(src))
    os.makedirs(out, exist_ok=True)
    name = opt('--name', os.path.basename(src))
    bw, bh = (int(v) for v in opt('--box', '760x560').split('x'))
    fps = float(opt('--fps', '30'))
    zoom = float(opt('--zoom', '1'))
    label = opt('--label')
    film = json.load(open(os.path.join(src, 'film.json')))
    frames = film['frames']
    heads = film['heads']
    if not frames:
        raise SystemExit('no frames')
    t0 = frames[0]['t']
    # the box: round every head of the fight's people seen while it was on (the player first)
    # (the player is the stage's a1; a film made before the tool knew it has the head in `all`)
    you = []
    for h in heads:
        st = h.get('st') or {}
        if not st:
            continue
        p = h.get('you') or next(({'x': r[1], 'y': r[2]} for r in h.get('all', []) if r[0] == 'a1'), None)
        if p:
            you.append((p['x'], p['y']))
    first = Image.open(os.path.join(src, frames[0]['file']))
    W, H = first.size
    if opt('--center'):
        cx, cy = (float(v) for v in opt('--center').split(','))
    elif you:
        # (the middle of where the player's head was while the fight was on: the camera follows them)
        px = sorted(p[0] for p in you)
        py = sorted(p[1] for p in you)
        cx, cy = px[len(px) // 2], py[len(py) // 2] + 40
    else:
        cx, cy = W / 2, H / 2
    x0 = int(max(0, min(W - bw, cx - bw / 2)))
    y0 = int(max(0, min(H - bh, cy - bh / 2)))
    box = (x0, y0, x0 + bw, y0 + bh)
    a = float(opt('--from', '0'))
    b = float(opt('--to', str(frames[-1]['t'] - t0)))
    if opt('--window') == 'fight':
        # from a little before the fight is on (the walk up to it) to the film's end
        on = [m[0] / 1000 - t0 for m in film.get('marks', []) if m[1]]
        if on:
            a = max(0.0, on[0] - float(opt('--lead', '2.5')))
            b = min(b, on[-1] + float(opt('--tail', '1.5')))
    times = [f['t'] - t0 for f in frames]

    def at(t):
        # the picture on the page at time t: the last frame presented at or before it
        lo, hi = 0, len(times) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if times[mid] <= t:
                lo = mid
            else:
                hi = mid - 1
        return lo

    def picture(k):
        im = Image.open(os.path.join(src, frames[k]['file'])).convert('RGB').crop(box)
        if zoom != 1:
            im = im.resize((int(bw * zoom), int(bh * zoom)), Image.LANCZOS)
        return im

    # THE CLIP
    n = int((b - a) * fps)
    ow, oh = int(bw * zoom) // 2 * 2, int(bh * zoom) // 2 * 2
    mp4 = os.path.join(out, f'{name}.mp4')
    ff = subprocess.Popen([FFMPEG, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{ow}x{oh}', '-r', str(fps), '-i', '-',
                           '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', opt('--crf', '23'), '-preset', 'medium', '-movflags', '+faststart', mp4], stdin=subprocess.PIPE)
    last_k, last_im = None, None
    for i in range(n):
        k = at(a + i / fps)
        if k != last_k:
            im = picture(k).crop((0, 0, ow, oh))
            if label:
                d = ImageDraw.Draw(im)
                d.rectangle((0, 0, 8 + 7 * len(label), 18), fill=(0, 0, 0))
                d.text((4, 3), label, fill=(255, 255, 255))
            last_k, last_im = k, im.tobytes()
        ff.stdin.write(last_im)
    ff.stdin.close()
    ff.wait()
    # THE STRIP
    every = float(opt('--strip', '0'))
    strip = None
    if every > 0:
        ts = []
        t = a
        while t <= b + 1e-9:
            ts.append(t)
            t += every
        cols = int(opt('--cols', '10'))
        sw, sh = int(opt('--tile', '300')), None
        sh = int(sw * bh / bw)
        rows = (len(ts) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * sw, rows * sh), (20, 20, 20))
        d = ImageDraw.Draw(sheet)
        for i, t in enumerate(ts):
            im = picture(at(t)).resize((sw, sh), Image.LANCZOS)
            x, y = (i % cols) * sw, (i // cols) * sh
            sheet.paste(im, (x, y))
            d.rectangle((x, y, x + 46, y + 14), fill=(0, 0, 0))
            d.text((x + 3, y + 1), f'{t:5.2f}s', fill=(255, 255, 0))
        strip = os.path.join(out, f'{name}-strip.jpg')
        sheet.save(strip, quality=90)
    gaps = sorted(times[i + 1] - times[i] for i in range(len(times) - 1))
    print(f'{name}: {mp4} ({n} frames at {fps:g} a second, {b - a:.1f} s, box {box}); filmed {len(frames)} pictures, '
          f'{len(frames) / max(1e-6, times[-1]):.1f} a second (the longest gap {gaps[-1] * 1000:.0f} ms)' + (f'; strip {strip}' if strip else ''))


main()
