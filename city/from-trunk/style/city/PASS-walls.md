# PASS · walls

**What.** The paint layer lives in `walls/`:
- `index.js` places the paint, runs the lattice and colours the far tier.
- `paint.js` holds the painters.
- `roster.js` holds 24 invented writers and the words.

One core hook object, `vox.js HOOKS`, is called from `meshVol` (walls) and `stamp` (things); `facade.js` registers it. No kit was edited.

**How.**
- **Bare wall:** a pixel counts when its skin is the wall colour or its siding shade, the 0.3 m in front is empty, and no other building hides it.
- **Paint:** only bare skin is recoloured, so windows, signs, murals and heroes are never covered. Relief stays within 0.2 m and is kept with `REG.keep`.
- **Variety:** murals and pieces come from a class lattice, ads from the signage pool. A writer's tag appears once per block at most; tags keep 0.9 m off signs and painted panels.

**Round 2.**
- **The Heap:** 23 marks, including 3 pieces. Street-facing fences get a one-sided decal (a grown voxel layer, never mirrored); booths, stalls and the crusher take marks too.
- **Memorials:** 5 in all (MARISOL, DARNELL, BEBE, DOLORES, LUZ). Each has its own portrait frame, palette, title and offerings (candles, flowers, bottles, photos, a teddy).
- **Things:** some dumpsters, tanks and news boxes carry a small tag (a cached copy of the template). The city has no utility boxes.
- **Load:** cheap exits, memoized ad fits, and far-only builds skip small marks.

**Checks.** Audits 0 issues; smoke passes; overheads checked.

**Shots** (`shots/walls/`):
- 01–10: first pass
- 11: the Heap
- 12–15: memorials
- 16: a dumpster

**Gaps.**
- Pleasantview and Gatehill have no bare wall big enough.
- Tank tags are rare, because tall roofs are rare in the heavy districts.
