# PASS · fidelity + pedestrians (2026-09-28, three rounds)

**Lettering**
- Cause: mid `downVol` voted per 2×2×2 cell. A 1-voxel stroke is half a cell, so strokes broke into dashes.
- Fix: `vox.js midOf`: outside colour per cell, ties keep the line, text and wall paint meshed at 0.1.
- `tools/lettering.mjs`: 4,066 surfaces; **87** break by day, **127** at night (was 3,967). Mid +1.9 % triangles.

**Walkers**
- Causes:
  - Dropped by distance while on screen; `charbake.js` had a far-box line inside a comment.
  - **Zoom round:** arrivals landed anywhere unseen, so after moving forward the streets in view fell to 19–62 % density.
- Fixes: walkers live to `charFar` and leave only unseen. They arrive only out of view, emptiest edges first (a 30 m band past the range); over-full edges shed unseen walkers.
- Results:
  - In-view density after moves is now 69–120 %.
  - On-screen removals and spawns are **0/0** on 8 paths, the zoom included. Also 0 on high, at night, and under `?sim=live`.
  - Zoom: visible 459 → 325; parking at the end camera gives 332 (a narrower street, not lost people).

**People** (slime's call)
- Retired **584** of 1,388: all in downtown.

  | reason | count |
  |---|---|
  | generator standers | 411 |
  | shop-door customers | 166 |
  | block-file adds | 7 |

- Kept **804**:
  - downtown 640, estates 96, jail 27, hospital 15, strip 11, highway 9, sea 3, forest 3
  - by activity: sit 222, window 115, arms 80, stand 61, dance 50, fire escape 47, lounge 34, garden 30, queue 28, other 137
- Animation classes: dance 50, stand 205, sit 316, lean 135, work 85. The 13 giants stay still.
- Decided in `castspec.js` and `charbake.js`; queues are rows facing along themselves.
- Hashes: block tiers identical on 532/532; character tiers changed on 109 blocks.
- Bench (medium): animation costs GPU p50 +0–0.11 ms; frames unchanged.

**Gate:** smoke 14/14, 0 issues, 0 overlaps.

**Shots** (`shots/fidelity/`): `lettering/`, `sweep/`, `worst-offenders`, `walkers-sequence`, `people/`.

**Streaming agent**
- Lanes still bend round retired people: filter `bakeCast` retirees before `lanesOf` in `jobs.js`.
- The baked codec drops `t.X`/`t.Y`, so baked people won't animate.
- Re-bake.
