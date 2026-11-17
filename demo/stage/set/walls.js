// THE TRAILER'S WALLS, FOR HANGING THINGS (lib-1, part D: "the whole home library in the game"; 37 of its pieces hang
// on a wall). Pure (no three, no DOM): set/arrange.js asks it where a wall piece may hang, the tests ask it the same.
//
// The walls the inside view shows (the room seen from its open front, set/crib.js): the back wall 'N' (z = 0, along x),
// the right wall 'E' (x = the room's width, along z) and the left wall 'W' (x = 0, along z), as the city's room.js
// stamps a wall piece on each. A spot is (side, a, y): `a` the cell along the wall where the piece starts (0.25 m
// cells: N from the left, E and W from the back), `y` its bottom edge (m): the kit's own `mount` height, lower when
// the trailer's 2.45 m ceiling asks it (hangY).
//
// WHERE A PIECE MAY NOT HANG (each refusal says why, in the page's words):
//   · off the wall, or up through the ceiling
//   · over another wall piece on the same wall: the kit's door ('door-front': the trailer's door in the kit's plan,
//     which the inside view leaves undrawn), a window, anything hung there already
//   · FURNITURE IN FRONT: anything standing against that wall (within 0.25 m of it: the kit's own "against the wall",
//     interiors/home/rules.js) along the same stretch whose top, with what stands on it, rises above the piece's bottom
//     edge would hide it. A low piece (a sofa, a table, a bed) under a picture is fine; a shelf, a fridge, the arcade
//     cabinet in front of it is not. The kit applies this to the back and the right walls; here it is the left too.
export const C4 = 0.25;
export const SIDES = ['N', 'E', 'W'];
const SIDE_WORD = { N: 'the back wall', E: 'the right wall', W: 'the left wall' };
export const sideWord = s => SIDE_WORD[s] ?? s;

const rectOf = (x, z, foot, rot) => {
  const r = ((rot ?? 0) / 90) & 3;
  const [w, d] = r & 1 ? [foot[1], foot[0]] : foot;
  return [x, z, w, d];
};
const span = (a0, a1, b0, b1) => a0 < b1 && a1 > b0;
/** A wall's length in cells. */
export const wallLen = (A, side) => (side === 'N' ? A.room.w : A.room.d);

/** What stands against `side` (floor pieces only), each with the stretch of wall it covers and its top (m). */
export function frontOf(A, byId, side) {
  const R = A.room;
  const out = [];
  A.items.forEach((it, k) => {
    const o = byId(it.id);
    if (!o || it.on?.wall || it.on === 'ceiling' || it.on?.top !== undefined || o.place !== 'floor' || o.cat === 'rugs') return;
    const rc = rectOf(it.x, it.z, o.foot, it.rot);
    const near = side === 'N' ? rc[1] <= 1 : side === 'E' ? rc[0] + rc[2] >= R.w - 1 : rc[0] <= 1;
    if (!near) return;
    const [a0, a1] = side === 'N' ? [rc[0], rc[0] + rc[2]] : [rc[1], rc[1] + rc[3]];
    // (what stands on it counts: a TV on a dresser)
    let top = o.h;
    A.items.forEach(q => {
      if (q.on?.top !== k) return;
      const qo = byId(q.id);
      if (qo) top = Math.max(top, (o.tops?.[0] ?? 0.5) + qo.h);
    });
    out.push({ k, id: it.id, key: it.key ?? null, a0, a1, top });
  });
  return out;
}

/** What hangs on `side`: [{ k, id, key, a0, a1, y0, y1 }]. */
export function hungOn(A, byId, side) {
  const out = [];
  A.items.forEach((it, k) => {
    if (it.on?.wall !== side) return;
    const o = byId(it.id);
    if (!o) return;
    const y0 = it.y ?? o.mount ?? 0;
    out.push({ k, id: it.id, key: it.key ?? null, a0: it.x, a1: it.x + o.foot[0], y0, y1: y0 + o.foot[1] * C4 });
  });
  for (const s of A.slots ?? []) {
    if (s.place !== 'wall' || s.wall !== side || !s.fill) continue;
    const o = byId(s.fill.id);
    const y0 = s.y ?? o?.mount ?? 0;
    out.push({ k: `slot:${s.id}`, id: s.fill.id, key: s.fill.key ?? null, a0: s.x, a1: s.x + s.foot[0], y0, y1: y0 + s.foot[1] * C4 });
  }
  return out;
}

/**
 * Why `piece` ({ id, key }) may not hang at (side, a, y) of the layout `A` (null: it may). `name(id)` words a piece.
 * The piece's own key is left out of what is already there (it may be moved along its own wall).
 */
export function wallWhy(A, byId, piece, side, a, y = null, name = id => `the ${byId(id)?.name?.toLowerCase() ?? id}`) {
  const o = byId(piece.id);
  if (!o || o.place !== 'wall') return 'it does not hang on a wall';
  if (!SIDES.includes(side)) return 'the trailer has no such wall';
  const y0 = y ?? o.mount ?? 0;
  const y1 = y0 + o.foot[1] * C4;
  const a1 = a + o.foot[0];
  if (a < 0 || a1 > wallLen(A, side)) return `it runs off ${sideWord(side)}`;
  if (y1 > (A.room.h ?? 2.8) + 1e-6) return 'it would go up through the ceiling';
  for (const w of hungOn(A, byId, side)) {
    if (piece.key && w.key === piece.key) continue;
    if (w.id === 'wall-panelling' || !span(w.a0, w.a1, a, a1) || !span(w.y0, w.y1, y0, y1)) continue;
    if (w.id === 'door-front') return 'the door is there';
    if (w.id === 'window' || w.id === 'ac-window') return 'the window is there';
    return `${name(w.id)} hangs there`;
  }
  for (const f of frontOf(A, byId, side)) {
    if (!span(f.a0, f.a1, a, a1) || f.top <= y0 + 0.02) continue;
    return `${name(f.id)} stands in front of it`;
  }
  return null;
}

/**
 * The height a piece hangs at in this room: the kit's own `mount`, or lower when that would take its top through the
 * ceiling (the trailer is 2.45 m, the kit's rooms 2.8 m: eight of its wall pieces hang lower here), never under
 * FLOOR_CLEAR (the skirting). null: it is too tall for the room at any height.
 */
export const FLOOR_CLEAR = 0.15;
export function hangY(A, o) {
  const H = A.room.h ?? 2.8;
  const y = Math.min(o.mount ?? 0, H - o.foot[1] * C4);
  return y + 1e-9 < Math.min(FLOOR_CLEAR, o.mount ?? 0) ? null : +y.toFixed(3);
}

/** Every spot on every wall the view shows, each with why not (null: it may hang there). */
export function wallSpots(A, byId, piece, name) {
  const o = byId(piece.id);
  const out = [];
  if (!o) return out;
  const y = hangY(A, o);
  for (const side of SIDES) for (let a = 0; a + o.foot[0] <= wallLen(A, side); a++) out.push({ side, a, y: y ?? o.mount ?? 0, why: y === null ? 'it is too tall for the trailer' : wallWhy(A, byId, piece, side, a, y, name) });
  return out;
}

/**
 * A wall piece's place in the room's frame (m), as room.js stamps it: { p, ry, box: [x0, y0, z0, x1, y1, z1], c }.
 * `W` the room's width (m), `ox` the layout's offset in it. The piece's face looks into the room.
 */
export function wallPose(o, side, a, y, W, ox = 0) {
  const w = o.foot[0] * C4;
  const hgt = o.foot[1] * C4;
  const dep = Math.max(0.05, o.h);
  const s = a * C4;
  let p, ry, box;
  if (side === 'N') [p, ry, box] = [[ox + s, y, 0], 0, [ox + s, y, 0, ox + s + w, y + hgt, dep]];
  else if (side === 'E') [p, ry, box] = [[W, y, s], (3 * Math.PI) / 2, [W - dep, y, s, W, y + hgt, s + w]];
  else [p, ry, box] = [[0, y, s + w], Math.PI / 2, [0, y, s, dep, y + hgt, s + w]];
  return { p, ry, box, c: [(box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2] };
}

/** A pose of the arrangement that hangs a piece: { wall, x, y } (set/arrange.js keeps it like any other). */
export const isWallPose = v => !!v && typeof v === 'object' && SIDES.includes(v.wall) && Number.isInteger(v.x) && (v.y === undefined || Number.isFinite(v.y));
