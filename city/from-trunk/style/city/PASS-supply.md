# PASS-supply: Docks, Heap, Yards

## Built (36 blocks)
- **Low Tide Docks** `districts/docks.js`: fish market, DOCKWORKERS HALL LOCAL 117, marine supply, tug yard. Heroes: `docks-shift.js` (DOCK SHIFT on the goo dig) and `docks-crane.js` (gantry, SALT QUEEN).
- **The Heap** `districts/junkyard.js`: the fence's booth and swap meet on the site. Hero: `junkyard-mountain.js` (scrap mountain, magnet crane, crusher).
- **The Yards** `districts/industrial.js` (27 blocks): generated fill, every name unique. Heroes: `industrial-chopshop.js` (PREMIUM COLLISION) and `industrial-foundry.js` (ST. ELMO).

## Review fixes
- White tyres: my ring tyres, painted white on purpose, not a core bug. Now black rubber on a sprayed line.
- The crane on the BUSY BEE roof is the docks gantry 140 m behind (raycast). Heap landmark and night reframed.
- The COPPER board now stands at the booth. CUTLASS is now CAPSTAN, and two more line names that could crop to rude words were swapped out.
- The street-2 trio is downtown block 3,−4, not mine. Bishop Ave now looks south into the Yards.
- Night glare: a core lamp head above the camera. Camera moved.
- Goo site: a dug pit with a goo pool and veins; demo level .95. The layer sits half a voxel down, so it never shares a face with the piles. See `shots/docks/goo.png` (sim=demo).

## Audit and bench
- 36 blocks: 0 issues day and night, sign repeats included. Section-1 run: 92 issues, the same as PASS-2.
- Draw calls: 46–137. First view: 2.5–3.1 s, but downtown's default view is 2.76 s too. My blocks build in 43–350 ms.

## Requests for the systems agent
1. Hero blocks have no far tier, so they build first across the draw distance. Let `kit.far()` cover them.
2. Strict REG refuses every roof prop. It needs a roofY-aware check.
3. `islands()` stops at 4M voxels and flags solid buildings.
4. Kits need anchors for night lights.
5. Corner zones exist only for section 1.
6. The HUD lists the Heap and the Docks as "not built yet".
7. Downtown 3,−4: three neighbours differ only in hue.
