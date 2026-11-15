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
//   gore.stats()                      what is on stage now (for the tools)
//
// `?blood=0` (or the city's own `?gore=0`) leaves it out.

/** The clips of a body going down or lying (the city's falls: anim/cast/clips/falls.js). */
const DOWN = new Set(['fall_back', 'shove_fall', 'lie_hurt', 'lie_still', 'death_collapse']);
/** Where the chest is over the feet of a standing body, and how far in front of the body's middle its surface is (m). */
const CHEST = 1.0;
const FRONT = 0.27;
/** A body on its back (fall_back's end, lie_hurt): its chest is this far behind where the feet were, and this high. */
const LAID = { back: 0.5, top: 0.62 };

export async function createGore({ city, CITY, actors }) {
  const FX = await import(`${CITY}stage/gorefx.js`);
  const fx = FX.createGoreFx(city.scene, {});
  const BLOOD = FX.BLOOD;
  const wounds = new Map();
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
    if (!wounds.size && live <= 0) return;
    live -= dt;
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
    end,
    clear() {
      for (const id of [...wounds.keys()]) end(id);
      fx.clear();
    },
    stats: () => ({ ...fx.stats(), wounds: wounds.size, down: [...wounds.values()].filter(W => W.down).length }),
  };
}
