# Fit Street (DROP): pass 1e notes

**Block −3,0 audit** (vs pass-1d `after`): **7 → 0** issues, day and night (`tools/runs/fitstreet*.json`). Refused 1 → 0; people 23 → 29. Street views: 61–157 draw calls.

## Changes
`heroes/fitstreet.js`
- Bar: fascia from row 27 under the neon names; OPEN centred in a wider window, framed; martini and BEER neons.
- DROP: hoodies on a floor-standing rack (they floated); sneaker wall; V-sign arms at 36° on a mast (the tips were in the neighbours' walls).
- Own BAIL BONDS board: bail.money stands on a rear deck at its north end, clear of the face, the lamps and the lettering.
- Deli clerk at the counter (refused before).
- Roof party: DJ, two dancers, a couch; the cooler is out of the tank's leg; the checkerboard survives the mid tier.
- "404.EXE · SANDWICH NOT FOUND" on the deli's back wall.
- Alley gates, dumpster.

`blocks/-3_0.js`: removed the tree in the rope line; moved the Hazel St taxi out of a walker's path; queue spaced to 1.25 m, one person added; bouncer faces the avenue; fire-escape sitter off the railing; two overlapping pairs split.

## For the systems agent
1. `downVol` breaks ties toward the first-visited voxel, so a one-voxel skin over a different fill (sign face over ink, deck over wall fill) shows the fill at mid and far tier. Prefer the outer voxel.
2. The audit misses people overlapping people or railings (HOME acts skip the check) and text blocked from further than one voxel away.
3. `A.clerk` (a plain stand indoors) is always refused.
4. Beyond about 90 m the 4× giant becomes three boxes, and his head reads as a floating black cube.
5. `shoot.sh`'s default `BUDGET=15000` is shorter than a shot build (about 16 s). Use `40000`.
