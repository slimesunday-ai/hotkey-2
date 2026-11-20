// A STAGE BODY TAKEN IN HAND (anim-1): one of the stage's people posed by the page every frame for a fight. It is
// still the stage's actor and the city's walker: the rides' way of moving a body by hand (rides/kit.js own) places it,
// the stage's own clip slot plays the fight's body clip on it (clip.js: asked for as any clip is, so it blends in from
// the stand and out to it, and the stage's own rules for switching clips hold), and the pose goes to the shader
// through the clip's texture. Two things the city would add on top are held off a body in hand, since the fight keys
// them itself: the heading's own easing (a planted foot needs the heading exact, this frame) and the head's springs
// and its lead into a turn (walk2.js adds them after any clip).
//
//   const puppets = createPuppets({ actors, kit, city })
//   const B = puppets.take(actorId)        → { set(x, y, z, yaw, pose), walk(x, y, z, yaw, v), release(), slot, ready }
//     set    stand the body there this frame, in this pose (rig.js); the clip is put on by the stage and blends in
//     walk   move it as a walker instead (its own legs, the city's gait at v m/s): the clip is let go
//     release  handed back to the stage standing where it is
import { takeSlot, freeSlot, writeSlot, clipName } from './clip.js';
import { pose0 } from './rig.js';

const HELD = new WeakSet();
let wrapped = null;

export function createPuppets({ actors, kit, city }) {
  // (the city's gait step, once: a body in hand has no head springs and no lead into a turn of the city's)
  const sim = city.peds?.sim;
  if (sim && wrapped !== sim) {
    wrapped = sim;
    const animate0 = sim.animate;
    sim.animate = (w, dt, G, fresh) => {
      const g = animate0(w, dt, G, fresh);
      if (g && HELD.has(w)) {
        g.hp = 0;
        g.hv = 0;
        g.hr = 0;
        g.hrv = 0;
        g.omega = 0;
      }
      return g;
    };
  }
  const live = new Map();

  function take(id) {
    const old = live.get(id);
    if (old) return old;
    const slot = takeSlot();
    if (slot === null) throw new Error('fight: no body slot left');
    const A = actors.get(id);
    // (taken as it is DRAWN: the heading it is told may be one it has not turned to yet, and the rides' taking of a
    // body sets the drawn heading to the told one at once: a quarter turn in one frame, measured 2026-11-18)
    if (A.w?.yawS !== undefined) A.ry = A.w.yawS;
    const body = kit.own(id);
    const name = clipName(slot);
    let want = null;
    let posed = false;
    writeSlot(slot, pose0());
    const B = {
      id, slot, name,
      /** Is the clip on the body at full weight (the stage has blended it in)? */
      get ready() {
        return A.clipName === name && (A.clipW ?? 0) > 0.98;
      },
      get weight() {
        return A.clipName === name ? A.clipW ?? 0 : 0;
      },
      set(x, y, z, yaw, P) {
        writeSlot(slot, P);
        if (!posed) {
          posed = true;
          HELD.add(A.w);
          want = { name, loop: true, t: 0, after: 0, began: actors.clock, walk: true };
          A.want = want;
        } else if (A.want !== want && A.want?.name !== name) A.want = want;
        place(x, y, z, yaw, 0);
      },
      walk(x, y, z, yaw, v) {
        if (posed) {
          posed = false;
          HELD.delete(A.w);
          if (A.want === want) A.want = null;
        }
        place(x, y, z, yaw, v, true);
      },
      /** The clip let go (it blends out to the stand); the body stays in hand. */
      loose() {
        if (!posed) return;
        posed = false;
        HELD.delete(A.w);
        if (A.want === want) A.want = null;
      },
      release(standY = null) {
        if (live.get(id) !== B) return;
        live.delete(id);
        HELD.delete(A.w);
        freeSlot(slot);
        if (A.want === want) A.want = null;
        kit.owned?.get(id)?.release(standY);
      },
    };
    /** There, this frame: the place and the heading as drawn, not eased toward. */
    function place(x, y, z, yaw, v, eased = false) {
      body.put(x, y, z, yaw, v);
      const w = A.w;
      A.x = x;
      A.y = y;
      A.z = z;
      A.ry = yaw;
      w.fix[0] = w.p[0] = x;
      w.fix[1] = w.p[1] = y;
      w.fix[2] = w.p[2] = z;
      w.fix[3] = w.p[3] = yaw;
      if (!eased) {
        w.yawS = yaw;
        w.omega = 0;
      }
    }
    live.set(id, B);
    return B;
  }
  return { take, live };
}
