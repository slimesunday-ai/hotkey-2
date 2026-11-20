// A FIGHT IS GIVEN ROOM (anim-1, room-1). The owner's fights were walked through: passers-by and a dog went by within a
// metre of two people trading blows, and one of ours stood watching at their elbow. While a fight is on, its ground
// and a body's reach beyond it (the ROOM: the fight's own radius + REACH) is kept clear by everybody who is not in
// it, with the stage's or the city's own means:
//
//   THE CITY'S CROWD   coming up to it: told the ground is taken, the way it is told a body lies there (pedsim.js
//                      CROWD GRID, sim.bodies): a ring of footprints at the room's edge. A walker steps round it where its
//                      sidewalk has the room, or stops short of it and stands (and so watches) until it is over.
//                      IN IT when it starts (or got in anyway): one walking out of it, its way never near the ground, is
//                      let out (the ring left open ahead of it) and hurries. Anybody else is STARTLED OUT: taken off its
//                      lane the way the city's own accidents take a walker (pedsim.js offWalker, traffic/accident.js), it
//                      turns and goes quickly to a free place just outside the room, turns to the fight and watches; when
//                      it is over it walks to its lane and walks on from there (onWalker). One waiting at the kerb
//                      to cross away from it (on a page with no traffic: the game's) crosses now, briskly, and walks on
//                      from the far side. A walker with a dog is
//                      never taken off its lane's line (its dog is drawn along it, ahead of it): it is walked along
//                      it, on where it was going if that way keeps clear of the ground, else back the way it came,
//                      until it and its dog are out of the room. With no such way, heading in, it waits where it is
//                      (w.halt, the city's own HOLD, stage/crowd.js). One startled out with no free place to go is
//                      walked out along its lane the same way, the shorter way (room-3). One let out is let out only
//                      while its way stays off the ground: asked again every frame, the city may turn it (room-3).
//   OURS, STANDING     anybody of the stage's standing inside it steps back quickly to its edge, turns to the fight and
//                      stays there; when it is over they step back to where they stood, facing as they faced. The director
//                      leaves them be meanwhile (its own `busy`, as it leaves the fighters).
//   OURS, WALKING      the ground is a solid to anybody PLANNING a way (actors.addSolid, asked without `sure`): a walk
//                      laid while the fight is on goes round it, and a walk's run-out stops at it. A walk already under
//                      way meets the ring as it meets any body on the city's body map (actors.js: its weave round, its
//                      lag behind, its way laid again round what will not move). Never a solid to the audit.
//   CARS               (only with ?cars=1: the game's page has no moving traffic) the road inside the room is a stop to
//                      them: the city's soft hazards (traffic/sim.js, as a body in the road): every car stops short.
//
//   const room = createRoom({ actors, city, director })      demo/stage/index.js makes it: stage.room
//   const R = room.open({ c: [x, z], r, keep: [ids] })        r: the fight's own ground (m); keep: who is in it
//   R.close() · R.figures() (the measure, below)              room.state → { on, c, r, edge, keep, stats, … }
//
// THE MEASURE (R.figures(); demo/run/duel.js keeps it in the fight's record, the tools check it): from one second
// after it opened until it closed, every frame, everybody not in the fight (the crowd, its dogs, ours):
//   frames · on (frames with somebody on the ground: within r + ON) · near (frames with somebody within a step of its
//   edge: r + NEAR) · lingers (times somebody stayed within that step for more than LINGER s) · nearest (m past the
//   ground's edge the nearest came; negative: on it) · most (the most within the step at once).
//
// `?room=0` turns it off (to compare: the measure is still taken).
//
// A DEAL'S ROOM (anim-1, the hands: `open({ …, quiet: true })`): a small ring, a body's width past the two who deal
// (QUIET), that the city's crowd steps round on its own (the ring of footprints, as for a fight) and nothing else:
// nobody is startled out, held, hurried or turned to watch, and ours are not moved. One already in it when it opens is
// let out through a gap in the ring ahead of it. Cheaper than a fight's: no places looked for, no ways searched.
const RING = 16;
const DISC = 0.85;
/** How far past the fight's own ground the room reaches (m): a body's reach, and a step. */
const REACH = 1.5;
/** How far past a deal's own ground its quiet room reaches (m); how often a walker near it is looked at again (s). */
const QUIET = 0.5;
const QUIET_LOOK = 0.4;
const QUIET_MOST = 4;
/** The measure: on the ground (a body's middle within r + ON), within a step of its edge (r + NEAR), for longer than LINGER s. */
export const ON = 0.5;
export const NEAR = 1.0;
export const LINGER = 0.75;
/** A clip in which a body is on the ground or a seat: never moved. */
const DOWN = /lie|fall|sit|sleep|collapse|shove|get_up|sat|bench|slump/;
/** Startled out: how fast (m/s), taken up how quickly (m/s²), turning how fast (rad/s); the walk back to the lane (m/s). */
const OUT = { v: 3.0, acc: 10, turn: 14, back: 1.3, brake: 4 };
/** Ours standing in it step back this fast (m/s): a startled step, not a stroll. */
const STEP_BACK_V = 3.0;
/**
 * THE ROOM'S WORK IS BOUNDED (room-2): nothing in it loops until something is found. Each frame it may look for at most
 * PLACES places out (each a fixed list of 44 spots, straight lines only) and SEARCHES ways round (actors.wayRound:
 * the stage's grid search, the costly part), and starts no new look once MS of the frame's work are spent; a look
 * that does not fit waits for the next frame. A walker it looked for in vain waits BACKOFF[n] s before the next
 * look. Meanwhile it has THE FALLBACK, which needs no search: from its first look in vain it stops where it is,
 * off its lane, and turns to the fight (the measure counts it if that is near the edge); after the last look it stays
 * there until the fight is over. Ours, standing, are looked for again every OURS_RETRY s.
 */
const BUDGET = { ms: 4, places: 3, searches: 1 };
const BACKOFF = [0.25, 0.5, 1, 2];
const OURS_RETRY = 0.5;
/** A crowd walker's dog is drawn this far ahead of it along its lane (pedsim.js PED.dogLead). */
const DOG_LEAD = 0.55;

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export function createRoom({ actors, city, director = null }) {
  const OFF = new URLSearchParams(location.search).get('room') === '0';
  let cur = null;
  // (this frame's budget: when it began, the looks and the searches left)
  const F = { t0: 0, places: 0, searches: 0 };
  const spent = () => performance.now() - F.t0 > BUDGET.ms;
  /** For the tools (demo/tools/room-load.mjs --forced): worst cases (room.stress = { all, noLine, noWay }): every
   * walker within 3 m (or `all` m) past its edge looked for; no straight way anywhere, each search asked round the fight; no way
   * round accepted either. */
  const stress = { all: false, noLine: false, noWay: false };
  const stats = { msMax: 0, searchMsMax: 0, searches: 0, deferred: 0, fallback: 0, opened: 0, steppedBack: 0, wentBack: 0, letOut: 0, startled: 0, waited: 0, rejoined: 0, carStops: 0, noPlace: 0, crossed: 0 };
  const sim = () => city.peds?.sim ?? null;
  const edgeOf = C => C.r + (C.quiet ? QUIET : REACH);
  const dist = (C, x, z) => Math.hypot(x - C.c[0], z - C.c[1]);
  /** Crowd walkers taken off their lanes (startled out), in the room or after it: w → { to, v, face, back } */
  const taken = new Map();
  /** Why no place out was found (the tools read it in room.state.stats.whyNot). */
  const whyNot = {};
  stats.whyNot = whyNot;
  const P4 = [0, 0, 0, 0];
  // (a walk planned while it is on goes round it; the audit, which asks `sure`, never finds anybody in it)
  // (and not until everybody of ours who was standing in it is out: their own step back is a walk like any other)
  actors.addSolid?.((x, z, y, sure) => (!sure && cur && !OFF && cur.sealed && dist(cur, x, z) < edgeOf(cur) - 0.15 ? 'a fight\'s ground' : null));

  // ── the crowd ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const crowdOf = w => !w.hk2 && !w.agent && !w.gone && !w.hide && !!w.p;
  /** Where a walker's own way takes it: the nearest it comes to the middle in the next `L` m, and where it first leaves the room. */
  function wayOf(C, w, L) {
    const S = sim();
    let least = dist(C, w.p[0], w.p[2]);
    let out = null;
    if (!S?.ahead || !w.E) return { least, out };
    // (where it LEAVES the room is after it has been in it: for a walker still outside, the first point of its way
    // outside was its very next step, its way was never looked at past it, and nobody coming was ever taken round, only
    // one already at the edge, a step from it (hands-2: a walker sent across a deal in the page came 0.27 m from its
    // middle, never taken round))
    // (a FIGHT's room as it was: where it leaves is the first point outside, from wherever it is. Asked of a walker let
    // out and already past the edge, whose lane bent back across the ground, the gap was opened on the far side and a
    // walker with a dog walked through a fight on its lane: run-styles 4-jumped-lost, the coordinator, hands-2)
    let been = !C.quiet || least < edgeOf(C);
    for (let a = 0.4; a <= L; a += 0.4) {
      S.ahead(w, a, P4);
      const d = dist(C, P4[0], P4[2]);
      least = Math.min(least, d);
      if (d < edgeOf(C)) been = true;
      if (been && !out && d >= edgeOf(C)) out = Math.atan2(P4[0] - C.c[0], P4[2] - C.c[1]);
      if (out) break;
    }
    return { least, out };
  }
  /** A free place just outside the room for a walker startled out of it, straight out from the middle or round from it. */
  function placeOut(C, w) {
    // (over this frame's budget: next frame)
    if (F.places <= 0 || spent()) {
      stats.deferred += 1;
      return 'later';
    }
    F.places -= 1;
    const S = sim();
    const E = edgeOf(C);
    const a0 = Math.atan2(w.p[0] - C.c[0], w.p[2] - C.c[1]);
    const from = [w.p[0], w.p[2]];
    const d0 = dist(C, from[0], from[1]);
    const no = why => void (whyNot[why] = (whyNot[why] ?? 0) + 1);
    // THE PLACES: just outside the room, round from straight out from the middle by at most a quarter turn and a bit
    // (further round, the way there runs along the fight's edge), each with nothing in it and nobody at it
    const spots = [];
    for (const more of [0.55, 1.1, 1.7, 2.4]) {
      for (let n = 0; n <= 10; n++) {
        const a = a0 + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.35;
        const [x, z] = [C.c[0] + Math.sin(a) * (E + more), C.c[1] + Math.cos(a) * (E + more)];
        if (actors.offKerb && !actors.offKerb(x, z)) {
          no('road');
          continue;
        }
        if (actors.solidAt?.(x, z) || actors.lowNear?.(x, z, 0.45)) {
          no('solid');
          continue;
        }
        if (actors.free && !actors.free(x, z, 0.75)) {
          no('ours');
          continue;
        }
        if ([...taken.values()].some(T => { const e = T.path?.length ? T.path[T.path.length - 1] : T.to; return Math.hypot(e[0] - x, e[1] - z) < 0.8; }) || (S?.walkers ?? []).some(o => o !== w && !o.gone && !o.hide && o.p && Math.hypot(o.p[0] - x, o.p[2] - z) < 0.75)) {
          no('crowd');
          continue;
        }
        spots.push([x, z, Math.hypot(x - from[0], z - from[1])]);
      }
    }
    spots.sort((p, q) => p[2] - q[2]);
    // THE WAY THERE: the nearest place it can go to straight, else round what stands between (a lamp post at the
    // kerb: the nearest few asked), never across the fight's own ground nor the long way round its edge
    // (never nearer the middle than it is now, give or take a hand: whoever is startled steps away from a fight)
    const across = legs => legs.slice(1).some((q, k) => segNear(C.c, legs[k], q) < Math.min(d0, edgeOf(C)) - 0.1);
    for (const [x, z] of spots) {
      if (stress.noLine || !clearLine(from[0], from[1], x, z)) continue;
      if (across([from, [x, z]])) {
        no('across');
        continue;
      }
      return [[x, z]];
    }
    for (const [x, z, l] of spots.slice(0, 4)) {
      // (the searches this frame has left, and only while its time lasts: the rest of the look is a look in vain)
      if (F.searches <= 0 || spent()) break;
      F.searches -= 1;
      stats.searches += 1;
      const t = performance.now();
      // (stress.noLine: the way asked for is to the place's mirror across the fight, through its ground (a solid to a
      // way being planned once ours are out of it): the search must go all the way round it, the costliest there is)
      let W = stress.noLine ? actors.wayRound?.(from[0], from[1], 2 * C.c[0] - x, 2 * C.c[1] - z) : actors.wayRound?.(from[0], from[1], x, z);
      if (stress.noWay) W = null;
      stats.searchMsMax = Math.max(stats.searchMsMax, +(performance.now() - t).toFixed(2));
      if (!W || !W.length) continue;
      const way = [...W.map(q => [q[0], q[1]]), [x, z]];
      const legs = [from, ...way];
      const len = legs.slice(1).reduce((m, q, k) => m + Math.hypot(q[0] - legs[k][0], q[1] - legs[k][1]), 0);
      if (len > l * 1.6 + 1 || across(legs)) continue;
      return way;
    }
    no('line');
    return null;
  }
  /** Nothing solid or low on the straight way from a to b (every 0.3 m). */
  function clearLine(ax, az, bx, bz) {
    const L = Math.hypot(bx - ax, bz - az);
    for (let u = 0.3; u < L; u += 0.3) {
      const [x, z] = [ax + ((bx - ax) * u) / L, az + ((bz - az) * u) / L];
      if (actors.solidAt?.(x, z) || actors.lowNear?.(x, z, 0.3)) return false;
    }
    return true;
  }
  const segNear = (c, a, b) => {
    const [ex, ez] = [b[0] - a[0], b[1] - a[1]];
    const f = Math.max(0, Math.min(1, ((c[0] - a[0]) * ex + (c[1] - a[1]) * ez) / (ex * ex + ez * ez || 1e-9)));
    return Math.hypot(a[0] + ex * f - c[0], a[1] + ez * f - c[1]);
  };
  /** Off its lane for the sim, which then leaves it be, and walked along that lane's line by the room to `s1` (its
   * edge kept: its dog is drawn along it). `across`: it is crossing the road early, and walks on from the far side. */
  function takeAlong(C, w, s1, across) {
    const [E0, s0] = [w.E, w.s];
    const lp = lanePt(E0, s0);
    if (!sim().offWalker?.(w, [w.p[0], w.p[1], w.p[2], w.yawS ?? w.p[3]])) return false;
    w.E = E0;
    w.s = s0;
    const end = lanePt(E0, s1);
    taken.set(w, { lane: { E: E0, s1, across, off: [w.p[0] - lp[0], w.p[2] - lp[1]] }, to: end, path: [], v: Math.max(0, w.vc ?? 0), face: Math.atan2(C.c[0] - end[0], C.c[1] - end[1]), back: null, C });
    return true;
  }
  /** Can the city take this walker off its lane (traffic/accident.js's own test, less its tiers, corners and crossings: one
   * stepping off a crossing into the room is taken too, onto the sidewalk; it joins the sidewalk's lane afterwards)? */
  const takeable = w => !w.off && !w.fix && w.dog < 0 && !w.stagePose && !w.gore && !w.cleaner && !!w.E;
  /** A point of a lane: where a walker at (E, s), on its lane's line, stands. */
  const lanePt = (E, s) => {
    sim().ahead({ E, s, next: null, lat: 0, kx: 0, pE: null }, 0, P4);
    return [P4[0], P4[2]];
  };
  /**
   * A WALKER WITH A DOG is never taken off its lane (its dog is drawn along it, ahead of it): it is walked along it
   * instead, on to where it was going when that way is clear of the ground, else back the way it came, until it and
   * its dog are out of the room. → the lane coordinate to stop at, or null. `nearest`: whichever way is the shorter
   * (one startled out with no place to go: the quicker it is out of the step round the edge, the better).
   */
  function alongLane(C, w, dirs = [1, -1], nearest = false) {
    const E = w.E;
    const S = sim();
    if (!E || !S?.ahead || w.off || w.fix || w.stagePose || w.gore || w.cleaner) return null;
    const edge = edgeOf(C);
    // (never nearer the middle than it is now, give or take a hand: from inside it, the way it came is the way out)
    const d0 = Math.min(dist(C, w.p[0], w.p[2]), edge);
    let best = null;
    for (const dir of dirs) {
      for (let s = w.s + dir * 0.3; dir > 0 ? s < E.len - 0.6 : s > 0.3; s += dir * 0.3) {
        const p = lanePt(E, s);
        if (dist(C, p[0], p[1]) < d0 - 0.1) break;
        if (actors.solidAt?.(p[0], p[1])) break;
        const dog = lanePt(E, Math.min(E.len, s + DOG_LEAD));
        if (dist(C, p[0], p[1]) >= edge + 0.6 && dist(C, dog[0], dog[1]) >= edge + 0.1) {
          if (!nearest) return s;
          if (best === null || Math.abs(s - w.s) < Math.abs(best - w.s)) best = s;
          break;
        }
      }
    }
    return best;
  }

  /**
   * A DEAL'S QUIET ROOM. Its ring of footprints, and a gap in it ahead of anyone already inside when it opened (let out at
   * their own pace). A walker whose own way crosses it is TAKEN ROUND: off its lane (as the startled are, pedsim.js
   * offWalker), along an arc a step outside the ring, at its own pace and facing its way, to where its way leaves the
   * ring, and back onto its lane there (rejoin). On the side of the ring that is clear (no solid, not the road); with
   * neither side clear it is left to the ring. Each walker looked at again only every QUIET_LOOK s: bounded work.
   */
  function quietCrowd(C) {
    const S = sim();
    if (!S?.bodies) return;
    const Q = (stats.quietWhy ??= {});
    const E = edgeOf(C);
    const gaps = [];
    for (const w of S.walkers ?? []) {
      if (!crowdOf(w) || taken.has(w)) continue;
      const d = dist(C, w.p[0], w.p[2]);
      if (d >= E + 3) continue;
      if (d < E) {
        const { out } = wayOf(C, w, 2 * E + 2);
        if (out !== null) gaps.push(out);
        continue;
      }
      const R = C.retry.get(w);
      // (at most QUIET_MOST taken round at once: bounded work, and few off their lanes)
      // (NOR ONE WITH A DOG, nor one the city has a hold of (an accident's, a cleaner, a body the stage poses): off its
      // lane a walker has no lane, and the city draws a dog ahead of its walker ALONG that lane (peds.js, pedsim.js
      // ahead: `E.len`): a dog walker taken round threw there every frame, the null lane of 2026-11-19 (hands-2). The
      // fight's room walks those along their lane instead (alongLane); a deal's quiet one leaves them to its ring)
      // (why a walker near it was not taken round, counted for the tools: stats.quietWhy)
      const why = k => void (Q[k] = (Q[k] ?? 0) + 1);
      if ((R?.at ?? -1) > C.age) continue;
      if (!takeable(w) || w.halt) {
        why(w.dog >= 0 ? 'dog' : 'held');
        continue;
      }
      if ((w.vc ?? 0) < 0.3) {
        why('still');
        continue;
      }
      if (F.places <= 0 || spent() || [...taken.values()].filter(T => T.quiet).length >= QUIET_MOST) {
        why('budget');
        continue;
      }
      F.places -= 1;
      C.retry.set(w, { at: C.age + QUIET_LOOK, n: 0 });
      const way = wayOf(C, w, 2 * E + 4);
      if (way.least >= E || way.out === null) {
        why('notCrossing');
        continue;
      }
      const a0 = Math.atan2(w.p[0] - C.c[0], w.p[2] - C.c[1]);
      const clear = (x, z) => !actors.solidAt?.(x, z) && !(actors.offKerb && !actors.offKerb(x, z)) && !actors.lowNear?.(x, z, 0.3);
      let best = null;
      // (a step outside the ring; else at its edge; else a short step past the two themselves (C.r has a body's half
      // width past them already). A ring a step outside its edge is 3.5 m across, as wide as a sidewalk: on the
      // market's, between the stalls and the kerb, no arc that wide was ever clear, and nobody was taken round:
      // hands-2, a walker sent across in the page)
      for (const r of [E + 0.35, E, C.r + 0.3]) {
        for (const sg of [1, -1]) {
          let span = wrap(way.out - a0);
          if (Math.sign(span) !== sg) span += sg * Math.PI * 2;
          const n = Math.max(2, Math.ceil((Math.abs(span) * r) / 0.4));
          const pts = [];
          for (let k = 1; k <= n; k++) pts.push([C.c[0] + Math.sin(a0 + (span * k) / n) * r, C.c[1] + Math.cos(a0 + (span * k) / n) * r]);
          if (pts.every(q => clear(q[0], q[1])) && (!best || Math.abs(span) < best.span)) best = { pts, span: Math.abs(span) };
        }
        if (best) break;
      }
      if (!best) {
        why('noClearArc');
        continue;
      }
      if (!S.offWalker?.(w, [w.p[0], w.p[1], w.p[2], w.yawS ?? w.p[3]])) {
        why('cityRefused');
        continue;
      }
      taken.set(w, { to: best.pts[0], path: best.pts.slice(1), v: Math.max(0.6, w.vc ?? 1.1), vq: Math.max(1.0, w.v ?? 1.3), face: null, back: null, C, quiet: true });
      stats.round = (stats.round ?? 0) + 1;
    }
    C.letOut = gaps.length;
    for (let k = 0; k < RING; k++) {
      const a = (k / RING) * Math.PI * 2;
      if (gaps.some(g => Math.abs(wrap(a - g)) < 0.6)) continue;
      S.bodies.push({ x: C.c[0] + Math.sin(a) * Math.max(0.3, E - DISC * 0.6), z: C.c[1] + Math.cos(a) * Math.max(0.3, E - DISC * 0.6), r: DISC * 0.6, room: 0.3 });
    }
  }
  function crowd(C, dt) {
    if (C.quiet) return quietCrowd(C);
    const S = sim();
    if (!S?.bodies) return;
    const E = edgeOf(C);
    const gaps = [];
    // (those stopped where they stood for want of a place out: looked for again, on their backoff, within the budget)
    for (const [w, T] of taken) {
      if (T.C !== C || !T.stand || T.stand.at > C.age || T.back) continue;
      const to = placeOut(C, w);
      if (to === 'later') continue;
      if (to) {
        const end = to[to.length - 1];
        Object.assign(T, { to: to[0], path: to.slice(1), face: Math.atan2(C.c[0] - end[0], C.c[1] - end[1]), stand: null });
        stats.startled += 1;
        continue;
      }
      stats.noPlace += 1;
      T.stand.n += 1;
      T.stand.at = T.stand.n > BACKOFF.length ? Infinity : C.age + BACKOFF[T.stand.n - 1];
    }
    for (const w of S.walkers ?? []) {
      if (!crowdOf(w) || taken.has(w)) continue;
      const d = dist(C, w.p[0], w.p[2]);
      if (d >= (stress.all ? E + (stress.all === true ? 3 : stress.all) : E) + 0.3) {
        // (let out and gone: back to its own pace)
        if (C.hurried.has(w)) {
          w.v = C.hurried.get(w).v;
          C.hurried.delete(w);
        }
        continue;
      }
      if (C.held.has(w) || (d >= (stress.all ? E + (stress.all === true ? 3 : stress.all) : E) && !C.hurried.has(w))) continue;
      let way = null;
      if (C.hurried.has(w)) {
        // (let out, it stands still all the same: at a kerb for the lights. Startled out like anybody)
        const H = C.hurried.get(w);
        H.still = (w.vc ?? 0) < 0.2 ? H.still + dt : 0;
        way = wayOf(C, w, 2 * E + 2);
        // (LET OUT, AND ITS WAY TURNED ONTO THE GROUND: its way is asked again every frame, since the city may turn it at
        // the next corner after it was let out (pedsim.js: a walker with a dog never waits at a shut crossing, it turns
        // along the sidewalk; the ring left open ahead of it, it walked through the fight on its lane, 7.3 s on the
        // ground: run-styles 4-jumped-lost, room-3). It is let out no longer: as anybody else in the room, below)
        const turned = !H.ground && way.least < C.r + NEAR + 0.3;
        if (H.still < 0.4 && !turned) {
          if (way.out !== null) gaps.push(way.out);
          continue;
        }
        w.v = H.v;
        C.hurried.delete(w);
        C.stood.add(w);
        // (past the ring's edge already: the ring, closed again, keeps it out; in it, it is seen to below)
        if (d >= E) continue;
      }
      way ??= wayOf(C, w, 2 * E + 2);
      // LET OUT: it is walking out and its way never comes near the ground: it hurries out through the ring
      if (way.out !== null && way.least >= C.r + NEAR + 0.3 && w.E && !w.halt && !C.stood.has(w) && (w.vc ?? 0) > 0.3) {
        C.hurried.set(w, { v: w.v, still: 0 });
        w.v = Math.max(w.v, 2.0);
        stats.letOut += 1;
        gaps.push(way.out);
        continue;
      }
      // AT THE KERB, WAITING TO CROSS AWAY FROM IT (and no traffic on the page to wait for): it crosses now, briskly,
      // and walks on from the far side
      const R = C.retry.get(w) ?? { at: -1, n: 0 };
      if (R.at > C.age) continue;
      const cross = !city.traffic && w.E?.cross && w.s <= 1.1 && !w.off && !w.fix ? alongLane(C, w, [1]) : null;
      if (cross !== null && takeAlong(C, w, Math.max(cross, w.E.len - 1), true)) {
        stats.crossed += 1;
        continue;
      }
      // STARTLED OUT: off its lane and quickly to a free place outside the room
      if (takeable(w)) {
        const to = placeOut(C, w);
        if (to === 'later') continue;
        if (to && S.offWalker?.(w, [w.p[0], w.p[1], w.p[2], w.yawS ?? w.p[3]])) {
          const end = to[to.length - 1];
          taken.set(w, { to: to[0], path: to.slice(1), v: Math.max(0, w.vc ?? 0), face: Math.atan2(C.c[0] - end[0], C.c[1] - end[1]), back: null, C });
          stats.startled += 1;
          continue;
        }
        // NO FREE PLACE OUTSIDE IT (at the market's kerb 65 of the 66 places looked at were in the road, the last one
        // across the fight, and every look again the same): it is walked out along its own lane's line, the shorter
        // way, and turns to watch from there, as one with a dog is. It stood where it was, 0.6 to 0.85 m past the
        // fight's ground, for the rest of the fight (THE FALLBACK below): run-styles 4-jumped-lost, room-3
        const s1 = to ? null : alongLane(C, w, [1, -1], true);
        if (s1 !== null && takeAlong(C, w, s1, false)) {
          stats.noPlace += 1;
          stats.startled += 1;
          stats.alongOut = (stats.alongOut ?? 0) + 1;
          continue;
        }
        if (!to && S.offWalker?.(w, [w.p[0], w.p[1], w.p[2], w.yawS ?? w.p[3]])) {
          // NOWHERE TO GO YET: it stops where it is, off its lane, and turns to the fight (THE FALLBACK, no search);
          // looked for again after BACKOFF[n] s while it stands there, and after the last look it stays
          stats.noPlace += 1;
          stats.fallback += 1;
          taken.set(w, { to: [w.p[0], w.p[2]], path: [], v: 0, face: Math.atan2(C.c[0] - w.p[0], C.c[1] - w.p[2]), back: null, C, stand: { n: 1, at: C.age + BACKOFF[0] } });
          continue;
        }
      }
      if (w.dog >= 0) {
        const s1 = alongLane(C, w);
        if (s1 !== null && takeAlong(C, w, s1, false)) {
          stats.startled += 1;
          continue;
        }
        // (no way along it now: asked again a little later; meanwhile as below)
        R.n += 1;
        R.at = C.age + BACKOFF[Math.min(BACKOFF.length, R.n) - 1];
        C.retry.set(w, R);
      }
      // (a walker with a dog with no way along its lane out of the room: heading in, it waits where it is; on the
      // ground, it is let out)
      if (d > C.r + ON + 0.3 && w.E && !(w.E.cross && w.s > 1.05)) {
        if (!w.halt) {
          w.halt = true;
          w.vc = 0;
          C.held.set(w, true);
          stats.waited += 1;
        }
      } else if (way.out !== null && !C.hurried.has(w)) {
        C.hurried.set(w, { v: w.v, still: -99, ground: true });
        w.v = Math.max(w.v, 2.0);
        gaps.push(way.out);
      }
    }
    C.letOut = gaps.length;
    for (let k = 0; k < RING; k++) {
      const a = (k / RING) * Math.PI * 2;
      if (gaps.some(g => Math.abs(wrap(a - g)) < 0.6)) continue;
      S.bodies.push({ x: C.c[0] + Math.sin(a) * (E - DISC), z: C.c[1] + Math.cos(a) * (E - DISC), r: DISC, room: 0.3 });
    }
  }

  /** Every frame: the walkers taken off their lanes, driven (out of the room, held facing it, back to a lane). */
  function drive(dt) {
    for (const [w, T] of taken) {
      try {
        driveOne(w, T, dt);
      } catch (err) {
        // ONE WALKER THAT CANNOT BE DRIVEN IS LET GO, back to the city: it threw every frame, and the stage's frame
        // hooks after this one (a deal's own clock among them) were never called again; the deal stood frozen with
        // control never given back (hand-film.mjs --check, 2026-11-19)
        taken.delete(w);
        stats.dropped = (stats.dropped ?? 0) + 1;
        try {
          sim()?.onWalker?.(w);
        } catch {}
        if (stats.dropped <= 3) console.warn('[room] a walker could not be driven, let go:', err?.stack ?? err);
      }
    }
  }
  function driveOne(w, T, dt) {
    const S = sim();
    {
      if (w.gone || !w.fix) {
        taken.delete(w);
        return;
      }
      const f = w.fix;
      if (T.lane && !T.back) {
        // (along its lane: its place on it moved on, the body put there, the step it was off its lane's line let go)
        const L = T.lane;
        const left = L.s1 - w.s;
        const want = Math.sign(left) >= 0 ? 0 : Math.PI;
        const vmax = Math.min(L.across ? 1.9 : OUT.v * 0.85, Math.sqrt(2 * OUT.brake * Math.abs(left)) + 0.05);
        T.v = Math.min(vmax, T.v + OUT.acc * dt);
        w.s += Math.sign(left) * Math.min(Math.abs(left), T.v * dt);
        const p = lanePt(L.E, w.s);
        const k = Math.max(0, 1 - dt / 0.4);
        L.off = [L.off[0] * k, L.off[1] * k];
        const ahead = lanePt(L.E, Math.min(L.E.len, w.s + 0.3));
        const yawLane = Math.atan2(ahead[0] - p[0], ahead[1] - p[1]);
        if (L.across && Math.abs(left) < 0.02) {
          // (over the road: to the sidewalk's lane there, and on)
          T.lane = null;
          rejoin(T, w);
          return;
        }
        const yaw = Math.abs(left) < 0.02 ? T.face : yawLane + want;
        [f[0], f[2]] = [p[0] + L.off[0], p[1] + L.off[1]];
        f[1] = actors.groundAt?.(f[0], f[2]) ?? f[1];
        f[3] += Math.max(-OUT.turn * dt, Math.min(OUT.turn * dt, wrap(yaw - f[3])));
        w.vc = Math.abs(left) < 0.02 ? 0 : T.v;
        return;
      }
      const [dx, dz] = [T.to[0] - f[0], T.to[1] - f[2]];
      const d = Math.hypot(dx, dz);
      if (d < 0.02 && T.path?.length) {
        // (a way round: on to its next point without stopping)
        T.to = T.path.shift();
        return;
      }
      if (d < 0.02 && T.quiet && !T.back) {
        // (round the deal: on to its lane from here, without stopping. No lane found near: back on its own where it
        // stands, asked once a frame and cheaply (the lane search is not asked again), and let go after 2 s whatever)
        if (!T.noLane) rejoin(T, w);
        if (!T.back) {
          T.noLane = true;
          T.tries = (T.tries ?? 0) + 1;
          if (S.onWalker?.(w) || T.tries > 120) {
            taken.delete(w);
            stats.rejoined += 1;
          }
          return;
        }
        T.v = T.vq;
        return;
      }
      if (d < 0.02) {
        T.v = 0;
        w.vc = 0;
        if (!T.back) {
          // (there: turned to the fight, watching)
          f[3] += Math.max(-OUT.turn * dt, Math.min(OUT.turn * dt, wrap(T.face - f[3])));
          return;
        }
        // (back at its lane: on it, walking on, once the lane there is clear)
        if (S.onWalker?.(w)) {
          taken.delete(w);
          stats.rejoined += 1;
        }
        return;
      }
      const want = Math.atan2(dx, dz);
      const err = wrap(want - f[3]);
      f[3] += Math.max(-OUT.turn * dt, Math.min(OUT.turn * dt, err));
      const vmax = T.quiet ? T.vq : Math.min(T.back ? OUT.back : OUT.v, T.path?.length ? 99 : Math.sqrt(2 * OUT.brake * d) + 0.1);
      // (turned before it goes: a startled step, a body turning as it goes, never sideways)
      T.v = Math.min(vmax, T.v + OUT.acc * dt) * (Math.abs(err) > 1.4 ? 0.25 : 1);
      const step = Math.min(d, T.v * dt);
      f[0] += (dx / d) * step;
      f[2] += (dz / d) * step;
      f[1] = actors.groundAt?.(f[0], f[2]) ?? f[1];
      w.vc = T.v;
    }
  }
  /** It is over: each walker taken off its lane walks to the nearest lane point and walks on from there. */
  function rejoin(T, w) {
    const S = sim();
    if (T.lane) {
      // (on its lane's line already: back on it there; its edge stays until then, its dog is drawn by it)
      T.to = [w.fix[0], w.fix[2]];
      T.path = [];
      T.back = true;
      T.v = 0;
      return;
    }
    const L = S?.laneNear?.(w.fix[0], w.fix[2], 12);
    // (a lane found with no edge of its own is no lane: asked of it, it threw every frame, 2026-11-19, below)
    if (!L?.E || !S.ahead) return;
    S.ahead({ E: L.E, s: L.s, next: null, lat: 0, kx: 0, pE: null }, 0, P4);
    T.to = [P4[0], P4[2]];
    T.path = [];
    T.back = true;
    T.v = 0;
  }

  // ── ours ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  function ours(C) {
    const E = edgeOf(C);
    let within = 0;
    for (const A of actors.all?.() ?? []) {
      if (C.keep.has(A.id) || A.w?.hide || A.room) continue;
      const d = dist(C, A.x, A.z);
      if (d < E - 0.1) within += 1;
      if (C.quiet || A.mode !== 'free' || A.route || A.paired) continue;
      if (C.moved.has(A.id) || C.cut.has(A.id) || DOWN.test(A.clipName ?? '')) continue;
      if (d >= E || (C.retryOurs.get(A.id) ?? -1) > C.age) continue;
      const to = F.places > 0 && !spent() ? out(C, A) : undefined;
      if (to === undefined) continue;
      F.places -= 1;
      if (!to) {
        C.retryOurs.set(A.id, C.age + OURS_RETRY);
        continue;
      }
      const P = director?.people?.get(A.id) ?? null;
      if (P) P.busy = (P.busy ?? 0) + 1;
      C.moved.set(A.id, { x: A.x, z: A.z, ry: A.ry, P });
      stats.steppedBack += 1;
      // (quickly, as anybody steps back from a fight; facing the fight as they get there: they watch)
      actors.stepTo(A.id, to[0], to[1], { v: STEP_BACK_V, yaw: Math.atan2(C.c[0] - to[0], C.c[1] - to[1]) }).catch(() => {});
    }
    C.sealed = within === 0;
  }
  /** BACK TO THE EDGE, straight out from the middle; a place that is free, else a little round from it. */
  function out(C, A) {
    const E = edgeOf(C);
    const d = dist(C, A.x, A.z);
    const a0 = d > 0.05 ? Math.atan2(A.x - C.c[0], A.z - C.c[1]) : 0;
    for (const more of [0.45, 1.0]) {
      for (const off of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6]) {
        const a = a0 + off;
        const [x, z] = [C.c[0] + Math.sin(a) * (E + more), C.c[1] + Math.cos(a) * (E + more)];
        if (actors.solidAt?.(x, z) || actors.lowNear?.(x, z, 0.45)) continue;
        if (actors.free && !actors.free(x, z, 0.75, [A.id])) continue;
        if (segNear(C.c, [A.x, A.z], [x, z]) < Math.min(d, E) - 0.1) continue;
        return [x, z];
      }
    }
    return null;
  }

  // ── cars (?cars=1) ─────────────────────────────────────────────────────────────────────────────────────────────────
  function stopCars(C) {
    const T = city.traffic?.sim;
    if (!T?.hazards) return;
    const E = edgeOf(C) + 0.5;
    for (let x = -E; x <= E; x += 0.8) {
      for (let z = -E; z <= E; z += 0.8) {
        if (Math.hypot(x, z) > E) continue;
        const [hx, hz] = [C.c[0] + x, C.c[1] + z];
        if (actors.onRoad && !actors.onRoad(hx, hz)) continue;
        const h = { x: hx, z: hz, r: 0.5, hit: false, soft: true, case: null, room: true };
        T.hazards.push(h);
        C.hazards.push(h);
      }
    }
    if (C.hazards.length) stats.carStops += 1;
  }
  function letCars(C) {
    const T = city.traffic?.sim;
    for (const h of C.hazards) {
      const i = T?.hazards?.indexOf(h) ?? -1;
      if (i >= 0) T.hazards.splice(i, 1);
    }
    C.hazards.length = 0;
  }

  // ── the measure ────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Everybody not in the fight within `within` m of its middle: [[key, metres past the ground's edge], …]. */
  function around(C, within) {
    const S = sim();
    const out_ = [];
    for (const w of S?.walkers ?? []) {
      if (w.hk2 || w.hide || w.gone || !w.p) continue;
      const d = dist(C, w.p[0], w.p[2]);
      if (d < within) out_.push([w, d - C.r]);
      // (a dog counts as a body: drawn ahead of its walker along its lane)
      if (w.dog >= 0 && w.E && S.ahead && d < within + 1) {
        S.ahead(w, DOG_LEAD, P4);
        const dd = dist(C, P4[0], P4[2]);
        if (dd < within) out_.push([`dog${w.id}`, dd - C.r]);
      }
    }
    for (const A of actors.all?.() ?? []) {
      if (C.keep.has(A.id) || A.w?.hide || A.room) continue;
      const d = dist(C, A.x, A.z);
      if (d < within) out_.push([A.id, d - C.r]);
    }
    return out_;
  }
  function describe(k) {
    if (typeof k !== 'string') return `${k.agent ? 'a city agent' : 'crowd'}${k.fix && !taken.has(k) ? ' (held by the city)' : ''}${k.dog >= 0 ? ' with a dog' : ''}${taken.has(k) ? (taken.get(k).back ? ', going back' : `, startled out${taken.get(k).stand ? ', nowhere to go' : taken.get(k).lane ? ', along its lane' : ''}`) : ''}${k.halt ? ', waiting' : ''}${C_hurried(k) ? ', let out' : ''}${k.E?.cross ? ', on a crossing' : ''} at ${(k.vc ?? 0).toFixed(1)} m/s`;
    if (k.startsWith('dog')) return 'a dog';
    const A = actors.get?.(k);
    const P = director?.people?.get(k);
    return A ? `ours, ${A.clipName ?? A.mode}${A.route ? ', walking' : ''}${P?.busy ? ', busy' : ''}${cur?.moved.has(k) ? ', stepped back' : ''} at ${(A.vc ?? 0).toFixed(1)} m/s` : k;
  }
  const C_hurried = w => !!cur?.hurried.has(w);
  function measure(C, dt) {
    C.age += dt;
    if (C.age < 1) return;
    const F = C.fig;
    const seen = around(C, C.r + 4);
    F.frames += 1;
    let near = 0;
    const now = new Set();
    for (const [k, g] of seen) {
      F.nearest = Math.min(F.nearest, g);
      // (who: the ones that came onto it or stayed at its edge, each as they were then, for the tools to say)
      if (g < NEAR) {
        const key = typeof k === 'string' ? k : `w${k.id}`;
        const W = (C.who[key] ??= { who: key, least: 99, from: +C.age.toFixed(2), for: 0 });
        if (g < W.least) {
          W.least = +g.toFixed(2);
          W.as = describe(k);
        }
        W.for = Math.max(W.for, +(C.age - (C.since.get(k) ?? C.age)).toFixed(2));
      }
      if (g < NEAR) {
        near += 1;
        now.add(k);
        if (!C.since.has(k)) C.since.set(k, C.age);
        else if (C.age - C.since.get(k) > LINGER && !C.lingered.has(k)) {
          C.lingered.add(k);
          F.lingers += 1;
        }
      }
    }
    for (const k of [...C.since.keys()]) if (!now.has(k)) C.since.delete(k);
    if (seen.some(([, g]) => g < ON)) F.on += 1;
    if (near) F.near += 1;
    F.most = Math.max(F.most, near);
  }

  actors.onFrame?.(dt => {
    [F.t0, F.places, F.searches] = [performance.now(), BUDGET.places, BUDGET.searches];
    if (taken.size) drive(dt);
    if (!cur) return;
    // (nothing here may throw every frame: the stage's hooks after this one would never be called. A room that throws
    // is closed)
    try {
      measure(cur, dt);
      if (!OFF) {
        crowd(cur, dt);
        ours(cur);
      }
    } catch (err) {
      stats.threw = (stats.threw ?? 0) + 1;
      if (stats.threw <= 3) console.warn('[room] closed: it threw', err?.stack ?? err);
      closeOf(cur);
      return;
    }
    // (what the room cost this frame, for the tools: its longest frame, in all and in this fight)
    const ms = performance.now() - F.t0;
    stats.msMax = Math.max(stats.msMax, +ms.toFixed(2));
    cur.fig.msMax = Math.max(cur.fig.msMax ?? 0, +ms.toFixed(2));
  });

  return {
    stats,
    /** A fight takes its ground: `c` its middle, `r` its own radius (m), `keep` the ids of who is in it. */
    open({ c, r, keep = [], quiet = false }) {
      const C = { quiet, c: [c[0], c[1]], r, keep: new Set(keep), moved: new Map(), cut: new Map(), hurried: new Map(), stood: new Set(), retry: new Map(), retryOurs: new Map(), held: new Map(), hazards: [], letOut: 0, sealed: false, age: 0, since: new Map(), lingered: new Set(), who: {}, fig: { frames: 0, on: 0, near: 0, lingers: 0, nearest: 99, most: 0 } };
      if (cur) closeOf(cur);
      cur = C;
      stats.opened += 1;
      if (!OFF && !quiet) stopCars(C);
      return {
        /** Who is in the room and not in the fight now (within the room's edge, or `within` m of the middle). */
        inside(within = edgeOf(C)) {
          const seen = around(C, within);
          return { n: seen.length, nearest: +Math.min(99, ...seen.map(([, g]) => g + C.r)).toFixed(2) };
        },
        /** The measure, from a second after it opened (above). */
        figures: () => ({ ...C.fig, nearest: +Math.min(99, C.fig.nearest).toFixed(2), r: C.r, who: Object.values(C.who).filter(W => W.least < ON || W.for > LINGER).sort((a, b) => a.least - b.least).slice(0, 5) }),
        close: () => closeOf(C),
      };
    },
    stress,
    get state() {
      return cur ? { on: !OFF, c: cur.c, r: cur.r, keep: [...cur.keep], edge: edgeOf(cur), letOut: cur.letOut, taken: taken.size, stats } : { on: false, taken: taken.size, stats };
    },
  };

  function closeOf(C) {
    if (cur === C) cur = null;
    letCars(C);
    // (the crowd: back to its own pace; the waiting walk on; the startled walk back to their lanes and on)
    for (const [w, H] of C.hurried) if (!w.gone) w.v = H.v;
    C.hurried.clear();
    for (const w of C.held.keys()) if (!w.gone && w.halt && !w.fix && !w.agent) w.halt = false;
    C.held.clear();
    for (const [w, T] of taken) if (T.C === C && !T.back) rejoin(T, w);
    // (ours: whoever stepped back goes back to where they stood, facing as they faced)
    for (const [id, M] of C.moved) {
      if (!actors.has(id)) continue;
      const A = actors.get(id);
      const done = () => {
        if (M.P) M.P.busy = Math.max(0, (M.P.busy ?? 1) - 1);
      };
      if (A.route || A.room || A.mode !== 'free') done();
      else {
        stats.wentBack += 1;
        actors.stepTo(id, M.x, M.z, { yaw: M.ry }).then(done, done);
      }
    }
    C.moved.clear();
    // (and whoever's walk was cut short: the director has them again, and lays their walk again)
    for (const [, M] of C.cut) if (M.P) M.P.busy = Math.max(0, (M.P.busy ?? 1) - 1);
    C.cut.clear();
  }
}
