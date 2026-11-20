// AI City · interiors · THE FINE PASS FOR KIT PIECES (2026-11-17). The traits' detail below the voxel (world/cast/fit/fine.js,
// world/fresh/README.md "Fine detail: below the voxel"), on the home and shop kits' pieces: the SAME painter, the same quarter and
// half coordinates, the same storage. Worker-safe (no three).
//
// A piece opts in with a `fine(P, opt)` function beside its `build` (FORMAT.md "Fine detail"). It runs right after build, on the
// finished voxels, with the traits' painter on the piece's own Vol:
//   P.paint(face, qa, qb, c) · P.rect(face, qa0, qb0, qa1, qb1, c) · P.bmp(face, rows, pal, qa, qb) · P.at(x, y, z, face, i, j, c)
//     paint: 4 × 4 texels on a voxel face, at quarter-voxel coordinates (qa = 4 × the face's first in-plane coordinate + i), on the
//     OUTERMOST voxel along that face's normal. '+z' is the piece's front (x, y), '+y' its top (x, z), '+x' its right side (z, y).
//   P.half(hx, hy, hz, c, l) · P.halfBox(hx0, hy0, hz0, hx1, hy1, hz1, c, l)
//     fine voxels: half-size cubes at 2 × voxel coordinates; each must touch a voxel (or a fine voxel that does), never inside one.
// opt is build's own ({ variant, seed, state }) plus V, the built Vol (read it to paint chosen voxels' faces: P.at, home/lib.js fsurf).
//
// WHERE IT SHOWS: every place that meshes a kit piece with vox.js meshVol (the kit previews, the city's rooms, the home builder, the
// game's inside view and its tiles) draws the paint as texels and the fine voxels as half cubes, in the near mesh. The far tier (0.1 m,
// farOf) folds each painted voxel to the mean of its painted faces and leaves the fine voxels out: the average, as the traits do at a
// distance. FINE.on = false builds every piece without its pass (the A/B, and the cost measure in home/fine-check.mjs).
//
// THE BUDGET, per piece and per variant and state (home/fine-check.mjs gates on it): at most FINE.faces painted faces and FINE.voxels
// fine voxels. Twice a trait's (64 and 32): a piece is two to ten times a trait's size, and a painted face costs at most 16 quads
// (same-colour texels merge; a face is 2 to 6 quads in practice), so a piece at the budget adds at most ~4,000 triangles.
import { painter, faceAverage, vkd, VIEW, faceIndex } from '../../../world/cast/fit/fine.js';
import { textMask } from '../vox.js';
import { mask3 } from '../simassets/lib.js';

export const FINE = { on: true, faces: 192, voxels: 64 };
const NB = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// run a piece's fine pass on its built Vol → V.fineLog { faces, texels, voxels, miss, buried } (null: no pass)
export function fineOf(o, V, opt = {}) {
  if (!o || typeof o.fine !== 'function' || !FINE.on || !V) return null;
  V.fp = new Map(); V.hv = new Map();
  const log = {};
  o.fine(painter([V], o.id, log), { ...opt, V });
  const st = log[o.id];
  V.fineLog = st ? { faces: st.faces.size, texels: st.texels, voxels: st.voxels, miss: st.miss, buried: st.buried } : { faces: 0, texels: 0, voxels: 0, miss: 0, buried: 0 };
  return V.fineLog;
}
// the far tier's fallback: each painted voxel takes the mean of the faces that show (faceAverage, the traits' mid and far colour);
// the fine voxels are dropped (a 0.025 m cube is gone at 0.1 m)
export function foldFine(V) {
  if (!V || !V.fp || !V.fp.size) { if (V) { V.fp = null; V.hv = null; } return V; }
  const fold = [];
  for (const [k, arr] of V.fp) {
    const [x, y, z] = vkd(k); if (!V.has(x, y, z)) continue;
    const c = V.d[x + z * V.nx + y * V.sxz], base = V.pal[c]; let r = 0, g = 0, b = 0, n = 0;
    for (let f = 0; f < 6; f++) { const e = arr[f]; if (!e) continue; const [dx, dy, dz] = NB[f]; if (V.has(x + dx, y + dy, z + dz)) continue;
      const m = faceAverage(e, base); r += (m >> 16) & 255; g += (m >> 8) & 255; b += m & 255; n++; }
    if (n) fold.push([x, y, z, (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n), V.lay[c]]);
  }
  V.fp = null; V.hv = null;
  for (const [x, y, z, c, l] of fold) V.set(x, y, z, c, l);
  return V;
}

// ── GOLD (third art pass, 2026-11-18). The metal layer (2) mirrors the sky: the city lights every PBR material with a PMREM of its
// day dome (render/lighting.js), the game's tiles with a blue sky gradient (the icon baker's), and a metal tints that reflection
// with its own colour. Gold × a blue sky comes out olive green, in the shop's pictures and in the rooms alike (chrome × blue sky is
// still silver, so the greys are right). Gold, brass and gilt (a warm, saturated colour on the metal layer: hue 30° to 60°,
// saturation at least 0.4) are therefore drawn with the GLOSS shading (layer 1), lit by the warm sun, and keep their colour.
// Nothing else changes: every other colour on every layer, every grey metal, every piece without gilt builds exactly as before.
// Both kits' buildObject run it last (near and far, after the fine pass: fine voxels in gilt move too).
export function isGilt(c) {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx < 90 || mx - mn < .4 * mx || mx !== r) return false;
  const h = 60 * (g - b) / (mx - mn); return h >= 30 && h <= 60;
}
export function gild(V) {
  if (!V) return V;
  for (let k = 1; k < V.pal.length; k++) if (V.lay[k] === 2 && isGilt(V.pal[k])) { V.pm.delete(V.pal[k] * 4 + 2); V.lay[k] = 1; if (!V.pm.has(V.pal[k] * 4 + 1)) V.pm.set(V.pal[k] * 4 + 1, k); }
  if (V.hv) for (const v of V.hv.values()) if (v[1] === 2 && isGilt(v[0])) v[1] = 1;
  return V;
}

// ── FINE-PASS HELPERS (a piece's fine(P, opt): ../fine.js). The painter works in quarter-voxel texels on faces and in half voxels;
// these take VOXEL units, so a fine pass reads like its build (the home kit re-exports them from home/lib.js). Faces: '+z' front (a = x, b = y) · '+y' top (x, z) · '+x' right (z, y).
// a rectangle of texels, a0..a1 × b0..b1 in voxels (quarters allowed: 2.25); c may be (qa, qb) => colour
export const frect = (P, face, a0, b0, a1, b1, c) => P.rect(face, Math.round(a0 * 4), Math.round(b0 * 4), Math.round(a1 * 4), Math.round(b1 * 4), c);
// a disc of texels, centre (ca, cb) and radius r in voxels; c is a colour or (d, th, qa, qb) => colour | null (d in voxels, th radians)
export function fdisc(P, face, ca, cb, r, c) {
  for (let qa = Math.floor((ca - r) * 4); qa < Math.ceil((ca + r) * 4); qa++) for (let qb = Math.floor((cb - r) * 4); qb < Math.ceil((cb + r) * 4); qb++) {
    const da = (qa + .5) / 4 - ca, db = (qb + .5) / 4 - cb, d = Math.hypot(da, db); if (d > r) continue;
    const v = typeof c === 'function' ? c(d, Math.atan2(db, da), qa, qb) : c; if (v !== undefined && v !== null) P.paint(face, qa, qb, v); }
}
// a one-texel stroke from (a0, b0) to (a1, b1), in voxels
export function fline(P, face, a0, b0, a1, b1, c) {
  const A0 = a0 * 4, B0 = b0 * 4, A1 = a1 * 4, B1 = b1 * 4, n = Math.max(1, Math.ceil(Math.max(Math.abs(A1 - A0), Math.abs(B1 - B0))));
  for (let k = 0; k <= n; k++) P.paint(face, Math.floor(A0 + (A1 - A0) * k / n), Math.floor(B0 + (B1 - B0) * k / n), c);
}
// small print in texels (3×5 or vox.js's 5×7, one texel a pixel), read from outside the face; (a, bTop) the top-left corner in voxels
export function ftxt(P, face, s, a, bTop, c, font = 3) {
  const M = font === 5 ? textMask(s) : mask3(s), rows = [];
  for (let j = 0; j < M.h; j++) { let r = ''; for (let i = 0; i < M.w; i++) r += M.at(i, j) ? '#' : '.'; rows.push(r); }
  const [va, vb] = VIEW[faceIndex(face)];
  P.bmp(face, rows, { '#': c }, Math.round(a * 4) - (va < 0 ? 1 : 0), Math.round(bTop * 4) - (vb < 0 ? 1 : 0)); return M.w / 4;
}
// the faces that show on one side of the voxels in a box (voxel coords, half-open), each texel c(x, y, z, i, j) → colour | null, i along
// the face's first in-plane axis and j along its second (fine.js PLANE: '+z' x, y · '+x' z, y · '+y' x, z), both counting up the world axis
export function fsurf(P, V, face, x0, y0, z0, x1, y1, z1, c) {
  const f = faceIndex(face), [dx, dy, dz] = NB[f];
  for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) { if (!V.has(x, y, z) || V.has(x + dx, y + dy, z + dz)) continue;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const v = c(x, y, z, i, j); if (v !== undefined && v !== null) P.at(x, y, z, f, i, j, v); } }
}
// a PRINT on something round (a can's label), seen from the front: every texel of the faces that show toward +z, and of the +x faces where
// the round steps back, takes the colour fn(X, Y) of the point straight in front of it (X, Y in voxels on the front plane; null: leave it),
// so a word or a sign reads whole across the steps. Rows y0..y1 (voxels), the whole width
export function fprint(P, V, y0, y1, fn) {
  fsurf(P, V, '+z', 0, y0, 0, V.nx, y1, V.nz, (x, y, z, i, j) => fn(x + (i + .5) / 4, y + (j + .5) / 4));
  fsurf(P, V, '+x', 0, y0, 0, V.nx, y1, V.nz, (x, y, z, i, j) => fn(x + .9, y + (j + .5) / 4));
}
// a mask's ink at a point of a print (fprint): the 3 × 5 letters of s, each pixel px voxels, the top-left corner at (x0, yTop)
export function inkOf(s, x0, yTop, px = .25) { const M = mask3(s); return (X, Y) => { const i = Math.floor((X - x0) / px), j = Math.floor((yTop - Y) / px); return i >= 0 && j >= 0 && i < M.w && j < M.h && M.at(i, j); }; }
// a box of fine voxels, in voxels (x0 1.5 → half 3): halves 2·x0 … 2·x1
export const hbox = (P, x0, y0, z0, x1, y1, z1, c, l = 0) => P.halfBox(Math.round(x0 * 2), Math.round(y0 * 2), Math.round(z0 * 2), Math.round(x1 * 2), Math.round(y1 * 2), Math.round(z1 * 2), c, l);
// every voxel of one colour (palette colour c; in a box x0..x1 × y0..y1 × z0..z1 when given), on each listed face that shows:
// fn(x, y, z, face, i, j) → colour | null for each texel (i, j as fsurf). For a whole material at once: cash, glass, a board
export function fcolour(P, V, c, faces, fn, box = null) {
  const [x0, y0, z0, x1, y1, z1] = box ?? [0, 0, 0, V.nx, V.ny, V.nz], fs = faces.map(faceIndex);
  for (let y = Math.max(0, y0); y < Math.min(V.ny, y1); y++) for (let z = Math.max(0, z0); z < Math.min(V.nz, z1); z++) for (let x = Math.max(0, x0); x < Math.min(V.nx, x1); x++) {
    const v = V.d[x + z * V.nx + y * V.sxz]; if (!v || V.pal[v] !== c) continue;
    for (const f of fs) { const [dx, dy, dz] = NB[f]; if (V.has(x + dx, y + dy, z + dz) || (dy < 0 && y === 0 && V.ground)) continue;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const t = fn(x, y, z, FACES_[f], i, j); if (t !== undefined && t !== null) P.at(x, y, z, f, i, j, t); } } }
}
const FACES_ = ['+x', '-x', '+y', '-y', '+z', '-z'];
// a stack of notes: the sides show the paper edges (light and dark lines), the top a note's face (a lighter border, a darker middle)
export const BILL = { c: 0x5cb85c, d: 0x3f8f45, l: 0x8fd88a, p: 0xd8f0c8 };
export const billTex = (x, y, z, f, i, j) => f === '+y' ? ((i === 0 || i === 3 || j === 0 || j === 3) ? null : ((x + z) & 1) ? BILL.d : BILL.l) : (j % 2 ? BILL.p : BILL.d);
