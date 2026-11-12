# PASS · homes (2026-09-28)

Click or tap any home to open its dollhouse cutaway, or use `?home=<id>`. Code: `interiors/city/`.

## What it does

- **Layouts** by lot id and tier, evenly split: houses 98/95/87, trailers 19/22/13, penthouses 8 each.
- **The cut:** gpu.js `CUT` discards the roof, the front slab and the storey interior, so no block is rebuilt.
- **Inside:**
  - security: lock and chain, steel door, keypad, dog, safe;
  - scars: tape, boards, burned, foreclosed, memorial;
  - an asleep owner (zzz); lights by time of day and who's home;
  - slots filled by tier and wealth. A vacant penthouse is a staged show unit.
- **Opening a home:**
  - first open 65–89 ms (modules and demo data included); a new home 19–57 ms; a cached one 0–3 ms;
  - +4 to +7 draw calls, 14–32k tris;
  - frame cost 1.6–4.0 ms open vs 1.8–3.8 ms closed; rAF p50 16.7–16.9 ms, p95 ≤ 19.3 ms.

## Gates

- **First view A/B, cut on vs off (2 runs each):**
  - cold 3.09/2.60 s vs 3.11/2.58 s;
  - cached 1.38/1.33 s vs 1.37/1.34 s;
  - zero within noise. wave1-final's 2.24 s cold predates other passes (285 worker modules vs 271; new bake hash, baked off).
- **Flythrough (high, walk and fly)** matches review2-high: 16.7/16.7/16.8 and 16.7/16.8/16.8 ms, 0 hitches.
- **Block content unchanged:** no file of mine is in the worker bundle.
- **Shots:** `shots/homes/`.

**For interiors/home:** no slot has `fits`; 8 of 14 layouts have no bed.

## Fix round (2026-09-29)

After the Opus play-test (SHIP WITH FIXES). Only `interiors/city/index.js` and its README changed: no block content, no re-bake, main.js and gpu.js untouched.

- **B1, wrong house.** A click now resolves to what is under the cursor. The scene is drawn once into a 1×1 float target: the camera's view is narrowed to that pixel, every opaque mesh is depth-tested, each fragment writes its world position, and the open home's cutaway is honoured. The home whose volume holds that point opens.
  - A house behind a tree, a light, a car or another building is never picked. A click on no home opens nothing.
  - Volumes are fitted: the house rect plus 0.7 m (1.5 m at the front), topped at the measured roof. Depth hits over 44 houses and 54 trailers put the roof at up to 4.5 m over the eave for one storey, 3.6 m for two, and 1.6 m over a trailer's top.
  - Cost is 6–27 ms per click, only on a click. The old ray against boxes (now the fitted volumes) is the fallback if the read fails.
- **B2, tower roofs.** A Gatehill tower's two penthouse anchors (`·N` and `·S`) each own their half of the tower's top: the penthouse storey plus 6 m of roof, split across the middle. The title says "north penthouse" or "south penthouse". Prev/next stays within the tier, so the pair are neighbours.
- **B3, live mode.** Nothing is fetched separately any more. `?sim=live` reads the page's own feed: its layer's model, plus the agents from its diffs, tapped as they arrive (one `pollNow()` on the first open). So `&simport=` and `&simurl=` hold. Lot titles are street addresses from `sim2/places.json`, for example "PAD 1 SUNNY ACRES".
  - The feed carries no cash, so live wealth is the tier's base.
- **B4, sleeper.** The head is 0.84 scale and either propped up (chin down) or turned on the pillow, whichever points the shut eyes most toward the camera. The zzz now sits over the head; its old point was at the feet.

### Gates (real CDP clicks, `shots/homes-fix/`)

- **Reviewer's clicks:**
  - The grey house (house-b) now opens lot:-92,164.
  - The estates overhead's tower-roof click opens lot:-188,208.
  - The other old "mismatches" were aimed at homes hidden from that pixel. They now give what is actually there: street trees, traffic lights and an office facade give nothing; the brick house in front gives lot:-48,145.
- **Pleasantview, 10 clicks from street level to 45 m up:**
  - 8 opened their target.
  - pv-7's aim point was above the flat-roofed lot:-60,176 and landed on the house behind it (lot:-60,164, opened).
  - pv-9 hit a street tree in front of lot:-92,145 (nothing opened).
- **Gatehill roofs:** 3 of 3 (north half, south half, a high oblique). Next and prev step N → S → N → the next tower, all penthouses.
- **Live** (`?sim=live&simport=5262` over `simreplay --for 150`): 3 of 3 owned trailers opened by click, showing "· LIVE" and their owners. 0 console errors, 0 refused connections.
- **Closed cost:** `flythrough --only walk` (high) is identical to review3-high: p50 16.7, p95 16.7 (was 16.8), max 16.8 ms, 0 hitches, calls 343/486.
- **Smoke:** ok, 14 districts.

**Still open:** a walk-up's roof, and an attached garage outside the house rect, open nothing. Walk-up units still open only from their facade.
