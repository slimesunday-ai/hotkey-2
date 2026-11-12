# PASS · traffic (2026-09-28)

**Built**
- `traffic/sim.js`: lane graph from the plan. One-ways get one lane (parking on the right kerb). Avenues get one inner lane each way at ±1 (the kerb lanes park). Route 9 gets three lanes each way.
- IDM following, Bézier turns, lane discipline. A car goes on the yellow only if it clears in time. Don't-block-the-box with exit-room reservation. Turning cars wait out WALK. Seeded.
- Spawns only unseen, emptiest lanes first; leaves after 2.5 s unseen.
- `traffic/render.js`: the `vehicles/` fleet (10 models × 2 paints), instanced, `frustumCulled = false`.
  - Round wheels spin at s / r; front wheels steer.
  - Brake plates light while braking; headlight pools at night.
  - Near tier: body and wheels. Far tier: the far body.
- Patrols drive as traffic (`layer.js setTraffic`).
- Walkers wait at the kerb in two files and queue outside the corner. They step off only on WALK with no car on the zebra, and never spawn in the road.
- Stand idle: weight shift, slow turn, breathing, head looks, phone.
- Lanes carve round kept people only: already in `jobs.js:214`; the re-bake carries it.

**Counters**

| | node, 5 min (150 cars, 748 walkers) | page, high (192 cars) |
|---|---|---|
| car–car overlaps | 0 | 0 |
| red runs | 0 | 0 |
| DON'T WALK step-offs | 0 / 2,046 | 0 / 1,827 |
| walker inside a car | 0 | — |
| car into a WALK zebra | 6 | 2 |

- The WALK-zebra residual is straight cars clearing the box after the phase flipped. `crossBusy` holds the walkers, and pixels show no contact.
- Traffic update: 0.82 ms (step 0.70), max 1.05–1.7 ms.
- On-screen car spawns/removals: 0/0.

**Gates**
- Flythrough (high) vs review-high: p95 16.7–16.8 ms, 0 hitches, pop debt unchanged. The walk path shows 2 walker on-screen spawns (was 0).
- Smoke: 0 walker overlaps everywhere. Downtown has 9 walker-furniture issues: the streets agent's newsboxes and sandwich boards on crossings.

**Shots** (`shots/traffic/`): `queue-00…09`, `crossing-00…09`, `turn-0…3` (a right-turner held in the box for WALK), `wheel-0/1` (+crops), `avenue-0/1`, `night-*`.

**Left**
- The WALK residual.
- No MOBIL lane changes.
- Weak turn and night shots.
- Re-bake.

## Fix round (2026-09-28, after the play-test review: SHIP WITH FIXES)

**Fixed**
1. **Density.** `TRAFFIC.per100` is now 4.6 / 9 / 5 (street / avenue / Route 9), and `TRAFFIC.dist` scales it by district. Downtown and its fringe are 1, the strip .85, the suburbs .35 and the woods .2. A lane counts its busier side. The population cap is 60–420.
   - IDM is now a 2.2, s0 1.6, T 1.0. Each driver varies v0 ±12 % and a and T ±20 %.
   - The density alone gridlocked the grid: moving fell from 53 % to 25 % in 5 minutes, and even the old density decayed the same way. Four causes, four fixes:
     - A turner waiting out WALK at the head of a one-lane approach held the queue. Now a driver who meets WALK on the green keeps straight on where it can.
     - Walkers anywhere on a zebra held cars. Now a car waits only for a walker in its path (within 0.7 m of its swept band, or heading into it).
     - Exit room was counted at 1.4 m plus 4.3 m. Now it is counted at the jam gap, so an empty block takes three cars.
     - Spawns landed in front of cars already bound for a lane. They no longer do.
2. **Stop at the bar.** The 2 m pull-back on two-way roads is gone, and `STOP_BACK` is 2.5. Noses now stop at hw + 2.6 against a bar at hw + 2.1–2.45 (Main × Central: 6.6 m, was 8.7).
   - The pull-back existed because a left turn off a one-way onto a two-way road swings its body across the centre line into the waiting noses. Those optional left turns are now dropped (no left turn onto an avenue).
   - Where a left turn is the only way on, the lanes opposite step back just enough to clear its sweep (`sweepClear`). In today's plan that is zero lanes.
3. **WALK-zebra entries.** Going straight through a signal, the body must clear the far zebra before its WALK starts (end of yellow plus all-red), at a pace the car can make (`clearT`). Otherwise it stops while it still can. A straight car with walkers on the far zebra waits at the line, not in the box. `TIMING` is unchanged.
4. **Turns.** A turner held for walkers on the zebra it turns over (or that zebra's WALK) waits at the line. It waits in the box only if the box holds it clear of the zebra behind it, which today's arcs never do.
5. **Box truck and city bus** are in traffic.
   - A long body keeps straight and turns only where the arc radius is at least 0.75 × its length (radius is now measured on the curve).
   - The bus runs on the avenues only, with its own per-district share in `render.js BUS`, because its registry mix is empty.
   - Long bodies spawn clear of the zebra behind them.
6. **Live mode.** `main.js` calls `setTraffic` in the `?sim=live` branch too, so the replay's patrols are traffic cars. `layer.js` is unchanged.
7. **Draw calls.** The registry fleet is three BatchedMeshes (near bodies + brake plates, wheels, far bodies), filled per frame with `setGeometryIdAt`, `perObjectFrustumCulled`, and `frustumCulled = false`. That is 4 traffic draws (the bodies also cast shadows); before, there was one InstancedMesh per model and part (~75).

**Counters.** Node, 5 min, 748 walkers (focus 0,−30 · 0,0 · with box trucks and buses · suburbs):

| | before (same harness) | now |
|---|---|---|
| cars | 150 | 212 · 203 · 212 · 60 |
| car–car overlaps | 0 | 0 · 0 · 0 · 0 |
| red runs | 0 | 0 · 0 · 0 · 0 |
| WALK-zebra entries | 6 | 0 · 0 · 0 · 0 |
| cars held on a zebra | 271 | 0 · 0 · 0 · 0 |
| walker inside a car / DON'T WALK step-offs | 0 / 0 | 0 / 0 |
| moving | 21 % (gridlocked by 2 min) | 40 · 43 · 45 · 40 % |

- **Main × Central** (node 0,0; each approach's per-cycle values listed in cycle order):
  - Queue at red: 3–6.
  - Entries per green: 0–6, median 4 (a low one is the block beyond still full). Before: 0–2, then gridlocked.
  - The first car goes 0.3 s after the green.
- **Page** (high): 335–369 cars. Traffic update 0.8–1.0 ms (step 0.75–0.88 ms). On-screen spawns and removals 0/0; red runs 0; WALK entries 0.
  - Overlaps were 0 in three runs, and 2 frames in the first run (not reproduced).
  - Live replay: 3 patrols, all on lanes (one-ways on their travel lane), following lights.

**Gates**
- Flythrough (high, `tools/runs/tfix-high.fly.json`) against review2-high:
  - Frame p50 / p95 / max 16.7 / 16.8 / 16.8 ms on walk, drive and fly; 0 hitches.
  - Draw calls: walk 343/417 (was 410/493), drive 319/622 (was 387/671), fly 431/570 (was 448/620).
  - Pop debt the same or lower.
  - One walker on-screen spawn on the drive path (walker side).
- Smoke: node 148/148 imported. 13 of 14 districts audited with 0 issues, 0 walker overlaps and 0 furniture issues. The mall gave no report within 7 min in the full run; alone it passes in 7 s (9 blocks, 0 issues). Traffic doesn't load in report mode.
- `bake.mjs` was not run.

**Shots** (`shots/traffic-fix/`)
- `queue-00…17` + `sheet-queue`: Main St northbound into Central, 4 queued on red, then discharged on green.
- `turn-00…19` + `sheet-turn`: a right turn at Ivy × Central, arc to lane, every 0.25 s. A bus runs through in traffic.
- `live-patrol-0…2` + `live-patrol-0-crop`: a P9 cruiser in a one-way's travel lane under `?sim=live&simport=5262`.

**Left**
- Turns are rarer (~7 % of box entries, was 31 %) because turners that meet WALK go straight.
- No MOBIL lane changes.

## Fix round (walkers) · 2026-09-28

**Corner clumps** (`pedsim.js KERB`)
- On DON'T WALK a corner fills in order: file 0 at the kerb, the second file's spot, then a row along the kerb (0.72 m apart). Each newcomer takes the file's spot and the row shuffles one place along. The rest queue behind the corner, 0.78 m apart where they used to stand 1.1 m apart.
- On WALK the row drains back into the second file, in order, and pours across.
- The row's length comes from three things:
  - the clear kerb strip, which `engine.js lanesOf` now bakes per side end as `kz` from the build's own obstacles;
  - the next sidewalk's lane passing behind the row;
  - street demand: 3 places downtown, fewer where it is quiet, one fewer at a side street.
- Crossings at avenue corners now draw more walkers (`KERB.pull`).
- Node, 5 min, standing within 6 m of a corner at the end of each DON'T WALK:
  - downtown avenue crossings: median 4, p90 7, max 9;
  - suburbs: median 2, p90 4.
- In the page, an avenue corner had 7 waiting, 5 of them at the kerb, and they crossed within about 4 s of WALK.
- Stall fixes:
  - The second file took the first file's waiter as its lead, so a newcomer stalled at the corner node until WALK.
  - A dog owner stopped short in the second file held the corner.
  - A starved stream's slow head kept renewing the corner lock, which left crossing walkers standing in the road.
  - Result: stuck walkers (over 45 s), node, 5 min: 43 → 0.

**Walker–furniture** (full downtown audit, 60 s): 114 → **0**.
- The files now step up onto the corner's own line at the far kerb; they used to step up 0.7 m out, into the kerb strip.
- The row stands exactly at its checked spot.
- `gen.js`: a newsbox, or a sandwich board out by the curb, whose spot falls on a crossing approach (the kerb strip within 4.6 m of a corner) is left out and logged. It is not slid along, so the generated cast keeps its ids; all 24 override person ids still point at the same people.
- Downtown newsboxes: 155 → 92. Sandwich boards: 374 → 368.

**People in travel lanes** (every built block: 532 blocks, 1,389 people): 3 → **0**.
- `blocks/-1_0.js`: the cars pass parked `traffic·car·1` and `·2` in the NO QS van's spot. The van and the road box were refused, one mover was left out, and the other was pushed into Main St's southbound lane. Both cars are now removed, and the movers stand in the parking lane.
- `districts/highway/build.js`: the semi's two buyers stood in Route 9's outer lanes; they are now on the kerb.
- New audit check: `char-in-lane` (`audit.js laneAt`).

**Counters** (node, 5 min, cars and walkers; 4 runs: downtown with and without `kz`, Neon Row at night, suburbs), all 0:
- DON'T WALK step-offs (out of 2,454–4,675 step-offs per run);
- walkers inside a car (any walker at road level);
- walker overlaps;
- stuck walkers.
- pedsim step: 0.16 → 0.26 ms for 767 walkers with the row.

**Walk flythrough** (high): on-screen spawns and removals 0 / 0.
- The one spawn seen in one run was a walker 290 m out that the turning camera swept into the edge of the view. `peds.js` no longer counts a walker that was out of view the frame before.
- `stats().log` lists the last 16 continuity events.

**ONE WAY** (`street.js`): the plate was 1.2 × 0.3 m with 14 cm letters.
- It is now an R6-1 at 1.62 × 0.51 m: black plate, white border, big white arrow, 21 cm black ONE WAY.
- It hangs flag-style off the pole on a short bracket, along the one-way street into the block:
  - clear of the WALK / DON'T WALK boxes;
  - under the lenses;
  - over walkers' heads;
  - never behind the pole.

**Gates**
- Smoke: 14 districts, 0 issues.
- Downtown district audit: 0.

**Shots** (`shots/walkers-fix/`):
- `clump-st-*` and `clump-obl-*`: 22 frames, 0.5 s apart, across the WALK onset; the overview is `clump-sheet.jpg`.
- `newsbox` (the former newsbox corner).
- `figure` and `figureHi` (Main St's figure spot).
- `owCorner`, `owNear`, `owAgainst`.

**Left**
- Re-bake. Until then, baked lanes carry no `kz`: walkers keep the old second file and get no row, and the old sign stays.
- The Route 9 semi (`highway/build.js`, x 229.6) stands in the outer northbound lane, and cars drive through it.
- 63 downtown corner newsboxes are gone; they can be hand-placed.
