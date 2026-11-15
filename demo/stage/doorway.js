// THE DOOR OF A PLACE WITH AN INSIDE, WALKED (the player's own pad first: set/crib.js). The owner, 2026-11-13: "it
// just cuts to him outside, he doesnt actaully open the door and walk out" · "the door in and out exit is pretty
// janky ... yeah let's go seperate inside view".
//
// IN: from the step outside, up to the real door; it opens; into the doorway, and the picture goes through black
// (travel.js fade) as they reach it. Under the black they stand in the doorway of the inside view (inside.js: the
// view follows their body), its leaf open; the picture comes back and they walk in to their place, the leaf swinging
// shut behind them. OUT is the reverse: across the room to its door, black, and they are in the doorway outside with
// the door open, step out onto the stoop and the step, and it shuts behind them. The camera is at the door outside
// for the outside half (inside.js shot: a low shot from in front of it), and nothing of the building fades or is cut.
//
//   const doorway = createDoorway({ actors, inside, fade, rest })   rest(id): their own routine stops (director.rest)
//   doorway.has(key) · doorway.step(key) → [x, z]           the place has a door to walk; its step outside
//   doorway.anchor(key) → [x, y, z, ry, true]                where its tenant stands inside (the director's enter())
//   doorway.view(key, on) → Promise                          the director's open() for it: resolves once the view
//                                                            matches where the lead stands
//   await doorway.out(id, key, { shut, alive })              across the room to its door, black, `shut()` (the director
//                                                            lets them out), out of the doorway and onto the step
//   await doorway.in(id, key, { open, alive })               from the step: in at the door, black, `open()` (the
//                                                            director lets them in), and to their place inside
//   await doorway.bed(id, key, { alive })                    across the room to the bed, and lie down on it
// Each → true when walked to its end; false when something else took them (a skip, a settle: they are put where the
// hour leaves them, the doors are shut, and the black is let go).

/** The city's own walking pace in a home (plan.js WALK is 1.1 m/s); a little brisker, the stage's hours being short. */
const WALK = 1.3;
/** A leaf swings fully in this many seconds (at 1×). */
const SWING = 0.45;
/** It is open while the walker is this near its doorway (m), and shuts behind them past it. */
const NEAR = 1.25;
const NEAR_IN = 0.95;
/** The picture starts going black this far short of the doorway (m): it is black as they reach it. */
const BLACK_AT = 0.5;

export function createDoorway({ actors, inside, fade, rest = () => {} }) {
  const placeOf = key => inside?.place?.(key) ?? null;
  const doorOf = key => placeOf(key)?.door?.() ?? null;
  // the leaves swinging now: `${key}|out` or `${key}|in` → { key, side, k, want }
  const swinging = new Map();
  actors.onFrame(dt => {
    for (const [name, d] of swinging) {
      const step = dt / SWING;
      d.k = Math.max(0, Math.min(1, d.k + Math.max(-step, Math.min(step, d.want - d.k))));
      placeOf(d.key)?.leaf?.(d.side, d.k);
      if (!d.k && !d.want) swinging.delete(name);
    }
  });
  const leaf = (key, side) => {
    const name = `${key}|${side}`;
    let d = swinging.get(name);
    if (!d) swinging.set(name, (d = { key, side, k: 0, want: 0 }));
    return d;
  };
  /** A leaf at once (under black): open or shut, no swing. */
  const set = (key, side, k) => {
    const d = leaf(key, side);
    d.k = d.want = k;
    placeOf(key)?.leaf?.(side, k);
  };
  /** Opens as they come within NEAR of the doorway, shuts behind them past it (the room's own, past NEAR_IN). */
  const follow = (key, side, sill) => (x, z) => {
    leaf(key, side).want = Math.hypot(x - sill[0], z - sill[2]) < (side === 'in' ? NEAR_IN : NEAR) ? 1 : 0;
  };
  const dist = (x, z, p) => Math.hypot(x - p[0], z - p[2]);
  const yawOf = ([fx, fz]) => Math.atan2(fx, fz);

  /**
   * A walk to a doorway that goes black as it gets there: `fading` is the fade's promise once it has started (the
   * caller holds the black until it lets it go).
   */
  async function walkToBlack(id, points, key, side, sill) {
    const hold = { fading: null };
    const swing = follow(key, side, sill);
    const ok = await actors.walkPath(id, points, {
      v: WALK, room: true,
      onStep: (x, z) => {
        swing(x, z);
        if (!hold.fading && dist(x, z, sill) < BLACK_AT) hold.fading = fade.out();
      },
    });
    hold.fading ??= ok ? fade.out() : null;
    if (hold.fading) await hold.fading;
    return { ok, held: !!hold.fading };
  }

  return {
    has: key => !!doorOf(key),
    step: key => doorOf(key)?.outside.step ?? null,
    anchor(key) {
      const S = placeOf(key)?.spots?.('stand')?.[0];
      return S ? [S.x, S.y, S.z, S.ry, true] : null;
    },
    view: () => inside.ready(),
    /**
     * For the tools: how far the door outside stands open (k) and the one inside (kIn), how far a person is from the
     * doorway outside (m), and on which side of it (+ out, − in, m along the way it faces), and from the step.
     */
    info(key, id) {
      const D = doorOf(key);
      if (!D || !actors.has(id)) return null;
      const A = actors.get(id);
      const O = D.outside;
      const [dx, dz] = [A.x - O.sill[0], A.z - O.sill[2]];
      return {
        k: swinging.get(`${key}|out`)?.k ?? 0, kIn: swinging.get(`${key}|in`)?.k ?? 0, d: Math.hypot(dx, dz), side: dx * O.face[0] + dz * O.face[1],
        step: Math.hypot(A.x - O.step[0], A.z - O.step[1]), inside: inside.up === key, dIn: dist(A.x, A.z, D.inside.sill),
      };
    },

    async out(id, key, { shut = () => {}, alive = () => true } = {}) {
      const P = placeOf(key);
      const D = P?.door?.();
      if (!D || !actors.has(id)) return false;
      const A = actors.get(id);
      const [I, O] = [D.inside, D.outside];
      const live = () => alive() && actors.has(id);
      let held = false;
      try {
        // across the room to its door (in the inside view), black as they reach it
        if (inside.holds(key, A.x, A.y, A.z)) {
          const way = P.way([A.x, A.z], [I.at[0], I.at[2]]) ?? [I.at];
          const r = await walkToBlack(id, [...way, I.sill], key, 'in', I.sill);
          held = r.held;
          if (!r.ok || !live()) return false;
        } else {
          // (not in the inside view: whatever put them elsewhere, they go out of the door outside)
          await fade.out();
          held = true;
          if (!live()) return false;
        }
        // UNDER THE BLACK: let out (the director's), in the doorway outside with the door open; the view goes down
        shut();
        set(key, 'in', 0);
        set(key, 'out', 1);
        actors.place(id, O.sill[0], O.sill[2], yawOf(O.face), O.sill[1]);
        inside.door(id, key, 'out', { walking: true });
        await inside.ready();
        if (!live()) return false;
        // the picture back: out onto the stoop and the step, the door shutting behind them
        held = false;
        fade.in();
        const ok = await actors.walkPath(id, [[O.stoop[0], O.stoop[1], O.stoop[2]], [O.step[0], null, O.step[1]]], { v: WALK, room: false, onStep: follow(key, 'out', O.sill) });
        inside.door(id, key, 'out', { walking: false });
        leaf(key, 'out').want = 0;
        return ok && live();
      } finally {
        if (held) fade.in();
        // (cut short: the doors shut at once, nobody is left in a doorway with one open)
        if (!live() || !alive()) {
          set(key, 'in', 0);
          set(key, 'out', 0);
          inside.door(id, key, null);
        }
      }
    },

    async in(id, key, { open = () => {}, alive = () => true } = {}) {
      const P = placeOf(key);
      const D = P?.door?.();
      if (!D || !actors.has(id)) return false;
      const [I, O] = [D.inside, D.outside];
      const live = () => alive() && actors.has(id);
      let held = false;
      inside.door(id, key, 'in');
      try {
        // from the step: up onto the stoop, the door opening as they come, into the doorway; black as they reach it
        const r = await walkToBlack(id, [[O.stoop[0], O.stoop[1], O.stoop[2]], [O.sill[0], O.sill[1], O.sill[2]]], key, 'out', O.sill);
        held = r.held;
        if (!r.ok || !live()) return false;
        // UNDER THE BLACK: in the doorway of the inside view, its leaf open, the door outside shut; let in (the
        // director's: the view comes up round them)
        set(key, 'out', 0);
        set(key, 'in', 1);
        actors.place(id, I.sill[0], I.sill[2], I.ry, I.sill[1]);
        inside.door(id, key, null);
        await open();
        await inside.ready();
        if (!live()) return false;
        // the picture back: in, the leaf shutting behind them, and across to their place
        held = false;
        fade.in();
        const S = P.spots('stand')[0];
        const way = S ? P.way([I.at[0], I.at[2]], [S.x, S.z]) : null;
        const ok = await actors.walkPath(id, [I.at, ...(way ?? (S ? [[S.x, S.y, S.z]] : [])).slice(way ? 1 : 0)], { v: WALK, room: true, yaw: S?.ry ?? null, onStep: follow(key, 'in', I.sill) });
        leaf(key, 'in').want = 0;
        return ok && live();
      } finally {
        if (held) fade.in();
        inside.door(id, key, null);
        if (!live() || !alive()) {
          set(key, 'in', 0);
          set(key, 'out', 0);
        }
      }
    },

    async bed(id, key, { alive = () => true } = {}) {
      const P = placeOf(key);
      const B = P?.spots?.('bed')?.[0];
      if (!B || !actors.has(id)) return false;
      // (nothing of their own goes on while they go to bed and lie there: a look round stood them up on it)
      rest(id);
      const A = actors.get(id);
      const way = B.stand ? P.way([A.x, A.z], B.stand) : null;
      if (way?.length && !(await actors.walkPath(id, way, { v: WALK, room: true }))) return false;
      if (!alive()) return false;
      // (onto the bed, as the city lays its sleepers: the sleep clip from where the feet are, facing the bed's foot)
      actors.place(id, B.x, B.z, B.ry, B.y);
      await actors.play(id, B.clip, { loop: true, hold: 0.1 });
      return alive();
    },
  };
}
