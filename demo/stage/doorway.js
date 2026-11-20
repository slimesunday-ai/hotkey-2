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
//
// THE LEAVES SWING AWAY FROM WHOEVER WALKS THROUGH (notes-1, the owner 2026-11-19: "the door should swing out from the
// direction you are walking so it doesnt pass through your body"). Going out, the room's leaf opens out ahead of them
// and the trailer's is open out when the picture comes back; coming in, the trailer's opens in ahead of them and the
// room's is open in. A leaf shuts behind them only once its whole sweep is clear of their body (BODY: the figure's
// own footprint, its head the widest of it); one that cannot (they stop inside its sweep: the room's, where the
// player stands a step in on the door's line) stays open, and the room's goes from where it stands instead, as a
// cutaway's door does. Every frame a leaf is shown its box (and what is mounted on it) is measured against every body
// of ours near it: doorway.swept() says how near the nearest came and how many times one met a body (`through`).
//
//   doorway.swept() → { walks, nearest: { out, in } (m between the leaf and the body's edge), through, examples }

/** The city's own walking pace in a home (plan.js WALK is 1.1 m/s); a little brisker, the stage's hours being short. */
const WALK = 1.3;
/** A leaf swings fully in this many seconds (at 1×). */
const SWING = 0.45;
/** It opens as the walker comes this near its doorway (m), the room's own this near. */
const NEAR = 1.25;
const NEAR_IN = 0.95;
/** The picture starts going black this far short of the doorway (m): it is black as they reach it. */
const BLACK_AT = 0.5;
/**
 * A body as the leaves meet it, on the ground (m): a square about its feet, square to its heading, half this wide.
 * The figures' heads are the widest of them, 0.89 m square seen from straight over a standing player (measured
 * 2026-11-19, the hat's corners in a top-down picture from the game's camera); a leaf is 2.2 m tall, past every head.
 */
const BODY = 0.45;
/** A leaf shuts only with this much more between its sweep and the body (m). */
const CLEAR = 0.05;

/** The nearest a convex quad's points come to another's ([x, z] × 4 each), 0 when they meet. */
function quadGap(a, b) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const inQ = (p, Q) => {
    let s = 0;
    for (let k = 0; k < 4; k++) {
      const c = cross(Q[k], Q[(k + 1) % 4], p);
      if (Math.abs(c) < 1e-12) continue;
      if (s && Math.sign(c) !== s) return false;
      s = Math.sign(c);
    }
    return true;
  };
  const segD = (p, u, v) => {
    const [ex, ez] = [v[0] - u[0], v[1] - u[1]];
    const t = Math.max(0, Math.min(1, ((p[0] - u[0]) * ex + (p[1] - u[1]) * ez) / (ex * ex + ez * ez || 1)));
    return Math.hypot(p[0] - u[0] - ex * t, p[1] - u[1] - ez * t);
  };
  const meet = (p, q, r, s) => Math.sign(cross(p, q, r)) !== Math.sign(cross(p, q, s)) && Math.sign(cross(r, s, p)) !== Math.sign(cross(r, s, q));
  if (a.some(p => inQ(p, b)) || b.some(p => inQ(p, a))) return 0;
  let d = Infinity;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const [p, q, r, s] = [a[i], a[(i + 1) % 4], b[j], b[(j + 1) % 4]];
      if (meet(p, q, r, s)) return 0;
      d = Math.min(d, segD(p, r, s), segD(q, r, s), segD(r, p, q), segD(s, p, q));
    }
  }
  return d;
}

/** A body's footprint (BODY) at x, z facing ry. */
function bodyQuad(x, z, ry) {
  const [fx, fz] = [Math.sin(ry) * BODY, Math.cos(ry) * BODY];
  const [sx, sz] = [fz, -fx];
  return [[x + fx + sx, z + fz + sz], [x + fx - sx, z + fz - sz], [x - fx - sx, z - fz - sz], [x - fx + sx, z - fz + sz]];
}

export function createDoorway({ actors, inside, fade, rest = () => {} }) {
  const placeOf = key => inside?.place?.(key) ?? null;
  const doorOf = key => placeOf(key)?.door?.() ?? null;
  // the leaves swinging now: `${key}|out` or `${key}|in` → { key, side, k, want, way, alpha, who, done }
  const swinging = new Map();
  // the measure: the nearest a shown leaf came to a body's edge, by side; how many times one met a body
  const measure = { walks: 0, nearest: { out: null, in: null }, through: 0, examples: [], met: new Set() };
  /** Whether a leaf's whole sweep (its reach round its hinge) is clear of `id`'s body. */
  const clearOf = (key, side, id) => {
    const L = placeOf(key)?.leafAt?.(side);
    if (!L || !actors.has(id)) return true;
    const A = actors.get(id);
    if (Math.abs(A.y - L.y) > 1.5) return true;
    // (the body's nearest point to the hinge, in the body's own frame)
    const [dx, dz] = [L.hinge[0] - A.x, L.hinge[1] - A.z];
    const [s, c] = [Math.sin(A.ry), Math.cos(A.ry)];
    const [f, l] = [dx * s + dz * c, dx * c - dz * s];
    const off = Math.hypot(f - Math.max(-BODY, Math.min(BODY, f)), l - Math.max(-BODY, Math.min(BODY, l)));
    return off > L.reach + CLEAR;
  };
  actors.onFrame(dt => {
    for (const [name, d] of swinging) {
      // (their walk through it over: shut once its sweep is clear of them; the room's, if they stopped in its sweep,
      // goes from where it stands)
      if (d.done) {
        if (!d.who || clearOf(d.key, d.side, d.who)) d.want = 0;
        else if (d.side === 'in') d.alpha = Math.max(0, d.alpha - dt / SWING);
        if (!d.alpha) d.k = d.want = 0;
      }
      const step = dt / SWING;
      d.k = Math.max(0, Math.min(1, d.k + Math.max(-step, Math.min(step, d.want - d.k))));
      placeOf(d.key)?.leaf?.(d.side, d.k, { way: d.way, alpha: d.alpha });
      look(d);
      // (kept while a walk through it is under way: it is to open as they come)
      if (!d.k && !d.want && (!d.who || d.done)) swinging.delete(name);
    }
  });
  /** The measure, one frame of a shown leaf: against every body of ours on its floor. */
  function look(d) {
    const L = d.k > 0.001 ? placeOf(d.key)?.leafAt?.(d.side) : null;
    if (!L?.boxes) return;
    for (const A of actors.all()) {
      if (!A || A.w?.hide || Math.abs(A.y - L.y) > 1.5 || Math.hypot(A.x - L.hinge[0], A.z - L.hinge[1]) > 3) continue;
      const body = bodyQuad(A.x, A.z, A.ry);
      const gap = Math.min(...L.boxes.map(q => quadGap(q, body)));
      const n = measure.nearest[d.side];
      if (!n || gap < n.gap) measure.nearest[d.side] = { gap: +gap.toFixed(3), id: A.id, way: d.way, k: +d.k.toFixed(2) };
      const tag = `${d.key}|${d.side}|${A.id}|${d.walk ?? 0}`;
      if (gap <= 0 && !measure.met.has(tag)) {
        measure.met.add(tag);
        measure.through++;
        if (measure.examples.length < 8) measure.examples.push(`${A.id} met ${d.key}'s ${d.side === 'out' ? 'door' : 'room door'} swinging ${d.way}, open ${d.k.toFixed(2)}`);
      }
    }
  }
  const leaf = (key, side) => {
    const name = `${key}|${side}`;
    let d = swinging.get(name);
    if (!d) swinging.set(name, (d = { key, side, k: 0, want: 0, way: side === 'out' ? 'out' : 'in', alpha: 1, who: null, done: false }));
    return d;
  };
  /** A walk through a leaf begins: it swings `way` (from shut; one still open keeps its way), for `id`. */
  const through = (key, side, way, id) => {
    const d = leaf(key, side);
    if (d.k < 0.001) d.way = way;
    Object.assign(d, { who: id, done: false, alpha: 1, walk: ++measure.walks });
    return d;
  };
  /** A leaf at once (under black): open or shut, no swing; open, `way` and for `id`. */
  const set = (key, side, k, way = null, id = null) => {
    const d = leaf(key, side);
    if (way) Object.assign(d, { way, who: id, done: false, alpha: 1, walk: ++measure.walks });
    d.k = d.want = k;
    if (!k) Object.assign(d, { who: null, done: false, alpha: 1 });
    placeOf(key)?.leaf?.(side, k, { way: d.way, alpha: d.alpha });
  };
  /** Open as they come within NEAR of the doorway or while its sweep is not clear of them; and past it, shut. */
  const follow = (key, side, sill) => (x, z) => {
    const d = leaf(key, side);
    d.want = Math.hypot(x - sill[0], z - sill[2]) < (side === 'in' ? NEAR_IN : NEAR) || (d.who && !clearOf(key, side, d.who)) ? 1 : 0;
  };
  /** Their walk through it is over: it shuts once it can (the frame loop). */
  const done = (key, side) => {
    const d = swinging.get(`${key}|${side}`);
    if (d) d.done = true;
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
    /** The measure (above): the nearest a shown leaf came to a body's edge, and how many times one met a body. */
    swept: () => ({ walks: measure.walks, nearest: { ...measure.nearest }, through: measure.through, examples: measure.examples.slice() }),
    /**
     * For the tools: how far the door outside stands open (k) and the one inside (kIn), and which way (way, wayIn), how far a person is from the
     * doorway outside (m), and on which side of it (+ out, − in, m along the way it faces), and from the step.
     */
    info(key, id) {
      const D = doorOf(key);
      if (!D || !actors.has(id)) return null;
      const A = actors.get(id);
      const O = D.outside;
      const [dx, dz] = [A.x - O.sill[0], A.z - O.sill[2]];
      return {
        k: swinging.get(`${key}|out`)?.k ?? 0, kIn: swinging.get(`${key}|in`)?.k ?? 0, way: swinging.get(`${key}|out`)?.way ?? null, wayIn: swinging.get(`${key}|in`)?.way ?? null, d: Math.hypot(dx, dz), side: dx * O.face[0] + dz * O.face[1],
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
          // (the room's leaf swings out, ahead of them)
          through(key, 'in', 'out', id);
          const r = await walkToBlack(id, [...way, I.sill], key, 'in', I.sill);
          held = r.held;
          if (!r.ok || !live()) return false;
        } else {
          // (not in the inside view: whatever put them elsewhere, they go out of the door outside)
          await fade.out();
          held = true;
          if (!live()) return false;
        }
        // UNDER THE BLACK: let out (the director's), in the doorway outside with the door open out, as the room's was;
        // the view goes down
        shut();
        set(key, 'in', 0);
        set(key, 'out', 1, 'out', id);
        actors.place(id, O.sill[0], O.sill[2], yawOf(O.face), O.sill[1]);
        inside.door(id, key, 'out', { walking: true });
        await inside.ready();
        if (!live()) return false;
        // the picture back: out onto the stoop and the step, the door shutting behind them once it can
        held = false;
        fade.in();
        const ok = await actors.walkPath(id, [[O.stoop[0], O.stoop[1], O.stoop[2]], [O.step[0], null, O.step[1]]], { v: WALK, room: false, onStep: follow(key, 'out', O.sill) });
        inside.door(id, key, 'out', { walking: false });
        done(key, 'out');
        return ok && live();
      } finally {
        if (held) fade.in();
        done(key, 'in');
        done(key, 'out');
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
        // from the step: up onto the stoop, the door opening in as they come, into the doorway; black as they reach it
        through(key, 'out', 'in', id);
        const r = await walkToBlack(id, [[O.stoop[0], O.stoop[1], O.stoop[2]], [O.sill[0], O.sill[1], O.sill[2]]], key, 'out', O.sill);
        held = r.held;
        if (!r.ok || !live()) return false;
        // UNDER THE BLACK: in the doorway of the inside view, its leaf open in, as the trailer's was; the door outside
        // shut; let in (the director's: the view comes up round them)
        set(key, 'out', 0);
        set(key, 'in', 1, 'in', id);
        actors.place(id, I.sill[0], I.sill[2], I.ry, I.sill[1]);
        inside.door(id, key, null);
        await open();
        await inside.ready();
        if (!live()) return false;
        // the picture back: in, the leaf shutting behind them once it can, and across to their place
        held = false;
        fade.in();
        const S = P.spots('stand')[0];
        const way = S ? P.way([I.at[0], I.at[2]], [S.x, S.z]) : null;
        const ok = await actors.walkPath(id, [I.at, ...(way ?? (S ? [[S.x, S.y, S.z]] : [])).slice(way ? 1 : 0)], { v: WALK, room: true, yaw: S?.ry ?? null, onStep: follow(key, 'in', I.sill) });
        done(key, 'in');
        return ok && live();
      } finally {
        if (held) fade.in();
        done(key, 'in');
        done(key, 'out');
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
