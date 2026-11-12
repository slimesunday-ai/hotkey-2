# PASS-streets · one-way side streets, live signals

**One-ways** (`isOneWay`, `oneWayDir`):
- **Markings** (`ground.js`): no centre line, an arrow past each end's crossing, approach-side stop bar. Avenues, Route 9 and crosswalks unchanged.
- **Signs** (`street.js`):
  - **ONE WAY:** on the corner signal poles, arrow along `oneWayDir`.
  - **DO NOT ENTER:** on the lamp at each block's exit end, facing the intersection.

**Signals:**
- **Poles:** two per N–S × E–W node, at its NW and SE corners (`ground.js signalPoles`, `SIG`). 55 T-junctions get one; 4 L-bends get none.
- **Heads:** four-faced (every approach sees two); avenues add a mast-arm head. Lenses baked dark.
- **Live layer** (`traffic/lamps.js`):
  - **Draws:** four instanced (lenses, night halos, hands, walkers).
  - **Scope:** within 170 m, on full or mid blocks only.
  - **Hook:** a chained `scene.onBeforeRender`, created in `ground()`; main.js is untouched.
  - **Culling:** `frustumCulled = false`.

**Timing:**
- **Greens:** avenue 24 s (was 22), even 18 s (was 16). Every node now runs one 44 s cycle, so the 3 s/block waves no longer drift.
- **Clock:** `?tclock` seeds the clock; with `?shot` it also pins it.

**Gates:**
- **Smoke:**
  - **This pass:** 0 issues.
  - **Remaining failures:** downtown and suburbs walker issues, identical in A/B runs with the old furniture.
- **Flythrough** (walk, drive):
  - **Frame times:** 16.7/16.7/16.8 ms, 0 hitches, pop-in debt as in review-high.
  - **Cost:** +8 draws; the lamp update takes 0.065 ms per frame.
  - **Caveat:** unbaked, like a same-session run without this pass.
- **Bake:** stale. Re-bake.
