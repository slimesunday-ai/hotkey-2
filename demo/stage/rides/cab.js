// THE CAB: it pulls to the kerb, the person gets in, it drives off; it pulls up, they get out. What is the city's:
//   · the car: the fleet's Kubo Pixel Cab (vehicles/index.js 'taxi', its yellow body, checker band, roof sign and its
//     driver, vehicles/three.js vehicleMesh: wheels that roll by the distance driven, brake plates lit when it brakes),
//     in a material made the way the city's Cleaners make their van's (traffic/cleaners.js prepare);
//   · the lanes it drives in and the kerb it stops at: the traffic's own figures (traffic/sim.js lanesOf, ONEWAY_LANE,
//     KERB_IN; traffic/rules.js isOneWay, oneWayDir; plan.js segX / segZ / hwX / hwZ), so it drives the one-ways their
//     own way and the avenues on the right, and stops in the kerb lane where the parked cars stand
//     (main.js parkedIn: the blocks' own parked cars), or double-parked in its lane when that is taken;
//   · the person: hail_taxi at the kerb while it comes (its step to the kerb is the clip's shift), car_get_in at the
//     door on the kerb side and then out of the picture (the cab is drawn: simstate/movement.js does exactly this, door
//     point and all: beside the body, 0.45 m out, 0.3 m behind its middle), car_get_out "snapped in" low in the door.
//   · its brakes and pace: the city's taxi car (world.json modes.taxi.drive.car: bStop 3.4 m/s², a 2.2 m/s²).
// OURS: the drive itself. The game's page runs no traffic (cars=0), so the cab is not a car of the city's traffic sim:
// it is driven here, kinematically, along its lane: in at its speed, braking to rest at the kerb, then away.

const CAR = { len: 4.4, wid: 1.8, v: 10, vIn: 8, a: 2.2, b: 3.4, kerbIn: 0.88, swing: 11 };
/** Metres up the road a cab comes in from on a departure (the first that the camera cannot see), and on an arrival (at the cut). */
const FROM = { leave: [18, 22, 26, 34, 42, 52, 64], arrive: 17 };
/** Seconds of hailing before the cab is at the kerb, when the person gets there first. */
const HAIL = 1.4;
/** Metres of free kerb behind a stop, at least, for the cab to swing in over (a gap between parked cars). */
const BACK = 3.5;
/** Metres of a walk to or from a cab that may be on a roadway (its crossings). */
const ROAD_M = 9;

export function createCab({ city, actors, kit, CLIPS, V3, GP, PLAN, RULES, TSIM }) {
  const THREE = city.THREE;
  const P = 36;
  const night = /night/.test(new URLSearchParams(location.search).get('tod') ?? '');
  const mat = GP.tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 }), { vmat: true });
  let serial = 0;
  const cabs = new Set();

  function makeCar() {
    const car = V3.vehicleMesh('taxi', { variant: serial % 9, lights: night, driver: true, night }, mat);
    const root = new THREE.Group();
    const bb = new THREE.Box3().setFromObject(car);
    car.position.set(-(bb.min.x + bb.max.x) / 2, 0, -(bb.min.z + bb.max.z) / 2);
    root.add(car);
    root.name = `hk2:rides:cab${++serial}`;
    root.visible = false;
    city.scene.add(root);
    const C = { root, car, id: serial, x: 0, z: 0, h: 0, v: 0, wid: CAR.wid };
    C.put = (x, z, h) => {
      Object.assign(C, { x, z, h });
      root.position.set(x, 0, z);
      root.rotation.y = h;
    };
    C.remove = () => {
      root.removeFromParent();
      cabs.delete(C);
    };
    cabs.add(C);
    return C;
  }

  /**
   * THE KERB a cab stops at for someone at (x, z): the nearest street's kerb on their side, its lanes and the way
   * they run. → { axis, d (the way it drives, ±1 along the axis), along (where on the street), lat(kind) }
   */
  function streetAt(x, z) {
    const Lx = Math.round(x / P);
    const Lz = Math.round(z / P);
    const opts = [];
    if (PLAN.segX(Lx, Math.floor(z / P))) opts.push({ axis: 'x', L: Lx, c: Lx * P, gap: Math.abs(x - Lx * P) - PLAN.hwX(Lx), side: Math.sign(x - Lx * P) || 1, along: z, hw: PLAN.hwX(Lx) });
    if (PLAN.segZ(Lz, Math.floor(x / P))) opts.push({ axis: 'z', L: Lz, c: Lz * P, gap: Math.abs(z - Lz * P) - PLAN.hwZ(Lz), side: Math.sign(z - Lz * P) || 1, along: x, hw: PLAN.hwZ(Lz) });
    if (!opts.length) return null;
    opts.sort((a, b) => a.gap - b.gap);
    const S = opts[0];
    const oneWay = RULES.isOneWay(S.axis, S.L);
    // (the right of travel: for a road along z driven +z it is −x; along x driven +x it is +z)
    const rightOf = d => (S.axis === 'x' ? -d : d);
    S.d = oneWay ? RULES.oneWayDir(S.axis, S.L) : S.axis === 'x' ? -S.side : S.side;
    // lateral offsets from the centre line (world: +x or +z): the travel lane, and the kerb lane on the person's side
    const travel = rightOf(S.d) * (oneWay ? TSIM.ONEWAY_LANE : TSIM.lanesOf(S.axis, S.L)[0]);
    const kerb = S.side * (S.hw - TSIM.KERB_IN);
    S.lat = { travel, kerb };
    S.pt = (a, l) => (S.axis === 'x' ? [S.c + l, a] : [a, S.c + l]);
    S.heading = S.axis === 'x' ? (S.d > 0 ? 0 : Math.PI) : S.d > 0 ? Math.PI / 2 : -Math.PI / 2;
    return S;
  }
  /** Is the road there along the street from `a0` to `a1` (no gap where the street ends)? */
  function roadFrom(S, a0, a1, lat) {
    const n = Math.ceil(Math.abs(a1 - a0) / 2);
    for (let k = 0; k <= n; k++) {
      const [x, z] = S.pt(a0 + ((a1 - a0) * k) / Math.max(1, n), lat);
      if (PLAN.kerbOut(x, z) > 0.01) return false;
    }
    return true;
  }
  /** Where in the street the stop is: by the person, never in a junction, the kerb lane where no car is parked. */
  function stopFor(id, x, z) {
    // (where no stop can be walked to on the sidewalks, the nearest that can be walked to at all)
    return stopAt(id, x, z, true) ?? stopAt(id, x, z, false);
  }
  function stopAt(id, x, z, strict) {
    const S = streetAt(x, z);
    if (!S) return null;
    const a0 = S.along;
    // (the kerb lane anywhere within 24 m first, the nearest first; only then double-parked in the travel lane, where
    // the door it lets people out of is not against a parked car)
    const shifts = [0, 3, -3, 6, -6, 9, -9, 12, -12, 15, -15, 18, -18, 21, -21, 24, -24];
    for (const [shift, only] of [...shifts.map(k => [k, 'kerb']), ...shifts.slice(0, 9).map(k => [k, 'travel'])]) {
      const a = a0 + shift * S.d;
      // (the whole body on a straight run of the street: a junction box is 4 m and more round each crossing)
      const cross = Math.round(a / P) * P;
      if (Math.abs(a - cross) < (S.axis === 'x' ? PLAN.hwZ(Math.round(a / P)) : PLAN.hwX(Math.round(a / P))) + CAR.len / 2 + 2.6) continue;
      for (const lane of [only]) {
        const lat = S.lat[lane];
        const [cx, cz] = S.pt(a, lat);
        const [hx, hz] = S.axis === 'x' ? [CAR.wid / 2, CAR.len / 2] : [CAR.len / 2, CAR.wid / 2];
        // (the kerb lane free of parked cars where it stands and a body past it, and behind it for at least BACK m to
        // swing in over: the swing is as long as the gap behind it allows, CAR.swing at most)
        let swing = CAR.swing;
        let swingOut = CAR.swing;
        if (lane === 'kerb') {
          const parkedOn = (s0, s1) => {
            const [x0, z0] = S.pt(a + s0 * S.d, lat);
            const [x1, z1] = S.pt(a + s1 * S.d, lat);
            return city.parkedIn?.(Math.min(x0, x1) - (S.axis === 'x' ? hx : 0) - 0.1, Math.min(z0, z1) - (S.axis === 'z' ? hz : 0) - 0.1, Math.max(x0, x1) + (S.axis === 'x' ? hx : 0) + 0.1, Math.max(z0, z1) + (S.axis === 'z' ? hz : 0) + 0.1);
          };
          if (parkedOn(-CAR.len / 2 - BACK, CAR.len / 2 + 1)) continue;
          let back = BACK;
          while (back < CAR.swing && !parkedOn(-CAR.len / 2 - back - 0.5, -CAR.len / 2 - back)) back += 0.5;
          swing = Math.max(BACK + 1.5, Math.min(CAR.swing, back + 1.5));
          let ahead = 1;
          while (ahead < CAR.swing && !parkedOn(CAR.len / 2 + ahead, CAR.len / 2 + ahead + 0.5)) ahead += 0.5;
          swingOut = Math.max(3, Math.min(CAR.swing, ahead + 1));
        }
        if (!roadFrom(S, a - (CAR.len / 2) * S.d, a + (CAR.len / 2) * S.d, lat)) continue;
        if ([...cabs].some(C => C.stop && Math.hypot(C.stop[0] - cx, C.stop[1] - cz) < CAR.len + 1.5)) continue;
        const T = { S, a, lane, lat, c: [cx, cz], swing, swingOut };
        // (the door lets out onto ground a body can stand on: no post, bin or planter there, nor where the hail is)
        const D = doorOf(T);
        if (lane === 'travel' && city.parkedIn?.(D.x - 0.4, D.z - 0.4, D.x + 0.4, D.z + 0.4)) continue;
        // (and onto a sidewalk: where the door and the place to hail from are, there is one, a body's width in)
        if ([0, 0.3, 0.6].some(k => actors.solidAt(D.x + D.rx * k, D.z + D.rz * k))) continue;
        if (lane === 'kerb' && !(PLAN.kerbOut(D.x, D.z) >= 0.3 && PLAN.kerbOut(D.x + D.rx * 0.6, D.z + D.rz * 0.6) >= 0.7 && PLAN.kerbOut(D.x + D.rx * 2, D.z + D.rz * 2) >= 1.6)) continue;
        // (NOBODY WALKS DOWN THE ROAD to it: the walk between the person and the door keeps to the sidewalks, the
        // crossings apart: at most ROAD_M of it on a roadway)
        if (strict && !onFoot(x, z, D.x, D.z)) continue;
        return T;
      }
    }
    return null;
  }
  /** Is the walk between two points on the sidewalks (no more than ROAD_M of it on a roadway: a crossing or two)? */
  function onFoot(ax, az, bx, bz) {
    const R = actors.routeOf(ax, az, bx, bz, { step: 0.5 });
    if (!R) return Math.hypot(bx - ax, bz - az) < 3;
    return R.points.filter(p => actors.onRoad(p[0], p[2])).length * 0.5 <= ROAD_M;
  }
  /** The door on the kerb side of a cab standing at the stop, and the side's unit vector (toward the kerb). */
  function doorOf(T) {
    const { S } = T;
    const [fx, fz] = [Math.sin(S.heading), Math.cos(S.heading)];
    const [rx, rz] = S.axis === 'x' ? [S.side, 0] : [0, S.side];
    const [cx, cz] = T.c;
    return { x: cx + rx * (CAR.wid / 2 + 0.45) - fx * 0.3, z: cz + rz * (CAR.wid / 2 + 0.45) - fz * 0.3, rx, rz, fx, fz };
  }

  /**
   * A cab's drive along its street: `in` from `from` m back to rest at the stop; `out` from rest on and away. Lateral:
   * the travel lane, eased over CAR.swing m into the stop's lane (and back out). Calls back each frame; resolves at
   * the end (in: at rest; out: `far` m on, or out of the picture past `gone` m).
   */
  function drive(J, C, T, phase, { from = 30, v0 = CAR.v, far = 90, gone = 24 } = {}) {
    const { S, a, lat } = T;
    const L0 = S.lat.travel;
    let s = phase === 'in' ? -from : 0;
    C.v = phase === 'in' ? v0 : 0;
    const SW = T.swing ?? CAR.swing;
    const SO = T.swingOut ?? CAR.swing;
    const latAt = s1 => (phase === 'in' ? kit.lerp(L0, lat, kit.ease(Math.min(1, Math.max(0, (s1 + SW) / SW)))) : kit.lerp(lat, L0, kit.ease(Math.min(1, Math.max(0, s1 / SO)))));
    const place = () => {
      const [x, z] = S.pt(a + s * S.d, latAt(s));
      const [x2, z2] = S.pt(a + (s + 0.6) * S.d, latAt(s + 0.6));
      C.put(x, z, Math.atan2(x2 - x, z2 - z));
    };
    place();
    C.root.visible = true;
    return new Promise(resolve => {
      kit.every(dt => {
        if (!J.live() && phase === 'in') {
          resolve(false);
          return true;
        }
        let ds;
        if (phase === 'in') {
          const left = -s;
          const want = Math.min(v0, Math.sqrt(2 * CAR.b * Math.max(0, left)));
          C.v = want;
          ds = Math.min(left, C.v * dt);
          C.car.userData.setBrake?.(want < v0 - 0.2);
        } else {
          C.v = Math.min(CAR.v, C.v + CAR.a * dt);
          ds = C.v * dt;
          C.car.userData.setBrake?.(false);
        }
        s += ds;
        C.car.userData.roll?.(ds);
        place();
        if (phase === 'in' && -s < 0.01) {
          C.v = 0;
          C.car.userData.setBrake?.(true);
          resolve(true);
          return true;
        }
        if (phase === 'out') {
          const [x, z] = S.pt(a + (s + 3) * S.d, L0);
          const off = PLAN.kerbOut(x, z) > 0.01;
          if (s > far || off || (s > gone && !kit.inView(C.x, 1, C.z, 3))) {
            C.remove();
            resolve(true);
            return true;
          }
        }
        return false;
      });
    });
  }
  /** How far up its street a cab can come from: the farthest of `list` with road all the way, the first unseen. */
  function approach(T, list) {
    const { S, a } = T;
    let best = null;
    for (const m of list) {
      if (!roadFrom(S, a - m * S.d, a, S.lat.travel)) break;
      best = m;
      const [x, z] = S.pt(a - m * S.d, S.lat.travel);
      if (!kit.inView(x, 1, z, 3)) break;
    }
    return best ?? 12;
  }

  /**
   * THE STOP NEXT TO SOMEONE (the short scene: the cab comes to the person, nobody hunts for a kerb): on the nearest
   * street, the kerb lane where it is free right there (within a few metres either way); else in its own lane beside
   * the parked cars, at a gap between them the person can step through to the door. Null when neither is there.
   */
  function stopNear(x, z) {
    const S = streetAt(x, z);
    if (!S) return null;
    const [hx, hz] = S.axis === 'x' ? [CAR.wid / 2, CAR.len / 2] : [CAR.len / 2, CAR.wid / 2];
    const boxOn = (a, s0, s1, lat, pad = 0.1) => {
      const [x0, z0] = S.pt(a + s0 * S.d, lat);
      const [x1, z1] = S.pt(a + s1 * S.d, lat);
      return city.parkedIn?.(Math.min(x0, x1) - (S.axis === 'x' ? hx : 0) - pad, Math.min(z0, z1) - (S.axis === 'z' ? hz : 0) - pad, Math.max(x0, x1) + (S.axis === 'x' ? hx : 0) + pad, Math.max(z0, z1) + (S.axis === 'z' ? hz : 0) + pad);
    };
    for (const shift of [0, 1.5, -1.5, 3, -3, 4.5, -4.5, 6, -6, 7.5, -7.5]) {
      const a = S.along + shift * S.d;
      const cross = Math.round(a / P) * P;
      if (Math.abs(a - cross) < (S.axis === 'x' ? PLAN.hwZ(Math.round(a / P)) : PLAN.hwX(Math.round(a / P))) + CAR.len / 2 + 2.6) continue;
      if ([...cabs].some(C => C.stop && Math.hypot(C.stop[0] - S.pt(a, S.lat.kerb)[0], C.stop[1] - S.pt(a, S.lat.kerb)[1]) < CAR.len + 1.5)) continue;
      for (const lane of ['kerb', 'travel']) {
        const lat = S.lat[lane];
        if (!roadFrom(S, a - (CAR.len / 2) * S.d, a + (CAR.len / 2) * S.d, lat)) continue;
        let swing = CAR.swing;
        let swingOut = CAR.swing;
        if (lane === 'kerb') {
          if (boxOn(a, -CAR.len / 2 - BACK, CAR.len / 2 + 1, lat)) continue;
          let back = BACK;
          while (back < CAR.swing && !boxOn(a, -CAR.len / 2 - back - 0.5, -CAR.len / 2 - back, lat)) back += 0.5;
          swing = Math.max(BACK + 1.5, Math.min(CAR.swing, back + 1.5));
          let ahead = 1;
          while (ahead < CAR.swing && !boxOn(a, CAR.len / 2 + ahead, CAR.len / 2 + ahead + 0.5, lat)) ahead += 0.5;
          swingOut = Math.max(3, Math.min(CAR.swing, ahead + 1));
        }
        const T = { S, a, lane, lat, c: S.pt(a, lat), swing, swingOut };
        const D = doorOf(T);
        // (the way from the sidewalk to the door, a body wide: no parked car, nothing solid; it starts on a sidewalk)
        // (from the car's side to the person's kerb: its lane may be the near half of the road or the far one)
        const kerbAt = S.hw - lat * S.side - CAR.wid / 2;
        let ok = !actors.solidAt(D.x, D.z);
        for (let k = 0.3; ok && k <= Math.max(0.6, kerbAt) + 0.8; k += 0.3) {
          const [px, pz] = [D.x + D.rx * k, D.z + D.rz * k];
          if (city.parkedIn?.(px - 0.35, pz - 0.35, px + 0.35, pz + 0.35) || actors.solidAt(px, pz)) ok = false;
        }
        const [sx, sz] = [D.x + D.rx * (Math.max(0, kerbAt) + 0.8), D.z + D.rz * (Math.max(0, kerbAt) + 0.8)];
        if (!ok || !(PLAN.kerbOut(sx, sz) >= 0.5)) continue;
        T.kerb = [sx, sz];
        return T;
      }
    }
    return null;
  }

  /** The cab standing still at its stop (brake plates lit), for an arrival that starts with it there. */
  function standAt(C, T) {
    const [x, z] = T.c;
    C.put(x, z, T.S.heading);
    C.v = 0;
    C.root.visible = true;
    C.car.userData.setBrake?.(true);
  }

  // ── the departure ───────────────────────────────────────────────────────────────────────────────────────────────
  // TWO SCENES (README "the cab"): `followed` (the camera cuts with this person): the cab comes to them and the cut is as
  // it comes to rest, the getting in and away played on behind the cut; otherwise (a camera that stays at the place) the
  // whole of it in view: the cab drives in, the person gets in, it drives off out of the picture.
  async function leave(J, id, o) {
    const A = actors.get(id);
    const T = stopNear(A.x, A.z) ?? stopFor(id, A.x, A.z);
    if (!T) return o.scooter(J, id, o);
    const C = makeCar();
    C.stop = T.c;
    J.onEnd(why => {
      if (why !== 'gone') C.remove();
    });
    const D = doorOf(T);
    // the person waits on the sidewalk by where the door will be (a kerb-lane stop: a step back, hail_taxi steps them on
    // to it, its shift; a stop in its lane: at the kerb, in line with the gap they step through)
    const hail = CLIPS.CLIP.hail_taxi;
    const sh = hail?.shift?.[1] ?? 0.3;
    const W = T.lane === 'kerb' || !T.kerb ? [D.x + D.rx * sh, D.z + D.rz * sh] : T.kerb;
    kit.claim(id, 'cab', W[0], W[1], 1);
    if (J.hurry) return gone(J, id, C);
    const faceRoad = Math.atan2(-D.rx, -D.rz);
    // the cab sets off at once, from up the street where the camera cannot see it (or as far as the street goes)
    const comes = drive(J, C, T, 'in', { from: approach(T, FROM.leave) });
    const tWalk = actors.clock;
    const walking = kit.walk(J, id, W[0], W[1], { yaw: faceRoad });
    let hailing = false;
    const hailWhenThere = walking.then(async () => {
      if (!J.live()) return;
      await actors.turned([id], 0.6);
      // a hand up for it while it comes (not when it is all but there)
      if (C.v > 1 && hail && J.live() && !J.hurry) {
        hailing = true;
        actors.play(id, 'hail_taxi');
      }
    });
    // (the hail's arm comes down in the cab's last second)
    kit.every(() => {
      if (!J.live() || C.v < 3) {
        if (hailing && J.live()) actors.stop(id);
        return true;
      }
      return false;
    });
    await Promise.race([comes, J.until(() => false).then(() => false)]);
    if (!J.live()) return null;
    if (J.hurry) return gone(J, id, C);
    const rest = actors.clock - J.t0;
    // IN and AWAY: the rest of the scene (behind the cut when followed)
    const boarding = (async () => {
      await walking;
      await hailWhenThere;
      if (!J.live()) return;
      // (the arm comes down as the cab stops: the step to the door starts from the blend, as any walk of ours)
      if (hailing) actors.stop(id);
      // (to the door: the short straight step, through the gap when the cab stands in its lane)
      if (Math.hypot(A.x - D.x, A.z - D.z) > 0.12) await actors.stepTo(id, D.x, D.z, { yaw: faceRoad, exact: T.lane === 'travel' });
      actors.turn(id, faceRoad);
      await actors.turned([id], 0.6);
      if (!J.live()) return;
      await actors.play(id, 'car_get_in', { hold: (CLIPS.CLIP.car_get_in?.dur ?? 1.3) + 0.05 });
      if (!J.live()) return;
      actors.cutClip(id);
      actors.show(id, false);
      await J.wait(0.2);
      if (!J.live()) return;
      C.leaving = true;
      return drive(J, C, T, 'out').then(() => J.stop('gone'));
    })();
    if (o.followed) {
      // THE CUT: the cab at rest by them, a beat after
      await J.wait(0.3);
      return { cut: actors.clock - J.t0, rest: +rest.toFixed(2), walk: +(actors.clock - tWalk).toFixed(2), followed: true };
    }
    // watched from the place: the cut once the cab has driven out of the picture, or 1.1 s after it pulled away
    await J.until(() => C.leaving);
    const tOff = actors.clock;
    await J.until(() => !C.root.parent || !kit.inView(C.x, 1, C.z, 2.5) || actors.clock - tOff > 1.1);
    void boarding;
    return { cut: actors.clock - J.t0, rest: +rest.toFixed(2) };
  }

  function gone(J, id, C) {
    // (a scene that has been replaced, the person's next one playing, leaves them alone)
    if (!J.live()) return { cut: actors.clock - J.t0, stale: true };
    if (actors.has(id)) {
      actors.cutClip(id);
      actors.show(id, false);
    }
    C?.remove();
    J.stop('gone');
    return { cut: actors.clock - J.t0 };
  }

  // ── the arrival ─────────────────────────────────────────────────────────────────────────────────────────────────
  async function arrive(J, id, o) {
    const [ax, az] = o.at;
    const spot = actors.fitSpot(ax, az);
    const T = stopNear(spot.x, spot.z) ?? stopFor(id, spot.x, spot.z);
    if (!T) return o.scooter(J, id, o);
    const D = doorOf(T);
    kit.claim(id, 'cab', D.x, D.z, 1);
    if (J.hurry) return settle(J, id, spot, null);
    const C = makeCar();
    C.stop = T.c;
    // (its end: arrived, it drives on if it has not yet; cut short, it is gone with the scene)
    const away = () => {
      if (C.leaving || !C.root.parent) return;
      C.leaving = true;
      drive({ live: () => true }, C, T, 'out');
    };
    J.onEnd(why => (why === 'arrived' ? away() : C.leaving || C.remove()));
    const outYaw = Math.atan2(D.rx, D.rz);
    if (o.followed) {
      // FOLLOWED (it starts at the cut): the cab already standing at the kerb, the person beside it on the sidewalk; it
      // drives off while they walk to their place
      standAt(C, T);
      // (beside it on the sidewalk: by its back door, or as far forward as its front one when that is nearer their place)
      const back = T.lane === 'travel' && T.kerb ? T.kerb : [D.x, D.z];
      const front = [back[0] + D.fx * 1.4, back[1] + D.fz * 1.4];
      const near = (p, q) => Math.hypot(p[0] - spot.x, p[1] - spot.z) < Math.hypot(q[0] - spot.x, q[1] - spot.z);
      const at = near(front, back) && !actors.solidAt(front[0], front[1]) && !city.parkedIn?.(front[0] - 0.3, front[1] - 0.3, front[0] + 0.3, front[1] + 0.3) ? front : back;
      actors.place(id, at[0], at[1], outYaw);
      actors.cutClip(id);
      actors.show(id, true);
      J.wait(0.4).then(() => J.live() && away());
      if (J.hurry) return settle(J, id, spot, null);
      await kit.walk(J, id, spot.x, spot.z);
      if (!J.live()) return null;
      J.stop('arrived');
      return { at: [actors.get(id).x, actors.get(id).z], followed: true };
    }
    actors.show(id, false);
    // WATCHED: it drives in from up the street where the camera cannot see it
    const ok = await drive(J, C, T, 'in', { from: approach(T, FROM.leave) });
    if (!J.live() || !ok) return null;
    if (J.hurry) return settle(J, id, spot, C);
    await J.wait(0.25);
    // OUT: low in the door, facing away from the cab (car_get_out snapped in), up and out by the clip's own step; by
    // the back door, or as far forward as the front one when that is nearer their place and the way out of it is clear
    const gout = CLIPS.CLIP.car_get_out;
    const sh = gout?.shift?.[1] ?? 0.6;
    const fwd = 1.4;
    const fd = [D.x + D.fx * fwd, D.z + D.fz * fwd];
    const useFront = Math.hypot(fd[0] - spot.x, fd[1] - spot.z) < Math.hypot(D.x - spot.x, D.z - spot.z) && !actors.solidAt(fd[0], fd[1]) && !city.parkedIn?.(fd[0] - 0.35, fd[1] - 0.35, fd[0] + 0.35, fd[1] + 0.35);
    const [ox, oz] = useFront ? fd : [D.x, D.z];
    await kit.appear(id, ox - D.rx * sh, oz - D.rz * sh, outYaw, 'car_get_out', { loop: false });
    await actors.until(() => !J.live() || J.hurry || actors.clipOf(id).want !== 'car_get_out');
    if (!J.live()) return null;
    // the cab stands a moment (the city's CAB.outStand) and drives on
    J.wait(0.8).then(() => J.live() && away());
    if (J.hurry) return settle(J, id, spot, null);
    await kit.walk(J, id, spot.x, spot.z);
    if (!J.live()) return null;
    J.stop('arrived');
    return { at: [actors.get(id).x, actors.get(id).z] };
  }

  function settle(J, id, spot, C) {
    // (a scene that has been replaced, the person's next one playing, leaves them alone)
    if (!J.live()) return { cut: actors.clock - J.t0, stale: true };
    C?.remove();
    if (actors.has(id)) {
      actors.cutClip(id);
      actors.place(id, spot.x, spot.z, actors.get(id).ry);
      actors.show(id, true);
    }
    J.stop('settled');
    return { at: [spot.x, spot.z], settled: true };
  }

  return { leave, arrive, streetAt, stopFor, stopNear, cabs: () => [...cabs].map(C => ({ x: C.x, z: C.z, v: C.v })), clear: () => [...cabs].forEach(C => C.remove()) };
}
