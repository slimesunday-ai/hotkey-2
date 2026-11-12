# Pass 1: Downtown & Fit Street

**Built.** 24 blocks on the real plan (x −96…96, z −96…32), with roads and names from `world/city.js`. Heroes are hand-made; every other lot comes from the rule generator (walk-up, brownstone, bodega, loft, office, tower, shop, parking), plus furniture and traffic. 82 `chars.js` characters, 8 of them walking. A coarse neighbour ring and landmark towers end each avenue in haze. Day + night.

**Sim places** (coordinates kept)

| Place | Stands there |
|---|---|
| Fit Street [−80, 16] | The Springfield corner on real lots: DROP with its queue and roof letters, 404 DELI, a BAIL BONDS giant, the DEAD AIR roof party, a giant pizza slice, a stoop |
| Glasswall Plaza [16, −16] | Fountain, red 404 sculpture, cubic trees, benches |
| Hall of Justice [16, −48] | Steps, colonnade, gold dome, chrome "Lady Justice" |
| Precinct 9 [48, −16] | Blue station house, giant 9, radio mast, cruisers |
| 24/7 Store [80, −80] | Orange box, parking lot, giant rooftop 24/7 |
| Four dealing corners | Crews of 3–4, crates, payphone |

**Per view** (draw calls / triangles, including shadows)
- drop: 43 / 1.0M
- store: 63 / 1.4M
- fitstreet: 101 / 1.9M
- night: 105 / 1.8M
- corner: 153 / 2.8M
- civic: 194 / 4.1M
- overview: 429 / 6.8M

**Speed.** Live in about 3 s (8 workers). 60 fps (worst frame 16.8 ms) on the Mac Studio; laptop untested.

**Known gaps**
- The overview is over 300 calls and roof-grey.
- Traffic is static.
- The DROP letters are edge-on from the avenue.
- Block cores are empty.

**Next section.** *Neon Row*, x −96…128, z 32…96: the strip nightlife blocks and the Maple & Washington corner. Night-first, to stress-test neon.
