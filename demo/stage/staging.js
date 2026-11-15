// STAGING A PAIR WITH ROOM, THE CITY'S WAY. PURE (no three, no page): the director hands in what it reads off the page.
//
// PORTED from the city's stage, city/from-trunk/style/city/stage/vignettes.js: BACK_FP, SIDE_FP, toW, fallHits, pickAxis,
// placeFor, around (and cowerNear's figures, COWER below). They could not be CALLED: in that file they are private to
// the module (only VIGNETTES, cowerNear, stepCowers, leaveOnFoot, arrestMode and aftermath are exported), and the
// vignettes that use them run on the city's stage context (ctx.actor / ctx.free / ctx.occ / ctx.props, borrowed
// walkers), which this page does not build. The figures and the order of the checks are the city's, kept as they are:
//   · the pair's AXIS: 24 directions round the one who stays, the nearest to where the partner already is that is
//     GOOD: the partner's spot is standing ground (nothing solid within 0.35 m) with nobody within 1.3 m of it, the
//     line between them is clear when it must be (a gun), and each fall's FOOTPRINT lands on open ground: no wall,
//     no prop, no person;
//   · no good axis where they stand: a better PLACE for the one who stays, up to 2.4 m off, and the axis there;
//   · a way ROUND the partner when the straight line to the mark would go through them.
// What is ours, and marked (OURS) below: the height map is not a picture of the scene taken from above (ctx.occ) but
// a grid of the same cell asked of the collision world and the set's pieces (grid()); the partner's spot must be on a
// sidewalk; and a mark or a fall that lies across the walkers' lane costs a little, so a scene is laid along the kerb
// or the wall where it can be and the sidewalk stays open. The camera's side (camView / unseenAt: what the camera
// cannot see of a mark) is NOT ported: our camera cuts to a scene after it has started.

/**
 * THE FOOTPRINT a fall covers, in the faller's body frame from where it stood (x across, z ahead; m): on the back
 * (shove_fall, fall_back, shot_hit, then the lie: the head on the ground ~1.9 m behind the heels) · on the side.
 */
export const BACK_FP = [-0.62, 0.62, -2.45, 0.45];
export const SIDE_FP = [-0.6, 2.3, -1.05, 0.7];
/** The city's distances (vignettes.js): a shot is staged at 3.5 m with the gun; nobody stands within 1.3 m of a mark. */
export const SHOT_D = 3.5;
export const CLEAR = 1.3;
/**
 * Bystanders (vignettes.js cowerNear): the nearest `n` within `r` m stop, turn to it (0.35 rad to one side or the
 * other, by turns), and react for `secs` s (each half a second longer than the one before), starting a beat apart.
 */
export const COWER = { n: 3, r: 9, secs: 3.2, more: 0.5, first: 0.12, apart: 0.18, skew: 0.35 };

const toW = (x, z, ry, bx, bz) => [x + bx * Math.cos(ry) + bz * Math.sin(ry), z - bx * Math.sin(ry) + bz * Math.cos(ry)];
const segDist = (p, a, b) => {
  const [vx, vz] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vz * t);
};

/**
 * (OURS) The height map the city's checks read (`O.at(x, z)` → the highest surface there, m): a square of `half` m
 * round (cx, cz) in 0.2 m cells, asked once of `solid(x, z)` (truthy: something solid stands there) and `road(x, z)`
 * (truthy: a roadway). Solid reads 3 m, a road 0, a sidewalk `side`. `lane(x, z)` is how far a point is from the
 * walkers' lane (m), or null to leave the lane out of it.
 */
export function grid({ cx, cz, half = 6, side = 0.2, solid, road, lane = null }) {
  const n = Math.ceil((2 * half) / 0.2);
  const H = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const [x, z] = [cx - half + (i + 0.5) * 0.2, cz - half + (j + 0.5) * 0.2];
      H[i + j * n] = solid(x, z) ? 3 : road(x, z) ? 0 : side;
    }
  }
  return {
    cx, cz, half, n, side, lane,
    at(x, z) {
      const [i, j] = [Math.floor((x - cx + half) / 0.2), Math.floor((z - cz + half) / 0.2)];
      return i < 0 || j < 0 || i >= n || j >= n ? null : H[i + j * n];
    },
  };
}

/** What a fall there would land on: walls and props (cells over 0.3 m above the feet), a road below, and people. */
function fallHits(O, x, z, ry, y0, fp, people, standing = false) {
  let [solid, road, lane, n] = [0, 0, 0, 0];
  for (let bx = fp[0]; bx <= fp[1] + 1e-6; bx += 0.2) {
    for (let bz = fp[2]; bz <= fp[3] + 1e-6; bz += 0.2) {
      const [wx, wz] = toW(x, z, ry, bx, bz);
      const h = O ? O.at(wx, wz) : null;
      n++;
      if (h !== null && h > y0 + 0.3) solid++;
      else if (h !== null && h < y0 - 0.12) road++;
      // (OURS) on the walkers' lane: the sidewalk is shut while the body lies there
      if (O?.lane && Math.abs(bx) < 0.3 && O.lane(wx, wz) < 0.45) lane++;
    }
  }
  let [hit, passing] = [0, 0];
  const [c, s] = [Math.cos(ry), Math.sin(ry)];
  for (const [px, pz, moving] of people) {
    const [dx, dz] = [px - x, pz - z];
    const [bx, bz] = [dx * c - dz * s, dx * s + dz * c];
    if (bx > fp[0] - 0.35 && bx < fp[1] + 0.35 && bz > fp[2] - 0.35 && bz < fp[3] + 0.35) {
      if (standing && moving) passing++;
      else hit++;
    }
  }
  return { solid, people: hit, passing, road, lane, n };
}

/**
 * THE PAIR'S AXIS: u (unit, from P toward its partner Q at P + u·D) among 24 directions, the nearest to u0 that is
 * good. P stays where it is: only the partner moves (and P turns).
 *   P        { x, z, y } the one who stays
 *   people   [[x, z, moving], …] everyone else near (never the pair)
 *   D        metres between the two · falls: [{ who: 'P' | 'Q', fp, d? }] who goes down, and on what footprint
 *   los      the line between them must be clear above the waist (a gun) · side: how much the axis ACROSS the
 *            camera's view is preferred (the pair seen side-on, neither hiding the other), with `cam` { x, z }
 *   clear    nobody else within this of the partner's mark (m; the city's CLEAR, or more: a head's room)
 * → { u, a (the heading of u), q: [x, z] the partner's mark, bad, cost }
 */
export function pickAxis(O, P, u0, { D = 0, falls = [], people = [], los = false, q = true, side = 0, cam = null, clear = CLEAR } = {}) {
  const a0 = Math.atan2(u0[0], u0[1]);
  const y0 = P.y;
  const cf = cam ? [P.x - cam.x, P.z - cam.z] : [0, 0];
  const cl = Math.hypot(cf[0], cf[1]) || 1;
  // (OURS: and a head further when the two lie along the camera's bearing, one head drawn over the other: the second
  // of the Dunn brothers was given a mark 1.2 m from the first, east of him, and their heads were one in the picture)
  const nearAt = (x, z, r) => people.filter(([px, pz]) => {
    const d = Math.hypot(px - x, pz - z);
    if (d < r || !cam || d >= r * 1.45) return d < r;
    const inline = Math.abs((px - x) * cf[0] + (pz - z) * cf[1]) / ((d || 1) * cl);
    return inline > 0.5 && d < r * (1 + 0.45 * inline);
  });
  let best = null;
  for (let k = 0; k < 24; k++) {
    const a = a0 + ((k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI) / 12;
    const u = [Math.sin(a), Math.cos(a)];
    const [qx, qz] = [P.x + u[0] * D, P.z + u[1] * D];
    let bad = 0;
    let low = 0;
    if (q && D > 0) {
      for (const [ox, oz] of [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) {
        const h = O ? O.at(qx + ox, qz + oz) : null;
        // (OURS: `h < y0 - 0.12`, a roadway, where the city allows a spot down to 0.35 m below. Nobody of ours is
        // stood in the road)
        if (h === null || h > y0 + 0.3 || h < y0 - 0.12) bad += 3;
      }
      bad += 4 * nearAt(qx, qz, clear).length;
      // (OURS) the partner's mark on the walkers' lane: a soft cost
      if (O?.lane && O.lane(qx, qz) < 0.6) low += 1;
    }
    if (los && D > 0) {
      for (let f = 0.12; f < 0.9; f += 0.08) {
        const h = O ? O.at(P.x + u[0] * D * f, P.z + u[1] * D * f) : null;
        if (h !== null && h > y0 + 0.65) bad += 2;
        else if (h !== null && h > y0 + 0.3) low++;
      }
    }
    for (const F0 of falls) {
      const fp = [F0.fp[0] - 0.12, F0.fp[1] + 0.12, F0.fp[2] - 0.12, F0.fp[3] + 0.12];
      const fd = F0.d ?? D;
      const r = F0.who === 'Q' ? fallHits(O, P.x + u[0] * fd, P.z + u[1] * fd, a + Math.PI, y0, fp, people) : fallHits(O, P.x, P.z, a, y0, fp, people);
      bad += r.solid + 6 * r.people;
      // (off the kerb into the road: a soft cost, the city's. OURS: and across the lane)
      low += r.road / 8 + r.lane / 6;
    }
    const cost = bad * 10 + low * 3 + Math.ceil(k / 2) * 0.4 + (side * Math.abs(u[0] * cf[0] + u[1] * cf[1])) / cl;
    if (!best || cost < best.cost) best = { u, a, q: [qx, qz], bad, low, cost, k };
    if (bad === 0 && !low && !side) break;
  }
  return best;
}

/**
 * NO CLEAR AXIS where P stands (a narrow sidewalk, a corner by a wall), or somebody standing within 1.3 m of it: a
 * better place for P to step to first, up to 2.4 m off, standing ground nobody is on, and the axis there.
 * → { x, z, ax } (x, z: P's own place when that is best).
 */
export function placeFor(O, P, u0, o) {
  const people = o.people ?? [];
  const here = pickAxis(O, P, u0, o);
  const crowd = people.filter(([px, pz, moving]) => !moving && Math.hypot(px - P.x, pz - P.z) < (o.clear ?? CLEAR)).length;
  if (!here.bad && !crowd) return { x: P.x, z: P.z, ax: here, moved: false };
  let best = { x: P.x, z: P.z, ax: here, cost: here.bad * 10 + crowd * 25, moved: false };
  if (o.fixed) return best;
  const P2 = { ...P };
  for (const r of [0.8, 1.6, 2.4]) {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const [x, z] = [P.x + Math.sin(a) * r, P.z + Math.cos(a) * r];
      const h = O ? O.at(x, z) : null;
      if (h === null || Math.abs(h - P.y) > 0.12 || people.some(([px, pz]) => Math.hypot(px - x, pz - z) < CLEAR)) continue;
      let wall = false;
      if (O) {
        for (let f = 0.2; f <= 1; f += 0.2) {
          const hh = O.at(P.x + (x - P.x) * f, P.z + (z - P.z) * f);
          if (hh !== null && hh > P.y + 0.3) wall = true;
        }
      }
      if (wall) continue;
      // (OURS) nor on to the walkers' lane itself
      if (O?.lane && O.lane(x, z) < 0.5) continue;
      [P2.x, P2.z] = [x, z];
      const A = pickAxis(O, P2, u0, o);
      const cost = A.bad * 10 + r * 2;
      if (cost < best.cost) best = { x, z, ax: A, cost, moved: true };
      if (!A.bad) break;
    }
  }
  return best;
}

/**
 * The way from A to a point `to` ([x, z]) that does not go through P: [to], or by way of points round P at `r` m
 * when the straight line would pass within `r` of it (the city's around(): the arc is close round P, reached along
 * its tangent). Each leg is checked against the height map: nothing over the knees.
 */
export function around(A, P, to, r = 1.4, O = null) {
  const clear = (x0, z0, x1, z1) => {
    if (!O) return true;
    for (let f = 0; f <= 1; f += 0.1) {
      const h = O.at(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f);
      if (h !== null && (h > P.y + 0.35 || h < P.y - 0.12)) return false;
    }
    return true;
  };
  const [ax, az, bx, bz] = [A.x - P.x, A.z - P.z, to[0] - P.x, to[1] - P.z];
  const [a, b] = [Math.atan2(ax, az), Math.atan2(bx, bz)];
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  // (the city's test: the mark is on the walker's side of P, less than 1.1 rad round it, or the line passes clear of P)
  if ((Math.abs(d) < 1.1 || segDist([P.x, P.z], [A.x, A.z], to) >= r - 0.2) && clear(A.x, A.z, to[0], to[1])) return [to];
  const L = Math.hypot(ax, az);
  for (const dd of [d, d > 0 ? d - 2 * Math.PI : d + 2 * Math.PI]) {
    for (const rr of [r, r + 0.8]) {
      const sg = Math.sign(dd) || 1;
      const t0 = L > rr ? Math.acos(rr / L) : 0;
      const span = Math.abs(dd) - t0;
      if (span <= 0) continue;
      const pts = [];
      const n = Math.max(1, Math.ceil(span / 0.7));
      let [x, z, ok] = [A.x, A.z, true];
      for (let k = t0 > 0 ? 0 : 1; k <= n; k++) {
        const m = a + sg * (t0 + (span * k) / (n + 1));
        const [px, pz] = [P.x + Math.sin(m) * rr, P.z + Math.cos(m) * rr];
        if (!clear(x, z, px, pz)) {
          ok = false;
          break;
        }
        pts.push([px, pz]);
        [x, z] = [px, pz];
      }
      if (ok && clear(x, z, to[0], to[1])) return [...pts, to];
    }
  }
  return [to];
}

/**
 * Who reacts to something at (x, z): of `people` ([{ id, x, z }], already only those free to), the nearest
 * COWER.n within COWER.r, each with the heading that turns them to it (a little to one side or the other, by turns),
 * the beat they start on and how long they keep it up (vignettes.js cowerNear's figures).
 */
export function reactors(people, x, z, { n = COWER.n, r = COWER.r, secs = COWER.secs } = {}) {
  return people
    .map(p => ({ ...p, d: Math.hypot(p.x - x, p.z - z) }))
    .filter(p => p.d < r && p.d > 0.01)
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((p, k) => ({ id: p.id, ry: Math.atan2(x - p.x, z - p.z) + (k % 2 ? COWER.skew : -COWER.skew), wait: COWER.first + COWER.apart * k, secs: secs + COWER.more * k, d: p.d }));
}
