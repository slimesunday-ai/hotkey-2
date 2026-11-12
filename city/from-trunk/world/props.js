// AI CITY world v2 — street props as fine voxels (8 per block), the same voxel grammar as the characters.
// Each prop is authored once in a chars.js Grid, greedy-meshed here (same-colour faces merge), and merged into the chunk
// mesh (white tile × vertex colour), so props cost no extra draw calls. Grid layer 3 ("lit") glows at night.
import * as THREE from 'three';
import { Grid } from './chars.js';
import { drawText, textWidth, tint } from './tiles.js';
import { c as pc, ci } from './palettes.js';

const V = 8;   // voxels per block
const H = s => parseInt(s.slice(1), 16);
const DK = 0x34383e, BLK = 0x1b1c20, TIRE = 0x1d1d20, HUB = 0x9aa0a6, GLASS = 0x2c3a4a, CHROME = 0xc9ced4;

// ───────────────────────── models (front = +z, footprint centred on x/z = 0, y = 0 is the ground)
const M = {};
M.streetlight = () => { const g = new Grid(); g.box(-1, 0, -1, 1, 46, 1, DK); g.box(-2, 0, -2, 2, 3, 2, DK); g.box(-1, 44, 0, 1, 46, 13, DK);
  g.box(-2, 41, 9, 2, 44, 16, 0x2c2f35); g.box(-1, 41, 10, 1, 42, 15, 0xfff1c6, 3); return g; };
M.deadlight = () => { const g = M.streetlight(); g.box(-1, 41, 10, 1, 42, 15, 0x6d7278); return g; };   // the mall's lights are off for good
M.cart = () => { const g = new Grid(); g.box(-3, 3, -5, 3, 4, 4, 0xb9bec4); for (const x of [-3, 2]) g.box(x, 4, -5, x + 1, 8, 4, 0xb9bec4); g.box(-3, 4, -5, 3, 8, -4, 0xb9bec4); g.box(-3, 4, 3, 3, 8, 4, 0xb9bec4);
  g.box(-3, 8, -7, 3, 9, -6, 0xc0392f); for (const [x, z] of [[-3, -5], [2, -5], [-3, 3], [2, 3]]) g.box(x, 0, z, x + 1, 3, z + 1, 0x6d7278); return g; };
M.candle = () => { const g = new Grid(); g.box(0, 0, 0, 1, 2, 1, 0xf1efe9); g.box(0, 2, 0, 1, 3, 1, 0xffc85a, 3); return g; };
M.flowers = (c = 0xff4fa3) => { const g = new Grid(); for (const [x, z] of [[-1, 0], [1, 1], [0, -1]]) { g.box(x, 0, z, x + 1, 3, z + 1, 0x3f8f3a); g.box(x, 3, z, x + 1, 4, z + 1, c); } g.box(-2, 0, -2, 3, 1, 3, 0xd9c7a8); return g; };
M.plaque = () => { const g = new Grid(); g.box(0, 0, 0, 1, 6, 1, 0x6e4c31); g.box(-4, 5, 0, 5, 11, 1, 0xf1efe9); return g; };
M.marker = () => { const g = new Grid(); g.box(-1, 0, -1, 2, 1, 2, 0xf0c330); g.box(-1, 1, 0, 2, 3, 1, 0xf0c330); g.box(0, 3, 0, 1, 4, 1, 0xf0c330); return g; };
M.plywood = (w = 3) => { const g = new Grid(), W = w * V / 2; for (const x of [-W + 1, W - 2]) g.box(x, 0, -1, x + 1, 18, 0, 0x6e4c31); g.box(-W, 2, 0, W, 17, 1, 0xb58a55); return g; };
M.traffic = () => { const g = new Grid(); g.box(-1, 0, -1, 1, 42, 1, 0x2f3337); g.box(-2, 0, -2, 2, 3, 2, 0x2f3337); g.box(-1, 40, 0, 1, 42, 30, 0x2f3337);
  for (const z of [14, 26]) { g.box(-2, 30, z, 2, 40, z + 3, BLK); g.box(-1, 37, z + 3, 1, 39, z + 4, 0xe0332f, 3); g.box(-1, 34, z + 3, 1, 36, z + 4, 0x3b2a10); g.box(-1, 31, z + 3, 1, 33, z + 4, 0x1f3a26);
    g.box(-1, 37, z - 1, 1, 39, z, 0x3a1210); g.box(-1, 31, z - 1, 1, 33, z, 0x39e07a, 3); }
  g.box(-2, 20, 1, 2, 24, 2, 0xe9e7df); g.box(-1, 21, 2, 1, 23, 3, 0xf0f0f0, 3); return g; };
M.hydrant = () => { const g = new Grid(); g.box(-2, 0, -2, 2, 6, 2, 0xc0392f); g.box(-3, 0, -3, 3, 1, 3, 0xa2302a); g.box(-1, 6, -1, 1, 8, 1, 0xa2302a); g.box(-3, 3, -1, 3, 5, 1, 0xa2302a); return g; };
M.bench = () => { const g = new Grid(); for (const x of [-7, 6]) g.box(x, 0, -2, x + 1, 3, 2, DK); g.box(-8, 3, -3, 8, 4, 2, 0x9a7049); g.box(-8, 4, -3, 8, 7, -2, 0x9a7049); g.box(-8, 5, -3, 8, 6, -2, 0x86603d); return g; };
M.dumpster = () => { const g = new Grid(); g.box(-8, 1, -5, 8, 10, 5, 0x2f6b45); g.box(-9, 10, -6, 9, 11, 6, 0x24533a); g.box(-8, 5, 5, 8, 6, 6, 0x24533a);
  for (const [x, z] of [[-7, -4], [6, -4], [-7, 3], [6, 3]]) g.box(x, 0, z, x + 1, 1, z + 1, BLK); return g; };
M.trash = () => { const g = new Grid(); g.box(-2, 0, -2, 2, 6, 2, 0x2f4f3a); g.box(-3, 6, -3, 3, 7, 3, 0x263f2f); return g; };
M.mailbox = (c = 0x2b2d31) => { const g = new Grid(); g.box(-1, 0, -1, 1, 8, 1, 0x6e4c31); g.box(-2, 8, -4, 2, 11, 4, c); g.box(-1, 11, -4, 1, 12, 4, c); g.box(2, 9, -2, 3, 13, -1, 0xc0392f); return g; };
M.streetbox = () => { const g = new Grid(); g.box(-3, 0, -3, 3, 1, 3, BLK); g.box(-3, 1, -3, 3, 9, 3, 0x2f5b9a); g.box(-3, 9, -3, 3, 11, 3, 0x284d83); g.box(-2, 7, 3, 2, 8, 4, 0x1b2e4d); return g; };
M.ac = () => { const g = new Grid(); g.box(-6, 0, -5, 6, 7, 5, 0xc4c8cc); g.box(-4, 7, -3, 4, 8, 3, 0x6d7278); g.box(-5, 1, 5, 5, 6, 6, 0x9aa0a6); return g; };
M.waterTower = () => { const g = new Grid(); for (const [x, z] of [[-9, -9], [8, -9], [-9, 8], [8, 8]]) g.box(x, 0, z, x + 1, 12, z + 1, 0x4a3a2c);
  g.box(-9, 6, -9, 9, 7, -8, 0x4a3a2c); g.box(-9, 6, 8, 9, 7, 9, 0x4a3a2c); g.box(-11, 12, -11, 11, 13, 11, 0x5a4636);
  g.ell(0, 22, 0, 10, 10, 10, (x, y, z) => (y % 6 === 0 ? 0x3d3f44 : ((x + z) & 1 ? 0x8d6b48 : 0x80603f)));
  g.clip((x, y, z) => y < 13 || y > 30); g.box(-9, 13, -9, 9, 30, 9, (x, y, z) => (Math.hypot(x + .5, z + .5) < 9.6 ? (y % 6 === 0 ? 0x3d3f44 : ((x + z) & 1 ? 0x8d6b48 : 0x80603f)) : null));
  for (let k = 0; k < 7; k++) g.box(-9 + k, 30 + k, -9 + k, 9 - k, 31 + k, 9 - k, (x, y, z) => (Math.hypot(x + .5, z + .5) < 9.6 - k * 1.3 ? 0x5b5d63 : null)); return g; };
M.antenna = () => { const g = new Grid(); g.box(0, 0, 0, 1, 26, 1, 0x8d939a); for (const [y, w] of [[14, 7], [19, 5], [24, 3]]) g.box(-w, y, 0, w + 1, y + 1, 1, 0x8d939a); return g; };
M.dish = () => { const g = new Grid(); g.box(0, 0, 0, 1, 5, 1, 0x8d939a); g.ell(0, 7, 1, 4, 4, 1.2, 0xe9e7e1); g.box(0, 7, 2, 1, 8, 5, 0x6d7278); return g; };
M.barrel = (c = 0x2f5b9a) => { const g = new Grid(); g.box(-2, 0, -2, 3, 8, 3, (x, y, z) => ((x === -2 || x === 2) && (z === -2 || z === 2) ? null : (y === 2 || y === 5 ? tintHex(c, .75) : c))); g.box(-1, 8, -1, 2, 9, 2, tintHex(c, .75)); return g; };
M.pump = () => { const g = new Grid(); g.box(-4, 0, -3, 4, 1, 3, 0x9aa0a6); g.box(-3, 1, -2, 3, 13, 2, 0xe9e7e1); g.box(-3, 10, -2, 3, 13, 2, 0xc0392f); g.box(-2, 6, 2, 2, 9, 3, 0x9ee6b0, 3); g.box(3, 3, -1, 4, 8, 0, BLK); return g; };
M.flamingo = () => { const g = new Grid(); g.box(0, 0, 0, 1, 7, 1, 0x333333); g.box(-1, 7, -2, 2, 10, 2, 0xf06ea0); g.box(0, 10, 1, 1, 15, 2, 0xf06ea0); g.box(0, 14, 2, 1, 15, 4, 0xf06ea0); g.box(0, 13, 3, 1, 14, 4, 0x222222); return g; };
M.grill = () => { const g = new Grid(); for (const x of [-2, 2]) g.box(x, 0, 0, x + 1, 5, 1, 0x333333); g.ell(.5, 7, .5, 3.5, 2.5, 3.5, 0x1f1f22); g.box(0, 9, 0, 1, 10, 1, 0x555555); return g; };
M.chair = (c = 0x3aa6a0) => { const g = new Grid(); for (const [x, z] of [[-3, -3], [2, -3], [-3, 2], [2, 2]]) g.box(x, 0, z, x + 1, 4, z + 1, 0xc9ced4); g.box(-3, 4, -3, 3, 5, 3, c); g.box(-3, 5, -4, 3, 11, -3, c); return g; };
M.tires = () => { const g = new Grid(); for (let k = 0; k < 3; k++) g.box(-4, k * 3, -4, 4, k * 3 + 3, 4, (x, y, z) => { const d = Math.hypot(x + .5, z + .5); return d < 4.2 && d > 1.6 ? TIRE : null; }); return g; };
M.cone = () => { const g = new Grid(); g.box(-2, 0, -2, 2, 1, 2, 0xe8702a); g.box(-1, 1, -1, 1, 5, 1, (x, y) => (y === 3 ? 0xf2f2f2 : 0xe8702a)); return g; };
M.payphone = () => { const g = new Grid(); g.box(-1, 0, -1, 1, 8, 1, 0x8d939a); g.box(-3, 8, -2, 3, 16, 2, 0x9aa0a6); g.box(-3, 16, -2, 3, 18, 2, 0x2f5b9a); g.box(-3, 16, 2, 3, 18, 3, 0xdfe9f7, 3); g.box(-2, 10, 2, 0, 14, 3, BLK); return g; };
M.newsbox = (c = 0xc0392f) => { const g = new Grid(); g.box(-2, 0, -2, 2, 2, 2, 0x333333); g.box(-2, 2, -2, 2, 8, 2, c); g.box(-1, 4, 2, 1, 7, 3, 0xdfe6ee); return g; };
M.meter = () => { const g = new Grid(); g.box(0, 0, 0, 1, 8, 1, 0x6d7278); g.box(-1, 8, -1, 2, 11, 2, 0x9aa0a6); g.box(0, 9, 2, 1, 10, 3, 0x2d2f33); return g; };
M.spot = () => { const g = new Grid(); g.box(-2, 0, -2, 2, 2, 2, 0x333333); g.box(-2, 2, -2, 2, 6, 3, 0x2b2d31); g.box(-1, 3, 3, 1, 5, 4, 0xfffbe6, 3); return g; };
M.hoop = () => { const g = new Grid(); g.box(-1, 0, -1, 1, 26, 1, 0x6d7278); g.box(-1, 24, 0, 1, 26, 4, 0x6d7278); g.box(-5, 22, 4, 5, 30, 5, 0xf2f2f2); g.box(-2, 24, 4, 2, 27, 5, 0xc0392f); g.box(-2, 22, 5, 2, 23, 9, 0xe8702a); return g; };
M.flagpole = () => { const g = new Grid(); g.box(0, 0, 0, 1, 64, 1, 0xd9dce0); g.box(1, 50, 0, 17, 63, 1, (x, y) => (y > 59 && x < 7 ? 0x1f3a6e : ((y >> 1) & 1 ? 0xe9e7e1 : 0x2f5b9a))); return g; };
M.forsale = () => { const g = new Grid(); for (const x of [-4, 3]) g.box(x, 0, 0, x + 1, 9, 1, 0xf1efe9); g.box(-5, 5, 0, 5, 12, 1, 0xf1efe9); g.box(-5, 11, 0, 5, 12, 1, 0xc0392f); g.box(-5, 5, 0, 5, 6, 1, 0xc0392f); return g; };
M.bollard = () => { const g = new Grid(); g.box(-1, 0, -1, 2, 7, 2, 0xe9bd3a); g.box(-1, 5, -1, 2, 6, 2, 0x222222); return g; };
M.planter = () => { const g = new Grid(); g.box(-4, 0, -4, 4, 4, 4, 0xa89f90); g.box(-3, 4, -3, 3, 5, 3, 0x5a3d28); g.ell(0, 8, 0, 3.5, 3.5, 3.5, 0x4f9a3f); return g; };
M.crateStack = () => { const g = new Grid(); g.box(-7, 0, -4, 7, 7, 4, 0xb58a55); g.box(-4, 7, -3, 4, 13, 3, 0xa27a48); for (const y of [0, 6, 7, 12]) g.box(-7, y, 4, 7, y + 1, 5, 0x8a6438); return g; };
M.skid = () => { const g = new Grid(); g.box(-6, 0, -6, 6, 2, 6, 0x9a7049); g.box(-5, 2, -5, 5, 9, 5, 0x2f5b9a); g.box(-5, 9, -5, 5, 10, 5, 0xe9e7e1); return g; };
M.fireEscape = (w, floors) => { const g = new Grid(), W = w * V / 2; for (let f = 1; f < floors; f++) { const y = f * 32;
    g.box(-W, y, 0, W, y + 1, 9, 0x26282c); for (let x = -W; x < W; x += 2) g.box(x, y + 1, 8, x + 1, y + 7, 9, 0x26282c); g.box(-W, y + 7, 8, W, y + 8, 9, 0x26282c);
    for (let k = 0; k < 30; k += 2) g.box(-W + 2 + (f % 2 ? k * .4 : (W * 2 - 6) - k * .4) | 0, y - 30 + k, 3, (-W + 4 + (f % 2 ? k * .4 : (W * 2 - 6) - k * .4)) | 0, y - 29 + k, 6, 0x26282c); }
  return g; };
M.awning = (w, c) => { const g = new Grid(), W = w * V / 2; for (let z = 0; z < 10; z++) { const y = 12 - Math.round(z * .55); g.box(-W, y, z, W, y + 1, z + 1, x => (((x + W) >> 2) & 1 ? 0xf1ece2 : c)); }
  g.box(-W, 4, 9, W, 7, 10, x => (((x + W) >> 2) & 1 ? 0xf1ece2 : c)); return g; };
M.billboard = (w, h) => { const g = new Grid(), W = w * V / 2; for (const x of [-W + 6, W - 8]) g.box(x, 0, -2, x + 2, 40, 0, 0x5b5f66); g.box(-W, 40, -2, W, 40 + h * V, -1, 0x3a3d42);
  g.box(-W, 38, -1, W, 39, 6, 0x6d7278); for (let x = -W; x < W; x += 3) g.box(x, 39, 5, x + 1, 44, 6, 0x6d7278); for (let x = -W + 4; x < W; x += 12) g.box(x, 38, 4, x + 1, 39, 8, 0x6d7278), g.box(x, 38, 7, x + 2, 40, 9, 0xfff3d0, 3); return g; };
M.neonTube = (w, c) => { const g = new Grid(), W = w * V / 2; g.box(-W, 0, 0, W, 1, 1, c, 3); return g; };

function tintHex(c, f) { return H(tint('#' + c.toString(16).padStart(6, '0'), f)); }
// vehicles: 34 long (front +z), 14 wide
M.car = (kind = 'sedan', col = '#c0392f', seed = 1) => { const g = new Grid(), c = H(col), c2 = tintHex(c, .8);
  const wreck = kind === 'wreck', lift = wreck ? 0 : 2;
  const body = (x0, y0, z0, x1, y1, z1, cc = c) => g.box(x0, y0 + lift - 2, z0, x1, y1 + lift - 2, z1, cc);
  if (kind === 'box' || kind === 'ambulance' || kind === 'van') {
    body(-7, 2, -17, 7, 7, 17, c); body(-7, 7, -17, 7, 15, 9, kind === 'ambulance' ? 0xf1efe9 : c); body(-7, 7, 9, 7, 11, 14, c); body(-6, 11, 9, 6, 15, 12, GLASS);
    body(-7, 7, 12, 7, 11, 14, GLASS); if (kind === 'ambulance') { body(-7, 9, -17, 7, 11, 9, 0xc0392f); body(-4, 15, 5, 4, 16, 8, 0xe0332f); g.box(-4, 15 + lift - 2, 5, 0, 16 + lift - 2, 8, 0xff3b3b, 3); g.box(0, 15 + lift - 2, 5, 4, 16 + lift - 2, 8, 0x3b6bff, 3); }
    if (kind === 'box') { body(-8, 7, -18, 8, 17, 8, 0xe9e7e1); } }
  else if (kind === 'pickup') { body(-7, 2, -17, 7, 7, 17); body(-6, 7, -3, 6, 12, 7, GLASS); body(-7, 7, -3, 7, 8, 7); body(-7, 11, -3, 7, 12, 7); body(-7, 7, 6, 7, 11, 7); body(-7, 7, -3, -6, 12, -2); body(6, 7, -3, 7, 12, -2);
    body(-7, 7, -17, -6, 9, -3); body(6, 7, -17, 7, 9, -3); body(-7, 7, -17, 7, 9, -16); }
  else { body(-7, 2, -17, 7, 7, 17); body(-7, 7, 5, 7, 8, 15); const cab = kind === 'hatch' ? [-14, 5] : [-9, 5];
    body(-6, 8, cab[0], 6, 12, cab[1], GLASS); body(-6, 12, cab[0], 6, 13, cab[1]); for (const x of [-6, 5]) for (const z of [cab[0], cab[1] - 1, -2]) body(x, 8, z, x + 1, 12, z + 1);
    if (kind === 'cop') { body(-7, 4, -6, 7, 7, 6, 0xf1efe9); body(-6, 13, -3, 6, 14, 1, 0x222222); g.box(-6, 13 + lift - 2, -3, 0, 14 + lift - 2, 1, 0xff2a2a, 3); g.box(0, 13 + lift - 2, -3, 6, 14 + lift - 2, 1, 0x2a5bff, 3); }
    if (kind === 'taxi') { body(-2, 13, -4, 2, 15, 0, 0xfff6c8, 3); } }
  if (!wreck) { for (const z of [-12, 9]) for (const x of [-8, 6]) { g.box(x, 0, z, x + 2, 5, z + 5, TIRE); g.box(x === -8 ? -8 : 7, 2, z + 2, x === -8 ? -7 : 8, 3, z + 3, HUB); }
    g.box(-6, 3 + lift - 2, 17, -3, 5 + lift - 2, 18, 0xfff3d0, 3); g.box(3, 3 + lift - 2, 17, 6, 5 + lift - 2, 18, 0xfff3d0, 3);
    g.box(-6, 3 + lift - 2, -18, -3, 5 + lift - 2, -17, 0xd8282a, 3); g.box(3, 3 + lift - 2, -18, 6, 5 + lift - 2, -17, 0xd8282a, 3);
    g.box(-7, 1 + lift - 2, 17, 7, 3 + lift - 2, 18, CHROME); g.box(-7, 1 + lift - 2, -18, 7, 3 + lift - 2, -17, CHROME); g.box(-2, 3 + lift - 2, -18, 2, 5 + lift - 2, -17, 0xf1efe9); }
  else { const r = mulberry(seed); g.clip((x, y, z) => r() < .06 && y > 3); for (const k of [...g.keys()]) { if (r() < .35) { const x = ((k >> 18) & 511) - 256, y = ((k >> 9) & 511) - 256, z = (k & 511) - 256; g.set(x, y, z, r() < .5 ? 0x8a4a2a : 0x6b3a22); } } }
  return g; };
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const CAR_COLS = ['#c0392f', '#2f5d8c', '#e7e3da', '#2b2d31', '#8a9197', '#3f7b4b', '#d4a13a', '#6e2f45', '#b7c4cf', '#1f3a5f', '#e9e7e1', '#7a5a3a'];

// ───────────────────────── prop geometry cache: arrays ready to append into a chunk
const cache = new Map();
const dec = k => [((k >> 18) & 511) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
function greedy(g) {
  const vox = new Map(), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  g.L.forEach((Mp, li) => { for (const [k, c] of Mp) { const p = dec(k); vox.set(k, ci(c) * 2 + (li === 3 ? 1 : 0)); for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[a]); hi[a] = Math.max(hi[a], p[a]); } } });
  const K = (x, y, z) => ((x + 256) << 18) | ((y + 256) << 9) | (z + 256), at = p => vox.get(K(p[0], p[1], p[2]));
  const P = [], N = [], C = [], I = [], Gl = [], col = new THREE.Color(); let v = 0;
  for (let d = 0; d < 3; d++) { const ud = (d + 1) % 3, vd = (d + 2) % 3, nu = hi[ud] - lo[ud] + 1, nv = hi[vd] - lo[vd] + 1, mask = new Float64Array(nu * nv);
    for (const s of [1, -1]) for (let w = lo[d]; w <= hi[d]; w++) {
      const p = [0, 0, 0], q = [0, 0, 0];
      for (let a = 0; a < nu; a++) for (let b = 0; b < nv; b++) { p[d] = w; p[ud] = lo[ud] + a; p[vd] = lo[vd] + b; q[d] = w + s; q[ud] = p[ud]; q[vd] = p[vd]; const c = at(p); mask[a * nv + b] = c !== undefined && at(q) === undefined ? c + 1 : 0; }
      for (let a = 0; a < nu; a++) for (let b = 0; b < nv; b++) { const c = mask[a * nv + b]; if (!c) continue;
        let bw = 1; while (b + bw < nv && mask[a * nv + b + bw] === c) bw++;
        let aw = 1; grow: while (a + aw < nu) { for (let k = 0; k < bw; k++) if (mask[(a + aw) * nv + b + k] !== c) break grow; aw++; }
        for (let i = 0; i < aw; i++) for (let k = 0; k < bw; k++) mask[(a + i) * nv + b + k] = 0;
        const val = c - 1, glow = val % 2, hex = (val - glow) / 2, plane = w + (s > 0 ? 1 : 0), u0 = lo[ud] + a, u1 = u0 + aw, v0 = lo[vd] + b, v1 = v0 + bw;
        const corner = (u, vv) => { const o = [0, 0, 0]; o[d] = plane; o[ud] = u; o[vd] = vv; return o; };
        const cs = s > 0 ? [corner(u0, v0), corner(u1, v0), corner(u1, v1), corner(u0, v1)] : [corner(u0, v0), corner(u0, v1), corner(u1, v1), corner(u1, v0)];
        col.setHex(hex); const n = [0, 0, 0]; n[d] = s;
        for (const o of cs) { P.push(o[0] / V, o[1] / V, o[2] / V); N.push(n[0], n[1], n[2]); C.push(col.r, col.g, col.b); Gl.push(glow); }
        I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; } } }
  return { P, N, C, I, G: Gl, n: v };
}
export function propData(key) {
  let d = cache.get(key); if (d) return d;
  const [name, ...args] = key.split(':'); d = greedy(M[name](...args.map(a => (/^-?\d+(\.\d+)?$/.test(a) ? +a : a)))); cache.set(key, d); return d;
}
// footprint for walking: block-space [x, z] centres of the voxel columns a prop fills within 2 blocks of its base
const footCache = new Map();
export function propFoot(key) {
  let f = footCache.get(key); if (f) return f;
  const [name, ...args] = key.split(':'), g = M[name](...args.map(a => (/^-?\d+(\.\d+)?$/.test(a) ? +a : a))), seen = new Set(); f = [];
  g.L.forEach(Mp => { for (const k of Mp.keys()) { const [x, y, z] = dec(k); if (y < 0 || y >= 2 * V) continue; const c = x * 1024 + z; if (!seen.has(c)) { seen.add(c); f.push([(x + .5) / V, (z + .5) / V]); } } });
  footCache.set(key, f); return f;
}
export function rotXZ(x, z, r) { return r === 0 ? [x, z] : r === 1 ? [z, -x] : r === 2 ? [-x, -z] : [-z, x]; }

// ───────────────────────── signs: pixel-font canvas planes (neon and lit boxes glow at night)
const signCache = new Map();
export const SIGN_MATS = { lit: [], neon: [], none: [] };
export function signMaterial(text, style, w, h, fg, bg) {
  fg = pc(fg); bg = pc(bg); const key = [text, style, w, h, fg, bg].join('|'); let m = signCache.get(key); if (m) return m;
  const lines = String(text).split('\n'), maxw = Math.max(...lines.map(textWidth)), PX = Math.max(16, Math.ceil((maxw + 4) / w), Math.ceil((lines.length * 8 + 3) / h));   // square pixels; small signs get more of them
  const c = document.createElement('canvas'); c.width = Math.round(w * PX); c.height = Math.round(h * PX); const g = c.getContext('2d');
  const pad = style === 'letters' ? 1 : Math.max(2, Math.round(Math.min(c.width, c.height) * .12));
  const s = Math.max(1, Math.min(Math.floor((c.width - pad * 2) / maxw), Math.floor((c.height - pad * 2) / (lines.length * 8 - 1))));
  if (style !== 'letters' && style !== 'tag' && style !== 'chalk') { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  if (style === 'box' || style === 'billboard') { g.fillStyle = tint(bg, .7); g.fillRect(0, 0, c.width, s); g.fillRect(0, c.height - s, c.width, s); g.fillRect(0, 0, s, c.height); g.fillRect(c.width - s, 0, s, c.height); }
  if (style === 'neon') { g.fillStyle = tint(fg, .55); const b = Math.max(1, s >> 1); g.fillRect(b, b, c.width - 2 * b, b); g.fillRect(b, c.height - 2 * b, c.width - 2 * b, b); g.fillRect(b, b, b, c.height - 2 * b); g.fillRect(c.width - 2 * b, b, b, c.height - 2 * b); }
  if (style === 'tag') {   // spray paint: fat outline, fill, a highlight and drips (transparent background)
    lines.forEach((ln, i) => { const tw = textWidth(ln) * s, x = Math.round((c.width - tw) / 2), y = Math.round((c.height - (lines.length * 8 * s - s)) / 2) + i * 8 * s, o = Math.max(1, s >> 1);
      for (let dx = -o; dx <= o; dx += o) for (let dy = -o; dy <= o; dy += o) drawText(g, ln, x + dx, y + dy, '#111114', s);
      drawText(g, ln, x, y, fg, s); drawText(g, ln, x - Math.max(1, s >> 2), y - Math.max(1, s >> 2), 'rgba(255,255,255,.35)', Math.max(1, s >> 1));
      g.fillStyle = fg; for (let k = 0; k < ln.length; k++) if ((k * 7 + ln.charCodeAt(k)) % 3 === 0) g.fillRect(x + k * 6 * s + 2 * s, y + 7 * s, Math.max(1, s >> 1), s * (2 + (k % 3))); }); }
  else if (style === 'chalk') { g.strokeStyle = fg; g.lineWidth = Math.max(2, c.width / 40); const W = c.width, Hh = c.height, P2 = (x, y) => [x * W, y * Hh];
    const path = [[.5, .1], [.62, .14], [.64, .26], [.56, .32], [.78, .44], [.74, .5], [.56, .42], [.58, .62], [.72, .9], [.64, .92], [.5, .68], [.4, .92], [.32, .9], [.44, .62], [.44, .42], [.24, .52], [.2, .46], [.42, .32], [.36, .26], [.38, .14]];
    g.beginPath(); path.forEach((p, k) => (k ? g.lineTo : g.moveTo).call(g, ...P2(...p))); g.closePath(); g.stroke(); }
  else if (style === 'chart') {   // mugshot height chart: a line every half block, numbers every block (feet, from the floor)
    const u = c.height / (h * 2); g.fillStyle = fg; for (let k = 1; k < h * 2; k++) { const y = Math.round(c.height - k * u); g.fillRect(0, y, c.width, Math.max(1, s >> 1)); if (k % 2 === 0) drawText(g, String(k / 2 + 3) + "'", 2, y + 2, fg, 1); } }
  else if (style === 'cross') { const u = Math.min(c.width, c.height) / 5; g.fillStyle = fg; g.fillRect(c.width / 2 - u / 2, c.height / 2 - u * 1.6, u, u * 3.2); g.fillRect(c.width / 2 - u * 1.6, c.height / 2 - u / 2, u * 3.2, u); }
  else if (style !== 'tag' && style !== 'chalk') { const th = lines.length * 8 * s - s; lines.forEach((ln, i) => { const tw = textWidth(ln) * s, x = Math.round((c.width - tw) / 2), y = Math.round((c.height - th) / 2) + i * 8 * s;
    if (style === 'neon') { g.globalAlpha = .35; drawText(g, ln, x - 1, y, fg, s); drawText(g, ln, x + 1, y, fg, s); drawText(g, ln, x, y - 1, fg, s); drawText(g, ln, x, y + 1, fg, s); g.globalAlpha = 1; }
    if (style === 'letters' || style === 'paint') drawText(g, ln, x + Math.max(1, s >> 1), y + Math.max(1, s >> 1), 'rgba(0,0,0,.35)', s);
    drawText(g, ln, x, y, fg, s); }); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8;
  const cutout = style === 'letters' || style === 'tag' || style === 'chalk';
  m = new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0, alphaTest: cutout ? .5 : 0, transparent: false, polygonOffset: style === 'chalk', polygonOffsetFactor: -2 });
  m.userData.glow = style === 'neon' ? 'neon' : (style === 'box' || style === 'cross' || style === 'billboard' || style === 'letters') ? 'lit' : 'none'; SIGN_MATS[m.userData.glow].push(m);
  signCache.set(key, m); return m;
}
