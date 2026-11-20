// THE FIGHT'S FRAME CHECK, ON THE PAGE: every picture, everyone on the street round the fight (the fight's own people and
// the city's crowd) against the game camera's real frame at 1280 by 800 (frame.js). Anyone who comes on, goes off or is
// moved at once inside the picture is a fault; the auto-play (demo/tools/fight-run.mjs) fails on any.
//
// Not counted, and said apart (`hidden`): a body nobody can see there, behind something solid of the city's (the
// line from the camera to its head and to its chest both blocked: the city's own collision world, the one its
// camera keeps out of walls with) or under the street (in the subway's stairwell). Not counted at all: a frame the
// whole picture is cut (the stage's fade to black, or the camera put somewhere else at once).
// (streak-1) Also a fault, in any frame: a body posed by hand drawn with a part of it further from its hips than a body
// reaches (`stretched`, demo/fight/puppet/reach.js: every pose handed to the walkers' shader is measured as it is drawn).
import { viewOf, createFrameCheck, bodyIn, inView, BODY_BALL } from './frame.js';
import { stretchSince } from './puppet/reach.js';

export function createWatch({ city, actors, fade = null, near = null, street = 0, arena = null }) {
  const check = createFrameCheck();
  let stretchSeen = stretchSince(0).n;
  const world = city.cam?.world ?? null;
  let lastCam = null;
  let cutUntil = -1;
  let frame = 0;
  let on = true;
  const M = Array.from({ length: 16 }, () => 0);
  // THROUGH THE ARENA: the city's cars and its crowd inside the arena (a metre round it), frame by frame; and the
  // city's own count of cars that came on or went off on screen (traffic/render.js stats), over the watch
  const through = { cars: 0, carFrames: 0, walkers: 0, walkerFrames: 0, t0: null };
  const inArena = (x, z) => arena && x > arena[0] - 1 && x < arena[2] + 1 && z > arena[1] - 1 && z < arena[3] + 1;

  /** The game camera's picture now, as the owner's 1280 by 800 frame. */
  function view() {
    const cam = city.camera;
    cam.updateMatrixWorld();
    const e = cam.matrixWorld.elements;
    for (let k = 0; k < 16; k++) M[k] = e[k];
    return viewOf({ m: M, fov: cam.fov });
  }
  /** Can nobody see a body there: under the street, or behind something solid from the camera? */
  function hiddenAt(x, y, z) {
    if (y + 1.9 < street - 0.15) return true;
    if (!world?.ray) return false;
    const c = city.camera.position;
    const eye = { x: c.x, y: c.y, z: c.z };
    // (each line stops short of the body itself, so its own column of the city's world does not count)
    const blocked = h => {
      const [dx, dy, dz] = [x - eye.x, y + h - eye.y, z - eye.z];
      const L = Math.hypot(dx, dy, dz) || 1;
      const k = Math.max(0, (L - 0.6) / L);
      return !!world.ray(eye, { x: eye.x + dx * k, y: eye.y + dy * k, z: eye.z + dz * k });
    };
    return blocked(1.75) && blocked(1.0);
  }
  /** Whoever is on the street round the fight now: [{ id, on, x, y, z }]. */
  // (sixes-1: a walker of the crowd once watched stays watched while the city keeps it, wherever it walks: one walking
  // out of the `near` ring while still in the picture was counted as gone off, though it was there, drawn, walking on.
  // run-styles at the docks, 2026-11-18: "crowd:3610 went off" once in three runs)
  const tracked = new Set();
  function bodies() {
    const out = [];
    for (const A of actors.all()) out.push({ id: A.id, on: !A.w.hide, x: A.x, y: A.y ?? 0, z: A.z });
    for (const w of city.peds?.sim?.walkers ?? []) {
      if (w.hk2 || !w.p) continue;
      if (near && !near(w.p[0], w.p[2]) && !tracked.has(w.id)) continue;
      tracked.add(w.id);
      out.push({ id: `crowd:${w.id}`, on: !w.hide, x: w.p[0], y: w.p[1], z: w.p[2] });
    }
    return out;
  }

  return {
    view,
    /** Is a body standing at (x, z) in the picture now (a ball `pad` m wider than the check's)? */
    seen(x, z, y = street, pad = 0, v = view()) {
      return pad ? inView(v, [x, y + BODY_BALL.up, z], BODY_BALL.r + pad) : bodyIn(v, x, y, z);
    },
    hiddenAt,
    /** The page's own cut (it changed things under the black): this frame and the next are not counted. */
    cut() {
      cutUntil = frame + 2;
    },
    /** One picture: call it after the city has drawn. */
    step(t = null) {
      if (!on) return [];
      frame += 1;
      const c = city.camera;
      const now = [c.position.x, c.position.y, c.position.z, c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w];
      let jumped = false;
      if (lastCam) {
        const moved = Math.hypot(now[0] - lastCam[0], now[1] - lastCam[1], now[2] - lastCam[2]);
        const dot = Math.min(1, Math.abs(now[3] * lastCam[3] + now[4] * lastCam[4] + now[5] * lastCam[5] + now[6] * lastCam[6]));
        jumped = moved > 6 || 2 * Math.acos(dot) > 0.52;
      }
      lastCam = now;
      if (jumped || fade?.dark || fade?.black) cutUntil = Math.max(cutUntil, frame + 1);
      if (arena) {
        through.t0 ??= city.traffic?.stats?.() ?? null;
        const cars = (city.traffic?.sim?.cars ?? []).filter(q => inArena(q.x, q.z)).length;
        const walkers = (city.peds?.sim?.walkers ?? []).filter(w => !w.hk2 && !w.hide && w.p && inArena(w.p[0], w.p[2])).length;
        through.cars = Math.max(through.cars, cars);
        through.walkers = Math.max(through.walkers, walkers);
        if (cars) through.carFrames += 1;
        if (walkers) through.walkerFrames += 1;
      }
      const out = check.step(bodies(), view(), { cut: frame <= cutUntil, hidden: hiddenAt, t });
      // (a body drawn stretched: counted whatever the picture, a cut does not hide it)
      const st = stretchSince(stretchSeen);
      stretchSeen = st.n;
      if (st.count > 0) {
        const who = row => [...actors.all()].find(A => A.clipName === `fight_body_${'abcdefghijkl'[row]}`)?.id ?? `row ${row}`;
        const f = { id: who(st.list[0]?.row ?? -1), what: 'stretched', part: st.list[0]?.at, d: st.list[0] ? +Math.min(st.list[0].far, 1e6).toFixed(2) : null, n: st.count, t };
        check.faults.push(f);
        out.push(f);
      }
      return out;
    },
    set on(v) {
      on = !!v;
      stretchSeen = stretchSince(0).n;
      if (!on) check.reset();
    },
    /** What the check has found: faults (each { id, what, at, t }), what it let by as hidden, and how much it watched. */
    report() {
      const T1 = city.traffic?.stats?.() ?? null;
      const cars = through.t0 && T1 ? { onScreenSpawns: T1.onScreenSpawns - through.t0.onScreenSpawns, onScreenRemovals: T1.onScreenRemovals - through.t0.onScreenRemovals } : null;
      return { frames: check.frames, seen: check.seen, faults: check.faults.length, first: check.faults.slice(0, 16), hidden: check.hiddenOnes.length, hiddenFirst: check.hiddenOnes.slice(0, 8), through: { carsInArena: through.cars, carFrames: through.carFrames, walkersInArena: through.walkers, walkerFrames: through.walkerFrames, carsOnScreen: cars } };
    },
  };
}
