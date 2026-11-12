// THE SUBWAY: to the station's stairs and down; up the stairs and on to the place. All of it is the city's:
//   · the stairs are the station's own flight (subway/index.js: its block's anchors say where the top nosing is, which
//     way it goes down, the landing's height), and the walk down and up them is the city's own FLIGHT, called, not
//     copied: subway/index.js under(leg) with a `stairs` leg gives, for any moment, where the body is on the flight,
//     which way it faces, and the clip and the clip's clock (stairs_down / stairs_up, transit.js: a foot on every
//     tread), from the walk in to the top nosing to out of sight under the soffit, and back up and out onto the
//     sidewalk. Here the leg is timed in our own seconds (one "minute" a second);
//   · the person between the two stations is out of view, as in the city; for the person the camera follows, the
//     city's carriage scene (subway/carriage.js through subway/index.js ride()) may open over the city between the
//     two halves: `between()` below, a ride program of the city's own network (subway/net.js programOf) for the
//     trip the export's planner gives (world/export/travel.mjs).
// OURS: who goes first when several take the same stairs (a queue, a flight's length of a tread apart), and which
// station (the nearest to each end, rides.modeFor's).

/** Metres of walk from the stairs within which they are in the place's picture (and played). */
const NEAR = 14;
/** A station scene asked for far from the place starts this far short of the flight's walk in (m). */
const MARK = 1.5;
/** The departure's cut: this many treads down. */
const CUT = 9;
/** Seconds apart that people take one flight (the stairs are walked single file: 0.9 m/s along). */
const APART = 1.5;
/** The city's flight: the walk in before the top nosing (m) and its pace (subway/index.js FLIGHT). */
const FLIGHT = { out: 1.3, walk: 1.3, tread: 0.36, n: 14, v: 0.9 };

export function createSubway({ city, actors, kit, CLIPS, SUB, NET }) {
  const queue = new Map();
  const CLK = { secondsPerMinute: 1, now: () => null, pace: () => 1, epoch: () => 0 };
  const T_DOWN = FLIGHT.out / FLIGHT.walk + (FLIGHT.n * FLIGHT.tread) / FLIGHT.v + 0.2;
  const T_UP = (FLIGHT.out - FLIGHT.tread) / FLIGHT.walk + ((FLIGHT.n + 1) * FLIGHT.tread) / FLIGHT.v + 0.2;

  /** The station whose stairs suit a point: the one named, else the nearest. → { id, W (the flight), name } */
  function stationFor(x, z, id = null) {
    let best = null;
    for (const st of NET.stations.values()) {
      if (id && st.id !== id) continue;
      const d = Math.hypot(st.x - x, st.z - z);
      if (!best || d < best.d) best = { st, d };
    }
    if (!best) return null;
    const W = SUB.well(best.st.id);
    return W ? { id: best.st.id, name: best.st.name, W, d: best.d } : null;
  }

  /** My turn on a flight: resolves once whoever went before me on these stairs is a step ahead. */
  async function turn(J, key) {
    const q = queue.get(key) ?? [];
    queue.set(key, q);
    const before = q.length ? q[q.length - 1] : null;
    const me = { t: null };
    q.push(me);
    J.onEnd(() => {
      const k = q.indexOf(me);
      if (k >= 0) q.splice(k, 1);
    });
    if (before) await J.until(() => before.t !== null && actors.clock - before.t >= APART);
    me.t = actors.clock;
  }

  /** Plays a flight leg on a body from τ0; per frame the city's under() says where. Resolves at its end. */
  function flight(J, id, L, legs, tau0 = 0, onFrame = null) {
    const body = kit.own(id);
    const who = { id: `hk2:${id}` };
    let tau = tau0;
    let clip = null;
    let ramp = 0.15;
    return new Promise(resolve => {
      const step = dt => {
        const d = SUB.under(L, tau, legs, who, CLK);
        // (down: the city's flight is over when it says the body is out of view; up: at the leg's end, on the sidewalk)
        if (!J.live() || J.hurry || !d || d.show === false || tau > L.arr + 0.02) {
          resolve({ body, last: d });
          return true;
        }
        body.put(d.x, d.y, d.z, d.yaw, d.clip ? 0 : (d.vc ?? 0) * (L.dir === 'up' ? 1 : ramp));
        if (d.clip && clip !== d.clip) {
          clip = d.clip;
          actors.play(id, d.clip, { loop: true, hold: 0 });
        } else if (!d.clip && clip) {
          clip = null;
          actors.stop(id);
        }
        if (d.clip) kit.clipAt(id, d.clip, d.clipT, dt);
        onFrame?.(d, tau);
        // (the city's walk in starts at its full 1.3 m/s: from a standstill it is eased into over its first half second)
        ramp = Math.min(1, ramp + dt / 0.5);
        tau += dt * (L.dir === 'up' ? 1 : ramp);
        return false;
      };
      step(0);
      kit.every(step);
    });
  }

  // ── the departure ───────────────────────────────────────────────────────────────────────────────────────────────
  // THE STAIRS ARE PLAYED WHERE THEY ARE IN THE SHOT: within NEAR m of the walk. A station farther off than that is not
  // in the place's picture: the person walks off toward it (the foot scene), unless `stairs: true` asks for the station
  // scene anyway, which then STARTS AT THE STATION (the person put a few steps short of the flight: the stage cuts there).
  async function leave(J, id, o) {
    const A = actors.get(id);
    const S = stationFor(A.x, A.z, o.station);
    if (!S) return o.scooter(J, id, o);
    const { W } = S;
    const [dx, dz] = W.dir;
    // the walk in starts on the sidewalk FLIGHT.out m before the top nosing, facing down the flight
    const AP = [W.top[0] - dx * FLIGHT.out, W.top[1] - dz * FLIGHT.out];
    const way = actors.wayLength(id, AP[0], AP[1]) ?? Math.hypot(AP[0] - A.x, AP[1] - A.z);
    const near = way <= NEAR;
    if (!(o.stairs ?? near)) return o.foot(J, id, { ...o, toward: AP });
    kit.claim(id, 'stairs', AP[0], AP[1], 0.9);
    if (J.hurry) return gone(J, id);
    if (!near) actors.place(id, AP[0] - dx * MARK, AP[1] - dz * MARK, W.yaw);
    // (a queue at the top: whoever came second waits a step back, to the side)
    const key = `${S.id}`;
    const q = queue.get(key);
    if (q?.length) {
      const [px, pz] = [-dz, dx];
      await kit.walk(J, id, AP[0] - dx * 1.4 + px * 0.8, AP[1] - dz * 1.4 + pz * 0.8, { yaw: W.yaw });
    }
    await turn(J, key);
    if (!J.live()) return null;
    if (J.hurry) return gone(J, id);
    await kit.walk(J, id, AP[0], AP[1], { yaw: W.yaw, v: 1.5 });
    const walked = actors.clock - J.t0;
    if (!J.live()) return null;
    actors.turn(id, W.yaw);
    await actors.turned([id], 0.8);
    if (!J.live()) return null;
    // DOWN. The cut comes CUT treads down (on their way under); the flight plays on to its end behind it, and then
    // the person is off the stage
    const L = { kind: 'stairs', from: S.id, to: S.id, dep: 0, arr: T_DOWN, dir: 'down' };
    let cutNow = null;
    const cutP = new Promise(resolve => (cutNow = resolve));
    const tCut = FLIGHT.out / FLIGHT.walk + (CUT * FLIGHT.tread) / FLIGHT.v;
    flight(J, id, L, [L], 0, (d, tau) => tau >= tCut && cutNow()).then(r => {
      r.body.release();
      if (J.live()) gone(J, id);
      cutNow();
    });
    await cutP;
    return { cut: actors.clock - J.t0, walk: +walked.toFixed(2), station: S.id, stairs: true, staged: !near };
  }

  function gone(J, id) {
    // (a scene that has been replaced, the person's next one playing, leaves them alone)
    if (!J.live()) return { cut: actors.clock - J.t0, stale: true };
    kit.owned.get(id)?.release();
    if (actors.has(id)) {
      actors.cutClip(id);
      actors.show(id, false);
    }
    J.stop('gone');
    return { cut: actors.clock - J.t0 };
  }

  // ── the arrival ─────────────────────────────────────────────────────────────────────────────────────────────────
  async function arrive(J, id, o) {
    const [ax, az] = o.at;
    const spot = actors.fitSpot(ax, az);
    const S = stationFor(spot.x, spot.z, o.station);
    if (!S) return o.scooter(J, id, o);
    // (as the departure: the stairs when they are in the place's picture, else walking in from the station's side)
    const AP = [S.W.top[0] - S.W.dir[0] * FLIGHT.out, S.W.top[1] - S.W.dir[1] * FLIGHT.out];
    const way = actors.routeOf(AP[0], AP[1], spot.x, spot.z)?.metres ?? Math.hypot(AP[0] - spot.x, AP[1] - spot.z);
    if (!(o.stairs ?? way <= NEAR)) return o.foot(J, id, { ...o, from: AP });
    if (J.hurry) return settle(J, id, spot);
    await turn(J, `up:${S.id}`);
    if (!J.live()) return null;
    if (J.hurry) return settle(J, id, spot);
    const L = { kind: 'stairs', from: S.id, to: S.id, dep: 0, arr: T_UP, dir: 'up' };
    // (it starts under the soffit, out of sight: the body is put there, the clip on, then shown)
    const d0 = SUB.under(L, 0.21, [L], { id: `hk2:${id}` }, CLK);
    if (!d0) return settle(J, id, spot);
    await kit.appear(id, d0.x, d0.z, d0.yaw, 'stairs_up', { loop: true });
    if (!J.live()) return null;
    const r = await flight(J, id, L, [L], 0.21);
    const end = r.body.pose;
    r.body.release(actors.GROUND);
    actors.stop(id);
    if (!J.live()) return null;
    if (J.hurry) return settle(J, id, spot);
    actors.place(id, end.x, end.z, end.yaw);
    await kit.walk(J, id, spot.x, spot.z, { v: way > NEAR ? 1.9 : 1.5 });
    if (!J.live()) return null;
    J.stop('arrived');
    return { at: [actors.get(id).x, actors.get(id).z], station: S.id, stairs: true };
  }

  function settle(J, id, spot) {
    // (a scene that has been replaced, the person's next one playing, leaves them alone)
    if (!J.live()) return { cut: actors.clock - J.t0, stale: true };
    kit.owned.get(id)?.release();
    if (actors.has(id)) {
      actors.cutClip(id);
      actors.place(id, spot.x, spot.z, actors.get(id).ry);
      actors.show(id, true);
    }
    J.stop('settled');
    return { at: [spot.x, spot.z], settled: true };
  }

  return { leave, arrive, stationFor, T_DOWN, T_UP };
}
