// Home objects · the pieces of a home that crafting names (2026-11-19, THE RUN's approved crafting plan and its addition: "we also
// need the extra game assets for crafting"). The small things you buy, cook with and pack are the game's own props (hotkey-2
// demo/stage/props/craft.js); these are the ones that stand in a home or are fixed to its door:
//   tool-bench   THE BENCH, carried over from the crafter game (~/Desktop/ai-city/game src/base/station.js benchCells, tiers 1 and 2:
//                the same blocks, drawn by the same code, without the tier's number plate: "Workbench 1/2/3" are that game's names
//                and stay out). Two looks: knocked together from what was lying around (a yard sale's), and the steel bench off a
//                closing garage. The trailer's one floor spot (the plan: the stove or the bench).
//   door-can     THE CAN OVER THE DOOR, loaded: the raid builder's pepper fogger (traps.js, its own build) with its can in the colour
//                of the bag loaded into it (a family's: downers blue, uppers red, trips violet, mutagens green, the grail black) and a
//                strip of tape across it where the label was. The fogger as bought is unchanged.
//   door-gun     THE KNOCK-KNOCK: a gun clamped to a board inside the door, its muzzle at the doorway, a cord from its trigger to the
//                door's edge. The gun is the run's own (arms.js: the six-shot, the junk pistol, the Doorman), drawn by its own build
//                turned onto the wall. A toon prop: a board, two clamps and a cord, no working parts shown.
//   porch-lamp   A PORCH LAMP over the door outside (the raid's night look lights one, and the kit had none): a jelly-jar lamp in a
//                wire cage on a wall plate, lit at night, two moths.
// Nothing here is a rule: each `game` block is a proposal (FORMAT.md), with no buff.
import { def, K, pick, cyl, cylZ, glow, frect, fdisc, hbox } from './lib.js';
import { g } from './bits.js';
import { pepperFogger } from './traps.js';
import { sixShot, junkPistol, doubleBarrel } from './arms.js';

// ── THE BENCH: the crafter game's Workbench, tiers 1 and 2 (game/src/base/station.js), carried over as it is drawn there: its palette, its
// helpers and its two benches, in the same cell lists (x across −17…16, y up, z front + to back −9; origin at the floor's centre), written
// into the kit's Vol at the same offset the crafter's catalogue uses (17, 9). Two changes: no tier plate (the crafter's "1"/"2" sign; its
// names stay out), and the metal layer drawn as gloss (the kit's rooms render the metal layer near black: arms.js's note), so the steel
// tools read as steel. The vise is set back one cell, so its T-handle is inside the footprint (the crafter clips it).
const W = {
  timber: 0x96683c, timberD: 0x74502e, endg: 0xb8875a, pine: 0xc79c62, pineD: 0xa47c48, woodD: 0x7e5432, woodL: 0xc8a070, scar: 0x5a3a22, burn: 0x3e2c20,
  board: [0xa98a62, 0xb39470, 0x9c8058], boardD: 0x7e6648,
  block: 0xc29a62, blockL: 0xd0a872, blockD: 0xa88250, oil: 0x8a6a44,
  peg: 0x9a7350, pegH: 0x6e5236, pegD: 0x8c6846,
  steel: 0x8a8f96, steelD: 0x55595f, steelL: 0xc9ced6, blade: 0x4a4e55, iron: 0x6a6e74, ironL: 0x7e838a, galv: 0xa9aeb6, galvD: 0x8f949b, rust: 0x8a4a2a, rustD: 0x6a3820,
  frame: 0x6e776f, frameD: 0x58605a,
  vise: 0x4a6278, viseD: 0x3a4e60,
  shade: 0x566a4f, shadeD: 0x43543e, shadeI: 0xe8e2d0, bulb: 0xfff2b0,
  chest: 0x7e3a33, chestD: 0x622c28, ink: 0x26272b,
  tape: 0xe0b02a, bucket: 0xd8702c, bucketD: 0xa85622, red: 0xb8322c, can: 0xa9aeb4, label: 0xc8a84a, labelD: 0xa8402a, rope: 0xc8b48a, ropeD: 0xa08c64,
  wheel: 0x8e897c, wheelD: 0x6e6a60, cream: 0xefe6d0 };
const MET = 2, LIT = 3, GLOSS = 1;
const h3 = (x, y, z) => ((((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0) % 1000) / 1000;
function cells() { const out = []; const f = { out,
  box(x0, y0, z0, x1, y1, z1, c, l = 0) { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) out.push([x, y, z, typeof c === 'function' ? c(x, y, z) : c, l]); return f; },
  set(x, y, z, c, l = 0) { out.push([x, y, z, c, l]); return f; } }; return f; }
// (the metal layer as gloss; a cell with no colour, `undefined`, is a hole the crafter leaves: the plank missing from the shelf)
function intoVol(V, list, ox, oz) { for (const [x, y, z, c, l] of list) if (c !== -1 && c !== undefined) V.set(x + ox, y, z + oz, c, l === MET ? GLOSS : l || 0); return V; }
const pegboard = (f, x0, y0, x1, y1) => f.box(x0, y0, -9, x1, y1, -8, (x, y) => ((x + 40) % 3 === 1 && y % 3 === 1) ? W.pegH : h3(x, y, 9) < .05 ? W.pegD : W.peg);
function lamp(f, x, y0) {
  f.box(x, y0, -9, x + 1, y0 + 6, -8, W.steelD, MET).box(x - 4, y0 + 5, -8, x + 1, y0 + 6, -7, W.steelD, MET).box(x - 4, y0 + 5, -8, x - 3, y0 + 6, 2, W.steelD, MET).box(x - 4, y0 + 3, 1, x - 3, y0 + 5, 2, W.steelD, MET);
  for (let y = y0 - 1; y < y0 + 3; y++) { const r = 1.2 + (y0 + 2 - y) * .75; for (let xx = x - 9; xx < x + 1; xx++) for (let z = -3; z < 6; z++) { const d = Math.hypot(xx + .5 - (x - 3.5), z + .5 - 1.5); if (d <= r && (d > r - 1 || y === y0 + 2)) f.set(xx, y, z, d > r - 1 ? (y === y0 - 1 ? W.shadeD : W.shade) : W.shadeI, GLOSS); } }
  f.box(x - 4, y0, 1, x - 3, y0 + 2, 2, W.bulb, LIT); }
function vise(f, y0, painted) { const P = painted ? W.vise : 0x5c6168, PD = painted ? W.viseD : 0x464a50, worn = (x, y, z, c) => h3(x, y, z) < .22 ? W.iron : c;
  f.box(9, y0, 2, 15, y0 + 1, 8, W.steelD, MET);
  f.box(10, y0 + 1, 2, 14, y0 + 4, 7, (x, y, z) => worn(x, y, z, y === y0 + 1 ? PD : P), GLOSS);
  f.box(10, y0 + 4, 2, 14, y0 + 5, 4, (x, y, z) => z === 2 ? W.steelL : W.iron, MET);
  f.box(10, y0 + 4, 5, 14, y0 + 6, 6, (x, y, z) => worn(x, y, z, P), GLOSS).box(10, y0 + 5, 6, 14, y0 + 6, 7, W.steelL, MET);
  f.box(10, y0 + 5, 8, 14, y0 + 6, 9, W.steelL, MET).box(10, y0 + 3, 9, 14, y0 + 6, 10, (x, y, z) => worn(x, y, z, P), GLOSS);
  f.box(11, y0 + 2, 7, 13, y0 + 3, 10, W.steel, MET).box(11, y0 + 2, 10, 13, y0 + 3, 12, W.steelL, MET);
  f.box(8, y0 + 2, 11, 16, y0 + 3, 12, W.steelL, MET).set(8, y0 + 2, 12, W.steelD, MET).set(15, y0 + 2, 12, W.steelD, MET); }
function tin(f, x0, y0, z0, h, top = W.steelL) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + 3; x++) for (let z = z0; z < z0 + 3; z++) if (Math.hypot(x + .5 - x0 - 1.5, z + .5 - z0 - 1.5) <= 1.6)
  f.set(x, y, z, y === y0 + h - 1 ? top : y === y0 + 1 ? (z === z0 + 2 ? W.labelD : W.label) : W.can, y === y0 + 1 ? GLOSS : MET); }
// (the vise one cell back: its cells moved −1 in z)
const viseBack = (f, y0, painted) => { const v = cells(); vise(v, y0, painted); for (const [x, y, z, c, l] of v.out) f.set(x, y, z - 1, c, l); };
// TIER 1 · knocked together from what was lying around (station.js bench1, less its plate)
function bench1(f) {
  for (const x of [-16, 14]) for (const z of [-8, 6]) f.box(x, 0, z, x + 2, 16, z + 2, (xx, y, zz) => y === 0 || y === 15 ? W.endg : h3(xx, y, zz) < .07 ? W.timberD : W.timber);
  for (const x of [-17, 16]) for (let z = -8; z < 8; z++) { const y = Math.round(3 + (7 - z) * 10 / 15); f.box(x, y, z, x + 1, y + 2, z + 1, (xx, yy, zz) => (zz === -6 || zz === 6) && yy === y ? W.steelL : W.board[2]); }
  for (const z of [-8, 7]) f.box(-14, 13, z, 14, 15, z + 1, (x, y) => h3(x, y, z) < .06 ? W.timberD : W.timber);
  for (const x of [-16, 14]) f.box(x, 2, -6, x + 2, 3, 6, W.timberD);
  f.box(-16, 3, -7, 16, 4, 7, (x, y, z) => { const k = Math.floor((z + 7) / 3); if (k === 2) return undefined; return z % 3 === 1 ? W.boardD : W.board[k % 3]; });
  f.box(-17, 16, -9, 17, 17, 9, (x, y, z) => { const k = z < -3 ? 0 : z < 3 ? 1 : 2, r = h3(x, 4, z);
    if (x === -17 || x === 16) return undefined; if (x === -16 || x === 15) return W.galv;
    if (z === -3 || z === 3) return W.boardD; if ((x === -15 || x === 14) && (z === -7 || z === 7)) return W.steelL;
    return r < .03 ? W.scar : r < .04 ? W.burn : (x * 7 + z * 3) % 13 === 0 ? W.boardD : W.board[k]; });
  for (const x of [-16, 15]) for (let z = -9; z < 9; z++) f.set(x, 16, z, W.galv, MET);
  f.box(-16, 15, 8, 16, 16, 9, W.timberD);
  pegboard(f, -16, 17, 16, 38); f.box(-17, 17, -9, -16, 39, -7, W.pine).box(16, 17, -9, 17, 39, -7, W.pine).box(-17, 38, -9, 17, 39, -7, W.pine);
  for (let x = -14; x < -6; x++) { const top = 27 + Math.round((x + 14) * 3 / 8); f.box(x, 24, -8, x + 1, top, -7, (xx, y) => y === 24 ? ((xx & 1) ? W.steelD : W.steel) : W.steel, MET); }
  f.box(-6, 25, -8, -3, 31, -7, (x, y) => (x === -5 && y >= 27 && y <= 29) ? undefined : W.woodD);
  f.box(0, 21, -8, 1, 31, -7, (x, y) => y < 24 ? W.ink : W.woodL).box(-2, 31, -8, 3, 33, -7, (x, y) => x === -2 && y === 31 ? undefined : W.steelD, MET);
  f.box(5, 22, -8, 6, 30, -7, W.steel, MET).box(4, 30, -8, 7, 32, -7, W.steel, MET).set(5, 31, -8, W.pegH).set(4, 31, -7, W.steelL, MET);
  f.box(9, 22, -8, 15, 23, -7, W.steelL, MET).box(9, 23, -8, 10, 31, -7, W.steelL, MET).box(10, 23, -8, 11, 24, -7, W.ink);
  f.box(12, 26, -8, 15, 29, -7, (x, y) => y === 26 ? W.ink : W.tape, GLOSS).set(12, 27, -7, W.steelL, MET);
  for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2, x = Math.round(12.5 + Math.cos(t) * 2.4), y = Math.round(34 + Math.sin(t) * 2.4); f.set(x, y, -8, a % 3 ? W.rope : W.ropeD); }
  f.box(12, 36, -8, 13, 37, -7, W.steelD, MET);
  viseBack(f, 17, false);
  tin(f, -14, 17, -7, 4); for (const [x, z] of [[-13, -6], [-12, -5]]) f.set(x, 21, z, W.steelD, MET);
  f.box(-5, 17, -3, 2, 19, 0, (x, y, z) => x === -5 || x === 1 ? W.endg : W.pine).box(-9, 17, 2, -4, 18, 4, W.pineD).box(3, 17, -6, 4, 18, -1, (x, y, z) => z === -1 ? W.ink : W.tape, GLOSS);
  for (const [x, z] of [[-2, 3], [-1, 4], [0, 3], [5, 1]]) f.set(x, 17, z, W.steelL, MET);
  for (let y = 4; y < 10; y++) for (let x = -14; x < -8; x++) for (let z = -5; z < 1; z++) { const d = Math.hypot(x + .5 + 11, z + .5 + 2), r = 2.6 + (y - 4) * .07; if (d > r) continue;
    if (d < r - 1 && y > 4) { if (y === 9) f.set(x, y - 1, z, h3(x, y, z) < .5 ? W.rust : W.steel, h3(x, y, z) < .5 ? 0 : MET); continue; } f.set(x, y, z, y === 9 ? W.bucketD : W.bucket, GLOSS); }
  f.box(1, 4, -4, 13, 5, -1, W.board[1]).box(2, 5, -5, 12, 6, -2, W.pine).box(3, 6, -4, 11, 7, -2, W.board[2]); }
// TIER 2 · a steel bench off a closing garage (station.js bench2, less its plate)
function bench2(f) { const worn = (x, y, z, c) => c;
  for (const x of [-16, 14]) for (const z of [-8, 6]) { f.box(x, 0, z, x + 2, 15, z + 2, (xx, y, zz) => y < 2 ? (h3(xx, y, zz) < .5 ? W.rust : W.frameD) : worn(xx, y, zz, W.frame), GLOSS); f.box(x - (x < 0 ? 1 : 0), 0, z - (z < 0 ? 1 : 0), x + 2 + (x > 0 ? 1 : 0), 1, z + 2 + (z > 0 ? 1 : 0), W.steelD, MET); }
  for (const z of [-8, 7]) f.box(-14, 13, z, 14, 15, z + 1, (x, y) => worn(x, y, z, y === 13 ? W.frameD : W.frame), GLOSS);
  f.box(-16, 3, -8, 16, 4, 8, (x, y, z) => z === 7 ? W.galv : (x * 5 + z * 3) % 17 === 0 ? W.galvD : W.galv);
  f.box(-17, 15, -9, 17, 17, 9, (x, y, z) => { if (x === -17 || x === 16) return (z & 1) ? W.blockD : W.endg; if (y === 15) return W.blockD;
    const s = h3(0, z, 3), r = h3(x, 5, z);
    return r < .02 ? W.scar : Math.hypot((x + 2) / 6, (z - 3) / 3.5) < 1 ? W.oil : s < .3 ? W.blockD : s > .75 ? W.blockL : W.block; });
  f.box(8, 17, 1, 16, 18, 9, (x, y, z) => ((x + z) % 4 === 0 && h3(x, 5, z) < .5) ? W.steel : W.iron, MET);
  for (const [x, z] of [[8, 1], [15, 1], [8, 8], [15, 8]]) f.set(x, 18, z, W.steelL, MET);
  pegboard(f, -16, 17, 16, 38); f.box(-17, 15, -9, -16, 39, -7, W.frame, GLOSS).box(16, 15, -9, 17, 39, -7, W.frame, GLOSS).box(-17, 38, -9, 17, 39, -7, W.frame, GLOSS);
  for (let k = 0; k < 7; k++) { const x = -15 + k * 1.5 | 0, len = 5 + k; f.box(x, 33 - len, -8, x + 1, 33, -7, W.steelL, MET).set(x, 33 - len, -7, W.steel, MET); }
  f.box(-4, 30, -8, 6, 31, -7, W.steel, MET).box(-4, 26, -8, -3, 30, -7, W.steel, MET).box(5, 26, -8, 6, 30, -7, W.steel, MET).box(-3, 26, -8, 5, 27, -7, W.steelL, MET).box(-6, 25, -8, -4, 29, -7, W.ink);
  for (const x of [-3, -1]) f.box(x, 19, -8, x + 1, 25, -7, (xx, y) => y > 22 ? W.woodD : (y & 1) ? W.blade : W.steelD, MET);
  f.box(8, 21, -8, 9, 26, -7, W.red, GLOSS).box(10, 21, -8, 11, 26, -7, W.red, GLOSS).box(8, 26, -8, 11, 29, -7, W.steelD, MET);
  f.box(2, 20, -8, 3, 25, -7, W.woodL).box(1, 25, -8, 5, 27, -7, W.steelD, MET);
  lamp(f, 14, 33);
  f.box(-13, 17, 0, -9, 18, 5, W.steelD, MET).box(-13, 18, 1, -9, 22, 4, (x, y, z) => y === 21 || z === 3 && y === 19 ? W.iron : W.ironL, GLOSS).set(-11, 19, 4, W.ink);
  for (const x of [-15, -8]) for (let y = 17; y < 26; y++) for (let z = -1; z < 7; z++) { const d = Math.hypot(y + .5 - 20.5, z + .5 - 3);
    if (d <= 3.2) f.box(x, y, z, x + 2, y + 1, z + 1, d > 2.5 ? W.wheelD : W.wheel); else if (d <= 4.1 && y >= 20) f.box(x - (x < 0 ? 1 : 0), y, z, x + 2 + (x > 0 ? 1 : 0), y + 1, z + 1, W.ironL, GLOSS); }
  for (const x of [-16, -6]) for (let y = 17; y < 25; y++) for (let z = 0; z < 6; z++) if (Math.hypot(y + .5 - 20.5, z + .5 - 3) <= 3.4 && y >= 18) f.set(x, y, z, W.ironL, GLOSS);
  f.box(-14, 19, 2, -13, 21, 3, W.steel, MET).box(-9, 19, 2, -8, 21, 3, W.steel, MET);
  viseBack(f, 18, true);
  tin(f, 0, 17, -7, 3); f.box(4, 17, -6, 7, 18, -3, W.cream).box(4, 18, -5, 6, 19, -3, (x, y, z) => h3(x, y, z) < .4 ? W.boardD : W.cream);
  f.box(-12, 4, -6, -1, 13, 4, (x, y, z) => { if ((x === -12 || x === -2) && z === 3 && (y === 12 || y === 4)) return W.steel; return y === 12 ? W.chestD : (y === 7 || y === 10) && z === 3 ? W.chestD : W.chest; }, GLOSS);
  for (const y of [6, 9, 11]) f.box(-9, y, 4, -5, y + 1, 5, W.steelL, MET);
  f.box(4, 4, -5, 9, 10, -1, (x, y, z) => y === 9 ? W.steelD : W.frame, GLOSS).box(6, 10, -4, 7, 12, -3, W.steelD, MET); }

export const toolBench = def({ id: 'tool-bench', name: 'The bench', cat: 'security', place: 'floor', foot: [7, 4], h: 1.95, tops: [0.85],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['bench', 'station', 'craft', 'vise', 'pegboard'], variants: 2, vnames: ['knocked together', 'off a closing garage'],
  does: 'The bench: an hour at it packs three bottles or two boxes of rounds (the crafting plan; the rules own it).',
  game: g('gear', 'common', 'store'),
  build(V, { variant = 0 } = {}) { const f = cells(); (variant ? bench2 : bench1)(f); intoVol(V, f.out, 17, 9); } });

// ── THE CAN OVER THE DOOR, LOADED: the fogger's own build with its can in the load's colour (traps.js pepperFogger takes { can }), and over
// the can's label a strip of masking tape with a mark scrawled on it in marker, and the bag's colour dabbed beside it. Variants: the five
// families' colours (the plan: downers blue, uppers red, trips violet, mutagens green, the grail black)
const LOADS = [['blue', 0x2a4bd8], ['red', 0xd8232a], ['violet', 0x8c52ff], ['green', 0x25b84c], ['black', 0x2a2a30]];
export const doorCan = def({ id: 'door-can', name: 'The can over the door, loaded', cat: 'security', place: 'wall', foot: [2, 2], h: 0.3, mount: 2.0, sim: 'alarm', grain: 0.025,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['fogger', 'door', 'trap', 'loaded', 'craft'], variants: LOADS.length, vnames: LOADS.map(([n]) => `loaded: ${n}`),
  does: 'The pepper fogger with a bag of what you cooked in it: the first two through the door get it (the crafting plan; the rules own it).',
  game: g('gear', 'rare', 'craft'),
  build(V, { variant = 0 } = {}) { pepperFogger.build(V, { can: pick(LOADS, variant)[1] }); },
  // fine pass: the tape over the label, a scrawl on it, the plate's screws, the nozzle's mouth
  fine(P, { variant = 0 } = {}) {
    const c = pick(LOADS, variant)[1];
    frect(P, '+z', 5.75, 10.5, 13.25, 13.25, 0xe8d9a8);
    for (const [x0, y0, x1, y1] of [[6.75, 11.5, 8, 12.5], [8, 12.5, 9.25, 11.25], [9.25, 11.25, 10.5, 12.25], [10.5, 12.25, 11.75, 11.5]]) frect(P, '+z', Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.min(y0, y1) + .25, K.ink);
    frect(P, '+z', 12, 11, 12.75, 12.75, c);
    for (const [x, y] of [[4.25, 18.25], [14.25, 18.25], [4.25, 6.25], [14.25, 6.25]]) frect(P, '+z', x, y, x + .5, y + .5, K.chrome);
    frect(P, '-y', 9.25, 8.25, 9.75, 8.75, 0x5a1a10);
  } });

// ── THE KNOCK-KNOCK: a gun clamped to a pine board inside the door, lying in profile on the wall with its muzzle toward the doorway (+x),
// two pipe clamps over it, a yellow cord from its trigger along to an eye screw at the board's end and off to the door's edge. The gun is
// the run's own, by its own build (arms.js draws it lying on a surface: rows across its profile; here its profile stands on the wall:
// a lying gun's x is along the wall, its rows go up the wall top first, its height comes out of the wall). Variants: which gun.
const GUNS = [['the six-shot', sixShot, 20], ['the junk pistol', junkPistol, 20], ['the Doorman', doubleBarrel, 28]];
/** A gun's Vol (lying, arms.js) drawn onto the wall at (ox, oy, oz): x → x, its rows z (0 = the top of its profile) → up, its y → out. */
function onWall(V, ox, oy, oz, rows = 10) {
  const T = (x, y, z) => [ox + x, oy + rows - 1 - z, oz + y];
  return { set(x, y, z, c, l = 0) { V.set(...T(x, y, z), c, l); }, del(x, y, z) { V.del(...T(x, y, z)); }, has(x, y, z) { return V.has(...T(x, y, z)); },
    box(x0, y0, z0, x1, y1, z1, c, l = 0) { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); } };
}
export const doorGun = def({ id: 'door-gun', name: 'The Knock-Knock', cat: 'security', place: 'wall', foot: [3, 2], h: 0.2, mount: 0.9, sim: 'door', grain: 0.025,
  shaped: 'a gun in profile clamped to a board: its frame, cylinder and grip, the clamps and the cord need the half block',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['gun', 'door', 'trap', 'craft'], variants: GUNS.length, vnames: GUNS.map(([n]) => n),
  does: 'A gun of yours rigged inside the door: one shot at whoever forces it while you are out (the crafting plan; the rules own it).',
  game: g('gear', 'rare', 'craft'),
  build(V, { variant = 0 } = {}) {
    const [, gun, len] = pick(GUNS, variant), x0 = Math.round((30 - len) / 2);
    // the board: a pine plank screwed to the wall, its grain; two pipe clamps over the gun (the frame and the barrel)
    V.box(1, 2, 0, 29, 18, 1, (x, y) => (y === 2 || y === 17 ? 0xa47c48 : (x * 3 + (y >> 2)) % 11 === 0 ? 0xb8905a : 0xc79c62));
    gun.build(onWall(V, x0, 5, 1), { variant: 0 });
    // (each clamp a strap one block wide over the gun where it crosses: down in front of it, its feet screwed to the board above and below)
    for (const cx of [x0 + 8, x0 + len - 4]) {
      let lo = 99, hi = -1, zf = 1;
      for (let y = 3; y < 17; y++) for (let z = 1; z < 7; z++) if (V.has(cx, y, z)) { lo = Math.min(lo, y); hi = Math.max(hi, y); zf = Math.max(zf, z); }
      if (hi < 0) continue;
      for (let y = lo - 1; y <= hi + 1; y++) V.set(cx, y, zf + 1, 0xb8bcc4, 1);
      for (let z = 1; z <= zf + 1; z++) { V.set(cx, lo - 1, z, 0xb8bcc4, 1); V.set(cx, hi + 1, z, 0xb8bcc4, 1); }
    }
    // the cord: from the trigger down to the board, along it to the eye screw at its end, and off the board toward the door
    const ty = 7;
    for (let x = x0 + 7; x < 30; x++) V.set(x, ty - 2, 1, K.yellow);
    V.set(x0 + 7, ty - 1, 1, K.yellow); V.set(29, ty - 2, 1, K.yellow); V.set(29, ty - 1, 1, K.steelL, 1); V.set(29, ty - 1, 2, K.steelL, 1);
  },
  // fine pass: the board's screws at its corners
  fine(P) { for (const [x, y] of [[1.5, 2.5], [28, 2.5], [1.5, 16.75], [28, 16.75]]) frect(P, '+z', x, y, x + .5, y + .5, K.steelD); } });

// ── A PORCH LAMP: a jelly-jar lamp on a round wall plate, its glass globe in a wire cage, lit at night (lib.js glow: gloss by day), two
// moths at the glass
export const porchLamp = def({ id: 'porch-lamp', name: 'Porch lamp', cat: 'lights', place: 'wall', foot: [1, 2], h: 0.2, mount: 1.85, grain: 0.025,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['lamp', 'porch', 'door', 'night'], variants: 2, vnames: ['black', 'brass'],
  game: g('base', 'common', 'store'),
  build(V, { variant = 0 } = {}) {
    const m = pick([0x2a2b30, 0xb8963e], variant), glass = 0xfff1c8;
    // the wall plate, the arm out and down to a narrow cap; the globe under it, wider than the cap, so its glass shows from above too
    cylZ(V, 5, 15, 3.4, 0, 1, m, 1);
    V.box(4, 14, 1, 6, 16, 4, m, 1);
    cyl(V, 5, 4.5, 1.7, 12, 14, m, 1);
    for (let y = 3; y < 12; y++) { const r = y >= 10 ? 2.4 : 3.1; for (let x = 0; x < 10; x++) for (let z = 0; z < 8; z++) if (Math.hypot(x + .5 - 5, z + .5 - 4.5) <= r) V.set(x, y, z, glass, glow()); }
    cyl(V, 5, 4.5, 2.0, 2, 3, m, 1);
    // the cage: four wires down the globe and a ring round its middle
    for (const [dx, dz] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) for (let y = 3; y < 10; y++) V.set(Math.min(9, 5 + dx - (dx > 0 ? 1 : 0)), y, Math.min(7, Math.round(4.5 + dz) - (dz > 0 ? 1 : 0)), m, 1);
    for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2; V.set(Math.floor(5 + Math.cos(t) * 3.2), 6, Math.min(7, Math.floor(4.5 + Math.sin(t) * 3.2)), m, 1); }
    // two moths at the glass
    V.set(8, 9, 6, 0xd8ccb0); V.set(2, 5, 7, 0xd8ccb0);
  },
  // fine pass: the plate's two screws, the bulb's filament seen through the glass
  fine(P) { for (const y of [17.5, 12.25]) frect(P, '+z', 4.75, y, 5.25, y + .25, K.steelL); fdisc(P, '+z', 5, 7, .7, d => (d < .4 ? 0xffd27a : null)); } });

export const CRAFT = [toolBench, doorCan, doorGun, porchLamp];
