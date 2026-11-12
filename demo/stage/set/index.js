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
//   padOf(agentId) → the key of that agent's pad
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
  /** How many people a room has a place for. */
  capacity: id => (pads?.has(id) ? 1 : 0),
};

export const padOf = id => `pad:${id}`;

/** The time of day. Returns { night: 0 … 1, build: 'day' | 'night', lamps: whether the street lamps light the street }. */
export function setClock(clock) {
  return light ? light.setClock(clock) : null;
}

/** For looking at it: night as a number, 0 … 1. */
export const setNight = k => light?.setNight(k);
