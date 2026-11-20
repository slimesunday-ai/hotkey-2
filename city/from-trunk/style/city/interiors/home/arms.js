// Home objects · the run's own arms (2026-11-17), in the run's own names (src/fight/data.mjs: six-shot, chopper, tire iron, brass
// knuckles, junk pistol; the box cutter is hustle.js), two more guns the owner named (the Doorman, a sawed-off double, and the Long-eye, a scoped rifle), and a
// box of rounds for each gun. Each lies on a surface, on its side: toon shapes of our own (OUTLINE §0.9), no real model, part, maker or
// mark. The guns, the tire iron and the knuckles are drawn at the fine grain (lib.js SMALL) from a side profile (`side`, below) and
// pictured from high up (`view: 'top'`); the older rounds boxes keep the 5 cm block (`plan`). Every piece has a fine pass (../fine.js).
import { def, K, pick, cyl, LIT, shade, mix, hash, frect, fdisc, fline, ftxt, hbox, fsurf, fcolour } from './lib.js';
import { g, flex } from './bits.js';

const GUN = 0x4a4d56, GUND = 0x2a2c32, WAL = 0x6e3e19, BRASS = 0xd9a83a, KRAFT = 0xc49a6c, OLIVE = 0x5a6a3a;
// a top-down plan: rows[z][x] → key[ch] = [colour, layer, thickness in cells] (thickness from the surface up)
function plan(V, rows, key) { rows.forEach((r, z) => { for (let x = 0; x < r.length; x++) { const k = key[r[x]]; if (k) V.box(x, 0, z, x + 1, k[2] ?? 1, z + 1, k[0], k[1] ?? 0); } }); }
const arm = (rarity, crib) => flex(rarity, crib, 'store');

// ── THE SECOND PASS (2026-11-17): every weapon is drawn at the FINE GRAIN (lib.js SMALL: `grain: 0.025`, half the block), so its SHAPE
// carries it: a round cylinder, a trigger guard you can see through, a socket's hex mouth. A side profile (`side`): one row a depth (z,
// the gun's top edge at the back), one character a 2.5 cm cell, and from the piece's key its colour, its material and the cells it fills
// from the surface up (it lies on its side: what rests on the table starts at 0). The fine pass then paints at 6 mm.
function side(V, rows, key) { rows.forEach((r, z) => { for (let x = 0; x < r.length; x++) { const k = key[r[x]]; if (k) V.box(x, k[2], z, x + 1, k[3], z + 1, k[0], k[1] ?? 0); } }); }
// round off a part lying along x (its rows z0..z1, its cells y0..y1, half-open): the four long edges cut, so a 4 × 4 reads as a drum
function roundX(V, x0, x1, z0, z1, y0, y1) { for (let x = x0; x < x1; x++) for (const [z, y] of [[z0, y0], [z0, y1 - 1], [z1 - 1, y0], [z1 - 1, y1 - 1]]) V.del(x, y, z); }
const HALF = 0.025;
// gun steel is gloss, not the metal layer (which renders near black in a room's light), lighter where a part must stand apart
const IRON = 0x47443f, CYL = 0x8f8d89, WALD = 0x4a2a12, TAPE = 0x9a9ca0, TAPED = 0x6e7076, ACT = 0xbdb8ae, RUST = 0xa8552a, PIPE = 0x858a90;

// the SIX-SHOT: a revolver. A fat fluted cylinder in its frame under the top strap, the barrel lined up with its top chamber, the ejector
// shroud under the barrel, the hammer cocked back, the trigger in a guard you can see through, a walnut grip curving back to its butt
export const sixShot = def({ id: 'six-shot', name: 'Six-shot', cat: 'security', place: 'surface', foot: [2, 1], h: 0.15, grain: HALF, view: 'top',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['gun', 'six-shot', 'fight'], variants: 2, vnames: ['blued', 'nickel'],
  game: arm('rare', 10),
  build(V, { variant = 0 } = {}) {
    const m = variant ? 0xc9ced6 : IRON, mc = variant ? 0xeef1f5 : CYL, l = variant ? 2 : 0, lc = variant ? 2 : 1;
    side(V, [
      '..h.TTTTTT.......f..',
      '..hhFCCCCCBBBBBBBBBB',
      '...FFCCCCCBBBBBBBBBB',
      '...FFCCCCCEEEEEE....',
      '...FFCCCCCF.........',
      '..GGFCCCCCF.........',
      '.GGGGFFFFFF.........',
      '.GGGG.t.g...........',
      '.GGG.ggg............',
      '.GG.................',
    ], { h: [m, l, 1, 3], T: [m, l, 1, 3], f: [m, l, 1, 3], F: [m, l, 1, 3], C: [mc, lc, 0, 4], B: [m, l, 1, 3], E: [m, l, 1, 3],
      G: [WAL, 0, 0, 3], t: [K.steelL, 2, 1, 3], g: [m, l, 1, 3] });
    roundX(V, 5, 10, 1, 6, 0, 4);
    V.set(0, 0, 8, WAL); V.set(0, 1, 8, WAL); V.set(0, 2, 8, WAL); V.box(1, 0, 9, 3, 3, 10, m, l);   // the grip's swell, the butt cap
  },
  // fine pass: the cylinder's flutes and its chambers' mouths, the bore, the rear sight's notch, the grip's checkering and screw, a light
  // along the barrel's top
  fine(P, { variant = 0, V }) {
    const lit = variant ? K.white : 0x8a8d96, dk = variant ? 0x8a929c : 0x3a3c42;
    for (const z of [2.25, 4.25]) frect(P, '+y', 5.25, z, 9.75, z + .5, dk);
    frect(P, '+z', 5.25, .75, 9.75, 1.25, dk); frect(P, '+z', 5.25, 2.75, 9.75, 3.25, dk);
    fdisc(P, '+x', 2, 2, .5, K.ink);
    frect(P, '+y', 10, 1.25, 20, 1.5, lit); frect(P, '+y', 4.25, .25, 5, .75, K.ink);
    fcolour(P, V, WAL, ['+y'], (x, y, z, f, i, j) => z >= 6 && z <= 8 && (i + j) % 2 ? WALD : null);
    frect(P, '+y', 2.25, 7.25, 2.75, 7.75, K.gold);
  } });

// the CHOPPER: a short automatic. A boxy receiver with its rear sight and a stub of a folded stock, the handguard wrapped in orange tape,
// a short barrel with a slotted muzzle, the pistol grip, the trigger in its guard, and the long magazine curving forward out of it
export const chopper = def({ id: 'chopper', name: 'Chopper', cat: 'security', place: 'surface', foot: [3, 1], h: 0.15, grain: HALF, view: 'top',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['gun', 'chopper', 'fight'], variants: 2, vnames: ['black, orange tape', 'olive, black tape'],
  game: arm('epic', 18),
  build(V, { variant = 0 } = {}) {
    const m = variant ? OLIVE : IRON, t = variant ? K.ink : K.orange, st = 0x6a6d74, mg = variant ? 0x2a2c26 : 0x2a2b30;
    side(V, [
      '.......rr..........f.........',
      '...kRRRRRRRRRRTTTTTTTBBBBBMMM',
      '...kRRRRRRRRRRTTTTTTTBBBBBMMM',
      '...kRRRRRRRRRRTTTTTTT........',
      '......GGG.t.gQQQ.............',
      '......GGG.gggQQQ.............',
      '.....GGG......QQQ............',
      '.....GGG......QQQ............',
      '....GGG........QQQ...........',
      '................QQQ..........',
    ], { r: [st, 0, 1, 2], f: [st, 0, 1, 2], k: [st, 0, 0, 3], R: [m, 0, 0, 3], T: [t, 0, 0, 3], B: [st, 1, 1, 2], M: [0x2a2c32, 0, 0, 3],
      G: [m, 0, 0, 3], t: [K.steelL, 2, 1, 2], g: [m, 0, 1, 2], Q: [mg, 0, 0, 3] });
    // the tape stands proud of the handguard, wrap by wrap
    for (let x = 14; x < 21; x++) if (x !== 17) for (let z = 1; z < 4; z++) V.set(x, 3, z, t);
  },
  // fine pass: the ejection port and the bolt's handle, the tape's edges, the muzzle's slots and bore, the magazine's ribs and base plate,
  // the grip's texture
  fine(P, { variant = 0, V }) {
    const t = variant ? K.ink : K.orange, m = variant ? OLIVE : IRON, mg = variant ? 0x2a2c26 : 0x2a2b30;
    frect(P, '+y', 6, 1.25, 11, 1.75, K.ink); frect(P, '+y', 9.5, 2, 10.25, 2.5, K.steelL);
    fcolour(P, V, t, ['+y', '+z'], (x, y, z, f, i, j) => i === 0 ? shade(t, .72) : null);
    for (const x of [26.25, 27.25]) frect(P, '+y', x, 1.25, x + .5, 2.75, K.ink);
    fdisc(P, '+x', 2, 1.5, .4, K.ink);
    fcolour(P, V, mg, ['+y'], (x, y, z, f, i, j) => j === 0 && z < 9 ? 0x50535c : z === 9 ? K.steelL : null);
    fcolour(P, V, m, ['+y'], (x, y, z, f, i, j) => z >= 4 && (i + j) % 2 ? K.ink : null);
  } });

// the SAWED-OFF DOUBLE (a working name: the page offers two): two short fat barrels (drawn one over the other, so both show as it lies on
// its side, with both bores at the muzzle), the bright action with its round hinge pin and the top lever, two triggers in one guard, a
// wooden fore-end, the stock sawn down to a pistol grip, its butt wrapped in tape
export const doubleBarrel = def({ id: 'double-barrel', name: 'Doorman', cat: 'security', place: 'surface', foot: [3, 1], h: 0.15, grain: HALF, view: 'top',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['gun', 'shotgun', 'fight'], variants: 2, vnames: ['blued and walnut', 'black and taped'],
  game: arm('rare', 12),
  build(V, { variant = 0 } = {}) {
    const b = variant ? 0x2a2b30 : IRON, act = variant ? 0x55585f : ACT, w = variant ? 0x4a3020 : K.wood, tp = variant ? K.ink : TAPE;
    side(V, [
      '..........LL................',
      '.........AAAAUUUUUUUUUUUUU..',
      '.........AAAAUUUUUUUUUUUUU..',
      '.........AAAAUUUUUUUUUUUUU..',
      '.......wwAAAAuuuuuuuuuuuuu..',
      '......wwwAAAAuuuuuuuuuuuuu..',
      '.....wwwwt.t.FFFFFFFF.......',
      '....wwwwgggg................',
      '..ttttw.....................',
      '..tttt......................',
    ], { L: [act, 1, 1, 3], A: [act, 1, 0, 4], U: [b, 0, 0, 3], u: [b, 0, 0, 3], F: [w, 0, 0, 3], w: [w, 0, 0, 3], t: [tp, 0, 0, 3], g: [act, 1, 1, 3] });
    roundX(V, 13, 26, 1, 4, 0, 3); roundX(V, 13, 26, 4, 6, 0, 3);
    V.set(10, 1, 6, K.steelL, 2); V.set(11, 1, 6, -1);   // (two triggers)
  },
  // fine pass: the two barrels told apart (a dark seam between them, a light along each), both bores at the muzzle, the action's scroll
  // and its round hinge pin, the fore-end's checkering, the tape's wraps
  fine(P, { variant = 0, V }) {
    frect(P, '+y', 13, 3.875, 26, 4.125, K.ink);
    frect(P, '+y', 13, 1.25, 26, 1.5, variant ? 0x50535c : 0x76797f); frect(P, '+y', 13, 4.25, 26, 4.5, variant ? 0x50535c : 0x76797f);
    fsurf(P, V, '+x', 25, 0, 1, 26, 3, 6, (x, y, z, i, j) => { const yy = y + (j + .5) / 4, zz = z + (i + .5) / 4; const d = Math.min(Math.hypot(yy - 1.5, zz - 2.5), Math.hypot(yy - 1.5, zz - 5)); return d < .8 ? K.ink : null; });
    fdisc(P, '+y', 12.5, 5, .55, d => d < .25 ? K.steelL : K.steelD);
    if (!variant) fcolour(P, V, ACT, ['+y'], (x, y, z, f, i, j) => (x * 4 + i + z * 4 + j) % 5 === 0 ? 0x8a8680 : null);
    fcolour(P, V, variant ? 0x4a3020 : K.wood, ['+y'], (x, y, z, f, i, j) => z === 6 && x >= 13 && (i + j) % 2 ? K.woodD : null);
    fcolour(P, V, variant ? K.ink : TAPE, ['+y'], (x, y, z, f, i, j) => (x * 4 + i) % 4 === 0 ? (variant ? 0x3a3a40 : TAPED) : null);
  } });

// the SCOPED RIFLE (a working name: the page offers two): a long walnut stock with a black butt pad and a straight comb, a pistol-grip
// wrist, the receiver with the bolt's knob standing up off it, a long thin barrel over a wooden fore-end, a scope on two rings with a fat
// lens bell at the front
export const longRifle = def({ id: 'long-rifle', name: 'Long-eye', cat: 'security', place: 'surface', foot: [4, 1], h: 0.15, grain: HALF, view: 'top',
  tiers: ['apartment', 'house', 'penthouse'], tags: ['gun', 'rifle', 'fight'], variants: 2, vnames: ['walnut', 'black'],
  game: arm('epic', 16),
  build(V, { variant = 0 } = {}) {
    const w = variant ? 0x3a3c42 : K.wood, st = IRON, sc = 0x26272c;
    side(V, [
      '...........eeSSSSSSSSSOOO...............',
      '...........eeSSSSSSSSSOOO...............',
      '..............r....r..OOO...............',
      'pwwwwwwwwwwwRRRRRRRRRBBBBBBBBBBBBBBBBBBB',
      'pwwwwwwwwwwwwRRRRRRRRFFFFFFFFFFFFFFF....',
      'pwwwwwwwwwwwwwgtg....FFFFFFFFFFFFF......',
      'pwwwwwwwww..wwggg.......................',
      'pwwwwwwww...ww..........................',
      'pwwwwww.................................',
      'pwwww...................................',
    ], { e: [sc, 0, 0, 3], S: [sc, 1, 0, 3], O: [sc, 0, 0, 3], r: [K.steelD, 0, 1, 2], R: [st, 0, 0, 3], B: [st, 1, 1, 2], F: [w, 0, 0, 3],
      w: [w, 0, 0, 3], p: [K.ink, 0, 0, 3], g: [st, 0, 1, 2], t: [K.steelL, 2, 1, 2] });
    roundX(V, 13, 22, 0, 2, 0, 3);
    // the bolt: a short arm standing up off the receiver's side, a ball on its end
    V.box(18, 3, 4, 19, 5, 5, K.steelL, 2); V.box(18, 5, 4, 20, 6, 6, K.steelL, 2);
  },
  // fine pass: the scope's front glass (a glint), its turret, the stock's grain, the grip's checkering, a light along the barrel, the bore
  fine(P, { variant = 0, V }) {
    fsurf(P, V, '+x', 24, 0, 0, 25, 3, 3, (x, y, z, i, j) => (i + j * 2) % 5 === 0 ? 0x8ab8ff : 0x1a2c5a);
    frect(P, '+y', 17, .25, 18, 1.75, 0x4a4d56);
    if (!variant) fcolour(P, V, K.wood, ['+y'], (x, y, z, f, i, j) => (x * 4 + i + z * 5) % 11 === 0 ? K.woodD : null);
    frect(P, '+y', 12, 5, 14, 7, (qa, qb) => (qa + qb) % 2 ? (variant ? K.ink : K.woodD) : null);
    frect(P, '+y', 21, 3.25, 40, 3.5, 0x8a8d96);
    fdisc(P, '+x', 3.5, 1.5, .3, K.ink);
  } });

// the TIRE IRON: an L. A long bar, bent at one end into a short arm with a fat hex socket on it, its mouth to the front; the other end
// hammered flat into a pry blade with a bright worn edge
export const tireIron = def({ id: 'tire-iron', name: 'Tire iron', cat: 'security', place: 'surface', foot: [3, 1], h: 0.1, grain: HALF, view: 'top',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['tool', 'tire iron', 'fight'], variants: 1, vnames: ['black steel'],
  game: arm('common', 3),
  build(V) {
    const bar = IRON;
    side(V, [
      '..........................ppp.',
      '..aa======================pppp',
      '..aa======================pppp',
      '..aa..........................',
      '..aa..........................',
      '..aa..........................',
      'sssssss.......................',
      'sssssss.......................',
      'sssssss.......................',
      'sssssss.......................',
    ], { a: [bar, 0, 0, 2], '=': [bar, 0, 0, 2], p: [bar, 0, 0, 1], s: [0x7a7d86, 1, 0, 4] });
    // the socket: a hex, its corners cut along z
    for (let z = 6; z < 10; z++) { V.del(0, 3, z); V.del(6, 3, z); V.del(0, 0, z); V.del(6, 0, z); }
  },
  // fine pass: the socket's hex mouth (dark, a bright ring), a few rust blooms down the bar, the pry blade's worn bright edge and its notch
  fine(P, { V }) {
    fsurf(P, V, '+z', 0, 0, 9, 7, 4, 10, (x, y, z, i, j) => { const u = (x * 4 + i + .5) / 4 - 3.5, v = (y * 4 + j + .5) / 4 - 2; const d = Math.max(Math.abs(u) * .87 + Math.abs(v) * .5, Math.abs(v)); return d < 1.1 ? K.ink : d < 1.5 ? K.chrome : null; });
    for (const [x, z] of [[8, 1.25], [15, 1.5], [21, 1.25]]) frect(P, '+y', x, z, x + 1.25, z + .5, RUST);
    frect(P, '+y', 29.5, 1, 30, 3, K.chrome); frect(P, '+y', 29.5, 1.75, 30, 2.25, K.ink);
  } });

// BRASS KNUCKLES: four finger rings you can see through, the bar under them, the palm rest curving below on its two struts
export const brassKnuckles = def({ id: 'brass-knuckles', name: 'Brass knuckles', cat: 'security', place: 'surface', foot: [2, 1], h: 0.1, grain: HALF, view: 'top',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['knuckles', 'brass', 'fight'], variants: 2, vnames: ['brass', 'black'],
  game: arm('common', 4),
  build(V, { variant = 0 } = {}) {
    const m = variant ? 0x2e3036 : BRASS;
    side(V, [
      '.RRR..RRR..RRR..RRR.',
      'R...RR...RR...RR...R',
      'R...RR...RR...RR...R',
      'R...RR...RR...RR...R',
      '.RRRRRRRRRRRRRRRRRR.',
      '..ss............ss..',
      '..PPPPPPPPPPPPPPPP..',
      '...PPPPPPPPPPPPPP...',
      '.....PPPPPPPPPP.....',
    ], { R: [m, 1, 0, 2], s: [m, 1, 0, 2], P: [m, 1, 0, 3] });
  },
  // fine pass: a light along the rings' tops and the palm rest, the rings' inner edges dark
  fine(P, { variant = 0 }) {
    const hi = variant ? 0x6a6e78 : 0xfff0b0, lo = variant ? K.ink : shade(BRASS, .6);
    for (let k = 0; k < 4; k++) frect(P, '+y', 5 * k + 1, .25, 5 * k + 4, .5, hi);
    frect(P, '+y', 3, 6.25, 17, 6.5, hi);
    for (let k = 0; k < 4; k++) for (const [a, b, c, d] of [[1, .75, 4, 1], [1, 4, 4, 4.25], [.75, 1, 1, 4], [4, 1, 4.25, 4]]) frect(P, '+y', 5 * k + a, b, 5 * k + c, d, lo);
    frect(P, '+y', 5, 8.5, 15, 8.75, lo);
  } });

// the JUNK PISTOL: a home-made pipe gun. A length of rusting pipe with a black cap screwed on its back end and a nail through the cap for
// a striker, a red rubber strap pulling the nail, the pipe bound to a sawn block grip with black tape, a bent nail for a trigger and
// nothing round it
export const junkPistol = def({ id: 'junk-pistol', name: 'Junk pistol', cat: 'security', place: 'surface', foot: [2, 1], h: 0.15, grain: HALF, view: 'top',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['gun', 'junk', 'fight'], variants: 1, vnames: ['pipe and tape'],
  game: arm('common', 5),
  build(V) {
    side(V, [
      '..cc................',
      'n-ccPPPPPPPPPPPPPPP.',
      'n-ccPPPPPPPPPPPPPPP.',
      '..ccPPPPPPPPPPPPPPP.',
      '..ccWWWWW..t........',
      '...WWWWW...t........',
      '...WWWW.............',
      '..WWWW..............',
      '..WWWW..............',
      '.WWWW...............',
    ], { c: [0x2e2f33, 0, 0, 4], P: [PIPE, 0, 0, 3], n: [0x6a6e76, 1, 1, 2], '-': [0x8a8e96, 1, 1, 2], W: [K.woodL, 0, 0, 3], t: [0x9aa0aa, 1, 1, 2] });
    roundX(V, 4, 19, 1, 4, 0, 3); roundX(V, 2, 4, 0, 5, 0, 4);
    // black tape, one band wrapped round the pipe and the block (a cell proud)
    for (let z = 0; z < 6; z++) for (let y = 0; y < 4; y++) for (const x of [6, 7]) if (!V.has(x, y, z) && (V.has(x, y, z + 1) || V.has(x, y, z - 1) || V.has(x, y - 1, z))) V.set(x, y, z, 0x1e1e22);
  },
  // fine pass: rust blooms on the pipe, the bore, the cap's threads, the nail's head, the red strap from the nail to a screw in the grip,
  // the tape's creases, the block's sawn grain
  fine(P, { V }) {
    for (const [x, z, w] of [[10, 1.25, 2.5], [15, 2.25, 1.75]]) frect(P, '+y', x, z, x + w, z + 1, RUST);
    fdisc(P, '+x', 2.5, 1.5, .55, K.ink);
    fcolour(P, V, 0x2e2f33, ['+y'], (x, y, z, f, i, j) => j % 2 ? 0x55575e : null);
    frect(P, '+y', 0, 1, .5, 3, 0xc9ced6);
    frect(P, '+y', 0, 2, 1, 2.25, K.red); fline(P, '+y', 2.5, 2.25, 3.5, 6.25, K.red); fline(P, '+y', 2.75, 2.25, 3.75, 6.25, K.red);
    frect(P, '+y', 3.25, 6.25, 3.75, 6.75, K.chrome);
    fcolour(P, V, 0x1e1e22, ['+y'], (x, y, z, f, i, j) => (i + z * 2) % 4 === 0 ? 0x44444a : null);
    fcolour(P, V, K.woodL, ['+y'], (x, y, z, f, i, j) => j === 1 && (x + z) % 2 ? shade(K.woodL, .82) : null);
  } });

// ── a box of rounds for each gun: the six-shot's in a card box (the lid stood up behind it), the chopper's in an olive can, the junk
// pistol's loose in a coffee tin; their heads painted in rows
const heads = (P, x0, z0, x1, z1, mixd) => frect(P, '+y', x0, z0, x1, z1, (qa, qb) => { const u = qa % 2, v = qb % 2; if (u || v) return 0x3a2a18; return mixd && hash(qa, qb, 3) > .6 ? 0xb87a3a : (hash(qa, qb, 5) > .5 ? BRASS : 0xe8c060); });
export const sixShotRounds = def({ id: 'six-shot-rounds', name: 'Six-shot rounds', cat: 'security', place: 'surface', foot: [1, 1], h: 0.15,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['rounds', 'six-shot', 'fight'], variants: 1, vnames: ['card box'],
  game: arm('common', 2),
  build(V) { V.box(0, 0, 1, 5, 2, 5, KRAFT); V.box(0, 0, 0, 5, 3, 1, KRAFT); },
  fine(P) { heads(P, .5, 1.5, 4.5, 4.5); frect(P, '+z', 0, .5, 5, 1, K.red); frect(P, '+z', .5, 1.25, 3, 1.5, K.ink); } });
export const chopperRounds = def({ id: 'chopper-rounds', name: 'Chopper rounds', cat: 'security', place: 'surface', foot: [2, 1], h: 0.25,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['rounds', 'chopper', 'fight'], variants: 1, vnames: ['olive can'],
  game: arm('rare', 4),
  build(V) { V.box(0, 0, 0, 9, 3, 4, OLIVE); V.box(0, 3, 0, 9, 4, 4, shade(OLIVE, 1.1)); V.box(8, 1, 0, 9, 3, 4, shade(OLIVE, .8)); },
  // fine pass: the stencilled word on its side, the lid's latch and the folded carry handle (fine voxels), worn paint on the corners
  fine(P) {
    ftxt(P, '+z', 'AMMO', 1, 2.75, K.yellow);
    hbox(P, 3, 4, 1.5, 6, 4.5, 2.5, 0x2a2c32); hbox(P, 7, 2, 4, 7.5, 3.5, 4.5, 0x2a2c32);
    for (const [x, y] of [[0, 3], [8.5, 0]]) frect(P, '+z', x, y, x + .5, y + 1, 0x8a8e7a);
  } });
export const junkRounds = def({ id: 'junk-rounds', name: 'Junk pistol rounds', cat: 'security', place: 'surface', foot: [1, 1], h: 0.15,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['rounds', 'junk', 'fight'], variants: 1, vnames: ['coffee tin'],
  game: arm('common', 1),
  build(V) { cyl(V, 2.5, 2.5, 2.3, 0, 3, K.red, 1); cyl(V, 2.5, 2.5, 1.7, 2, 3, -1); cyl(V, 2.5, 2.5, 1.7, 1, 2, 0x3a2a18); },
  // fine pass: mixed heads in the tin, the tin's rim and its plain label band
  fine(P, { V }) {
    fdisc(P, '+y', 2.5, 2.5, 1.45, (d, th, qa, qb) => qa % 2 || qb % 2 ? 0x3a2a18 : hash(qa, qb, 3) > .6 ? 0xb87a3a : BRASS);
    fcolour(P, V, K.red, ['+z', '+x', '-x'], (x, y, z, f, i, j) => y === 1 ? K.white : null);
  } });

// the shotgun's shells in their card box, a few standing up out of it and one on its side in front; the rifle's rounds in a small card
// tray, their copper noses in rows, two lying out
export const doubleBarrelShells = def({ id: 'double-barrel-shells', name: 'Doorman shells', cat: 'security', place: 'surface', foot: [1, 1], h: 0.15, grain: HALF,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['rounds', 'shotgun', 'fight'], variants: 1, vnames: ['card box'],
  game: arm('common', 2),
  build(V) {
    V.box(1, 0, 2, 9, 3, 8, 0x1f6a3a); V.box(2, 1, 3, 8, 3, 7, -1); V.box(2, 0, 3, 8, 1, 7, 0x154a28);
    V.box(1, 3, 1, 9, 5, 2, 0x1f6a3a);
    for (const [x, z, h] of [[2, 3, 5], [3, 3, 6], [4, 3, 4], [5, 3, 5], [6, 3, 4], [7, 3, 5], [2, 5, 4], [3, 5, 4], [4, 5, 5], [5, 5, 4], [6, 5, 4], [7, 5, 4], [2, 4, 4], [3, 4, 4], [4, 4, 4], [5, 4, 6], [6, 4, 4], [7, 4, 4], [2, 6, 3], [3, 6, 3], [4, 6, 3], [5, 6, 3], [6, 6, 3], [7, 6, 3]])
      V.box(x, 1, z, x + 1, h, z + 1, (xx, y) => y === h - 1 ? 0xa81c22 : K.red, 1);
    V.box(2, 0, 8, 6, 1, 9, K.red, 1); V.box(6, 0, 8, 7, 1, 9, BRASS, 1);
  },
  // fine pass: the box's label (a white band, a pellet spray drawn on it), the shells' crimped tops, the lying one's brass head and primer
  fine(P, { V }) {
    frect(P, '+z', 1, .75, 9, 2.25, K.white); for (let k = 0; k < 9; k++) frect(P, '+z', 2 + (k % 3) * .5 + (k >> 1) * .55, 1 + (k % 3) * .4, 2.25 + (k % 3) * .5 + (k >> 1) * .55, 1.25 + (k % 3) * .4, K.ink);
    fcolour(P, V, 0xa81c22, ['+y'], (x, y, z, f, i, j) => (i === 0 || j === 0) ? 0x6a1014 : (i === 2 && j === 2) ? 0x6a1014 : null);
    fdisc(P, '+x', 8.5, .5, .25, 0xb88a2a);
  } });
export const longRifleRounds = def({ id: 'long-rifle-rounds', name: 'Long-eye rounds', cat: 'security', place: 'surface', foot: [1, 1], h: 0.15, grain: HALF,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['rounds', 'rifle', 'fight'], variants: 1, vnames: ['card tray'],
  game: arm('rare', 3),
  build(V) {
    V.box(1, 0, 1, 9, 2, 7, 0x23306e); V.box(2, 1, 2, 8, 2, 6, -1);
    for (let x = 2; x < 8; x++) for (let z = 2; z < 6; z++) if ((x + z) % 2 === 0) { V.box(x, 1, z, x + 1, 4, z + 1, BRASS, 1); V.set(x, 4, z, 0xc8743a, 1); }
    V.box(2, 0, 8, 6, 1, 9, BRASS, 1); V.set(6, 0, 8, 0xc8743a, 1); V.box(4, 0, 9, 8, 1, 10, BRASS, 1); V.set(8, 0, 9, 0xc8743a, 1);
  },
  // fine pass: the tray's yellow stripe, the copper noses rounded off, the cases' necks
  fine(P, { V }) {
    frect(P, '+z', 1, .75, 9, 1.25, K.yellow);
    fcolour(P, V, 0xc8743a, ['+y'], (x, y, z, f, i, j) => (i === 0 || i === 3) && (j === 0 || j === 3) ? BRASS : (i === 1 || i === 2) && (j === 1 || j === 2) ? 0xe89a5a : null);
    fcolour(P, V, BRASS, ['+z', '+x'], (x, y, z, f, i, j) => y === 3 && j === 3 ? 0xb88a2a : null);
  } });

export const ARMS = [sixShot, chopper, doubleBarrel, longRifle, junkPistol, tireIron, brassKnuckles, sixShotRounds, chopperRounds, junkRounds, doubleBarrelShells, longRifleRounds];
