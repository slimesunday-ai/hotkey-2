// The pads: one home of the city per seat (demo/stage/citymap.js PADS: ten trailers of Sunny Acres). Their rooms are
// the city's own (interiors/city/: a preset layout per home by its tier, built in 15 ms), opened with the city's own
// cutaway, which is ONE cut for the whole page: so one pad is open at a time, the one asked for last.
//
// The city opens a home by cutting its roof, its front and its inside away and standing the room there, and draws
// its own figure in the room. One thing differs here: the set's camera is above, so the room is built without a
// ceiling. The people inside are the stage's walkers, which the city's cut would cut away with the building: their
// materials are spared the cut (spare(), below).
//
// THE PLAYER'S OWN PAD IS NOT OPENED HERE ANY MORE: its inside is a view of its own (set/crib.js, demo/stage/inside.js),
// built away from the city by a second homes runtime, and the trailer stays whole. What opens here is a pad a scene
// is staged at (a break-in) or a watched agent's, from the street as before.
import { createCribs } from './crib.js';
import { createStarter } from './starter.js';

const CITY = new URL('../../../city/from-trunk/style/city/', import.meta.url).href;

export async function createPads(city, PADS) {
  const [HOMES, ASSIGN, FILL, FRAME, PLAN, GPU] = await Promise.all([
    import(`${CITY}interiors/city/index.js`), import(`${CITY}interiors/city/assign.js`), import(`${CITY}interiors/city/fill.js`),
    import(`${CITY}interiors/city/frame.js`), import(`${CITY}interiors/city/plan.js`), import(`${CITY}gpu.js`),
  ]);
  // the layouts of the tiers a pad can be (a trailer, a walk-up flat), read once: the homes runtime asks for a
  // room's layout without waiting
  const layouts = new Map();
  await Promise.all([...ASSIGN.LAYOUTS.trailer, ...ASSIGN.LAYOUTS.apartment].map(async name => {
    layouts.set(name, await fetch(`${CITY}interiors/home/assemblies/${name}.json`).then(r => r.json()));
  }));
  const homeOf = new Map(Object.entries(PADS).map(([seat, pad]) => [`pad:${seat}`, pad.home]));
  const seats = new Set(homeOf.values());
  const roomOf = h => {
    if (!seats.has(h.id)) return null;
    const tier = h.tier === 'trailer' ? 'trailer' : 'apartment';
    const wealth = tier === 'trailer' ? 0.1 : 0.3;
    const name = ASSIGN.layoutFor(h.id, tier);
    const A = layouts.get(name);
    if (!A) return null;
    const seed = FRAME.homeSeed(h.id);
    const fills = FILL.fillsFor(A, { tier, wealth, sec: new Set(), seed, show: false });
    return { name, A, fills, owner: h.id, wealth, key: name };
  };
  const NIGHT = new URLSearchParams(location.search).get('tod') === 'night';
  const homes = HOMES.createHomes(city, { Q: new URLSearchParams(), NIGHT, record: { roomOf } });
  const entry = key => {
    const id = homeOf.get(key);
    return id ? homes.index().get(id) ?? null : null;
  };

  // THE STAGE'S PEOPLE ARE NOT CUT AWAY WITH THE BUILDING. The city's cut discards the fragments of EVERY tier
  // material in the open home's boxes, and the stage's people are the city's walkers (its three batches, peds.js:
  // near, mid, far), so with the cut as the city makes it they went with the trailer. The first answer here was to
  // switch the storey's cut off and keep only what is over their heads: that left the trailer's own shell, awning
  // and porch standing THROUGH the room (the owner, 2026-11-13: "what's up with the trailer, it looks awful ... why
  // is there wood outside the trailer"). Now the walkers' materials read a cut of their own that is never on (chained
  // onto the city's own onBeforeCompile, never a change to the pinned files), and the cut is the city's, whole: the
  // trailer goes and the room stands alone, as the city's own view of a home shows it.
  const NOCUT = { value: new Float32Array(16) };
  let spared = false;
  function spare() {
    if (spared || !city.peds?.ready) return;
    spared = true;
    const A = city.peds.anim;
    for (const mesh of [A.batch, A.mid, A.far]) {
      const mat = mesh?.material;
      if (!mat || mat._hk2nocut) continue;
      mat._hk2nocut = true;
      const prev = mat.onBeforeCompile;
      const key = mat.customProgramCacheKey;
      mat.onBeforeCompile = (sh, r) => {
        prev?.call(mat, sh, r);
        if (sh.uniforms?.uCut) sh.uniforms.uCut = NOCUT;
      };
      mat.customProgramCacheKey = () => (key ? key.call(mat) : mat.type) + '|hk2nocut';
      mat.needsUpdate = true;
    }
  }

  // ── THE WAY IN, THE CITY'S OWN (interiors/city/plan.js homePlan, built for the record viewer at the owner's ask:
  // "if the agent goes into a house, we should watch them enter the house, then be inside the house with the agent").
  // From the pad's lot anchor (its door on the stoop and the way the house faces) and the room's layout: the room's
  // frame in the lot exactly as the homes runtime builds it, its walking grid round the furniture, the way in (the
  // stoop, the doorway, the first free node inside), ACT (the clear patch of floor nearest the room's middle) and the
  // bed. Read once a pad's block is built; nothing is copied, the city's functions are called.
  const lotOf = id => {
    for (const [, a] of city.ANCHORS ?? []) if (a?.lots?.[id]) return a.lots[id];
    return null;
  };
  const plans = new Map();
  /** A room point [x, z] → the world [x, y, z] at the room's floor. */
  function planOf(key) {
    if (plans.has(key)) return plans.get(key);
    const h = entry(key);
    const l = h ? lotOf(h.id) : null;
    const r = h ? roomOf(h) : null;
    if (!h || !l || !r) return null;
    let P = null;
    try {
      P = PLAN.homePlan(h, r.A, { door: l.door, face: l.face });
    } catch (err) {
      console.warn('[set] no way into', key, err);
    }
    if (!P?.act || !P.door) {
      plans.set(key, null);
      return null;
    }
    const D = P.door;
    const [fx, fz] = D.face;
    const fl = Math.hypot(fx, fz) || 1;
    // (the tenant's own step: off the stoop, out on the lot's ground, the way the house faces)
    const step = [D.stoop[0] + (fx / fl) * 1.15, D.stoop[1] + (fz / fl) * 1.15];
    // (the bed, as plan.js spotPose lays a sleeper on it: the feet BED_IN along the bed from its foot spot)
    const bed = (() => {
      const sp = P.byAct.get('sleep')?.find(q => q.bed);
      if (!sp) return null;
      const b = sp.bed.yaw;
      const [bx, bz] = [Math.sin(b), Math.cos(b)];
      const cl = (v, hi) => Math.max(0.2, Math.min(hi - 0.2, v));
      const at = [cl(sp.bed.x + bx * PLAN.BED_IN[0] + bz * PLAN.BED_IN[1], P.F.W), cl(sp.bed.z + bz * PLAN.BED_IN[0] - bx * PLAN.BED_IN[1], P.F.D)];
      return { stand: sp.stand, node: sp.node, at: P.w3(at[0], at[1], P.yF + sp.bed.y - 0.12), yaw: P.F.th + b, clip: PLAN.CLIPS.lie };
    })();
    const way = (a, b) => (P.way(a, b) ?? [a, b]).map(([x, z]) => P.w3(x, z));
    const plan = {
      key, P, step, bed, floorY: P.yF,
      // where the tenant stands at home: the clear floor, facing the room's front
      act: [P.act.world[0], P.yF, P.act.world[2], P.F.th],
      // the doorway's middle (world [x, z]) and the door's swing: DOOR.r metres round it, eased over DOOR.ease
      sill: D.sill, face: [fx / fl, fz / fl], DOOR: PLAN.DOOR,
      /** In: the step → the stoop → the doorway → the first free node inside → across the room to ACT (world [x, y, z]). */
      wayIn() {
        const doorIn = [[step[0], null, step[1]], [D.stoop[0], D.y ?? P.yF, D.stoop[1]], P.w3(...P.F.toRoom(...D.sill)), P.w3(...D.inside)];
        return [...doorIn, ...way(D.inN >= 0 ? D.inN : D.inside, P.act.node).slice(1)];
      },
      /** Out: from where they stand in the room, across it to the first node inside, the doorway, the stoop, the step. */
      wayOut(x, z) {
        const r = P.F.toRoom(x, z);
        return [...way(r, D.inN >= 0 ? D.inN : D.inside), P.w3(...P.F.toRoom(...D.sill)), [D.stoop[0], D.y ?? P.yF, D.stoop[1]], [step[0], null, step[1]]];
      },
      /** To the bed's foot and onto it: across the room from where they stand (world [x, y, z]); then lie at bed.at. */
      wayToBed(x, z) {
        return bed ? way(P.F.toRoom(x, z), bed.node) : null;
      },
    };
    plans.set(key, plan);
    return plan;
  }

  // ── THE DOOR: a leaf on the house's front door that swings in as the tenant comes to it and shuts behind them, as
  // the record viewer's homes have it (interiors/city/record.js doorOf: the same leaf and hinge, at the plan's own
  // doorway, facing its way). From the street the doorway behind an open leaf is dark; with the room open, the leaf
  // is seen swinging in the room's open front
  const T = city.THREE;
  const doors = new Map();
  const leafG = T ? new T.BoxGeometry(1.1, 2.3, 0.07) : null;
  const holeG = T ? new T.PlaneGeometry(1.15, 2.35) : null;
  const leafM = T ? new T.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.7 }) : null;
  const holeM = T ? new T.MeshBasicMaterial({ color: 0x120e0b }) : null;
  function doorOf(key) {
    if (doors.has(key)) return doors.get(key);
    const plan = planOf(key);
    if (!plan || !T) return null;
    const g = new T.Group();
    const hinge = new T.Group();
    const leaf = new T.Mesh(leafG, leafM);
    const hole = new T.Mesh(holeG, holeM);
    g.position.set(plan.sill[0], plan.floorY, plan.sill[1]);
    g.rotation.y = Math.atan2(plan.face[0], plan.face[1]);
    hinge.position.set(-0.55, 0, 0.04);
    leaf.position.set(0.55, 1.15, 0);
    hinge.add(leaf);
    hole.position.set(0, 1.175, 0.015);
    g.add(hinge, hole);
    g.visible = false;
    city.scene.add(g);
    const d = { g, hinge, hole, k: 0 };
    doors.set(key, d);
    return d;
  }

  // who wants which pad open, in the order they asked: the last one has the cut
  const wanted = [];
  let open = null;
  let busy = Promise.resolve();
  async function sync() {
    const key = wanted[wanted.length - 1] ?? null;
    if (key === open) return;
    const h = key ? entry(key) : null;
    if (!h) {
      if (open) homes.close({ instant: true });
      open = null;
      return;
    }
    spare();
    // no ceiling, so the room is seen from above; the cut is the city's own (interiors/city/index.js setCut)
    const ok = await homes.open({ ...h, ceiling: false }, { instant: true });
    if (!ok) return;
    open = key;
  }

  // the pads' inside views (set/crib.js): the same rooms, built away from the city; the run's own pad from the
  // starter pack (set/starter.js) once the run says which it is
  const starter = await createStarter().catch(err => {
    console.warn('[set] no starter pack: the run\'s crib is its preset', err);
    return null;
  });
  const cribs = createCribs({ city, HOMES, PLAN, GPU, roomOf, entry, lotOf, keys: [...homeOf.keys()], starter });

  return {
    homes,
    cribs,
    starter,
    has: key => homeOf.has(key),
    /**
     * Where the pad's tenant stands: the room's clear floor (plan.js ACT), facing the room's front; `exact` (the fifth
     * entry) says the point is that, to be stood on as it is. Without a plan, a step inside the front wall. Null until
     * its block is built.
     */
    anchor(key) {
      const h = entry(key);
      if (!h) return null;
      const plan = planOf(key);
      if (plan) return [...plan.act, true];
      const d = h.fd / 2 - 1.2;
      return [h.cx + Math.sin(h.th) * d, h.floorY + 0.02, h.cz + Math.cos(h.th) * d, h.th];
    },
    /** The pad's way in and out (the city's plan, above), or null until its block is built. */
    plan: key => planOf(key),
    /** The door's leaf open by k (0 shut … 1 open). The doorway is dark behind it unless the room is open. */
    door(key, k) {
      const d = doorOf(key);
      if (!d) return;
      d.k = k;
      d.g.visible = k > 0.001;
      d.hinge.rotation.y = k * 1.75;
      d.hole.visible = open !== key;
    },
    show(key, on) {
      const at = wanted.indexOf(key);
      if (at !== -1) wanted.splice(at, 1);
      if (on) wanted.push(key);
      busy = busy.then(sync, sync);
      return busy;
    },
    get open() {
      return open;
    },
  };
}
