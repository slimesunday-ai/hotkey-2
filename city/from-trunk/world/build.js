// AI CITY world v2 — structures. Blueprint houses (the format agents emit), towers, civic buildings,
// compounds (hospital, jail, junkyard, trailer park), industry, docks, the highway strip, forest, street furniture.
import { B, MAT, LEGACY_MAT, mulberry32 } from './tiles.js';
import { P, G, WATER, RG, hash3, fbm, sstep, mod, kindAt, distOf, urban, interior, compoundInterior, compoundAt, segX, segZ, hwX, hwZ, aveX, aveZ, HWY,
  column, urbanDist, put, prop, sign, lamp, hollow, flushCars, frame, landDist, clearArea, lotFrame, LOTS, TRAILER } from './city.js';
import { CAR_COLS } from './props.js';
import { NAMES } from './names.js';
const SN = NAMES.sign;

const rng = (...a) => mulberry32(a.reduce((h, v, i) => Math.imul(h ^ ((v | 0) + i * 0x9E3779B1), 0x85EBCA77) >>> 0, 0x51CE) >>> 0);
const pick = (r, a) => a[r() * a.length | 0];
function box(x0, y0, z0, x1, y1, z1, id) { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) put(x, y, z, typeof id === 'function' ? id(x, y, z) : id); }
function ring(x0, z0, x1, z1, y, id) { for (let x = x0; x < x1; x++) { put(x, y, z0, id); put(x, y, z1 - 1, id); } for (let z = z0; z < z1; z++) { put(x0, y, z, id); put(x1 - 1, y, z, id); } }
const ground = (x0, z0, x1, z1, id) => box(x0, G - 1, z0, x1, G, z1, id);
const lit = (x, y, z, p = .42) => hash3(x, y * 7 + 3, z) < p;
export const CLAIMED = new Set();

// ───────────────────────── frame helpers (u along the front, v toward the front; front row v = D − 1)
const DIRV = [[0, 1], [1, 0], [0, -1], [-1, 0]];
function fput(F, u, v, y, id) { const [x, z] = F.at(u, v); put(x, y, z, id); }
function fprop(F, type, u, v, y = G, r = 0) { const [x, z] = F.at(u, v); prop(type, x + .5, y, z + .5, (F.rot + r) % 4); }
function fsign(F, u, v, y, w, h, text, style, fg, bg, depth = .53) { const [x, z] = F.at(u, v), d = DIRV[F.rot]; sign(x + .5 + d[0] * depth, y, z + .5 + d[1] * depth, F.rot, w, h, text, style, fg, bg); }
const paneAlongU = (F, name) => B[name + (F.alongX ? 'X' : 'Z')], paneAlongV = (F, name) => B[name + (F.alongX ? 'Z' : 'X')];
function sideSign(x, y, z, n, w, h, text, style, fg, bg) { const d = DIRV[n]; sign(x + .5 + d[0] * .53, y, z + .5 + d[1] * .53, n, w, h, text, style, fg, bg); }   // on the n-face of block (x, z)

// ───────────────────────── trees
export function tree(x, G0, z, r, kind = 'oak') {
  if (kind === 'pine') { const h = 7 + (r() * 5 | 0); for (let y = G0; y < G0 + h; y++) put(x, y, z, B.BARK);
    for (let k = 0; k < h - 2; k++) { const y = G0 + 2 + k, rad = (h - 2 - k) * .42 + .6; if (k % 3 === 2 && rad > 1.4) continue;
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (Math.hypot(dx, dz) <= rad && (dx || dz || y >= G0 + h)) put(x + dx, y, z + dz, B.PINE); } put(x, G0 + h, z, B.PINE); return; }
  const small = kind === 'street', h = small ? 3 : 4 + (r() * 3 | 0), leaf = kind === 'yellow' ? B.LEAVESY : kind === 'orange' ? B.LEAVESO : B.LEAVES;
  for (let y = G0; y < G0 + h; y++) put(x, y, z, B.BARK);
  const Rr = small ? 1.6 : 2.2 + r() * 1.1, cy = G0 + h;
  for (let dx = -3; dx <= 3; dx++) for (let dy = -2; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) { if (Math.hypot(dx, dy * 1.25, dz) > Rr) continue; if (!dx && !dz && dy < 0) continue; put(x + dx, cy + dy, z + dz, leaf); }
}
const bush = (x, z, id = B.HEDGE) => put(x, G, z, id);

// ───────────────────────── blueprint houses: {kind, w, d, floors, wall, roof, roofCol, extra} (the format agents emit)
const ROOFCOL = { dark: B.SHD, brown: B.SHB, red: B.SHR, green: B.SHG, blue: B.SHU, terracotta: B.SHT };
export function normBlueprint(bp) {
  const wall = MAT[bp.wall] ? bp.wall : LEGACY_MAT[bp.wall] || (MAT[bp.material] ? bp.material : LEGACY_MAT[bp.material]) || 'vinyl';
  const roof = bp.roof === 'title' ? 'hip' : ['gable', 'hip', 'flat'].includes(bp.roof) ? bp.roof : 'gable';
  return { ...bp, wall, roof, floors: Math.max(1, Math.min(4, bp.floors | 0 || 1)), w: Math.max(4, Math.min(16, bp.w | 0 || 7)), d: Math.max(4, Math.min(14, bp.d | 0 || 6)) };
}
export function house(F, hu, hv, bp0, G0 = G) {
  const bp = normBlueprint(bp0), m = MAT[bp.wall], { w, d } = bp, FH = 3, Ht = bp.floors * FH, top = G0 + Ht, sh = ROOFCOL[bp.roofCol] || bp.roofId || B.SHD;
  const trim = m.trim === B.CAP ? m.wall : m.trim, doorCol = hash3(hu, 5, hv + w) < .33 ? [B.DOORLOR, B.DOORHIR] : hash3(hu, 6, hv) < .5 ? [B.DOORLOB, B.DOORHIB] : [B.DOORLO, B.DOORHI];
  const du = hu + (w >> 1), dv = hv + d - 1;
  for (let y = G0; y < top; y++) { const ly = (y - G0) % FH, fl = Math.floor((y - G0) / FH);
    for (let u = hu; u < hu + w; u++) for (let v = hv; v < hv + d; v++) {
      const eu = u === hu || u === hu + w - 1, ev = v === hv || v === hv + d - 1; if (!eu && !ev) continue;
      const corner = eu && ev, along = ev ? u - hu : v - hv, [x, z] = F.at(u, v); let id = m.wall;
      if (m.modern) id = corner ? trim : ly === 0 ? trim : m.win[lit(x, fl, z, .5) ? 1 : 0];
      else if (corner) id = trim; else if (ly === 1 && along % 3 === 1) id = m.win[lit(x, fl, z) ? 1 : 0];
      if (bp.boarded && (id === m.win[0] || id === m.win[1])) id = B.WINBOARD;
      if (bp.burned) { if (y > G0 + 1 && hash3(x, y, z) < .12 + (y - G0) * .06) continue; id = id === m.win[0] || id === m.win[1] ? B.CHARWIN : hash3(x, y + 9, z) < .7 ? B.CHAR : id; }
      put(x, y, z, id); } }
  { const [ax, az] = F.at(hu + 1, hv + 1), [bx, bz] = F.at(hu + w - 2, hv + d - 2); hollow(Math.min(ax, bx), G0, Math.min(az, bz), Math.max(ax, bx) + 1, top + (bp.roof === 'flat' || m.modern ? 0 : 1), Math.max(az, bz) + 1); }
  fput(F, du, dv, G0, bp.burned ? B.CHARWIN : m.modern ? B.GDOORLO : doorCol[0]); fput(F, du, dv, G0 + 1, bp.burned || bp.boarded ? B.WINBOARD : m.modern ? B.GDOORHI : doorCol[1]);
  fput(F, du, dv + 1, G0 - 1, B.CONC);
  if (bp.extra === 'porch' || bp.extra === 'counter') { for (let u = hu - 1; u <= hu + w; u++) { fput(F, u, dv + 1, G0 + 2, sh); fput(F, u, dv + 2, G0 + 2, sh); fput(F, u, dv + 1, G0 - 1, B.PLANKS); fput(F, u, dv + 2, G0 - 1, B.PLANKS); }
    for (const u of [hu, hu + w - 1]) for (let y = G0; y < G0 + 2; y++) fput(F, u, dv + 2, y, B.TRIMW); }
  else if (!m.modern && bp.roof !== 'flat' && !bp.burned) for (let u = du - 1; u <= du + 1; u++) fput(F, u, dv + 1, G0 + 2, sh);
  // roof
  let peak = top; const roofPut = (u, v, y, id) => { if (bp.burned) { const [x, z] = F.at(u, v); if (hash3(x, y * 3, z) < .6) return; id = B.CHAR; } fput(F, u, v, y, id); };
  if (bp.roof === 'flat' || m.modern) { for (let u = hu; u < hu + w; u++) for (let v = hv; v < hv + d; v++) roofPut(u, v, top, B.TAR);
    for (let u = hu; u < hu + w; u++) for (let v = hv; v < hv + d; v++) if (u === hu || v === hv || u === hu + w - 1 || v === hv + d - 1) fput(F, u, v, top + 1, m.modern ? B.CONC : B.CAP);
    if (!bp.burned) fprop(F, 'ac', hu + 2, hv + 2, top + 1); peak = top + 1; }
  else if (bp.roof === 'hip') { const S = d, L = w;   // 2:1 pitch: each layer steps in by two
    for (let k = 0; ; k++) { const a = 2 * k - 1, b = S - 2 * k, a2 = 2 * k - 1, b2 = L - 2 * k; if (a > b || a2 > b2) break; peak = top + k;
      for (let s = a; s <= b; s++) for (let l = a2; l <= b2; l++) if (s <= a + 1 || s >= b - 1 || l <= a2 + 1 || l >= b2 - 1) roofPut(hu + l, hv + s, top + k, sh); } }
  else { const alongU = w >= d, S = alongU ? d : w, L = alongU ? w : d, at = (s, l) => (alongU ? [hu + l, hv + s] : [hu + s, hv + l]);
    for (let k = 0; ; k++) { const a = 2 * k - 1, b = S - 2 * k; if (a > b) break; const y = top + k; peak = y;
      for (let l = -1; l <= L; l++) for (let s = a; s <= b; s++) if (s <= a + 1 || s >= b - 1) roofPut(...at(s, l), y, sh);
      for (let s = a + 2; s <= b - 2; s++) { fput(F, ...at(s, 0), y, m.wall); fput(F, ...at(s, L - 1), y, m.wall); } }
    if (!bp.burned && hash3(hu, 9, hv) < .55) for (let y = top; y <= peak + 1; y++) fput(F, ...at(Math.max(1, S - 3), 1), y, B.BRICKRED); }
  if (bp.extra === 'antenna' && !bp.burned) fprop(F, 'antenna', hu + (w >> 1), hv + (d >> 1), peak + 1);
  if (bp.extra === 'crt' || bp.extra === 'dish') fprop(F, 'dish', hu + w - 2, dv + .5, G0 + Ht - 2);
  return { peak };
}

// suburban lot: house + yard + driveway + fence + trees + mailbox
const SUB_WALLS = ['vinyl', 'vinyl', 'wood', 'wood', 'blue', 'yellow', 'mint', 'pink', 'slate', 'teal', 'brick', 'brick', 'whitebrick', 'stucco', 'tanbrick', 'barn'];
function randomHouse(r, maxW, maxD, rich) {
  const floors = rich ? 2 + (r() < .4 ? 1 : 0) : 1 + (r() < .45 ? 1 : 0) + (r() < .06 ? 1 : 0);
  return { kind: 'house', w: Math.min(maxW, (rich ? 11 : 6) + (r() * 4 | 0)), d: Math.min(maxD, (rich ? 7 : 6) + (r() * 2 | 0)), floors,
    wall: rich ? pick(r, ['stone', 'brick', 'whitebrick', 'marble', 'stucco', 'glass']) : pick(r, SUB_WALLS), roof: pick(r, ['gable', 'gable', 'gable', 'hip', 'hip', 'flat']),
    roofCol: pick(r, ['dark', 'dark', 'brown', 'red', 'green', 'blue', 'terracotta']), extra: pick(r, ['none', 'none', 'porch', 'antenna', 'dish', 'porch']) };
}
export function buildLot(l, bp = null, opts = {}) {
  l.lastBuild = { bp, opts }; const sc = l.scars || {};
  const F = lotFrame(l), r = rng(l.x0, l.z0, 7), W = F.W, D = F.D;
  if (sc.foreclosed) { fprop(F, 'forsale', W >> 1, D - 2); fsign(F, W >> 1, D - 2, G + 1.1, 1.1, .45, 'FORECLOSED', 'paint', '#c0392f', '#f1efe9', .15); lotTags(l, F, null); return; }
  if (l.kind === 'trailer') return trailerPad(l, F, r, bp, opts);
  const rich = l.kind === 'estate';
  if (!bp && opts.claimed) { fprop(F, 'forsale', W >> 1, D - 2); fsign(F, W >> 1, D - 2, G + 1.1, 1.1, .45, 'SOLD', 'paint', '#c0392f', '#f1efe9', .15); lotTags(l, F, null); return; }
  if (!bp && !rich && r() < .07) { fprop(F, 'forsale', W >> 1, D - 2); fsign(F, W >> 1, D - 2, G + 1.1, 1.1, .45, 'FOR SALE', 'paint', '#c0392f', '#f1efe9', .15); tree(F.at(2, 3)[0], G, F.at(2, 3)[1], r); return; }
  const drive = r() < .5 ? 0 : 1, dw = rich ? 4 : 3, maxW = W - dw - 2, maxD = D - 4;
  const b = bp ? normBlueprint({ ...bp, w: Math.min(bp.w || 7, maxW), d: Math.min(bp.d || 6, maxD) }) : randomHouse(r, maxW, maxD, rich);
  b.w = Math.min(b.w, maxW); b.d = Math.min(b.d, maxD);
  const hu = drive === 0 ? dw + 1 + ((maxW - b.w) >> 1) : 1 + ((maxW - b.w) >> 1), hv = D - 3 - b.d;
  b.burned = !!sc.burned; b.boarded = !!sc.boarded; house(F, hu, hv, b);
  lotTags(l, F, { hu, hv, w: b.w, d: b.d });
  if (sc.burned) { for (let u = hu - 2; u < hu + b.w + 2; u++) for (let v = hv - 2; v < hv + b.d + 2; v++) if (u >= 0 && u < W && v >= 0 && v < D && hash3(u, 4, v) < .8) fput(F, u, v, G - 1, B.ASH);
    for (let u = 0; u < W; u++) fput(F, u, D - 1, G, paneAlongU(F, 'TAPE')); }
  const du = hu + (b.w >> 1); for (let v = hv + b.d; v < D; v++) fput(F, du, v, G - 1, B.WALK);
  const d0 = drive === 0 ? 0 : W - dw; for (let u = d0; u < d0 + dw - 1; u++) for (let v = hv; v < D; v++) fput(F, u, v, G - 1, B.CONC);
  if (r() < .7 || opts.car) fprop(F, 'car:' + pick(r, ['sedan', 'sedan', 'hatch', 'pickup', 'van']) + ':' + pick(r, CAR_COLS), d0 + (dw - 1) / 2 - .5, hv + 3.5, G, r() < .5 ? 0 : 2);
  fprop(F, 'mailbox:' + pick(r, [0x2b2d31, 0xf1efe9, 0xc0392f, 0x2f5b9a]), drive === 0 ? dw : W - dw - 1, D - 1, G, 0);
  const fence = pick(r, rich ? ['WFENCE', 'hedge'] : ['PICKET', 'PICKET', 'CHAIN', 'WFENCE', 'none', 'hedge']);
  if (fence === 'hedge') { for (let u = 0; u < W; u++) if (r() < .9) fput(F, u, 0, G, B.HEDGE); }
  else if (fence !== 'none') { for (let u = 0; u < W; u++) fput(F, u, 0, G, paneAlongU(F, fence)); for (let v = 1; v < hv; v++) { fput(F, 0, v, G, paneAlongV(F, fence)); fput(F, W - 1, v, G, paneAlongV(F, fence)); } }
  const tu = drive === 0 ? W - 2 : 1; if (r() < .8) { const [x, z] = F.at(tu, D - 2); tree(x, G, z, r, pick(r, ['oak', 'oak', 'yellow', 'orange'])); }
  if (r() < .5 && hv > 3) { const [x, z] = F.at(r() < .5 ? 2 : W - 3, 1); tree(x, G, z, r); }
  for (let u = hu; u < hu + b.w; u++) if (u !== du && r() < .6) fput(F, u, hv + b.d, G, B.HEDGE);
  if (rich && hv >= 4) { const pu = drive === 0 ? hu + 1 : hu + 1; for (let u = pu; u < pu + 6 && u < W - 1; u++) for (let v = 1; v < 4; v++) { const edge = u === pu || u === pu + 5 || v === 1 || v === 3; fput(F, u, v, G - 1, edge ? B.POOLTILE : B.POOL); } }
  if (r() < .2) fprop(F, pick(r, ['grill', 'chair:3843872', 'flamingo']), drive === 0 ? W - 3 : 3, 2);
}

// ───────────────────────── trailer park
const TRAILER_WALLS = [B.TRAILERW, B.TRAILERW, B.TRAILERY, B.TRAILERB, B.TRAILERG, B.TRAILERTAN];
export function trailer(F, hu, hv, len, wall, lab, G0 = G) {
  const w = 4; for (let u = hu; u < hu + w; u++) for (let v = hv; v < hv + len; v++) { const e = u === hu || u === hu + w - 1 || v === hv || v === hv + len - 1; if (e) fput(F, u, v, G0, B.METAL); }
  for (let y = G0 + 1; y < G0 + 4; y++) for (let u = hu; u < hu + w; u++) for (let v = hv; v < hv + len; v++) { const eu = u === hu || u === hu + w - 1, ev = v === hv || v === hv + len - 1; if (!eu && !ev) continue;
    const win = y === G0 + 2 && !(eu && ev) && ((eu && (v - hv) % 3 === 1) || (ev && u === hu + 1)); const [x, z] = F.at(u, v);
    fput(F, u, v, y, win ? (lab ? B.WINFOIL : (lit(x, 1, z, .35) ? B.WINL : B.WIN)) : wall); }
  for (let u = hu; u < hu + w; u++) for (let v = hv; v < hv + len; v++) fput(F, u, v, G0 + 4, B.TINROOF);
  const dv = hv + (len >> 1) + 1; fput(F, hu + w - 1, dv, G0 + 1, B.DOORLO); fput(F, hu + w - 1, dv, G0 + 2, B.DOORHI);
  return { door: [hu + w, dv] };
}
function trailerPad(l, F, r, bp, opts) {
  const lab = !bp && r() < .16, wall = bp ? (MAT[normBlueprint(bp).wall]?.wall ?? B.TRAILERW) : pick(r, TRAILER_WALLS);
  if (!bp && opts.claimed) { fprop(F, 'forsale', 5, F.D - 2); fsign(F, 5, F.D - 2, G + 1.1, 1.1, .45, 'SOLD', 'paint', '#c0392f', '#f1efe9', .15); return; }
  if (!bp && r() < .1) { fprop(F, 'tires', 3, 5); return; }
  if (bp && bp.floors > 1) { house(F, 1, 1, { ...bp, w: 6, d: 8 }); return; }
  const t = trailer(F, 1, 1, 10, wall, lab);
  for (let v = t.door[1] - 1; v <= t.door[1] + 1; v++) for (let u = 5; u < 7; u++) fput(F, u, v, G, B.PLANKS);
  if (r() < .6) fprop(F, 'car:' + pick(r, ['sedan', 'pickup', 'hatch', 'wreck', 'van']) + ':' + pick(r, CAR_COLS) + ':' + (r() * 99 | 0), 6.3, 3.5, G, 0);
  const junk = pick(r, ['flamingo', 'grill', 'chair:3843872', 'chair:15881042', 'tires', 'barrel:2841754', 'dish']); fprop(F, junk, 6, 10);
  if (r() < .4) fprop(F, 'dish', 1, 1, G + 5);
  if (lab) { fprop(F, 'barrel:2841754', 6, 9); fprop(F, 'barrel:9067093', 7, 10); fprop(F, 'ac', 6, 0); }
  if (r() < .25) { const [x, z] = F.at(7, 1); tree(x, G, z, r); }
}
function trailerPark(c) {
  const R = TRAILER.R, r = rng(7, 7, 7);
  for (const z of TRAILER.lanes) ground(R.x0 + 2, z - 1, R.x1 - 2, z + 2, B.ASPHOLD);
  ground(R.x1 - 6, R.z0 + 2, R.x1 - 3, R.z1 - 1, B.ASPHOLD);
  for (let x = R.x0; x < R.x1; x++) { put(x, G, R.z0, B.CHAINX); put(x, G + 1, R.z0, B.CHAINTOPX); put(x, G, R.z1 - 1, B.CHAINX); }
  for (let z = R.z0; z < R.z1; z++) { put(R.x0, G, z, B.CHAINZ); put(R.x0, G + 1, z, B.CHAINTOPZ); if (!TRAILER.lanes.some(l => Math.abs(z - l) < 3)) put(R.x1 - 1, G, z, B.CHAINZ); }
  const mz = TRAILER.lanes[1] ?? TRAILER.lanes[0];
  for (const dz of [-3, 3]) for (let y = G; y < G + 4; y++) put(R.x1 - 1, y, mz + dz, B.BARK);
  box(R.x1 - 1, G + 4, mz - 3, R.x1, G + 6, mz + 4, B.PAINTWHITE); sideSign(R.x1 - 1, G + 5, mz + .5, 1, 7, 1.8, SN.trailer, 'box', '#2f5b9a', '#f1e6c8');
  for (const l of LOTS) if (l.kind === 'trailer' && !CLAIMED.has(l.id)) buildLot(l); else if (l.kind === 'trailer') buildLot(l, null, { claimed: true });
  for (const z of TRAILER.lanes) for (let x = R.x0 + 10; x < R.x1 - 6; x += 22) prop('streetlight', x + .5, G, z + 2.6, 2);
  for (let i = 0; i < 14; i++) { const x = R.x0 + 3 + (r() * (R.x1 - R.x0 - 6) | 0), z = R.z0 + 2 + (r() * 3 | 0); tree(x, G, z, r, r() < .5 ? 'pine' : 'oak'); }
  prop('dumpster', R.x1 - 9, G, mz + 4.5, 1); prop('payphone', R.x1 - 8.5, G, mz - 3.5, 1);
}

// ───────────────────────── towers + downtown blocks
const SHOPS = NAMES.shops;
const SIGNPAL = [['#ffffff', '#c0392f'], ['#ffe066', '#2b2d31'], ['#ffffff', '#2f5b9a'], ['#2b2d31', '#f0c330'], ['#ffffff', '#2f7a4a'], ['#ff6fb5', '#16151c'], ['#6ff3ff', '#16151c'], ['#ffffff', '#6e2f45']];
const AWN = [0xc0392f, 0x2f7a4a, 0x2f5b9a, 0x1f1f22, 0xd4782b, 0x6e2f45];
const STYLE = {
  glass: r => { const g = pick(r, ['GLASSB', 'GLASST', 'GLASSK', 'GLASSG']); return { wall: B[g], winL: B[g + 'L'], win: B[g], corner: null, spandrel: B[g + 'S'], every: 1, cap: B.CONC }; },
  office: r => ({ wall: pick(r, [B.CWALL, B.CWALL, B.ASHLAR, B.BRICKWHITE]), win: B.BAND, winL: B.BANDL, corner: null, every: 1, rows: [1, 2], cap: B.CAP }),
  brick: r => { const w = pick(r, [B.BRICKRED, B.BRICKBROWN, B.BRICKTAN, B.BRICKDARK, B.BRICKYELLOW]); return { wall: w, win: B.WINS, winL: B.WINSL, corner: null, every: 2, rows: [1, 2], cap: B.CAP, fe: true, wt: true }; },
  deco: r => ({ wall: B.ASHLAR, win: B.WINS, winL: B.WINSL, corner: null, every: 3, rows: [1, 2, 3], pier: true, cap: B.CAP }),
  stucco: r => ({ wall: pick(r, [B.STUCCO, B.STUCCOPINK, B.STUCCOMINT, B.SIDS]), win: B.WIN, winL: B.WINL, corner: null, every: 2, rows: [1, 2], cap: B.TRIMW }),
  club: r => ({ wall: pick(r, [B.NEONBLK, B.BRICKDARK, B.BLACK]), win: B.WIND, winL: B.WINDL, corner: null, every: 3, rows: [1, 2], cap: B.BLACK }),
  white: r => ({ wall: B.PAINTWHITE, win: B.WIND, winL: B.WINDL, corner: null, every: 3, rows: [1, 2], cap: B.PAINTWHITE }),
};
// street sides: which faces of the footprint front a street: {n, s, e, w}
export function tower(x0, z0, w, d, floors, st, r, sides, opt = {}) {
  const S = STYLE[st](r), top = G + floors * 4, sb = (floors >= 10 && w >= 12 && d >= 12 && r() < .7) ? Math.floor(floors * (.55 + r() * .2)) : 99;
  const shopfront = opt.shops !== false, clubby = st === 'club';
  for (let f = 0; f < floors; f++) { const ins = f >= sb ? 2 : 0, ax0 = x0 + ins, az0 = z0 + ins, ax1 = x0 + w - ins, az1 = z0 + d - ins;
    for (let ly = 0; ly < 4; ly++) { const y = G + f * 4 + ly;
      for (let x = ax0; x < ax1; x++) for (let z = az0; z < az1; z++) {
        const ex = x === ax0 || x === ax1 - 1, ez = z === az0 || z === az1 - 1; if (!ex && !ez) continue;
        const corner = ex && ez, along = ez ? x - ax0 : z - az0, len = ez ? ax1 - ax0 : az1 - az0;
        const street = (z === az0 && sides.n) || (z === az1 - 1 && sides.s) || (x === ax0 && sides.w) || (x === ax1 - 1 && sides.e);
        let id = S.wall;
        if (f === 0 && shopfront && street && !corner) { id = ly === 3 ? (clubby ? B.NEONBLK : S.wall) : (lit(x, 0, z, .75) ? B.SHOPL : B.SHOP);
          if (ly < 2 && Math.abs(along - (len >> 1)) < 1) id = ly === 0 ? B.GDOORLO : B.GDOORHI; }
        else if (corner && !S.spandrel) id = S.corner || S.wall;
        else if (S.pier && along % 3 === 0) id = S.wall;
        else if (S.spandrel) id = ly === 0 ? S.spandrel : lit(x, f, z, .3) ? S.winL : S.win;
        else if (S.rows && S.rows.includes(ly) && (S.every === 1 || along % S.every === 1 || (S.pier && along % 3 !== 0))) id = lit(x, f, z, .38) ? S.winL : S.win;
        put(x, y, z, id); } }
    if (f === sb) { for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) if (x < ax0 || x >= ax1 || z < az0 || z >= az1) put(x, G + f * 4, z, B.TAR); ring(x0, z0, x0 + w, z0 + d, G + f * 4 + 1, S.cap); } }
  const ins = floors > sb ? 2 : 0, rx0 = x0 + ins, rz0 = z0 + ins, rx1 = x0 + w - ins, rz1 = z0 + d - ins;
  if (sb < floors) { hollow(x0 + 1, G, z0 + 1, x0 + w - 1, G + sb * 4, z0 + d - 1); hollow(rx0 + 1, G + sb * 4, rz0 + 1, rx1 - 1, top, rz1 - 1); } else hollow(x0 + 1, G, z0 + 1, x0 + w - 1, top, z0 + d - 1);
  box(rx0, top, rz0, rx1, top + 1, rz1, B.TAR); ring(rx0 - (st === 'brick' || st === 'deco' ? 1 : 0), rz0 - (st === 'brick' || st === 'deco' ? 1 : 0), rx1 + (st === 'brick' || st === 'deco' ? 1 : 0), rz1 + (st === 'brick' || st === 'deco' ? 1 : 0), top, S.cap); ring(rx0, rz0, rx1, rz1, top + 1, S.cap);
  const cx = (rx0 + rx1) >> 1, cz = (rz0 + rz1) >> 1;
  if (floors >= 6 && rx1 - rx0 >= 8 && rz1 - rz0 >= 8) { const pw = Math.max(3, (rx1 - rx0) >> 2), pd = Math.max(3, (rz1 - rz0) >> 2); box(cx - pw, top + 1, cz - pd, cx + pw, top + 4, cz + pd, B.CWALL); box(cx - pw, top + 4, cz - pd, cx + pw, top + 5, cz + pd, B.TAR);
    if (st === 'glass' || st === 'deco') { if (r() < .6) prop('antenna', cx + .5, top + 5, cz + .5); } }
  if (S.wt && r() < .65) prop('waterTower', rx0 + 3.5, top + 1, rz0 + 3.5);
  for (let k = 0; k < 1 + (r() * 3 | 0); k++) prop('ac', rx0 + 2 + r() * (rx1 - rx0 - 4), top + 1, rz0 + 2 + r() * (rz1 - rz0 - 4), r() * 4 | 0);
  // ground floor: awnings + shop signs + fire escapes on street sides
  const faces = [['s', sides.s, 0], ['e', sides.e, 1], ['n', sides.n, 2], ['w', sides.w, 3]];
  for (const [, on, n] of faces) { if (!on) continue;
    const len = n % 2 === 0 ? w : d, mid = (len - 1) / 2, wx = n === 1 ? x0 + w - 1 : n === 3 ? x0 : null, wz = n === 0 ? z0 + d - 1 : n === 2 ? z0 : null;
    const cell = a => (n % 2 === 0 ? [x0 + a, wz] : [wx, z0 + a]);
    if (f0Shop(opt, shopfront) && len >= 6) { const [sx, sz] = cell(mid), sp = pick(r, SIGNPAL), name = opt.name || pick(r, SHOPS), sw = Math.min(len - 2, Math.max(3, name.length * .55 + 1));
      const sst = opt.signStyle || (clubby ? 'neon' : pick(r, ['box', 'box', 'paint', 'neon'])), [sf, sb] = opt.signCol || sp; sideSign(sx, G + 3.5, sz, n, sw, .9, name, sst, sf, sb);
      if (!clubby && !opt.noAwning && r() < .75) { const aw = Math.min(len - 2, 6), [ax, az] = cell(mid), dv = DIRV[n]; prop(`awning:${aw}:${pick(r, AWN)}`, ax + .5 + dv[0] * .5, G + 1.1, az + .5 + dv[1] * .5, n); } }
    if (clubby && len >= 6) { const [sx, sz] = cell(1), sp = pick(r, SIGNPAL.slice(5)); sideSign(sx, G + 6, sz, n, 1.4, 4, opt.vert || 'CLUB', 'neon', sp[0], '#16151c'); }
    if (S.fe && floors >= 3 && len >= 8 && r() < .6) { const [fx, fz] = cell(Math.round(len * .7)), dv = DIRV[n]; prop(`fireEscape:3:${floors}`, fx + .5 + dv[0] * .5, G, fz + .5 + dv[1] * .5, n); } }
}
const f0Shop = (opt, shopfront) => shopfront && opt.signs !== false;
function sidesOf(R, x0, z0, x1, z1) { return { n: z0 <= R.z0 + 1, s: z1 >= R.z1 - 1, w: x0 <= R.x0 + 1, e: x1 >= R.x1 - 1 }; }
function downtownBlock(i, j, R, r, core) {
  const W = R.x1 - R.x0, Dp = R.z1 - R.z0, u = r(), parcels = [];
  if (core && u < .4) parcels.push([R.x0, R.z0, W, Dp]);
  else if (u < (core ? .75 : .45)) { if (r() < .5) { const h = W >> 1; parcels.push([R.x0, R.z0, h, Dp], [R.x0 + h, R.z0, W - h, Dp]); } else { const h = Dp >> 1; parcels.push([R.x0, R.z0, W, h], [R.x0, R.z0 + h, W, Dp - h]); } }
  else { const a = W >> 1, b = Dp >> 1; parcels.push([R.x0, R.z0, a, b], [R.x0 + a, R.z0, W - a, b], [R.x0, R.z0 + b, a, Dp - b], [R.x0 + a, R.z0 + b, W - a, Dp - b]); }
  for (const [px, pz, pw, pd] of parcels) {
    if (!core && r() < .14) { parkingLot(px, pz, px + pw, pz + pd, r); continue; }
    const st = core ? pick(r, ['glass', 'glass', 'glass', 'office', 'deco', 'brick']) : pick(r, ['brick', 'brick', 'brick', 'stucco', 'office', 'glass']);
    const big = pw * pd, floors = core ? 8 + (r() * (big > 300 ? 20 : 12) | 0) : 2 + (r() * 5 | 0) + (st === 'glass' ? 3 : 0);
    const inset = core ? 1 : 0, x0 = px + inset, z0 = pz + inset, x1 = px + pw - inset, z1 = pz + pd - inset;
    tower(x0, z0, x1 - x0, z1 - z0, floors, st, r, sidesOf(R, px, pz, px + pw, pz + pd));
    if (core) { for (let x = px; x < px + pw; x++) for (let z = pz; z < pz + pd; z++) if (x < x0 || x >= x1 || z < z0 || z >= z1) put(x, G - 1, z, B.PAVERRED); }
  }
}
function nightlifeBlock(i, j, R, r) {
  const W = R.x1 - R.x0, n = 3, pw = Math.floor(W / n), STRIP = NAMES.strip, VERT = NAMES.stripVertical;
  for (let k = 0; k < n; k++) { const x0 = R.x0 + k * pw, x1 = k === n - 1 ? R.x1 : x0 + pw; for (const half of [0, 1]) { const z0 = half ? R.z0 + ((R.z1 - R.z0) >> 1) : R.z0, z1 = half ? R.z1 : R.z0 + ((R.z1 - R.z0) >> 1);
    tower(x0, z0, x1 - x0, z1 - z0, 2 + (r() * 4 | 0), r() < .6 ? 'club' : 'brick', r, sidesOf(R, x0, z0, x1, z1), { name: pick(r, STRIP), vert: pick(r, VERT) }); } }
}
export function parkingLot(x0, z0, x1, z1, r, cars = .6) {
  ground(x0, z0, x1, z1, B.ASPH); const alongX = x1 - x0 >= z1 - z0;
  if (alongX) for (let row = z0 + 1; row + 5 <= z1; row += 11) { for (let x = x0 + 1; x < x1 - 1; x += 3) { for (let z = row; z < row + 5; z++) put(x, G - 1, z, B.ASPHWL); if (r() < cars) prop('car:' + pick(r, ['sedan', 'sedan', 'hatch', 'pickup', 'van']) + ':' + pick(r, CAR_COLS), x + 1.5, G, row + 2.5, r() < .5 ? 0 : 2); } }
  else for (let col = x0 + 1; col + 5 <= x1; col += 11) { for (let z = z0 + 1; z < z1 - 1; z += 3) { for (let x = col; x < col + 5; x++) put(x, G - 1, z, B.ASPHWT); if (r() < cars) prop('car:' + pick(r, ['sedan', 'sedan', 'hatch', 'pickup', 'van']) + ':' + pick(r, CAR_COLS), col + 2.5, G, z + 1.5, r() < .5 ? 1 : 3); } }
  prop('streetlight', x0 + .5, G, (z0 + z1) / 2, 1);
}

// ───────────────────────── civic buildings
function portico(x0, z0, w, n, y0, h, faceS) {   // columns along x in front of a facade (faceS: facing +z)
  const zc = faceS ? z0 : z0; for (let k = 0; k < n; k++) { const x = Math.round(x0 + 1 + k * (w - 3) / (n - 1)); for (let y = y0; y < y0 + h; y++) put(x, y, zc, B.MARBLE); }
  for (let x = x0; x < x0 + w; x++) { put(x, y0 + h, zc, B.ASHLAR); put(x, y0 + h, zc + (faceS ? -1 : 1), B.ASHLAR); }
  for (let k = 1; k <= (w >> 1); k++) for (let x = x0 + k; x < x0 + w - k; x++) { put(x, y0 + h + k, zc, B.ASHLAR); put(x, y0 + h + k, zc + (faceS ? -1 : 1), B.ASHLAR); }
}
function bank(i, j, R, r) {   // corner of Main & Central: faces south-east
  const w = 18, d = 14, x0 = R.x1 - w - 1, z0 = R.z1 - d - 4;
  tower(x0, z0, w, d, 3, 'deco', r, { s: false, e: false, n: false, w: false }, { shops: false });
  for (let x = x0; x < x0 + w; x++) put(x, G + 11, z0 + d, B.CAP);
  portico(x0 + 2, z0 + d + 2, w - 4, 5, G, 8, true); for (let x = x0 + 2; x < x0 + w - 2; x++) for (let z = z0 + d; z < z0 + d + 3; z++) put(x, G - 1, z, B.MARBLE);
  put(x0 + (w >> 1), G, z0 + d - 1, B.VAULT); put(x0 + (w >> 1), G + 1, z0 + d - 1, B.VAULT); put(x0 + (w >> 1) - 1, G, z0 + d - 1, B.GDOORLO); put(x0 + (w >> 1) - 1, G + 1, z0 + d - 1, B.GDOORHI);
  sign(x0 + w / 2, G + 9.5, z0 + d + 3.05, 0, 9, 1.2, SN.bank, 'letters', '#e8c24a', '#000000');
  prop('bollard', x0 + 2, G, R.z1 - .5); prop('bollard', x0 + w - 2, G, R.z1 - .5); prop('payphone', R.x0 + 3, G, R.z1 - 1.5, 0);
  parkingLot(R.x0 + 1, R.z0 + 1, x0 - 2, R.z1 - 2, r, .5);
}
function courthouse(i, j, R, r) {
  const w = 22, d = 16, x0 = R.x0 + ((R.x1 - R.x0 - w) >> 1), z0 = R.z0 + 2;
  tower(x0, z0, w, d, 3, 'deco', r, { s: false, e: false, n: false, w: false }, { shops: false });
  portico(x0 + 3, z0 + d + 2, w - 6, 6, G, 10, true); for (let x = x0 + 2; x < x0 + w - 2; x++) for (let z = z0 + d; z < R.z1; z++) put(x, G - 1, z, B.MARBLE);
  const cx = x0 + w / 2 - .5, cz = z0 + d / 2 - .5, base = G + 12; for (let y = 0; y < 3; y++) for (let x = x0 + 5; x < x0 + w - 5; x++) for (let z = z0 + 3; z < z0 + d - 3; z++) if (Math.hypot(x - cx, z - cz) < 6.2) put(x, base + y, z, y === 1 ? B.WINS : B.ASHLAR);
  for (let k = 0; k < 7; k++) { const rad = 6.2 * Math.cos(k / 7 * Math.PI / 2); for (let x = x0 + 4; x < x0 + w - 4; x++) for (let z = z0 + 2; z < z0 + d - 2; z++) if (Math.hypot(x - cx, z - cz) < rad) put(x, base + 3 + k, z, B.COPPER); }
  prop('flagpole', cx + .5, base + 10, cz + .5); for (const dx of [-8, 8]) prop('flagpole', x0 + w / 2 + dx, G, R.z1 - 2);
  sign(x0 + w / 2, G + 11.3, z0 + d + 3.05, 0, 10, 1, SN.court, 'letters', '#2b2d31', '#000000');
  for (const dx of [-9, 9]) { const [x, z] = [Math.round(x0 + w / 2 + dx), R.z1 - 5]; tree(x, G, z, r); }
}
function police(i, j, R, r) {
  const w = 20, d = 12, x0 = R.x0 + 1, z0 = R.z1 - d - 3;
  tower(x0, z0, w, d, 3, 'brick', r, { s: false, e: false, n: false, w: false }, { shops: false });
  for (let x = x0; x < x0 + w; x++) { put(x, G + 3, z0 + d - 1, B.PAINTBLUE); put(x, G + 3, z0, B.PAINTBLUE); }
  for (let z = z0; z < z0 + d; z++) { put(x0, G + 3, z, B.PAINTBLUE); put(x0 + w - 1, G + 3, z, B.PAINTBLUE); }
  const dx = x0 + (w >> 1); for (const k of [0, -1]) { put(dx + k, G, z0 + d - 1, B.GDOORLO); put(dx + k, G + 1, z0 + d - 1, B.GDOORHI); }
  sideSign(dx - .5, G + 5.5, z0 + d - 1, 0, 6, 1.1, SN.police, 'box', '#ffffff', '#1f3a6e'); sideSign(dx - .5, G + 3.5, z0 + d - 1, 0, 8, .6, SN.precinct, 'letters', '#f1efe9', '#000');
  for (const k of [-3, 2]) prop('spot', dx + k + .5, G + 2, z0 + d + .2, 0);
  prop('flagpole', dx - 6, G, R.z1 - 1.5);
  for (let z = z0 + 2; z < z0 + 8; z++) for (let y = G; y < G + 4; y++) put(x0 + w - 1, y, z, B.ROLLDOOR);
  parkingLot(x0 + w + 1, R.z0 + 1, R.x1 - 1, R.z1 - 1, r, 0);
  for (let k = 0; k < 4; k++) prop('car:cop:#1f1f22', x0 + w + 3.5, G, R.z0 + 4 + k * 5, 1);
  ground(x0, R.z0 + 1, x0 + w, z0 - 1, B.ASPH); for (let k = 0; k < 3; k++) prop('car:cop:#1f1f22', x0 + 3 + k * 5, G, R.z0 + 5, 0);
}
function plaza(i, j, R, r) {
  ground(R.x0, R.z0, R.x1, R.z1, B.PAVER); const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2 + 2;
  for (let x = Math.floor(cx - 6); x <= cx + 6; x++) for (let z = Math.floor(cz - 6); z <= cz + 6; z++) { const d = Math.hypot(x + .5 - cx, z + .5 - cz); if (d < 5) put(x, G - 1, z, B.WATER); else if (d < 6) put(x, G, z, B.CONC); }
  box(Math.floor(cx) - 1, G - 1, Math.floor(cz) - 1, Math.floor(cx) + 1, G + 2, Math.floor(cz) + 1, B.CONC); box(Math.floor(cx) - 1, G + 2, Math.floor(cz) - 1, Math.floor(cx) + 1, G + 3, Math.floor(cz) + 1, B.WATER);
  box(Math.floor(cx) - 2, G, R.z0 + 2, Math.floor(cx) + 2, G + 3, R.z0 + 6, B.ASHLAR); PLAZA.statue = [Math.floor(cx), G + 3, R.z0 + 4];
  for (const [dx, dz] of [[-9, -8], [9, -8], [-9, 8], [9, 8]]) { const x = Math.round(cx + dx), z = Math.round(cz + dz); put(x, G - 1, z, B.MULCH); tree(x, G, z, r); }
  for (const [dx, dz, rot] of [[-7, 0, 1], [7, 0, 3], [0, 8, 2], [-4, 8, 2], [4, 8, 2]]) prop('bench', cx + dx, G, cz + dz, rot);
  for (const [dx, dz] of [[-10, 0], [10, 0], [0, -9], [0, 11]]) prop('planter', cx + dx, G, cz + dz);
  for (const [dx, dz] of [[-11, -10], [11, -10], [-11, 10], [11, 10]]) prop('streetlight', cx + dx, G, cz + dz, dz < 0 ? 0 : 2);
}
export const PLAZA = { statue: null };
export const QUEUES = [];   // where idle characters line up (the DROP store)
function fitStreet(i, j, R, r) {
  const shops = NAMES.fitStreet, w = Math.floor((R.x1 - R.x0) / shops.length), d = 11;
  shops.forEach(([name, look], k) => { const x0 = R.x0 + k * w, x1 = k === shops.length - 1 ? R.x1 : x0 + w;
    const st = look === 'white' ? 'white' : look === 'neon' ? 'club' : 'brick', col = look === 'white' ? ['#ffffff', '#16161a'] : look === 'neon' ? [pick(r, ['#ff5fa2', '#6ff3ff', '#b58cff']), '#16151c'] : ['#16161a', '#f0c330'];
    tower(x0, R.z0, x1 - x0, d, look === 'white' ? 2 : 2 + (r() * 2 | 0), st, r, { n: true, s: false, e: false, w: false }, { name, signStyle: look === 'white' ? 'box' : look === 'neon' ? 'neon' : 'box', signCol: col, noAwning: look !== 'box', vert: name.split(' ')[0] });
    if (look === 'white') { for (let q = 0; q < 9; q++) QUEUES.push({ x: x0 + (x1 - x0) / 2 + 1.2 + q * 1.15, z: R.z0 - 1.4, face: -1 });
      for (const dx of [-0.2, 11.2]) prop('bollard', x0 + (x1 - x0) / 2 + 1 + dx, G, R.z0 - .6); } });
  const h = (R.z1 - R.z0 - d - 2) >> 1; tower(R.x0, R.z1 - 9, (R.x1 - R.x0) >> 1, 9, 3, 'brick', r, { s: true, n: false, e: false, w: true }); tower(R.x0 + ((R.x1 - R.x0) >> 1), R.z1 - 9, (R.x1 - R.x0) - ((R.x1 - R.x0) >> 1), 9, 2, 'stucco', r, { s: true, n: false, e: true, w: false });
}
function park(i, j, R, r) {
  const cx = (R.x0 + R.x1) >> 1, cz = (R.z0 + R.z1) >> 1;
  for (let x = R.x0; x < R.x1; x++) { put(x, G - 1, cz, B.WALK); } for (let z = R.z0; z < R.z1; z++) put(cx, G - 1, z, B.WALK);
  const bx = R.x0 + 2, bz = R.z0 + 2; for (let x = bx; x < bx + 9; x++) for (let z = bz; z < bz + 11; z++) put(x, G - 1, z, (x === bx || x === bx + 8 || z === bz || z === bz + 10 || z === bz + 5) ? B.COURTLINE : B.COURT);
  prop('hoop', bx + 4.5, G, bz + .6, 0); prop('hoop', bx + 4.5, G, bz + 10.4, 2);
  for (let k = 0; k < 10; k++) { const x = R.x0 + 2 + (r() * (R.x1 - R.x0 - 4) | 0), z = R.z0 + 2 + (r() * (R.z1 - R.z0 - 4) | 0); if ((x < bx + 11 && z < bz + 13) || x === cx || z === cz) continue; tree(x, G, z, r, pick(r, ['oak', 'oak', 'yellow', 'orange'])); }
  for (const [dx, dz, rot] of [[3, 2, 2], [-3, -2, 0], [2, -3, 1]]) prop('bench', cx + dx + .5, G, cz + dz + .5, rot);
  prop('streetlight', cx + 2.5, G, cz + 1.5, 0); prop('trash', cx + 1.5, G, cz - 1.5);
}

// ───────────────────────── compounds
function hospital(c) {
  const R = compoundInterior(c), r = rng(4, 4, 4), x0 = R.x0 + 5, z0 = R.z0 + 4, w = 32, d = 20;
  tower(x0, z0, w, d, 7, 'office', r, { s: false, e: false, n: false, w: false }, { shops: false });
  for (let f = 1; f < 7; f++) for (let x = x0; x < x0 + w; x++) for (const z of [z0, z0 + d - 1]) if (x > x0 && x < x0 + w - 1) put(x, G + f * 4 + 1, z, lit(x, f, z, .55) ? B.BANDWL : B.BANDW), put(x, G + f * 4 + 2, z, lit(x, f, z, .55) ? B.BANDWL : B.BANDW), put(x, G + f * 4, z, B.PAINTWHITE), put(x, G + f * 4 + 3, z, B.PAINTWHITE);
  const top = G + 28; for (let x = x0 + 10; x < x0 + 22; x++) for (let z = z0 + 4; z < z0 + 16; z++) put(x, top, z, B.MEMBRANE);
  for (let z = z0 + 6; z < z0 + 14; z++) { put(x0 + 13, top, z, B.PAINTRED); put(x0 + 18, top, z, B.PAINTRED); } for (let x = x0 + 13; x < x0 + 19; x++) put(x, top, z0 + 10, B.PAINTRED);
  sideSign(x0 + w / 2 - .5, G + 24.5, z0 + d - 1, 0, 3.2, 3.2, '+', 'cross', '#d8282a', '#f5f5f2');
  sideSign(x0 + w / 2 - .5, G + 21.2, z0 + d - 1, 0, 14, 1.4, SN.hospitalFull, 'letters', '#1f3a6e', '#000');
  for (const dx of [-7, 6]) for (let y = top + 1; y < top + 3; y++) put(x0 + (w >> 1) + dx, y, z0 + d - 2, B.STEELG);
  sign(x0 + w / 2, top + 4.2, z0 + d - .97, 0, 15, 2.6, SN.hospital, 'box', '#ffffff', '#c0392f');
  const ex0 = x0 + 8, ez0 = z0 + d, ew = 16, ed = 9; tower(ex0, ez0, ew, ed, 1, 'office', r, { s: true, e: false, n: false, w: false }, { shops: true, signs: false });
  box(ex0 - 2, G + 4, ez0 + ed, ex0 + ew + 2, G + 5, ez0 + ed + 6, B.PAINTWHITE); for (const x of [ex0 - 2, ex0 + ew + 1]) for (let y = G; y < G + 4; y++) put(x, y, ez0 + ed + 5, B.CONC);
  sideSign(ex0 + ew / 2 - .5, G + 4.5, ez0 + ed + 5, 0, 10, 1, SN.er, 'box', '#ffffff', '#c0392f');
  prop('car:ambulance:#f1efe9', ex0 + 4, G, ez0 + ed + 3, 0); prop('car:ambulance:#f1efe9', ex0 + 11, G, ez0 + ed + 3, 2);
  ground(ex0 - 2, ez0 + ed, ex0 + ew + 2, R.z1, B.ASPH); parkingLot(R.x0 + 1, ez0 + 1, ex0 - 4, R.z1 - 1, r, .7); parkingLot(ex0 + ew + 4, ez0 + 1, R.x1 - 1, R.z1 - 1, r, .7);
  for (let k = 0; k < 6; k++) tree(R.x0 + 2 + k * 9, G, R.z0 + 1, r); for (let k = 0; k < 4; k++) tree(R.x1 - 3, G, z0 + 2 + k * 5, r);
}
// the dead mall: Y2K anchor store, glass atrium, boarded entrances, a sea of cracked parking with weeds and dead lamps
function deadMall(c) {
  const R = compoundInterior(c), r = rng(5, 5, 5), mw = Math.min(72, R.x1 - R.x0 - 10), md = 26, mx0 = R.x0 + ((R.x1 - R.x0 - mw) >> 1), mz0 = R.z0 + 5, H0 = 9;
  ground(R.x0, R.z0, R.x1, R.z1, B.ASPHOLD);
  for (let y = G; y < G + H0; y++) for (let x = mx0; x < mx0 + mw; x++) for (let z = mz0; z < mz0 + md; z++) {
    const e = x === mx0 || x === mx0 + mw - 1 || z === mz0 || z === mz0 + md - 1; if (!e) continue; const ly = y - G;
    put(x, y, z, ly === 0 ? B.ASHLAR : ly === H0 - 1 ? B.CAP : (ly === 5 || ly === 6) && mod(x - mx0, 4) === 2 ? (r() < .5 ? B.WINBOARD : B.WIND) : (ly === 3 ? B.STUCCOPINK : B.STUCCO)); }
  box(mx0, G + H0, mz0, mx0 + mw, G + H0 + 1, mz0 + md, B.TAR); hollow(mx0 + 1, G, mz0 + 1, mx0 + mw - 1, G + H0, mz0 + md - 1);
  const ax0 = mx0 + (mw >> 1) - 8, aw = 16, az1 = mz0 + md + 3;   // the atrium pokes out the front, taller, all glass
  for (let y = G; y < G + 14; y++) for (let x = ax0; x < ax0 + aw; x++) for (let z = mz0 + md - 6; z < az1; z++) { const e = x === ax0 || x === ax0 + aw - 1 || z === az1 - 1; if (!e) continue;
    put(x, y, z, y < G + 2 && z === az1 - 1 && x > ax0 + 3 && x < ax0 + aw - 4 ? B.WINBOARD : (y - G) % 4 === 0 ? B.CONC : B.GLASSB); }
  for (let k = 0; k < 5; k++) for (let x = ax0 + k; x < ax0 + aw - k; x++) for (let z = mz0 + md - 6 + k; z < az1 - k; z++) put(x, G + 14 + k, z, B.GLASSBS);
  sign(ax0 + aw / 2, G + 11.6, az1 + .04, 0, 13, 2.6, 'MILLEN IUM\nMALL', 'letters', '#e8a33a', '#000');   // a letter fell off years ago
  sideSign(ax0 + aw / 2 - .5, G + 2.6, az1 - 1, 0, 6, .9, SN.mallDead, 'box', '#ffffff', '#c0392f');
  for (let k = 0; k < 4; k++) prop('ac', mx0 + 6 + k * 16, G + H0 + 1, mz0 + 5);
  for (let x = R.x0 + 2; x < R.x1 - 3; x += 3) for (const row of [az1 + 6, az1 + 17]) if (r() < .55 && row + 5 < R.z1) for (let z = row; z < row + 5; z++) put(x, G - 1, z, B.ASPHWL);
  for (let k = 0; k < 90; k++) { const x = R.x0 + (r() * (R.x1 - R.x0) | 0), z = az1 + 2 + (r() * (R.z1 - az1 - 3) | 0); put(x, G, z, B.HEDGE); }
  for (let x = R.x0 + 8; x < R.x1 - 4; x += 20) for (const z of [az1 + 12, az1 + 24]) if (z < R.z1 - 2) prop('deadlight', x + .5, G, z + .5, r() * 4 | 0);
  for (let k = 0; k < 9; k++) prop('cart', R.x0 + 4 + r() * (R.x1 - R.x0 - 8), G, az1 + 3 + r() * (R.z1 - az1 - 6), r() * 4 | 0);
  for (let k = 0; k < 3; k++) prop('car:wreck:' + pick(r, CAR_COLS) + ':' + (40 + k), R.x0 + 6 + r() * (R.x1 - R.x0 - 12), G, az1 + 5 + r() * (R.z1 - az1 - 10), r() * 4 | 0);
  const [bx, bz] = [mx0 + mw - 10, mz0 + md + 4]; put(bx, G, bz, B.CRATE); put(bx + 1, G, bz, B.CRATE); prop('barrel:9067093', bx + 2.5, G, bz + .5);   // digger stash
}
// ───────────────────────── the city keeps the record: scars are lot state, so a rebuild keeps them
const crewTag = n => { const u = String(n).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').trim(); if (u.length <= 9) return u; const parts = u.split(/\s+/); return parts.length > 1 ? parts.map(p => p[0]).join('') : u.slice(0, 9); };
const CREW_COLS = ['#ff4fa3', '#6ff3ff', '#ffe23a', '#6cff4a', '#ff7a1a', '#c89bf5', '#ff3b30'];
const crewCol = n => CREW_COLS[[...String(n)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % CREW_COLS.length];
function lotTags(l, F, hr) {
  const tags = (l.scars && l.scars.tags) || []; if (!tags.length) return;
  tags.forEach((t, k) => { const txt = crewTag(t.crew), col = t.col || crewCol(t.crew);
    if (hr && k < 2) { const side = k === 0 ? hr.hu : hr.hu + hr.w - 1, n = (F.rot + (k === 0 ? 3 : 1)) % 4, d = DIRV[n], [x, z] = F.at(side, hr.hv + (hr.d >> 1));
      sign(x + .5 + d[0] * .53, G + 1.3, z + .5 + d[1] * .53, n, Math.min(hr.d - 1, 4.5), 1.5, txt, 'tag', col, '#000'); }
    else { const u = 2 + k * 3; fprop(F, 'plywood:3', u, F.D - 1.6); fsign(F, u, F.D - 1.6, G + 1.2, 2.8, 1.6, txt, 'tag', col, '#000', .12); } });
}
export function scar(kind, a = {}) {
  if (a.lot) { const l = a.lot; l.scars = l.scars || { tags: [] }; if (!l.scars.tags) l.scars.tags = [];
    if (kind === 'tag') { if (l.scars.tags.some(t => t.crew === a.crew)) return false; l.scars.tags.push({ crew: a.crew, col: a.col }); } else { if (l.scars[kind]) return false; l.scars[kind] = true; }
    return true; }
  if (kind === 'scene') crimeScene(a.x, a.z, a.rot || 0);
  if (kind === 'memorial') memorial(a.x, a.z, a.handle || 'A FRIEND', a.rot || 0);
  return true;
}
export function rebuildLot(l) { clearArea(l.x0, l.z0, l.x0 + l.sx - 1, l.z0 + l.sz - 1); const lb = l.lastBuild || { bp: null, opts: {} }; buildLot(l, lb.bp, lb.opts); flushCars(); }
function crimeScene(x, z, rot) {   // chalk outline, police tape, evidence markers, a cruiser
  sign(x + .5, G + .02, z + .5, 4, 3.2, 3.2, '', 'chalk', '#f4f4f0', '#000');
  for (let k = -3; k <= 3; k++) { put(x + k, G, z - 3, B.TAPEX); put(x + k, G, z + 3, B.TAPEX); } for (let k = -2; k <= 2; k++) { put(x - 3, G, z + k, B.TAPEZ); put(x + 3, G, z + k, B.TAPEZ); }
  for (const [dx, dz] of [[-1.6, -1.8], [1.9, .6], [.4, 2.1]]) prop('marker', x + .5 + dx, G, z + .5 + dz, 0);
  prop('car:cop:#1f1f22', x + 2.5, G, z + 8.5, rot); lamp(x + .5, z + .5, G, 4, 0xff5a5a);
}
function memorial(x, z, handle, rot) {
  prop('plaque', x + .5, G, z + .5, rot); sign(x + .5 + DIRV[rot][0] * .14, G + 1, z + .5 + DIRV[rot][1] * .14, rot, 1.1, .7, 'RIP\n' + handle.toUpperCase(), 'paint', '#1d1d1f', '#f1efe9');
  for (let k = 0; k < 7; k++) prop('candle', x + .5 + (k - 3) * .28, G, z + .5 + DIRV[rot][1] * .5 + DIRV[rot][0] * ((k % 2) * .2) + .2, 0);
  for (const [dx, c] of [[-.9, 0xff4fa3], [.9, 0xffe23a], [0, 0xf1efe9]]) prop('flowers:' + c, x + .5 + dx, G, z + .5 + (rot === 0 ? .9 : -.9), 0);
  lamp(x + .5, z + 1, G, 2.5, 0xffb060);
}
export const SITES = [];   // junkyard scrap piles (the v1 sim's dig sites map here)
function junkyard(c) {
  const R = compoundInterior(c), r = rng(9, 9, 9), gx = (R.x0 + R.x1) >> 1;
  for (let x = R.x0; x < R.x1; x++) for (const z of [R.z0, R.z1 - 1]) { if (z === R.z1 - 1 && Math.abs(x - gx) < 4) continue; for (let y = G; y < G + 3; y++) put(x, y, z, B.SLATSX); put(x, G + 3, z, B.RAZORX); }
  for (let z = R.z0; z < R.z1; z++) for (const x of [R.x0, R.x1 - 1]) { for (let y = G; y < G + 3; y++) put(x, y, z, B.SLATSZ); put(x, G + 3, z, B.RAZORZ); }
  for (const dx of [-4, 4]) for (let y = G; y < G + 6; y++) put(gx + dx, y, R.z1 - 1, B.STEELG);
  box(gx - 4, G + 5, R.z1 - 1, gx + 5, G + 7, R.z1, B.PAINTWHITE); sideSign(gx, G + 6, R.z1 - 1, 0, 8.6, 1.8, SN.junk, 'box', '#c0392f', '#f1efe9');
  trailer(frame(gx + 6, R.z1 - 12, 10, 5, '-z'), 0, 0, 5, B.TRAILERTAN, false);
  const spots = [[.25, .25], [.7, .22], [.5, .5], [.22, .72], [.75, .7]];
  spots.forEach(([fx, fz], k) => { const cx = Math.round(R.x0 + fx * (R.x1 - R.x0)), cz = Math.round(R.z0 + fz * (R.z1 - R.z0)), rad = 4 + r() * 3, hh = 3 + r() * 3;
    for (let x = cx - 8; x <= cx + 8; x++) for (let z = cz - 8; z <= cz + 8; z++) { const d = Math.hypot(x - cx, z - cz) / rad + (hash3(x, 11, z) - .5) * .35; if (d >= 1) continue; const top = Math.round((1 - d * d) * hh);
      for (let y = G; y < G + top; y++) put(x, y, z, hash3(x, y, z) < .15 ? B.METALRUST : hash3(x, y + 1, z) < .1 ? B.TIRES : B.SCRAP); }
    SITES.push({ id: 'pit-' + 'abcde'[k], x: cx, z: cz + rad + 2 }); });
  for (let k = 0; k < 22; k++) { const x = R.x0 + 3 + r() * (R.x1 - R.x0 - 6), z = R.z0 + 3 + r() * (R.z1 - R.z0 - 6); if (SITES.some(s => Math.hypot(s.x - x, s.z - 2 - z) < 9)) continue; prop('car:wreck:' + pick(r, CAR_COLS) + ':' + k, x, G, z, r() * 4 | 0); }
  for (let k = 0; k < 4; k++) { const x = R.x0 + 4 + k * 3, z = R.z0 + 3; for (let y = G; y < G + 4 + (k & 1); y++) for (const dz of [0, 1]) put(x, y, z + dz, y % 2 ? B.METALRUST : B.SCRAP); }
  const tx = R.x1 - 8, tz = R.z0 + 8; for (let y = G; y < G + 16; y++) for (const [a, b] of [[0, 0], [1, 1]]) put(tx + a, y, tz + b, B.STEELY); box(tx - 1, G + 16, tz - 1, tx + 3, G + 18, tz + 3, B.STEELY);
  for (let k = 0; k < 12; k++) put(tx - k, G + 17, tz, B.STEELY); for (let y = G + 10; y < G + 17; y++) put(tx - 11, y, tz, B.STEELG); box(tx - 13, G + 8, tz - 1, tx - 9, G + 10, tz + 2, B.BLACK);
  for (let k = 0; k < 8; k++) prop('tires', R.x0 + 4 + r() * 10, G, R.z1 - 4 - r() * 8); prop('dumpster', gx - 8, G, R.z1 - 3, 0);
  lamp(gx, R.z1 - 3, G, 7); prop('streetlight', gx - 6, G, R.z1 - 1.6, 0);
}
function jail(c) {
  const R = compoundInterior(c), r = rng(3, 3, 3), wx0 = R.x0 + 2, wx1 = R.x1 - 2, wz0 = R.z0 + 2, wz1 = R.z1 - 22, gx = (wx0 + wx1) >> 1;
  for (let y = G; y < G + 7; y++) { for (let x = wx0; x < wx1; x++) { put(x, y, wz0, B.JAILWALL); if (Math.abs(x - gx) > 2 || y > G + 4) put(x, y, wz1 - 1, y === G + 5 ? B.JAILSTRIPE : B.JAILWALL); } for (let z = wz0; z < wz1; z++) { put(wx0, y, z, B.JAILWALL); put(wx1 - 1, y, z, B.JAILWALL); } }
  for (let x = wx0; x < wx1; x++) { put(x, G + 7, wz0, B.RAZORX); put(x, G + 7, wz1 - 1, B.RAZORX); } for (let z = wz0; z < wz1; z++) { put(wx0, G + 7, z, B.RAZORZ); put(wx1 - 1, G + 7, z, B.RAZORZ); }
  for (let y = G; y < G + 5; y++) for (let x = gx - 2; x <= gx + 2; x++) put(x, y, wz1 - 1, B.ROLLDOOR);
  for (const [tx, tz] of [[wx0 - 1, wz0 - 1], [wx1 - 4, wz0 - 1], [wx0 - 1, wz1 - 4], [wx1 - 4, wz1 - 4]]) { box(tx, G, tz, tx + 5, G + 11, tz + 5, B.JAILWALL);
    box(tx - 1, G + 11, tz - 1, tx + 6, G + 14, tz + 6, (x, y, z) => ((x === tx - 1 || x === tx + 5 || z === tz - 1 || z === tz + 5) && y === G + 12 ? (lit(x, 0, z, .5) ? B.WINDL : B.WIND) : B.CWALL));
    box(tx - 1, G + 14, tz - 1, tx + 6, G + 15, tz + 6, B.TAR); prop('spot', tx + 2.5, G + 15, tz + 2.5, (tx < gx ? 1 : 3)); lamp(tx + 2.5 + (tx < gx ? 6 : -6), tz + 2.5 + (tz < wz1 - 10 ? 6 : -6), G, 7, 0xe8f0ff); }
  const cell = (x0, z0, w, d) => { for (let f = 0; f < 3; f++) for (let ly = 0; ly < 4; ly++) { const y = G + f * 4 + ly; for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) {
      const ex = x === x0 || x === x0 + w - 1, ez = z === z0 || z === z0 + d - 1; if (!ex && !ez) continue; const along = ez ? x - x0 : z - z0;
      put(x, y, z, ly === 3 && f === 0 ? B.JAILSTRIPE : (ly === 1 || ly === 2) && !(ex && ez) && along % 2 === 1 ? (lit(x, f, z, .5) ? B.SLITL : B.SLIT) : B.JAILWALL); } }
    box(x0, G + 12, z0, x0 + w, G + 13, z0 + d, B.TAR); ring(x0, z0, x0 + w, z0 + d, G + 13, B.CAP); prop('ac', x0 + 4, G + 13, z0 + 4); };
  cell(wx0 + 5, wz0 + 6, 20, 14); cell(wx1 - 25, wz0 + 6, 20, 14);
  const yz0 = wz0 + 26, yz1 = wz1 - 4; for (let x = wx0 + 4; x < wx1 - 4; x++) for (let z = yz0; z < yz1; z++) put(x, G - 1, z, B.DIRT);
  const cx0 = gx - 8, cz0 = yz0 + 3; for (let x = cx0; x < cx0 + 17; x++) for (let z = cz0; z < cz0 + 11; z++) put(x, G - 1, z, (x === cx0 || x === cx0 + 16 || z === cz0 || z === cz0 + 10 || x === cx0 + 8) ? B.COURTLINE : B.COURT);
  prop('hoop', cx0 + .6, G, cz0 + 5.5, 1); prop('hoop', cx0 + 16.4, G, cz0 + 5.5, 3);
  for (let x = wx0 + 4; x < wx1 - 4; x++) { put(x, G, yz0 - 1, B.CHAINX); put(x, G + 1, yz0 - 1, B.CHAINX); put(x, G + 2, yz0 - 1, B.RAZORX); }
  for (const dx of [-12, -6, 6, 12]) prop('bench', gx + dx, G, yz1 - 2, 2);
  const ax0 = gx - 10, az0 = wz1 + 3; tower(ax0, az0, 20, 10, 2, 'brick', r, { s: true, e: false, n: false, w: false }, { signs: false });
  sideSign(gx - .5, G + 6.2, az0 + 9, 0, 13, 1.3, SN.jail, 'letters', '#e9e7e1', '#000'); sideSign(gx - .5, G + 5.1, az0 + 9, 0, 8, .6, SN.jailSub, 'letters', '#e9e7e1', '#000');
  sideSign(ax0 + 19, G + 2.4, az0 + 5, 1, 7, 3.4, 'BOOKING', 'chart', '#26262b', '#dfe2e6'); sideSign(ax0 + 19, G + 5, az0 + 5, 1, 5, .6, SN.booking, 'box', '#ffffff', '#26262b'); prop('flagpole', gx + 12, G, az0 + 10);
  ground(wx0, az0 + 11, wx1, R.z1, B.ASPH); ground(gx - 2, wz1, gx + 3, az0, B.ASPH);
  for (let k = 0; k < 4; k++) prop('car:cop:#1f1f22', wx0 + 3 + k * 4, G, R.z1 - 4, 0); prop('car:box:#8a9197', wx1 - 6, G, R.z1 - 5, 2);
  for (let x = wx0; x < wx1; x += 12) lamp(x + 6, wz1 + 1, G, 6, 0xe8f0ff);
}
function industrialBlock(i, j, R, r, docks) {
  const W = R.x1 - R.x0, Dp = R.z1 - R.z0;
  if (docks) {
    for (let x = R.x0; x < R.x1; x += 4) prop('bollard', x + .5, G, R.z0 + .5);
    for (let k = 0; k < 6; k++) { const x0 = R.x0 + 2 + (k % 2) * 13, z0 = R.z0 + 4 + (k >> 1) * 5; if (z0 + 3 > R.z1) break; const cols = [B.CONTR, B.CONTB, B.CONTG, B.CONTO, B.CONTY, B.CONTW];
      const hh = 1 + (r() * 3 | 0); for (let s = 0; s < hh; s++) box(x0, G + s * 3, z0, x0 + 11, G + s * 3 + 3, z0 + 3, pick(r, cols)); }
    if (i === 2) { const cx0 = R.x0 + 4, cx1 = R.x1 - 4; for (const x of [cx0, cx1]) for (const z of [R.z0 + 1, R.z0 + 12]) for (let y = G; y < G + 22; y++) put(x, y, z, B.STEELY);
      for (let x = cx0; x <= cx1; x++) for (const z of [R.z0 + 1, R.z0 + 12]) put(x, G + 22, z, B.STEELY); for (let z = R.z0 - 26; z <= R.z0 + 14; z++) for (const x of [cx0 + 3, cx0 + 4]) put(x, G + 23, z, B.STEELY);
      box(cx0 + 2, G + 19, R.z0 - 2, cx0 + 6, G + 23, R.z0 + 2, B.STEELR); for (let y = G + 12; y < G + 22; y++) put(cx0 + 4, y, R.z0 - 20, B.STEELG); box(cx0 + 2, G + 9, R.z0 - 22, cx0 + 7, G + 12, R.z0 - 19, B.CONTB); }
    if (i === 0 || i === 4) { const px = R.x0 + 8; for (let x = px; x < px + 6; x++) for (let z = R.z0 - 30; z < R.z0; z++) put(x, G - 1, z, B.PLANKS); for (let z = R.z0 - 30; z < R.z0; z += 5) for (const x of [px, px + 5]) for (let y = 2; y < G - 1; y++) put(x, y, z, B.BARK); for (let z = R.z0 - 30; z < R.z0; z += 6) prop('bollard', px + .5, G, z + .5); }
    return; }
  const u = r();
  if (u < .5) {   // warehouse
    const x0 = R.x0 + 1, z0 = R.z0 + 1, w = W - 2, d = Dp - 7, wall = pick(r, [B.METAL, B.METALBLUE, B.METALCREAM, B.METALGREEN, B.BRICKRED]), hh = 8 + (r() * 5 | 0);
    for (let y = G; y < G + hh; y++) for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) { const e = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + d - 1; if (!e) continue;
      const dock = z === z0 + d - 1 && y < G + 4 && mod(x - x0, 6) >= 2 && mod(x - x0, 6) <= 4 && x > x0 + 1 && x < x0 + w - 2; put(x, y, z, dock ? B.ROLLDOOR : (y === G + hh - 3 && mod(x - x0, 4) === 1 && z !== z0 + d - 1 ? B.WIND : wall)); }
    box(x0, G + hh, z0, x0 + w, G + hh + 1, z0 + d, B.TINROOF); ground(x0, z0 + d, x0 + w, R.z1, B.CONC);
    for (let x = x0 + 4; x < x0 + w - 3; x += 12) prop('car:box:' + pick(r, ['#e9e7e1', '#c0392f', '#2f5d8c']), x + .5, G, z0 + d + 3.5, 0);
    sideSign(x0 + w / 2 - .5, G + hh - 1.2, z0 + d - 1, 0, Math.min(w - 4, 12), 1.3, pick(r, NAMES.industry), 'paint', '#f1efe9', '#000');
    for (let k = 0; k < 3; k++) prop(pick(r, ['skid', 'barrel:2841754', 'dumpster', 'crateStack']), x0 + 2 + r() * (w - 4), G, z0 + d + 1.2, 0);
    lamp(x0 + w / 2, z0 + d + 2, G, 6);
  } else if (u < .75) {   // factory with smokestacks
    const x0 = R.x0 + 2, z0 = R.z0 + 2, w = W - 4, d = Dp - 8; tower(x0, z0, w, d, 3, 'brick', r, { s: false, e: false, n: false, w: false }, { shops: false });
    for (let k = 0; k < w; k += 4) for (let z = z0; z < z0 + d; z++) { put(x0 + k + 1, G + 13, z, B.TINROOF); put(x0 + k + 2, G + 14, z, B.GLASSK); }
    for (const [sx, sz] of [[x0 + 3, z0 + 3], [x0 + w - 6, z0 + 4]]) { const hh = 30 + (r() * 14 | 0); for (let y = G + 13; y < G + hh; y++) box(sx, y, sz, sx + 3, y + 1, sz + 3, (x, yy, z) => (x === sx + 1 && z === sz + 1 ? null : (yy > G + hh - 5 && yy < G + hh - 2 ? B.PAINTWHITE : B.BRICKRED))); }
    ground(R.x0, z0 + d, R.x1, R.z1, B.CONC); for (let k = 0; k < 4; k++) prop('barrel:' + pick(r, [2841754, 9067093, 11546150]), x0 + 3 + k * 2, G, z0 + d + 2, 0);
  } else if (u < .9) {   // tank farm
    for (let k = 0; k < 3; k++) { const cx = R.x0 + 6 + k * ((W - 10) / 2), cz = R.z0 + Dp / 2, rad = 4.6; for (let y = G; y < G + 12; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) for (let z = Math.floor(cz - rad); z <= cz + rad; z++) if (Math.hypot(x + .5 - cx, z + .5 - cz) < rad) put(x, y, z, y === G + 11 ? B.MEMBRANE : (y === G + 8 ? B.PAINTRED : B.PAINTWHITE)); }
    for (let x = R.x0 + 4; x < R.x1 - 4; x++) put(x, G + 6, R.z0 + (Dp >> 1), B.STEELG);
    for (let x = R.x0; x < R.x1; x++) { put(x, G, R.z0, B.CHAINX); put(x, G + 1, R.z0, B.RAZORX); put(x, G, R.z1 - 1, B.CHAINX); put(x, G + 1, R.z1 - 1, B.RAZORX); }
  } else { parkingLot(R.x0 + 1, R.z0 + 1, R.x1 - 1, R.z1 - 1, r, .25); for (let k = 0; k < 4; k++) prop('car:box:#e9e7e1', R.x0 + 4 + k * 5, G, R.z0 + 5, 0); }
}
function gasStation(i, j, R, r) {
  ground(R.x0, R.z0, R.x1, R.z1, B.ASPH); const cx0 = R.x0 + 2, cz0 = R.z0 + 3;
  box(cx0, G + 5, cz0, cx0 + 12, G + 6, cz0 + 8, B.PAINTWHITE); for (let x = cx0; x < cx0 + 12; x++) { put(x, G + 5, cz0, B.PAINTRED); put(x, G + 5, cz0 + 7, B.PAINTRED); }
  for (const [x, z] of [[cx0 + 1, cz0 + 1], [cx0 + 10, cz0 + 1], [cx0 + 1, cz0 + 6], [cx0 + 10, cz0 + 6]]) for (let y = G; y < G + 5; y++) put(x, y, z, B.PAINTWHITE);
  for (const x of [3, 6, 9]) for (const z of [2.5, 5.5]) prop('pump', cx0 + x, G, cz0 + z, 1);
  for (let x = cx0; x < cx0 + 12; x += 4) lamp(x + 2, cz0 + 4, G, 5, 0xf0f6ff);
  sideSign(cx0 + 5.5, G + 5.5, cz0 + 7, 0, 5, .8, SN.gas, 'box', '#ffffff', '#c0392f');
  const sx0 = R.x0 + 2, sz0 = R.z1 - 8; tower(sx0, sz0, 11, 7, 1, 'stucco', r, { n: true, s: false, e: false, w: false }, { name: SN.mart });
  for (let y = G; y < G + 9; y++) put(R.x0 + 1, y, R.z0 + 3, B.STEELG); box(R.x0 + 1, G + 9, R.z0 + 1, R.x0 + 2, G + 12, R.z0 + 6, B.PAINTWHITE);
  sideSign(R.x0 + 1, G + 10.5, R.z0 + 3, 3, 4.6, 2.6, SN.gasPrice, 'box', '#c0392f', '#f5f2e8');
  prop('car:sedan:' + pick(r, CAR_COLS), cx0 + 4.5, G, cz0 + 4, 0); prop('car:pickup:' + pick(r, CAR_COLS), cx0 + 7.5, G, cz0 + 4, 2); prop('trash', cx0 + 12.5, G, cz0 + 4); prop('payphone', sx0 + 12, G, sz0 - 1, 2);
}
function motel(i, j, R, r) {
  ground(R.x0, R.z0, R.x1, R.z1, B.ASPH); const x0 = R.x0 + 1, z0 = R.z1 - 8, w = R.x1 - R.x0 - 2;
  for (let f = 0; f < 2; f++) for (let ly = 0; ly < 4; ly++) { const y = G + f * 4 + ly; for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + 6; z++) { const e = x === x0 || x === x0 + w - 1 || z === z0 || z === z0 + 5; if (!e) continue;
      const fr = z === z0 && x > x0 && x < x0 + w - 1, bk = z === z0 + 5 && x > x0 && x < x0 + w - 1, k = mod(x - x0, 4); if (bk && ly === 2 && k === 2) { put(x, y, z, lit(x, f + 5, z, .4) ? B.WINL : B.WIN); continue; } put(x, y, z, fr && ly < 2 && k === 1 ? (ly ? B.DOORHIB : B.DOORLOB) : fr && (ly === 1 || ly === 2) && k === 3 ? (lit(x, f, z, .5) ? B.WINL : B.WIN) : B.STUCCOPINK); } }
  box(x0, G + 8, z0, x0 + w, G + 9, z0 + 6, B.TAR); for (let x = x0; x < x0 + w; x++) { put(x, G + 3, z0 - 1, B.PLANKS); put(x, G + 3, z0 - 2, B.PLANKS); put(x, G + 4, z0 - 2, B.RAILX); put(x, G + 7, z0 - 1, B.PAINTWHITE); put(x, G + 7, z0 - 2, B.PAINTWHITE); }
  for (let x = x0; x < x0 + w; x += 5) for (let y = G; y < G + 7; y++) put(x, y, z0 - 2, B.PAINTWHITE);
  for (let x = x0 + 2; x < x0 + 9; x++) for (let z = R.z0 + 2; z < R.z0 + 7; z++) put(x, G - 1, z, (x === x0 + 2 || x === x0 + 8 || z === R.z0 + 2 || z === R.z0 + 6) ? B.POOLTILE : B.POOL);
  const px = R.x1 - 3, pz = R.z0 + 3; for (let y = G; y < G + 15; y++) put(px, y, pz, B.STEELG);
  sign(px + .5, G + 13.5, pz + 1.05, 0, 5, 1.8, SN.motel, 'neon', '#ff5f7e', '#16151c'); sign(px + .5, G + 11.8, pz + 1.05, 0, 4, .8, SN.vacancy, 'neon', '#6ff3ff', '#16151c');
  sign(px + .5, G + 13.5, pz - .05, 2, 5, 1.8, SN.motel, 'neon', '#ff5f7e', '#16151c');
  for (let k = 0; k < 4; k++) if (r() < .7) prop('car:' + pick(r, ['sedan', 'pickup', 'van', 'hatch']) + ':' + pick(r, CAR_COLS), x0 + 3 + k * 4.5, G, z0 - 5, 2);
  for (let x = x0; x < x0 + w; x += 6) lamp(x + 2, z0 - 3, G, 4, 0xffc07a);
}

// ───────────────────────── street furniture along one block's sidewalks + its NW intersection
function streetside(i, j, k, r) {
  const d = distOf(k), dense = d === 'downtown', sub = d === 'suburbs', ind = d === 'industrial' || d === 'docks' || d === 'junkyard';
  const sides = [['n', segZ(j, i), j * P, 2], ['s', segZ(j + 1, i), (j + 1) * P, 0], ['w', segX(i, j), i * P, 3], ['e', segX(i + 1, j), (i + 1) * P, 1]];
  for (const [s, on, line, rot] of sides) { if (!on) continue;
    const alongX = s === 'n' || s === 's', hw = alongX ? hwZ(s === 'n' ? j : j + 1) : hwX(s === 'w' ? i : i + 1), ave = alongX ? aveZ(s === 'n' ? j : j + 1) : aveX(s === 'w' ? i : i + 1); if (!alongX && (s === 'w' ? i : i + 1) === HWY) continue;
    const off = s === 'n' || s === 'w' ? hw + .6 : -(hw + .6), start = (alongX ? i : j) * P, walkOff = s === 'n' || s === 'w' ? hw + 1.5 : -(hw + 1.5);
    const at = (a, o) => (alongX ? [start + a, line + o] : [line + o, start + a]);
    for (let a = 8; a < P - 6; a += dense ? 11 : 14) { const [x, z] = at(a, off); prop('streetlight', x, G, z, rot); }
    if (dense) { for (let a = 13; a < P - 8; a += 11) { const [x, z] = at(a + .5, walkOff); const tx = Math.floor(x), tz = Math.floor(z); put(tx, G - 1, tz, B.MULCH); tree(tx, G, tz, r, 'street'); }
      if (r() < .5) { const [x, z] = at(6 + r() * 18, walkOff); prop(pick(r, ['bench', 'trash', 'newsbox:12597295', 'newsbox:3104154', 'payphone', 'streetbox', 'meter']), x, G, z, rot); } }
    if (r() < .3) { const [x, z] = at(5.5, off + (off > 0 ? .4 : -.4)); prop('hydrant', x, G, z, rot); }
    if (!ind || r() < .3) { const lane = ave ? 3 : 1; for (let a = 9; a < P - 9; a += 6) { if (r() > (dense ? .45 : sub ? .22 : .3)) continue; const [x, z] = at(a, s === 'n' || s === 'w' ? lane : -lane);
      const rr = alongX ? (s === 'n' ? 3 : 1) : (s === 'w' ? 0 : 2); prop('car:' + pick(r, ['sedan', 'sedan', 'hatch', 'pickup', 'van', 'taxi', 'sedan']).replace('taxi', dense ? 'taxi' : 'sedan') + ':' + (dense && r() < .25 ? '#e8c02e' : pick(r, CAR_COLS)), x, G, z, rr); } }
    if (ind && r() < .5) { const [x, z] = at(12, walkOff); prop('dumpster', x, G, z, rot); } }
  // intersection at this block's NW corner
  const Lx = i, Lz = j, ns = segX(Lx, Lz - 1) || segX(Lx, Lz), ew = segZ(Lz, Lx - 1) || segZ(Lz, Lx);
  if (ns && ew && Lx !== HWY && (aveX(Lx) || aveZ(Lz) || distOf(k) === 'downtown')) { const hx = hwX(Lx), hz = hwZ(Lz);
    prop('traffic', Lx * P + hx + .8, G, Lz * P + hz + .8, 2); prop('traffic', Lx * P - hx - .8, G, Lz * P - hz - .8, 0); }
}

// ───────────────────────── forest, labs, stashes, the highway strip
const LABS = [[-400, -150], [-430, 110], [-300, 330], [330, -110], [360, 250], [-120, 390], [100, 390]];
export const LAB_SPOTS = [], labSites = () => LABS.map(([x, z]) => labSite(x, z));
function labSite(x0, z0) {   // nearest dry, fairly flat forest spot to a nominal lab position
  for (let rad = 0; rad < 60; rad += 3) for (let a = 0; a < (rad ? 16 : 1); a++) { const x = Math.round(x0 + Math.cos(a / 16 * Math.PI * 2) * rad), z = Math.round(z0 + Math.sin(a / 16 * Math.PI * 2) * rad), c = column(x, z);
    if (c.kind !== '.' || c.h <= WATER + 2 || c.h > G + 16 || urbanDist(x, z) < 20) continue; let ok = true;
    for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, 7], [7, 0], [0, -7], [-7, 0]]) { const n = column(x + dx, z + dz); if (n.h <= WATER + 1 || Math.abs(n.h - c.h) > 3) { ok = false; break; } }
    if (ok) return [x, z]; }
  return null;
}
function lab(x, z, r) { const c = column(x, z); if (c.kind !== '.' || c.h <= WATER + 1) return; const G0 = c.h;
  for (let dx = -7; dx <= 7; dx++) for (let dz = -7; dz <= 7; dz++) { const cc = column(x + dx, z + dz); if (Math.abs(cc.h - G0) <= 2 && Math.hypot(dx, dz) < 7.5) { for (let y = cc.h; y < G0 + 12; y++) put(x + dx, y, z + dz, 0); if (cc.h < G0) for (let y = cc.h; y < G0; y++) put(x + dx, y, z + dz, B.DIRT); if (cc.h > G0) for (let y = G0; y < cc.h; y++) put(x + dx, y, z + dz, 0); put(x + dx, G0 - 1, z + dz, B.DIRT); } }
  const F = frame(x - 3, z - 3, 6, 5, 'z'); for (let y = G0; y < G0 + 3; y++) for (let u = 0; u < 6; u++) for (let v = 0; v < 5; v++) { if (u && v && u < 5 && v < 4) continue; fput(F, u, v, y, (y === G0 + 1 && (u === 2 || v === 2) && !(u === 3 && v === 4)) ? B.WINBOARD : B.PLANKS); }
  for (let u = -1; u < 7; u++) for (let v = -1; v < 6; v++) fput(F, u, v, G0 + 3, B.TINROOF); fput(F, 3, 4, G0, B.DOORLO); fput(F, 3, 4, G0 + 1, B.DOORHI);
  fsign(F, 1.2, 4, G0 + 2.45, 2.6, .5, SN.lab, 'paint', '#c0392f', '#000');
  prop('barrel:2841754', x + 4.5, G0, z - 1.5); prop('barrel:2841754', x + 4.5, G0, z - .2); prop('barrel:9067093', x + 5.6, G0, z - 1); prop('ac', x - 4.5, G0, z + 2.5, 1);
  prop('car:' + pick(r, ['pickup', 'van', 'wreck']) + ':' + pick(r, CAR_COLS) + ':3', x + 1.5, G0, z + 5.5, 1); put(x - 5, G0, z - 4, B.CRATE); put(x - 5, G0 + 1, z - 4, B.CRATE); put(x - 4, G0, z - 4, B.CRATE);
  LAB_SPOTS.push([x, G0, z]);
}
function forestRegion(x0, z0, r) {
  for (let gx = x0; gx < x0 + RG; gx += 5) for (let gz = z0; gz < z0 + RG; gz += 5) {
    const x = gx + (hash3(gx, 1, gz) * 4 | 0), z = gz + (hash3(gx, 2, gz) * 4 | 0); if (x < x0 + 3 || z < z0 + 3 || x > x0 + RG - 4 || z > z0 + RG - 4) continue;
    const c = column(x, z); if (c.kind === 'road' || urban(c.kind) || c.top === B.SAND || c.top === B.DIRT || c.top === B.ROCK || c.h <= WATER + 1) continue;
    const du = urbanDist(x, z); if (du < 3) continue; const dens = fbm(x * .02 + 7, z * .02 - 3, 3) * sstep(3, 18, du); if (hash3(x, 3, z) > dens * 1.5) continue;
    tree(x, c.h, z, r, fbm(x * .01 - 9, z * .01, 2) > .5 || c.h > G + 8 ? 'pine' : pick(r, ['oak', 'oak', 'oak', 'yellow', 'orange'])); }
  for (const [nx, nz] of LABS) { const p = labSite(nx, nz); if (p && p[0] >= x0 && p[0] < x0 + RG && p[1] >= z0 && p[1] < z0 + RG) lab(p[0], p[1], r); }
  for (let k = 0; k < 3; k++) { const x = x0 + 8 + (r() * (RG - 16) | 0), z = z0 + 8 + (r() * (RG - 16) | 0), c = column(x, z); if (c.kind !== '.' || c.h <= WATER + 1 || urbanDist(x, z) < 10) continue;
    if (r() < .5) { put(x, c.h, z, B.CRATE); if (r() < .5) prop('barrel:2841754', x + 1.5, c.h, z + .5); } else for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (r() < .7) put(x + dx, c.h, z + dz, B.ROCK); }
  // highway billboards and the city-limits sign (forest stretches of Route 9)
  const hx = HWY * P; if (hx >= x0 && hx < x0 + RG) for (let z = z0; z < z0 + RG; z += 16) {
    if (column(hx + 8, z).bridge && mod(z, 32) === 0) { prop('streetlight', hx + 7.6, G, z + .5, 3); prop('streetlight', hx - 6.6, G, z + 16.5, 1); }   // lamps along the bridges
    if (mod(z, 96) !== 32 || z < 160) continue; const east = mod(z, 192) === 32, bx = hx + (east ? 12 : -12), c = column(bx, z); if ((c.kind !== '.' && c.kind !== '~') || c.h <= WATER + 1) continue;
    billboard(bx, c.h, z, east ? 3 : 1, pick(rng(z, 5, 5), BILLS)); }
}
const BILLS = NAMES.billboards;
function billboard(x, G0, z, rot, [text, fg, bg]) { prop('billboard:6:3', x + .5, G0, z + .5, rot); const d = DIRV[rot]; sign(x + .5 - d[0] * .09, G0 + 6.5, z + .5 - d[1] * .09, rot, 5.8, 2.8, text, 'billboard', fg, bg); }

// ───────────────────────── the ship at the docks
function ship() { const x0 = 10, x1 = 96, z0 = -300, z1 = -289;
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) { const bow = Math.max(0, x - (x1 - 10)), zc = (z0 + z1) / 2, half = (z1 - z0) / 2 - bow * .55; if (Math.abs(z + .5 - zc) > half) continue;
    const edge = Math.abs(z + .5 - zc) > half - 1 || x === x0; for (let y = 3; y < 12; y++) if (edge || y === 11) put(x, y, z, y < 7 ? B.PAINTRED : y === 11 ? (edge ? B.PAINTWHITE : B.PAINTGREEN) : B.BLACK); }
  for (let y = 12; y < 22; y++) for (let x = x0 + 1; x < x0 + 9; x++) for (let z = z0 + 2; z < z1 - 2; z++) { const e = x === x0 + 1 || x === x0 + 8 || z === z0 + 2 || z === z1 - 3; if (e) put(x, y, z, (y % 3 === 1 && x === x0 + 8) ? (lit(x, y, z, .5) ? B.WINDL : B.WIND) : B.PAINTWHITE); }
  box(x0 + 1, G + 12, z0 + 2, x0 + 9, G + 13, z1 - 2, B.TAR); for (let y = 22; y < 28; y++) put(x0 + 4, y, (z0 + z1) >> 1, B.PAINTRED);
  const r = rng(1, 2, 3), cols = [B.CONTR, B.CONTB, B.CONTG, B.CONTO, B.CONTY, B.CONTW]; for (let x = x0 + 12; x < x1 - 14; x += 12) for (const z of [z0 + 2, z0 + 5]) { const hh = 1 + (r() * 3 | 0); for (let s = 0; s < hh; s++) box(x, 12 + s * 3, z, x + 11, 15 + s * 3, z + 3, pick(r, cols)); }
  sideSign(x1 - 13, 9, z1 - 1, 0, 8, 1.2, SN.ship, 'paint', '#ffffff', '#000'); }

// ───────────────────────── regions
const regionsDone = new Set(), compDone = new Set(); let shipDone = false;
export function genRegion(rx, rz) {
  const rk = rx + ',' + rz; if (regionsDone.has(rk)) return; regionsDone.add(rk);
  const x0 = rx * RG, z0 = rz * RG, r = rng(rx, rz, 1);
  for (let i = Math.floor(x0 / P); i < Math.floor((x0 + RG) / P); i++) for (let j = Math.floor(z0 / P); j < Math.floor((z0 + RG) / P); j++) {
    const k = kindAt(i, j), br = rng(i, j, 2), R = interior(i, j); streetside(i, j, k, br);
    const cp = compoundAt(i, j); if (cp) { const id = cp.k; if (!compDone.has(id)) { compDone.add(id); ({ H: hospital, T: trailerPark, J: junkyard, K: jail, A: deadMall })[id](cp); } continue; }
    switch (k) {
      case 'D': downtownBlock(i, j, R, br, true); break; case 'd': downtownBlock(i, j, R, br, false); break; case 'N': nightlifeBlock(i, j, R, br); break;
      case 'L': parkingLot(R.x0 + 1, R.z0 + 1, R.x1 - 1, R.z1 - 1, br); break; case 'B': bank(i, j, R, br); break; case 'C': courthouse(i, j, R, br); break;
      case 'S': police(i, j, R, br); break; case 'P': plaza(i, j, R, br); break; case 'p': park(i, j, R, br); break; case 'W': fitStreet(i, j, R, br); break;
      case 's': case 'r': for (const l of LOTS) if (l.i === i && l.j === j) buildLot(l, null, { claimed: CLAIMED.has(l.id) }); break;
      case 'I': industrialBlock(i, j, R, br, false); break; case 'Q': industrialBlock(i, j, R, br, true); break;
      case 'G': gasStation(i, j, R, br); break; case 'M': motel(i, j, R, br); break;
    }
  }
  forestRegion(x0, z0, r);
  if (!shipDone && x0 < 100 && x0 + RG > 0 && z0 <= -290 && z0 + RG > -300) { shipDone = true; ship(); }
  flushCars();
}
// the ship and compounds span regions: make sure any region touching them builds them whole
export function ensureAround(x, z) { if (!shipDone && x > -20 && x < 120 && z > -320 && z < -270) { shipDone = true; ship(); } }
export { DIRV, flushCars, crewTag };
