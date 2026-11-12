# Shop fit-outs: PASS (2026-09-28)

`interiors/store/fill.js` puts a room behind every main-face generated shopfront: lit walls and ceiling, tubes, tiled floor, and the `fitoutFor()` stock at `far` grain, seeded per shop. The window display loses its back panel (`signage/shop.js` `room`). The stock is near-only; `gpu.js` `vIn` (shortened normals) lifts it 0.3 by day, 0.55 at night. At mid tier the lit shell reads as a tint.

## Coverage
- **Rooms:** downtown 431 (76 blocks), Neon Row 25 (4 blocks), Yards 1 of 1 front (`works.js`, one call).
- **By kind:** takeout 76, bodega 68, general 48, diner 34, barber 30, phones 28, cards 25, pawn 25, office 24, bakery 22, sneakers 19, liquor 14, streetwear 13, pizza 12, checks 7, laundromat 5, pharmacy 5.

## Cost
- **Near-tier triangles:** downtown −4,−2 244k→261k (+7.0%); Neon Row +7.8% / +7.3%.
- **Mid tier:** ≤ +2.4%.
- **Build time:** 677→699 ms.
- **Draw calls:** no new meshes.
- **Loadtime** (unbaked): downtown street cold 2.71→2.59 s, cached 1.42→1.42 s; strip 2.58→2.64 s, 1.44→1.38 s.
- **Flythrough** (high, against review2, stale bake):
  - walk: 0 hitches, debt max 6 (was 5), calls p50 343 (was 410)
  - drive: 0 hitches
- **Smoke:** 0 issues.

## Not reached
- Corner shops' second faces.
- Shops under 3.1 m wide.
- Hero shops: 24/7, bar, the Suburbs corner store, mall ruins, highway, hospital, trailer.
- Estates `luxShop` niches.

Shots: `shots/shop-fitouts/`. Needs a re-bake.
