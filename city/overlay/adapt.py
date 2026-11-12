#!/usr/bin/env python3
# Makes city/overlay/** from the pinned city (city/from-trunk/**): every change is one asserted replacement, so the
# overlay can be rebuilt when the pin moves and each change can be offered to trunk as a diff (city/overlay/*.diff).
# demo/serve.mjs answers a request for /city/from-trunk/<path> from city/overlay/<path> when that file exists.
#
#   python3 city/overlay/adapt.py            the playtest map's street plan (below)
#   python3 city/overlay/adapt.py --walk4-x=-3,-2 --walk4-z=1 --wide-x= --wide-z= "--kinds="     the same, spelled out
#
# Run from the repo's root. The pinned files are read, never written.
#
# THE PLAYTEST MAP'S STREET PLAN (2026-11-12). Two switches, each a list of street lines by index (x lines: -3 Hazel St,
# -2 Ivy St; z lines: 1 Washington St):
#   --walk4-x / --walk4-z   ON for Hazel, Ivy and Washington. A 4 m SIDEWALK WITH NO BLOCK CHANGED: the right-of-way
#                           stays 6 m a side and the road goes from 6 m to 4 m (half-width 3 -> 2, the city's own
#                           side-street road before the spread), still one-way. No interior moves, so no block is
#                           re-rolled, Fit Street keeps its size and the registered flats keep their doors.
#   --wide-x / --wide-z     OFF. A 5 m sidewalk: an avenue's right-of-way (8 m a side) with a side street's road and
#                           class. It was built and looked at (2026-11-12): kerbs, zebras and lanes are clean, but every
#                           block beside the line loses 2 m, so the generated tower and fringe blocks along the WHOLE
#                           line come back as different buildings, DEAD AIR shrinks from 9 x 11 m to 7 x 9 m, and the
#                           registered flats are 2 m off their doors until apartments.json is regenerated (the city's
#                           tool for that is not in the pin). A day's job: left here for it.
#   --kinds                 OFF. 'i,j,kind;...' sets block kinds (world/city.js setK).
import os, sys, difflib

def opt(name, fallback):
    for a in sys.argv[1:]:
        if a.startswith(name + '='): return a[len(name) + 1:]
    return fallback
ints = lambda s: [int(v) for v in s.split(',') if v.strip()]

WALK4_X, WALK4_Z = ints(opt('--walk4-x', '-3,-2')), ints(opt('--walk4-z', '1'))
WIDE_X, WIDE_Z = ints(opt('--wide-x', '')), ints(opt('--wide-z', ''))
KINDS = [k.split(',') for k in opt('--kinds', '').split(';') if k.strip()]

PIN, OUT = 'city/from-trunk/', 'city/overlay/'
def adapt(path, edits):
    src = open(PIN + path).read(); s = src
    for old, new in edits:
        assert s.count(old) == 1, ('NOT FOUND x%d in %s: ' % (s.count(old), path)) + old[:110]
        s = s.replace(old, new)
    os.makedirs(os.path.dirname(OUT + path), exist_ok=True)
    open(OUT + path, 'w').write(s)
    diff = ''.join(difflib.unified_diff(src.splitlines(True), s.splitlines(True), 'a/' + path, 'b/' + path))
    open(OUT + path.replace('/', '__') + '.diff', 'w').write(diff)
    print('overlay: %s (%d replacements)' % (path, len(edits)))

js = lambda v: '[' + ', '.join(str(n) for n in v) + ']'
adapt('world/city.js', [
    # block kinds (none tonight)
    ("setK(7, 7, 4, 4, 'G');",
     ''.join("setK(%d, %d, %d, %d, '%s'); " % (int(i), int(i), int(j), int(j), k) for i, j, k in KINDS) + "  // HOTKEY 2 (city/overlay/adapt.py): the playtest map's own block kinds\n"
     "setK(7, 7, 4, 4, 'G');"),
    # a wide line is NOT an avenue (aveX / aveZ stay false: one-way, a side street's signals, lanes and paint)
    ("const rw0X = L => L === HWY ? 9 : XAVE.has(L) ? 6 : 4, rw0Z = L => ZAVE.has(L) ? 6 : 4;",
     "// HOTKEY 2 (city/overlay/adapt.py): the playtest map's street plan. WIDE: an avenue's right-of-way with a side street's road (5 m\n"
     "// sidewalks; the blocks beside it lose 2 m). WALK4: the right-of-way unchanged and a 4 m road, so a 4 m sidewalk and no block changed.\n"
     "const WIDEX = new Set(%s), WIDEZ = new Set(%s), WALK4X = new Set(%s), WALK4Z = new Set(%s);\n"
     "const rw0X = L => L === HWY ? 9 : XAVE.has(L) || WIDEX.has(L) ? 6 : 4, rw0Z = L => ZAVE.has(L) || WIDEZ.has(L) ? 6 : 4;" % (js(WIDE_X), js(WIDE_Z), js(WALK4_X), js(WALK4_Z))),
    ("export const hwX = L => L === HWY ? 7 : XAVE.has(L) ? 4 : 2 + SPREAD / 4, hwZ = L => ZAVE.has(L) ? 4 : 2 + SPREAD / 4;",
     "export const hwX = L => L === HWY ? 7 : XAVE.has(L) ? 4 : WALK4X.has(L) ? 2 : 2 + SPREAD / 4, hwZ = L => ZAVE.has(L) ? 4 : WALK4Z.has(L) ? 2 : 2 + SPREAD / 4;"),
])
