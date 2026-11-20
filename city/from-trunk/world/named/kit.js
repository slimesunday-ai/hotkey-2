// THE NAMED CAST · the kit: the only import a person's file (world/named/people/<key>.js) has. It re-exports the registry's
// construction helpers (world/cast/fresh/kit.js) and the NPC kit's copies of the agent files' builders (world/cast/fresh/npc/kit.js:
// the top shell and THE SLEEVE RULE, the hair builder that never lets a strand float, the hat solids, the grip helpers), and adds the
// few helpers the named cast shares: patterns (a check, a tweed fleck, two tones), the ageing marks of a face, a beard that hangs
// below the chin, a long coat carried on over the legs, a two-tone shoe. Nothing here draws a person: each person's file does.
// The pool's rules: index.js.
import { shade, lerpHex, hash3 } from '../cast/fresh/kit.js';
import { inHand } from '../cast/fit/held.js';
export { shade, lerpHex, hash3, mulberry32, line, strand, MOUTH, LOBE, HOLD, POSES, ENVELOPE, gripCells, channelOf, mirror } from '../cast/fresh/kit.js';
export { shell, sleeves, hem, vee, collarWings, ARM, hair, hairline, hairShell, at, inHead, inFoot, solid, rowsOf, ring, bx, grip, hangers, RING2, sq3, plus } from '../cast/fresh/npc/kit.js';

// a mirror-symmetric hash in [0, 1): x and −1 − x are a mirror pair (the head's centre is between x −1 and 0)
export const sym = x => x < 0 ? -1 - x : x;
export const rnd = (x, y, z, s = 0) => hash3(sym(x) + s * 131, y, z) / 4294967296;
// colour patterns: (x, y, z) → colour
export const two = (c, k = .9, p = .3, s = 3) => (x, y, z) => rnd(x, y, z, s) < p ? shade(c, k) : c;
export const fleck = (c, f, p = .18) => (x, y, z) => { const r = hash3(x, y, z) / 4294967296; return r < p ? f : r < p * 2 ? shade(c, .9) : c; };
// a woven check on two in-plane coordinates (u, v): a and b alternate in 2-wide bands, d where both bands cross
export const check = (a, b, d, w = 2) => (u, v) => { const bu = Math.floor(u / w) & 1, bv = Math.floor(v / w) & 1; return bu && bv ? d : bu || bv ? a : b; };
// the front placket of a buttoned top (z the shell's front, x −1..0)
export const FRONT = 3;
export const placket = (x, z, front = FRONT) => z >= front && (x === -1 || x === 0);

// ── a skin: one ordinary tone with the brows of the person's age and colouring (and lashes, lips where they have them)
export const skin = (name, c, brow, o = {}) => ({ name, c, brow, ...o });

// ── the face's age (eyes fx(F, ctx): voxels added to the face grid, mirrored on both sides)
const shadeAt = (ctx, x, y, z, k) => ctx.shade(ctx.sk.c(x, y, z), k);
export const both = fn => (F, ctx) => { for (const s of [0, 1]) fn(F, ctx, x => s ? -1 - x : x); };
// bags under the eyes (a row of shade under each eye; z 8 makes them puffy, one proud)
export const bags = (k = .82, { xs = [-6, -5, -4], y = 23, z = 7 } = {}) => both((F, ctx, m) => { for (const x of xs) F.set(m(x), y, z, shadeAt(ctx, m(x), y, z, k), ctx.sk.layer); });
// crow's feet at the outer corners
export const crows = (k = .8, ys = [23, 25]) => both((F, ctx, m) => { for (const y of ys) F.set(m(-8), y, 7, shadeAt(ctx, m(-8), y, 7, k), ctx.sk.layer); });
// dark circles (a bruise-blue tint under the eyes)
export const circles = (y = 23, t = .4) => both((F, ctx, m) => { for (const x of [-7, -6, -5, -4, -3]) F.set(m(x), y, 7, lerpHex(ctx.sk.c(m(x), y, 7), 0x4a3442, t), ctx.sk.layer); });
// lines from the nose to the mouth's corners (age): two short diagonal runs of shade
export const folds = (k = .84) => both((F, ctx, m) => { for (const [x, y] of [[-3, 22], [-4, 21]]) F.set(m(x), y, 7, shadeAt(ctx, m(x), y, 7, k), ctx.sk.layer); });
// a furrowed brow (one line of shade over the nose, between the brows)
export const furrow = (k = .82) => (F, ctx) => { for (const x of [-1, 0]) F.set(x, 28, 7, shadeAt(ctx, x, 28, 7, k), ctx.sk.layer); };
export const allFx = (...fx) => (F, ctx) => { for (const f of fx) if (f) f(F, ctx); };

// ── a mouth line on the face plane, in the skin's own mouth colour
export const lipTone = (ctx, x, y) => lerpHex(ctx.sk.c(x, y, 7), ctx.sk.mouth ?? 0x4a2a26, .55);
export const mouthLine = (H, ctx, y = 20, x0 = -2, x1 = 1) => { for (let x = x0; x <= x1; x++) H.set(x, y, 7, lipTone(ctx, x, y), ctx.sk.layer || 0); };
// lips in a colour (lipstick): the upper lip one shade darker
export const lips = (H, L, { y = 20, x0 = -2, x1 = 1, k = .8 } = {}) => { for (let x = x0; x <= x1; x++) { H.set(x, y + 1, 7, L); H.set(x, y, 7, shade(L, k)); } };

// ── A BEARD THAT HANGS (the named cast's one addition to the face's rules). A mouth piece keeps
// to the mouth zone (y 19..21) on the registry's faces; a named man's beard may also hang below the chin, riding the head as the chin
// does: rows y lo..18, never behind z 4 (the top's collar stands at z ≤ 4), never wider than the jaw (x −8..7). paint(x, y, z) → colour.
// cells(x, y) → [z0, z1] for that column (null: none). Every cell is joined to the chin (no floating hair).
export const BEARD_Z = 4;
export function beardBelow(H, lo, cells, paint, l = 0) {
  for (let y = 18; y >= lo; y--) for (let x = -8; x <= 7; x++) { const r = cells(x, y); if (!r) continue;
    for (let z = Math.max(BEARD_Z, r[0]); z <= r[1]; z++) H.set(x, y, z, paint(x, y, z), l); }
}

// ── stubble, or a beard's shadow, on the lower face and the jaw's sides (face ink: a recolour, no relief). tint: the hair's colour,
// k: how far toward it, p: how many cells
export const stubble = (name, tint, k = .22, p = .45, seed = 4) => ({ name, draw(H, ctx) {
  for (let x = -8; x <= 7; x++) for (let y = 19; y <= 22; y++) for (let z = 1; z <= 7; z++) {
    const face = z === 7, side = (x === -8 || x === 7) && z <= 6; if (!face && !side) continue;
    if (face && y >= 20 && x >= -3 && x <= 2) continue; if (!H.has(x, y, z) || rnd(x, y, z, seed) > p) continue;
    H.set(x, y, z, lerpHex(ctx.sk.c(x, y, z), tint, k), ctx.sk.layer || 0); } } });

// ── a belly or a barrel chest: cells one proud of a top's front on the given rows ({ y: [x0, x1] }), at z (the shell's front + 1).
// A top that bulges is registered puffy (padded structure: two proud).
export function bulge(B, rows, z, c) { for (const [ys, [x0, x1]] of Object.entries(rows)) { const y = +ys; for (let x = x0; x <= x1; x++) B.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c); } }

// ── a knit cap: a cuff rolled at the bottom (rows y0..y0+1, one out), a crown above it; f the crown's footprint [x0, x1, z0, z1, c]
export function knit(H, y0, f, top, c, cuff, rib = true) {
  const [x0, x1, z0, z1, ch] = f, put = (x, y, z, col) => H.set(x, y, z, typeof col === 'function' ? col(x, y, z) : col);
  for (let y = y0; y <= y0 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0 - 1; z <= z1 + 1; z++) { const dx = Math.min(x - x0 + 1, x1 + 1 - x), dz = Math.min(z - z0 + 1, z1 + 1 - z);
    if (dx >= 0 && dz >= 0 && dx + dz >= ch) put(x, y, z, rib && (x + z) & 1 ? shade(typeof cuff === 'function' ? cuff(x, y, z) : cuff, .9) : cuff); }
  for (let y = y0 + 2; y <= top; y++) { const k = Math.max(0, y - top + 2); for (let x = x0 + k; x <= x1 - k; x++) for (let z = z0 + k; z <= z1 - k; z++) { const dx = Math.min(x - x0 - k, x1 - k - x), dz = Math.min(z - z0 - k, z1 - k - z);
    if (dx + dz >= ch) put(x, y, z, rib && (x & 1) ? shade(typeof c === 'function' ? c(x, y, z) : c, .92) : c); } }
}

// ── a long coat carried on over the legs (a bottom's paint: the coat's colour from row `from` up, the trousers below)
export const coatOver = (coat, pants, from) => q => q.y >= from ? (typeof coat === 'function' ? coat(q.x, q.y, q.z) : coat) : (typeof pants === 'function' ? pants(q) : pants);

// ── HELD: the fist owns its box (world/cast/fit/held.js HAND, either hand) except the channel the thing passes through. free(ctx,
// x, y, z): may a held piece put a voxel here? hbox: an inclusive box of a held piece, leaving out the fist's cells (the thing reads as
// gripped: the fist is drawn over the gap).
export const free = (ctx, x, y, z) => !inHand(x, y, z) || ctx.grip.cells.some(([a, b, c]) => a === x && b === y && c === z);
export function hbox(G, ctx, x0, x1, y0, y1, z0, z1, c, l = 0) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (free(ctx, x, y, z)) G.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }

// ── a shoe painted in two colours on an approved last: the upper, and the sole (sole and outsole), the midsole a touch lighter
export const twoTone = (upper, sole, l = 0) => q => q.region === 'sole' || q.region === 'outsole' ? [sole, 0] : q.region === 'midsole' ? [shade(sole, 1.1), 0] : [upper, l];
