# PASS-signs · signage pass 4: more designs, repeats swapped

**New** (`signage/reserve.js`, `icons.js`): 47 categories the lattice never draws.
- **The sim's world:** alarms, guard dogs, safes, GOT WARRANTS? lawyers, St. Mercy, car service, the ferry, jail calls, police auctions, DIVORCE $299.
- **The block:** phone cards, mattresses, karaoke, motels, club nights, record releases, revivals, psychics, lucha. Gatehill gets estates and motorcars.
- **Also:** 45 neon/throw-up words, 25 ghost trades, 20 bodega bands, 18 parking signs.
- **Painters:** price, club, luxe, rays, release; 12 icons. No internet winks.

**The swap.**
- **Gag:** a design category. **Repeat:** the same gag in a family within 250 m (roofs) or 100 m; the copy nearer (0, 0) stays, and section 1 keeps everything.
- **How:** `tools/signswap.mjs` writes `signage/swaps.js`; `pick()` draws as before, then swaps listed repeats.
- **Regenerate:** SIGNAGE.md, "The swap".

**Census** (904 signs):
- **Repeats by gag:** 237 → 58, all section 1's own: **0 elsewhere**.
- **By family:** walls 167 → 38, bands 57 → 18, roofs 8 → 1, ghosts 4 → 1.
- **Changed:** 159 signs, all repeats before.
- **Audit sign-repeat:** 0.
- **PARK $404:** no lot builds today.

**Gate.**
- **Smoke:** ok, 14 districts, 0 issues.
- **Draw calls:** 179 → 179.

**Shots** (`shots/signage-pass/`): the fringe-west `$64M` lottery board is now HOLDFAST SECURITY; bands, walls, sheets.

**Review round.**
- **Fit check:** `preview.html?view=fit`: 0 letters outside their boards, across all 47 categories and every landing size.
- **Misses:** the swap now skips designs whose words miss their box. Reserve giant boards keep the phone clear of the giant.
- **Audit:** 59 swapped blocks, 0 issues.
- **HOLDFAST "clip":** occlusion. SEEDS & FEED in −4_−1 covers the board's west end (the old LOTTO ball too); `holdfast-board-preview.png` shows it whole.

**Requests.**
1. Move −4_−1 L0's billboard clear of its neighbour.
2. Live giant boards run the phone number under the giant; say if I should fix it (it changes live pixels).
3. Regenerate the table after walls changes.
4. Plaques repeat (in `gen.js`).
5. Vary section 1's bands?
