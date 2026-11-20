// Home objects · catalogue v2 · gear: stash spots (a hollow speaker, a fake encyclopedia set, a floor safe, a soda can, a cereal box, a
// wall outlet), security (a CCTV camera, an NYC scissor gate), cooking gear (a hot plate, the cook rig) and laying low (an arcade
// cabinet). Every piece's buff is tied to an existing sim mechanic (brief 2026-09-28 §5.3). The cook gear is toon kitchenware and
// glassware with neon liquid: no labels, no real process (OUTLINE §0.9).
import { def, K, SAFE, pick, cyl, cylZ, line, glow, LIT, shade, rng, hash, txt, M3, cash, mix, frect, fdisc, fline, ftxt, hbox, fsurf, fprint, inkOf, fcolour, billTex, ball } from './lib.js';
import { g, brick } from './bits.js';
import { screen } from './media.js';

const stash = (take, rarity = 'common') => g('gear', rarity, 'craft', { stashTake: take });

export const stashSpeaker = def({ id: 'stash-speaker', name: 'Hollow speaker', cat: 'stash', place: 'floor', foot: [3, 2], h: 1.0, sim: 'stash', states: ['closed', 'open'],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['stash', 'speaker', 'hidden'], variants: 2, vnames: ['black', 'wood'], far: true,
  game: stash(-.3, 'rare'),
  grain: 0.025, shaped: 'a speaker cabinet: its cones set back in the baffle, each with a rim, the dome tweeter, the port',
  grain: 0.025, shaped: 'a speaker cabinet: its cones set back in the baffle, each with a rim, the dome tweeter, the port',
  build(V, { variant = 0, state = 'closed' } = {}) {
    // THIRD PASS · at the half grain: the cabinet with corner guards; the woofer and the mid set back into the baffle, each a rubber
    // rim standing proud, the cone dished in, the dust cap; the dome tweeter, the bass port, the badge. Open: the woofer out, the cash in its hole
    const c = pick([0x2a2a31, K.wood], variant), open = state === 'open', fr = 18;
    V.box(1, 0, 1, 29, 40, 19, c); for (const x of [1, 28]) for (const y of [0, 39]) V.box(x, y, 18, x + 1, y + 1, 19, K.ink);   // the cabinet, its corners
    const cone = (cx, cy, R, out) => { for (let x = Math.floor(cx - R - 1); x <= cx + R; x++) for (let y = Math.floor(cy - R - 1); y <= cy + R; y++) { const d = Math.hypot(x + .5 - cx, y + .5 - cy); if (d > R) continue;
        V.del(x, y, fr); if (out) { for (let z = 9; z < fr; z++) V.del(x, y, z); V.set(x, y, 8, K.ink); continue; }
        if (d > R - 1.1) V.set(x, y, fr, 0x55555f); else V.set(x, y, fr - 1, d < R * .25 ? 0x3a3c44 : Math.abs(d - R * .6) < .5 ? 0x26262c : 0x1d1d22); } };   // the rim, the cone, the cap
    cone(15, 12, 9, open); cone(15, 27, 5, false); ball(V, 15, 35, 18, 2.2, 2.2, 1.2, K.chrome, 2);                   // woofer, mid, the dome
    for (let x = 4; x < 9; x++) for (let y = 33; y < 38; y++) if (Math.hypot(x + .5 - 6.5, y + .5 - 35.5) < 2.2) { V.del(x, y, fr); V.set(x, y, fr - 1, K.ink); }   // the port
    V.box(13, 2, 18, 17, 3, 19, K.chrome, 2);                                                                             // the badge
    if (open) { V.box(9, 4, 9, 21, 9, 16, K.cash); V.box(14, 4, 9, 16, 9, 16, K.white); V.box(10, 9, 9, 20, 12, 15, K.cash); }   // the cash inside
  },
  fine(P, { state = 'closed', V }) { if (state === 'open') { fcolour(P, V, K.cash, ['+z', '+y'], billTex); return; }
    fdisc(P, '+z', 15, 12, 2.3, d => (Math.abs(d - 1.6) < .15 ? 0x55555f : d < .5 ? 0x4a4c54 : null)); fdisc(P, '+z', 15, 27, 1.4, d => (d < .4 ? 0x4a4c54 : null)); } });   // the caps' rings

export const stashEncyclopedia = def({ id: 'stash-encyclopedia', name: 'Encyclopedia set', cat: 'stash', place: 'surface', foot: [4, 2], h: 0.35, sim: 'stash', states: ['closed', 'open'],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['stash', 'books', 'hidden'], variants: 2, vnames: ['oxblood', 'navy'],
  game: stash(-.25),
  grain: 0.025, shaped: 'a set of books: separate volumes, their rounded spines, bands and letters, between bookends',
  build(V, { variant = 0, state = 'closed' } = {}) {
    // THIRD PASS · eight separate volumes between two brass bookends: each its own book (a little taller or shorter), the spine rounded,
    // two gold bands on it and its letter (fine), the pages showing pale at the top. Open: three pulled out, one lying open, hollowed, the cash in it
    const c = pick([K.oxblood, K.navy], variant), open = state === 'open';
    V.box(0, 0, 3, 2, 12, 17, K.gold, 2); V.box(38, 0, 3, 40, 12, 17, K.gold, 2); V.box(0, 0, 3, 7, 1, 17, K.gold, 2); V.box(33, 0, 3, 40, 1, 17, K.gold, 2);   // bookends
    for (let k = 0; k < 8; k++) { if (open && k >= 3 && k < 6) continue; const x = 2 + k * 4.5, hgt = 13 - (k % 3 === 1 ? 1 : 0), cc = k & 1 ? shade(c, .9) : c;
      V.box(x, 0, 3, x + 4, hgt, 17, cc); V.box(x + 1, hgt - 1, 4, x + 3, hgt, 16, K.cream);                        // the volume, its pages
      V.box(x + 1, 0, 17, x + 3, hgt, 18, cc); V.box(x, 0, 17, x + 4, hgt, 17, cc);                                 // the spine, rounded
      for (const y of [2, hgt - 3]) V.box(x + 1, y, 17, x + 3, y + 1, 18, K.gold, 2); }                             // its bands
    if (!open) return;
    V.box(14, 0, 0, 29, 1, 9, K.cream); V.box(14, 1, 0, 29, 2, 9, c); V.box(21, 1, 0, 22, 2, 9, shade(c, .7));      // one lying open in front
    V.box(16, 1, 2, 27, 2, 7, 0x8a6a40); V.box(17, 1, 3, 26, 2, 6, K.cash);                                          // the hollow cut in it, the cash
  },
  fine(P, { variant = 0, state = 'closed', V }) {
    const L = 'ABCDEFGH', open = state === 'open';
    for (let k = 0; k < 8; k++) { if (open && k >= 3 && k < 6) continue; ftxt(P, '+z', L[k], 2 + k * 4.5 + 1.6, 7.6, K.gold); }
    if (open) fcolour(P, V, K.cash, ['+y'], billTex);
  } });

export const safeFloor = def({ id: 'safe-floor', name: 'Floor safe', cat: 'security', place: 'floor', foot: [3, 3], h: 0.6, sim: 'safe', states: ['closed', 'open'],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['safe', 'floor', 'hidden'], variants: 1, vnames: ['OAK green'],
  game: g('gear', 'rare', 'store', { secure: 'safe', safeTake: -.7 }),
  build(V, { state = 'closed' } = {}) {
    V.box(0, 0, 0, 15, 1, 15, K.steelD, 2); V.box(1, 0, 1, 14, 1, 14, 0x1a1a1f);                                                        // the steel collar set in the floor
    const lid = (at) => { for (let u = 0; u < 11; u++) for (let v = 0; v < 11; v++) { const e = u === 0 || v === 0 || u === 10 || v === 10; at(u, v, e ? K.gold : SAFE.body, e ? 2 : 0); } };
    if (state !== 'open') { lid((u, v, c, l) => V.set(2 + u, 1, 2 + v, c, l)); cyl(V, 7.5, 6.5, 2, 2, 3, K.gold); V.set(7, 3, 6, K.ink); V.box(6, 2, 10, 10, 3, 11, K.chrome, 2); return; }   // shut: lid, dial, handle
    lid((u, v, c, l) => V.set(2 + u, 1 + v, 1, c, l)); for (let v = 2; v < 10; v += 3) V.set(7, 1 + v, 2, K.chrome, 2);                  // open: the lid stands up at the back, bolts toward us
    for (let x = 3; x < 12; x += 4) { V.box(x, 0, 4, x + 3, 1, 8, K.cash); V.set(x + 1, 0, 5, K.white); } V.box(4, 0, 10, 7, 1, 12, K.gold, 2);   // what's in the hole
  },
  // fine pass: the dial's ticks and knob (seen from above), the handle's grip, the collar's bolt heads; open, the notes' faces
  fine(P, { state = 'closed', V }) {
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, x = 7.5 + Math.cos(a) * 7, z = 7.5 + Math.sin(a) * 7; if (Math.abs(x - 7.5) > 6.6 || Math.abs(z - 7.5) > 6.6) continue; frect(P, '+y', x - .25, z - .25, x + .25, z + .25, 0x9aa0aa); }
    for (const [x, z] of [[.5, .5], [14, .5], [.5, 14], [14, 14], [7.25, .5], [7.25, 14], [.5, 7.25], [14, 7.25]]) frect(P, '+y', x, z, x + .5, z + .5, 0x9aa0aa);
    if (state === 'open') { fcolour(P, V, K.cash, ['+y'], billTex); return; }
    fdisc(P, '+y', 7.5, 6.5, 2, (d, th) => { const k = ((th + Math.PI) / (Math.PI * 2)) * 24; return d > 1.55 ? (Math.abs(k - Math.round(k)) < .25 ? K.ink : null) : d < .4 ? K.ink : null; });
    frect(P, '+y', 6.25, 10.25, 9.75, 10.75, 0x9aa0aa);
  } });

// the SODA-CAN STASH, at a quarter grain (lib.js SMALL: 0.0125, so the can is round, with a rim, a shoulder and a pull tab): a FIZZ can of
// our own (a colour, a white band with the name on it in the colour, three bubbles rising, silver ends). Its bottom unscrews: open, the
// bottom cup stands with a roll of notes in it, a rubber band round the roll, and the rest of the can lies beside it, its threads and its
// dark inside to the cup
const SILVER = 0xc8ccd2, SILVERD = 0x9aa0a8, CAN_R = 5.5;
// the can in its own coordinates: u along its axis (0 the bottom, 19 the rim's top), rho from the axis → a colour, or null (air). `open`:
// the bottom cup is gone (u < 5), its end hollow and threaded
function canAt(u, rho, c, open) {
  if (u >= 19 || (open && u < 5)) return null;
  const R = u < 1 ? 4.9 : u < 17 ? CAN_R : u < 18 ? 5.0 : 4.8;
  if (rho > R) return null;
  if (u >= 18) return rho >= 3.8 ? SILVER : null;                                    // the rim, standing proud of the lid
  if (open && u < 9 && rho < 4.4) return null;                                         // the hollow, where the roll was
  if (u < 1 || u >= 17) return u >= 17 && rho < 3.9 ? SILVERD : SILVER;                // the bottom's bevel, the shoulder, the lid
  if (open && u < 6) return rho > 4.9 ? SILVER : SILVERD;                              // the threads at the open end
  return u >= 7 && u < 13 ? K.white : (u >= 1 && u < 1.6) ? shade(c, .7) : c;         // the band, the colour
}
const isSilver = col => col === SILVER || col === SILVERD;
// the name, printed on the can's front (fine.js fprint: it reads whole across the round's steps): FIZZ in the 3 × 5 letters at two
// texels a pixel, in the can's colour on the band
export const stashSoda = def({ id: 'stash-soda', name: 'Soda-can stash', cat: 'stash', place: 'surface', foot: [2, 1], h: 0.25, sim: 'stash', states: ['closed', 'open'], grain: 0.0125,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['stash', 'can', 'hidden'], variants: 3, vnames: ['FIZZ red', 'FIZZ lime', 'FIZZ purple'],
  game: stash(-.15),
  build(V, { variant = 0, state = 'closed' } = {}) {
    const c = pick([K.red, 0x3fc83a, K.purple], variant), open = state === 'open';
    if (!open) {
      const cx = 12, cz = 10;
      for (let y = 0; y < 19; y++) for (let z = 3; z < 17; z++) for (let x = 5; x < 19; x++) {
        const col = canAt(y + .5, Math.hypot(x + .5 - cx, z + .5 - cz), c, false); if (col !== null) V.set(x, y, z, col, isSilver(col) ? 1 : 0); }
      V.box(11, 18, 7, 14, 19, 11, 0xdfe3e8, 1);   // the pull tab, flat on the lid behind the mouth
      return;
    }
    // OPEN · the bottom cup, the roll standing in it
    const cx = 9, cz = 10;
    for (let y = 0; y < 6; y++) for (let z = 3; z < 17; z++) for (let x = 2; x < 16; x++) {
      const rho = Math.hypot(x + .5 - cx, z + .5 - cz); if (rho > (y < 1 ? 4.9 : CAN_R) || (y >= 1 && rho < 4.4)) continue;
      V.set(x, y, z, y < 1 || y >= 4 ? SILVER : y === 1 ? shade(c, .7) : c, y < 1 || y >= 4 ? 1 : 0); }
    for (let y = 1; y < 15; y++) for (let z = 5; z < 15; z++) for (let x = 4; x < 14; x++) { if (Math.hypot(x + .5 - cx, z + .5 - cz) > 3.4) continue;
      V.set(x, y, z, y === 9 || y === 10 ? 0xc8282e : 0x5cb85c); }
    // the rest of the can on its side beside the cup: its open end to the cup, its top (the tab) toward the viewer's right
    const cy = CAN_R, cz2 = 9.5, x0 = 13;
    for (let x = 18; x < 32; x++) for (let y = 0; y < 12; y++) for (let z = 3; z < 16; z++) {
      const col = canAt(x + .5 - x0, Math.hypot(y + .5 - cy, z + .5 - cz2), c, true); if (col !== null) V.set(x, y, z, col, isSilver(col) ? 1 : 0); }
    V.box(31, 4, 8, 32, 7, 11, 0xdfe3e8, 1);
  },
  // fine pass: closed, the name and the bubbles on the front, the mouth (dark, a bright lip), the tab's finger hole and rivet, a glint down
  // the can; open, the name on the cup's band, the roll's note edges and its spiral end, the threads' lines, the lying can's mouth
  fine(P, { variant = 0, state = 'closed', V }) {
    const c = pick([K.red, 0x3fc83a, K.purple], variant);
    if (state !== 'open') {
      const ink = inkOf('FIZZ', 8.75, 12.25, .5); fprint(P, V, 6, 14, (X, Y) => ink(X, Y) ? c : null);
      for (const [x, y, r] of [[9.5, 15, .55], [11.25, 15.75, .4], [13, 14.75, .65]]) fdisc(P, '+z', x, y, r, d => d > r - .3 ? K.white : null);
      fdisc(P, '+y', 12.5, 13, 1.6, d => d < 1.25 ? 0x2a2c32 : 0xeef1f5);
      frect(P, '+y', 12, 8, 13, 9.25, 0x6a6e76); fdisc(P, '+y', 12.5, 10.5, .4, 0x8a8e96);
      fsurf(P, V, '+z', 5, 1, 0, 19, 17, 17, (x, y, z, i, j) => x === 14 && i < 2 && (y < 7 || y >= 13) ? shade(c, 1.35) : null);
      return; }
    fsurf(P, V, '+z', 4, 1, 12, 14, 15, 15, (x, y, z, i, j) => y !== 9 && y !== 10 && x === 10 && i === 1 ? 0x3f8f45 : null);
    fdisc(P, '+y', 9.5, 10.5, 3.2, (d, th) => d > 3 ? 0x3f8f45 : ((d * 2.2 + th / Math.PI) % 1) < .3 ? 0xd8f0c8 : null);
    fcolour(P, V, SILVER, ['+y'], (x, y, z, f, i, j) => y === 5 && x < 16 && j % 2 ? SILVERD : null);
    fsurf(P, V, '+x', 30, 0, 0, 31, 12, 16, (x, y, z, i, j) => { const yy = y + (j + .5) / 4 - 5.5, zz = z + (i + .5) / 4 - 9.5; return Math.hypot(yy, zz) < 3.9 && yy > .6 && Math.abs(zz) < 1.6 ? 0x2a2c32 : null; });
  } });

export const stashCereal = def({ id: 'stash-cereal', name: 'Cereal-box stash', cat: 'stash', place: 'surface', foot: [2, 1], h: 0.45, sim: 'stash', states: ['closed', 'open'],
  tiers: ['trailer', 'apartment', 'house'], tags: ['stash', 'kitchen', 'hidden'], variants: 2, vnames: ['CRUNCH KING yellow', 'CRUNCH KING pink'],
  game: stash(-.2),
  build(V, { variant = 0, state = 'closed' } = {}) {
    // THIRD PASS · a plain box now (no band sticking out): the top flaps' fold, and all the box's art painted on it (fine)
    const c = pick([K.yellow, K.pink], variant), open = state === 'open';
    V.box(1, 0, 1, 9, 9, 4, c); V.box(1, 8, 1, 9, 9, 4, shade(c, .92));                                         // the box, its top flaps
    if (!open) return;
    V.box(2, 5, 2, 8, 9, 3, -1); V.box(2, 5, 2, 8, 6, 3, K.cash); V.set(4, 6, 2, K.white); V.set(6, 6, 2, K.cash);  // inside: rolls of cash
    V.box(0, 8, 1, 1, 10 - 1, 4, c); V.box(9, 8, 1, 10, 10 - 1, 4, c);                                          // the top flaps, folded out
  },
  fine(P, { variant = 0, state = 'closed' } = {}) {
    // the front: a crown over CRUNCH and KING, a bowl of cereal in milk with a spoon, a burst saying NEW; the side: the panel's lines
    const c = pick([K.yellow, K.pink], variant), band = variant ? K.purple : K.red, f = '+z';
    frect(P, f, 1, 5, 9, 8, band);                                                                                 // the title band
    ftxt(P, f, 'CRUNCH', 2.1, 7.6, K.white); ftxt(P, f, 'KING', 3, 6.15, K.yellow);
    for (const x of [4.25, 5, 5.75]) frect(P, f, x, 8, x + .5, x === 5 ? 8.75 : 8.5, K.gold);                        // the crown over it
    fdisc(P, f, 5, 3, 2.4, (d, th, qa, qb) => { const Y = (qb + .5) / 4; return Y < 3 ? (Y < 1.1 ? shade(K.white, .82) : K.white) : Y < 3.3 ? 0xf5f5f0 : d < 2.2 ? (((qa * 7 + qb * 3) % 5) < 2 ? 0xb07a3c : 0xe0a85a) : null; });   // the bowl, the milk, the cereal heaped
    fline(P, f, 6.4, 4.4, 8.4, 5.6 - .6, K.steelL);                                                                 // the spoon
    for (let y = 1; y < 6; y++) frect(P, '+x', 1.25, y + .25, 3.75, y + .5, shade(c, .7));                         // the side panel
    void state;
  } });

export const stashOutlet = def({ id: 'stash-outlet', name: 'Outlet stash', cat: 'stash', place: 'wall', foot: [1, 1], h: 0.1, mount: 0.3, sim: 'stash', states: ['closed', 'open'],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['stash', 'outlet', 'hidden'], variants: 1, vnames: ['white'],
  game: stash(-.35, 'rare'),
  grain: 0.0125,
  build(V, { state = 'closed' } = {}) {
    // THIRD PASS · at a quarter of the block, a real duplex outlet: the plate with rounded corners and its screw, two sockets standing
    // proud, each with its two slots and the round ground hole set in. Open: the plate down on its bottom edge, the box behind with a roll
    if (state !== 'open') {
      V.box(4, 1, 0, 16, 19, 2, K.white); for (const [x, y] of [[4, 1], [15, 1], [4, 18], [15, 18]]) V.box(x, y, 0, x + 1, y + 1, 2, -1);   // the plate
      for (const y0 of [3, 11]) { V.box(6, y0, 2, 14, y0 + 6, 3, K.bone); V.box(6, y0, 2, 7, y0 + 1, 3, -1); V.box(13, y0, 2, 14, y0 + 1, 3, -1); V.box(6, y0 + 5, 2, 7, y0 + 6, 3, -1); V.box(13, y0 + 5, 2, 14, y0 + 6, 3, -1);   // a socket
        V.box(7.5, y0 + 3, 2, 8.5, y0 + 5.5, 3, K.ink); V.box(11.5, y0 + 3, 2, 12.5, y0 + 5.5, 3, K.ink); V.box(9.5, y0 + 1, 2, 10.5, y0 + 2, 3, K.ink); }   // its slots, the ground hole
      V.box(9.5, 9.5, 2, 10.5, 10.5, 3, K.steelL, 2); return; }                                                          // the screw
    V.box(3, 0, 0, 17, 18, 1, K.grey); V.box(4, 1, 0, 16, 17, 1, 0x2a2a31);                                              // the box in the wall
    for (let x = 6; x < 14; x++) for (let y = 4; y < 14; y++) if (Math.hypot(x + .5 - 10, (y + .5 - 9) * .5) < 3.4) V.set(x, y, 1 + (x === 6 || x === 13 ? 0 : 1), K.cash);   // a roll of notes
    V.box(6, 8, 1, 14, 9.5, 3, K.white);                                                                                 // its band
    V.box(4, 0, 1, 16, 2, 8, K.white);                                                                                   // the plate, down
  },
  fine(P, { state = 'closed', V }) {
    if (state === 'open') { fcolour(P, V, K.cash, ['+z', '+y'], billTex); return; }
    frect(P, '+z', 9.5, 9.75, 10.5, 10.25, K.steelD);                                                                  // the screw's slot
  } });

// ── security
// the CCTV CAMERA, at the fine grain (lib.js SMALL: 0.025): a wall plate with its screws, an arm out to a ball joint, and hung off it
// the camera: a rounded body tipped down at the room, a sun hood over it that runs out past the front, the front a black bezel with the
// lens, a ring of small infrared lights round it and a small lit dot; its cable loops down out of the body and back into a box on the
// wall. Variant 1: a black dome on the same arm, its smoked glass bubble with the lens looking out of it
export const cctv = def({ id: 'cctv-camera', name: 'CCTV camera', cat: 'security', place: 'wall', foot: [2, 2], h: 0.35, mount: 2.0, sim: 'cctv', grain: 0.025,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['cctv', 'camera', 'security'], variants: 2, vnames: ['white bullet', 'black dome'],
  game: g('gear', 'rare', 'store', { secure: 'cctv', burgleOdds: -10, idBurglar: true, tip: 1 }),
  build(V, { variant = 0 } = {}) {
    const W = variant ? 0x2a2b30 : 0xeef0f2, WD = variant ? 0x1c1d21 : 0xc9ccd2, BK = 0x1a1b1f;
    V.box(7, 13, 0, 13, 19, 1, W, 1);                                                            // the wall plate
    V.box(9, 15, 1, 11, 17, 5, WD, 1);                                                           // the arm
    for (let x = 8; x < 12; x++) for (let y = 13; y < 18; y++) for (let z = 4; z < 8; z++) if (Math.hypot(x + .5 - 10, y + .5 - 15.5, z + .5 - 6) <= 2.1) V.set(x, y, z, WD, 1);   // the ball joint
    // the cable: out of the box on the wall, a loop down, up into the camera from below
    const cable = [[10, 2, 1], [10, 2, 2], [10, 2, 3], [10, 3, 4], [10, 4, 5], [10, 5, 5], [10, 6, 5], [10, 7, 5], [10, 8, 6], [10, 9, 6]];
    V.box(8, 1, 0, 12, 4, 2, W, 1);                                                              // the junction box
    if (!variant) {
      // the bullet: tipped down a cell every three toward the front, its long edges rounded off; the hood over it
      for (let z = 3; z < 13; z++) { const top = z < 8 ? 14 : 13, bot = top - 5;
        V.box(7, bot, z, 13, top, z + 1, z === 12 ? BK : W, 1); V.del(7, bot, z); V.del(12, bot, z); V.del(7, top - 1, z); V.del(12, top - 1, z);
        if (z >= 4) V.box(6, top, z, 14, top + 1, z + 1, WD, 1); }
      V.box(6, 14, 13, 14, 15, 14, WD, 1); V.box(6, 12, 13, 7, 14, 14, WD, 1); V.box(13, 12, 13, 14, 14, 14, WD, 1);   // the hood's lip over the front
      for (const p of cable) V.set(p[0], p[1], p[2], BK);
      V.set(8, 9, 12, K.red, LIT);                                                               // the lit dot
      return;
    }
    // the dome: a black mount at the arm's end, the smoked glass bubble under it
    for (let x = 5; x < 15; x++) for (let y = 13; y < 15; y++) for (let z = 4; z < 14; z++) if (Math.hypot(x + .5 - 10, z + .5 - 9) <= 4.7 - (y === 14 ? 1 : 0)) V.set(x, y, z, W, 1);   // the housing, a shallow cap
    for (let x = 5; x < 15; x++) for (let y = 7; y < 13; y++) for (let z = 4; z < 14; z++) if (Math.hypot(x + .5 - 10, (y + .5 - 13) * .95, z + .5 - 9) <= 4.6) V.set(x, y, z, 0x8a96aa, 1);   // the smoked glass
    for (const p of cable) V.set(p[0], p[1], p[2], BK);
    V.set(12, 13, 12, K.red, LIT);
  },
  // fine pass: bullet, the lens in its bezel (a dark barrel, the glass, a glint), a ring of infrared lights round it, the plate's screws, a
  // seam round the body; dome, the lens seen through the glass, its ring of lights, the glass's shine
  fine(P, { variant = 0, V }) {
    for (const [x, y] of [[7.25, 13.25], [12.25, 13.25], [7.25, 18.25], [12.25, 18.25]]) frect(P, '+z', x, y, x + .5, y + .5, 0x8a8e96);
    if (!variant) {
      fsurf(P, V, '+z', 7, 0, 12, 13, 20, 13, (x, y, z, i, j) => { const u = x + (i + .5) / 4 - 10, v = y + (j + .5) / 4 - 10.75, d = Math.hypot(u, v);
        if (d < .35) return 0xeaf6ff; if (d < .9) return (u + v) > .3 ? 0x3f6bc4 : 0x1b2a55; if (d < 1.25) return 0x0e0e12;
        if (d < 1.85) { const a = Math.atan2(v, u) / (Math.PI * 2) * 10; return Math.abs(a - Math.round(a)) < .22 ? 0xb82020 : null; } return null; });
      fcolour(P, V, 0xeef0f2, ['+x', '+y'], (x, y, z, f, i, j) => z === 9 && (f === '+x' ? i === 0 : j === 0) ? 0xc9ccd2 : null);
      return; }
    fsurf(P, V, '+z', 5, 7, 4, 15, 13, 14, (x, y, z, i, j) => { const u = x + (i + .5) / 4 - 10.5, v = y + (j + .5) / 4 - 10, d = Math.hypot(u, v);
      if (d < .3) return 0xeaf6ff; if (d < .85) return 0x0a0c12; if (d < 1.1) return 0x3a4252; if (d < 1.6) { const a = Math.atan2(v, u) / (Math.PI * 2) * 8; return Math.abs(a - Math.round(a)) < .2 ? 0xc02828 : 0x4a5468; } return null; });
    fsurf(P, V, '+z', 5, 7, 4, 15, 13, 14, (x, y, z, i, j) => x === 7 && y === 11 && i > 1 ? 0xe0e8f4 : null);
  } });

export const gateScissor = def({ id: 'gate-scissor', name: 'Scissor gate', cat: 'security', place: 'wall', foot: [5, 9], h: 0.15, mount: 0, sim: 'door', states: ['closed', 'open'],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['gate', 'door', 'nyc'], variants: 3, vnames: ['steel', 'black', 'gold'], far: true,
  game: g('gear', 'common', 'store', { secure: 'door', burgleOdds: -15 }),
  build(V, { variant = 0, state = 'closed' } = {}) {
    const [m, l] = pick([[K.steelL, 2], [0x26262c, 0], [K.gold, 2]], variant), open = state === 'open', W = open ? 6 : 25;
    V.box(0, 0, 0, 25, 1, 3, m, l); V.box(0, 44, 0, 25, 45, 3, m, l);                                                                 // tracks
    for (let x = 0; x < W; x++) for (let y = 1; y < 44; y++) { const vert = open ? x % 2 === 0 : x % 6 === 0 || x === 24, diag = ((x + y) % 6 < 2) || ((x - y + 600) % 6 < 2);
      if (vert) V.box(x, y, 0, x + 1, y + 1, 2, m, l); else if (diag && !open) V.set(x, y, 1, m, l); else if (open && y % 3 === 0) V.set(x, y, 1, m, l); }
    V.box(open ? 5 : 22, 20, 1, open ? 7 : 25, 24, 3, K.gold, 2); V.set(open ? 6 : 23, 21, 3 - 1, K.ink);                             // the padlock
  } });

// ── cooking gear
export const hotPlate = def({ id: 'hot-plate', name: 'Hot plate and pot', cat: 'kitchen', place: 'surface', foot: [2, 2], h: 0.3,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['cook', 'hot plate', 'gear'], variants: 2, vnames: ['white enamel', 'steel'],
  game: g('gear', 'common', 'store', { cook: 'stove' }),
  // fine pass (2026-11-17): the left ring is a black plate whose coil is painted, glowing; the dented pot stands on the right ring with
  // its neon bubbling under the rim; the front strip carries two knobs, their ticks and a pilot light; the cord leaves at the back
  build(V, { variant = 0 } = {}) {
    const b = pick([K.white, K.steel], variant);
    // the plate body (its top edge a step lighter), a dark front strip under the knobs
    V.box(0, 0, 1, 10, 2, 9, b, variant ? 2 : 1);
    // the left ring: a black coil plate (lit: the coil painted on it glows) · the right ring, under the pot
    cyl(V, 2.5, 5, 2.3, 1, 2, COIL, LIT); cyl(V, 7, 5, 2.3, 1, 2, K.ink);
    // the pot: an enamel saucepan (red on the white plate, teal on the steel one) round a recessed neon fill, a chrome rim
    cyl(V, 7, 5, 2.6, 2, 5, variant ? K.teal : K.red, 1); cyl(V, 7, 5, 1.7, 4, 5, -1); cyl(V, 7, 5, 1.7, 3, 4, K.lime, LIT);
  },
  fine(P, { variant = 0 } = {}) {
    // the coil: an orange spiral on the black plate, two and a half turns, hottest at the centre
    fdisc(P, '+y', 2.5, 5, 2.3, (d, th) => { if (d < .3 || d > 2.1) return null; const t = d * 2 - th / (Math.PI * 2); return t - Math.floor(t) < .45 ? (d < 1.2 ? K.amber : K.orange) : null; });
    // the pot's fill: lighter bubbles and a darker swirl
    for (const [bx, bz, br] of [[6.4, 4.4, .45], [7.6, 5.4, .35], [6.9, 6, .25], [7.8, 4.3, .2]]) fdisc(P, '+y', bx, bz, br, d => d > br - .26 ? 0xd9ffb8 : null);
    fdisc(P, '+y', 7, 5, 1.7, d => d > 1.45 ? K.green : null);
    // the rim: a chrome lip on the top of the wall; enamel chips and a shine down the front; the long handle, toward you
    fdisc(P, '+y', 7, 5, 2.6, d => d > 1.7 ? K.chrome : null);
    frect(P, '+z', 6, 2.25, 6.25, 4.75, K.white); for (const [cx, cy] of [[7.75, 2.75], [5.25, 3.5], [8.25, 4]]) frect(P, '+z', cx, cy, cx + .25, cy + .25, K.ink);
    hbox(P, 6.5, 4, 8, 7.5, 4.5, 10, K.ink);
    // the front strip: dark panel, two knobs with a white mark and ticks, a red pilot light (lit)
    frect(P, '+z', .5, .25, 9.5, 1.75, K.ink);
    for (const kx of [2, 5.5]) { hbox(P, kx, .5, 9, kx + 1, 1.5, 9.5, K.chrome, 2); P.half(Math.round(kx * 2), 2, 19, K.ink);
      for (const [dx, dy] of [[-.5, 1.5], [1.25, 1.5], [-.5, .25], [1.25, .25]]) frect(P, '+z', kx + dx, dy, kx + dx + .25, dy + .25, K.white); }
    P.half(17, 2, 18, K.red, LIT);
    // the cord: out of the back, down to the counter, off to the left
    hbox(P, 1, .5, .5, 2, 1.5, 1, K.ink); hbox(P, 0, 0, 0, 1.5, .5, 1, K.ink);
  } });
const COIL = 0x2a1d1d;

export const cookRig = def({ id: 'cook-rig', name: 'Cook rig', cat: 'kitchen', place: 'floor', foot: [6, 3], h: 1.3, tops: [0.7],
  tiers: ['trailer', 'apartment', 'house'], tags: ['cook', 'rig', 'gear'], variants: 2, vnames: ['steel bench', 'plywood bench'], far: true,
  game: g('gear', 'epic', 'craft', { cook: 'rig' }),
  // fine pass (2026-11-17): the burner's blue flame under a stockpot whose neon fill sits under a chrome rim, a thermometer in it; the
  // flask shows its pink fill through the glass, ticks up its side, a cork and an orange hose over to the pot; jugs with plain bands;
  // a red gas bottle on the shelf, its valve and hose up through the bench; the goggles' strap and shine; a ruled notebook and a pen
  build(V, { variant = 0 } = {}) {
    const top = variant ? K.ply : K.steelL, l = variant ? 0 : 2;
    // legs, the bench, a lower shelf
    for (const x of [1, 27]) for (const z of [1, 12]) V.box(x, 0, z, x + 2, 14, z + 2, K.steelD, 2);
    V.box(0, 13, 0, 30, 14, 15, top, l); V.box(1, 3, 1, 29, 4, 14, K.steelD, 2);
    // plain jugs on the shelf, red caps; the gas bottle beside them, its brass valve
    for (const x of [3, 9, 15]) { V.box(x, 4, 3, x + 4, 10, 8, K.white, 1); V.box(x + 1, 10, 4, x + 3, 11, 6, K.red); }
    cyl(V, 23.5, 9.5, 2.2, 4, 10, K.red, 1); cyl(V, 23.5, 9.5, 1.4, 10, 11, K.red, 1); cyl(V, 23.5, 9.5, .8, 11, 12, K.gold, 2);
    // the burner ring (lit: its flame is painted on it), the stockpot over it, recessed neon inside, handles
    cyl(V, 7.5, 7.5, 3.7, 14, 15, BURN, LIT);
    cyl(V, 7.5, 7.5, 3.9, 15, 22, K.steelL, 2); cyl(V, 7.5, 7.5, 3.1, 21, 22, -1); cyl(V, 7.5, 7.5, 3.1, 20, 21, K.lime, LIT);
    V.box(2, 20, 7, 4, 22, 8, K.ink); V.box(11, 20, 7, 13, 22, 8, K.ink);
    // a round flask (glass: its pink fill painted through it), the clamp stand holding its neck
    cyl(V, 18.5, 7.5, 2.8, 14, 19, K.glass, 1); cyl(V, 18.5, 7.5, 1, 19, 24, K.glass, 1);
    V.box(22, 14, 6, 24, 25, 8, K.steelD, 2); V.box(19, 22, 6, 22, 23, 8, K.steelD, 2);
    // goggles on a pad, a notebook
    V.box(25, 14, 3, 29, 16, 7, 0x1f1f24); V.box(25, 16, 4, 29, 17, 6, K.lime, 1); V.box(26, 14, 9, 29, 15, 12, K.white);
  },
  fine(P, { V }) {
    // the burner: blue flame tongues licking up its side, bright at the root
    for (const f of ['+z', '+x', '-x']) fsurf(P, V, f, 3, 14, 3, 12, 15, 12, (x, y, z, i, j) => { const k = (f === '+z' ? x * 4 + i : z * 4 + i) % 3; return j <= (k === 1 ? 3 : k === 0 ? 2 : 1) ? (j === 0 ? K.white : j === 1 ? K.cyan : K.cobalt) : null; });
    // the pot: a chrome rim, bubbles in the fill, a shine and a seam down its front; a thermometer stood in it
    fdisc(P, '+y', 7.5, 7.5, 3.9, d => d > 3.1 ? K.chrome : null);
    for (const [bx, bz, br] of [[6, 6.5, .6], [8.6, 8.4, .5], [8.4, 5.8, .35], [5.8, 9, .3]]) fdisc(P, '+y', bx, bz, br, d => d > br - .26 ? 0xd9ffb8 : null);
    frect(P, '+z', 5.75, 15.5, 6, 20.5, K.white); frect(P, '+z', 4, 17.75, 11, 18, shade(K.steelL, .75));
    hbox(P, 9, 21, 6.5, 9.5, 24, 7, K.chrome, 2); hbox(P, 8.5, 24, 6.5, 10, 24.5, 7.5, K.white);
    // the flask: the pink fill showing through the glass up to its level, a shine, ticks; the cork; the hose over to the pot's rim
    for (const f of ['+z', '+x', '-x']) fsurf(P, V, f, 15, 14, 4, 22, 19, 11, (x, y, z, i, j) => y + j / 4 < 16.6 ? (y === 16 && j === 2 ? K.pink : mix(K.pink, K.glass, .25)) : null);
    frect(P, '+z', 16.75, 15, 17, 18.5, K.white); for (const y of [15, 16, 17]) frect(P, '+z', 19.5, y, 20.25, y + .25, K.white);
    hbox(P, 18, 24, 7, 19, 25, 8, 0xa8723e);
    hbox(P, 10.5, 22, 7, 17, 22.5, 7.5, K.tang);
    // the gas bottle's hose, from its valve up through the bench
    hbox(P, 23, 12, 9, 23.5, 13, 9.5, K.ink);
    // the jugs: a plain band each, two lines on it
    for (const [x, c] of [[3, K.yellow], [9, K.sky], [15, K.orange]]) { frect(P, '+z', x + .25, 5.5, x + 3.75, 8, c); frect(P, '+z', x + .75, 7, x + 3.25, 7.25, K.ink); frect(P, '+z', x + .75, 6.25, x + 2.5, 6.5, K.ink); }
    // the goggles: the strap round the pad's side, a shine on the lens
    frect(P, '+z', 25, 14.5, 29, 15, K.ink); fline(P, '+y', 25.25, 4.25, 26.5, 4.25, K.white);
    // the notebook: ruled lines, a red margin; a pen across it
    for (let k = 0; k < 4; k++) frect(P, '+y', 26.25, 9.5 + k * .625, 28.75, 9.75 + k * .625, 0x7fa8d9);
    frect(P, '+y', 26.5, 9, 26.75, 12, K.red);
    hbox(P, 26.5, 15, 10.5, 29, 15.5, 11, K.cobalt);
  } });
const BURN = 0x1a2030;

// ── laying low
export const arcadeCab = def({ id: 'arcade-cab', name: 'Arcade cabinet', cat: 'gaming', place: 'floor', foot: [3, 3], h: 1.85,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['arcade', 'gaming', 'retro'], variants: 3, vnames: ['HEAT CHECK red', 'HEAT CHECK cobalt', 'HEAT CHECK black'], far: true,
  game: g('gear', 'epic', 'drop', { heatDecay: 1.3 }),
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([K.red, K.cobalt, 0x1f1f24], variant);
    const side = (y, z) => (y < 15 && z >= 2 && z < 13) || (y >= 15 && y < 18 && z >= 2 && z < 15) || (y >= 18 && y < 29 && z >= 2 && z < 10) || (y >= 29 && z >= 2 && z < 12);
    for (const x of [0, 14]) for (let y = 0; y < 37; y++) for (let z = 0; z < 15; z++) if (side(y, z)) { const fl = ((z * 2 + y * 3 + Math.round(Math.sin(y * .7) * 3)) % 9 < 2) && y < 18;
      V.set(x, y, z, fl ? (y > 10 ? K.yellow : K.orange) : c); }                                                                      // side panels with flame art
    V.box(1, 0, 2, 14, 15, 13, c); V.box(1, 15, 2, 14, 18, 15, 0x1f1f24); V.box(1, 18, 2, 14, 37, 4, c);                                // body, the control deck, back
    V.box(1, 36, 2, 14, 37, 12, c); V.box(1, 29, 11, 14, 36, 12, 0x2a1f3a, LIT); txt(V, M3('HOT'), 2, 34, 11, K.yellow, LIT);         // top, the lit marquee
    V.box(1, 18, 4, 14, 29, 9, K.ink); screen(V, 2, 19, 13, 28, 9, 'game', seed);                                                         // the screen
    V.box(5, 4, 13, 10, 9, 14, 0x26262c); V.set(6, 7, 13, K.red, LIT); V.set(8, 7, 13, K.red, LIT);                                        // coin door
    V.box(4, 18, 11, 5, 20, 12, K.ink); V.set(4, 20, 11, K.red); for (const [x, cc] of [[8, K.yellow], [10, K.cyan], [12, K.pink]]) V.set(x, 18, 12, cc);   // stick, buttons
  } });

export const GEAR = [stashSpeaker, stashEncyclopedia, safeFloor, stashSoda, stashCereal, stashOutlet, cctv, gateScissor, hotPlate, cookRig, arcadeCab];
