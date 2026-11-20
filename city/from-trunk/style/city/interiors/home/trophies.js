// Home objects · catalogue v2 · trophies: one per sim MARK (OUTLINE §1.9) plus two awards. A MARK made physical, something you'd put on
// the shelf to show off, never a plaque or a shield. Never stolen, never traded (game.kind 'trophy', stealable false). Event marks have
// no rarity of their own in FORMAT, so they read 'rare' with an 'event' tag.
import { def, K, pick, cyl, cylZ, line, glow, LIT, shade, hash, rng, txt, M3, face, lathe, prof, ball } from './lib.js';
import { tro, vitrine, cushion, brick } from './bits.js';

const T = o => def({ cat: 'trophies', tiers: ['trailer', 'apartment', 'house', 'penthouse'], ...o, tags: ['trophy', ...(o.tags || [])] });
const shell = (V, cx, cy, cz, r, keep, c, l = 1) => { for (let x = Math.floor(cx - r - 1); x <= cx + r; x++) for (let y = Math.floor(cy - r - 1); y <= cy + r; y++) for (let z = Math.floor(cz - r - 1); z <= cz + r; z++) {
  const d = Math.hypot(x + .5 - cx, y + .5 - cy, z + .5 - cz); if (Math.abs(d - r) < .62 && keep(x, y, z)) V.set(x, y, z, c, l); } };

export const firstHouse = T({ id: 'trophy-first-house', name: 'First-house snow globe', place: 'surface', foot: [2, 2], h: 0.5, tags: ['snow globe', 'house'],
  game: tro('common', 'first-house'),
  grain: 0.025, shaped: 'a snow globe: the glass ball, the little house and the snow inside it',
  build(V) {
    // THIRD PASS · a walnut base with its gold plate; in the glass a snowy mound, a little red house (a white roof, a lit window, a
    // chimney), a fir tree; the ball drawn as its far half (pale glass and the snow stuck on it), so you look into it, as you do
    lathe(V, 10, 10, 0, 5, prof([[0, 7.6], [1, 7.6], [5, 6.4]]), (x, y) => (y === 4 ? shade(K.walnut, 1.2) : K.walnut));   // the base
    V.box(7, 1, 16, 13, 3, 17, K.gold, 2);                                                                                 // its plate
    lathe(V, 10, 10, 5, 7, prof([[5, 6.6], [7, 4]]), K.white);                                                            // the snow mound
    V.box(8, 7, 9, 13, 10, 13, K.red); V.box(10, 7, 12, 11, 9, 13, 0x5a3418); V.set(12, 8, 12, K.yellow, LIT);            // the house: walls, a door, a window
    for (let k = 0; k < 3; k++) V.box(8 - 1 + k, 10 + k, 9 - 0, 13 + 1 - k, 11 + k, 13, K.white);                         // its roof, under snow
    V.box(11, 11, 10, 12, 13, 11, K.brick);                                                                                 // the chimney
    for (let k = 0; k < 4; k++) cyl(V, 5.5, 9.5, 2 - k * .45, 7 + k * 1.5, 8.5 + k * 1.5, K.leafD); V.set(5, 13, 9, K.white);   // a fir, its snowy tip
    const cy = 12.4, R = 7.6, vd = [.48, .5, .72];
    for (let y = 5; y < 20; y++) for (let z = 0; z < 20; z++) for (let x = 0; x < 20; x++) {
      const dx = x + .5 - 10, dy = y + .5 - cy, dz = z + .5 - 10, d = Math.hypot(dx, dy, dz); if (d > R || d < R - 1.1) continue;
      if ((dx * vd[0] + dy * vd[1] + dz * vd[2]) / d > -.05 && y > 6) continue;                                            // the near half: clear
      V.set(x, y, z, hash(x, y, z) > .86 ? K.white : 0xcfe8f5, 1); }
    for (const [x, y, z] of [[4, 17, 6], [14, 18, 5], [9, 19, 6]]) V.set(x, y, z, K.glint, 1);                            // the glass catching the light
  } });

export const firstDeal = T({ id: 'trophy-first-deal', name: 'The first bill, framed', place: 'wall', foot: [2, 3], h: 0.1, mount: 1.3, tags: ['framed', 'cash'],
  game: tro('common', 'first-deal'),
  build(V) {
    V.box(0, 0, 0, 10, 15, 2, K.gold, 2); V.box(1, 1, 1, 9, 14, 2, -1); V.box(1, 1, 0, 9, 14, 1, 0x1f1f24);                             // shadow box, velvet
    V.box(1, 7, 1, 9, 12, 2, (x, y) => (x + y) % 5 === 0 ? K.cashD : K.cash); V.box(4, 8, 1, 6, 11, 2, K.cream); V.set(4, 9, 1, K.ink);  // the crumpled first bill, its portrait
    V.box(3, 2, 1, 7, 6, 2, K.glass, 1); V.box(4, 3, 1, 6, 5, 2, K.lime, LIT); V.set(5, 6, 1, K.gold, 2); V.set(5, 12, 1, K.gold, 2);    // the first baggie, pinned
  } });

export const didTime = T({ id: 'trophy-did-time', name: 'Mugshot with commissary art', place: 'wall', foot: [5, 6], h: 0.1, mount: 1.1, tags: ['mugshot', 'prison', 'framed'],
  game: tro('rare', 'did-time'),
  build(V, { seed = 1 } = {}) {
    V.box(0, 0, 0, 25, 30, 1, (x, y) => hash(x, y, 2) > .93 ? K.bone : K.cream);                                                         // an envelope-paper mat
    for (const [cx, cy] of [[3, 26], [21, 4], [3, 5], [22, 26]]) { for (let a = 0; a < 6; a++) V.set(Math.round(cx + Math.cos(a) * 1.4), Math.round(cy + Math.sin(a) * 1.4), 1, K.red); V.set(cx, cy, 1, K.oxblood); for (let y = cy - 5; y < cy - 1; y++) V.set(cx, y > 0 ? y : 0, 1, K.grass); }   // ballpoint roses
    for (let x = 6; x < 19; x++) V.set(x, 2 + ((x * 3) % 2), 1, K.cobalt); for (const x of [10, 14]) { V.set(x, 27, 1, K.red); V.set(x + 1, 27, 1, K.red); V.set(x, 28, 1, K.red); V.set(x + 1, 28, 1, K.red); }   // a blue-pen line, two hearts
    V.box(5, 6, 1, 20, 25, 2, 0x1f1f24); V.box(6, 7, 1, 19, 24, 2, (x, y) => y % 3 === 0 ? K.white : K.pale);                          // the photo's frame, the height chart
    V.box(7, 7, 1, 18, 13, 2, K.orange); face(V, 8, 13, 1, 9, 10, { skin: K.skin[(seed % 5)], hair: K.ink, lids: true });                 // the jumpsuit, the big head
    V.box(7, 8, 1, 18, 12, 2, K.ink); txt(V, M3('451'), 7, 11, 1, K.white);                                                              // the placard
  } });

export const snitch = T({ id: 'trophy-snitch', name: 'RAT designer toy', place: 'surface', foot: [2, 2], h: 0.6, tags: ['rat', 'vinyl toys', 'snitch'],
  game: tro('rare', 'snitch'),
  grain: 0.025, shaped: 'a vinyl rat: the big round ears, the long snout and nose, whiskers, the tail, the phone at its ear',
  build(V) {
    // THIRD PASS · a designer-toy rat: a big grey head with round pink-lined ears, a long snout, a pink nose, beady eyes, whiskers and
    // two buck teeth; a trench coat with the collar up; a phone at its ear (the snitch); the long pink tail curled on the base
    lathe(V, 10, 10, 0, 2, () => 8.4, K.white, 1); V.box(15, 0, 15, 18, 2, 18, K.red);                                // the base, a report sticker
    lathe(V, 10, 10, 2, 11, prof([[2, 4.6], [11, 3.4]]), (x, y, z, d, th) => (Math.abs(th - Math.PI / 2) < .18 && y > 3 ? shade(K.buff, .8) : K.buff));   // the trench coat, its opening
    lathe(V, 10, 10, 10, 12, () => 3.9, shade(K.buff, .82));                                                        // the collar, up
    for (const sx of [-1, 1]) line(V, 10 + sx * 3.5, 9, 10, 10 + sx * 4.5, 6, 12, K.buff);                           // the arms
    ball(V, 10, 15.5, 10, 5.2, 4.6, 5, K.grey, 1);                                                                   // the head
    ball(V, 10, 14, 15, 2.8, 2.2, 3.4, K.grey, 1); ball(V, 10, 14.4, 18.4, 1.1, 1, 1, K.pink, 1);                   // the snout, the nose
    V.box(9, 11.5, 16, 11, 12.5, 17, K.white);                                                                       // buck teeth
    for (const sx of [-1, 1]) { ball(V, 10 + sx * 4.8, 20, 8.6, 3.4, 3.4, 1.2, (x, y, z, u, v, w) => (Math.hypot(u, v) < .62 && w > 0 ? K.pink : K.grey), 1);   // the ears, round, to the front
      V.set(10 + sx * 2.3, 16.8, 14.4, K.ink); V.set(10 + sx * 2.3 + (sx > 0 ? -1 : 0), 17.2, 14.4, K.white);        // the eyes, a glint
      for (const dy of [-.8, .4]) line(V, 10 + sx * 2.4, 14 + dy, 16.5, 10 + sx * 7, 14.6 + dy * 2, 17.5, K.ink); }   // whiskers
    V.box(15, 13, 8, 16, 18, 11, K.ink); V.box(15, 14, 10, 16, 17, 11, K.cyan, LIT); line(V, 14, 9, 11, 15, 13, 10, K.buff);   // the phone at its ear, its arm
    for (let k = 0; k < 14; k++) { const t = k / 13, a = Math.PI * .6 + t * 3.4; V.set(10 + Math.cos(a) * (6.2 + t), 2, 10 + Math.sin(a) * (6.2 + t), K.pink); }   // the tail, curled round
  } });

export const gotRobbed = T({ id: 'trophy-got-robbed', name: 'The empty case', place: 'surface', foot: [2, 2], h: 0.55, tags: ['vitrine', 'empty', 'robbed'],
  game: tro('rare', 'got-robbed'),
  build(V) {
    V.box(1, 0, 1, 9, 4, 9, K.ink); V.box(2, 4, 2, 8, 5, 8, K.oxblood);                                                                  // plinth, velvet
    for (const [x, z] of [[3, 4], [4, 4], [5, 4], [6, 4], [3, 6], [4, 6], [5, 6], [6, 6], [3, 5], [6, 5]]) V.set(x, 4, z, K.white);       // a chalk outline where the brick sat
    V.box(6, 5, 2, 8, 6, 4, K.yellow); V.set(7, 5, 3, K.ink);                                                                             // the IOU note
    for (const [x, z] of [[1, 1], [8, 1], [1, 8]]) V.box(x, 4, z, x + 1, 10, z + 1, K.gold, 2); for (const z of [1, 8]) V.box(1, 10, z, 9, 11, z + 1, K.gold, 2); for (const x of [1, 8]) V.box(x, 10, 1, x + 1, 11, 9, K.gold, 2);   // three posts left, the lid's rim (clear: third pass)
    V.box(8, 4, 8, 9, 6, 9, K.gold, 2); V.set(8, 4, 7, K.glint, 1); V.set(7, 4, 8, K.glint, 1);                                           // the jimmied post, glass on the floor
  } });

export const cleanStreak = T({ id: 'trophy-clean-streak', name: 'Clean-streak chips + halo', place: 'surface', foot: [2, 2], h: 0.6, tags: ['halo', 'chips', 'sober'],
  game: tro('rare', 'clean-streak'),
  build(V) {
    for (let k = 0; k < 5; k++) { cyl(V, 5, 5, 3.6, k, k + 1, k === 4 ? K.gold : (k & 1) ? K.white : K.cobalt, k === 4 ? 2 : 1); cyl(V, 5, 5, 2.4, k, k + 1, K.white, 1); }   // a stack of streak chips
    V.box(4, 5, 4, 6, 6, 6, K.gold, 2); for (let y = 5; y < 10; y++) V.set(5, y, 2, K.glass, 1);                                         // the top chip's centre, a clear rod
    for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) { const d = Math.hypot(x + .5 - 5, z + .5 - 5); if (d > 2.4 && d < 3.6) V.set(x, 10, z, K.yellow, LIT); }   // the halo
    V.set(5, 9, 2, K.glass, 1); V.set(5, 10, 2, K.yellow, LIT);
  } });

export const addict = T({ id: 'trophy-addict', name: 'Beachball-eye lamp', place: 'surface', foot: [2, 2], h: 0.6, tags: ['eyeball', 'lamp', 'pupils'],
  game: tro('rare', 'addict'),
  build(V) {
    cyl(V, 5, 5, 3.5, 0, 1, K.chrome, 2); V.box(4, 1, 4, 6, 4, 6, K.chrome, 2);                                                            // base, stem
    for (let x = 0; x < 10; x++) for (let y = 3; y < 12; y++) for (let z = 0; z < 10; z++) { const X = x + .5 - 5, Y = y + .5 - 7.6, Z = z + .5 - 5; if (Math.hypot(X, Y, Z) > 3.9) continue;
      let c = K.white, l = 1; if (Z > 2.1) { const rr = Math.hypot(X, Y); if (rr < 1) { c = K.ink; l = 0; } else if (rr < 2.9) { c = pick([K.red, K.yellow, K.cobalt, K.white, K.lime, K.pink], ((Math.atan2(Y, X) + Math.PI) / (Math.PI * 2) * 6) | 0); l = LIT; } }
      else if (hash(x, y * 5 + z, 3) > .88) c = K.red; V.set(x, y, z, c, l); }                                                           // the eyeball, a beachball iris, veins
  } });

export const crackdown = T({ id: 'trophy-crackdown', name: 'Crackdown beacon', place: 'surface', foot: [2, 2], h: 0.5, tags: ['siren', 'event', 'crackdown'],
  game: { ...tro('rare', 'survived-crackdown') },
  build(V) {
    V.box(1, 0, 1, 9, 3, 9, K.gold, 2); V.box(2, 3, 2, 8, 5, 8, 0x1f1f24); V.box(3, 0, 9 - 1, 7, 2, 9, K.ink);                            // gold plinth, the beacon's black base
    for (let x = 2; x < 8; x++) for (let y = 5; y < 10; y++) for (let z = 2; z < 8; z++) { const d = Math.hypot(x + .5 - 5, (y + .5 - 5) * .9, z + .5 - 5); if (d <= 3.1) V.set(x, y, z, x < 5 ? K.red : K.cobalt, LIT); }   // the red + blue dome
    V.box(4, 8, 4, 6, 9, 6, K.chrome, 2);
  } });

export const inTheBank = T({ id: 'trophy-in-the-bank', name: 'Dye-pack bills, framed', place: 'wall', foot: [3, 3], h: 0.15, mount: 1.2, tags: ['bank', 'event', 'framed'],
  game: tro('rare', 'was-in-the-bank'),
  build(V) {
    V.box(0, 0, 0, 15, 15, 3, K.gold, 2); V.box(1, 1, 1, 14, 14, 3, -1); V.box(1, 1, 0, 14, 14, 1, K.navy);                             // shadow box, navy back
    for (let k = 0; k < 5; k++) { const a = -0.7 + k * .35; for (let t = 0; t < 9; t++) for (let w = -1; w <= 1; w++) { const x = Math.round(7.5 + Math.sin(a) * t + Math.cos(a) * w * .8), y = Math.round(3 + Math.cos(a) * t - Math.sin(a) * w * .8);
      if (x > 0 && x < 14 && y > 0 && y < 14) V.set(x, y, 1, hash(x, y, k) > .55 ? K.pink : w === 0 && t === 5 ? K.cream : K.cash); } }       // five bills, fanned, stained pink
    cylZ(V, 12, 3, 1.4, 1, 3, K.chrome, 2); V.set(12, 5, 1, K.gold, 2);                                                                     // the teller's bell
  } });

export const kingpinCrown = T({ id: 'trophy-kingpin-crown', name: 'Kingpin crown on a pedestal', place: 'floor', foot: [2, 2], h: 1.3, tags: ['crown', 'velvet', 'most wanted'],
  game: tro('epic', 'kingpin-crown'),
  build(V) {
    V.box(1, 0, 1, 9, 2, 9, K.gold, 2); V.box(2, 2, 2, 8, 16, 8, (x, y) => (x % 2 && y > 3 && y < 15) ? 0x2a2a31 : 0x1f1f24, 1); V.box(1, 16, 1, 9, 18, 9, K.gold, 2);   // a fluted black column, gold bands
    cushion(V, 1, 1, 9, 9, 18, K.red);                                                                                                  // the velvet cushion
    V.box(2, 21, 2, 8, 23, 8, K.gold, 2); V.box(3, 21, 3, 7, 24, 7, K.red); for (const [x, z] of [[2, 2], [7, 2], [2, 7], [7, 7], [4, 2], [4, 7], [2, 4], [7, 4]]) V.box(x, 23, z, x + 1, x === 4 || z === 4 ? 26 : 25, z + 1, K.gold, 2);   // the band, a velvet cap, its points
    for (const [x, c] of [[3, K.red], [5, K.cyan], [6, K.lime]]) V.set(x, 22, 7, c, 2);        // jewels
  } });

export const goldGrill = T({ id: 'trophy-gold-grill', name: 'Gold grill on a jaw', place: 'surface', foot: [2, 2], h: 0.5, tags: ['grill', 'gold', 'richest'],
  game: tro('epic', 'gold-grill'),
  grain: 0.025, shaped: 'a gold grill on a jaw: the arch of the gums, each tooth and its gold cap, the diamonds',
  grain: 0.025, shaped: 'a gold grill on a jaw: the arch of the gums, each tooth and its gold cap, the diamonds',
  build(V) {
    // THIRD PASS · a jaw form on a velvet plinth, its lips parted: two arches of pink gums, every front tooth capped in gold, two
    // set with a diamond; the case's lid is clear (bits.js vitrine), so the grill is what you see from above and from the front
    V.box(1, 0, 1, 19, 1, 19, K.ink); V.box(2, 1, 2, 18, 5, 18, 0x1f1f24); V.box(7, 2, 18 - 1, 13, 4, 18, K.gold, 2);   // the plinth, its plate
    const cx = 10, arch = (x, z0, depth) => z0 - ((x + .5 - cx) ** 2) / depth;                                        // the U of a jaw, front at +z
    const GUM = 0xe0707a, GUMD = 0xb84f5c;
    for (const [y0, y1, up] of [[5, 10, false], [11, 16, true]]) {                                                       // the lower jaw, the upper
      for (let x = 2; x < 18; x++) { const zf = arch(x, 16.5, 5.5); if (zf < 5) continue;
        for (let z = Math.max(4, Math.floor(zf - 3.2)); z <= Math.floor(zf); z++) for (let y = y0; y < y1; y++) {
          const gum = up ? y >= y1 - 2 : y < y0 + 2, front = z === Math.floor(zf), tooth = !gum && front;
          const tx = Math.floor((x - 2) / 2), gold = tooth && Math.abs(x + .5 - cx) < 6.2, gap = tooth && y % 5 === (up ? 1 : 4);
          V.set(x, y, z, gum ? (front ? GUM : GUMD) : gap ? 0x8a6a28 : gold ? (tx % 2 ? K.gold : shade(K.gold, .9)) : K.white, gum ? 1 : gold || gap ? 2 : 1); } }
    }
    for (const [x, y] of [[8, 7], [12, 13]]) V.set(x, y, Math.floor(arch(x, 16.5, 5.5)) + 1, K.cyan, 1);               // two diamonds, set proud
    V.box(4, 10, 8, 16, 11, 13, 0x5a1f2a);                                                                               // the dark of the mouth between
    vitrine(V, 0, 0, 20, 20, 1, 20);
  } });

export const halo = T({ id: 'trophy-halo', name: 'Most Trusted halo', place: 'floor', foot: [2, 2], h: 1.5, tags: ['halo', 'handshake', 'trusted'],
  game: tro('epic', 'halo'),
  build(V) {
    V.box(1, 0, 1, 9, 2, 9, K.white, 1); V.box(2, 2, 2, 8, 18, 8, (x, y, z) => (x + z) % 2 ? K.white : K.bone, 1); V.box(1, 18, 1, 9, 20, 9, K.white, 1);   // a fluted white column
    V.box(1, 20, 4, 5, 22, 6, K.gold, 2); V.box(5, 20, 4, 9, 22, 6, K.gold, 2); V.box(4, 22, 4, 6, 23, 6, K.gold, 2); V.set(3, 22, 5, K.gold, 2);   // two gold hands shaking
    for (let y = 20; y < 28; y++) V.set(5, y, 2, K.gold, 2);                                                                              // the rod
    for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) { const d = Math.hypot(x + .5 - 5, z + .5 - 5); if (d > 2.4 && d < 3.7) V.set(x, 28, z, K.yellow, LIT); }   // the halo
  } });

export const crewCrown = T({ id: 'trophy-crew-crown', name: 'Crew crown on bandanas', place: 'surface', foot: [2, 2], h: 0.5, tags: ['crown', 'crew', 'bandana'],
  game: tro('epic', 'crew-crown'), variants: 3, vnames: ['red crew', 'blue crew', 'green crew'],
  build(V, { variant = 0 } = {}) {
    const c = pick([K.red, K.cobalt, K.grass], variant);
    for (let k = 0; k < 4; k++) V.box(1 + (k & 1), k, 1 + (k >> 1), 9 - (k & 1), k + 1, 9 - (k >> 1), (x, y, z) => (x + z * 3) % 5 === 0 ? K.white : k % 2 ? shade(c, .85) : c);   // folded bandanas
    for (let x = 2; x < 8; x++) for (let z = 2; z < 8; z++) if (x === 2 || x === 7 || z === 2 || z === 7) V.box(x, 4, z, x + 1, 6, z + 1, K.chrome, 2);   // the chrome band
    for (const [x, z] of [[2, 2], [7, 2], [2, 7], [7, 7], [4, 7], [5, 2], [2, 4], [7, 5]]) V.box(x, 6, z, x + 1, (x + z) % 3 ? 8 : 9, z + 1, K.chrome, 2);   // spikes
    for (const x of [3, 6]) V.set(x, 5, 7, c, 2);                                                                                         // crew-colour stones
  } });

export const ghost = T({ id: 'trophy-ghost', name: 'The ghost', place: 'floor', foot: [3, 3], h: 1.2, tags: ['ghost', 'legendary', 'came back'],
  game: tro('legendary', 'ghost'),
  build(V) {
    V.box(1, 0, 1, 14, 3, 14, 0x1f1f24); V.box(1, 2, 1, 14, 3, 14, K.gold, 2);                                                         // plinth
    for (let x = 0; x < 15; x++) for (let y = 3; y < 24; y++) for (let z = 0; z < 15; z++) { const X = x + .5 - 7.5, Z = z + .5 - 7.5, r = Math.hypot(X, Z);
      const body = y < 16 && r < 5.2 && !(y < 5 && ((Math.atan2(Z, X) * 4 + 20 | 0) % 2) && y === 3), head = Math.hypot(X, y + .5 - 16, Z) < 5.3;
      if (body || head) V.set(x, y, z, K.white, 1); }                                                                                   // the sheet, a scalloped hem
    for (const x of [5, 9]) V.box(x, 16, 12, x + 2, 19, 13, K.cyan, LIT); V.box(7, 13, 12, 9, 15, 13, K.ink);                             // lit eyes, an "o"
    V.box(12, 9, 6, 14, 11, 9, K.white, 1); line(V, 13, 9, 8, 13, 6, 8, K.buff); V.box(12, 4, 7, 15, 6, 9, K.cream); V.set(13, 5, 9 - 1, K.ink);   // an arm, the string, the toe tag
  } });

export const chrome = T({ id: 'trophy-chrome', name: 'Chrome bust', place: 'floor', foot: [2, 2], h: 1.35, tags: ['chrome', 'bust', 'legendary'],
  game: tro('legendary', 'chrome'),
  build(V) {
    V.box(1, 0, 1, 9, 11, 9, (x, y) => (y === 10 ? K.gold : hash(x, y, 4) > .85 ? 0x3a3c44 : 0x26262c), 1);                                 // black marble plinth
    V.box(0, 11, 2, 10, 15, 8, K.chrome, 2); V.box(3, 15, 3, 7, 17, 7, K.chrome, 2);                                                       // shoulders, neck
    V.box(1, 17, 1, 9, 27, 9, K.chrome, 2); V.box(1, 24, 1, 9, 27, 9, K.steelL, 2); V.box(1, 24, 9 - 1, 9, 25, 9, K.steelL, 2);            // the big head, its hair
    for (const x of [2, 6]) V.box(x, 21, 8, x + 2, 22, 9, K.steelD, 2); V.box(3, 18, 8, 7, 19, 9, K.steelD, 2);                           // eyes, mouth (cut into the chrome)
  } });

export const missingTexture = T({ id: 'trophy-missing-texture', name: 'Missing-texture monolith', place: 'floor', foot: [3, 3], h: 1.8, tags: ['glitch', '1 of 1', 'most wanted'],
  game: tro('1of1', 'missing-texture'), far: true,
  build(V) {
    V.box(1, 0, 1, 14, 2, 14, 0x1f1f24);
    const ck = (a, b, c) => (((a / 3) | 0) + ((b / 3) | 0) + ((c / 3) | 0)) & 1;
    for (let x = 3; x < 12; x++) for (let y = 2; y < 36; y++) for (let z = 4; z < 11; z++) V.set(x, y, z, ck(x, y, z) ? 0xff00dc : 0x0a0a0a, ck(x, y, z) ? LIT : 0);   // the magenta / black checker
    for (const [x, y, z] of [[12, 20, 6], [12, 21, 6], [13, 21, 6], [2, 28, 8], [1, 28, 8], [12, 9, 9]]) V.set(x, y, z, 0xff00dc, LIT);   // glitch cubes stepping off it
  } });

export const firstHeist = T({ id: 'trophy-first-heist', name: 'First-heist vault wheel', place: 'wall', foot: [6, 6], h: 0.35, mount: 1.2, tags: ['vault', 'heist', '1 of 1'],
  game: tro('1of1', 'first-heist'), far: true,
  build(V) {
    for (let x = 0; x < 30; x++) for (let y = 0; y < 30; y++) { const d = Math.hypot(x + .5 - 15, y + .5 - 15); if (d < 14.5) V.box(x, y, 0, x + 1, y + 1, 2, d > 13 ? K.steelD : K.steel, 2);
      if (d > 11.8 && d < 13 && (Math.round(Math.atan2(y - 15, x - 15) * 4) % 2 === 0)) V.set(x, y, 2, K.gold, 2); }                     // the round door plate, a ring of bolts
    cylZ(V, 15, 15, 3.2, 2, 6, K.chrome, 2); cylZ(V, 15, 15, 1.4, 6, 7, K.gold, 2);                                                         // the hub
    for (let a = 0; a < 5; a++) { const t = a / 5 * Math.PI * 2 + Math.PI / 2, ex = 15 + Math.cos(t) * 10.5, ey = 15 + Math.sin(t) * 10.5;
      for (const z of [4, 5]) line(V, 15 + Math.cos(t) * 2.5, 15 + Math.sin(t) * 2.5, z, ex, ey, z, K.gold, 2);
      V.box(Math.round(ex) - 1, Math.round(ey) - 1, 3, Math.round(ex) + 1, Math.round(ey) + 1, 7, K.chrome, 2); }                           // five gold spokes, chrome knobs
  } });

export const cornerMansion = T({ id: 'trophy-corner-mansion', name: 'Corner-lot mansion model', place: 'surface', foot: [3, 3], h: 0.55, tags: ['model', 'mansion', '1 of 1'],
  game: tro('1of1', 'first-corner-mansion'),
  grain: 0.025, shaped: 'a model of a house: the columns, the roof, the windows, the pool and the trees',
  build(V) {
    // THIRD PASS · the model on its plinth: a corner lot (lawn, the sidewalk round two sides, a drive), a gold mansion with two wings,
    // a pitched roof, a portico of white columns, dark windows; a lit pool out back and three trees. The case's lid is clear
    V.box(0, 0, 0, 30, 3, 30, 0x1f1f24); V.box(11, 1, 30 - 1, 19, 3, 30, K.gold, 2);                                  // the plinth, its plate
    V.box(1, 3, 1, 29, 4, 29, (x, y, z) => (z > 24 || x > 24 ? (z > 26 || x > 26 ? K.slate : K.white) : K.grass));     // the lot on its corner
    V.box(13, 3, 20, 17, 4, 27, K.pale);                                                                                // the drive
    const G = K.gold, GD = shade(K.gold, .82), WIN = 0x1b2a55;
    V.box(8, 4, 9, 22, 13, 19, G, 2); V.box(3, 4, 11, 8, 10, 18, G, 2); V.box(22, 4, 11, 27, 10, 18, G, 2);          // the house, its wings
    for (let k = 0; k < 4; k++) V.box(8 - k * .0 + k, 13 + k, 9 + k, 22 - k, 14 + k, 19 - k, k % 2 ? G : GD, 2);    // the roof, stepped to a ridge
    for (const x0 of [3, 22]) for (let k = 0; k < 3; k++) V.box(x0 + k, 10 + k, 11 + k, x0 + 5 - k, 11 + k, 18 - k, GD, 2);
    for (const x of [10, 12.5, 15, 17.5]) V.box(x, 4, 19, x + 1, 12, 20, K.white, 1);                                // the portico's columns
    V.box(9, 12, 19, 21, 13, 21, K.white, 1); for (let k = 0; k < 2; k++) V.box(10 + k * 2, 13, 19, 20 - k * 2, 14, 21, K.white, 1);   // its pediment
    for (const [x, y] of [[9, 6], [9, 9], [19, 6], [19, 9], [14, 9]]) V.box(x, y, 19, x + 2, y + 2, 20, WIN);      // windows, front
    for (const x of [4, 6, 23, 25]) V.box(x, 6, 18, x + 1, 8, 19, WIN);
    V.box(14, 4, 19, 16, 8, 20, 0x5a3418);                                                                              // the door
    V.box(10, 3, 3, 20, 4, 8, K.white); V.box(11, 3, 4, 19, 4, 7, K.cyan, LIT);                                       // the pool out back
    for (const [x, z, r] of [[4, 4, 2.4], [25, 5, 2.2], [4, 24, 2.2]]) { V.box(x, 4, z, x + 1, 6, z + 1, K.woodD); ball(V, x + .5, 8, z + .5, r, r * 1.1, r, K.leaf); }   // trees
    vitrine(V, 0, 0, 30, 30, 3, 22);
  } });

export const dirtyCop = T({ id: 'trophy-dirty-cop', name: 'Dirty-cop donut box', place: 'surface', foot: [3, 2], h: 0.3, tags: ['donuts', 'cash', 'dirty cop'],
  game: tro('rare', 'dirty-cop'),
  grain: 0.025, shaped: 'a box of donuts: each donut round with its hole, icing and sprinkles',
  grain: 0.025, shaped: 'a box of donuts: each donut round with its hole, icing and sprinkles',
  grain: 0.025, shaped: 'a box of donuts: each donut round with its hole, icing and sprinkles',
  grain: 0.025, shaped: 'a box of donuts: each donut round with its hole, icing and sprinkles',
  grain: 0.025, shaped: 'a box of donuts: each donut round with its hole, icing and sprinkles',
  build(V) {
    // THIRD PASS · the pink box open, its lid up behind with a gold star; four round donuts with holes, pink and chocolate icing,
    // sprinkles; and the cash where two donuts should be
    V.box(0, 0, 4, 30, 4, 20, K.pink); V.box(1, 1, 5, 29, 4, 19, -1); V.box(1, 0, 5, 29, 1, 19, K.white);       // the box, hollow, its white floor
    V.box(0, 0, 0, 30, 11, 4, K.pink); V.box(1, 1, 3, 29, 10, 4, K.white); V.box(0, 11, 0, 30, 12, 4, shade(K.pink, .85));   // the lid, standing open
    for (let k = 0; k < 7; k++) V.box(3 + k * 4, 9, 0 - 0, 5 + k * 4, 10, 1, k % 2 ? K.white : K.red);               // the lid's stripe
    for (const [x, y] of [[15, 6], [14, 5], [16, 5], [15, 4], [13, 6], [17, 6], [15, 7]]) V.set(x, y, 0 - 0, K.gold, 2);   // the gold star
    const ICE = [0x5a3418, K.white, K.yellow, 0x5a3418];
    [[6, 9], [14.5, 9], [6, 15.5], [14.5, 15.5]].forEach(([dx, dz], k) => {                                                     // four donuts
      for (let x = Math.floor(dx - 5); x < dx + 5; x++) for (let z = Math.floor(dz - 5); z < dz + 5; z++) for (let y = 1; y < 6; y++) {
        const d = Math.hypot(x + .5 - dx, z + .5 - dz), t = Math.hypot(d - 2.6, y + .5 - 2.7); if (t > 1.65) continue;
        const iced = (y >= 3 && d > 1.2 && d < 4) || (y === 2 && d > 3.6 && hash(x, z, k) > .5), sp = y >= 3 && iced && k !== 2 && hash(x, y, z + k * 9) > .86;
        V.set(x, y, z, sp ? pick([K.yellow, K.cyan, K.lime, K.white, K.red], (hash(z, x, y) * 5) | 0) : iced ? ICE[k] : (y < 3 ? 0xb07a3c : 0xd9a05b), iced ? 1 : 0); } });
    for (let k = 0; k < 2; k++) { V.box(20, 1 + k * 2, 7 + k, 28, 3 + k * 2, 13 + k, K.cash); V.box(23, 1 + k * 2, 7 + k, 24, 3 + k * 2, 13 + k, K.white); }   // two bricks of cash
  } });

export const bribed = T({ id: 'trophy-bribed-10', name: 'Greasy palm (10 bribes)', place: 'surface', foot: [2, 2], h: 0.6, tags: ['award', 'bribe', 'gold'],
  game: tro('rare', 'bribed-10'),
  grain: 0.025, shaped: 'a gold hand: the palm, four fingers and a thumb, a fat envelope in it',
  build(V) {
    // THIRD PASS · on a marble foot, a gold forearm and an open hand palm up, four fingers curling up behind and the thumb out to
    // the side; in the palm a fat envelope, cash showing, a red seal
    V.box(2, 0, 2, 18, 3, 18, (x, y, z) => (hash(x, y, z) > .9 ? 0xb9b9c0 : K.white), 1); V.box(2, 3, 2, 18, 4, 18, shade(K.white, .9), 1);   // marble foot
    V.box(6, 1, 18 - 1, 14, 3, 18, K.gold, 2);                                                                          // its plate
    lathe(V, 10, 10, 4, 12, prof([[4, 2.9], [6, 2.5], [12, 2.3]]), K.gold, 2); lathe(V, 10, 10, 4, 6, () => 3.3, shade(K.gold, .85), 2);   // the forearm, its cuff
    V.box(5, 12, 6, 15, 15, 15, K.gold, 2); V.box(6, 11, 7, 14, 12, 14, K.gold, 2);                                  // the palm (fingers to the back, −z)
    for (let k = 0; k < 4; k++) { const x0 = 5.2 + k * 2.5, len = [4, 5, 4.6, 3.6][k];                             // four fingers: back, then up
      V.box(x0, 13, 6 - len * .6, x0 + 2, 15, 6, K.gold, 2); V.box(x0, 15, 6 - len * .6, x0 + 2, 15 + len * .9, 6 - len * .6 + 2, K.gold, 2);
      V.box(x0, 14 + len * .9, 6 - len * .6, x0 + 2, 15 + len * .9, 6 - len * .6 + 1, shade(K.gold, .82), 2); }   // the nail edge
    line(V, 15, 13, 12, 18, 17, 13, K.gold, 2); line(V, 15, 14, 12, 18, 18, 13, K.gold, 2); line(V, 16, 13, 11, 18, 17, 12, K.gold, 2);   // the thumb, out and up
    V.box(6, 15, 8, 14, 18, 14, K.white, 1); V.box(7, 18, 9, 13, 20, 13, K.cash); V.box(9, 18, 9, 10, 20, 13, K.white);   // the envelope, the cash, its band
    V.box(9, 15, 14, 11, 17, 15, K.red, 1);                                                                             // the seal
  } });

export const burgled = T({ id: 'trophy-burgled-10', name: 'Gold crowbar (10 jobs)', place: 'wall', foot: [6, 2], h: 0.2, mount: 1.4, tags: ['award', 'crowbar', 'burglary'],
  game: tro('rare', 'burgled-10'),
  build(V) {
    for (const x of [6, 23]) { V.box(x, 3, 0, x + 1, 4, 4, K.chrome, 2); V.set(x, 4, 3, K.chrome, 2); }                                 // two hooks
    V.box(3, 4, 1, 28, 5, 3, K.gold, 2); V.box(1, 4, 1, 3, 7, 3, K.gold, 2); V.box(2, 7, 1, 4, 8, 3, K.gold, 2);                          // the bar, its hooked end
    V.box(27, 3, 1, 30, 4, 3, K.gold, 2); V.set(29, 2, 1, K.gold, 2);                                                                     // the claw
    for (let k = 0; k < 10; k++) { const x = 9 + k + (k > 4 ? 2 : 0); if (k === 4 || k === 9) line(V, x - 4, 7, 0, x, 9, 0, K.white); else V.box(x, 6, 0, x + 1, 10, 1, K.white); }   // ten tally marks scratched in the wall
  } });

export const TROPHIES = [firstHouse, firstDeal, didTime, snitch, gotRobbed, cleanStreak, addict, crackdown, inTheBank, kingpinCrown, goldGrill, halo, crewCrown, ghost, chrome, missingTexture, firstHeist, cornerMansion, dirtyCop, bribed, burgled];
for (const o of [crackdown, inTheBank]) o.tags.push('event');
