# PASS · stitch (2026-09-27)

**Surveyed** every district border, overhead and street, day and night (`shots/stitch/survey/`). Already one city, left as is: Central Ave, Elm St, Washington St, Route 9 by the suburbs, Mill St, Dock St, and every city–woods edge road.

**Fixed**
- **The woods' eight outer bends** (e.g. Pike and Union). Verges stopped short, and bare asphalt poked into the forest floor. The sidewalk now wraps round, far tier too (`forest/plan.js bendCorners`).
- **Night:** the nine corner lamps on woods blocks got no light. Now they do (`main.js placeLamps`), and kits can declare `lamps`.

**The edge**
- **Sea to the horizon:** eight quads round the coarse plane, in its own mesh and material, on the bay's SEA texel (`ground.js seaRing`). No draw call, no job.
- **Route 9** ran on over the sea. `plan.js R9_END` stops it at the coast (z 384), with its paint, traffic, verges and patrols. It ends at a ferry landing (`forest/landing.js`): TICKETS booth, barrier arm, queue, FERRY TO THE MAINLAND gantry and ramp, the GETAWAY, three people at work.

**Load** (first view, 1080p medium, 8 views, cold/cached):
- batch 4: 1.74–1.96/1.00–1.28 s
- before: 1.74–1.99/0.98–1.30 s
- after: 2.04–2.69/1.15–1.58 s

The rise is other agents' new blocks on a shared machine. An interleaved A/B with and without my changes: −27/−20 ms (noise). Draw calls are identical, +2 with the landing in view.

**Proof:** every district but downtown (below) is at 0 issues (`--vs` baselines). 910 of 982 baseline hashes are byte-identical, day and night. The other 72 are my 10 forest blocks and the fringe's far tiers.

**Left for others**
- **Fringe:** smoke fails only in downtown, with 1 `walker-furniture` at −2,0 (an agent meets a signal post). Same without my changes. Yours: Market Ave, Jackson St, Elm St (3rd to Jackson), Route 9 north of Union, and St. Mercy's ring.
- **Water:** the ring copies SEA. Bridge lamps can use `lamps`.

**Requests**
1. Shots drain under the default 380 m haze, so wider haze (the stress view) loses blocks. The review map (`?cam=…&draw=&fog=`) works round it.
2. Fold `R9_END` into `world/city.js`.
