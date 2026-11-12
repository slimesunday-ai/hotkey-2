// AI CITY world v2 — walking: which cells a person can stand on, and routes between them.
// A cell is walkable when it is dry land (or a bridge deck), has two blocks of headroom, and no street prop stands on it.
// Routes are A* on the block grid (sidewalks cheap, roadway dear, so people keep to sidewalks and cross at the shortest point),
// then string-pulled into straight runs. The same routes are what Stage B's server will stream as plans.
import { WATER, RG, CH, column, blockAt, chunkProps } from './city.js';
import { genRegion } from './build.js';
import { propFoot } from './props.js';
import { B, CUT, PANE } from './tiles.js';

const key = (x, z) => (x + 4096) * 8192 + (z + 4096);
const solid = (x, y, z) => blockAt(x, y, z) !== 0;
const CANOPY = new Set([B.LEAVES, B.LEAVESY, B.LEAVESO, B.PINE, B.BARK]);
// buildings are hollow shells, so "indoors" means a roof overhead (tree canopies don't count)
const roofed = (x, y, z) => { for (let k = y + 2; k < y + 14; k++) { const b = blockAt(x, k, z); if (b && !CUT[b] && !CANOPY.has(b)) return true; } return false; };
let ver = 1; const CACHE = new Map(), OCC = new Map();
export function walkDirty() { ver++; }   // call after anything rebuilds part of the world (standY builds the regions it reads first)

// props whose low voxels cover a cell, per chunk, rebuilt whenever that chunk's prop list changes
function occ(cx, cz) {
  const ck = cx + ',' + cz, l = chunkProps.get(ck); if (!l) return null;
  let o = OCC.get(ck); if (o && o.l === l && o.n === l.length) return o.s;
  o = { l, n: l.length, s: new Map() }; OCC.set(ck, o);
  for (const p of l) { const cs = [1, 0, -1, 0][p.rot], sn = [0, 1, 0, -1][p.rot];
    for (const [fx, fz] of propFoot(p.type)) o.s.set(key(Math.floor(p.x + fx * cs + fz * sn), Math.floor(p.z - fx * sn + fz * cs)), p.y); }
  return o.s;
}
function propAt(x, z, y) {   // props reach at most ~2.5 blocks from their origin, so check the chunks within 3
  for (let cx = Math.floor((x - 3) / CH); cx <= Math.floor((x + 3) / CH); cx++) for (let cz = Math.floor((z - 3) / CH); cz <= Math.floor((z + 3) / CH); cz++) {
    const s = occ(cx, cz), py = s && s.get(key(x, z)); if (py !== undefined && Math.abs(py - y) < 1.5) return true; }
  return false;
}

// the height a person stands at on cell (x, z), or -1 if nobody can stand there
export function standY(x, z) {
  const k = key(x, z), e = CACHE.get(k); if (e !== undefined && Math.floor(e / 512) === ver) return (e % 512) - 1;
  for (let rx = Math.floor((x - 8) / RG); rx <= Math.floor((x + 8) / RG); rx++) for (let rz = Math.floor((z - 8) / RG); rz <= Math.floor((z + 8) / RG); rz++) genRegion(rx, rz);
  const c = column(x, z); let y = c.h;
  if (!solid(x, y - 1, z)) y--;   // one step down into a carved dip
  if (solid(x, y, z)) { const b = blockAt(x, y, z); y = CUT[b] || PANE[b] ? -1 : y + 1; }   // one step up onto a stoop or curb, never onto a fence or rail
  if (y > 0 && (y <= WATER || solid(x, y, z) || solid(x, y + 1, z) || propAt(x, z, y) || roofed(x, y, z))) y = -1;
  if (CACHE.size > 400000) CACHE.clear();
  CACHE.set(k, ver * 512 + y + 1); return y;
}
export const walkable = (x, z) => standY(x, z) >= 0;
const isRoad = (x, z) => { const c = column(x, z); return c.kind === 'road' && c.top !== B.WALK; };

// nearest walkable cell to (x, z), searching rings out to r
export function snap(x, z, r = 8) {
  const x0 = Math.floor(x), z0 = Math.floor(z); if (walkable(x0, z0)) return [x0 + .5, z0 + .5];
  for (let d = 1; d <= r; d++) for (let a = -d; a <= d; a++) for (const [px, pz] of [[x0 + a, z0 - d], [x0 + a, z0 + d], [x0 - d, z0 + a], [x0 + d, z0 + a]])
    if (walkable(px, pz)) return [px + .5, pz + .5];
  return null;
}

// binary heap keyed on f
class Heap { constructor() { this.a = []; } get size() { return this.a.length; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
    if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; } }
const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
const ROAD_COST = 3;

// route from (x0, z0) to (x1, z1): a list of [x, z] waypoints (cell centres), or null if none within the search budget
export const STATS = { calls: 0, fails: 0, ms: 0, nodes: 0 };   // routing cost, for the perf check
export function findPath(x0, z0, x1, z1, budget = 2500) { const t0 = performance.now(); STATS.calls++; const p = astar(x0, z0, x1, z1, budget); if (!p) STATS.fails++; STATS.ms += performance.now() - t0; return p; }
function astar(x0, z0, x1, z1, budget) {
  const s = snap(x0, z0, 3), g = snap(x1, z1, 6); if (!s || !g) return null;
  const sx = Math.floor(s[0]), sz = Math.floor(s[1]), gx = Math.floor(g[0]), gz = Math.floor(g[1]);
  const h = (x, z) => { const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return (dx + dz) + (1.414 - 2) * Math.min(dx, dz); };
  const open = new Heap(), best = new Map(), from = new Map(), sk = key(sx, sz), gk = key(gx, gz);
  best.set(sk, 0); open.push({ x: sx, z: sz, g: 0, f: h(sx, sz) }); let n = 0, found = false;
  while (open.size && n++ < budget) { STATS.nodes++;
    const c = open.pop(), ck = key(c.x, c.z); if (c.g > best.get(ck)) continue; if (ck === gk) { found = true; break; }
    const cy = standY(c.x, c.z);
    for (const [dx, dz, w] of NB) { const nx = c.x + dx, nz = c.z + dz, ny = standY(nx, nz); if (ny < 0 || Math.abs(ny - cy) > 1) continue;
      if (dx && dz && (!walkable(c.x + dx, c.z) || !walkable(c.x, c.z + dz))) continue;   // no cutting wall corners
      const nk = key(nx, nz), ng = c.g + w * (isRoad(nx, nz) ? ROAD_COST : 1);
      if (ng < (best.get(nk) ?? Infinity)) { best.set(nk, ng); from.set(nk, ck); open.push({ x: nx, z: nz, g: ng, f: ng + h(nx, nz) }); } }
  }
  if (!found) return null;
  const cells = []; for (let k = gk; k !== undefined; k = from.get(k)) { cells.push([Math.floor(k / 8192) - 4096, (k % 8192) - 4096]); if (k === sk) break; }
  cells.reverse(); return pull(cells);
}

// string-pull: skip waypoints while the straight line stays walkable (with body width) and doesn't newly cross roadway
function clear(a, b, roadOK) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), steps = Math.ceil(L * 4), px = -dz / (L || 1) * .3, pz = dx / (L || 1) * .3; let py = standY(a[0], a[1]);
  for (let i = 1; i <= steps; i++) { const t = i / steps, x = a[0] + .5 + dx * t, z = a[1] + .5 + dz * t;
    for (const [ox, oz] of [[0, 0], [px, pz], [-px, -pz]]) { const cx = Math.floor(x + ox), cz = Math.floor(z + oz), y = standY(cx, cz);
      if (y < 0 || Math.abs(y - py) > 1 || (!roadOK && isRoad(cx, cz))) return false; if (!ox) py = y; } }
  return true;
}
function pull(cells) {
  const out = [cells[0]]; let i = 0;
  while (i < cells.length - 1) { let j = Math.min(cells.length - 1, i + 24), road = false;
    for (let k = i; k <= j; k++) if (isRoad(cells[k][0], cells[k][1])) { road = true; break; }
    while (j > i + 1 && !clear(cells[i], cells[j], road)) j--; out.push(cells[j]); i = j; }
  return out.map(([x, z]) => [x + .5, z + .5]);
}
