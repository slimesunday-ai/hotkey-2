// THE SKATEBOARD: hop on and push off along the sidewalk; roll in, step off. What is the city's:
//   · the board: the one model (anim/cast/clips/skate-board.js: boardGeometry, posed by boardMatrix), drawn by actors.js
//     as the playing skate clip's own prop, at the walker, posed by the clip's clock: its wheels, its carve, an ollie's pop;
//   · the rider: the skate clips (anim/cast/clips/skate.js), standing-leg clips that travel (the owner moves the walker at
//     their 4 m/s, the legs are the clip's), strung the way the city's SKATE plan strings them (simstate/movement.js
//     skatePlan): skate_push from the start in whole 2 s cycles, handed over to skate_ride ON ITS SEAM (the push loop's
//     wrap: both are in the ride stance there, playClip straight, no blend), skate_ride's loop from there; an OLLIE now
//     and then on a straight, started where the ride's loop is back at its stance (its wrap), with 5 m clear ahead
//     (SK.ollieClear), chaining back into skate_ride by itself (its `next`). The corners are rolled on the lane, as the
//     city's plan does when a leg has no time to stop for a kickturn;
//   · the way: the walkers' lanes (actors.walkTo), as the city's skate legs ride the walkers' graph.
// WHAT IS OURS (the city has no part for it: README "missing, for the owner"): where the board is before and after. A
// rider sets off from a few steps of walking, and the board comes under them as the push comes in (the city's own way:
// a walk leg handing over to a skate leg); stepping off, the board is left on the ground where it stopped and taken
// away once the camera cannot see it, or ridden off again by its owner.

/** Seconds of riding before the cut (sooner once the rider is out of the picture). */
const AWAY = 2.6;
/** Metres the departure rides on along the way out, and metres back that an arrival starts (at the cut), rolling. */
const RIDE_OUT = 60;
const RIDE_IN = 11;
/** Walked before the board comes under: the steps out onto the lane (m), at a brisk walk. */
const RUN_UP = 1.6;
/** The walk's speed at which the push comes in (m/s): a few quick steps, then onto the board. */
const RUN_V = 1.7;
/** A crossing nearer than this is ridden over; a farther one ends the ride 2 m short of it (scooter.js says why). */
const NEAR_CROSS = 12;
/** Held up this long (s, under half a metre made good): the rider steps off and walks the rest. */
const STALL = 1.6;

export function createSkate({ city, actors, kit, CLIPS, SB }) {
  const THREE = city.THREE;
  const C = CLIPS.CLIP;
  const V = C.skate_ride?.speed ?? 4;
  const PUSH = C.skate_push?.dur ?? 2;
  const RIDE = C.skate_ride?.dur ?? 4.8;
  const OLLIE = C.skate_ollie?.dur ?? 0.8;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const boards = new Map();
  let serial = 0;

  /** A board lying on the ground (boardGeometry at rest, boardMatrix(REST)), at a walker's ground point and heading. */
  function makeBoard() {
    const m = new THREE.Mesh(SB.boardGeometry(THREE), mat);
    m.matrixAutoUpdate = false;
    m.castShadow = true;
    m.frustumCulled = false;
    m.name = `hk2:rides:board${++serial}`;
    m.visible = false;
    city.scene.add(m);
    const W = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const UP = new THREE.Vector3(0, 1, 0);
    const ONE = new THREE.Vector3(1, 1, 1);
    const L = SB.boardMatrix(THREE, SB.REST);
    const B = {
      id: serial, x: 0, z: 0, yaw: 0, owner: null,
      put(x, y, z, yaw) {
        Object.assign(B, { x, z, yaw });
        W.compose(new THREE.Vector3(x, y, z), Q.setFromAxisAngle(UP, yaw), ONE);
        m.matrix.multiplyMatrices(W, L);
        m.visible = true;
      },
      remove() {
        m.removeFromParent();
        boards.delete(B.id);
      },
    };
    return B;
  }
  /** Left lying: it stays until the camera cannot see it, or its owner rides off on it. */
  function leave_(B, owner) {
    B.owner = owner;
    boards.set(B.id, B);
    kit.every(() => {
      if (!boards.has(B.id)) return true;
      if (kit.jobs.get(owner)?.kind === 'skate' && actors.has(owner)) return false;
      if (!kit.inView(B.x, 0.2, B.z, 0.8)) {
        B.remove();
        return true;
      }
      return false;
    });
  }
  const lyingOf = (id, x, z, r = 9) => [...boards.values()].find(B => B.owner === id && Math.hypot(B.x - x, B.z - z) < r) ?? null;

  /** The skate clip on a body now, swapped straight (both ends are the ride stance: the city's seams), at full weight. */
  function swap(id, name, t = 0) {
    const A = actors.get(id);
    const W = { name, loop: C[name].loop, t, after: 0, began: actors.clock, walk: true };
    if (A.w.g) CLIPS.playClip(A.w.g, name, { t, loop: W.loop, snap: true });
    A.want = A.asked = W;
  }
  const clipOn = id => actors.get(id).w.g?.clip ?? null;

  /**
   * The skate clips along a ride, the city's order: push in whole cycles, handed to ride on push's wrap, an ollie at a
   * ride wrap now and then (`ollies`: allowed; only with OLLIE_CLEAR m of the way ahead clear and no corner in it).
   */
  function clips(J, id, { pushes = 1, ollies = true, endAt = () => Infinity } = {}) {
    const A = actors.get(id);
    let n = 0;
    let lastT = 0;
    return kit.every(() => {
      if (!J.live()) return true;
      const s = clipOn(id);
      if (!s || s.out) return false;
      if (s.name === 'skate_push') {
        // (the push loop's wrap: n cycles done → the ride, from its stance)
        if (s.t < lastT || s.t >= PUSH * 0.999) n += 1;
        lastT = s.t;
        if (n >= pushes) swap(id, 'skate_ride', 0);
        return false;
      }
      if (s.name === 'skate_ride' && ollies && A.vc > V * 0.8) {
        const wrapNow = s.t < lastT;
        lastT = s.t;
        // (one ollie a ride loop at most, on a straight with OLLIE_CLEAR m before the end of the way and before a corner)
        if (wrapNow && endAt() > 6 && straightAhead(A, 5)) swap(id, 'skate_ollie', 0);
        return false;
      }
      lastT = s.t;
      return false;
    });
  }
  /** Is the way ahead of a rider straight (no corner) and clear of solids for `m` metres? */
  function straightAhead(A, m) {
    const R = A.route;
    if (!R) return false;
    const h = A.ry;
    for (let d = 0.5; d <= m; d += 0.5) {
      const x = A.x + Math.sin(h) * d;
      const z = A.z + Math.cos(h) * d;
      if (actors.solidAt(x, z) || actors.onRoad(x, z) || (actors.laneDistance(x, z) ?? 9) > 1.2) return false;
    }
    return true;
  }

  function kerbward(points, m, min = 7) {
    for (let k = 0; k * 0.25 <= m && k < points.length; k++) {
      if (!actors.onRoad(points[k][0], points[k][2])) continue;
      if (k * 0.25 < NEAR_CROSS) return m;
      return Math.max(min, Math.min(m, k * 0.25 - 2));
    }
    return m;
  }

  /** Rides to (x, z) along the sidewalks on whatever skate clip is on; ends held-up rides (→ { stalled }). */
  function roll(J, id, x, z, { yaw = null, clip = 'skate_ride', clipFrom = 0 } = {}) {
    const A = actors.get(id);
    let held = 0;
    let mark = null;
    let stalled = false;
    const stop = kit.every(dt => {
      if (!J.live()) return true;
      if (!A.route || Math.hypot(A.x - (mark?.[0] ?? A.x), A.z - (mark?.[1] ?? A.z)) > 0.5) {
        mark = [A.x, A.z];
        held = 0;
      } else held += dt;
      if (held > STALL && !stalled) {
        stalled = true;
        actors.place(id, A.x, A.z, A.ry);
        return true;
      }
      return false;
    });
    return actors.walkTo(id, x, z, { v: V, clip, clipFrom, yaw }).then(r => (stalled ? { ...r, arrived: false, stalled: true } : r)).finally(stop);
  }

  /** Off the board where the rider stands: the clip blends out (the body comes down off the deck), the board lies there. */
  async function stepOff(J, id) {
    const A = actors.get(id);
    const B = makeBoard();
    const s = clipOn(id);
    // (ours at the walker, at rest, the moment the clip lets go: the actors' prop is drawn above weight 0.6, so for a frame
    // or two both are there in nearly the same place)
    B.put(A.w.p[0], A.w.p[1], A.w.p[2], A.w.yawS ?? A.ry);
    actors.stop(id);
    if (s) await J.wait((s.c.blendOut ?? 0.3) + 0.05);
    return B;
  }

  // ── the departure ───────────────────────────────────────────────────────────────────────────────────────────────
  async function leave(J, id, o) {
    const A = actors.get(id);
    const toward = o.toward;
    if (J.hurry) return gone(J, id);
    // their own board, lying near: walk to it and step on there; else a few steps out onto the lane, the way out
    let B = lyingOf(id, A.x, A.z);
    let start;
    let yaw;
    if (B) {
      B.owner = null;
      boards.delete(B.id);
      start = [B.x, B.z];
      yaw = B.yaw;
    } else {
      const way = actors.routeOf(A.x, A.z, toward[0], toward[1]);
      const p = way?.points?.length ? kit.along(way.points, Math.min(RUN_UP + 1, way.metres)) : null;
      start = p ? [p[0], p[1]] : [A.x, A.z];
      yaw = p ? p[2] : A.ry;
    }
    J.onEnd(() => B?.remove());
    kit.claim(id, 'skate', start[0], start[1], 1);
    const tWalk0 = actors.clock;
    // (the walk: a lying board is walked up to and stopped at; a run-up is walked straight on into the push)
    if (B) {
      await kit.walk(J, id, start[0], start[1], { yaw });
      if (!J.live()) return null;
      await actors.turned([id], 0.8);
    }
    const walked = actors.clock - tWalk0;
    if (!J.live()) return null;
    if (J.hurry) return gone(J, id);
    // ON AND OFF: the push comes in over the walk (its blend lifts the body onto the deck; the board is drawn with it);
    // a lying board is ours until the clip's own is drawn, then it goes
    const way = actors.routeOf(A.x, A.z, toward[0], toward[1]);
    const end = way?.points?.length ? kit.along(way.points, kerbward(way.points, Math.min(way.metres, RIDE_OUT))) : [A.x + Math.sin(yaw) * 20, A.z + Math.cos(yaw) * 20];
    const tRide = actors.clock;
    // (no board lying: a few running steps, and the push comes in once the walk is up to RUN_V: actors.js's clip that goes
    // with a pace, as a run's)
    const riding = roll(J, id, end[0], end[1], { clip: 'skate_push', clipFrom: B ? 0 : RUN_V });
    if (B) {
      const lying = B;
      kit.every(() => {
        const shown = [...(A.props?.values() ?? [])].some(m => m.visible && /skateboard/.test(m.name));
        if (shown || !J.live() || actors.clock - tRide > 1.5) {
          lying.remove();
          return true;
        }
        return false;
      });
      B = null;
    }
    const stopClips = clips(J, id, { pushes: 1, endAt: () => (A.route ? A.route.metres - A.route.m : 0) });
    J.onEnd(stopClips);
    await J.until(() => actors.clock - tRide >= AWAY || (actors.clock - tRide > 0.8 && !kit.inView(A.x, 1, A.z, 0.8)));
    if (!J.live()) return null;
    const cut = actors.clock - J.t0;
    // behind the cut: at the end, off the stage if unseen; still seen, they step off and stand till the camera goes
    riding.then(async r => {
      if (!J.live()) return;
      stopClips();
      if ((!r.arrived && !r.stalled) || !kit.inView(A.x, 1, A.z, 1)) return gone(J, id);
      const L = await stepOff(J, id);
      if (!J.live()) return L.remove();
      leave_(L, id);
      await J.until(() => !kit.inView(A.x, 1, A.z, 1));
      gone(J, id);
    });
    return { cut, walk: +walked.toFixed(2) };
  }

  function gone(J, id) {
    if (!J.live()) return { cut: actors.clock - J.t0, stale: true };
    if (actors.has(id)) {
      actors.cutClip(id);
      actors.show(id, false);
    }
    J.stop('gone');
    return { cut: actors.clock - J.t0 };
  }

  // ── the arrival ─────────────────────────────────────────────────────────────────────────────────────────────────
  async function arrive(J, id, o) {
    const A = actors.get(id);
    const [ax, az] = o.at;
    const spot = actors.fitSpot(ax, az);
    const L = actors.laneLine(spot.x, spot.z);
    if (!L) return o.foot(J, id, o);
    // where they step off: the lane point beside their place (a body's length apart from anyone else's)
    let D = [L.x, L.z];
    for (const more of [0, -1.5, 1.5, -3, 3, -4.5]) {
      const p = [L.x + L.ux * more, L.z + L.uz * more];
      if (kit.clearOf(id, p[0], p[1], 1.3)) {
        D = p;
        break;
      }
    }
    kit.claim(id, 'skate', D[0], D[1], 1.3);
    if (J.hurry) return settle(J, id, spot);
    // THE START (at the cut): RIDE_IN m back along the way they come, rolling at speed from the first frame
    const lead = actors.routeOf(D[0], D[1], o.from[0], o.from[1]);
    const S0 = lead?.points?.length ? kit.along(lead.points, kerbward(lead.points, Math.min(RIDE_IN, lead.metres))) : [D[0] - L.ux * RIDE_IN, D[1] - L.uz * RIDE_IN];
    const way = actors.routeOf(S0[0], S0[1], D[0], D[1]);
    const yaw0 = way?.points?.[Math.min(4, way.points.length - 1)]?.[3] ?? Math.atan2(D[0] - S0[0], D[1] - S0[1]);
    // (on the ride loop at a random place of its clock: two people never carve in step, the city's rule)
    const t0 = (((id.length * 7919 + id.charCodeAt(0) * 104729) % 1000) / 1000) * RIDE;
    await kit.appear(id, S0[0], S0[1], yaw0, 'skate_ride', { loop: true, t: t0 });
    if (!J.live()) return null;
    const go = roll(J, id, D[0], D[1], { clip: 'skate_ride' });
    A.vc = V * 0.95;
    const r = await go;
    if (!J.live()) return null;
    if (J.hurry || (!r.arrived && !r.stalled)) return settle(J, id, spot);
    const B = await stepOff(J, id);
    if (!J.live()) return B.remove();
    leave_(B, id);
    if (J.hurry) return settle(J, id, spot);
    await kit.walk(J, id, spot.x, spot.z);
    if (!J.live()) return null;
    J.stop('arrived');
    return { at: [actors.get(id).x, actors.get(id).z] };
  }

  function settle(J, id, spot) {
    if (!J.live()) return { stale: true };
    if (actors.has(id)) {
      actors.cutClip(id);
      actors.place(id, spot.x, spot.z, actors.get(id).ry);
      actors.show(id, true);
    }
    J.stop('settled');
    return { at: [spot.x, spot.z], settled: true };
  }

  return {
    leave, arrive,
    boards: () => [...boards.values()].map(B => ({ owner: B.owner, x: B.x, z: B.z })),
    clear() {
      for (const B of [...boards.values()]) B.remove();
    },
  };
}
