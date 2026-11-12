// THE SCOOTER: on, off along the sidewalk; in, off, stand. Everything drawn is the city's:
//   · the e-scooter is ride-props.js's one model, in its parts (the frame, two wheels, the kickstand), posed by the
//     city's own partMatrices: ridden (the stand up, upright) or parked (PARKED: leaned 0.12 rad onto its stand,
//     parkedMatrix). Ridden, it is the scooter_ride clip's own prop, drawn by actors.js at the walker (the wheels and
//     the deck's jolts on the clip's clock);
//   · the rider is the scooter_ride clip (anim/cast/clips/ride.js: a standing-leg clip that travels: the owner moves
//     the walker at the clip's 6.5 m/s and keeps the walk off), its clock held to the distance really covered, so
//     the wheels turn at the speed the scooter goes and stand still when it stands;
//   · the way is the walkers' graph, as the city rides its scooters (simstate/movement.js: scooter legs ride the
//     walkers' lanes): actors.walkTo along the sidewalks, braking and stepping round people as any walk of ours.
// WHAT IS OURS (the city has none of it, see README "missing, for the owner"): where a scooter is when nobody rides it
// (a parked one beside the rider, on its stand), getting on (the stand folds and it is pulled under the rider, who
// steps up onto the deck as the clip comes in) and getting off (the reverse, and it is left on its stand at the kerb
// side, taken away once the camera cannot see it).

/** The scooter is pulled this far under its rider from beside them (m), and left this far to the kerb side of them. */
const BESIDE = 0.55;
/** Seconds: the stand folds and it comes upright · it is pulled under · the rider steps up (the clip's blend). */
const MOUNT = { lift: 0.3, pull: 0.35, up: 0.3 };
/** Riding away: the cut comes this long after the wheels start, or sooner once the rider is out of the picture. */
const AWAY = 2.4;
/** Metres the departure rides on along the way out (it is long: the camera has cut away well before its end). */
const RIDE_OUT = 70;
/** Metres back along the way in that an arrival starts (at the cut), already riding at full speed. */
const RIDE_IN = 17;

export function createScooter({ city, actors, kit, CLIPS, RP, PLAN }) {
  const THREE = city.THREE;
  const CLIP = CLIPS.CLIP.scooter_ride;
  const PROP = CLIP.prop;
  const V = CLIP.ride?.v ?? RP.SCOOTER.speed;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const parked = new Map();
  let serial = 0;

  /** One scooter of the city's model, in its parts: pose(x, y, z, yaw, k, t) with k 0 ridden … 1 parked. */
  function makeScooter() {
    const list = RP.partMatrices(THREE, 'scooter', RP.REST);
    const meshes = list.map(([part]) => {
      const m = new THREE.Mesh(RP.partGeometry(THREE, 'scooter', part), mat);
      m.matrixAutoUpdate = false;
      m.castShadow = true;
      m.frustumCulled = false;
      m.name = `hk2:rides:scooter:${part}`;
      city.scene.add(m);
      return m;
    });
    const W = new THREE.Matrix4();
    const R = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const UP = new THREE.Vector3(0, 1, 0);
    const P3 = new THREE.Vector3();
    const ONE = new THREE.Vector3(1, 1, 1);
    let outs = null;
    const S = {
      id: ++serial, x: 0, y: 0, z: 0, yaw: 0, k: 1, owner: null,
      pose(x, y, z, yaw, k = 0, t = 0) {
        Object.assign(S, { x, y, z, yaw, k });
        Q.setFromAxisAngle(UP, yaw);
        P3.set(x, y, z);
        W.compose(P3, Q, ONE);
        // (leaned onto its stand by the city's parked roll, as far as it is parked)
        if (k > 0) W.multiply(R.makeRotationZ(-RP.PARKED.scooter.roll * k));
        const ride = PROP.pose(t);
        outs = RP.partMatrices(THREE, 'scooter', { ...RP.REST, wheel: ride.wheel, lift: k > 0 ? 0 : ride.lift, stand: k }, outs);
        outs.forEach(([, local], n) => meshes[n].matrix.multiplyMatrices(W, local));
      },
      show(on) {
        for (const m of meshes) m.visible = !!on;
      },
      remove() {
        for (const m of meshes) m.removeFromParent();
        parked.delete(S.id);
      },
    };
    S.show(false);
    return S;
  }

  /** The way along the sidewalk from a point, and which side of it the kerb is: → { yaw, kerb: [x, z] unit } */
  function sideAt(x, z, toward) {
    const L = actors.laneLine(x, z);
    if (!L) return null;
    let [ux, uz] = [L.ux, L.uz];
    if ((toward[0] - x) * ux + (toward[1] - z) * uz < 0) [ux, uz] = [-ux, -uz];
    // (the kerb: the side of the lane where the road is nearer)
    const [px, pz] = [-uz, ux];
    const kerb = PLAN.kerbOut(L.x + px * 1.2, L.z + pz * 1.2) < PLAN.kerbOut(L.x - px * 1.2, L.z - pz * 1.2) ? [px, pz] : [-px, -pz];
    return { lx: L.x, lz: L.z, ux, uz, yaw: Math.atan2(ux, uz), kerb };
  }

  /**
   * ON THE BLOCK'S OWN SIDEWALKS: how far along a way (its points every 0.25 m) a ride may go, at most `m`, before
   * its first crossing (2 m short of the kerb). A scooter at speed meets the crowd waiting at the lights there, and
   * the kerb's step at 6.5 m/s is a frame or two off the ground. Never less than `min`.
   */
  function kerbward(points, m, min = 7) {
    for (let k = 0; k * 0.25 <= m && k < points.length; k++) {
      if (!actors.onRoad(points[k][0], points[k][2])) continue;
      // (a crossing right ahead, nearer than NEAR_CROSS: stopping short of it would stop in the picture; it is ridden)
      if (k * 0.25 < NEAR_CROSS) return m;
      return Math.max(min, Math.min(m, k * 0.25 - 2));
    }
    return m;
  }
  const NEAR_CROSS = 12;

  /** Is the actors' own scooter (the clip's prop) on screen this frame? */
  const propShown = id => [...(actors.get(id).props?.values() ?? [])].some(m => m.visible && /scooter/.test(m.name));

  /** Rides `id` to (x, z) along the sidewalks with the clip held to the distance; resolves with walkTo's answer. */
  // (HELD UP: a scooter that stands STALL s behind somebody who does not make way, a body of the city's crowd standing
  // in its stand spot, ends its ride there: the rider gets off and walks the rest. → { stalled: true })
  const STALL = 1.6;
  function ride(J, id, x, z, { yaw = null, tc = { t: 0 } } = {}) {
    const A = actors.get(id);
    let held = 0;
    let mark = null;
    let stalled = false;
    const stop = kit.every(dt => {
      if (!J.live()) return true;
      tc.t += (dt * A.vc) / V;
      kit.clipAt(id, 'scooter_ride', tc.t, dt);
      // (held up: under half a metre made good in STALL s, on a route)
      if (!A.route || Math.hypot(A.x - (mark?.[0] ?? A.x), A.z - (mark?.[1] ?? A.z)) > 0.5) {
        mark = [A.x, A.z];
        held = 0;
      } else held += dt;
      if (held > STALL && !stalled) {
        stalled = true;
        // (a new order ends the route where the body stands: actors.place, standing, the clip kept)
        actors.place(id, A.x, A.z, A.ry);
        return true;
      }
      return false;
    });
    return actors.walkTo(id, x, z, { v: V, clip: 'scooter_ride', yaw }).then(r => (stalled ? { ...r, arrived: false, stalled: true } : r)).finally(stop);
  }

  /** Down off the deck where the rider stands; the scooter left on its stand to the kerb side. → the scooter */
  async function getOff(J, id, side, tc) {
    const A = actors.get(id);
    const S = makeScooter();
    const at = () => [A.w.p[0], A.w.p[1], A.w.p[2], A.w.yawS ?? A.ry];
    S.pose(...at(), 0, tc);
    S.show(true);
    actors.stop(id);
    // (the clip blends out over its own 0.3 s: the body comes down off the deck, the actors' prop goes at 0.6 and ours is
    // already there in the very same pose)
    await J.wait(CLIP.blendOut + 0.05);
    const [x0, y0, z0, yaw] = at();
    const [kx, kz] = side.kerb;
    const t0 = actors.clock;
    const T = MOUNT.pull + MOUNT.lift;
    await new Promise(resolve => {
      kit.every(() => {
        const u = Math.min(1, (actors.clock - t0) / T);
        const pull = kit.ease(Math.min(1, u * (T / MOUNT.pull)));
        const lean = kit.ease(Math.max(0, (u * T - MOUNT.pull) / MOUNT.lift));
        S.pose(x0 + kx * BESIDE * pull, y0, z0 + kz * BESIDE * pull, yaw, lean, tc);
        if (u >= 1 || !J.live() || J.hurry) {
          resolve();
          return true;
        }
        return false;
      });
    });
    S.pose(x0 + kx * BESIDE, y0, z0 + kz * BESIDE, yaw, 1, tc);
    return S;
  }

  /** Leaves a scooter parked: it stays until the camera cannot see it, or its owner rides off on it. */
  function park(S, owner) {
    S.owner = owner;
    parked.set(S.id, S);
    const stop = kit.every(() => {
      if (!parked.has(S.id)) return true;
      if (S.owner !== null && actors.has(S.owner) && kit.jobs.get(S.owner)?.kind === 'scooter') return false;
      if (!kit.inView(S.x, 0.5, S.z, 1)) {
        S.remove();
        return true;
      }
      return false;
    });
    S.unpark = () => {
      stop();
      parked.delete(S.id);
    };
  }

  /** A parked scooter of this person's near them, or null. */
  function parkedOf(id, x, z, r = 9) {
    for (const S of parked.values()) if (S.owner === id && Math.hypot(S.x - x, S.z - z) < r) return S;
    return null;
  }

  // ── the departure ─────────────────────────────────────────────────────────────────────────────────────────────
  async function leave(J, id, o) {
    const A = actors.get(id);
    const toward = o.toward;
    let S = parkedOf(id, A.x, A.z);
    // THE PLACE TO GET ON: on the walkers' lane beside the person (the riders' way), a step on toward the way out,
    // with the scooter on its stand beside it to the kerb side. Their own parked scooter, if they came on one
    let side;
    let M;
    if (S) {
      S.unpark();
      side = sideAt(S.x, S.z, toward) ?? { yaw: S.yaw, kerb: [Math.cos(S.yaw), -Math.sin(S.yaw)] };
      M = [S.x - side.kerb[0] * BESIDE, S.z - side.kerb[1] * BESIDE];
      side.yaw = S.yaw;
    } else {
      side = sideAt(A.x, A.z, toward);
      if (!side) return foot(J, id, o);
      M = [side.lx + side.ux * 1, side.lz + side.uz * 1];
      for (const more of [0, 1.4, 2.8, 4.2, -1.4]) {
        const p = [side.lx + side.ux * (1 + more), side.lz + side.uz * (1 + more)];
        if (kit.clearOf(id, p[0], p[1], 1.1)) {
          M = p;
          break;
        }
      }
      S = makeScooter();
      S.pose(M[0] + side.kerb[0] * BESIDE, actors.GROUND, M[1] + side.kerb[1] * BESIDE, side.yaw, 1, 0);
      S.show(true);
    }
    kit.claim(id, 'scooter', M[0], M[1], 1.2);
    J.onEnd(() => S.remove());
    const tc = { t: 0 };
    if (J.hurry) return gone(J, id);
    await kit.walk(J, id, M[0], M[1], { yaw: side.yaw });
    const walked = actors.clock - J.t0;
    if (!J.live()) return null;
    await actors.turned([id], 1);
    // ON: the stand folds and the scooter comes upright beside them, it is pulled under them, they step up onto the
    // deck (the clip blends in and lifts the body onto it; its own prop takes over from ours in the same pose)
    const [sx, sz] = [S.x, S.z];
    const t0 = actors.clock;
    const T = MOUNT.lift + MOUNT.pull;
    await new Promise(resolve => {
      kit.every(() => {
        const s = actors.clock - t0;
        const lift = kit.ease(Math.min(1, s / MOUNT.lift));
        const pull = kit.ease(Math.max(0, Math.min(1, (s - MOUNT.lift) / MOUNT.pull)));
        const [px, pz, yaw] = [A.w.p[0], A.w.p[2], A.w.yawS ?? A.ry];
        S.pose(kit.lerp(sx, px, pull), actors.GROUND, kit.lerp(sz, pz, pull), kit.lerp(S.yaw, yaw, pull), 1 - lift, 0);
        if (s >= T || !J.live() || J.hurry) {
          resolve();
          return true;
        }
        return false;
      });
    });
    if (!J.live()) return null;
    actors.play(id, 'scooter_ride', { loop: true, hold: 0 });
    // (ours follows the walker until the clip's own prop is drawn, then it goes)
    await new Promise(resolve => {
      const t1 = actors.clock;
      kit.every(dt => {
        kit.clipAt(id, 'scooter_ride', 0, dt);
        S.pose(A.w.p[0], actors.GROUND, A.w.p[2], A.w.yawS ?? A.ry, 0, 0);
        if (propShown(id) || actors.clock - t1 > 1.5 || !J.live()) {
          resolve();
          return true;
        }
        return false;
      });
    });
    S.show(false);
    await J.wait(Math.max(0, MOUNT.up - (actors.clock - t0 - T)));
    if (!J.live()) return null;
    // OFF along the sidewalk, toward the way out
    const way = actors.routeOf(A.x, A.z, toward[0], toward[1]);
    const end = way ? kit.along(way.points, kerbward(way.points, Math.min(way.metres, RIDE_OUT))) : [A.x + side.ux * RIDE_OUT, A.z + side.uz * RIDE_OUT];
    const tRide = actors.clock;
    const riding = ride(J, id, end[0], end[1], { tc });
    await J.until(() => actors.clock - tRide >= AWAY || (actors.clock - tRide > 0.8 && !kit.inView(A.x, 1, A.z, 0.8)));
    // THE CUT. The ride goes on behind it: at its end, out of the picture, the rider is taken off the stage; still in
    // it (a camera that lingers), they get off and leave the scooter on its stand like anybody
    const cutAt = actors.clock - J.t0;
    riding.then(async r => {
      if (!J.live()) return;
      if ((!r.arrived && !r.stalled) || !kit.inView(A.x, 1, A.z, 1)) return gone(J, id);
      const P = await getOff(J, id, sideAt(A.x, A.z, toward) ?? side, tc.t);
      if (!J.live()) return P.remove();
      park(P, id);
      await J.until(() => !kit.inView(A.x, 1, A.z, 1));
      gone(J, id);
    });
    return { cut: cutAt, walk: +walked.toFixed(2) };
  }

  /** Off the stage (out of the picture, or hurried): hidden, nothing on the body, the scene over. */
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

  function foot(J, id, o) {
    return o.foot(J, id, o);
  }

  // ── the arrival ───────────────────────────────────────────────────────────────────────────────────────────────
  async function arrive(J, id, o) {
    const A = actors.get(id);
    const [ax, az] = o.at;
    const spot = actors.fitSpot(ax, az);
    // where they get off: on the walkers' lane beside their place, a little short of it, clear of anyone else's
    const come = actors.routeOf(spot.x, spot.z, o.from[0], o.from[1]);
    const back = come?.points?.length ? come.points : null;
    const side0 = sideAt(spot.x, spot.z, back ? kit.along(back, 6) : o.from);
    if (!side0) return o.foot(J, id, o);
    // (the side the rider comes from: the lane runs from `back` toward the spot)
    const sd = sideAt(spot.x, spot.z, [spot.x - side0.ux, spot.z - side0.uz]);
    let D = [sd.lx - sd.ux * 0.6, sd.lz - sd.uz * 0.6];
    for (const more of [0, -1.5, 1.5, -3, 3, -4.5]) {
      const p = [sd.lx + sd.ux * (more - 0.6), sd.lz + sd.uz * (more - 0.6)];
      if (kit.clearOf(id, p[0], p[1], 1.3)) {
        D = p;
        break;
      }
    }
    kit.claim(id, 'scooter', D[0], D[1], 1.3);
    if (J.hurry) return settle(J, id, spot);
    // THE START (at the cut): RIDE_IN metres back along the way they come, riding at full speed from the first frame
    const lead = actors.routeOf(D[0], D[1], o.from[0], o.from[1]);
    const S0 = lead?.points?.length ? kit.along(lead.points, kerbward(lead.points, Math.min(RIDE_IN, lead.metres))) : [D[0] - sd.ux * RIDE_IN, D[1] - sd.uz * RIDE_IN];
    const way = actors.routeOf(S0[0], S0[1], D[0], D[1]);
    const yaw0 = way?.points?.[Math.min(4, way.points.length - 1)]?.[3] ?? sd.yaw;
    await kit.appear(id, S0[0], S0[1], yaw0, 'scooter_ride', { loop: true });
    if (!J.live()) return null;
    const tc = { t: 0 };
    const r = await (async () => {
      const go = ride(J, id, D[0], D[1], { yaw: sd.yaw, tc });
      // (at speed from the first frame: the walk keeps the speed a body has)
      A.vc = V * 0.9;
      return go;
    })();
    if (!J.live()) return null;
    if (J.hurry || (!r.arrived && !r.stalled)) return settle(J, id, spot);
    // OFF, the scooter on its stand to the kerb side, and the last steps to the place
    const S = await getOff(J, id, r.stalled ? sideAt(A.x, A.z, [spot.x, spot.z]) ?? sd : sd, tc.t);
    if (!J.live()) return S.remove();
    park(S, id);
    if (J.hurry) return settle(J, id, spot);
    await kit.walk(J, id, spot.x, spot.z, { entry: null });
    if (!J.live()) return null;
    J.stop('arrived');
    return { at: [actors.get(id).x, actors.get(id).z] };
  }

  /** At once: standing at the place, nothing ridden. */
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

  return {
    leave, arrive,
    parked: () => [...parked.values()].map(S => ({ owner: S.owner, x: S.x, z: S.z })),
    clear() {
      for (const S of [...parked.values()]) S.remove();
    },
  };
}
