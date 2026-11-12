# PASS · Sunny Acres + Millennium Mall (batch 3)

## Built
- **Sunny Acres** (`districts/trailer.js` + `districts/trailer/`)
  - The sim's 54 pads, from their own rects. Nine kinds of home, 35% neutral. Each has a porch, a car or carport, yard life, its pad number and a sim-state anchor.
  - The grid is broken up:
    - 31 homes are turned 5–10° off square, and every home sits at its own depth.
    - 14 add-on rooms or lean-tos.
    - Mismatched fences, worn paths, askew cars, junk and trees out back.
  - One-offs: 14 hand-painted signs, BAIT & TACKLE, a giant flamingo, NO COPS on a roof.
- **Millennium Mall** (`districts/mall.js` + `districts/mall/`)
  - The HOLLOWAY'S anchor with ghost letters.
  - The lots: cracks with weeds, a tent camp, a stripped car, dumping, carts.
  - The rubble field with an excavator and a CONDEMNED notice.
- **Heroes (6)**
  - Swap meet.
  - Park office with the sun letter sign.
  - Coin laundry, plus Pad 47's pool.
  - Atrium dig.
  - Pylon: dim dead letters, ghosts of fallen ones.
  - Food court: a stepped broken wall.
- Every sign text is unique.
- **Demo state** (`simstate/demo.json`, appended only):
  - 45 pads lived in: asleep, up late, or out.
  - Pad 12 boarded, Pad 38 raided.
  - 4 pads for rent.

## Numbers
- **Audit:** `district trailer` and `district mall` each have 9 blocks, 0 issues, 0 refused, 0 module errors.
  - `audit.mjs run trailer-mall` covers section 1 only: 24 blocks, none of them mine.
- **Bench, 10 views (cold):**
  - 69–103 calls, 1.0–2.3M triangles.
  - First view 2.5–3.4 s.

## Requests (systems agent)
1. **Hero blocks slow first view.** Every hero in draw distance is fully built early for its far tier: 21 today. Let `kit.far` serve hero blocks.
2. **`farCtx` lacks `i`/`j`.** Please add them, and treat an empty far tier as a failure: an empty one once hung first view.
3. **Re-run `tools/reserved.mjs`** for:
   - buses SUNNY ACRES 14 (−162.4, −42.5) and MALL GATE 31 (−214.5, 4.4)
   - safehouses: laundry back room (−206, −8), projection booth (−180, 40)
4. **Turned homes:** the sim layer draws window panes and cards on quarter turns. Turned homes pass `yaw` (radians) in their lot anchors for it to use.
5. **`audit.mjs run`:** let it take a district or a block list.
