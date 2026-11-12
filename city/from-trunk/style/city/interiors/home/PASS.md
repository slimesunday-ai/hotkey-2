# Home objects · wave 1 + round 2

76 objects and 195 variants, at 0.05. 44 have a `far`.

## Objects
- **seating:** couch-house, recliner, futon, chair-puffer, sofa-low, beanbag, stool-bar
- **beds:** bed-double, mattress-floor, bed-platform
- **tables and storage:** table-coffee, desk, table-end, dining-set, crate-shelf, dresser, wardrobe
- **electronics:** tv-crt, tv-console, tv-flat, computer-beige, computer-rig, ac-window
- **gaming and music:** console-toastr, console-yolk, console-zigg, gaming-setup, boombox, turntables, speaker
- **wall and rugs:** art-print, poster, art-graffiti, photos-family, art-big, wall-panelling, rug-shag, rug-persian, rug-logo, rug-rag
- **lights, decor, plants:** lamp-table, lamp-arc, neon-sign, ceiling-fan, lava-lamp, fish-tank, plant-monstera, plant-cactus
- **kitchen and bath:** fridge, stove, counter-sink, bar-home, toilet, bathtub, sink-bath, medicine-cabinet
- **collectibles:** sneaker-wall, sneaker-boxes, card-display, toy-case, streetwear-rack, grails-case
- **security and stash:** safe-small, safe-big, safe-painting, door-locks, alarm-keypad, dog-bed, stash-floorboard, stash-book, stash-vent, stash-shoebox
- **clutter:** pizza-boxes, laundry-pile, box-fan, sneakers-kicked

## Round 2 (`extras.js`)
- **ac-window:** an AC in its own window, with accordion panels, a towel and a drip (in the walk-up room).
- **dining-set, sink-bath and medicine-cabinet:** the cabinet (glass shelf, cup) hangs over the new sink.
- **wardrobe:** `states` open (doors at 90°) or closed.
- **fish-tank:** `states` on (glowing) or off.

## For the builder
- `buildObject(o | id, { variant, seed, state, far })` returns a Vol.
- Sizes: seats 0.4–0.45 m, tables 0.6, counters 0.7, bar 0.95.
- Safes follow simassets; the preview's dogs are props.js.

## Checks
All 434 builds fit, with open tops and no loose parts. The preview has no console errors.

## Catalogue v2 (2026-09-28)
75 new pieces (168 variants) in `crime`, `collect2`, `wall2`, `gear`, `base2` and `trophies`. `game.js` gives the 76 older objects their game blocks, and `kits.js` holds the per-tier kits and retags. There are 14 layouts in `assemblies/`. All 151 objects have a `game` block.

- **New by kind:** 38 collectible, 21 trophy, 11 gear, 5 base.
- **New by rarity:** 20 common, 30 rare, 17 epic, 3 grail, 2 legendary, 3 one-of-one.
- **All 151:** 52 base, 51 collectible, 27 gear, 21 trophy.

**Buffs** (proposals; the sim owns the numbers):

| mechanic | pieces | buff |
|---|---|---|
| lock, door, alarm, dog | door-locks, gate-scissor, alarm-keypad, dog-bed | burgleOdds −10, −15, −20, −25 |
| safe | 4 safes | safeTake −.5 to −.8 |
| CCTV | cctv-camera | burgleOdds −10, idBurglar, tip |
| stash | 9 stash-* | stashTake −.15 to −.35 |
| cooking | hot-plate, cook-rig | cook: stove, rig |
| laying low | 7 screens | heatDecay ×1.15 to ×1.3 |
| flex | collectibles | crib +3 to +50 |

**Kits:** trailer 21, apartment 24, house 30, penthouse 23. **Layouts** use no-stakes pieces only. Gear, collectibles and trophies go in slots (2–4 per layout).

**These read lame next to v2:** art-print, card-display, toy-case (blob figures), sneaker-boxes, rug-rag, rug-shag, lava-lamp, tv-flat, alarm-keypad, stash-book.

**Found in older objects:**
- Clipped writes: chair-puffer, beanbag, mattress-floor, table-coffee, safe-small (open).
- Loose far-tier cubes: tv-crt, grails-case and tv-console (all of it).

**FORMAT proposals:**
- a `trophies` category
- `sim` values `cctv` and `door`
- an `event` rarity
- `buff.crib` on collectibles
- layout fields: `on: 'ceiling'`, item `y` and `state`, and the slot object

## Set dressing (2026-09-29)
All 14 layouts re-dressed as sets. `style/city/board-rooms.jpg` shows each before and after, in the same home and cutaway.

- **Zones.** Each room has sleep, lounge, kitchen, hustle and display areas. Big pieces back onto the N and E walls, and rugs sit under the seating's front legs. Art hangs centred over furniture at one eye line (about 1.6 m). Lamps and TVs stand on surfaces. Floor clutter is there only for the story.
- **Sleep.** Every layout has a bed or mattress; the collector's futon folds out.
- **Depth.** Trailers are now 3.5 m deep (most pads are 3.1–3.9), apartments 4.25 m and penthouses 5.75 m.
- **Slots.** Every slot has `fits`. Rug slots became base rugs, because `fill.js` ignores `fits` and could put a non-rug under the couch.
- **New.** `plinth` (`dress.js`), a base display pedestal.
- **Check.** `node style/city/interiors/home/layout-check.mjs [--map]` finds overlaps, unsupported or loose pieces, blocked doors and windows, hidden art, no walk path from the door, a missing bed or `fits`, and stakes items.
- **Camera.** Walk-ups are seen almost head-on, so keep their front half low.

## Hardening (2026-10-05)
- **Check.** `node style/city/interiors/home/check.mjs [--map]` (`layout-check.mjs` now runs it) covers the geometry from 09-29, owned and vacant. It also checks for:
  - a bed sized to the tier, a seat and a kitchen piece (a house needs a fridge; a house or penthouse needs somewhere to eat)
  - dressing minimums that climb with the tier
  - a stash slot, and floor room for room.js's safe and dog
  - slot ids, `fits` and demos
  - a `vacant` set that matches its tier
- **Kitchens added:** first place, collector and laying low (kitchenettes), family and come-up (fridges), gallery (a white bar with stools).
- **Density:** rugs, wall art, cans, moving boxes, vases, speakers and mirrors, per tier. Ceiling fans were tried and dropped: they float over the bed in the cutaway.
- **Vacant** (`room.js`: a clean vacancy builds `A.vacant`). Each tier gets the shell and kitchen, a bare mattress, two moving boxes, a paint kit or box fan, and its own board: trailer, cardboard "4 RENT"; apartment, the red FOR RENT; house, the navy KEY realty LEASE. A penthouse stays the realtor's staged show unit.
- **New base pieces** (`lived.js`): boxes-moving, sign-rent, paint-kit, beer-cans, mirror-lean and vase-floor. `poster` is retagged for trailers.
- **Shots:** `style/city/shots/hardening/homes/` (owned-*, vacant-*, show-*, live-*).
