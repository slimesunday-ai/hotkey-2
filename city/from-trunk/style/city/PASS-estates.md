# PASS · Gatehill (estates), the luxury tower district (Gatehill agent, 2026-09-27)

**Built.** The kit, `districts/estates/*` and four lazy heroes (`far: 'kit'`):
- **AUREUM:** a sunburst crown, a spire, chrome eagles.
- **OFFSHORE:** a helipad with a helicopter, a supercar showroom.
- **SOLITAIRE:** a giant diamond ring in its box.
- **GAVEL & GRAIL:** an auction house, banners, a collectors' queue.

16 towers, 50 to 127 m; none shares a crown, roof, massing, style or colour (clay tennis on CLUBHOUSE, pickleball on NO COMMENT); seven neutral, nine coloured. At night a lit penthouse is one gold box of light over sparse office windows. Two lobby courts each (doorman, cars, CCTV). Plus 31 unique shopfronts, 2 condo billboards, a bus stop, a cab stand, a safehouse slot.

**The 32 penthouses.** Both sim doors stay put: a court opens at each, the lobby on its back wall. The north lot anchors `bld:i_j·N` and the south lot `bld:i_j·S` (tower, penthouse). `entrance.door` is the lobby; `simDoor` is the sim's sidewalk point.
- One unit per anchor: the sim lot id, the top floors, 8 to 28 windows.
- With the sim off, `specs.js tonight` lights half the penthouses.

**Numbers**
- **Audit:** 0 issues. Walk check: 770 walkers, 22 agents, 0 overlaps.
- **Smoke:** ok, 12 districts at 0.
- **Load (1080p, medium):** first view 1.41 to 1.66 s cold, 0.73 to 0.87 s cached; 113 to 210 calls.
- **Bench:** stress fly-over over Gatehill: 120 calls p50 (239 max), GPU 1.24 ms.

**Requests**
1. **Systems:** `farCtx` is 40 m tall, so `far.js` meshes its own volume. Please size `farCtx` to its content.
2. **Systems:** `doormanLobby` now takes `{ name, no }` (defaults byte-identical). Anchors carry `entrance.name` and `entrance.no`; `simstate/layer.js` must pass them, or every canopy still reads CROWN.
3. **Systems:** stand the doorman lobby at `entrance.door[1]` (0.3 m paving), not `SIDE`.
4. **Systems:** a tower's alarm camera lands by the penthouse window, 100 m up; the lobby (which has CCTV) suits it. No safe for stacked units.
5. **Systems:** run `reserved.mjs` for the new slots; `DEMAND` has no estates row.
