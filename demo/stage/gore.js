// BLOOD ON WHOEVER IS SHOT (the owner, 2026-11-12: "when you shoot in a robbery it shold be blood splatter on the
// person you hit"). THE CITY'S OWN BLOOD, CALLED, NOT COPIED: stage/gorefx.js in the pinned city, the effects of its
// street accidents (traffic/accident.js): a spray of dark drops and a mist at the blow, a splat where each drop
// lands, splats that ride what they are on, and a pool that spreads under a body and dries away. Nothing is drawn
// here; this file only says when and where, for a body of ours:
//
//   at the shot      the spray and the mist from the chest, thrown the way the bullet went (its drops splat on the
//                    ground behind and round them), and a wound on the chest that rides with the body while it reels
//                    (the city's own way of keeping a splat on a moving thing: its splat on a car)
//   as they go down  the wound is on the body where it lies, and the city's pool spreads under it
//   while they lie   the pool and the wound are kept (the city's pool dries after a minute and a half: a player can
//                    lie hurt for longer than that, waiting for Continue)
//   when they are    up, taken away or gone: the wound goes with them and the pool dries over the city's own six
//   no longer lying  seconds, as when its cleaners mop one
//
//   const gore = await createGore({ city, CITY, actors });
//   gore.hit(victimId, shooterId)     the shot went home
//   gore.hit(victimId, shooterId, { mark: false })   (raidfight-1) on a body posed by hand: the spray and its splats on
//                                     the ground, and nothing that rides the body
//   gore.blow(victimId, hitterId, clip)  a fist landed (punch, haymaker, scuffle_pair: BLOWS), see below
//   gore.blow(victimId, hitterId, clip, { at, mark: false })   (anim-1) a blow on a body the page poses by hand (a
//                                     staged fight, demo/fight/puppet/): the drops off the very place it landed (`at`,
//                                     a world point) and their splats on the ground, and NOTHING that rides the body:
//                                     see "A BODY POSED BY HAND" below
//   gore.cheek(id)                    the mark on the cheek of somebody standing (a fight over, they are on their feet),
//                                     on the face as it is drawn, and its drip (blood-1: see THE MARK IS ON THE FACE)
//   gore.pool(x, y, z) → { dry() }    a small pool on the ground (under the head of one who stays down)
//   gore.riding()                     every splat riding a body now, where it is in the world (for the tools; a mark
//                                     on a face also says where it is in the body's own frame, `rest`)
//   gore.dripped()                    the drip's drops lately: whose, when, where each started (for the tools)
//   gore.stats()                      what is on stage now (for the tools)
//
// A FIST THAT LANDS (the owner, 2026-11-16: "a little blood splatter when a punch lands"): the same blood, smaller,
// and ONLY WHERE THE SCENE ASKS FOR IT: a step with `blood: true` (director.js tells 'blow' at the clip's contact
// moment, BLOWS below; no other step bleeds, so no scene that is played now changes):
//   at the blow      a few drops off the side of the face the fist hit, thrown the way the blow went (the city's
//                    own drops: fx.shed, no mist), and a few small splats where they come down, on the ground as it
//                    is drawn there, which dry away (BLOW.dry)
//   on the face      a small mark on the cheek, on the face as it is drawn (blood-1), kept while they are there; it
//                    goes when they leave (hidden, taken off, gone), as a shot's wound does
//   down and staying down   (lying, LAID seconds and more) a small pool under the head, which dries when they are
//                    up or gone. Down for a moment and up again is no pool. While they lie the cheek mark stays on
//                    the face (blood-1: it is drawn on the head wherever the head is; it was taken off before)

// A BODY POSED BY HAND (anim-1, the owner 2026-11-18: "a piece of blood splatter stays in the air and glitches in
// front of you"). The cheek mark and the wound RIDE a place and a heading: the walker's own, where a head and a chest
// are while it stands in one of the city's clips. A body in a staged fight is not there: its head is wherever the blow
// sent it (leaning in, knocked back, on the ground), and its walker's heading is its LEGS', which pivot with every
// step. So a mark laid on it hung in the air where a standing face would have been, a metre over a body on the ground,
// and swung with the feet. Nothing rides a hand-posed body: its blows shed their drops from where they landed, and
// the mark is put on the cheek when the fight is over and they stand (demo/run/duel.js).
//
// THE MARK IS ON THE FACE AS IT IS DRAWN (blood-1; the owner, 2026-11-19, with a picture: "we still have that bug after
// fights where blood floats in front of the face in mid air"). Riding the walker's place and heading was not enough
// for a standing body either: a head is posed on the GPU (anim/cast/walk2.js), and a standing body's idles nod it,
// turn it to look about and sway it, its springs bob it on a walk and lead a turn, a hand-over's clip leans it, and a
// named person's whole figure is drawn at their own size, 0.90 to 1.25. The mark kept its height above where the feet
// were when it was laid and the walker's heading, half a head-depth out: in front of a face that had turned, nodded or
// walked down a kerb, and in front of a big man's face or inside a small one's. So the mark is no longer a splat that
// rides a walker: it is a few cells of blood laid on the face's own surface, in the body's own frame as the bake has
// it (actors.headDrawn: the head, hair and hat by triangle), and drawn by the walk's own vertex shader with the
// walker's own texels and instance matrix, tagged as the head: the GPU poses it with the head, in every pose and at
// every size, or it is not drawn (the body not drawn near, gone, hidden). Nothing else of the blood changed.
//
// AND IT DRIPS (the owner, 2026-11-19: "should youther face drip blood for a bit after the fight?"): for DRIP.at's
// few seconds after a fight, a drop at a time and slowing, from the foot of the mark as it is drawn then (the city's
// own drop, fx.shed), and a small spot where it lands (fx.splat on the ground as it is drawn), standing or walking off.
/** The clips of a body going down or lying (the city's falls: anim/cast/clips/falls.js). */
const DOWN = new Set(['fall_back', 'shove_fall', 'lie_hurt', 'lie_still', 'death_collapse']);
/** Where the chest is over the feet of a standing body, and how far in front of the body's middle its surface is (m). */
const CHEST = 1.0;
const FRONT = 0.27;
/** A body on its back (fall_back's end, lie_hurt): its chest is this far behind where the feet were, and this high. */
const LAID = { back: 0.5, top: 0.62 };
/**
 * WHERE THE FACE IS (anim-1, 2026-11-18): a head's front is its own half depth ahead of the body's middle (headOf's
 * box, metres: 0.45 on a bare head, more under a brim), and the cheek a quarter of the way up the head. The mark was
 * laid at TWICE that (measured from the game's own high camera, where a mark half a metre in front of a face sits over
 * the cheek in the picture): from any view the player turns the camera to, it hung in the air in front of the face,
 * for the minute it is kept. It is laid on the face: the head's front, never further out than a bare head's and a brim.
 */
const faceAt = H => Math.min(H.hd, 0.5) + 0.03;
/** The clip clock (s) at which each blow lands: the clips' own notes (anim/cast/clips/game-port.js, arrest.js). */
export const BLOWS = Object.freeze({ punch: 0.22, haymaker: 0.08, scuffle_pair: 0.25 });
/**
 * A fist's blood, smaller than a shot's: drops thrown off the face, splats where they come down (their size, how many,
 * how far, how long they stay before drying), the cheek mark's size, and the pool when they stay down (after `stay`
 * seconds lying, its size; it is laid this far behind where the feet were, under the head of a body on its back).
 */
const BLOW = { drops: 9, splats: [4, 6], size: [0.12, 0.24], reach: [0.35, 1.5], life: 30, mark: 0.24, markLife: 60, stay: 2.5, pool: 0.75, head: 1.0 };
/**
 * THE MARK ON THE FACE, in the body's own frame (metres of the bake: a size draws it bigger with the rest): cells of
 * the figures' own voxel (0.05 m), a blotch on the cheek with a run under it, each laid on the face's surface where it
 * is (LIFT off it); a cell with no face in front of it is left out. CELLS: [x, y] in cells from the middle of the mark,
 * +x towards the body's own +x, +y up. Where on the head: `side` × `across` of its half width from the middle, `up` of
 * its height from its bottom (the old mark's place, which was on the cheek in the picture).
 */
const FACE = { cell: 0.05, lift: 0.006, across: 0.3, up: 0.25, deep: 0.08 };
const CELLS = [[-1, 2], [0, 2], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [-1, -1], [0, -1], [1, -1], [2, -1], [0, -2], [1, -2], [0, -3]];
/** The drip after a fight: when each drop falls (s after it is over: one at a time, slowing), and the spot it leaves. */
export const DRIP = Object.freeze({ at: [0.35, 1.0, 1.8, 2.8, 4.0, 5.5], secs: 6, spot: [0.09, 0.15], from: -3 });

export async function createGore({ city, CITY, actors }) {
  const [FX, WALK, FADE] = await Promise.all([import(`${CITY}stage/gorefx.js`), import(`${CITY}anim/cast/walk2.js`), import(`${CITY}camera/fade.js`)]);
  const fx = FX.createGoreFx(city.scene, {});
  const BLOOD = FX.BLOOD;
  const faces = createFaces(city, actors, WALK, FADE, BLOOD);
  const wounds = new Map();
  // (a fist's blood, by whoever took it: blow())
  const fists = new Map();
  let live = 0;

  /** Is this splat still the one we laid (the city's splats are a ring: the oldest slot is used again)? */
  const ours = r => r.s.on && r.s.age >= r.age0 && (r.rider ? r.s.car === r.rider : r.s.car === null && r.s.x === r.x && r.s.z === r.z);
  const keep = r => {
    if (ours(r)) r.s.life = Math.max(r.s.life, r.s.age + BLOOD.dry + 1);
  };
  const dry = r => {
    if (ours(r)) r.s.life = Math.min(r.s.life, Math.max(r.s.age, 0) + BLOOD.dry);
  };
  const note = (s, rider = null) => ({ s, rider, age0: s.age, x: s.x, z: s.z });
  /**
   * THE GROUND AS IT IS DRAWN under a body whose feet are at y. The city's blood lands on the plan's ground (the
   * sidewalk's top, the road's), which is right on its streets; a yard's lane, a plaza's paving and a park's walk are
   * a step higher (Sunny Acres' lane is 0.3 m, a body's feet on it are at 0.2), and a splat laid at the plan's height
   * there is under the paving. So what WE lay on the ground is laid on the collision world's own top there, when
   * that is the ground (within a low step of the feet) and not a thing standing on it.
   */
  const floor = (x, z, y) => {
    const W = city.cam?.world;
    const top = W?.ready?.(x, z) ? W.topAt(x, z) : y;
    return top > y - 0.06 && top < y + 0.36 ? top : y;
  };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function hit(victimId, shooterId, o = {}) {
    const A = actors.all().find(a => a.id === victimId);
    const B = actors.all().find(a => a.id === shooterId);
    if (!A || A.w.hide) return false;
    end(victimId);
    // the way the bullet went: from the gun to them (with nobody to say, the way they face, backwards)
    let [dx, dz] = B ? [A.x - B.x, A.z - B.z] : [-Math.sin(A.ry), -Math.cos(A.ry)];
    const d = Math.hypot(dx, dz) || 1;
    [dx, dz] = [dx / d, dz / d];
    fx.spray(A.x, A.y + CHEST, A.z, dx, 0.12, dz, 1);
    // (and where its drops come down, the way the bullet went: splats on the ground as it is drawn there)
    for (let k = 0; k < 7; k++) {
      const [along, side] = [rnd(0.5, 2.6), rnd(-0.55, 0.55)];
      const [x, z] = [A.x + dx * along - dz * side, A.z + dz * along + dx * side];
      fx.splat(x, floor(x, z, A.y), z, 0, 1, 0, rnd(0.18, 0.42), { delay: 0.25 + along * 0.14, grow: 0.15 });
    }
    // (raidfight-1: `mark: false`, a body posed by hand: nothing rides it (see A BODY POSED BY HAND); the page lays
    // its pool where it lies)
    if (o.mark === false) {
      live = BLOOD.poolLife + 30;
      return true;
    }
    // the wound: on the chest, on the side the shot came from, and where it came out. It rides the body (`rider`,
    // what the city's car splat rides: a place and a heading)
    const rider = { x: A.x, z: A.z, h: 0, yawOff: 0, gone: false };
    const W = { rider, body: [], ground: [], down: false, t: 0, up: 0, laid: null, due: null };
    W.body.push(note(fx.carSplat(rider, -dx * FRONT, A.y + CHEST, -dz * FRONT, -dx, 0.25, -dz, 0.42), rider));
    W.body.push(note(fx.carSplat(rider, dx * FRONT, A.y + CHEST + 0.05, dz * FRONT, dx, 0.25, dz, 0.34), rider));
    wounds.set(victimId, W);
    live = BLOOD.poolLife + 30;
    return true;
  }

  /**
   * A FIST LANDED on `victimId` from `hitterId` (clip: which blow, for its side: the city's punch and haymaker are
   * thrown with the −x fist, across the body to +x).
   */
  function blow(victimId, hitterId, clip = 'punch', o = {}) {
    const A = actors.all().find(a => a.id === victimId);
    const B = actors.all().find(a => a.id === hitterId);
    if (!A || A.w.hide) return false;
    if (o.at) {
      // (anim-1) a body posed by hand: the drops off the place it landed, thrown the way the blow went and a little
      // across; their splats on the ground as it is drawn there; nothing on the body
      let [dx, dz] = B ? [A.x - B.x, A.z - B.z] : [-Math.sin(A.ry), -Math.cos(A.ry)];
      const d = Math.hypot(dx, dz) || 1;
      const sd = Math.random() < 0.5 ? 1 : -1;
      [dx, dz] = [dx / d - (dz / d) * 0.5 * sd, dz / d + (dx / d) * 0.5 * sd];
      const [x0, y0, z0] = o.at;
      fx.shed(x0, y0, z0, dx * 3.0, 1.1, dz * 3.0, BLOW.drops);
      const n = BLOW.splats[0] + Math.floor(Math.random() * (BLOW.splats[1] - BLOW.splats[0] + 1));
      for (let k = 0; k < n; k++) {
        const [along, side] = [rnd(BLOW.reach[0], BLOW.reach[1]), rnd(-0.3, 0.3)];
        const [x, z] = [x0 + dx * along - dz * side, z0 + dz * along + dx * side];
        fx.splat(x, floor(x, z, A.y), z, 0, 1, 0, rnd(BLOW.size[0], BLOW.size[1]), { delay: 0.2 + along * 0.18, grow: 0.1, life: BLOW.life });
      }
      live = Math.max(live, BLOW.life + 10);
      if (o.mark === false) return true;
    }
    // the way the blow went: from the hitter to them, and across, the way the fist travelled (the hitter's +x)
    let [fx0, fz0] = B ? [A.x - B.x, A.z - B.z] : [-Math.sin(A.ry), -Math.cos(A.ry)];
    const d = Math.hypot(fx0, fz0) || 1;
    [fx0, fz0] = [fx0 / d, fz0 / d];
    const yaw = B ? B.w.yawS ?? B.ry : A.ry + Math.PI;
    const [cx, cz] = clip === 'scuffle_pair' ? [0, 0] : [Math.cos(yaw), -Math.sin(yaw)];
    let [dx, dz] = [fx0 + cx * 0.8, fz0 + cz * 0.8];
    const dl = Math.hypot(dx, dz) || 1;
    [dx, dz] = [dx / dl, dz / dl];
    // off the side of the face the fist hit: the cheek on the hitter's −x side (the head is the figures' big one)
    const H = actors.headOf(victimId);
    const fy = A.y + H.y0 + (H.y1 - H.y0) * 0.25;
    const [ox, oz] = [A.x - cx * H.hw * 0.7 - fx0 * faceAt(H) * 0.8, A.z - cz * H.hw * 0.7 - fz0 * faceAt(H) * 0.8];
    fx.shed(ox, fy, oz, dx * 3.2, 1.1, dz * 3.2, BLOW.drops);
    // (where they come down, on the ground as it is drawn there: small splats, a beat after, that dry away)
    const n = BLOW.splats[0] + Math.floor(Math.random() * (BLOW.splats[1] - BLOW.splats[0] + 1));
    for (let k = 0; k < n; k++) {
      const [along, side] = [rnd(BLOW.reach[0], BLOW.reach[1]), rnd(-0.3, 0.3)];
      const [x, z] = [ox + dx * along - dz * side, oz + dz * along + dx * side];
      fx.splat(x, floor(x, z, A.y), z, 0, 1, 0, rnd(BLOW.size[0], BLOW.size[1]), { delay: 0.2 + along * 0.18, grow: 0.1, life: BLOW.life });
    }
    // the mark on the cheek the fist hit (theirs: the hitter's −x side is their +x), on the face as it is drawn
    const F = fists.get(victimId) ?? fistOf(cx || cz ? 1 : 0);
    F.t = 0;
    mark(F, A);
    fists.set(victimId, F);
    live = Math.max(live, BLOW.life + 10);
    return true;
  }
  /** What a fist's blood keeps on somebody: the marks on their face, the pool under them, the drip after a fight. */
  const fistOf = side => ({ marks: [], pool: [], down: false, lie: 0, up: 0, t: 0, side, drip: null });
  /**
   * A cheek mark on the face as it is drawn (blood-1: faces below), up to three, each a little across and up from the
   * last. While they lie it stays where it is, on the face: it is drawn on the head wherever the head is.
   */
  function mark(F, A) {
    if (F.marks.length >= 3) return;
    const k = F.marks.length;
    const m = faces.add(A.id, F.side, k);
    if (m) F.marks.push(m);
  }
  /** (anim-1) The mark on the cheek of somebody standing who took it in a fight that is over, and its drip (DRIP). */
  function cheek(id) {
    const A = actors.all().find(a => a.id === id);
    if (!A || A.w.hide) return false;
    const F = fists.get(id) ?? fistOf(1);
    F.t = 0;
    mark(F, A);
    // (the drip, from the newest mark: DRIP.at seconds of the stage's clock from now)
    if (F.marks.length) F.drip = { t: 0, next: 0, m: F.marks[F.marks.length - 1] };
    fists.set(id, F);
    live = Math.max(live, BLOW.life + 10);
    return true;
  }
  /** (blood-1, for the tools) The drip's drops lately: whose, when (s after their fight was over), where it started. */
  const dripped = [];
  function drip(id, A, F) {
    const D = F.drip;
    const at = faces.at(F.drip.m, [0, DRIP.from]);
    if (!at) return;
    const [x, y, z] = at;
    // (the city's own drop, straight down off the face; and where it comes down, a spot on the ground as it is drawn,
    // laid as the drop gets there)
    fx.shed(x, y, z, 0, -0.05, 0, 1);
    const gy = floor(x, z, A.y);
    const fall = Math.sqrt((2 * Math.max(0.05, y - gy)) / 13);
    fx.splat(x, gy, z, 0, 1, 0, rnd(DRIP.spot[0], DRIP.spot[1]), { delay: fall, grow: 0.08, life: BLOW.life });
    dripped.push({ id, t: +D.t.toFixed(2), at: at.map(v => +v.toFixed(3)) });
    if (dripped.length > 64) dripped.shift();
  }
  /** (anim-1) A small pool on the ground at a place (under the head of one who stays down); → { dry() }. */
  function pool(x, y, z) {
    const r = note(fx.splat(x, floor(x, z, y), z, 0, 1, 0, BLOW.pool, { life: BLOOD.poolLife, grow: 1.6, color: BLOOD.pool }));
    live = Math.max(live, BLOOD.poolLife + 10);
    return { dry: () => dry(r) };
  }
  /** (anim-1) Every splat riding a body now: whose, what, and where it is in the world. */
  function riding() {
    const out = [];
    const at = (id, kind, r) => {
      if (!ours(r) || r.rider.gone) return;
      const a = -(r.rider.h + (r.rider.yawOff || 0));
      const [c, sn] = [Math.cos(a), Math.sin(a)];
      // (the city's own placing of a splat on what it rides: its place, turned by its heading; gorefx.js place)
      out.push({ id, kind, x: +(r.rider.x + r.s.lx * c - r.s.lz * sn).toFixed(3), y: +r.s.ly.toFixed(3), z: +(r.rider.z + r.s.lx * sn + r.s.lz * c).toFixed(3) });
    };
    // (a mark on a face: its middle in the body's own frame, `rest`, and where the head as drawn has it now)
    for (const [id, F] of fists) {
      for (const m of F.marks) {
        const p = faces.at(m, [0, 0]);
        if (p) out.push({ id, kind: 'cheek', rest: m.mid.map(v => +v.toFixed(4)), x: +p[0].toFixed(3), y: +p[1].toFixed(3), z: +p[2].toFixed(3) });
      }
    }
    for (const [id, W] of wounds) for (const r of W.body) at(id, 'wound', r);
    return out;
  }
  /** Their fist's blood goes with them: the mark off the face, the pool dried. */
  function endFist(id) {
    const F = fists.get(id);
    if (!F) return;
    for (const m of F.marks) faces.remove(m);
    for (const r of F.pool) dry(r);
    fists.delete(id);
  }

  /** The wound goes with them; what is on the ground dries. */
  function end(id) {
    const W = wounds.get(id);
    if (!W) return;
    W.rider.gone = true;
    if (W.laid) W.laid.gone = true;
    for (const r of W.ground) dry(r);
    wounds.delete(id);
  }

  actors.onFrame(dt => {
    if (!wounds.size && !fists.size && live <= 0) return;
    live -= dt;
    for (const [id, F] of fists) {
      const A = actors.all().find(a => a.id === id);
      if (!A || A.w.hide) {
        endFist(id);
        continue;
      }
      F.t += dt;
      const lying = DOWN.has(A.clipName);
      F.lie = lying ? F.lie + dt : 0;
      F.up = lying ? 0 : F.up + dt;
      // (down: the mark stays on the face, wherever the head as drawn is; it no longer has to come off)
      if (lying && !F.down) F.down = true;
      // THE DRIP: a drop at each of DRIP.at, while they are on their feet (a face on the ground drips on the ground)
      if (F.drip) {
        F.drip.t += dt;
        while (F.drip && F.drip.next < DRIP.at.length && F.drip.t >= DRIP.at[F.drip.next]) {
          F.drip.next += 1;
          if (!lying && F.drip.t <= DRIP.secs) drip(id, A, F);
        }
        if (F.drip.next >= DRIP.at.length || F.drip.t > DRIP.secs) F.drip = null;
      }
      if (F.down && F.lie >= BLOW.stay && !F.pool.length) {
        // DOWN AND STAYING DOWN: a small pool under the head (on their back, behind where the feet were)
        const [bx, bz] = [-Math.sin(A.ry), -Math.cos(A.ry)];
        const [x, z] = [A.x + bx * BLOW.head, A.z + bz * BLOW.head];
        F.pool.push(note(fx.splat(x, floor(x, z, A.y), z, 0, 1, 0, BLOW.pool, { life: BLOOD.poolLife, grow: 1.6, color: BLOOD.pool })));
      }
      if (F.down && F.up > 0.6) {
        // up again: the pool dries (the mark has stayed on the face)
        F.down = false;
        for (const r of F.pool) dry(r);
        F.pool = [];
      }
      if (F.down) for (const r of F.pool) keep(r);
      // (a minute on, the mark is off the face; nothing more to carry)
      else if (F.t >= BLOW.markLife && !F.pool.length) endFist(id);
      live = Math.max(live, BLOOD.dry + 1);
    }
    for (const [id, W] of wounds) {
      const A = actors.all().find(a => a.id === id);
      W.t += dt;
      const lying = !!A && !A.w.hide && DOWN.has(A.clipName);
      // (a blend between two clips of the fall is not "up")
      W.up = lying ? 0 : W.up + dt;
      if (!A || A.w.hide || (W.down && W.up > 0.6) || (!W.down && W.t > 6)) {
        end(id);
        continue;
      }
      [W.rider.x, W.rider.z] = [A.x, A.z];
      if (lying && !W.down) {
        // DOWN: the standing wound goes, and it is on the body where it lies: on its back, its chest behind where
        // its feet were. The city's pool spreads from under it, after the fall has landed
        W.down = true;
        W.rider.gone = true;
        const [bx, bz] = [-Math.sin(A.ry), -Math.cos(A.ry)];
        const [cx, cz] = [A.x + bx * LAID.back, A.z + bz * LAID.back];
        W.laid = { x: cx, z: cz, h: 0, yawOff: 0, gone: false, feet: [A.x, A.z] };
        const late = A.clipName === 'lie_hurt' ? 0 : 0.9;
        W.due = W.t + late;
        // (the city's pool, fx.pool, with its own figures: laid by hand only for the height it lies at)
        const gy = floor(cx, cz, A.y);
        W.ground.push(note(fx.splat(cx, gy, cz, 0, 1, 0, 1.5, { life: BLOOD.poolLife, grow: 4.5, delay: late + 0.3, color: BLOOD.pool })));
        W.ground.push(note(fx.splat(cx + bz * 0.35, gy, cz - bx * 0.35, 0, 1, 0, 0.6, { delay: late, grow: 0.3 })));
        W.ground.push(note(fx.splat(cx - bz * 0.3 + bx * 0.3, gy, cz + bx * 0.3 + bz * 0.3, 0, 1, 0, 0.45, { delay: late + 0.2, grow: 0.3 })));
      }
      if (W.due !== null && W.t >= W.due) {
        // (on the chest once the body has landed: a splat laid on a body still falling would hang in the air)
        W.due = null;
        W.body.push(note(fx.carSplat(W.laid, 0, floor(W.laid.x, W.laid.z, A.y) + LAID.top, 0, 0, 1, 0, 0.5), W.laid));
      }
      if (W.down) {
        // (moved while lying: a clip that ends a step away hands the step to the walker. The wound stays on them)
        [W.laid.x, W.laid.z] = [W.laid.x + A.x - W.laid.feet[0], W.laid.z + A.z - W.laid.feet[1]];
        W.laid.feet = [A.x, A.z];
        for (const r of [...W.body, ...W.ground]) keep(r);
      }
    }
    fx.update(dt, city.camera);
  });

  return {
    hit,
    blow,
    cheek,
    pool,
    riding,
    /** (blood-1, for the tools) The drip's drops lately: { id, t (s after their fight was over), at (where it started) }. */
    dripped: () => dripped.slice(),
    end,
    clear() {
      for (const id of [...wounds.keys()]) end(id);
      for (const id of [...fists.keys()]) endFist(id);
      fx.clear();
    },
    stats: () => ({ ...fx.stats(), wounds: wounds.size, down: [...wounds.values()].filter(W => W.down).length, fists: fists.size, fistsDown: [...fists.values()].filter(F => F.down).length, faceMarks: faces.count(), dripping: [...fists.values()].filter(F => F.drip).length }),
  };
}

/**
 * MARKS ON FACES AS THEY ARE DRAWN (blood-1, see the head of this file). A mark is a few cells laid on the face's own
 * surface in the body's own frame (actors.headDrawn's `rest`: the head, hair and hat as the bake has them, by
 * triangle) and drawn by the walk's own vertex shader (walk2.js installAnim2), tagged as the head with the very tag
 * the face under it has, from its walker's own texels (writeGait2 of its gait) and under its instance matrix in the
 * near batch: so it is posed exactly as the head is, every frame, at any size; not drawn while the head is not.
 *   add(id, side, k) → a mark (laid the first frame the head is drawn near) · remove(m) · at(m, [i, j]) → where a
 *   point of the mark (cells from its middle) is in the world now, as the GPU poses it (one small read back: the
 *   drip's drops and the tools) · count()
 */
function createFaces(city, actors, WALK, FADE, BLOOD) {
  const THREE = city.THREE;
  const uniOf = () => city.peds.anim.uni;
  const marks = new Set();
  const col = new THREE.Color();
  const pick = list => list[Math.floor(Math.random() * list.length)];

  /** The frontmost face of the head (a triangle facing forward) over (x, y) in the body's own frame: { z, part, gx, gy } or null. */
  function surface(R, x, y) {
    const P = R.P;
    let best = null;
    for (let t = 0; t < P.length; t += 9) {
      if (R.N[t + 2] < 0.7) continue;
      const [ax, ay, bx, by, cx, cy] = [P[t], P[t + 1], P[t + 3], P[t + 4], P[t + 6], P[t + 7]];
      // (inside the triangle, as seen from the front)
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(d) < 1e-9) continue;
      const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
      const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
      if (l1 < -1e-6 || l2 < -1e-6 || 1 - l1 - l2 < -1e-6) continue;
      const z = l1 * P[t + 2] + l2 * P[t + 5] + (1 - l1 - l2) * P[t + 8];
      if (!best || z > best.z) best = { z, part: R.part[t / 3], gx: Math.min(ax, bx, cx), gy: Math.min(ay, by, cy) };
    }
    return best;
  }

  function build(m, H) {
    const R = H.rest;
    const P = R.P;
    if (!P.length) return false;
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (let k = 0; k < P.length; k += 3) [x0, x1, y0, y1] = [Math.min(x0, P[k]), Math.max(x1, P[k]), Math.min(y0, P[k + 1]), Math.max(y1, P[k + 1])];
    const hw = Math.max(-x0, x1);
    const C = FACE.cell;
    // (the old mark's place: on the cheek, a little across from the middle and a quarter up the head; each mark after
    // the first a little across and up from it)
    const want = [hw * (m.side * FACE.across - m.k * 0.15), y0 + (y1 - y0) * FACE.up + m.k * 0.06];
    const hit = surface(R, ...want);
    if (!hit) return false;
    // (on the face's own voxel grid, so each cell covers a voxel's face)
    const snap = (v, g) => g + Math.floor((v - g) / C) * C + C / 2;
    const [mx, my] = [snap(want[0], hit.gx), snap(want[1], hit.gy)];
    const mid = surface(R, mx, my) ?? hit;
    const [pos, nor, colr, part, idx] = [[], [], [], [], []];
    for (const [i, j] of CELLS) {
      const [x, y] = [mx + i * C, my + j * C];
      const s = surface(R, x, y);
      // (no face in front of it, or a face well off the mark's: left out)
      if (!s || Math.abs(s.z - mid.z) > FACE.deep) continue;
      const z = s.z + FACE.lift;
      const v = pos.length / 3;
      col.setHex(j < -1 ? BLOOD.colors[1] : pick(BLOOD.colors));
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        pos.push(x + (dx * C) / 2, y + (dy * C) / 2, z);
        nor.push(0, 0, 1);
        colr.push(col.r, col.g, col.b);
        part.push(s.part);
      }
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
    if (!idx.length) return false;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
    geo.setIndex(idx);
    const U = uniOf();
    const tex = WALK.createAnimTexture2(1);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    WALK.installAnim2(mat, { uAnim: { value: tex }, uKeys2: U.uKeys2, uB0: U.uB0, uB1: U.uB1, uB2: U.uB2 });
    // (dissolved with the body when the camera's line to the player goes through it: camera/fade.js)
    FADE.installFade(mat, 'walker');
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `hk2:blood-face:${m.id}`;
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.visible = false;
    // (right before each draw: the head's matrix and texels as the near batch has them for this very frame)
    mesh.onBeforeRender = () => {
      const D = actors.headDrawn(m.id, mesh.matrixWorld);
      if (!D) return;
      WALK.writeGait2(tex.image.data, 1, 0, D.gait);
      tex.needsUpdate = true;
    };
    city.scene.add(mesh);
    Object.assign(m, { mesh, tex, R, part: mid.part, mid: [mx, my, mid.z + FACE.lift], cells: idx.length / 6 });
    return true;
  }

  // THE READ BACK: rest points of a mark posed by the same shader, written to a float target by vertex number.
  const RB = { mat: null, tex: null, rt: null, scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), M: new THREE.Matrix4() };
  function readBack(m, pts, given = null) {
    const D = given ?? actors.headDrawn(m.id, RB.M);
    if (given) RB.M.copy(given.matrix);
    if (!D) return null;
    ensureReadBack();
    WALK.writeGait2(RB.tex.image.data, 1, 0, D.gait);
    RB.tex.needsUpdate = true;
    const n = Math.min(16, pts.length);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.slice(0, n).flat(), 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(n).fill([0, 0, 1]).flat(), 3));
    geo.setAttribute('aPart', new THREE.Float32BufferAttribute(new Array(n).fill(m.part), 1));
    const dots = new THREE.Points(geo, RB.mat);
    dots.frustumCulled = false;
    dots.matrixAutoUpdate = false;
    dots.matrixWorldAutoUpdate = false;
    dots.matrixWorld.copy(RB.M);
    RB.scene.add(dots);
    const R = city.renderer;
    const before = R.getRenderTarget();
    const alpha = R.getClearAlpha();
    const px = new Float32Array(16 * 4);
    try {
      R.setRenderTarget(RB.rt);
      R.setClearAlpha(0);
      R.clear();
      R.render(RB.scene, RB.cam);
      R.readRenderTargetPixels(RB.rt, 0, 0, 16, 1, px);
    } finally {
      R.setRenderTarget(before);
      R.setClearAlpha(alpha);
      RB.scene.remove(dots);
      geo.dispose();
    }
    const out = [];
    for (let k = 0; k < n; k++) out.push(px[k * 4 + 3] > 0.5 ? [px[k * 4], px[k * 4 + 1], px[k * 4 + 2]] : null);
    return out;
  }
  function ensureReadBack() {
    if (!RB.mat) {
      RB.tex = WALK.createAnimTexture2(1);
      RB.mat = new THREE.ShaderMaterial({
        vertexShader: `#include <batching_pars_vertex>
varying vec3 vW; uniform float uN;
void main() {
#include <begin_vertex>
  vW = (modelMatrix * vec4(transformed, 1.)).xyz;
  gl_Position = vec4((float(gl_VertexID) + .5) / uN * 2. - 1., 0., 0., 1.);
  gl_PointSize = 1.;
}`,
        fragmentShader: 'varying vec3 vW; void main() { gl_FragColor = vec4(vW, 1.); }',
        uniforms: { uN: { value: 16 } },
      });
      const U = uniOf();
      WALK.installAnim2(RB.mat, { uAnim: { value: RB.tex }, uKeys2: U.uKeys2, uB0: U.uB0, uB1: U.uB1, uB2: U.uB2 });
      RB.rt = new THREE.WebGLRenderTarget(16, 1, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    }
  }

  // (both shaders compiled at the start, not at the end of a fight: a mark's, drawn for WARM frames in the very scene
  // and pass the marks are drawn in, a speck at the world's middle, and the read back's, made once on a dummy point.
  // Measured 2026-11-19: each compiled on its first use was a 0.4 to 0.5 s frame as a fight ended)
  const WARM = 3;
  let warmed = 0;
  const warm = { id: null, side: 0, k: 0, mesh: null };
  {
    const rest = { P: new Float32Array([-0.1, 1, 0.4, 0.1, 1, 0.4, 0, 1.2, 0.4, 0.1, 1, 0.4, 0.2, 1, 0.4, 0.1, 1.2, 0.4]), N: new Float32Array(18).map((v, k) => (k % 3 === 2 ? 1 : 0)), part: new Float32Array(6).fill(5) };
    if (uniOf() && build(warm, { rest })) {
      warm.mesh.visible = true;
      warm.mesh.matrixWorld.makeScale(1e-6, 1e-6, 1e-6);
    }
  }
  function warmUp() {
    warmed += 1;
    if (warmed === 1) {
      ensureReadBack();
      readBack({ id: null, part: 5 }, [[0, 0, 0]], { matrix: new THREE.Matrix4(), gait: { u: 0, a: 1, w: 0, v: 0, omega: 0, hp: 0, idle: -1, iw: 0, it: 0, look: 0, hr: 0, py: 0.5 } });
    }
    if (warmed === WARM && warm.mesh) {
      // (its material is kept: a program no material uses any more is let go by three, and compiled again)
      city.scene.remove(warm.mesh);
      warm.mesh.geometry.dispose();
      warm.mesh = null;
    }
  }

  actors.onFrame(() => {
    if (warmed < WARM) warmUp();
    for (const m of marks) {
      const D = actors.headDrawn(m.id, RB.M);
      if (D && !m.mesh) build(m, D);
      if (m.mesh) m.mesh.visible = !!D;
    }
  });

  return {
    add(id, side, k) {
      const m = { id, side, k, mesh: null, mid: null };
      marks.add(m);
      const D = actors.headDrawn(id, RB.M);
      if (D) build(m, D);
      return m;
    },
    remove(m) {
      marks.delete(m);
      if (!m.mesh) return;
      city.scene.remove(m.mesh);
      m.mesh.geometry.dispose();
      // (the material and its texels are let go; the warm mark's keeps the program)
      m.mesh.material.dispose();
      m.tex.dispose();
      m.mesh = null;
    },
    /** Where the point [i, j] cells from the mark's middle (on the face there) is in the world now; null if not drawn. */
    at(m, [i, j]) {
      if (!m.mesh) return null;
      const [x, y] = [m.mid[0] + i * FACE.cell, m.mid[1] + j * FACE.cell];
      const s = surface(m.R, x, y);
      return readBack(m, [[x, y, s && Math.abs(s.z + FACE.lift - m.mid[2]) <= FACE.deep ? s.z + FACE.lift : m.mid[2]]])?.[0] ?? null;
    },
    count: () => [...marks].filter(m => m.mesh?.visible).length,
  };
}
