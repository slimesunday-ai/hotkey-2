// THE RIDES' SHARED PIECES: what every scene (scooter.js, cab.js, subway.js, foot.js) needs of the actors and the
// city, and nothing else. Read-only use of demo/stage/actors.js: its public calls, and its own record of a person
// (actors.get(id)) for the three things it has no call for:
//   · own(id): a body moved by a scene frame by frame (down a flight of stairs, out of a cab's door) instead of by a
//     route of its own. The actor is kept as a body "in a room" meanwhile (A.room: actors.js then leaves its height
//     and its place alone and nobody is pushed off it), and handed back where it stands;
//   · clipAt(id, name, t): a clip held to a clock of the scene's (the stairs' treads, the scooter's wheels at the
//     speed it really goes), the way the city's own mover does it (simstate/movement.js gait hook: g.clip.t);
//   · snap(id, name): a clip put on at full weight on the frame a person comes into the picture at a cut (someone
//     who arrives riding is riding on the first frame; car_get_out "starts low in the door", transit.js).
// Everything here runs off the actors' clock and frame (actors.onFrame), so the stage's speed (1, 2, 4, 0) holds.

export function createKit({ city, actors, CLIPS, haste = 1 }) {
  const THREE = city.THREE;
  const GROUND = actors.GROUND;
  const frameFns = new Set();
  actors.onFrame((dt, realDt) => {
    for (const fn of [...frameFns]) fn(dt, realDt);
  });
  /** Calls fn(dt) every frame (stage seconds) until it returns true or the returned stop() is called. */
  function every(fn) {
    const wrap = (dt, realDt) => {
      if (fn(dt, realDt) === true) frameFns.delete(wrap);
    };
    frameFns.add(wrap);
    return () => frameFns.delete(wrap);
  }

  // ── what the camera sees ──────────────────────────────────────────────────────────────────────────────────────────
  const FR = new THREE.Frustum();
  const PM = new THREE.Matrix4();
  const SPH = new THREE.Sphere();
  /** Is a point (with a radius round it) inside the camera's view? Nothing between is checked: a roof still counts. */
  function inView(x, y, z, r = 1.2) {
    const cam = city.camera;
    cam.updateMatrixWorld();
    PM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    FR.setFromProjectionMatrix(PM);
    SPH.center.set(x, y, z);
    SPH.radius = r;
    return FR.intersectsSphere(SPH);
  }

  // ── jobs: one scene per person at a time, cancellable ────────────────────────────────────────────────────────────
  const jobs = new Map();
  /**
   * A scene's handle for one person: `live()` false once it was cancelled or replaced; `hurry` set when it should
   * finish at once; `onEnd(fn)` runs on its end however it ends (its vehicle and props are cleared there).
   */
  function job(id, kind, o = {}) {
    const old = jobs.get(id);
    if (old) old.stop('replaced');
    const J = {
      id, kind, hurry: !!o.hurried, stopped: null, ends: [], t0: actors.clock,
      live: () => !J.stopped && jobs.get(id) === J,
      onEnd(fn) {
        J.ends.push(fn);
      },
      stop(why) {
        if (J.stopped) return;
        J.stopped = why;
        if (jobs.get(id) === J) jobs.delete(id);
        for (const fn of J.ends.splice(0)) {
          try {
            fn(why);
          } catch (err) {
            console.warn('rides: a scene did not end cleanly', err);
          }
        }
        J.wake?.();
      },
      /** Resolves after `s` stage seconds, or at once when the job is stopped or hurried. */
      wait(s) {
        const end = actors.clock + s;
        return actors.until(() => actors.clock >= end || !J.live() || J.hurry);
      },
      /** Resolves when test() is true, or when the job is stopped or hurried. */
      until(test) {
        return actors.until(() => !J.live() || J.hurry || test());
      },
    };
    jobs.set(id, J);
    return J;
  }

  // ── a body the scene moves itself ────────────────────────────────────────────────────────────────────────────────
  const owned = new Map();
  /**
   * Takes a person's body for a scene: from now on put(x, y, z, yaw, v) places it each frame (v: the speed the legs
   * walk at, 0 for a body whose clip poses its legs). release() hands it back standing where it is.
   */
  function own(id) {
    const A = actors.get(id);
    actors.place(id, A.x, A.z, A.ry, A.y);
    const P = { x: A.x, y: A.y, z: A.z, yaw: A.ry, v: 0 };
    A.x0 = A.x;
    A.z0 = A.z;
    const stop = every(dt => {
      if (!actors.has(id) || actors.get(id) !== A) return true;
      const w = A.w;
      A.x = P.x;
      A.y = P.y;
      A.z = P.z;
      A.ry = P.yaw;
      // (the speed the body really goes, for whoever reads it: the stairs' clips pose the legs and say 0)
      const moved = dt > 0 ? Math.hypot(P.x - A.x0, P.z - A.z0) / dt : 0;
      A.x0 = P.x;
      A.z0 = P.z;
      A.vc = Math.max(P.v, Math.min(moved, 3));
      A.moving = A.vc;
      w.fix[0] = w.p[0] = P.x;
      w.fix[1] = w.p[1] = P.y;
      w.fix[2] = w.p[2] = P.z;
      w.fix[3] = w.p[3] = P.yaw;
      w.vc = P.v;
      w.ph += P.v * dt * 3.1;
      return false;
    });
    const handle = {
      put(x, y, z, yaw, v = 0) {
        Object.assign(P, { x, y, z, yaw, v });
      },
      snapYaw() {
        A.w.yawS = P.yaw;
        A.w.omega = 0;
      },
      get pose() {
        return P;
      },
      release(standY = null) {
        if (!owned.has(id) || owned.get(id) !== handle) return;
        stop();
        owned.delete(id);
        if (!actors.has(id)) return;
        A.room = false;
        A.vc = 0;
        // (back on the ground the actors keep it on: a sidewalk's height eased to, never a drop)
        if (standY !== null) A.y = standY;
      },
    };
    owned.get(id)?.release();
    owned.set(id, handle);
    return handle;
  }

  /** Holds the clip on a body to the scene's clock: `t` is where it should be this frame. */
  function clipAt(id, name, t, dt) {
    const g = actors.get(id).w.g;
    if (g?.clip && g.clip.name === name && !g.clip.out) g.clip.t = t - dt;
  }
  /** Puts a clip on at full weight at once (a body coming into the picture at a cut is already in it). */
  function snap(id, name, { loop = undefined, t = 0 } = {}) {
    const A = actors.get(id);
    const c = CLIPS.CLIP[name];
    const W = { name, loop: loop ?? c.loop, t, after: 0, began: actors.clock, walk: true };
    if (A.w.g) CLIPS.playClip(A.w.g, name, { t, loop: W.loop, snap: true });
    // (no gait yet: actors.js resume() puts a loop on at full weight on the body's first drawn frame)
    A.asked = W;
    A.want = W;
    return W;
  }
  /**
   * A person comes into the picture at a cut, already in a clip: put at (x, z) facing `yaw`, held out of sight under
   * the street for the frame or two until the city has a gait for the body, and only then up, in the clip at full
   * weight (a one-shot too: car_get_out starts low in a cab's door).
   */
  async function appear(id, x, z, yaw, name, { loop = undefined, t = 0 } = {}) {
    const A = actors.get(id);
    actors.place(id, x, z, yaw);
    const y = A.y;
    A.room = true;
    A.y = -8;
    A.w.fix[1] = A.w.p[1] = -8;
    actors.cutClip(id);
    actors.show(id, true);
    const t0 = actors.clock;
    await actors.until(() => !actors.has(id) || A.w.g || actors.clock - t0 > 0.4);
    if (!actors.has(id)) return;
    snap(id, name, { loop, t });
    A.y = y;
    A.w.fix[1] = A.w.p[1] = y;
    A.room = false;
  }

  /**
   * A walk inside a scene that cannot hang it: actors.walkTo, and when it has not got there in the time a walk that
   * long takes (at 1 m/s, and 6 s more), or got nowhere, the person is put there (out of the picture: at once; in
   * it: a straight step). → walkTo's answer, with `forced` when it was ended so.
   */
  async function walk(J, id, x, z, o = {}) {
    const A = actors.get(id);
    // (A FEW STEPS ARE A FEW STEPS. To a mark a dozen metres off with open ground between, the way is over the ground
    // (actors.groundWay), not out to the walkers' lane and round by it: at a dealing corner, whose lane dips into the
    // road on ramps, the walk to a scooter three metres away took ten seconds by the lanes)
    if (!o.how && actors.groundWay) {
      const d = Math.hypot(x - A.x, z - A.z);
      const ground = d < 16 ? actors.groundWay(A.x, A.z, x, z) : null;
      if (ground !== null && ground < d * 1.5 + 2) o = { ...o, how: 'straight' };
    }
    // (THE GAME'S HOUR IS TEN SECONDS: its walks to a scooter, from a kerb, in from the lane are at `haste` times the
    // city's stroll. createRides({ haste }): 1 on the dev page, as its builder measured them)
    o = { ...o, v: (o.v ?? 1.5) * haste };
    const far = (o.how === 'straight' ? actors.groundWay?.(A.x, A.z, x, z) : null) ?? actors.wayLength(id, x, z) ?? Math.hypot(x - A.x, z - A.z);
    const limit = far / Math.min(1, o.v ?? 1.5) + 6;
    const t0 = actors.clock;
    let late = false;
    // (whoever stands by the mark this walk is TO, a bench's other sitter, is where it is going and not in its way:
    // an arrival at the park stood behind its bench neighbour until this walk's limit ran out, 17 s, and was set
    // down on its spot)
    actors.passing?.(id, actors.nextTo?.(x, z, 1.6, id) ?? null);
    const r = await Promise.race([actors.walkTo(id, x, z, o), actors.until(() => !J.live() || actors.clock - t0 > limit).then(() => (late = true) && null)]);
    if (J.live()) actors.passing?.(id, null);
    if (!J.live()) return r ?? { arrived: false };
    if (late || Math.hypot(A.x - x, A.z - z) > 0.6) {
      if (!kit.inView(A.x, 1, A.z, 1) || late) actors.place(id, x, z, o.yaw ?? A.ry);
      else await actors.stepTo(id, x, z, { yaw: o.yaw ?? null });
      return { ...(r ?? {}), arrived: true, forced: true };
    }
    return r;
  }

  // ── room for several people at once ──────────────────────────────────────────────────────────────────────────────
  // A mark a scene has given one person (a place to stand at the kerb, a scooter's parking, the top of a flight)
  // is held for them until their scene ends; nobody else's mark is put within `r` of it.
  const marks = new Map();
  function claim(id, key, x, z, r = 1) {
    marks.set(`${id}|${key}`, { id, x, z, r });
  }
  function unclaim(id) {
    for (const k of [...marks.keys()]) if (k.startsWith(`${id}|`)) marks.delete(k);
  }
  /** Is a point clear of everyone else's marks (and of anyone of ours standing there)? */
  function clearOf(id, x, z, r = 1) {
    for (const M of marks.values()) if (M.id !== id && Math.hypot(M.x - x, M.z - z) < Math.max(r, M.r)) return false;
    return actors.free(x, z, Math.min(r, 0.75), [id]);
  }

  // ── small helpers ────────────────────────────────────────────────────────────────────────────────────────────────
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const ease = u => u * u * (3 - 2 * u);
  const lerp = (a, b, u) => a + (b - a) * u;
  /** A point `m` metres along a list of route points ([x, y, z, heading] every `step` m) → [x, z, heading]. */
  function along(points, m, step = 0.25) {
    if (!points?.length) return null;
    const k = Math.max(0, Math.min(points.length - 1, Math.round(m / step)));
    const p = points[k];
    return [p[0], p[2], p[3]];
  }

  const kit = { THREE, GROUND, haste, every, inView, job, jobs, own, owned, clipAt, snap, appear, walk, claim, unclaim, clearOf, wrap, ease, lerp, along };
  return kit;
}
