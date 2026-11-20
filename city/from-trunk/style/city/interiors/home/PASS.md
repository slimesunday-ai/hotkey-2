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

## Fine pass (2026-11-17)
Kit pieces can now carry detail finer than a voxel: the traits' fine paint (4 × 4 texels a face) and fine voxels (half size), from a piece's own `fine(P, opt)` (FORMAT.md "Fine detail"). `../fine.js` runs it, `vox.js` `meshVol` draws it in every place a piece is meshed, and the far tier folds it into its voxels' colours.

- **Budget:** 192 painted faces and 64 fine voxels per piece, per variant and state. `fine-check.mjs` gates on it.
- **Proof pieces:**
  - `hot-plate`: a painted coil glowing on a black plate; an enamel saucepan with a chrome rim, a long handle and neon bubbling under the rim; knobs with ticks and a pilot light; a cord.
  - `cook-rig`: a blue flame under a stockpot with a thermometer in it; the flask's pink fill seen through the glass, with ticks, a cork and a hose to the pot; banded jugs; a gas bottle; a ruled notebook and a pen.
  - `computer-desktop` (new, `hustle.js`): a late-1990s PC with a teal desktop, grey windows, keys, drive bays, lights, speakers and a mouse on its pad.
- **Cost** (`fine-check.mjs --cost`):
  - hot plate: 270 → 1,012 triangles
  - cook rig: 1,642 → 2,982 triangles
  - desktop PC: 2,368 triangles
  - build and mesh: about 1 ms more per piece

### Detailing pass (2026-11-17)
The fine pass is on every piece THE RUN uses where it helps the piece read at shop size and in a room:

- **Earners:**
  - `stove`: painted coils on chrome pans, one glowing; knob marks; a 9:00 clock; the oven rack.
  - `counterfeit-press`: the notes' faces and paper edges; ruled sheets; the crank's spokes.
  - `sneaker-rack`: soles' tread and stripe; stitching; eyelets.
  - `streetwear-rack`: tee prints; hoodie pockets and drawstrings; zips; varsity letters; price tags.
  - `scale-digital`: lit 28.0; the baggie's zip and grains.
  - `burner-drawer`: keypads and screens.
  - `card-slab`: the grade 10; the card's figure.
  - `money-counter`: lit $9,700; buttons; notes.
  - `computer-beige`: green terminal text; real keys; the floppy's shutter.
- **Defences:**
  - `door-locks`: cylinders, keyways, screws.
  - `safe-small`, `safe-big`: round dials with ticks and a pointer; handle ends; keyholes; rivets.
  - `safe-floor`: dial ticks; collar bolts.
  - `alarm-keypad`: ARMED or READY on its screen; marked keys.
  - `cctv-camera`: a real lens; infrared dots.
  - `dog-bed`: a tartan; a stitched cushion; kibble.
  - Every stash:
    - floorboard: seams and grain
    - book: page edges and a gold title
    - vent: louvres and screws
    - shoebox: a lid mark and label print
    - speaker: cone rings and a badge
    - encyclopedia: volume letters
    - soda: a ring-pull
    - outlet: real sockets
- **Fight kit:** `gun-rack`: checkered grips, stock grain, ports, bores.
- **Home:**
  - `bed-double`: quilting, pillow seams, the tee's print.
  - `fridge`: the photo's picture, the kid's drawing, the menu's print.
- **Carried:**
  - `duffel-cash`: zip teeth, a seam, notes.
  - `cash-stack`: the notes' paper edges.
- **Shop:**
  - `store-pawn-shelf`: tags, speaker cones, synth keys, a lens, disc spines.
  - `store-washer-pair`: glints, the coin slot, minutes left, OUT.
  - `store-cctv-monitor`: four camera pictures.
- **Left as they were**, because they already read:
  - `gate-scissor`: the lattice.
  - `piece-wall`: the pegboard and the painted outlines.
  - `safe-painting`: a framed painting; its safe shows only open.
  - `stash-cereal`: the mascot and title band.
- **Cost:** trailer-trap goes from 12,462 to 16,812 triangles (+35%, the most) and house-cook +29%. Rooms with no fine pieces are unchanged. Building a room takes up to 3 ms more (`fine-check.mjs --cost`).

### New pieces for THE RUN (2026-11-17)
Three new files: `hustle.js`, `traps.js` and `arms.js`. Each piece has a fine pass and a game block (proposals). The preview sheets are `?view=v2&k=hustle|traps|arms`.

- **hustle.js:**
  - `computer-desktop`: the late-90s PC.
  - `disc-burner`: three drives and a spindle of blanks.
  - `cook-station`: the cook rig's bigger brother, from the older game's cook table. A flask on a mantle runs through a condenser into a lit receiver. It also has a controller reading 85, a gauge, a test-tube rack, beakers, a gas mask, a drum, a gas bottle and jugs, with tape and a boil-over crust on the bench.
  - `lockup`: a roll-door unit, 2 × 2 m, closed or open.
  - `stab-vest`
  - `police-scanner`
  - `loan-book`
  - `protection-book`
  - `card-file`: the lawyer's card.
  - `box-cutter`
  - `jacket-lining`
- **traps.js** (each carries `does`, a line on what it could do in a break-in):
  - `decoy-safe`
  - `dye-pack`
  - `door-bar`
  - `pepper-fogger`
  - `motion-flood`: the older game's yard light, on a car battery.
  - `dog-sign`: the bluff.
  - `panic-button`
  - `false-wall`
  - Nothing spiked, tripped, mined, shot, burnt or shocking.
- **arms.js:** the run's own weapons by the run's names, toon shapes with no real model:
  - `six-shot` and `six-shot-rounds`
  - `chopper` and `chopper-rounds`
  - `junk-pistol` and `junk-rounds`
  - `tire-iron`
  - `brass-knuckles`

## Second art pass (2026-11-17)
The owner: "some of the remakes are just remakes of a preexisting when we didn't have more detailing". The first pass painted onto the old silhouettes; these pieces needed their shape redrawn.

- **The rule for small things** (FORMAT.md "Small things: the fine grain"): a small piece may set `grain: 0.025` (half the block) or `0.0125` (a quarter), and its whole volume is built at that grain. At most 4 cells, 0.4 m tall and 3,000 triangles (lib.js `SMALL`; `fine-check.mjs` gates it). A piece that lies flat may set `view: 'top'` so its tile is taken from 58° down, not 30°.
- **At the half grain:** `six-shot` (a revolver: a fluted cylinder in its frame, the barrel on its top chamber, the hammer back, the trigger in a guard you can see through, a walnut grip), `chopper` (a short automatic: the receiver, the orange-taped handguard, a slotted muzzle, the long magazine curving forward), `junk-pistol` (a rusty pipe with a black cap, a nail striker on a red rubber strap, black tape to a sawn block grip, a bent-nail trigger), `tire-iron` (an L: the bar, the bent arm and a hex socket with its mouth to the front, a flat pry end), `brass-knuckles` (four rings you can see through, the palm rest), `box-cutter` (a yellow handle with black grips, the slider, a snap-off blade), `cctv-camera` (a wall plate, an arm and ball joint, a bullet body under a sun hood, the lens in a ring of infrared lights, a lit dot, the cable looped into a box; the dome: a black cap and a smoked glass bubble with the lens in it), `pepper-fogger` (a can held upside down in two clamps, its cap and nozzle down at the door, a trigger box with an armed light, a yellow cord to the door, a label of our own: hazard stripes, a warning diamond, a chili, HOT FOG).
- **At the quarter grain:** `stash-soda` (a round can with its rim, shoulder, lid, mouth and pull tab, FIZZ printed on its band; open, the unscrewed bottom with a roll of notes standing in it and the rest of the can lying beside it).
- **New, at the half grain:** `double-barrel` (a sawed-off double: two short barrels, drawn one over the other so both show lying down, a bright action with its hinge pin and top lever, two triggers, a taped pistol grip) and `long-rifle` (a scoped rifle: a walnut stock, the bolt's knob, a long barrel, a scope on two rings), with `double-barrel-shells` and `long-rifle-rounds`. Their names are the owner's to pick.
- **Redrawn at the 5 cm block:** `duffel-cash` (a soft bag that slumps and sags in the middle, round end panels, the zip open with its lips folded back, bundles inside and standing out of it, the handles flopped down its front) and `jacket-lining` (a jacket on a hanger, sloping shoulders, collar, sleeves, ribbed cuffs and hem; one front folded back so the quilted lining and the inside pocket face the room, a roll of notes and a passport out of the pocket).
- `fine.js` has `fprint` and `inkOf`: a print on something round (a can's label), every face that shows toward the front taking the colour straight in front of it, so a word reads across the steps.
- **Cost** (near-mesh triangles, first pass → second): six-shot 316 → 996, chopper 366 → 1,344, junk pistol 214 → 708, tire iron 206 → 332, brass knuckles 200 → 828, box cutter 196 → 596, soda can 286 → 1,118 (open 2,462), CCTV camera 290 → 786, pepper fogger 462 → 1,986, duffel 1,336 → 1,992, jacket 1,102 → 1,440. The new double 1,274 and rifle 1,064. A trailer with every one of them out adds about 9,000 triangles.

## Third pass (2026-11-18)
The owner's shortlist of the pieces that looked janky, redrawn shape first, and the five he added. Ids, footprints, heights, tiers and variants are unchanged.

- **The half grain past SMALL** (FORMAT.md "Shaped things"): `shaped: 'why'`, at most 24 cell-metres (cells × m), 2.0 m tall, 6,000 triangles; `fine-check.mjs` gates on it. New helpers in `lib.js`: `lathe`, `prof`, `ball`, `plate`.
- **A new shape, at the half grain:** `vase-floor` (a gloss vase, a neck, seven stems of blooms and leaves), `lamp-table` (a ginger-jar body, a brass neck, a drum shade lit inside), `lava-lamp` (the rocket, wax blobs), `stool-bar` (a round seat, a pole, a foot ring), `plant-monstera` (five split leaves on stems), `trophy-gold-grill` (a jaw, every tooth capped), `trophy-bribed-10` (a gold hand holding an envelope), `trophy-corner-mansion` (columns, roof, windows, pool, trees), `beanbag` (a slumped sack with a dent), `laundry-pile` (jeans, a hoodie, a tee and a sock laid over each other), `trophy-snitch` (a rat: ears, snout, whiskers, tail, a phone), `vinyl-nobody` (a huge hood, a dark face, glowing eyes).
- **Finer blocks:** at the half grain `disco-ball`, `trophy-dirty-cop` (round donuts), `knife-case`, `rolling-tray`, `trophy-first-house` (a snow globe), `rug-shag` (tufts); at the quarter grain (SMALL) `plant-cactus`, `beer-cans`, `sneakers-kicked`, `knuckles-velvet`, `baggies-product`; `turntables` at 0.05 with painted round platters and half-block tone arms.
- **Painted detail** (the shape kept): `box-fan` (a round grille, blades), `fish-tank` (fish, weed, bubbles; sand for the confetti), `boombox` (round speakers, a cassette), `chair-puffer` (a sheen on every channel, stitches), `art-graffiti` (a flat tag, no loose cubes), `frame-gilded` and `frame-gilded-small` (a carved frame: `bits.js` `gilded`; the faces painted finer), `stash-cereal` (CRUNCH KING, a bowl), `pizza-boxes` (the lid's print, the slice), `vinyl-dicehead` (rounded edges, round spots).
- **Clear lids:** `bits.js` `vitrine` draws the lid as its rim (the knife, the grill, the mansion), and `grails-case` and `trophy-got-robbed` the same: from the room's camera above, what is inside shows.
- **Gold:** `fine.js` `gild` (FORMAT.md "Gold"): gold no longer reflects the blue sky as olive.

### Third pass, part two (2026-11-18)
- **Thirteen from the first pass**, the old shape under paint, redrawn shape first: at the quarter grain (SMALL) `door-locks` (a deadbolt thrown into its keeper and its thumb-turn, ring links in a sag, a knob lock), `alarm-keypad` (a screen set in, twelve keys standing proud), `stash-outlet` (a duplex outlet: slots, ground holes, the screw), `scale-digital` (seen from above: a plate, a display, a zip bag with a lump in it), `stash-vent` (tilted louvres over a dark duct); at the half grain (`shaped`) `gun-rack` (three long guns in profile on pegs, a shelf of rounds), `money-counter` (a box, a hopper of notes, a tray, the display), `sneaker-rack` (every sneaker shaped), `stash-encyclopedia` (eight volumes with rounded spines between bookends), `stash-speaker` (cones set back with rims, a dome tweeter, a port), `streetwear-rack` (tees, hoodies and a varsity jacket on hangers), `burner-drawer` (phones with screens and keys, one open and lit); the shop kit's `store-pawn-shelf` at 0.05 with its goods given shapes (a boombox, a drill, chains on a stand, a camera, a console, a synth, a microwave, discs).
- **The limit, recast** (lib.js `SHAPED`): the box a shaped piece fills, at most 24 cell-metres (cells × m; a wall piece: its cells on the wall × its depth), at most 2.0 m tall, 6,000 triangles.
- **What it costs** (`fine-check.mjs --cost`, every preset room built and meshed, owned, against `d3295a2`): near-mesh triangles up a median of 42% (trailer-trap +7%, the starter-like trailers +49% to +51%, penthouse-afterparty +92%: 15,468 → 29,630); building and meshing a room 2 to 9 ms more (rooms of 17,000 to 45,000 triangles, 6 to 22 ms). Per piece, the shaped ones run 700 to 4,200 triangles (the monstera 3,954, the vase 4,602, the sneaker tower 4,152, the beanbag 3,684; the cap is 6,000); the far tier is unchanged in kind (0.1 m, downsampled).
- **Names:** `double-barrel` is the **Doorman**, `long-rifle` the **Long-eye**; their boxes are Doorman shells and Long-eye rounds. Ids unchanged.

### After the third pass (2026-11-18)
- **The owner's calls:** the original tiger rug was better, and the bust with the chain goes altogether. `rug-tiger` is back to its drawing from before the third pass (the 5 cm block, a flat hide and a low head; its gold variant now takes `gild` like every other gold). The bust is gone from the catalogue, from `city/builder.js`, and from the two rooms that showed it in a slot (apartment-collector's grail slot, house-come-up's table slot: those slots are taken out, nothing put in their place).

## Crafting pieces (2026-11-19)
THE RUN's approved crafting plan names four things that stand in a home or are fixed to its door. They are in `craft.js`, on the preview's sheet `?view=v2&k=craft` and in a room of their own, `?view=craft` (add `&cam=game` for the game's street camera, `&tod=night`, `&bench=1`, `&load=0..4`, `&gun=0..2`). `craft-shots.mjs` pictures them headless, with nothing fetched off the machine (`--three` answers the page's three from a local copy).

- **`tool-bench`, the bench:** carried over from the crafter game (`game/src/base/station.js` benchCells, tiers 1 and 2) by its own code: the knocked-together bench and the steel one off a closing garage. The tier's number plate is left off (its "Workbench 1/2/3" names stay out); the metal layer is drawn as gloss; the vise sits one cell back so its T-handle is inside the footprint. Foot [7, 4], 1.95 m, a top at 0.85 m.
- **`door-can`, the can over the door, loaded:** the pepper fogger's own build (`traps.js` now takes `{ can }`, the fogger as bought unchanged), its can in the load's family colour (blue, red, violet, green, black) under a strip of tape with a scrawl.
- **`door-gun`, the Knock-Knock:** the run's own gun (six-shot, junk pistol, Doorman) by its own build, turned onto the wall in profile on a pine board, two clamp straps, a yellow cord from the trigger to the door's edge. Half grain, `shaped`.
- **`porch-lamp`:** a jelly-jar lamp in a wire cage on a round plate, its globe wider than its cap so the glass shows from above; lit at night. Black or brass.
- **Checks:** `check.mjs` (all 22 layouts pass) and `fine-check.mjs` pass. None of the four is in a layout.
- **The game blocks are proposals with no buff.** The bench is bought (`store`); the loaded can and the Knock-Knock are made (`craft`). When the game's library is regenerated from this kit, those two should be kept off the shelves.

