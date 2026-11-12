# PASS · animation merge (2026-09-29)

The lab's walk v2, turns and idles are in the city, imported from `anim/` (see `anim/MERGE.md`).
- **Near walkers:** closed 13-part bodies (`pedbake.js`), drawn by `walk2.js` from per-instance texels.
- **Turns (`pedsim.js`):** corner arcs laid on the lanes (r 0.8 m, cached). Heading rate-limited on every tier. Standing turns shuffle.
- **Idles:** stopped walkers blend in. At the kerb they play the crossing wait, glancing at the far ped box; elsewhere, one of the lab's eight.
- **Mid, far:** unchanged.
- **Sim agents:** `simstate/looks.js` now uses `bakeSegFull` (outside my list: two lines).
- **Kept scene people:** they keep their idles (my call). The lab's idles need segmented bodies, which would mean a character re-bake.

| gate | result |
|---|---|
| smoke | 14/14, 0 issues, **0 overlaps** |
| flythrough (high) vs review3 | same p95 (16.7–16.8), 0 hitches, walker pops **0/0** |
| walker update, p50 | 1.60 → 2.04 ms (animate 0.07, heading 0.05, arcs 0.10) |
| near GPU, 1080p | +0.12 ms (100 walkers) |
| z-fight, city close-ups | 0.45 day, 0.48 night per 1,000 px (lab: 0.47) |
| see-through | 1-px silhouette hairlines only: 5 of 592 day frames, 1 of 250 night (camera-inside-walker frames excluded) |

- **Live agents:** all are in segmented looks, and the ones at a spot idle. None walked in the replay window.
- **Re-bake:** blocks and character tiers are unchanged, but the bundle hash moved.
- **Shots:** `shots/anim-merge/`
