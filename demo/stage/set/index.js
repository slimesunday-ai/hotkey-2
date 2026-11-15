// What the stage adds to the REAL city: nothing you can touch. The rooms you can see into (the ten pads: trailers of
// Sunny Acres, opened with the city's own home cutaway) and the time of day. Loaded by demo/stage/index.js.
//
// NO BUILDINGS, PROPS OR STAND-INS (the owner, 2026-11-12: "the city is already built we just need to wire our game
// into it"). The 3×3 set's dressing (a precinct pen, a clinic tent, market tables, a pocket park, a loading kerb, our
// own lamps) is gone from this branch: git history has it. The jail and the clinic are open air at the real places
// (Iron Island's yard, St. Mercy's forecourt): the director keeps people there on the city's own spots and seats.
//
//   await startSet(city)                     once, after the city is up
//   rooms.anchor(id) → [x, y, z, ry]         where a pad's tenant stands, or null (no such pad, or its block is not
//                                            built: the park is not loaded). id is a pad's key ('pad:a3': padOf)
//   rooms.show(id, on)                       opens the pad so a camera from above sees in. Pads share the city's ONE
//                                            cutaway: the pad asked for last is the open one
//   rooms.view(id) → { pos, tgt, fov }       a camera that sees into the pad from above its open side
//   rooms.plan(id) · rooms.door(id, k)       its way in and out (the city's plan.js) and its front door's leaf
//   padOf(agentId) → the key of that agent's pad
//   insides.keys() · insides.place(key)      the pads' inside views (set/crib.js, demo/stage/inside.js): the player's
//                                            own pad is seen inside one, never cut open where it stands
//   useStarter({ pad, owned })               the run's own pad from the starter pack (set/starter.js), showing what
//                                            the run owns
//   setClock({ day, hour })                  the time of day (the game runs 12:00 to 23:00)
//
// For night in one page load, the page must also call prelight() before the city starts: see prelight.js.
import { createLight } from './light.js';
import { createPads } from './pads.js';
import { PADS } from '../citymap.js';

let ready = null;
let light = null;
let pads = null;

export function startSet(city) {
  ready ??= (async () => {
    light = await createLight(city).catch(err => {
      console.warn('[set] the time of day did not load:', err);
      return null;
    });
    pads = await createPads(city, PADS).catch(err => {
      console.warn('[set] the pads\' rooms did not load:', err);
      return null;
    });
    return { light, pads };
  })();
  return ready;
}

export const rooms = {
  anchor(id) {
    return pads?.has(id) ? pads.anchor(id) : null;
  },
  leave() {},
  show(id, on) {
    if (!pads?.has(id)) return null;
    // by night the open pad gets one lamp, under its (missing) ceiling
    return pads.show(id, on).then(() => {
      const at = pads.open ? pads.anchor(pads.open) : null;
      light?.setExtra(at ? [at[0], at[1] + 2.4, at[2]] : null);
    });
  },
  view(id) {
    if (!pads?.has(id)) return null;
    const at = pads.anchor(id);
    if (!at) return null;
    // from over the ground the home faces, looking down into it
    const [x, y, z, ry] = at;
    return { pos: [x + Math.sin(ry) * 9, y + 13, z + Math.cos(ry) * 9], tgt: [x - Math.sin(ry) * 1.2, y + 0.6, z - Math.cos(ry) * 1.2], fov: 40 };
  },
  /** The pad's way in and out, the city's own (pads.js plan: the step, the doorway, the room's grid, its bed), or null. */
  plan: id => (pads?.has(id) ? pads.plan(id) : null),
  /** The pad's front door open by k (0 shut … 1 open). */
  door(id, k) {
    if (pads?.has(id)) pads.door(id, k);
  },
  /** How many people a room has a place for. */
  capacity: id => (pads?.has(id) ? 1 : 0),
};

export const padOf = id => `pad:${id}`;

/**
 * THE PADS' INSIDE VIEWS (set/crib.js: demo/stage/inside.js's contract): `keys()` the pads' keys, `place(key)` the
 * place for one (it answers null until its block is built). Nothing before the set has loaded.
 */
export const insides = {
  keys: () => pads?.cribs?.keys() ?? [],
  place: key => pads?.cribs?.place(key) ?? null,
};
/**
 * THE RUN'S CRIB (set/starter.js): the pad `pad` is built from the starter pack, showing what `owned()` says is owned
 * ({ bed, … }: the run's state). Nothing calls it but the run, so every other mode keeps the pads' presets.
 */
export function useStarter({ pad, owned }) {
  if (!pads?.starter) return false;
  pads.starter.use({ pad, owned });
  return true;
}
/** For the tools: which arrangement the starter builds ('a' or 'b'), or null. */
export const starterVariant = () => pads?.starter?.variant ?? null;
/** The inside view's lamps by night, [[x, y, z] …], the only ones lit while it is up (light.js setInside); null takes them away. */
export const setInsideLamp = points => light?.setInside(points);

/** The time of day. Returns { night: 0 … 1, build: 'day' | 'night', lamps: whether the street lamps light the street }. */
export function setClock(clock) {
  return light ? light.setClock(clock) : null;
}

/** The key lamps by night (light.js setKeys): [[x, y, z], …] over whoever the picture is about. */
export const setKeys = points => light?.setKeys(points);
/** Night as a number now, 0 … 1 (0 when the time of day did not load). */
export const nightNow = () => light?.night ?? 0;

/** For looking at it: night as a number, 0 … 1. */
export const setNight = k => light?.setNight(k);
