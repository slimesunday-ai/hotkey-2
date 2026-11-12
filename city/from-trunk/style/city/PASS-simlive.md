# PASS · sim live (systems agent, 2026-09-27)

**What changed**
- **`?sim=live&simport=`** draws the running sim:
  - homes, piles, hotspots and patrol cars
  - the sim's agents as walkers in their own looks: standing at places, walking trips, jailed in the county jumpsuit
- **Day and night follow the sim's clock** (a reload). SIM OFFLINE shows during outages, with backoff.
- **Off the frame:** a worker feed sends diffs into one BatchedMesh; looks bake in a worker.
- **`tools/simreplay.mjs`** serves a recorded run as `/state`, minute by minute.
- **`simstate/stands.mjs`** writes 171 stand spots at 21 places.
- **`pedsim route()` skips closed crossings:** the downtown walk-check fix, which the fringe agent traced.
- `SIMLIVE.md`: how to run it, the mapping, the gaps.

**Numbers**
- **Soak** (10 min):
  - frames p99 18.7 ms, none over 50
  - 0 overlaps
  - 3 day/night reloads
  - a 25 s outage: badge on, then off
  - 0 page errors
- **Per poll:** under 2 ms in the worker, ≤ 0.6 ms on the main thread.
- **Per frame:** layer p95 ≤ 2.3 ms; agents ≤ 0.8 ms.
- **Bench** (base → live):
  - p50 unchanged, p95 +0.4 ms
  - stress fly-over's worst frame 25 → 47 ms: the first draw of each Gatehill lobby
- **Demo and no-sim:** pixel-identical before and after (7 views, A/B).
- **Smoke:** all 14 districts at 0 issues and 0 overlaps; downtown's full audit is back to 0.

**Notes**
- Re-run `stands.mjs` after ground changes round a sim place (the jail's spots: the 11:45 kit).
- A hero slot's `place:` keeps its spots in that block.
- **Requests:**
  - the sim: export `banks` and the swap-meet listings
  - simassets: board pieces and a dog
  - walker paths inside compounds (Sunny Acres, the Heap, the mall), where agents appear now
