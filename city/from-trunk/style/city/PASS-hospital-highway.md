# PASS · St. Mercy + Route 9 / Motel 9 (batch 4, 2026-09-27)

**Built.** `districts/hospital.js` and `districts/highway.js`, one hero per block (`heroes/hospital-*.js`, `heroes/highway-*.js`), helpers in `districts/hospital/` and `districts/highway/`. Two overrides: `blocks/4_-2.js` swaps one traffic car, `blocks/7_4.js` moves one street tree. Parts are sliced per block (`lib.js slice`), so the tower on the sim's hospital (161, −33), where four blocks meet, is one building.

**St. Mercy**
- The tower: a red crown lettered ST. MERCY, a neon cross, a helipad with the air ambulance. It reads as the hospital from the overview.
- The ER bay: EMERGENCY canopy, ambulances, WAIT 6 HRS.
- The smokers' corner: a wheelchair and an IV pole under NO SMOKING, a saint wearing a traffic cone.
- Also a garage, the 1889 morgue wing, Medical Arts.

**Route 9**
- LAST CHANCE: canopy, price pylon, food mart, a semi unloading shoe boxes.
- Motel 9: a pink 12-room wing, a googie office, the pole sign (neon 9, Motel script, VACANCY), and room 9 with the loan shark and LOANS.

**Review fixes:** the pole sign moved and its boards were raised; the canopy lettering shifted. OFFICE, LAST GAS BEFORE BRIDGE and LOANS now read in every fixed shot. VISITING 11-8 is on a lit panel. The ER's foreground car is solid.

**Numbers**
- Audit: 0 issues in both districts, walk check included. Smoke: 12 districts OK.
- First view: 1.45–1.74 s cold, 0.80–1.25 s cached. Draw calls: 35–157 per view.

**Requests for the systems agent**
1. `main.js` `maxPolarAngle` raises any camera whose target is above its eye. Rule street views render about 1.3 m above their declared eye; my hospital night view renders from 13 m.
2. The `props.js` car's side windows open onto a hollow cabin. `districts/hospital/props.js sedan` is a closed one.
3. `simstate/layer.js drawCorners` puts the Route 9 & Oak hotspot inside the 7 m-wide highway.
4. Run `tools/reserved.mjs` for my transit stops and safehouses.
5. Add highway and hospital signage flavours.
6. `buildSetPiece` needs `REG.strict = false` in custom kits; walkable ground needs two hidden voxels, or the far tier drops it.
