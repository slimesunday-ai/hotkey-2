# Pass 1b: density

**What changed**
- **New modules:** `lexicon.js` (75 shops, delis, plaques, ghost signs, ads, billboards), `facade.js` (9 window styles, 7 cornices, 6 sign kinds, shop displays, murals, ghost signs, painted ads), `roofs.js` (coloured roofs, 11 scenes, tanks only at 5+ storeys), `yards.js` (fenced yards, alleys), 40 props, 6 one-offs, 18 poses.
- **`gen.js` rewritten:** every axis varies independently; neighbours never share one. Exposed side walls get paint; back walls get windows, AC and fire escapes.
- **Heroes** unchanged but for coloured roofs; DROP's letters are now a V-sign facing both avenue approaches.
- **Fewer draw calls:** ring stamps merge into section banks, the cast bakes into 64-unit regions, walkers share one GPU-animated mesh per material.

**Density per generated block** (18 blocks, `?shot=1` log)
- Buildings: 6–12
- Signs: 16–37 (median 26.5)
- Roof items: 19–46 (median 36.5)
- Characters: 12–22 (median 21)

The cast went from 82 to 469 (26 walking).

**Per view** (calls / triangles, with shadows; pass 1 in brackets)
- random-1: 112 / 8.6M
- random-2: 82 / 5.3M
- random-3: 80 / 6.3M
- interior: 75 / 5.6M
- overview, roofs: 265 / 16.5M (429 / 6.8M)
- civic: 169 / 11.0M (194 / 4.1M)
- fitstreet: 76 / 5.7M (101 / 1.9M)
- night: 76 / 5.5M (105 / 1.8M)
- store: 68 / 4.9M (63 / 1.4M)

GPU (`?bench=1`): overview 4.1 ms mean, random-1 1.7 ms.

**Random blocks:** `RSEED = 1995` (`main.js`) shuffles the generated blocks; the first three are 0,−3 · 2,0 · −3,−3. Each is shot on its widest inner street with the corner's camera: eye 2.9, fov 54, 16 before the intersection.

**Remaining gaps**
- Time to live is 5.3 s (was about 3 s): the cast bakes on the main thread. `chars.js` needs `three`, which module workers can't resolve.
- The cast is 7.8M vertices; laptop untested.
- On narrow side streets the near wall fills the frame.
- Office lobbies are the plainest type.
- Yards are 4–10 units wide, so interiors read tight.
- Traffic is static.
