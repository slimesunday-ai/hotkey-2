# Drop 02: new traits (2026-09-29)

There are 60 traits in `world/chars.js`, in the "FIT STREET DROP 02" block (registry `NEWT`). Tiers: 23 common, 20 rare, 10 epic, 7 grail. Board: `style/city/traits/`. Proposal: `world/traits-proposal.json`.

**List** (tier after each group; G = grail)
- grillz: diamond, openface rare; fangs, perms epic; gems G
- neck: pearls, choker rare; catpiece epic; icecuban, cuffs G
- ears: earstack, cross common; icestud rare
- acc: digital common; rings, sling rare; pinky epic; bustdown G
- top: catee, tapetee, dyehoodie, trackjkt, bball, buffalo common; bootleg, slabtee, chenille rare; bubble, leather epic; furcoat G
- bottom: bigjeans, parachute, snaps, meshshorts common; digicamo, doubleknee rare
- shoes: courtlow, lugboot common; chunky, furslide rare; courtking, clogs epic; chromes G
- hat: silkrag, skully, tiedana common; fuzzbucket, holofitted rare
- hair: mohawk, twists common; braids, leopard rare
- eyewear: tinies common; shield rare; goggles epic
- held: phonecase, bodegabag common; kicksbox rare; bricks epic; vinyl G

**Keep or kill:** to kill a trait, delete its `NEWT` line and draw function.

**Walkers:** set `NEW_TRAITS = true`. While it's off, rolls match the old code exactly (1,716 looks checked).

**The sim session must add:**
- the proposal's `TRAITS` entries
- the slots hair, ears and legs
- adapter `WEAR`: hair → hair, ears → ears, legs → bottom
- `{ id, cw }` for colourways

**Existing bug:** `WEAR` maps bag to held, but crossbody and sling are acc, so wearing crossbody throws.

**Bake:** no change needed.

## Shoes (shoe pass, 2026-09-29)

Code: `world/shoes2.js` (one import and call in chars.js). Page: `traits/shoes.html`. Board: `board-shoes.jpg`.

**What reads at 1/20.** At 10 m a voxel is about 5 px: silhouette plus two or three value blocks.
- The shoe is the plinth under the big head: 5 wide, plus a 1-voxel outboard flare on chunky soles.
- The midsole (1, 2 or 3 rows, contrasting the upper) is the main read.
- The toe lifts one row (toe spring).
- Collars stop at y 5, since y ≥ 6 rides the thigh.
- Pants and socks cover the collar, so identity lives in the sole, toe box, heel and outer face.

**Redrawn** (same ids and tiers, 4 colourways each): courtlow, lugboot, chunky, furslide, courtking, clogs, chromes.

**New** (behind `NEW_TRAITS`), with proposed tiers:
- common: puffskate, tacboot, sandalsocks
- rare: retrohigh, sculptrun, lugloafer, workboot
- epic: splittoe, socksneak
- grail: bulbs (1/1)

**v2 for approved shoes:** none added. Candidates: `chunky` for `dad`, `workboot` for `boots`.

**Checks**
- Smoke test ok.
- With `NEW_TRAITS` off: 0 of 3,000 rolls and 0 of 1,016 bodies differ.
- Street A/B on street-1: 0 px.
- Walk: 0 inside-face px.

## Held + grip (2026-09-29)

Every held item now sits in the hand that carries it. Code: `world/held2.js` (grips, hands, models, holds) and `style/city/anim/grip.js` (the arm pose in the walkers' shader). Page: `style/city/traits/held.html`. Board: `style/city/board-held.jpg`.

**Ids:** unchanged. Every approved id keeps its name and colourways. Only the model is redrawn, so the fingers line up with it. `chars.js HELD` is now only the fallback for an id `held2.js` doesn't know.

**Grip (the hand's shape) · hold (the arm's pose):**
- pinch · phone: phone in a case, flip phone. Held up in front, screen to the face, swing ×0.18.
- pinch · side: mp3, disposable camera, floppy. Carried at the side.
- fist · side: spray, crowbar, cash stack, cash bricks, ball mouse. The item passes through the fist.
- fist · drink: energy drink. Upright at the waist, swing ×0.45.
- fist · display: 1/1 chase vinyl. Stands on the fist, out front and to the side.
- hook · hook: bodega bag, duffel. Straight arm, held out from the leg, weighted swing ×0.45.
- flat ×2 · carry: sneaker box. Both hands, forearms level, no swing.

**Idles:** a phone holder's "check phone" uses the real phone. A busy hand skips any idle it can't do (`grip.js gripIdle`); the free arm idles as before.

**Walkers:** the same looks roll as before, because the rolls are untouched. They just hold things better.

**Rest pose:** the fit check and the kept people show the hold as a static pose (`held2.js holdArm`). A sneaker-box voxel that would overlap the legs at rest goes to `compose().HX` and rides the arm, so no body voxel is overwritten.

**Mp3:** the earbud cable now runs up the sleeve and out at the collar. It no longer crosses from the arm to the chest.

## Jewelry

**Code:** `world/jewelry2.js`, installed by one `installJewelry()` call in chars.js. Board: `style/city/board-jewelry.jpg`. Page: `style/city/traits/jewelry.html`.

**What reads at 1/20:**
- A link is one voxel, so a chain's type is its rhythm: figaro 3+1, rope diagonals, paired cuban blocks, franco chevrons.
- Metal on layer 2 turns olive under the sky, so gold uses gloss for its highlight and base tones.
- Ice needs a lit glint to read at 10 m.
- The chest under the chin is 8 rows, so pendants are at most 6 × 6 flat plates under a short V.
- Grills read as colour bars from the street.

**Redrawn (same ids and tiers):** the 17 Drop 02 pieces.

**New:** figaro (common), franco, tennischoker, nameplate (`neck.ch` = the agent's initial), noggin, chase, layers, exhibit (grail), gapgold (common), septum (rare), hoopstack (common), cubanwatch (epic). The septum only reads close up.

**v2 alternates for slime:** dollar2, padlock2, rope2.

**Motion (lab):** `anim/jewelry-motion.js` with `?jewel=1`. Pendants swing about their bail; the see-through gate shows no chest faces. The sparkle (`&spark=1`) is off by default and only worth turning on up close.

**Walkers:** unchanged with `NEW_TRAITS` off (0-px street diff).

**Checks:**
- `smoke.mjs` passes.
- See-through gate (`overlap-check.mjs --gate '&dbg=back&held=0|5|10'`, which covers all 15 held looks): 0 of 38,070 frames show inside faces. `held.html &dbg=back` also counts 0.
- Quick overlap on the same bodies, empty-handed → holding:
  - z-fight is unchanged (0.575 → 0.563 per 1k body px), and so are the slabs (16.5 → 16.1).
  - Poke-through rises from 10.4 to 17.3, mostly hand-hip: the side-carried camera passes close to the hip.
  - Vinyl + sneaker box: 8.7 → 17.3, from the box's hands near the pelvis and the figure near the cheek.
  - Open: those last pokes. The lab's `&held=<i>` / `&heldnone` params reproduce them.
