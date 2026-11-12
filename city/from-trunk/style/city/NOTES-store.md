# 24/7 Store (2,−3): refinement pass

All changes are in `heroes/store.js`. `blocks/2_-3.js` is unchanged.

## Audit, block 2,−3
- **Before** (`runs/after.json`): 7 issues (3 z-fight, 4 floating-geometry).
- **After** (`runs/store.json`, `store-night.json`): 0 issues, day and night.
- Items 60 → 69, people 22 → 26, refused placements 4 → 3.
- Store view: 111 → 111 draw calls, 2.66M → 2.72M triangles.

## Fixes
- **Rooftop 24/7:** posts braced on the roof, the bar on the posts, every glyph on the bar.
- **Floating panels:** now posters hung from the mullions and transom, plus an OPEN neon.
- **Lot asphalt:** stops one voxel short of L6, L7 and the store's base.
- **L0 and L3:** they reached into the store's back corners, their upper floors on its parapet. They now end at its back wall, and L4 and L5 extend to meet them.
- **Cars:** backed into stalls, clear of the lines.

## Life
- **Front:** an apron, a payphone with flyers, a leaking ICE box, a propane cage, a camera, NO LOITERING.
- **Lot:** a hatched bay, oil stains, a crack, a drain, a cart, pigeons.
- **Inside:** a counter with the register drawer out, a hot-dog roller, LOTTO, coolers, a slushie bar.
- **People:** a stick-up at the counter (clerk's hands up), a caller, loiterers, a lookout.
- **Night:** the fascia, floor and ICE letters glow.

## For the systems agent
- **`A.storeDoor` dropped:** its cast would land in the apron props, so `castspec.js:25` is now dead code.
- **Fragile page load:** `jobs.js` statically imports every hero, so one broken save (a mid-edit `fitstreet.js`) blocked every page for about 4 minutes.
- **L3's drop ladder:** it ends about 0.7 m above the store roof, and the audit doesn't flag it.
