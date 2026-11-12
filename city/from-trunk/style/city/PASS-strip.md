# PASS · Neon Row (strip) · batch 3

**Built.** `districts/strip.js` (grammar, cameras, transit); `districts/strip/` with `fill.js` (hand-laid lots, generator fill), `names.js` (per-block signs, checked unique) and `props.js`; four `heroes/strip-*.js`; `blocks/-2_1.js`.

**Heroes.**
- **Jay St Night Market**: eight stalls, an arch, festoons across Jay St.
- **Sing Sing Karaoke**: a marquee, a blade, a singer mural lit at night.
- **NO WITNESS**: a rope line, carpet and searchlights.
- **Graveyard Shift diner** and **Honest Pawn**.

**Also.**
- TAROT and HOTEL blades, ten window neons.
- Four one-offs and a Jay St steam pipe.
- A taxi stand and a bus stop.
- 24 walk-ups with about 70 apartment units.
- Every sign used once. Walkers only; roof set-piece figures stay.

**Audit.**
- `district strip`: **0 issues**, day and night.
- Section run `strip-final`: 123 against 92 for `pass2-final`. The +31 are all signage's new `sign-repeat` flags on downtown blocks. None are in Neon Row.

**Bench** (medium, 1600×1000):
- Draw calls: street 151/173, night 153, landmark 131, overhead 82.
- Cold load: nearby blocks show at 1.9–2.1 s by day and 2.5 s at night.

**Requests for the systems agent.**
1. `shots.mjs` and `reserved.mjs` can't load kits in node: `signage/art.js` imports `world/chars.js`, and the three stub is empty. The shots came from `shoot.sh` at the same URLs. `reserved.json` was not re-run.
2. The page's first view never fires, because the Sunny Acres blocks never show.
3. `peds.density` isn't wired, so there are 3.8 walkers per 100 m by day.
4. A 0.6 `walkway` sits where the clutter goes. `fill.js` keeps a curb-side band and then lifts it; consider moving this into `gen.js`.
5. Strict mode refuses props on a building's own roof.
6. The hero `far` option is unimplemented.
7. The Jay & Washington hotspot sits on the corner lamp.
