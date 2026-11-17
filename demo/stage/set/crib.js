// THE CRIB'S INSIDE VIEW: a pad's own room as a place with an inside (demo/stage/inside.js, THE CONTRACT; this is the
// first place to give it). The room is the city's own (interiors/city/: the homes runtime builds it from the pad's
// layout, plan.js walks it), but it is NOT opened in place: a second homes runtime of its own builds it LIFT metres
// over its lot, where no walker and nothing of the city is near it, and draws it on the inside layer alone. The pad's
// trailer stays whole where it stands: the city's cutaway is never asked for (the cut the homes runtime sets on every
// open is put back as it was, the pads' cutaway's or none).
//
// Its door, outside, is the trailer's real door: the lot's anchor gives the stoop (0.55 m in front of the wall,
// plan.js) and the way it faces, and our leaf hangs in the wall there and swings out. Its door inside is a doorway in
// a low front wall of ours (the room is seen walls-down from its open front, as the city's own cutaway shows it), with
// a leaf that swings in while somebody comes or goes and is not there otherwise.
//
// THE RUN'S OWN PAD is built from the starter pack instead (set/starter.js: a layout of ours in the city's format,
// 7 m by 3.5 m), once the run says which pad is the player's: its doorway in the middle of the room's long front,
// wherever the trailer's own door is outside; where the player stands, on the door's line a step in, facing the
// camera; asleep along the bed with the feet on it; the low front wall ending at the side walls' inner faces (it ran
// 0.15 m into them: two faces in one plane at the front corners, which flickered). When what the room is built from
// changes (the real bed bought), the place is made again and, if its view is up, the new room is swapped in where
// the old one stood. The other pads, and every pad of the old game, are built as they were.
//
//   const cribs = createCribs({ city, HOMES, PLAN, GPU, roomOf, entry, lotOf, keys, starter })
//   cribs.keys() · cribs.place(key) → the place (inside.js's contract) for a pad's key
import { LAYER } from '../inside.js';
import { createArrange } from './arrange.js';

/** How far over its lot a pad's room is built for the inside view (m): over every walker's head, near the ground's light. */
export const LIFT = 12;
/** The low front wall of the inside view: its height and thickness (m); the doorway's width. */
const STUB = { h: 0.42, t: 0.12, gap: 1.12 };
/** The stoop is this far in front of the wall (plan.js), and the step this far in front of the stoop (pads.js). */
const STOOP = 0.55;
const STEP = 1.15;
/** How far the leaf outside swings open (radians, outward: a trailer's door opens out) and the one inside (in). */
const SWING_OPEN = 1.75;
const SWING_IN = 1.65;
/** A room cell (m), the city's. */
const C4 = 0.25;

export function createCribs({ city, HOMES, PLAN, GPU, roomOf, entry, lotOf, keys = [], starter = null }) {
  const T = city.THREE;
  const NIGHT = new URLSearchParams(location.search).get('tod') === 'night';
  /** The room a pad's inside view is built from: the run's starter for the run's own pad, else the pad's preset. */
  const roomFor = (key, h) => starter?.roomFor(key) ?? roomOf(h);
  // (its own runtime: its rooms are never the cutaway's, and its cache holds only lifted rooms)
  const homes = HOMES.createHomes(city, { Q: new URLSearchParams(), NIGHT, record: { roomOf: h => (h.hk2key ? roomFor(h.hk2key, h) : roomOf(h)) } });
  const CUT = GPU?.CUT ?? null;
  /** The city's cut as it is now, to be put back after the homes runtime has set its own. */
  const cutNow = () => (CUT ? CUT.value.slice() : null);
  const putCut = was => was && CUT.value.set(was);

  const leafG = new T.BoxGeometry(1.06, 2.2, 0.06);
  const leafM = new T.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.7 });
  const paneG = new T.BoxGeometry(0.38, 0.38, 0.075);
  const paneM = new T.MeshStandardMaterial({ color: 0x9fd6ee, roughness: 0.25 });
  const holeG = new T.PlaneGeometry(1.12, 2.26);
  const holeM = new T.MeshBasicMaterial({ color: 0x120e0b });
  const innerM = new T.MeshStandardMaterial({ color: 0x7a4c2c, roughness: 0.7, transparent: true });
  const stubM = new T.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.85 });
  const sillM = new T.MeshStandardMaterial({ color: 0x5a3b24, roughness: 0.8 });
  // THE DEADBOLT ON THE DOOR (lib-1): owned, the kit's own door chain and locks (interiors/home security.js
  // 'door-locks', variant 0 "chain + deadbolt") on the room side of both leaves, by the latch edge, at its own mount
  // height. The rules are not touched: what the deadbolt does is config's (`things.deadbolt.defends`).
  let lockGeo = null;
  const lockMats = [0.78, 0.22, 0.3].map((r, i) => new T.MeshStandardMaterial({ vertexColors: true, roughness: r, metalness: [0, 0.1, 0.85][i] }));
  const CITY = new URL('../../../city/from-trunk/style/city/', import.meta.url).href;
  Promise.all([import(`${CITY}interiors/home/index.js`), import(`${CITY}vox.js`), import(`${CITY}glue.js`)]).then(([HO, V, G]) => {
    const o = HO.byId.get('door-locks');
    const b = new V.Bank(true);
    V.meshVol(HO.buildObject(o, { variant: 0 }), b);
    lockGeo = { mount: o.mount, layers: b.L.map((O, li) => (O.v ? { g: G.geoOf(O), li } : null)).filter(Boolean) };
  }).catch(err => console.warn('[crib] the door locks did not load:', err));
  /** The locks for a leaf (its centre at the leaf's middle): on its -z face (the room's side), by the latch edge. */
  function locksOn(leaf, side = -1) {
    if (!lockGeo) return null;
    const g = new T.Group();
    for (const { g: geo, li } of lockGeo.layers) g.add(Object.assign(new T.Mesh(geo, lockMats[li] ?? lockMats[0]), { userData: { shared: true } }));
    // (the piece's face is +z out of its wall: turned half round to face -z, its 0.25 m width ending 0.06 m from the edge)
    g.rotation.y = side < 0 ? Math.PI : 0;
    g.position.set(side < 0 ? 0.47 : 0.22, lockGeo.mount - 1.1, side * 0.031);
    leaf.add(g);
    return g;
  }

  function make(key) {
    const h = entry(key);
    const l = h ? lotOf(h.id) : null;
    const r = h ? roomFor(key, h) : null;
    if (!h || !l?.door || !r) return null;
    const hL = { ...h, floorY: h.floorY + LIFT, ceiling: false, hk2key: key };
    // the run's starter: the doorway in the middle of the room's long front (the plan's way in reads it off a stoop
    // in front of it); a preset: across from the trailer's own door, as before
    const S0 = r.starter ?? null;
    let door = { door: [l.door[0], l.door[1] + LIFT, l.door[2]], face: l.face };
    if (S0) {
      const F0 = PLAN.roomFrame(hL, r.A);
      const [sx, sz] = F0.toWorld(S0.door * C4, F0.D + STOOP);
      door = { door: [sx, l.door[1] + LIFT, sz], face: [F0.za[0], F0.za[1]] };
    }
    let P = null;
    try {
      P = PLAN.homePlan(hL, r.A, door);
    } catch (err) {
      console.warn('[crib] no plan of', key, err);
    }
    if (!P?.act || !P.door) return null;
    const F = P.F;
    const yF = P.yF;
    const [fx0, fz0] = l.face ?? [Math.sin(h.th), Math.cos(h.th)];
    const fl = Math.hypot(fx0, fz0) || 1;
    const face = [fx0 / fl, fz0 / fl];
    // outside: the trailer's own door (the stoop on the ground, the doorway in its wall at its floor, the step)
    const stoop = [l.door[0], l.door[1], l.door[2]];
    const outside = {
      stoop,
      sill: [stoop[0] - face[0] * STOOP, h.floorY, stoop[2] - face[1] * STOOP],
      step: [stoop[0] + face[0] * STEP, stoop[2] + face[1] * STEP],
      face,
    };
    // (the leaf open, hinge to edge on the ground: the door's own frame turned to the world, the leaf below)
    {
      const th = Math.atan2(face[0], face[1]);
      const W = (lx, lz) => [outside.sill[0] + Math.cos(th) * lx + Math.sin(th) * lz, outside.sill[2] - Math.sin(th) * lx + Math.cos(th) * lz];
      const [hx, hz] = [-0.56, 0.05];
      const a = -SWING_OPEN;
      outside.swing = [W(hx, hz), W(hx + 1.06 * Math.cos(a), hz - 1.06 * Math.sin(a))];
    }
    // inside: the room's doorway (the city's plan: its front, across from the stoop) and the first free step in,
    // facing in (the starter's: into its own front, which faces where the trailer's does)
    const sillR = F.toRoom(...P.door.sill);
    const inside = { sill: P.w3(sillR[0], sillR[1]), at: P.w3(...P.door.inside), ry: S0 ? Math.atan2(-F.za[0], -F.za[1]) : Math.atan2(-face[0], -face[1]) };
    const corners = [[0, 0], [F.W, 0], [F.W, F.D], [0, F.D]].map(([x, z]) => F.toWorld(x, z));
    const bounds = { corners, y: yF, h: hL.H, look: [F.za[0], F.za[1]] };
    // where the tenant stands: the starter's spot on the door's line; a preset's clear floor (plan.js ACT)
    const stand = S0 ? (([x, , z]) => ({ x, y: yF, z, ry: F.th }))(P.w3(S0.stand[0] * C4, S0.stand[1] * C4)) : { x: P.act.world[0], y: yF, z: P.act.world[2], ry: F.th };
    // the bed, as plan.js spotPose lays a sleeper on it (set/pads.js did the same): the feet BED_IN along the bed
    // from its foot spot, the body lying back from them to the pillow. That put the feet 0.2 m past the foot of the
    // bed, in whatever stands there (a preset's dresser). The starter's sleeper has the feet ON the bed, 0.1 m in
    // from its foot, and the body lies back along it (1.7 m: the head on the pillow end of a 2 m bed)
    const bed = (() => {
      const sp = P.byAct.get('sleep')?.find(q => q.bed);
      if (!sp) return null;
      const b = sp.bed.yaw;
      const [bx, bz] = [Math.sin(b), Math.cos(b)];
      const IN = S0 ? [0, 0] : PLAN.BED_IN;
      const cl = (v, hi) => Math.max(0.2, Math.min(hi - 0.2, v));
      const at = [cl(sp.bed.x + bx * IN[0] + bz * IN[1], F.W), cl(sp.bed.z + bz * IN[0] - bx * IN[1], F.D)];
      const [x, y, z] = P.w3(at[0], at[1], yF + sp.bed.y - 0.12);
      return { x, y, z, ry: F.th + b, clip: PLAN.CLIPS.lie, stand: F.toWorld(...sp.stand) };
    })();
    const spotOf = (sp, role) => {
      const [x, , z] = P.w3(...sp.stand);
      const ry = sp.face ? Math.atan2(...dirW(F, sp.face[0] - sp.stand[0], sp.face[1] - sp.stand[1])) : F.th;
      return { role, x, y: yF, z, ry };
    };
    const G = P.G;

    // ── what is drawn besides the city's room: the low front wall with its doorway, the leaf inside, and the leaf
    // outside in the trailer's wall
    const extra = new T.Group();
    {
      const g = new T.Group();
      g.position.set(...P.w3(0, F.D));
      g.rotation.y = F.th;
      const dx = sillR[0];
      const half = STUB.gap / 2;
      const piece = (x0, x1) => {
        if (x1 - x0 < 0.05) return;
        const m = new T.Mesh(new T.BoxGeometry(x1 - x0, STUB.h, STUB.t), stubM);
        m.position.set((x0 + x1) / 2, STUB.h / 2, -STUB.t / 2);
        g.add(m);
      };
      // (a preset's runs on 0.15 m into the side walls, as it always has; the starter's stops at their inner faces:
      // its front face no longer lies in the plane of the side walls' ends)
      const over = S0 ? 0 : 0.15;
      piece(-over, dx - half);
      piece(dx + half, F.W + over);
      const sill = new T.Mesh(new T.BoxGeometry(STUB.gap, 0.03, STUB.t), sillM);
      sill.position.set(dx, 0.015, -STUB.t / 2);
      g.add(sill);
      // (the leaf inside: hinged on the doorway's left, swinging into the room; there only while it is open)
      const hinge = new T.Group();
      hinge.position.set(dx - half + 0.03, 0, -STUB.t / 2);
      const leaf = new T.Mesh(leafG, innerM);
      leaf.position.set(0.53, 1.1, 0);
      leaf.visible = false;
      if (S0 && starter.shows().door) locksOn(leaf, -1);
      hinge.add(leaf);
      g.add(hinge);
      extra.add(g);
      extra.userData.inner = { hinge, leaf };
    }
    extra.traverse(o => o.layers.set(LAYER));
    extra.visible = false;
    city.scene.add(extra);
    const outer = (() => {
      const g = new T.Group();
      g.position.set(...outside.sill);
      g.rotation.y = Math.atan2(face[0], face[1]);
      const hinge = new T.Group();
      hinge.position.set(-0.56, 0, 0.05);
      const leaf = new T.Mesh(leafG, leafM);
      leaf.position.set(0.53, 1.1, 0);
      // (a trailer door's small window, as the city draws its own shut door)
      const pane = new T.Mesh(paneG, paneM);
      pane.position.set(0, 0.45, 0);
      leaf.add(pane);
      // (the room's side of the trailer's own door: seen from the street while it stands open)
      if (S0 && starter.shows().door) locksOn(leaf, -1);
      hinge.add(leaf);
      const hole = new T.Mesh(holeG, holeM);
      hole.position.set(0, 1.13, 0.02);
      g.add(hinge, hole);
      g.visible = false;
      city.scene.add(g);
      return { g, hinge };
    })();

    let shown = false;
    let gone = false;
    const leaves = { in: 0, out: 0 };
    const place = {
      key,
      lift: LIFT,
      plan: P,
      room: r.name,
      door: () => ({ outside, inside }),
      async open() {
        if (gone) return false;
        const was = cutNow();
        const ok = await homes.open(hL, { instant: true });
        // (the homes runtime set the city's cut on its way: put back as it was, the pads' cutaway's or none)
        putCut(was);
        if (!ok || gone) return false;
        const e = [...homes.cache.values()].pop();
        e?.g.traverse(o => o.layers.set(LAYER));
        extra.visible = true;
        shown = true;
        return true;
      },
      close() {
        if (!shown) return;
        shown = false;
        const was = cutNow();
        homes.close({ instant: true });
        putCut(was);
        extra.visible = false;
      },
      bounds: () => bounds,
      spots(role) {
        if (role === 'stand') return [{ role, ...stand }];
        if (role === 'bed') return bed ? [{ role, ...bed }] : [];
        if (role === 'door') return [{ role, x: inside.sill[0], y: yF, z: inside.sill[2], ry: inside.ry }];
        return (P.byAct.get(role) ?? []).map(sp => spotOf(sp, role));
      },
      way(a, b) {
        const p = P.way(F.toRoom(a[0], a[1]), F.toRoom(b[0], b[1]));
        return p ? p.map(([x, z]) => P.w3(x, z)) : null;
      },
      solidAt(x, z) {
        const [rx, rz] = F.toRoom(x, z);
        if (rx < -0.05 || rx > F.W + 0.05 || rz < -0.05 || rz > F.D + 0.05) return 'nothing (off the floor)';
        if (rx < 0.1 || rx > F.W - 0.1 || rz < 0.1) return 'a wall';
        if (rz > F.D - 0.1 && Math.abs(rx - sillR[0]) > STUB.gap / 2) return 'the front wall';
        const gx = Math.floor((rx - P.x0) / C4);
        const gz = Math.floor(rz / C4);
        if (gx >= 0 && gz >= 0 && gx < G.RW && gz < G.RD && G.blocked[gx + gz * G.RW]) return 'a piece of furniture';
        return null;
      },
      leaf(side, k) {
        leaves[side] = k;
        if (side === 'out') {
          outer.g.visible = k > 0.001;
          // (out, into the porch: a trailer's door opens outward)
          outer.hinge.rotation.y = -k * SWING_OPEN;
          return;
        }
        const I = extra.userData.inner;
        I.hinge.rotation.y = k * SWING_IN;
        I.leaf.visible = k > 0.001;
        innerM.opacity = Math.min(1, k / 0.35);
      },
      // (by night: over the front half of the room, so whoever faces the camera has the light on their face)
      lamp: () => P.w3(F.W / 2, F.D * 0.82, yF + 2.4),
      // (what it stands on in the inside view: a trailer's lot is grass, a walk-up's block is concrete)
      ground: () => (h.tier === 'trailer' ? 'grass' : 'concrete'),
      /**
       * This place is made again (what its room is built from changed): `next` takes over. If the view is up, the
       * new room is built where this one stands (the homes runtime swaps its group in), the leaves as they were.
       */
      async passTo(next) {
        const up = shown;
        shown = false;
        gone = true;
        const done = () => {
          extra.removeFromParent();
          outer.g.removeFromParent();
          extra.traverse(o => o.geometry && o.geometry !== leafG && !o.userData.shared && o.geometry.dispose());
        };
        if (!up) return done();
        next.leaf('in', leaves.in);
        next.leaf('out', leaves.out);
        const ok = await next.open().catch(() => false);
        done();
        return ok;
      },
    };
    return place;
  }
  /**
   * A pad's place, made once its block is built (null before: asked again a second later at the soonest), and made
   * again whenever what its room is built from changes (starter.sig: the run's pad, what it owns).
   */
  const made = new Map();
  function placeOf(key) {
    const sig = starter?.sig(key) ?? '';
    const m = made.get(key);
    if (m?.place && m.sig === sig) return m.place;
    const now = performance.now();
    if (m && now - m.at < 1000) return m.place;
    const p = make(key);
    if (!p) {
      // (not yet: the old one, if any, until the new one can be made)
      made.set(key, { sig: m?.place ? m.sig : sig, place: m?.place ?? null, at: now });
      return m?.place ?? null;
    }
    const swap = m?.place ? m.place.passTo(p).catch(err => console.warn('[crib] the room was not swapped:', key, err)) : null;
    made.set(key, { sig, place: p, at: now, swap });
    return p;
  }
  // THE RUN'S CRIB ARRANGED (set/arrange.js): the room made again at once when the arrangement changes (not a second
  // later); `swap` resolves once the new room stands where the old one did
  const arrange = starter ? createArrange({ city, PLAN, starter, current: key => made.get(key)?.place ?? null, remake: key => ((made.get(key) ?? {}).at = -Infinity, placeOf(key), made.get(key)?.swap ?? null) }) : null;
  // a place whose plan waits for its block: it answers null until then
  const lazy = new Map();
  function handle(key) {
    if (lazy.has(key)) return lazy.get(key);
    const call = (name, fallback) => (...a) => {
      const p = placeOf(key);
      return p ? p[name](...a) : fallback;
    };
    const H = {
      key,
      door: call('door', null),
      open: async () => (placeOf(key) ? placeOf(key).open() : false),
      close: call('close', undefined),
      bounds: call('bounds', null),
      spots: call('spots', []),
      way: call('way', null),
      solidAt: call('solidAt', null),
      leaf: call('leaf', undefined),
      lamp: call('lamp', null),
      ground: call('ground', undefined),
      // (how far over its lot the inside is built: a picture of the city from that much lower has the building where the room is)
      lift: LIFT,
      get plan() {
        return placeOf(key)?.plan ?? null;
      },
      get room() {
        return placeOf(key)?.room ?? null;
      },
      // (the run's own pad: its arrangement, set/arrange.js; null for every other pad)
      get arrange() {
        return arrange?.of(key) ?? null;
      },
    };
    lazy.set(key, H);
    return H;
  }
  return { keys: () => keys.slice(), place: handle, homes };
}

// a room direction → a world direction ([dx, dz] for atan2(dx, dz): yaw 0 faces +z), plan.js's own
function dirW(F, dx, dz) {
  return [F.xa[0] * dx + F.za[0] * dz, F.xa[1] * dx + F.za[1] * dz];
}
