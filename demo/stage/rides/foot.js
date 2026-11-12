// ON FOOT: walk off toward the way out; walk in. The city's own walk (actors.walkTo: the walkers' lanes, the corner
// arcs, the crossings), nothing else.
//
// IN THE GAME (the big city, 2026-11-12) two things are added, both for places SET BACK from any sidewalk (Sunny
// Acres' lane, the docks' yard behind its fence, the middle of a park or a plaza: no walkers' lane within SET_BACK m):
//   · leaving one, the walk off is over the ground, on the heading nearest the way out that is open for the length
//     of the walk (nobody sets off into a trailer's wall);
//   · arriving at one, the walk in is over the ground too (actors.groundWay: round what stands there), from a point
//     on the side they come from. And EVERYWHERE: whoever arrives while the camera stays (not `followed`) starts
//     far enough back to come in from out of the picture, where the ground or the lane allows it.

/** Seconds of walking away before the cut (sooner once the walker is out of the picture). */
const AWAY = 3.2;
/** Metres the departure walks on behind the cut before the walker is taken off the stage. */
const WALK_OUT = 40;
/** Metres back along the way in that an arrival starts (at the cut). */
const WALK_IN = 5;
/** A place farther than this from any walkers' lane is set back: its walks are over the ground (m). */
const SET_BACK = 9;
/** How far back a watched arrival may start so as to come in from out of the picture: along a lane, over the ground (m). */
const BACK_LANE = [5, 9, 14, 20, 26];
const BACK_GROUND = [24, 17, 12, 8, 6];
/** Whoever a scene is waiting for starts no farther back than this (m), and runs in. */
const RUSH = 14;
/** And the followed person's over the ground (the camera cuts with them: a few steps). */
const BACK_FOLLOWED = [8, 6, 4];

export function createFoot({ actors, kit }) {
  async function leave(J, id, o) {
    const A = actors.get(id);
    if (J.hurry) return gone(J, id);
    const lane = actors.laneDistance(A.x, A.z);
    const way = lane !== null && lane <= SET_BACK ? actors.routeOf(A.x, A.z, o.toward[0], o.toward[1]) : null;
    const end = way?.points?.length ? kit.along(way.points, Math.min(WALK_OUT, way.metres)) : openHeading(A, o.toward);
    const t0 = actors.clock;
    const walking = actors.walkTo(id, end[0], end[1], { v: 1.5 * kit.haste, how: way?.points?.length ? 'path' : 'straight' });
    await J.until(() => actors.clock - t0 >= AWAY || (actors.clock - t0 > 1 && !kit.inView(A.x, 1, A.z, 0.8)));
    if (!J.live()) return null;
    const cut = actors.clock - J.t0;
    // (behind the cut: off the stage at the end of the walk, or as soon as the camera cannot see them)
    const stop = kit.every(() => {
      if (!J.live()) return true;
      if (!kit.inView(A.x, 1, A.z, 1)) {
        gone(J, id);
        return true;
      }
      return false;
    });
    walking.then(() => {
      if (!J.live()) return;
      stop();
      // (still in the picture at the end of the walk: they stand there until the camera leaves them)
      J.until(() => !kit.inView(A.x, 1, A.z, 1)).then(() => J.live() && gone(J, id));
    });
    return { cut };
  }

  function gone(J, id) {
    // (a scene that has been replaced, the person's next one playing, leaves them alone)
    if (!J.live()) return { cut: actors.clock - J.t0, stale: true };
    if (actors.has(id)) {
      actors.cutClip(id);
      actors.show(id, false);
    }
    J.stop('gone');
    return { cut: actors.clock - J.t0 };
  }

  /** Where a walk off over the ground heads: the heading nearest the way out that is open ground the longest, 30 m at most. */
  function openHeading(A, toward) {
    const d = Math.hypot(toward[0] - A.x, toward[1] - A.z) || 1;
    const u = [(toward[0] - A.x) / d, (toward[1] - A.z) / d];
    let best = null;
    for (const turn of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5, 2.2, -2.2]) {
      const [c, n] = [Math.cos(turn), Math.sin(turn)];
      const v = [u[0] * c - u[1] * n, u[0] * n + u[1] * c];
      let open = 30;
      for (let m = 1; m <= 30; m += 0.5) {
        if (actors.solidAt(A.x + v[0] * m, A.z + v[1] * m)) {
          open = m - 0.6;
          break;
        }
      }
      if (!best || open > best.open + 0.01) best = { open, v };
      if (open >= 30) break;
    }
    const m = Math.max(1, best.open);
    return [A.x + best.v[0] * m, A.z + best.v[1] * m];
  }

  // where a walk in over the ground starts, by the place and the side come from: found once (a way is looked for
  // from each candidate), kept a minute
  const starts = new Map();
  /**
   * WHERE A WALK IN OVER THE GROUND STARTS: on the side they come from (or a side near it), with a way over the ground
   * to the spot that is not much longer than the straight one. Watched: the farthest such point, out of the picture
   * if there is one. → [x, z] (the spot itself when nothing is found).
   */
  function groundStart(spot, from, followed, rush = false) {
    const d = Math.hypot(from[0] - spot.x, from[1] - spot.z);
    const u = d > 0.5 ? [(from[0] - spot.x) / d, (from[1] - spot.z) / d] : [1, 0];
    const key = `${Math.round(spot.x)},${Math.round(spot.z)},${Math.round(Math.atan2(u[0], u[1]) * 2)},${followed ? 1 : rush ? 2 : 0}`;
    const had = starts.get(key);
    if (had && actors.clock - had.t < 60 && (followed || !kit.inView(had.p[0], 1, had.p[1], 0.6) || had.seen)) return had.p;
    let inSight = null;
    let found = null;
    let asked = 0;
    for (const m of followed ? BACK_FOLLOWED : rush ? BACK_GROUND.filter(q => q <= RUSH) : BACK_GROUND) {
      for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 2.0, -2.0, Math.PI]) {
        const [c, n] = [Math.cos(turn), Math.sin(turn)];
        const p = [spot.x + (u[0] * c - u[1] * n) * m, spot.z + (u[0] * n + u[1] * c) * m];
        if (actors.solidAt(p[0], p[1])) continue;
        const seen = !followed && kit.inView(p[0], 1, p[1], 0.6);
        // (one in the picture is kept in hand, the farthest; the search goes on for one that is not)
        if (seen && inSight) continue;
        if (++asked > 14) break;
        const way = actors.groundWay(p[0], p[1], spot.x, spot.z);
        if (way === null || way > m * 1.6 + 4) continue;
        if (!seen) {
          found = p;
          break;
        }
        inSight ??= p;
      }
      if (found || asked > 14) break;
    }
    const p = found ?? inSight ?? [spot.x, spot.z];
    starts.set(key, { p, t: actors.clock, seen: !found });
    return p;
  }

  async function arrive(J, id, o) {
    const [ax, az] = o.at;
    const spot = actors.fitSpot(ax, az);
    kit.claim(id, 'spot', spot.x, spot.z, 0.8);
    if (J.hurry) return settle(J, id, spot);
    const lane = actors.laneDistance(spot.x, spot.z);
    const back = lane !== null && lane <= SET_BACK ? actors.routeOf(spot.x, spot.z, o.from[0], o.from[1]) : null;
    const byLane = !!back?.points?.length;
    let S = null;
    if (byLane) {
      // (the followed person a few steps back; anyone the camera stays for, as far back as it takes to be out of the
      // picture, up to the length of the way there is)
      let m0 = Math.min(WALK_IN, back.metres);
      if (!o.followed) {
        // (`rush`: somebody is waiting for them. No farther back than RUSH m, and at a run)
        for (const m of o.rush ? BACK_LANE.filter(q => q <= RUSH) : BACK_LANE) {
          m0 = Math.min(m, back.metres);
          const p = kit.along(back.points, m0);
          if (!kit.inView(p[0], 1, p[1], 0.6) || m >= back.metres) break;
        }
      }
      S = kit.along(back.points, m0);
      // (two walking in together: the second a body's length further back)
      for (const more of [0, 1.2, 2.4, 3.6]) {
        const p = kit.along(back.points, Math.min(m0 + more, back.metres));
        if (kit.clearOf(id, p[0], p[1], 0.9)) {
          S = p;
          break;
        }
      }
    } else {
      // SET BACK FROM ANY SIDEWALK (or no way by the lanes): over the ground
      const g = groundStart(spot, o.from, !!o.followed, !!o.rush);
      S = g;
      // (two walking in together: a step to one side of the other)
      for (const [dx, dz] of [[0, 0], [1.1, 0], [-1.1, 0], [0, 1.1], [0, -1.1]]) {
        const p = [g[0] + dx, g[1] + dz];
        if (kit.clearOf(id, p[0], p[1], 0.9) && !actors.solidAt(p[0], p[1])) {
          S = p;
          break;
        }
      }
    }
    kit.claim(id, 'start', S[0], S[1], 0.9);
    const toward = Math.atan2(spot.x - S[0], spot.z - S[1]);
    actors.place(id, S[0], S[1], S[2] !== undefined ? S[2] + Math.PI : toward);
    actors.cutClip(id);
    actors.show(id, true);
    // (at a run when a scene waits for them, unless the way over the ground turns a corner round something: a run
    // rounds its corners wide, and went through a stall's post)
    const run = o.rush && (byLane || actors.wayRound?.(S[0], S[1], spot.x, spot.z) === null);
    await kit.walk(J, id, spot.x, spot.z, { ...(byLane ? {} : { how: 'straight' }), ...(run ? { v: 3.4, clip: 'run_getaway', clipFrom: 3.2 } : {}) });
    if (!J.live()) return null;
    J.stop('arrived');
    return { at: [actors.get(id).x, actors.get(id).z], back: +Math.hypot(S[0] - spot.x, S[1] - spot.z).toFixed(1), ground: !byLane };
  }

  function settle(J, id, spot) {
    // (a scene that has been replaced, the person's next one playing, leaves them alone)
    if (!J.live()) return { cut: actors.clock - J.t0, stale: true };
    if (actors.has(id)) {
      actors.cutClip(id);
      actors.place(id, spot.x, spot.z, actors.get(id).ry);
      actors.show(id, true);
    }
    J.stop('settled');
    return { at: [spot.x, spot.z], settled: true };
  }

  return { leave, arrive };
}
