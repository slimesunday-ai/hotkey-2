// THE RUN'S CRIB, ARRANGED. The owner, 2026-11-13: "it needs to be modular for multiplayer and people should be
// allowed to arrange things with a starter pack, we have a whole home builder we should bring that in".
//
// The player picks up the things in their own trailer, moves them to any spot that fits, turns them, puts them away
// in a tray and takes them out again. The room is the starter's (set/starter.js: a layout in the kit's own format);
// what the player changes is kept as POSES, one per piece that is not where the layout has it, and the inside view
// builds the layout with them (starter.arrangeBy: the room is made again at once, set/crib.js remake). Nothing new is
// drawn: the held piece is the kit's own piece (its voxels, as room.js stamps them), the lit spots plain tiles.
//
// WHY NOT THE CITY'S EDITOR (interiors/city/builder.js) itself: its live test is the kit's rules with the kit's door,
// on a side wall, and it has no way to add ours (the run's doorway in the middle of the open front, where the player
// stands, the walk to the bed), so it would let a piece block them; it moves a slot's piece only into another slot,
// so the fish tank (a collectible: slots only) could never go anywhere but where it came; it draws its own copy of
// the room on the city's render layer, which the inside view does not draw nor its picking see; its tray is the whole
// trailer catalogue. So this is a small arrange of our own on the same 0.25 m grid, and what is valid is the kit's
// OWN check (interiors/home/rules.js, as the editor runs it: overlaps, support, walls, the kit door's swing, the
// safe's and the dog's floor; the full check, dressing too, before anything goes into the tray) and then the walk
// the run's scenes use, on the room as it would be built (interiors/city/plan.js homePlan, what set/crib.js builds):
//   · the doorway's step in finds the floor, and the room in front of the doorway (where its leaf swings in) and
//     where the player stands stay clear;
//   · where the player stands is free floor, on the same walkable floor as the doorway;
//   · the bed still has its place to lie down from, and every seat its own place to sit (so what is valid never
//     leans on a thing that a reload of the run, which starts it owning nothing, takes away).
// A move that breaks any of it is not a valid spot; it never lights.
//
// WHAT MOVES: the pieces on the floor and what stands on them (the lamp on the nightstand, the cactus on the counter),
// the real bed once owned (where the mattress was), and the things bought for the trailer (a thing's own floor slot
// moves with it: the fish tank). WHAT STAYS: the door and the window (the trailer's), the kitchenette (built in: the
// kit's fixed fixture, and it holds the counter's slots), the pictures on the walls, the loose floorboard (where the
// cash goes). Nothing stands on the bed (whoever sleeps there would lie in it).
//
//   const arrange = createArrange({ city, PLAN, starter, current, remake })   set/crib.js
//   arrange.of(key) → the run's pad's arrangement (the API below), or null for any other pad
import { LAYER } from '../inside.js';
import { wallSpots, wallWhy, wallPose, frontOf, wallLen, sideWord, hangY, SIDES } from './walls.js';

const CITY = new URL('../../../city/from-trunk/style/city/', import.meta.url).href;
/** A room cell (m), the kit's. */
const C4 = 0.25;
/** The page's own colours (the kit's zte tokens): the valid spots, the spot under the held piece, the piece pointed at. */
const LIME = 0x6cff4a;
const YEL = 0xffc21a;
const SLATE = 0x6d707a;
/** The held piece floats this far over its spot (m). */
const LIFT_Y = 0.08;
/** The aim: the nearest lit spot to the pointer, within this many pixels of it. */
const REACH = 140;
/** How many steps back undo keeps. */
const UNDOS = 60;
/** Plain names for the pieces (the kit's own names otherwise). */
const NAMES = {
  'mattress-floor': 'the mattress', 'bed-double': 'the bed', 'table-end': 'the nightstand', 'lamp-table': 'the lamp', 'tv-console': 'the TV',
  'tv-crt': 'the TV', recliner: 'the recliner', 'rug-rag': 'the rug', 'box-fan': 'the box fan', 'boxes-moving': 'the moving boxes', 'plant-cactus': 'the cactus',
  dresser: 'the dresser', beanbag: 'the beanbag', 'fish-tank': 'the fish tank', 'lava-lamp': 'the lava lamp', kitchenette: 'the kitchenette',
  'door-front': 'the door', window: 'the window', 'art-print': 'the print', poster: 'the poster', 'stash-floorboard': 'the loose floorboard',
};
const fnv = s => {
  let x = 2166136261;
  for (let k = 0; k < s.length; k++) x = Math.imul(x ^ s.charCodeAt(k), 16777619);
  return (x >>> 0).toString(36);
};
/** A piece of the run's tray (lib-1: a library piece, or a named thing with no spot of its own): starter.js keys it `L:…`. */
const isTray = key => typeof key === 'string' && key.startsWith('L:');
const rdims = (foot, rot) => ((((rot ?? 0) / 90) & 3) & 1 ? [foot[1], foot[0]] : [foot[0], foot[1]]);
const hitR = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
// the kit's errors without their numbering (the builder's own: a piece moved renumbers the list)
const norm = list => list.map(e => e.replace(/#\d+/g, '#').replace(/slot \d+/g, 'slot'));
const normN = list => norm(list).map(e => e.replace(/\d+(\.\d+)?/g, 'n'));
// a piece riding on another follows it: its middle in the parent's own frame, put back with the parent's new pose
// (the city's builder.js carry, the same arithmetic)
function carry(cx, cz, cfoot, crot, P0, P1, pfoot) {
  const [cw0, cd0] = rdims(cfoot, crot);
  const [w, d] = pfoot;
  const r0 = (P0.rot / 90) & 3;
  const r1 = (P1.rot / 90) & 3;
  const p0 = cx - P0.x + cw0 / 2;
  const q0 = cz - P0.z + cd0 / 2;
  const [u, v] = [[p0, q0], [w - q0, p0], [w - p0, d - q0], [q0, d - p0]][r0];
  const [p, q] = [[u, v], [v, w - u], [w - u, d - v], [d - v, u]][r1];
  const rot = ((((crot ?? 0) + (r1 - r0) * 90) % 360) + 360) % 360;
  const [cw1, cd1] = rdims(cfoot, rot);
  return { x: Math.round(P1.x + p - cw1 / 2), z: Math.round(P1.z + q - cd1 / 2), rot };
}

export function createArrange({ city, PLAN, starter, current, remake }) {
  const T = city.THREE;
  // ── the city's kit, as a library: the catalogue, its rules, its voxels (loaded once; nothing works before)
  let L = null;
  const ready = Promise.all([
    import(`${CITY}interiors/home/index.js`), import(`${CITY}interiors/home/rules.js`), import(`${CITY}vox.js`), import(`${CITY}glue.js`),
  ]).then(([HO, R, V, G]) => {
    L = { HO, RULES: R.makeRules(HO), rectOf: R.rectOf, FIXTURE: R.FIXTURE, Bank: V.Bank, meshVol: V.meshVol, geoOf: G.geoOf };
    return true;
  }).catch(err => {
    console.warn('[arrange] the kit did not load:', err);
    return false;
  });
  const byId = id => L?.HO.byId.get(id) ?? null;

  // ── THE ARRANGEMENT: key → pose (where a piece is now) or 'away' (in the tray). Only what differs from the layout.
  //   an item:            { x, z, rot, top?: the key it stands on, seed }   (seed: the look it had where it was)
  //   a thing's own slot: { x, z, rot }                                    (the fish tank)
  //   a slot's piece:     { x, z, rot, top, seed } off its slot, an item now; { slot: id } back in one
  let poses = new Map();
  // the piece held up: the room is built without it and without what rides on it
  let lifted = new Set();
  const undos = [];
  const redos = [];
  const listeners = new Set();
  // (checked against the walks once the room's frame is known: an arrangement read back from the browser)
  let unchecked = false;
  let settled = null;
  let fr = null;

  const pad = () => starter.pad;
  const has = () => starter.shows();
  const kit = (h = has()) => starter.kitWith(h);
  /** The fingerprint of what the arrangement is of: the layout file, its variant. A record of another is not read. */
  const print = () => `${starter.variant}:${fnv(JSON.stringify(starter.layout ?? null))}`;
  /** The crib's frame (its lifted entry, the door the plan reads, the room's frame): known once its place is made. */
  function frame() {
    if (fr) return fr;
    const P = current(pad())?.plan;
    if (!P) return null;
    const S0 = starter.marks();
    if (!S0) return null;
    fr = { h: P.h, door: { door: [P.door.stoop[0], P.door.y, P.door.stoop[1]], face: P.door.face }, F: P.F, x0: P.x0, seed: P.seed, S0 };
    return fr;
  }

  /**
   * THE LAYOUT AS ARRANGED: the kit's layout (door kept) with the poses put on it, and what is held up taken out.
   * (lib-1) A piece of the tray (key `L:…`, starter.js) is away unless it has a pose: `tray: false` leaves it in, at
   * its place-holder spot, for what needs every piece (the tray's list, the fit of a piece newly owned).
   */
  function applyTo(K, P0 = poses, up = lifted, { tray = true } = {}) {
    const P = { get: k => P0.get(k) ?? (tray && isTray(k) ? 'away' : undefined) };
    const A = structuredClone(K);
    const items = A.items.map(it => ({ ...it, top: it.on?.top !== undefined ? A.items[it.on.top]?.key ?? null : null }));
    // a slot's own piece (the counter's lava lamp): off its slot it is an item; back in a slot, that slot's
    for (const [i, sl] of A.slots.entries()) {
      const f = sl.fill;
      if (!f?.key) continue;
      const p = P.get(f.key);
      if (up.has(f.key) || p === 'away') {
        sl.fill = null;
        continue;
      }
      if (!p) continue;
      sl.fill = null;
      if (p.slot !== undefined) {
        const to = A.slots.find(s => s.id === p.slot);
        if (to && !to.fill) to.fill = { ...f };
        continue;
      }
      items.push({ id: f.id, variant: f.variant ?? 0, x: p.x, z: p.z, rot: p.rot ?? 0, on: 'floor', top: p.top ?? null, key: f.key, seed: p.seed, from: i });
    }
    // a thing's own floor slot (the fish tank): where it is now, or gone
    A.slots = A.slots.filter(sl => {
      if (!sl.key) return true;
      const p = P.get(sl.key);
      if (up.has(sl.key) || p === 'away') return false;
      if (p) Object.assign(sl, { x: p.x, z: p.z, rot: p.rot ?? 0 });
      return true;
    });
    // the items: where they are now, or gone (and what stands on one that goes, or on nothing, goes too)
    const keys = new Set(items.map(it => it.key));
    const gone = new Set();
    for (const it of items) {
      const p = it.from === undefined ? P.get(it.key) : null;
      if (up.has(it.key) || p === 'away') gone.add(it.key);
      else if (p?.wall) Object.assign(it, { x: p.x, z: 0, rot: 0, top: null, y: p.y ?? byId(it.id)?.mount ?? 0, on: { wall: p.wall } });   // (part D: hung on a wall)
      else if (p) Object.assign(it, { x: p.x, z: p.z, rot: p.rot ?? 0, top: p.top ?? null, ...(p.seed !== undefined ? { seed: p.seed } : {}), on: p.top ? it.on : 'floor' });
    }
    for (let more = true; more;) {
      more = false;
      for (const it of items) {
        if (gone.has(it.key) || !it.top || (keys.has(it.top) && !gone.has(it.top))) continue;
        gone.add(it.key);
        more = true;
      }
    }
    const kept = items.filter(it => !gone.has(it.key));
    const at = new Map(kept.map((it, k) => [it.key, k]));
    A.slots = A.slots.map(sl => (sl.place === 'surface' ? { ...sl, on: at.get(K.items[sl.on]?.key) ?? -1 } : sl));
    A.items = kept.map(({ top, from, ...it }) => ({ ...it, on: top ? { top: at.get(top) } : it.on?.wall ? it.on : it.on === 'ceiling' ? 'ceiling' : 'floor' }));
    return A;
  }

  // ── WHAT IS VALID ─────────────────────────────────────────────────────────────────────────────────────────────────
  /** The kit's own test of a move (the city's builder runs the same: geometry, the safe's and dog's floor, rugs apart). */
  function kitErrs(A) {
    const g = L.RULES.geometry(A);
    L.RULES.simSpots(A, g);
    // (lib-1: a stakes piece of the tray, a collectible or gear, stands as an item: the kit brings those in through
    // the layout's few slots, for the city's thefts, which the run does not play. Its other rules hold)
    const itemOf = e => A.items[+(/^#(\d+) /.exec(e)?.[1] ?? -1)];
    // (part D: the kit's "hidden behind" reads every wall but the back one as the right one; for the left wall the run
    // asks walls.js, which knows it, and gives the same rule)
    const E = g.E.filter(e => !(/stakes items come through slots/.test(e) && isTray(itemOf(e)?.key)) && !(/is hidden behind/.test(e) && itemOf(e)?.on?.wall === 'W'));
    A.items.forEach((it, k) => {
      if (it.on?.wall !== 'W' || !byId(it.id) || L.FIXTURE.has(it.id)) return;
      const o = byId(it.id);
      const y0 = it.y ?? o.mount ?? 0;
      const f = frontOf(A, byId, 'W').find(q => q.a0 < it.x + o.foot[0] && q.a1 > it.x && q.top > y0 + 0.02);
      if (f) E.push(`#${k} ${it.id} is hidden behind #${f.k} ${f.id}`);
    });
    const rugs = [];
    A.items.forEach((it, k) => {
      const o = byId(it.id);
      if (!o || o.cat !== 'rugs' || it.on !== 'floor') return;
      const rc = L.rectOf(it.x, it.z, o.foot, it.rot);
      for (const q of rugs) if (hitR(rc, q.rc)) E.push(`#${k} ${it.id} overlaps #${q.k} ${q.id}`);
      rugs.push({ k, id: it.id, rc });
    });
    return norm(E);
  }
  /** The kit's whole check (the dressing too): what putting a piece away must not make worse. */
  const fullErrs = A => normN(L.RULES.check(A).E);
  /** The run's own floor that stays clear (cells): in front of the doorway, where its leaf swings in, and where the player stands. */
  function keepClear() {
    const S0 = starter.marks();
    const R = starter.layout.room;
    if (!S0) return [];
    const [sx, sz] = S0.stand;
    return [[Math.round(S0.door) - 3, R.d - 5, 6, 5], [sx - 1, sz - 1, 2, 2]];
  }
  /**
   * The walk the run's scenes use, on the room as it would be built: null when it holds, else why not in plain words.
   * (Before the room's frame is known, the kit's check alone.)
   */
  function walkWhy(A) {
    const f = frame();
    if (!f) return null;
    let P = null;
    const built = starter.withoutDoor(A);
    try {
      P = PLAN.homePlan(f.h, built, f.door);
    } catch {
      return 'the room could not be walked';
    }
    if (!P?.act || !(P.door.inN >= 0)) return 'it would block the door';
    const G = P.G;
    const [sx, sz] = f.S0.stand;
    const cx = Math.round((sx * C4 - P.x0) / C4) - 1;
    const cz = Math.round((sz * C4) / C4) - 1;
    const k = cx + cz * G.RW;
    if (!(cx >= 0 && cz >= 0 && cx < G.RW && cz < G.RD && G.free[k] && G.comp[k] === G.main)) return 'it would block your way to where you stand';
    if (!P.byAct.get('sleep')?.some(q => q.bed)) return 'the bed would have no room to get into';
    // (every seat its own place to sit: spots.js keys a piece's spots `<id>#<n>/<seat>`, n counting that id in the list)
    const seen = new Map();
    for (const it of built.items) {
      const n = seen.get(it.id) ?? 0;
      seen.set(it.id, n + 1);
      if (byId(it.id)?.cat !== 'seating') continue;
      if (!P.spots.some(s => s.seat && s.key.startsWith(`${it.id}#${n}/`))) return `${nameOf(it.id)} would have no room to sit in`;
    }
    return null;
  }
  const valid = A => !kitErrs(A).length && !walkWhy(A);

  // ── THE PIECES of the room as arranged now: each with its key, what it is, where it stands, and whether it moves
  function piecesOf(A) {
    const out = [];
    A.items.forEach((it, k) => {
      const o = byId(it.id);
      if (!o) return;
      const parent = it.on?.top !== undefined ? A.items[it.on.top] : null;
      out.push({ key: it.key ?? `#${k}`, kind: 'item', id: it.id, o, it, k, parent: parent?.key ?? null, fixed: fixedWhy(o, it) });
    });
    A.slots.forEach((sl, i) => {
      if (!sl.fill) return;
      const o = byId(sl.fill.id);
      if (!o) return;
      const key = sl.key ?? sl.fill.key ?? `slot:${sl.id}`;
      const movable = !!(sl.key || sl.fill.key);
      out.push({ key, kind: sl.key ? 'slot' : 'fill', id: sl.fill.id, o, sl, i, parent: sl.place === 'surface' ? A.items[sl.on]?.key ?? null : null, fixed: movable ? null : sl.fits.includes('stash') ? 'where the cash goes' : 'built in' });
    });
    return out;
  }
  function fixedWhy(o, it) {
    if (isTray(it.key)) return null;   // (lib-1: what the player bought always moves)
    if (L.FIXTURE.has(o.id)) return 'part of the trailer';
    if (o.cat === 'kitchen') return 'built in';
    // (part D: a picture on the wall moves like the rest; the door and the window are the trailer's, FIXTURE above)
    if (o.place === 'ceiling') return 'on the ceiling';
    if (!it.key) return 'part of the trailer';
    return null;
  }
  const nameOf = id => NAMES[id] ?? `the ${(byId(id)?.name ?? id).toLowerCase()}`;
  /** The seed a piece's look is built with where it is (room.js: an item's own, else its x; a slot's piece, its slot). */
  const seedOf = p => (p.kind === 'item' ? p.it.seed ?? (frame()?.seed ?? 1) * 31 + (p.it.x ?? 0) : (frame()?.seed ?? 1) * 31 + 40 + p.i);
  /** A piece's pose in room metres (as room.js stamps it and the city's builder draws it): the group's place and turn, its box. */
  function poseOf(id, x, z, rot, y = 0) {
    const o = byId(id);
    const ox = frame()?.F.ox ?? 0;
    const r = ((rot ?? 0) / 90) & 3;
    const w = o.foot[0] * C4;
    const d = o.foot[1] * C4;
    const X = ox + x * C4;
    const Z = z * C4;
    const [rw, rd] = r & 1 ? [d, w] : [w, d];
    const Tt = [[X, Z], [X, Z + w], [X + w, Z + d], [X + d, Z]][r];
    return { p: [Tt[0], y, Tt[1]], ry: (r * Math.PI) / 2, box: [X, y, Z, X + rw, y + Math.max(0.05, o.h), Z + rd], c: [X + rw / 2, y, Z + rd / 2] };
  }
  /** A hung piece's pose in room metres (walls.js wallPose, with the room's width and the layout's offset). */
  const wallAt = (id, side, a, y) => wallPose(byId(id), side, a, y, frame()?.F.W ?? starter.layout.room.w * C4, frame()?.F.ox ?? 0);
  const topY = (A, k) => byId(A.items[k]?.id)?.tops?.[0] ?? 0.5;
  /** Where a piece of the room stands, as a pose (an item; a slot's piece, centred in its slot, as room.js puts it). */
  function placeOfPiece(A, p) {
    if (p.kind === 'item' && p.it.on?.wall) {
      const y = p.it.y ?? p.o.mount ?? 0;
      return { ...wallAt(p.id, p.it.on.wall, p.it.x, y), x: p.it.x, z: 0, rot: 0, wall: p.it.on.wall, y };
    }
    if (p.kind === 'item') {
      const y = p.it.on?.top !== undefined ? topY(A, p.it.on.top) : 0;
      return { ...poseOf(p.id, p.it.x, p.it.z, p.it.rot, y), x: p.it.x, z: p.it.z, rot: p.it.rot ?? 0 };
    }
    const sl = p.sl;
    const [ow, od] = p.o.foot;
    const x = sl.x + Math.max(0, Math.floor((sl.foot[0] - ow) / 2));
    const z = sl.z + (sl.place === 'floor' || sl.place === 'surface' ? Math.max(0, Math.floor((sl.foot[1] - od) / 2)) : 0);
    const y = sl.place === 'surface' ? topY(A, sl.on) : 0;
    return { ...poseOf(p.id, x, z, sl.rot ?? 0, y), x, z, rot: sl.rot ?? 0 };
  }

  // ── THE HELD PIECE AND WHERE IT MAY GO ──────────────────────────────────────────────────────────────────────────
  let held = null;
  /**
   * Every valid spot for the held piece at its turn: a floor piece anywhere on the floor it fits; a piece that stands
   * on something, on any top but the bed's (and a slot's piece back in its own slot); a thing's slot, on the floor.
   * Each is the whole arrangement it would make, tested whole.
   */
  function candidates(H) {
    const t0 = performance.now();
    const K = kit();
    const A0 = applyTo(K, poses, new Set([H.key, ...H.riders.map(r => r.key)]));
    const R = A0.room;
    const out = [];
    const base = new Set(H.baseErr);
    const test = (changes, walk) => {
      const P2 = new Map(poses);
      for (const [k, v] of changes) P2.set(k, v);
      const A = applyTo(K, P2, new Set());
      if (!kitErrs(A).every(e => base.has(e))) return null;
      if (walk && walkWhy(A)) return null;
      return A;
    };
    const o = H.o;
    const [rw, rd] = rdims(H.kind === 'slot' ? H.foot : o.foot, H.rot);
    const g0 = L.RULES.geometry(A0);
    const occ = new Set();
    for (const p of g0.solid) for (const [x, z, over] of p.cells) if (!over) occ.add(`${x},${z}`);
    // (a rug goes under things and in front of the door, never over the floorboard; anything else nowhere taken)
    const slotRs = g0.floorSlots.map(q => q.rc);
    const hard = [...slotRs, ...(g0.doorRect ? [g0.doorRect] : []), ...keepClear()];
    const rug = o.cat === 'rugs';
    const free = (x, z) => {
      const rc = [x, z, rw, rd];
      if (rug) return !slotRs.some(q => hitR(rc, q));
      for (let a = 0; a < rw; a++) for (let b = 0; b < rd; b++) if (occ.has(`${x + a},${z + b}`)) return false;
      return !hard.some(q => hitR(rc, q));
    };
    const push = (P, changes, A, y = 0) => {
      const pose = poseOf(H.id, P.x, P.z, H.rot, y);
      const cells = [];
      for (let a = 0; a < rw; a++) for (let b = 0; b < rd; b++) cells.push([P.x + a, P.z + b]);
      out.push({ P, changes, A, c: pose.c, y, cells });
    };
    const riderChanges = P1 => H.riders.map(r => [r.key, { ...carry(r.x, r.z, r.o.foot, r.rot, H.orig, P1, o.foot), top: H.key, seed: r.seed }]);
    if (H.kind === 'slot') {
      for (let z = 0; z + rd <= R.d; z++) for (let x = 0; x + rw <= R.w; x++) {
        if (!free(x, z)) continue;
        const P = { x, z, rot: H.rot };
        const changes = [[H.key, P]];
        const A = test(changes, true);
        if (A) push(P, changes, A);
      }
    } else if (o.place === 'floor') {
      for (let z = 0; z + rd <= R.d; z++) for (let x = 0; x + rw <= R.w; x++) {
        if (!free(x, z)) continue;
        const P = { x, z, rot: H.rot, seed: H.seed };
        const changes = [[H.key, P], ...riderChanges(P)];
        const A = test(changes, true);
        if (A) push(P, changes, A);
      }
    } else if (o.place === 'wall') {
      // (part D) every wall the view shows, at the piece's own height; walls.js says where it may not hang (the door,
      // the window, what hangs there, furniture in front), the kit's check has the last word
      for (const sp of wallSpots(A0, byId, { id: H.id, key: H.key }, nameOf)) {
        if (sp.why) continue;
        const P = { wall: sp.side, x: sp.a, y: sp.y };
        const changes = [[H.key, P]];
        const A = test(changes, false);
        if (!A) continue;
        const pose = wallAt(H.id, sp.side, sp.a, sp.y);
        const cells = [];
        for (let a = 0; a < o.foot[0]; a++) cells.push([sp.side, sp.a + a]);
        out.push({ P, changes, A, c: pose.c, y: sp.y, cells, wall: sp.side });
      }
    } else if (o.place === 'surface') {
      A0.items.forEach((Pm, k) => {
        const po = byId(Pm.id);
        if (!po?.tops?.length || Pm.on?.top !== undefined || Pm.on?.wall || Pm.on === 'ceiling' || po.cat === 'beds' || !Pm.key) return;
        const [pw, pd] = rdims(po.foot, Pm.rot);
        for (let z = Pm.z; z + rd <= Pm.z + pd; z++) for (let x = Pm.x; x + rw <= Pm.x + pw; x++) {
          const P = { x, z, rot: H.rot, top: Pm.key, seed: H.seed };
          const changes = [[H.key, P]];
          const A = test(changes, false);
          if (A) push(P, changes, A, po.tops[0]);
        }
      });
      // (a slot's own piece: back into its own slot, when that is empty)
      if (H.home) {
        const sl = A0.slots.find(s => s.id === H.home);
        if (sl && !sl.fill) {
          const changes = [[H.key, { slot: H.home }]];
          const A = test(changes, false);
          if (A) {
            const p = piecesOf(A).find(q => q.key === H.key);
            const at = p && placeOfPiece(A, p);
            if (at) push({ x: at.x, z: at.z, rot: at.rot, slot: H.home }, changes, A, at.p[1]);
          }
        }
      }
    }
    H.ms = Math.round(performance.now() - t0);
    return out;
  }
  /** The candidate that leaves the piece where it is (picked up and put straight back: nothing changes). */
  const sameSpot = (H, q) => H.orig && q.P.x === H.orig.x && (q.P.wall ? q.P.wall === H.orig.wall : q.P.z === H.orig.z && q.P.rot === H.orig.rot && !H.orig.wall) && (q.P.top ?? null) === (H.orig.top ?? null) && (q.P.slot ?? null) === (H.orig.slot ?? null);

  /** Picks up a piece of the room (from: 'room') or out of the tray ('tray'). → { ok, why } */
  function hold(key, from) {
    if (!L) return { ok: false, why: 'not ready yet' };
    if (held) cancel();
    const K = kit();
    const A = applyTo(K);
    const now = piecesOf(A);
    let H = null;
    if (from === 'room') {
      const p = now.find(q => q.key === key);
      if (!p) return { ok: false, why: 'that is not in the room' };
      if (p.fixed) return { ok: false, why: `${nameOf(p.id)}: ${p.fixed}` };
      const at = placeOfPiece(A, p);
      const riders = now.filter(q => q.kind === 'item' && q.parent === key).map(q => ({ key: q.key, id: q.id, o: q.o, x: q.it.x, z: q.it.z, rot: q.it.rot ?? 0, seed: seedOf(q), variant: q.it.variant ?? 0, state: q.it.state }));
      H = {
        key, id: p.id, o: p.o, kind: p.kind === 'slot' ? 'slot' : 'item', foot: p.sl?.foot ?? p.o.foot, rot: at.rot, seed: seedOf(p), state: p.it?.state ?? p.sl?.fill?.state,
        variant: p.it?.variant ?? p.sl?.fill?.variant ?? 0, riders, from, home: p.kind === 'fill' ? p.sl.id : homeOf(K, key),
        orig: { x: at.x, z: at.z, rot: at.rot, top: p.kind === 'item' ? p.parent : null, slot: p.kind === 'fill' ? p.sl.id : null, wall: at.wall ?? null },
      };
    } else {
      const t = trayOf(K).find(q => q.key === key);
      if (!t) return { ok: false, why: 'that is not in the tray' };
      H = { key, id: t.id, o: byId(t.id), kind: t.kind, foot: t.foot, rot: t.rot ?? 0, seed: t.seed, state: t.state, variant: t.variant ?? 0, riders: [], from, home: t.home, orig: null, def: t.def };
    }
    H.baseErr = kitErrs(A);
    H.cands = candidates(H);
    if (!H.cands.length) {
      // (turned, it may fit)
      for (let k = 1; k <= 3 && !H.cands.length; k++) {
        H.rot = (H.rot + 90) % 360;
        H.cands = candidates(H);
      }
      if (!H.cands.length) return { ok: false, why: `nowhere ${nameOf(H.id)} fits right now` };
    }
    held = H;
    box.visible = false;
    pointed = null;
    // where it starts: where it was (from the room), else the spot nearest its own (from the tray)
    const near = H.orig ?? H.def ?? { x: 0, z: 0 };
    H.cur = H.cands.find(q => sameSpot(H, q)) ?? nearest(H.cands, near);
    lifted = new Set([key, ...H.riders.map(r => r.key)]);
    showHeld();
    rebuild();
    emit();
    return { ok: true, why: null };
  }
  const nearest = (C, at) => C.reduce((b, q) => (!b || Math.hypot(q.P.x - at.x, q.P.z - at.z) < Math.hypot(b.P.x - at.x, b.P.z - at.z) ? q : b), null);
  /** A thing's own slot in the layout as it is (its `fill` key), for a piece that came out of one. */
  function homeOf(K, key) {
    return K.slots.find(s => s.fill?.key === key)?.id ?? null;
  }
  /** THE TRAY: what is owned and put away (only what the room as owned has: nothing not owned is ever in it). */
  function trayOf(K = kit()) {
    const whole = applyTo(K, new Map(), new Set(), { tray: false });
    const all = piecesOf(whole);
    const out = [];
    for (const p of all) {
      if ((poses.get(p.key) ?? (isTray(p.key) ? 'away' : null)) !== 'away') continue;
      const at = placeOfPiece(whole, p);
      out.push({ key: p.key, id: p.id, name: nameOf(p.id), kind: p.kind === 'slot' ? 'slot' : 'item', foot: p.sl?.foot ?? p.o.foot, rot: at.rot, seed: seedOf(p), state: p.it?.state, variant: p.it?.variant ?? p.sl?.fill?.variant ?? 0, home: p.kind === 'fill' ? p.sl.id : null, def: { x: at.x, z: at.z } });
    }
    return out;
  }
  /** Turns what is held a quarter (to the next turn any spot fits it at). → { ok, why } */
  function turn() {
    if (!held) return { ok: false, why: 'pick something up first' };
    const H = held;
    if (H.o.place === 'wall') return { ok: false, why: `${nameOf(H.id)} hangs flat on a wall: point at another wall to move it there` };
    const was = H.rot;
    const at = H.cur ? H.cur.P : null;
    for (let k = 1; k <= 3; k++) {
      H.rot = (was + 90 * k) % 360;
      const C = candidates(H);
      if (!C.length) continue;
      H.cands = C;
      H.cur = at ? nearest(C, at) : C[0];
      showHeld();
      emit();
      return { ok: true, why: null };
    }
    H.rot = was;
    return { ok: false, why: `no spot fits ${nameOf(H.id)} turned` };
  }
  /** Puts what is held down where it is aimed. → Promise<{ ok, why }> */
  async function drop() {
    if (!held) return { ok: false, why: 'nothing held' };
    const H = held;
    const q = H.cur;
    if (H.refused) return { ok: false, why: `${nameOf(H.id)} can't hang there: ${H.refused.why}` };   // (part D: pointed at a stretch it may not hang on)
    if (!q) return { ok: false, why: 'move it onto a lit spot first' };
    if (H.from === 'room' && sameSpot(H, q)) return cancel();
    const next = new Map(poses);
    for (const [k, v] of q.changes) next.set(k, v);
    commit(next, `${nameOf(H.id)} moved`);
    return finish();
  }
  /** Puts what is held back where it was (from the tray: back in the tray). */
  async function cancel() {
    if (!held) return { ok: true, why: null };
    return finish();
  }
  async function finish() {
    const ghost = heldView;
    held = null;
    lifted = new Set();
    hideTiles();
    emit();
    await rebuild();
    // (the held piece stays drawn until the room stands with it in)
    dropView(ghost);
    return { ok: true, why: null };
  }
  /** Puts a piece away in the tray: what is held, else `key`. Never what the room cannot do without (its bed, its seat…). */
  async function putAway(key = null) {
    if (!L) return { ok: false, why: 'not ready yet' };
    const k = key ?? held?.key ?? null;
    if (!k) return { ok: false, why: 'point at something first' };
    const K = kit();
    // (what is held counts as where it was)
    const before = applyTo(K, poses, new Set());
    const p = piecesOf(before).find(q => q.key === k);
    if (!p) return { ok: false, why: 'that is not in the room' };
    if (p.fixed) return { ok: false, why: `${nameOf(p.id)}: ${p.fixed}` };
    const next = new Map(poses);
    next.set(k, 'away');
    // (what stands on it goes with it)
    for (const q of piecesOf(before)) if (q.kind === 'item' && q.parent === k) next.set(q.key, 'away');
    const after = applyTo(K, next, new Set());
    const was = new Set(fullErrs(before));
    const worse = fullErrs(after).filter(e => !was.has(e));
    if (worse.length) return { ok: false, why: `${nameOf(p.id)} stays out: ${plainWhy(worse[0])}` };
    const walk = walkWhy(after);
    if (walk) return { ok: false, why: `${nameOf(p.id)} stays out: ${walk}` };
    if (held) {
      held = null;
      lifted = new Set();
      hideTiles();
    }
    const ghost = heldView;
    commit(next, `${nameOf(p.id)} put away`);
    emit();
    await rebuild();
    dropView(ghost);
    return { ok: true, why: null };
  }
  /** The kit's words for why not, in the page's. */
  function plainWhy(e) {
    if (/nowhere to sleep|no bed/.test(e)) return 'the trailer needs a bed';
    if (/nowhere to sit/.test(e)) return 'the trailer needs somewhere to sit';
    if (/kitchen/.test(e)) return 'the trailer needs its kitchen';
    if (/rug/.test(e)) return 'the trailer wants at least one rug down';
    if (/wall art/.test(e)) return 'the trailer wants something on its walls';
    if (/lived-in/.test(e)) return 'the trailer wants a few lived-in things out (a lamp, a plant, the boxes)';
    return e.replace(/^dressing: /, '');
  }
  function commit(next, what) {
    undos.push({ poses: new Map(poses), what });
    if (undos.length > UNDOS) undos.shift();
    redos.length = 0;
    poses = clean(next);
  }
  /** A pose the same as the layout's own is no pose: an untouched room keeps nothing. */
  function clean(P) {
    const K = kit();
    const def = applyTo(K, new Map(), new Set());
    const out = new Map();
    for (const [k, v] of P) {
      // (a piece of the tray: its pose is where the player put it; away is its own default)
      if (isTray(k)) {
        if (v !== 'away') out.set(k, v);
        continue;
      }
      if (v === 'away') {
        out.set(k, v);
        continue;
      }
      const p = piecesOf(def).find(q => q.key === k);
      if (!p) {
        out.set(k, v);
        continue;
      }
      const at = placeOfPiece(def, p);
      const same = v.wall ? at.wall === v.wall && at.x === v.x && Math.abs((at.y ?? 0) - (v.y ?? at.y ?? 0)) < 1e-6 : at.wall ? false : v.slot !== undefined ? p.kind === 'fill' && p.sl.id === v.slot : at.x === v.x && at.z === v.z && (at.rot ?? 0) === (v.rot ?? 0) && (p.kind === 'item' ? (p.parent ?? null) === (v.top ?? null) : p.kind === 'slot');
      if (!same) out.set(k, v);
    }
    return out;
  }
  async function undo() {
    if (held) await cancel();
    const u = undos.pop();
    if (!u) return null;
    redos.push({ poses: new Map(poses), what: u.what });
    poses = u.poses;
    emit();
    await rebuild();
    return u.what;
  }
  async function redo() {
    if (held) await cancel();
    const r = redos.pop();
    if (!r) return null;
    undos.push({ poses: new Map(poses), what: r.what });
    poses = r.poses;
    emit();
    await rebuild();
    return r.what;
  }

  // ── THE ROOM MADE AGAIN (set/crib.js remake: the place made at once, its room swapped in where the old one stood),
  // one at a time: a swap waits for the one before it
  let chain = Promise.resolve();
  function rebuild() {
    const run = chain.then(() => (pad() ? remake(pad()) : null)).catch(err => {
      console.warn('[arrange] the room was not made again:', err);
      return null;
    });
    chain = run;
    return run;
  }

  // ── WHAT IS SEEN while arranging: the held piece (the kit's own, over its spot), the lit spots, what is pointed at
  let active = false;
  let raf = 0;
  const eg = new T.Group();
  eg.name = 'hk2-arrange';
  const MATS = [
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 }),
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.1 }),
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85 }),
    new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  ];
  const TILE = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const tileM = new T.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false });
  const tiles = new T.InstancedMesh(TILE, tileM, 1536);
  tiles.count = 0;
  tiles.frustumCulled = false;
  tiles.renderOrder = 2;
  const footM = new T.MeshBasicMaterial({ color: YEL, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
  const foot = new T.Mesh(TILE, footM);
  foot.renderOrder = 3;
  foot.visible = false;
  const boxM = new T.LineBasicMaterial({ color: YEL, transparent: true, depthTest: false });
  const box = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1)), boxM);
  box.renderOrder = 4;
  box.visible = false;
  // (part D: the lit stretches of wall, upright tiles; where a hung piece is refused, a red one)
  const WTILE = new T.PlaneGeometry(1, 1);
  const wtiles = new T.InstancedMesh(WTILE, tileM, 512);
  wtiles.count = 0;
  wtiles.frustumCulled = false;
  wtiles.renderOrder = 2;
  const nopeM = new T.MeshBasicMaterial({ color: 0xe0352b, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, side: T.DoubleSide });
  const nope = new T.Mesh(WTILE, nopeM);
  nope.renderOrder = 3;
  nope.visible = false;
  const QW = new T.Quaternion();
  const UPV = new T.Vector3(0, 1, 0);
  eg.add(tiles, foot, box, wtiles, nope);
  const geos = new Map();
  function pieceGroup(id, variant, seed, state) {
    const k = `${id}|${variant}|${seed}|${state ?? ''}`;
    let G = geos.get(k);
    if (!G) {
      const o = byId(id);
      const V = L.HO.buildObject(o, { variant, seed, state });
      const b = new L.Bank(true);
      L.meshVol(V, b);
      G = b.L.map((O, li) => (O.v ? { g: L.geoOf(O), li } : null)).filter(Boolean);
      geos.set(k, G);
    }
    const grp = new T.Group();
    for (const { g, li } of G) grp.add(new T.Mesh(g, MATS[li] ?? MATS[0]));
    return grp;
  }
  let heldView = null;
  function showHeld() {
    const H = held;
    if (!H) return;
    if (!heldView || heldView.key !== H.key) {
      dropView(heldView);
      const g = new T.Group();
      const main = pieceGroup(H.id, H.variant, H.seed, H.state);
      g.add(main);
      const riders = H.riders.map(r => {
        const m = pieceGroup(r.id, r.variant, r.seed, r.state);
        g.add(m);
        return { r, m };
      });
      heldView = { key: H.key, g, main, riders, at: null };
      eg.add(g);
    }
    drawTiles();
    place();
  }
  function dropView(v) {
    if (!v) return;
    v.g.removeFromParent();
    if (v === heldView) heldView = null;
  }
  /** The held piece, and what rides on it, where the aimed spot puts them (eased there each frame). */
  function place() {
    const H = held;
    const v = heldView;
    if (!H || !v || !H.cur) return;
    const q = H.cur;
    if (q.P.wall) {
      // (hung: on its wall, held a little off it into the room; no square under it, its stretch of wall is lit)
      const P = wallAt(H.id, q.P.wall, q.P.x, q.y);
      const off = q.P.wall === 'N' ? [0, 0, 0.06] : q.P.wall === 'E' ? [-0.06, 0, 0] : [0.06, 0, 0];
      v.want = [{ m: v.main, P: { ...P, p: [P.p[0] + off[0], P.p[1] - LIFT_Y, P.p[2] + off[2]] } }];
      if (!v.at) for (const w of v.want) snapTo(w.m, w.P);
      v.at = true;
      foot.visible = false;
      return;
    }
    const P = poseOf(H.id, q.P.x, q.P.z, H.rot, q.y);
    v.want = [{ m: v.main, P }];
    for (const { r, m } of v.riders) {
      const c = q.changes.find(([k]) => k === r.key)?.[1];
      if (c) v.want.push({ m, P: poseOf(r.id, c.x, c.z, c.rot, q.y + (byId(H.id)?.tops?.[0] ?? 0.5)) });
    }
    if (!v.at) for (const w of v.want) snapTo(w.m, w.P);
    v.at = true;
    // the spot under it, whole
    const b = P.box;
    foot.position.set((b[0] + b[3]) / 2, q.y + 0.018, (b[2] + b[5]) / 2);
    foot.scale.set(b[3] - b[0] - 0.02, 1, b[5] - b[2] - 0.02);
    foot.visible = true;
  }
  function snapTo(m, P) {
    m.position.set(P.p[0], P.p[1] + LIFT_Y, P.p[2]);
    m.rotation.set(0, P.ry, 0);
  }
  const MX = new T.Matrix4();
  const V3 = new T.Vector3();
  const QI = new T.Quaternion();
  const S3 = new T.Vector3();
  /** Every cell some valid spot covers, at its height: the floor the held piece can go to. */
  function drawTiles() {
    const H = held;
    if (!H) return hideTiles();
    const seen = new Set();
    let n = 0;
    const ox = frame()?.F.ox ?? 0;
    let nw = 0;
    const o = H.o;
    for (const q of H.cands) {
      if (!q.wall) continue;
      for (const [side, a] of q.cells) {
        const k = `${side},${a}`;
        if (seen.has(k) || nw >= wtiles.instanceMatrix.count) continue;
        seen.add(k);
        const hgt = o.foot[1] * C4;
        const Wm = frame()?.F.W ?? starter.layout.room.w * C4;
        const at = side === 'N' ? [ox + (a + 0.5) * C4, q.y + hgt / 2, 0.012] : side === 'E' ? [Wm - 0.012, q.y + hgt / 2, (a + 0.5) * C4] : [0.012, q.y + hgt / 2, (a + 0.5) * C4];
        QW.setFromAxisAngle(UPV, side === 'N' ? 0 : side === 'E' ? -Math.PI / 2 : Math.PI / 2);
        MX.compose(V3.set(...at), QW, S3.set(C4 * 0.8, hgt * 0.92, 1));
        wtiles.setMatrixAt(nw++, MX);
      }
    }
    wtiles.count = nw;
    wtiles.instanceMatrix.needsUpdate = true;
    wtiles.visible = nw > 0;
    for (const q of H.cands) for (const [x, z] of q.wall ? [] : q.cells) {
      const k = `${x},${z},${q.y}`;
      if (seen.has(k) || n >= tiles.instanceMatrix.count) continue;
      seen.add(k);
      MX.compose(V3.set(ox + (x + 0.5) * C4, q.y + 0.012, (z + 0.5) * C4), QI, S3.set(C4 * 0.8, 1, C4 * 0.8));
      tiles.setMatrixAt(n++, MX);
    }
    tiles.count = n;
    tiles.instanceMatrix.needsUpdate = true;
    tiles.visible = n > 0;
  }
  function hideTiles() {
    tiles.count = 0;
    tiles.visible = false;
    wtiles.count = 0;
    wtiles.visible = false;
    nope.visible = false;
    foot.visible = false;
  }
  function syncFrame() {
    const f = frame();
    if (!f) return false;
    const F = f.F;
    eg.position.set(F.origin[0], F.origin[1], F.origin[2]);
    eg.rotation.set(0, F.th, 0);
    eg.updateMatrixWorld(true);
    return true;
  }
  function loop(t) {
    raf = active ? requestAnimationFrame(loop) : 0;
    const v = heldView;
    if (v?.want) {
      for (const w of v.want) {
        const bob = Math.sin(t / 170) * 0.012;
        w.m.position.x += (w.P.p[0] - w.m.position.x) * 0.35;
        w.m.position.y += (w.P.p[1] + LIFT_Y + bob - w.m.position.y) * 0.35;
        w.m.position.z += (w.P.p[2] - w.m.position.z) * 0.35;
        let dr = w.P.ry - w.m.rotation.y;
        dr = Math.atan2(Math.sin(dr), Math.cos(dr));
        w.m.rotation.y += dr * 0.35;
      }
    }
    tileM.opacity = 0.45 + Math.sin(t / 300) * 0.08;
    eg.traverse(o => o.layers.set(LAYER));
  }
  // ── the pointer: what is under it, and the held piece's aim
  const cam = city.camera;
  const canvas = city.renderer.domElement;
  const ray = new T.Raycaster();
  const ndc = new T.Vector2();
  const inv = new T.Matrix4();
  const B3 = new T.Box3();
  const HIT = new T.Vector3();
  function localRay(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    inv.copy(eg.matrixWorld).invert();
    return ray.ray.clone().applyMatrix4(inv);
  }
  function screenOf(c) {
    const r = canvas.getBoundingClientRect();
    V3.set(c[0], c[1], c[2]).applyMatrix4(eg.matrixWorld).project(cam);
    return [r.left + ((V3.x + 1) / 2) * r.width, r.top + ((1 - V3.y) / 2) * r.height, V3.z];
  }
  /** The piece under the pointer (the nearest box the ray meets), or null. */
  function pieceAt(x, y) {
    if (!L || !syncFrame()) return null;
    const A = applyTo(kit());
    const lr = localRay(x, y);
    let best = null;
    let bd = Infinity;
    for (const p of piecesOf(A)) {
      if (L.FIXTURE.has(p.id) || (p.kind !== 'item' && p.o.place === 'wall')) continue;
      const at = placeOfPiece(A, p);
      const b = at.box;
      B3.min.set(b[0], b[1], b[2]);
      B3.max.set(b[3], Math.max(b[4], b[1] + 0.12), b[5]);
      if (!lr.intersectBox(B3, HIT)) continue;
      const d = HIT.distanceTo(lr.origin) - (p.parent ? 0.3 : 0);
      if (d < bd) {
        bd = d;
        best = { p, at };
      }
    }
    return best;
  }
  let pointed = null;
  function hover(x, y) {
    if (held) {
      box.visible = false;
      pointed = null;
      return null;
    }
    const hit = pieceAt(x, y);
    pointed = hit ? hit.p.key : null;
    if (hit) {
      const b = hit.at.box;
      box.position.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
      box.scale.set(b[3] - b[0] + 0.04, b[4] - b[1] + 0.04, b[5] - b[2] + 0.04);
      boxM.color.setHex(hit.p.fixed ? SLATE : YEL);
      box.visible = true;
    } else box.visible = false;
    return hit ? { key: hit.p.key, name: nameOf(hit.p.id), fixed: hit.p.fixed } : null;
  }
  /** Aims what is held at the lit spot nearest the pointer. → true when the aim changed */
  function aimAt(x, y) {
    const H = held;
    if (!H || !syncFrame()) return false;
    if (H.o.place === 'wall') return aimWall(x, y);
    let best = null;
    let bd = Infinity;
    for (const q of H.cands) {
      const s = screenOf([q.c[0], q.y, q.c[2]]);
      if (s[2] > 1) continue;
      const d = Math.hypot(s[0] - x, s[1] - y) - (q === H.cur ? 6 : 0);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    if (!best || bd > REACH || best === H.cur) return false;
    H.cur = best;
    place();
    emit();
    return true;
  }

  /**
   * (part D) Aims a hung piece: the wall under the pointer, the stretch the piece's middle is over. Lit: it goes there.
   * Not lit: the stretch goes red and `held.refused` says why (walls.js: the door, the window, what hangs there,
   * what stands in front of it).
   */
  function aimWall(x, y) {
    const H = held;
    const lr = localRay(x, y);
    const f = frame();
    const Wm = f?.F.W ?? starter.layout.room.w * C4;
    const Dm = starter.layout.room.d * C4;
    const Hm = starter.layout.room.h ?? 2.45;
    let hit = null;
    for (const side of SIDES) {
      const plane = side === 'N' ? new T.Plane(new T.Vector3(0, 0, 1), 0) : side === 'E' ? new T.Plane(new T.Vector3(-1, 0, 0), Wm) : new T.Plane(new T.Vector3(1, 0, 0), 0);
      const pt = lr.intersectPlane(plane, new T.Vector3());
      if (!pt || pt.y < 0 || pt.y > Hm) continue;
      const along = side === 'N' ? pt.x - (f?.F.ox ?? 0) : pt.z;
      if (along < 0 || along > (side === 'N' ? Wm : Dm) || (side !== 'N' && (pt.z < 0 || pt.z > Dm)) || (side === 'N' && (pt.x < 0 || pt.x > Wm))) continue;
      const d = pt.distanceTo(lr.origin);
      if (!hit || d < hit.d) hit = { side, along, d };
    }
    if (!hit) return false;
    const len = wallLen(starter.layout, hit.side);
    const a = Math.max(0, Math.min(len - H.o.foot[0], Math.round(hit.along / C4 - H.o.foot[0] / 2)));
    const q = H.cands.find(c => c.P.wall === hit.side && c.P.x === a) ?? H.cands.filter(c => c.P.wall === hit.side).sort((u, v) => Math.abs(u.P.x - a) - Math.abs(v.P.x - a))[0];
    if (q && Math.abs(q.P.x - a) <= 1) {
      H.refused = null;
      nope.visible = false;
      if (q === H.cur) return false;
      H.cur = q;
      place();
      emit();
      return true;
    }
    // refused here: why, and the stretch in red
    const A0 = applyTo(kit(), poses, new Set([H.key]));
    const yh = hangY(A0, H.o) ?? H.o.mount ?? 0;
    const why = wallWhy(A0, byId, { id: H.id, key: H.key }, hit.side, a, yh, nameOf) ?? 'it does not fit there';
    const was = H.refused;
    H.refused = { wall: hit.side, x: a, why, where: sideWord(hit.side) };
    const P = wallAt(H.id, hit.side, a, yh);
    const b = P.box;
    const off = hit.side === 'N' ? [0, 0, 0.02] : hit.side === 'E' ? [-0.02, 0, 0] : [0.02, 0, 0];
    nope.position.set((b[0] + b[3]) / 2 + off[0], (b[1] + b[4]) / 2, hit.side === 'N' ? 0.02 : (b[2] + b[5]) / 2);
    nope.rotation.set(0, hit.side === 'N' ? 0 : hit.side === 'E' ? -Math.PI / 2 : Math.PI / 2, 0);
    nope.scale.set(H.o.foot[0] * C4, H.o.foot[1] * C4, 1);
    nope.visible = true;
    // (the held piece goes to where it is pointed, over the red: what would go wrong is seen, not only said)
    if (heldView) heldView.want = [{ m: heldView.main, P: { ...P, p: [P.p[0] + off[0] * 3, P.p[1] - LIFT_Y, P.p[2] + off[2] * 3] } }];
    if (was?.why !== why || was?.x !== a || was?.wall !== hit.side) emit();
    return false;
  }

  // ── KEPT: the arrangement as a plain record, and read back (checked whole first)
  function record() {
    if (!poses.size) return null;
    return { v: 1, of: print(), poses: Object.fromEntries(poses) };
  }
  async function load(rec) {
    await ready;
    if (!L) return { ok: false, why: 'the kit did not load' };
    if (!rec || rec.v !== 1 || rec.of !== print() || !rec.poses || typeof rec.poses !== 'object') return { ok: false, why: rec ? 'a record of another layout' : 'nothing kept' };
    const P = new Map(Object.entries(rec.poses).filter(([, v]) => v === 'away' || (v && typeof v === 'object')));
    const A = applyTo(kit(), P, new Set());
    if (kitErrs(A).length) return { ok: false, why: `it does not pass the kit's check: ${kitErrs(A)[0]}` };
    const w = walkWhy(A);
    if (w) return { ok: false, why: w };
    poses = P;
    unchecked = !frame();
    settled = null;
    undos.length = 0;
    redos.length = 0;
    emit();
    await rebuild();
    return { ok: true, why: null };
  }
  /** Back to the layout as it is (a new run). */
  async function reset() {
    if (held) await cancel();
    poses = new Map();
    undos.length = 0;
    redos.length = 0;
    emit();
    await rebuild();
  }

  /**
   * SETTLED for what is owned now (asked every time the room's signature is): a piece newly owned arrives where it
   * was last put (the real bed: where the mattress stood), else as near to that as fits; else its own spot, else as
   * near to it as fits; else the tray (never the bed: the room cannot do without one).
   */
  function settle(h) {
    if (!L) return;
    const sig = JSON.stringify(h);
    const f = frame();
    if (sig === settled?.sig && !(unchecked && f)) return;
    const K = kit(h);
    const ids = new Set(K.items.map(it => `${it.key}:${it.id}`).concat(K.slots.filter(s => s.key || s.fill?.key).map(s => `${s.key ?? s.fill.key}:${s.fill?.id}`)));
    const before = settled?.ids ?? ids;
    settled = { sig, ids };
    if (unchecked && f) unchecked = false;
    if (!poses.size) return;
    if (valid(applyTo(K, poses, new Set()))) return;
    const fresh = [...ids].filter(x => !before.has(x)).map(x => x.slice(0, x.lastIndexOf(':')));
    // (the nearest spot that fits, at a turn, to a point: from the arrangement as it is, this piece left out)
    const fit = (key, at, rot) => {
      const def = applyTo(K, new Map(), new Set(), { tray: false });
      const p = piecesOf(def).find(q => q.key === key);
      if (!p) return null;
      const H = { key, id: p.id, o: p.o, kind: p.kind === 'slot' ? 'slot' : 'item', foot: p.sl?.foot ?? p.o.foot, rot, seed: seedOf(p), riders: [], home: null, orig: null, baseErr: [] };
      const was = lifted;
      lifted = new Set([key]);
      const C = candidates(H);
      lifted = was;
      return nearest(C, at);
    };
    for (const key of fresh) {
      if (valid(applyTo(K, poses, new Set()))) break;
      const had = poses.get(key);
      const next = new Map(poses);
      next.delete(key);
      poses = next;
      // where it was last put (the real bed: where the mattress stood), as near to that as fits
      const q0 = had && had !== 'away' && had.slot === undefined ? fit(key, had, had.rot ?? 0) : null;
      if (q0) {
        for (const [k, v] of q0.changes) poses.set(k, v);
        continue;
      }
      // its own spot, or as near to it as fits
      if (valid(applyTo(K, poses, new Set()))) continue;
      const p = piecesOf(applyTo(K, new Map(), new Set())).find(q => q.key === key);
      const at = p ? placeOfPiece(applyTo(K, new Map(), new Set()), p) : null;
      const q1 = at ? fit(key, at, at.rot) : null;
      if (q1) {
        for (const [k, v] of q1.changes) poses.set(k, v);
        continue;
      }
      // else the tray (never what the room cannot do without)
      const away = new Map(poses).set(key, 'away');
      if (valid(applyTo(K, away, new Set())) && !fullErrs(applyTo(K, away, new Set())).length) poses = away;
    }
    if (!valid(applyTo(K, poses, new Set()))) {
      console.warn('[arrange] the room as arranged does not fit what is owned now: back to the starter\'s own');
      poses = new Map();
    }
    undos.length = 0;
    redos.length = 0;
    queueMicrotask(emit);
  }

  function emit() {
    for (const fn of listeners) {
      try {
        fn();
      } catch (err) {
        console.warn('[arrange]', err);
      }
    }
  }

  // ── what set/starter.js builds the room with
  starter.arrangeBy({
    apply(K) {
      return poses.size || lifted.size ? applyTo(K) : K;
    },
    sig(h) {
      settle(h);
      if (!poses.size && !lifted.size) return '';
      return `|ar-${fnv(JSON.stringify([...poses].sort((a, b) => (a[0] < b[0] ? -1 : 1))))}${lifted.size ? `-up-${[...lifted].sort().join('+')}` : ''}`;
    },
  });

  // ── THE API (the page's demo/run/arrange.js)
  const api = {
    ready: () => ready,
    get active() {
      return active;
    },
    /** Shows what arranging draws (the held piece, the lit spots, what is pointed at) in the inside view. */
    enter() {
      if (active || !L || !syncFrame()) return false;
      active = true;
      city.scene.add(eg);
      eg.traverse(o => o.layers.set(LAYER));
      raf = requestAnimationFrame(loop);
      return true;
    },
    async leave() {
      if (!active) return;
      if (held) await cancel();
      active = false;
      cancelAnimationFrame(raf);
      raf = 0;
      box.visible = false;
      hideTiles();
      eg.removeFromParent();
    },
    /** The pieces of the room and of the tray: { key, name, where: 'room' | 'tray', fixed } (only what is owned). */
    pieces() {
      if (!L) return [];
      const K = kit();
      const room = piecesOf(applyTo(K)).map(p => ({ key: p.key, id: p.id, name: nameOf(p.id), where: 'room', fixed: p.fixed }));
      return [...room, ...trayOf(K).map(t => ({ key: t.key, id: t.id, name: t.name, where: 'tray', fixed: null }))];
    },
    tray: () => (L ? trayOf().map(t => ({ key: t.key, id: t.id, name: t.name })) : []),
    nameOf: key => {
      const p = api.pieces().find(q => q.key === key);
      return p ? p.name : null;
    },
    hover,
    get pointed() {
      return pointed;
    },
    pick: key => hold(key, 'room'),
    pickAt(x, y) {
      const hit = pieceAt(x, y);
      if (!hit) return { ok: false, why: null };
      return hold(hit.p.key, 'room');
    },
    takeOut: key => hold(key, 'tray'),
    aimAt,
    turn,
    drop,
    cancel,
    putAway,
    undo,
    redo,
    get held() {
      return held ? { key: held.key, name: nameOf(held.id), from: held.from, rot: held.rot, spots: held.cands.length, at: held.cur?.P ?? null, ms: held.ms,
        wall: held.o.place === 'wall', refused: held.refused ? held.refused.why : null } : null;
    },
    get canUndo() {
      return undos.length > 0;
    },
    get changed() {
      return poses.size > 0;
    },
    record,
    load,
    reset,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** The arranged layout in the kit's format (door kept), for the kit's check (demo/tools/crib-check.mjs). */
    layout: () => (L ? (({ ...A }) => ({ ...A, items: A.items.map(({ key, ...it }) => it), slots: A.slots.map(({ key, fill, ...s }) => s) }))(applyTo(kit(), poses, new Set())) : null),
    /** For the tools (part D): where on the screen the middle of a stretch of wall is, for a piece of `id` hung at (side, a). */
    wallScreen(id, side, a) {
      if (!L || !syncFrame()) return null;
      const o = byId(id);
      const P = wallAt(id, side, a, hangY(kit(), o) ?? o.mount ?? 0);
      return screenOf(P.c).slice(0, 2).map(Math.round);
    },
    /** For the tools: every piece's middle on the screen, and every lit spot's. */
    debug() {
      if (!L || !syncFrame()) return null;
      const A = applyTo(kit());
      return {
        poses: Object.fromEntries(poses), lifted: [...lifted], errs: kitErrs(applyTo(kit(), poses, new Set())), undos: undos.map(u => u.what), redos: redos.map(r => r.what),
        pieces: piecesOf(A).map(p => {
          const at = placeOfPiece(A, p);
          const b = at.box;
          const s = screenOf([(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]);
          return { key: p.key, id: p.id, x: at.x, z: at.z, rot: at.rot, on: p.parent, fixed: p.fixed, screen: [Math.round(s[0]), Math.round(s[1])] };
        }),
        tray: trayOf().map(t => t.key),
        held: api.held,
        spots: held ? held.cands.map(q => ({ P: q.P, screen: screenOf(q.wall ? q.c : [q.c[0], q.y, q.c[2]]).slice(0, 2).map(Math.round) })) : [],
      };
    },
  };
  return { of: key => (key && key === starter.pad ? api : null), api };
}
