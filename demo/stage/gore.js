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
//   gore.blow(victimId, hitterId, clip)  a fist landed (punch, haymaker, scuffle_pair: BLOWS), see below
//   gore.stats()                      what is on stage now (for the tools)
//
// A FIST THAT LANDS (the owner, 2026-11-16: "a little blood splatter when a punch lands"): the same blood, smaller,
// and ONLY WHERE THE SCENE ASKS FOR IT: a step with `blood: true` (director.js tells 'blow' at the clip's contact
// moment, BLOWS below; no other step bleeds, so no scene that is played now changes):
//   at the blow      a few drops off the side of the face the fist hit, thrown the way the blow went (the city's
//                    own drops: fx.shed, no mist), and a few small splats where they come down, on the ground as it
//                    is drawn there, which dry away (BLOW.dry)
//   on the face      a small mark on the cheek, riding the body as it reels and turns, kept while they are there; it
//                    goes when they leave (hidden, taken off, gone), as a shot's wound does
//   down and staying down   (lying, LAID seconds and more) a small pool under the head, which dries when they are
//                    up or gone. Down for a moment and up again is no pool. While they lie the cheek mark is off
//                    the face (a lying head is not where a standing one was) and is back on it when they are up

/** The clips of a body going down or lying (the city's falls: anim/cast/clips/falls.js). */
const DOWN = new Set(['fall_back', 'shove_fall', 'lie_hurt', 'lie_still', 'death_collapse']);
/** Where the chest is over the feet of a standing body, and how far in front of the body's middle its surface is (m). */
const CHEST = 1.0;
const FRONT = 0.27;
/** A body on its back (fall_back's end, lie_hurt): its chest is this far behind where the feet were, and this high. */
const LAID = { back: 0.5, top: 0.62 };
/**
 * WHERE THE FACE IS: the front of a head as it is drawn is this many times headOf's half depth ahead of the body's
 * middle (headOf's box is the bake's; measured on Mrs. Alvarez at the trailer park, 2026-11-16: a mark laid at her
 * half depth was inside her head, at twice it on her cheek), and the cheek a quarter of the way up the head.
 */
const FACE = 2;
/** The clip clock (s) at which each blow lands: the clips' own notes (anim/cast/clips/game-port.js, arrest.js). */
export const BLOWS = Object.freeze({ punch: 0.22, haymaker: 0.08, scuffle_pair: 0.25 });
/**
 * A fist's blood, smaller than a shot's: drops thrown off the face, splats where they come down (their size, how many,
 * how far, how long they stay before drying), the cheek mark's size, and the pool when they stay down (after `stay`
 * seconds lying, its size; it is laid this far behind where the feet were, under the head of a body on its back).
 */
const BLOW = { drops: 9, splats: [4, 6], size: [0.12, 0.24], reach: [0.35, 1.5], life: 30, mark: 0.24, markLife: 60, stay: 2.5, pool: 0.75, head: 1.0 };

export async function createGore({ city, CITY, actors }) {
  const FX = await import(`${CITY}stage/gorefx.js`);
  const fx = FX.createGoreFx(city.scene, {});
  const BLOOD = FX.BLOOD;
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

  function hit(victimId, shooterId) {
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
  function blow(victimId, hitterId, clip = 'punch') {
    const A = actors.all().find(a => a.id === victimId);
    const B = actors.all().find(a => a.id === hitterId);
    if (!A || A.w.hide) return false;
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
    const [ox, oz] = [A.x - cx * H.hw * 0.7 - fx0 * H.hd * FACE * 0.8, A.z - cz * H.hw * 0.7 - fz0 * H.hd * FACE * 0.8];
    fx.shed(ox, fy, oz, dx * 3.2, 1.1, dz * 3.2, BLOW.drops);
    // (where they come down, on the ground as it is drawn there: small splats, a beat after, that dry away)
    const n = BLOW.splats[0] + Math.floor(Math.random() * (BLOW.splats[1] - BLOW.splats[0] + 1));
    for (let k = 0; k < n; k++) {
      const [along, side] = [rnd(BLOW.reach[0], BLOW.reach[1]), rnd(-0.3, 0.3)];
      const [x, z] = [ox + dx * along - dz * side, oz + dz * along + dx * side];
      fx.splat(x, floor(x, z, A.y), z, 0, 1, 0, rnd(BLOW.size[0], BLOW.size[1]), { delay: 0.2 + along * 0.18, grow: 0.1, life: BLOW.life });
    }
    // the mark on the cheek the fist hit (theirs: the hitter's −x side is their +x), riding the body and turned with
    // it (the city's car splat: a place and a heading)
    const F = fists.get(victimId) ?? { rider: null, marks: [], pool: [], down: false, lie: 0, up: 0, t: 0, side: cx || cz ? 1 : 0, fy: fy - A.y };
    F.t = 0;
    if (!F.down) mark(F, A);
    fists.set(victimId, F);
    live = Math.max(live, BLOW.life + 10);
    return true;
  }
  /** A cheek mark on a standing body, on the rider that carries it (a new rider once the last was let go). */
  function mark(F, A) {
    if (F.marks.length >= 3) return;
    const H = actors.headOf(A.id);
    if (!F.rider || F.rider.gone) F.rider = { x: A.x, z: A.z, h: A.w.yawS ?? A.ry, yawOff: 0, gone: false };
    const k = F.marks.length;
    F.marks.push(note(fx.carSplat(F.rider, H.hw * (F.side * 0.25 - k * 0.15), A.y + F.fy + k * 0.06, H.hd * FACE + 0.01, 0, 0, 1, BLOW.mark * (1 - k * 0.15)), F.rider));
  }
  /** Their fist's blood goes with them: the mark off the face, the pool dried. */
  function endFist(id) {
    const F = fists.get(id);
    if (!F) return;
    if (F.rider) F.rider.gone = true;
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
      if (F.rider) [F.rider.x, F.rider.z, F.rider.h] = [A.x, A.z, A.w.yawS ?? A.ry];
      if (lying && !F.down) {
        // (down: the cheek mark is off the face, a lying head is not where a standing one was)
        F.down = true;
        if (F.rider) F.rider.gone = true;
        F.marks = [];
      }
      if (F.down && F.lie >= BLOW.stay && !F.pool.length) {
        // DOWN AND STAYING DOWN: a small pool under the head (on their back, behind where the feet were)
        const [bx, bz] = [-Math.sin(A.ry), -Math.cos(A.ry)];
        const [x, z] = [A.x + bx * BLOW.head, A.z + bz * BLOW.head];
        F.pool.push(note(fx.splat(x, floor(x, z, A.y), z, 0, 1, 0, BLOW.pool, { life: BLOOD.poolLife, grow: 1.6, color: BLOOD.pool })));
      }
      if (F.down && F.up > 0.6) {
        // up again: the pool dries, and the mark is on the face again
        F.down = false;
        for (const r of F.pool) dry(r);
        F.pool = [];
        mark(F, A);
      }
      if (F.down) for (const r of F.pool) keep(r);
      else if (F.t < BLOW.markLife) for (const r of F.marks) keep(r);
      // (a minute on, the mark is let dry where they stand; nothing more to carry)
      else if (!F.pool.length) endFist(id);
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
    end,
    clear() {
      for (const id of [...wounds.keys()]) end(id);
      for (const id of [...fists.keys()]) endFist(id);
      fx.clear();
    },
    stats: () => ({ ...fx.stats(), wounds: wounds.size, down: [...wounds.values()].filter(W => W.down).length, fists: fists.size, fistsDown: [...fists.values()].filter(F => F.down).length }),
  };
}
