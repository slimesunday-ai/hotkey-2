# PASS-fringe · the downtown fringe (batch 5)

**Built.** 52 blocks outside section 1 (i −5…6, j −4…2). Code: `districts/downtown/fringe.js` (+ `fill.js`, `lib.js`), 52 one-line block files, 7 heroes. North (Yards): low lofts and garages. West: tenements, pawn, check cashing, fire escapes. South: brownstones, stoops, street trees. East: medical offices, pharmacy, diner. Neutral 36 %. 1–3 roof set pieces per block (fewer than section 1), calm lots between. No trade repeats within a block.

**Heroes.** OUR LADY OF LOST CAUSES, church and soup line (1,1). SKYLOT, garage with a rooftop half-court (2,−4). SOAPBOX, car wash (−4,0). CARUSO SIGN CO. (3,−2). KID GLOVES BOXING (−2,−4). Pigeon coop and safehouse (−5,−1). PULL RATE, a card shop with a release-day line (0,2). Transit: subway MARKET AV, bus JACKSON ST 22.

**Audit.** 76 blocks, 1 issue; the fringe is at 0. A walk-check agent crosses the closed crossing at section 1's dealing corner −1_0 SW and hits −2_0's signal. pedsim `route()` doesn't skip `E.off` edges (`routeFast` does). 13 foci instead of 4 let a random agent find it. **Smoke** fails on that issue alone. Overheads checked.

**Section 1.** Hash diff: 97 identical, 52 changed (all fringe far tiers). `--vs` audit: 0 (was 0), identical ids, boxes and people. The before/after overheads match.

**Performance.** Fringe street views: 225–253 calls. Bench on medium: avenue 243 (max 271), walkers' step max 0.4 ms. On high (auto), the avenue is 311, with no baseline. First view, under four other agents' Chrome runs: 2.16–2.44 s cold (was 1.94) and 1.39–1.50 s cached (was 1.21). Workers-ready rose 0.2 s with 80 new modules, 59 of them mine.

**Requests (systems).**
1. pedsim `route()`: add `if (E.off) continue;`. Untested (proxy test blocked).
2. pool.js fetches optional modules one at a time; parallelize it. A kit-level lot hook would retire the 52 override files.
3. Run tools/reserved.mjs for the new transit and the safehouse.
4. Signage: plaque names and PARK $404 repeat across the city, and the allocator falls back to plain words. The setpiece billboard is sized under 7.8 m. placeDogs ignores yard parts. maxPolarAngle lifts low street cameras.

**Fix round (review: ship with fixes).**
- Lottery: none of it is mine. Allocator boards: LOTTO $64 on the fringe's −4_−1 L0 roof, MONEY BALL $64 on section 1's −3_−2 L0 roof, POWER PICK $64 on a wall at 4_2 L3. "RUN LOTTO" is the core bodega awning (ATM · LOTTO · BEER, gen.js), which sits on 36 fringe corners.
- The discs are the core pizza set piece, at −1_−3 and 1_−2 (section 1) and −5_−2 (strip). The fringe has none.
- Diner: 5_0 L0 is now CODE BLUE (`diner-code-blue.png`). The side's deck had DINER, but no lot ever drew it.
- Church: the "black panel" is the back of the signal's pedestrian box, 3 m from the camera; reframed.
- Caruso: the glove sat on one post only (the other stopped 0.1 m short). Both posts now run into it.
- Audit: 5_0, 3_−2 and 1_1 at 0 issues.

Shots: `shots/downtown-fringe/`.
