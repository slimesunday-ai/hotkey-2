# PASS: the water side (batch 5, 2026-09-27)

**Built**
- `districts/jail.js`, `jail/`: Iron Island's six blocks; adopts sea blocks 6…8,−9 (bridge, quay).
- `districts/sea.js`, `sea/`: the six bay blocks with something on them. Water: ground.js SEA `#2f86d8`; surf `#f4f8fb`, `#dcecf6`.
- Island: riprap, surf, the walled compound, three guard towers, the cell block, intake (door on the sim's jail).

**Heroes** (lazy, `far: 'kit'`)
- Visitors (7,−10): BAIL window, queue, IRON ISLAND stop.
- Sally port (8,−10): gates, prison bus.
- Yard (8,−11): court, weights, INSIDE mural, 12 inmates.
- IRON POINT (8,−12): the lighthouse.
- Long Bridge (7,−9): a green lift bridge on Route 9's line: lattice towers, name boards, a lit truss, the checkpoint, an angler.
- Bay: ferry SECOND CHANCE (4,−11), the wreck (6,−12); a tug, launch, lobster boat, breakwater, buoys.

The docks' and woods' edges needed no change.

**Review fixes:** IRON WORKS 1931 is now its own 0.1 m plate, clear of the bracing. A BAIL blade hangs over the queue. The bridge stop has a BUS 9X LONG BRIDGE flag; its OTB is the shelter's signage ad. The yard's "object" is a flying gull, now M-shaped.

**Performance**
- Open water: no far tier, no job. New: 9 far jobs (4–12 ms).
- Builders load only in workers: the live main thread imports 9 KB more.
- Same-minute A/B, cold first view: overview 2.19–2.24 → 2.29–2.31 s; docks 2.05 → 2.17–2.20 s. Cached: unchanged.
- Machine load 8–12 (other agents); session-start baseline 1.94 s (`runs/bay-*.load.json`).
- Street views 17–73 calls; stress 35–58.

**Audit:** jail (9 blocks) and sea (6): 0 issues day and night, walk check 0.
**Smoke:** all pass but downtown (−2,0: 1 walker-furniture, the downtown agent's).

**Requests (systems)**
1. The ped graph is urban-only: no walkers on the bridge.
2. worker.js and pool.js load optional modules one at a time; `Promise.all` saved 20–90 ms.
3. A core way to keep kit builders off the main thread.
4. Patrol cars drive at y 0, but the deck is 0.1 up.
5. A `kerb` reservation tag (I used `plinth`).
6. Run `reserved.mjs` for my two stops.
