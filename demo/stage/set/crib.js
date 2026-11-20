// THE CRIB'S INSIDE VIEW: a pad's own room as a place with an inside (demo/stage/inside.js, THE CONTRACT; this is the
// first place to give it). The room is the city's own (interiors/city/: the homes runtime builds it from the pad's
// layout, plan.js walks it), but it is NOT opened in place: a second homes runtime of its own builds it LIFT metres
// over its lot, where no walker and nothing of the city is near it, and draws it on the inside layer alone. The pad's
// trailer stays whole where it stands: the city's cutaway is never asked for (the cut the homes runtime sets on every
// open is put back as it was, the pads' cutaway's or none).
//
// Its door, outside, is the trailer's real door: the lot's anchor gives the stoop (0.55 m in front of the wall,
// plan.js) and the way it faces, and our leaf hangs in the wall there. Its door inside is a doorway in a low front
// wall of ours (the room is seen walls-down from its open front, as the city's own cutaway shows it), with a leaf that
// is there while somebody comes or goes and not otherwise. THE TWO LEAVES SWING THE WAY THE WALKER GOES (notes-1, the
// owner 2026-11-19: "the door should swing out from the direction you are walking so it doesnt pass through your
// body"): leaving, out, ahead of him, in the room's view and then outside; coming in, in, outside and then in the
// room's view (place.leaf's `way`, doorway.js says which). Both are hinged on the left as the door is seen from in
// front of it. The trailer's leaf swung in is seen in its dark doorway, and only there (it is drawn just after the
// doorway's dark, where the dark is nearer than it: the trailer's wall, in front of it everywhere else, hides the
// rest); what is mounted on its room side is behind it then, against the wall, and is not drawn.
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
/**
 * How far a leaf swings open (radians): the trailer's out over its stoop, and in; the room's in, and out over the
 * ground in front of its low wall (no further than square to it: past that its hinge edge went into the wall's end).
 */
const SWING_OPEN = 1.75;
const SWING_OPEN_IN = 1.65;
const SWING_IN = 1.65;
const SWING_IN_OUT = Math.PI / 2;
/** The trailer's leaf swinging in hangs this far into the wall (m, off the doorway's dark): behind the dark from the first. */
const HANG_IN = -0.04;
/** A leaf (m): its width, height, thickness. */
const LEAF = { w: 1.06, h: 2.2, t: 0.06 };
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

  const leafG = new T.BoxGeometry(LEAF.w, LEAF.h, LEAF.t);
  const leafM = new T.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.7 });
  const paneG = new T.BoxGeometry(0.38, 0.38, 0.075);
  const paneM = new T.MeshStandardMaterial({ color: 0x9fd6ee, roughness: 0.25 });
  // (the trailer's leaf swung in, inside its wall: drawn only where the doorway's dark, drawn just before it, is nearer
  // than it, and over that dark; it leaves the dark's depth as it was, so the wall and the trailer's own door, drawn
  // after, stay behind the dark and whoever stands in front of the doorway is drawn over the lot)
  const behind = m => Object.assign(m.clone(), { depthFunc: T.GreaterEqualDepth, depthWrite: false });
  const leafInM = behind(leafM);
  const paneInM = behind(paneM);
  const holeG = new T.PlaneGeometry(1.12, 2.26);
  const holeM = new T.MeshBasicMaterial({ color: 0x120e0b });
  const innerM = new T.MeshStandardMaterial({ color: 0x7a4c2c, roughness: 0.7, transparent: true });
  const stubM = new T.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.85 });
  const sillM = new T.MeshStandardMaterial({ color: 0x5a3b24, roughness: 0.8 });
  // THE DEADBOLT ON THE DOOR (lib-1): owned, the kit's own door chain and locks (interiors/home security.js
  // 'door-locks', variant 0 "chain + deadbolt") on the room side of both leaves, by the latch edge, at its own mount
  // height. The rules are not touched: what the deadbolt does is config's (`things.deadbolt.defends`).
  let lockGeo = null;
  // (sixes-1: THE DOOR BAR, the kit's own 'door-bar', across the room's side of the door leaves, owned: as the locks)
  let barGeo = null;
  const lockMats = [0.78, 0.22, 0.3].map((r, i) => new T.MeshStandardMaterial({ vertexColors: true, roughness: r, metalness: [0, 0.1, 0.85][i] }));
  const CITY = new URL('../../../city/from-trunk/style/city/', import.meta.url).href;
  Promise.all([import(`${CITY}interiors/home/index.js`), import(`${CITY}vox.js`), import(`${CITY}glue.js`)]).then(([HO, V, G]) => {
    const o = HO.byId.get('door-locks');
    const b = new V.Bank(true);
    V.meshVol(HO.buildObject(o, { variant: 0 }), b);
    lockGeo = { mount: o.mount, layers: b.L.map((O, li) => (O.v ? { g: G.geoOf(O), li } : null)).filter(Boolean) };
    const ob = HO.byId.get('door-bar');
    if (ob) {
      const bb = new V.Bank(true);
      V.meshVol(HO.buildObject(ob, { variant: 0 }), bb);
      const box = new T.Box3();
      const layers = bb.L.map((O, li) => (O.v ? { g: G.geoOf(O), li } : null)).filter(Boolean);
      for (const { g } of layers) { g.computeBoundingBox(); box.union(g.boundingBox); }
      barGeo = { mount: ob.mount ?? 1.1, layers, box };
    }
  }).catch(err => console.warn('[crib] the door locks did not load:', err));
  // THE GUARD DOG (assets-1): the older game's chain dog (props/dog.js) stood by his bed wherever the room has one (the kit's
  // 'dog-bed', owned and put down), or out in the yard by the stoop when a tool asks (place.dog(mode, { yard: true })). A pose to
  // show, no rule: sit by default; place.dog('lie' | 'sleep' | 'bark' | …) changes it, place.dog(null) sends him off.
  const dogKit = Promise.all([import(`${CITY}vox.js`), import(`${CITY}glue.js`), import('../props/dog.js'), import(`${CITY}interiors/home/index.js`)])
    .catch(err => (console.warn('[crib] the dog did not load:', err), null));
  const dogs = new Set();
  let dogLoop = false;
  function tickDogs() {
    if (!dogs.size) { dogLoop = false; return; }
    dogLoop = true;
    const now = performance.now();
    for (const d of dogs) { const dt = Math.min(0.1, (now - (d.last ?? now)) / 1000); d.last = now; if (d.dog.root.parent && d.dog.root.visible) d.dog.tick(dt); }
    requestAnimationFrame(tickDogs);
  }
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

  /** (sixes-1) The door bar for a leaf: across its room side at the height of the kit's mount, centred on the leaf. */
  function barOn(leaf, side = -1) {
    if (!barGeo) return null;
    const g = new T.Group();
    for (const { g: geo, li } of barGeo.layers) g.add(Object.assign(new T.Mesh(geo, lockMats[li] ?? lockMats[0]), { userData: { shared: true } }));
    const b = barGeo.box;
    // (the piece's own middle on the leaf's middle, turned to face the room; at the kit's mount height off the floor)
    g.rotation.y = side < 0 ? Math.PI : 0;
    const cx = (b.min.x + b.max.x) / 2;
    g.position.set(side < 0 ? cx : -cx, barGeo.mount - 1.1 - (b.min.y + b.max.y) / 2 + (b.max.y - b.min.y) / 2, side * 0.04);
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
      const mounts = [S0 && starter.shows().door ? locksOn(leaf, -1) : null].filter(Boolean);
      // (notes-1: THE DOOR BAR IS LIFTED OFF TO OPEN THE DOOR. The kit's bar is 1.25 m across, wider than the leaf, and
      // braced 0.3 m out to a plate on the floor: on a leaf swung open it went into the doorway's end or across the
      // way through, whichever way the leaf swung. It stands as the kit builds it, its back to the low wall's inside
      // face beside the doorway, on the latch side where the floor is clear (else the hinge side; else it is put away
      // and not seen). Outside it is inside the trailer, off the door, and not drawn.)
      // (notes-2: ALWAYS THERE, ONE PLACE. It stood there only while the door was open: it came into being as he made
      // for the door and was gone after. The room's leaf is drawn only while somebody comes or goes (the room is seen
      // from its open front, and a shut leaf there would stand in the camera's look into it), so there is no shut door
      // in this view for it to lie across; across the bare doorway it would hang in the air at the leaf's height. So
      // it stands by the doorway all the time it is owned, door shut or open, where a bar is kept to hand.)
      let bar = null;
      if (S0 && starter.shows().bar && barGeo) {
        const w = barGeo.box.max.x - barGeo.box.min.x;
        const deep = barGeo.box.max.z - barGeo.box.min.z;
        const freeAt = x0 => {
          if (x0 < 0.12 || x0 + w > F.W - 0.12) return false;
          for (let x = x0; x <= x0 + w + 1e-6; x += C4 / 2) {
            for (const z of [F.D - STUB.t - 0.02, F.D - STUB.t - deep]) {
              const gx = Math.floor((Math.min(x, x0 + w) - P.x0) / C4);
              const gz = Math.floor(z / C4);
              if (gx < 0 || gz < 0 || gx >= G.RW || gz >= G.RD || G.blocked[gx + gz * G.RW]) return false;
            }
          }
          return true;
        };
        const x0 = [dx + half + 0.06, dx - half - 0.06 - w].find(freeAt);
        if (x0 !== undefined) {
          // (on a stand where a leaf's middle would be, so barOn sets it at the kit's own height and 0.01 m off the wall)
          const stand = new T.Group();
          stand.position.set(x0 + w / 2, 1.1, -STUB.t + 0.03);
          if (barOn(stand, -1)) g.add((bar = stand));
        }
      }
      hinge.add(leaf);
      g.add(hinge);
      extra.add(g);
      extra.userData.inner = { hinge, leaf, mounts, bar };
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
      // (the room's side of the trailer's own door: seen from the street while it stands open out)
      // (the door bar is not on it: lifted off to open the door, it stands inside, set above)
      const mounts = [S0 && starter.shows().door ? locksOn(leaf, -1) : null].filter(Boolean);
      hinge.add(leaf);
      const hole = new T.Mesh(holeG, holeM);
      hole.position.set(0, 1.13, 0.02);
      // (the dark first of all, then the leaf swung in: see `behind`)
      hole.renderOrder = -2;
      g.add(hinge, hole);
      g.visible = false;
      city.scene.add(g);
      return { g, hinge, leaf, pane, mounts };
    })();

    // the dog's bed in this room (an item of its layout), as room metres → the world, facing the room's open front
    const bedItem = (r.A?.items ?? []).find(it => it.id === 'dog-bed');
    // (in the bed's ring: 0.375 m in from its back-left corner, the bowls to its right, as the kit draws it; turned with the bed)
    const dogSpot = bedItem ? (() => { const rot = ((bedItem.rot ?? 0) / 90) & 3, w = rot & 1 ? 3 : 4, d = rot & 1 ? 4 : 3;
      const ring = [[.375, .375], [.375, .625], [.625, .375], [.625, .375]][rot];
      const at = P.w3(bedItem.x * C4 + Math.min(ring[0], w * C4), bedItem.z * C4 + Math.min(ring[1], d * C4), yF); return { at, ry: Math.atan2(F.za[0], F.za[1]) }; })() : null;
    const yardSpot = { at: [outside.step[0] + face[1] * 1.1, 0, outside.step[1] - face[0] * 1.1], ry: Math.atan2(face[0], face[1]) };
    let dogNow = null;
    async function setDog(mode, o = {}) {
      if (!mode) { if (dogNow) { dogs.delete(dogNow); dogNow.dog.dispose(); dogNow.bed?.removeFromParent(); dogNow = null; } return null; }
      const yard = !!o.yard, spot = yard ? yardSpot : dogSpot;
      if (!spot) return null;
      // (the yard's ground as it is drawn there: the first of the city's surfaces straight down, once)
      if (yard && !yardSpot.grounded) { yardSpot.grounded = true; try { const rc = new T.Raycaster(new T.Vector3(yardSpot.at[0], yardSpot.at[1] + 4, yardSpot.at[2]), new T.Vector3(0, -1, 0), 0, 8); rc.layers.set(0); rc.camera = city.camera;
        const hit = rc.intersectObjects(city.scene.children, true).find(q => q.object.isMesh && q.object.visible && q.point.y < yardSpot.at[1] + 1.2); if (hit) yardSpot.at[1] = hit.point.y; } catch { /* (the plan's ground, 0) */ } }
      const kit = await dogKit;
      if (!kit || gone) return null;
      const [VOX, GLUE, D, HO] = kit;
      if (dogNow && dogNow.yard !== yard) await setDog(null);
      if (!dogNow) {
        const dog = D.createDog(T, VOX, GLUE, { coat: o.coat ?? 'fawn', mode });
        let bed = null;
        if (yard) {
          // (out in the yard he brings his own bed: the kit's, at the stoop's side)
          const b = new VOX.Bank(true); VOX.meshVol(HO.buildObject('dog-bed', { variant: 0 }), b);
          bed = new T.Group(); b.L.forEach((O, li) => { if (O.v) bed.add(new T.Mesh(GLUE.geoOf(O), lockMats[Math.min(2, li)])); });
          // (its ring under him: the bed's back-left corner 0.375 m back and left of him, turned with him)
          const c = Math.cos(spot.ry), sn = Math.sin(spot.ry);
          bed.position.set(spot.at[0] - (0.375 * c + 0.375 * sn), spot.at[1], spot.at[2] - (-0.375 * sn + 0.375 * c));
          bed.rotation.y = spot.ry; city.scene.add(bed);
        }
        // (set back a little from the ring's centre: his head is forward of his middle, so he lies inside the ring, not over its front)
        const back = 0.08;
        dog.root.position.set(spot.at[0] - Math.sin(spot.ry) * back, spot.at[1] + (yard ? 0 : 0.05), spot.at[2] - Math.cos(spot.ry) * back);
        dog.root.rotation.y = spot.ry;
        if (yard) city.scene.add(dog.root); else { dog.root.traverse(n => n.layers.set(LAYER)); extra.add(dog.root); }
        dogNow = { dog, bed, yard };
        dogs.add(dogNow);
        if (!dogLoop) requestAnimationFrame(tickDogs);
      }
      dogNow.dog.setMode(mode);
      if (o.settle) dogNow.dog.settle();
      return dogNow.dog.mode;
    }
    // (a room with a dog bed shows its dog, sitting by it)
    if (dogSpot) setDog('sit');

    let shown = false;
    let gone = false;
    // each leaf: how far open (k), which way it swings (into the building, or out of it), how much of it is seen
    const leaves = { in: { k: 0, way: 'in', alpha: 1 }, out: { k: 0, way: 'out', alpha: 1 } };
    const leafMesh = side => (side === 'out' ? outer.leaf : extra.userData.inner.leaf);
    const hingeOf = side => (side === 'out' ? outer.hinge : extra.userData.inner.hinge);
    // (the leaf, and each thing mounted on it, as a box in the leaf's own frame: what the doorway measures bodies against)
    const boxesOf = mesh => {
      const out = [new T.Box3(new T.Vector3(-LEAF.w / 2, -LEAF.h / 2, -LEAF.t / 2), new T.Vector3(LEAF.w / 2, LEAF.h / 2, LEAF.t / 2))];
      for (const c of mesh.children) {
        if (!c.visible) continue;
        const b = new T.Box3();
        c.traverse(o => {
          if (!o.geometry) return;
          o.geometry.boundingBox ?? o.geometry.computeBoundingBox();
          const M = new T.Matrix4();
          for (let p = o; p && p !== mesh; p = p.parent) M.premultiply((p.updateMatrix(), p.matrix));
          b.union(o.geometry.boundingBox.clone().applyMatrix4(M));
        });
        if (!b.isEmpty()) out.push(b);
      }
      return out;
    };
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
      /**
       * A leaf open by k (0 shut … 1 open), swinging `way` ('in': into the building or room, 'out': out of it; unsaid,
       * as it always did: the trailer's out, the room's in), the room's one seen by `alpha` (it goes from where it
       * stands when it cannot swing shut).
       */
      leaf(side, k, { way = side === 'out' ? 'out' : 'in', alpha = 1 } = {}) {
        leaves[side] = { k, way, alpha };
        if (side === 'out') {
          const O = outer;
          O.g.visible = k > 0.001;
          // (out, over the stoop; in, inside the wall, hung behind the doorway's dark)
          const inward = way === 'in';
          O.hinge.position.z = inward ? HANG_IN : 0.05;
          O.hinge.rotation.y = inward ? k * SWING_OPEN_IN : -k * SWING_OPEN;
          O.leaf.material = inward ? leafInM : leafM;
          O.pane.material = inward ? paneInM : paneM;
          O.leaf.renderOrder = inward ? -1 : 0;
          O.pane.renderOrder = inward ? -0.5 : 0;
          for (const m of O.mounts) m.visible = !inward;
          return;
        }
        const I = extra.userData.inner;
        I.hinge.rotation.y = way === 'out' ? -k * SWING_IN_OUT : k * SWING_IN;
        I.leaf.visible = k > 0.001 && alpha > 0.001;
        innerM.opacity = Math.min(1, k / 0.35) * alpha;
        // (what is mounted on it goes with it as it goes: it cannot be seen through, so at half)
        for (const m of I.mounts) m.visible = innerM.opacity > 0.5;
      },
      /**
       * For doorway.js: a leaf's hinge in the world ([x, z], and the floor's y) and its reach from it (m); and, while it
       * is shown, its box and the box of each thing mounted on it, each as its four corners on the ground ([x, z] × 4).
       */
      leafAt(side) {
        const mesh = leafMesh(side);
        const H = hingeOf(side);
        H.updateWorldMatrix(true, true);
        const h = new T.Vector3().setFromMatrixPosition(H.matrixWorld);
        const shownNow = side === 'out' ? outer.g.visible : extra.visible && mesh.visible;
        const boxes = shownNow
          ? boxesOf(mesh).map(b => [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.max.x, b.max.z], [b.min.x, b.max.z]].map(([x, z]) => {
            const v = new T.Vector3(x, b.min.y, z).applyMatrix4(mesh.matrixWorld);
            return [v.x, v.z];
          }))
          : null;
        return { hinge: [h.x, h.z], y: h.y, reach: Math.hypot(LEAF.w, LEAF.t / 2), boxes, ...leaves[side] };
      },
      // (by night: over the front half of the room, so whoever faces the camera has the light on their face)
      lamp: () => P.w3(F.W / 2, F.D * 0.82, yF + 2.4),
      /** The guard dog (assets-1): his pose by his bed (or { yard: true }: out by the stoop); null sends him off. → the mode shown */
      dog: (mode, o) => setDog(mode, o),
      /** Where he stands, if anywhere: { mode, yard, at: [x, y, z] } or null. */
      dogNow: () => (dogNow ? { mode: dogNow.dog.mode, yard: dogNow.yard, at: dogNow.dog.root.getWorldPosition(new T.Vector3()).toArray(), ry: dogNow.dog.root.rotation.y } : null),
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
          if (dogNow) setDog(null);
          extra.removeFromParent();
          outer.g.removeFromParent();
          extra.traverse(o => o.geometry && o.geometry !== leafG && !o.userData.shared && o.geometry.dispose());
        };
        if (!up) return done();
        next.leaf('in', leaves.in.k, leaves.in);
        next.leaf('out', leaves.out.k, leaves.out);
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
      leafAt: call('leafAt', null),
      lamp: call('lamp', null),
      ground: call('ground', undefined),
      dog: call('dog', null),
      dogNow: call('dogNow', null),
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
