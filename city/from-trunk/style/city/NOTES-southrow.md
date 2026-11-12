# South Row refinement (−2,0 … 2,0)

**Audit:** South Row 0 → 0 issues (section 15 → 1, a corners crate). Refused placements 20 → 18, and every named one is now hand-placed. People 101 → 113, trees +10. Street views: 88–157 draw calls (avenue 181, unchanged). Shots in `shots/southrow/`.

**−2,0, the news corner.** The pass-1 newsstand is back on Central Ave, in the alley mouth by COMICS, with a vendor and a customer. The one-off is a car on blocks at the Ivy St curb, with a mechanic. The plaza gets a bench, sitters and a tree; Washington St two trees and pigeons.

**−1,0, SHELL CO skips town.** The missing one-off at the Main St alley: a NO QS MOVING van, boxes, a filing cabinet, a cooler, a couch, movers and the boss on the phone. The roof sneaker becomes a cash stack with a counter. Also a grow-op minder, trees and a plaza bench.

**0,0.** The giant sneaker is restored (the fire escape moved to the back wall). A third purple wall is now teal; repeated corps are renamed; three trees and a roof figure.

**1,0.** SNEAKS → DEADSTOCK, a picnic game, a tree and two people knots untangled.

**2,0.** The giant is restored as ALIBI BURGER's burger on Maple St. Colour clashes and repeated names are fixed, and a stoop trio added.

## For the systems agent
- `giantObject`: the donut, cup, key, sneaker and eye hang 0.1–0.4 m below their bracket.
- `personClear` refuses standing roof figures (the footprint box rises above the roof).
- `cash()` clamps its figure into the stack on narrow roofs.
- `jobs.js` still tries the Ivy St newsstand.
- Walkers pass through curb trees, hydrants and the HOT cart.
- Name and gag decks are per block: neighbours repeat.
