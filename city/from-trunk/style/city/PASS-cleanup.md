# PASS · cleanup (systems agent, 2026-09-27)

**Load** (1080p, medium; per view: `tools/runs/{baseline,final}-cleanup.load.json`; before → after)
- Overview: first view 2.89 → **1.24 s** cold, 0.80 → **0.71 s** cached; fully streamed 9.02 → 4.24 s.
- Every district overhead: 2.53–2.96 → **1.22–1.33 s** cold, **0.65–0.76 s** cached. Stress: 1.28 s cold.
- Heroes are lazy: far tier first (their build downsampled), full build near.

**Draw calls:** overview 105–110; overheads 45–146; street views 180–219 p50, 267 max.

**Walkers per 100 m**, day / night (target):

| downtown | Neon Row | Yards | docks | Heap | Sunny Acres | mall | Pleasantview |
|---|---|---|---|---|---|---|---|
| 13.1 / 13.3 (13 / 13) | 10.0 / 18.8 (7.7 / 24.5) | 7.8 / 10.4 (7.7 / 9.8) | 8.1 / 13.6 (6.7 / 13) | 5.8 / 6.2 (4.8 / 4.3) | 11.3 / 13.8 (9.8 / 13) | 6.1 / 6.1 (5.6 / 5.2) | 6.6 / 11.8 (6.7 / 11.9) |

Neon Row trades walkers with downtown: its night peak is below target.

**Audit:** section 1 **92 → 0** (`AUDIT.md`). All 8 districts are at **0**, including the 60 s walk check.

**Avoidance:** the whole walker step (~800 walkers) takes 0.2 ms p50 and 0.3–0.6 ms p95 per frame; avoidance is 0.1–0.2 ms of it (`?avoid=0` A/B). No overtaking on any preset.

Walk check, every district: **0** walker–walker, walker–agent, dog–walker and walker–furniture overlaps.

**Notes for the next section agents**
- The clear walkway rule now binds hand-placed props and people. Check the audit's skipped list for `moved …` and `(hand-placed) left out`. Facade parts on a sidewalk ask first, via `REG.why(frame.world(…))`.
- Person ids: hand-placed people are `i_j·char·h<k>`. Generated ids shift when the core changes, so re-check any `people.move` / `remove`. I re-mapped section 1's.
- Gate before handing back: `node style/city/tools/smoke.mjs` (2 min); look at every `shots/smoke/` overhead.
- A hero slot may set `far:` (DISTRICTS §2). Window leaners and dogs are on (`windowPeople`, `PED.dogs`).
- Builds no longer depend on build order (memoized prop variants, template mid/far meshes): a district alone hashes like the whole island.
- Open requests:
  - Sim hotspots (`?sim=`) are not walker obstacles.
  - `normalize()` still gives every lot the pass-1 roof: themed, no roof people. I kept this as the approved look.
- Neon Row matches `shots/strip` except for walkers and one wall ad (changed by the signage pass, before this cleanup).
