// THINGS THAT GO ABOUT WITH A PERSON (named-1): the one place where a named person's own thing that is neither worn nor in
// a hand is put beside them, every frame, wherever they are on the stage. The things are the city's: its pool of named
// people keeps them (world/named/index.js § PROPS: propsOf(name), each with the points a placer needs, in metres at its
// owner's size) and builds them as it builds any prop (world/named/props/build.js propBank: the bank a block stamps). The
// first is the cart man's cart; another person's thing is another file there, and nothing here changes for it.
//
//   const along = await createAlong({ city, CITY, actors })
//   along.attach(id)        the actor's own things (by the named person they are: actors.namedOf), built and baked now,
//                           before anything plays (the stage's begin): their push hold's look too, so no frame of a scene
//                           pays for it
//   along.pose(id, mode)    'push' | 'park' | null: held in that way (for stills and tools); null: as the frame decides
//   along.state()           for the tools: each thing, how it goes now, the frames it was in somebody, its worst lag
//
// HOW A THING GOES (the owner's ask for the cart: "wherever the cart man is in the game, his cart is with him: pushed ahead
// of him when he walks, parked beside him when he stands or is in a scene, never through him or anybody else, never left
// behind"):
//   · PUSHED while its owner walks a way of their own (not in a scene, not taken in hand): its handle in both fists (the
//     city's two-hand hold, `push.hands`; the look with that hold is the actor's own, baked at attach), its origin
//     `push.stand` ahead of their feet, turned with them;
//   · PARKED while they stand, or anything of a scene has them: at `park` from their feet (their left hand, +x), or the
//     same on their right when that is where nobody stands and nothing solid is, or a step behind them when neither is;
//   · between the two it is drawn sliding to the new place over a quarter of a second, never jumped;
//   · on the ground under it (actors.groundAt), drawn and shadowed as its owner is (hidden with them);
//   · the city's own crowd steps round it (two discs of it in the crowd's body map, sim.bodies, as our people are).
// The wheels do not turn (the owner accepted it). What is not done: our people's own walks are not routed round a cart
// (actors.addSolid would put its owner's own cart in his way); the audit (`state().inside`) counts every frame it is in
// anybody.
export async function createAlong({ city, CITY, actors }) {
  const THREE = city.THREE;
  const [N, BUILD, GPU, LOD] = await Promise.all([
    import(`${CITY}../../world/named/index.js`),
    import(`${CITY}../../world/named/props/build.js`),
    import(`${CITY}gpu.js`),
    import(`${CITY}lod.js`),
  ]);
  // the block materials' four layers, as the pool's own picture of a prop draws them (world/named/look.js PMAT)
  const MATS = [
    GPU.tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 })),
    GPU.tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.1 })),
    GPU.tierize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85 })),
    GPU.tierize(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
  ];
  /** How fast a thing slides to where it now goes (s, the time constant), and how far it may lag (m) before it is counted. */
  const EASE = 0.08;
  const LAG = 0.35;
  /** A body, for "never through anybody": its middle and this much of its size round it (m). */
  const BODY = 0.3;
  const on = new Map();
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  function objectOf(P) {
    const g = new THREE.Group();
    LOD.packFull(BUILD.propBank(P.key), [0, 0, 0]).forEach((t, li) => {
      if (t) g.add(GPU.meshOf(t, MATS[li] ?? MATS[0]));
    });
    g.name = `hk2:along:${P.key}`;
    g.visible = false;
    return g;
  }

  function attach(id) {
    if (on.has(id)) return on.get(id);
    const key = actors.namedOf?.(id);
    const props = key ? N.propsOf(key) : [];
    if (!props.length) return null;
    // (one thing a person for now: the pool has one, the cart)
    const P = props[0];
    const obj = objectOf(P);
    city.scene.add(obj);
    // (its materials' programs made now, off the frame, so its first frame on screen does not wait for them)
    try {
      obj.visible = true;
      city.renderer?.compileAsync?.(obj, city.camera, city.scene)?.catch?.(() => {});
    } finally {
      obj.visible = false;
    }
    // the push hold's look, baked now (actors.holding: the actor's own look with the city's hold and nothing in the hands)
    if (P.handle?.hold) actors.holding?.(id, P.handle.hold, false);
    const T = { id, P, obj, mode: null, forced: null, side: 1, x: 0, z: 0, yaw: 0, u: 0, v: 0, placed: false, pushFor: 0, standFor: 0, since: 0, inside: 0, insideBy: null, lag: 0, frames: 0 };
    on.set(id, T);
    return T;
  }

  /** Where the thing's origin goes for its owner in a way of going: [x, z, yaw] (the owner's feet and heading). */
  /** Where it goes in its owner's own frame ([u across, +x their left; v ahead]) for a way of going. */
  const localOf = (T, mode, side) => (mode === 'push' ? [0, -T.P.push.stand[2]] : mode === 'behind' ? [0, -(T.P.size[2] / 2 + 0.55)] : [side * T.P.park[0], T.P.park[2]]);
  /** A point of the owner's frame in the world: [x, z, yaw] (rig.js toWorld's turn). */
  function worldOf(A, [u, v]) {
    const yaw = A.w?.yawS ?? A.ry;
    const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
    return [A.x + u * c + v * s, A.z - u * s + v * c, yaw];
  }
  const spotOf = (T, A, mode, side) => worldOf(A, localOf(T, mode, side));
  /** The thing's footprint at [x, z, yaw] as four corners and its middle line, for the tests below. */
  function corners(T, [x, z, yaw]) {
    const { min, max } = T.P.bounds;
    const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
    return [[min[0], min[2]], [max[0], min[2]], [max[0], max[2]], [min[0], max[2]]].map(([u, v]) => [x + u * c + v * s, z - u * s + v * c]);
  }
  /** Is a point within r of the thing's footprint (an oriented box)? */
  function near(T, at, px, pz, r) {
    const [x, z, yaw] = at;
    const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
    const [dx, dz] = [px - x, pz - z];
    const u = dx * c - dz * s;
    const v = dx * s + dz * c;
    const { min, max } = T.P.bounds;
    const qu = Math.max(min[0] - u, 0, u - max[0]);
    const qv = Math.max(min[2] - v, 0, v - max[2]);
    return Math.hypot(qu, qv) < r;
  }
  /** Who of ours a thing at `at` would be in (its owner by their own feet), or something solid under it: a name, or null. */
  function inWay(T, A, at) {
    for (const B of actors.all()) {
      if (B.w?.hide || B.room) continue;
      const r = BODY * (B.size ?? 1) + (B === A ? -0.05 : 0);
      if (near(T, at, B.x, B.z, r)) return B.id;
    }
    for (const [px, pz] of [...corners(T, at), [at[0], at[1]]]) if (actors.solidAt?.(px, pz)) return 'something solid';
    return null;
  }

  function step(dt) {
    for (const T of on.values()) {
      const A = actors.has(T.id) ? actors.get(T.id) : null;
      if (!A) {
        T.obj.visible = false;
        continue;
      }
      const shown = !A.w.hide && !A.room;
      // THE WAY IT GOES: pushed on a walk of their own, parked otherwise (with a little hold either side, so a stop at a
      // corner is not a park and a push again)
      const walking = !!A.route && (A.vc ?? 0) > 0.25 && !A.tagged && !A.contact && A.mode === 'free';
      T.pushFor = walking ? T.pushFor + dt : 0;
      T.standFor = walking ? 0 : T.standFor + dt;
      let mode = T.forced ?? (T.mode === 'push' ? (T.standFor > 0.2 ? 'park' : 'push') : T.pushFor > 0.15 ? 'push' : 'park');
      // (parked: the side it was on while that is clear, else the other, else a step behind)
      let at = null;
      if (mode === 'park') {
        for (const side of [T.side, -T.side]) {
          const q = spotOf(T, A, 'park', side);
          if (!inWay(T, A, q)) {
            if (side !== T.side) T.since = 0;
            T.side = side;
            at = q;
            break;
          }
        }
        if (!at) {
          const q = spotOf(T, A, 'behind', 1);
          if (!inWay(T, A, q)) {
            mode = 'behind';
            at = q;
          } else at = spotOf(T, A, 'park', T.side);
        }
      } else at = spotOf(T, A, 'push', 1);
      if (mode !== T.mode) {
        // (his hands on the handle while he pushes it, at his sides again when it stands)
        actors.holding?.(T.id, mode === 'push' ? T.P.handle.hold : null, true);
        T.mode = mode;
        T.since = 0;
      }
      T.since += dt;
      // DRAWN IN ITS OWNER'S FRAME, so it goes where they go on the very frame (a step, a turn, a cut of the stage's
      // carries it with them: never left behind). Only a change of the way it goes is slid, never jumped, and round
      // them, never through them: out to the side first and then back, going to stand beside them; forward first and
      // then in, going to be pushed (at once only the first time, or after its owner was away)
      const want = localOf(T, mode, T.side);
      // (from behind them to ahead of them: round by their side, never through them)
      const round = mode === 'push' && T.v < 0.25 && Math.abs(T.u) < 0.6;
      if (round) want[0] = T.side * T.P.park[0];
      if (!T.placed || !T.obj.visible) [T.u, T.v] = localOf(T, mode, T.side);
      else {
        const fast = 1 - Math.exp(-dt / EASE);
        const slow = 1 - Math.exp(-dt / (EASE * 3));
        const [ku, kv] = round ? [fast, slow] : mode === 'push' || mode === 'behind' ? [slow, fast] : [fast, slow];
        T.u += (want[0] - T.u) * ku;
        T.v += (want[1] - T.v) * kv;
      }
      T.placed = true;
      [T.x, T.z, T.yaw] = worldOf(A, [T.u, T.v]);
      const y = actors.groundAt(T.x, T.z);
      T.obj.position.set(T.x, y, T.z);
      T.obj.rotation.set(0, T.yaw, 0);
      T.obj.visible = shown;
      if (!shown) continue;
      // the city's crowd steps round it (two discs along it, in the body map our people are published in)
      const sim = city.peds?.sim;
      if (sim?.bodies) {
        const [c, s] = [Math.cos(T.yaw), Math.sin(T.yaw)];
        for (const v of [-0.27, 0.27]) sim.bodies.push({ x: T.x + v * s, z: T.z + v * c, r: 0.45, w: A.w, room: 0 });
      }
      // THE AUDIT: a frame it is in anybody (its owner included), and how far it lags where it goes
      T.frames += 1;
      const who = inWay(T, A, [T.x, T.z, T.yaw]);
      if (who && who !== 'something solid') {
        T.inside += 1;
        T.insideBy = who;
      }
      // (a slide from one way of going to the other is not a lag: measured once it has had its half second)
      if (T.since > 0.5) T.lag = Math.max(T.lag, Math.hypot(at[0] - T.x, at[1] - T.z));
    }
  }
  actors.onFrame(dt => step(dt));

  return {
    attach,
    /** Every thing taken off the stage (a new season's cast). */
    clear() {
      for (const T of on.values()) {
        T.obj.removeFromParent();
        T.obj.traverse(n => n.geometry?.dispose());
      }
      on.clear();
    },
    pose(id, mode = null) {
      const T = on.get(id);
      if (T) T.forced = mode;
    },
    state: () => [...on.values()].map(T => ({ id: T.id, key: T.P.key, mode: T.mode, side: T.side, at: [+T.x.toFixed(2), +T.z.toFixed(2)], frames: T.frames, inside: T.inside, insideBy: T.insideBy, lag: +T.lag.toFixed(3), lagOver: T.lag > LAG })),
    reset() {
      for (const T of on.values()) Object.assign(T, { inside: 0, insideBy: null, lag: 0, frames: 0 });
    },
  };
}
