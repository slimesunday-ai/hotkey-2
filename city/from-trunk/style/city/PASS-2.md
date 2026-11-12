# Pass 2: the district framework (systems)

## What changed

- **District kits.** One `districts/<name>.js` per district, each loaded in isolation.
  - Downtown is the generator as a kit, hash-identical to pass 1d before intended changes.
  - The `suburbs` stub builds the sim's 280 house lots with 0 audit issues.
- **Neutral mix.** 36% of downtown is white, grey or brick, in clusters.
- **Walkers** (`peds.js`). Three tiers, lanes carved around furniture, density from the sim's DEMAND, and a Rush toggle.
- **Isolation.** A broken module shows a magenta placeholder and a red error; the rest loads.
- **Audit.** Fast `block` and `district` modes.
  - New checks: overlapping people, heads in railings, props in pieces, blocked text, walker pinches.
  - Fixes: downVol colours and giant props. Roof figures can stand again (six restored).
- **Layer and shots.** `?sim=demo|live` draws homes (houses and walk-up apartments), piles, hotspots, crowds and patrol cars, using `simassets/` pieces. Turf is deferred. `tools/shots.mjs` renders the fixed shots.
- **Transit.** Two subways, a bus stop and a safehouse, in `simstate/reserved.json`.
- **Docs.** `DISTRICTS.md`, `REFERENCE.md`, STYLE §2, §6 and §9–11, boards.

## Numbers (1080p, medium, cold cache)

- **Calls / triangles / GPU p50:**
  - overview 106 / 1.87M / 1.17 ms
  - avenue 165 / 3.25M / 1.15 ms
  - side street 140 / 2.59M / 0.86 ms
  - stress 123 / 2.97M / 1.38 ms
- **Load:** first view 1.99 s (pass 1d: 1.56 s), fully streamed 3.71 s.
- **Audit (24 blocks): 92 issues and 58 refused placements**, all but one from the new checks:
  - 87 walker pinches (location agents: move the furniture)
  - corners agent: 2 crate sitters' heads in shop bands, 1 old crate in a facade
  - South Row: 1 seated pair too close at 2,0, 1 van in pieces at −1,0

## Section agents must know

- Start with `DISTRICTS.md`, own only your files, and add one manifest line.
- New districts: `life: [0, 0]`, `walkway: .6`.
- Every sim coordinate stays put. Gatehill should be one tower per block, with lobbies at the sim doors.
- Add `&shot=1` to shoot URLs, and audit per block.
- Put a timeout on every background wait, and stop them all before handing back.
- For the sim: a `banks` snapshot field, an apartment tier, estate → penthouse, buses and a subway.
- Latent bugs: `normalize()` forces `s.hero`, so no window leaners; the dog has no piece.
