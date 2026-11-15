// The run's state: plain JSON, no functions, no generator state. Every draw comes from rng(seed, purpose, day,
// hour...), so the same seed and the same choices always give the same game, and a saved game loads and goes on.

import { RUN_CONFIG } from './config.mjs';
import { fullSupply } from './rules.mjs';

// 2: today's people (a version-1 state reads as nobody dealt with yet). 3: the places' heat and supply, regulars,
// grudges, someone at the door, what you did at each place today (a version-2 state reads as all of it at rest).
// 4: trust, one number per person kept across nights (a version-3 state reads as everyone neutral; a grudge it holds
// runs out as it would have)
export const RUN_STATE_VERSION = 4;

export function newRun({ seed = 1, cfg = RUN_CONFIG } = {}) {
  return {
    v: RUN_STATE_VERSION,
    seed,
    day: 1,
    hour: cfg.start.hour,
    place: cfg.start.place, // the crib, a place in the city, the clinic or the jail
    energy: cfg.energy.mattress,
    heat: 0, // your own heat: what follows you (rules.mjs heatHere adds the place's)
    carried: 0,
    banked: cfg.start.cash,
    owned: { pocket: false, cutter: false, bed: false },
    hoursThere: 0, // hours already spent this trip at a place with jumpers
    doneDay: null, // the day the last of the three things was bought
    // today's dealings, cleared every morning: id → { mood, out, job } for whoever you dealt with today, and how many
    // safe jobs you have done at each place today (whose turn the safe one is)
    people: {},
    shifts: Object.fromEntries(Object.keys(cfg.jobs).map(id => [id, 0])),
    // the city's own, not the player's: each place's heat, and what it has left to use up today
    placeHeat: {},
    supply: fullSupply(cfg),
    regulars: {}, // id → how many times you have sold to them (kept across days)
    grudges: {}, // id → the last day they hold it (a version-3 save's; since trust, a grudge is a person against you)
    trust: {}, // id → their trust in you, min to max (config.mjs `trust`); anyone missing is at 0, neutral
    door: null, // { id, name, place, wants }: a regular at your door this morning
    today: {}, // place → { rob, bins, an item from its shop: how many times today }
    // every dollar: start + earned − jumped − seized − fares − spent = carried + banked. `street` and `door` are the
    // parts of `spent` that went on the street (a drink) and to a regular at your door.
    books: { start: cfg.start.cash, earned: 0, jumped: 0, seized: 0, fares: 0, spent: 0, street: 0, door: 0 },
  };
}

const copyMap = m => Object.fromEntries(Object.entries(m ?? {}).map(([k, v]) => [k, v && typeof v === 'object' ? { ...v } : v]));

/** A copy safe to change: the state is small, so each step works on its own copy and never touches its input. */
export function copyRun(state) {
  const out = { ...state, owned: { ...state.owned }, books: { street: 0, door: 0, ...state.books } };
  out.people = copyMap(state.people);
  out.shifts = { ...(state.shifts ?? {}) };
  out.placeHeat = { ...(state.placeHeat ?? {}) };
  out.supply = copyMap(state.supply);
  out.regulars = { ...(state.regulars ?? {}) };
  out.grudges = { ...(state.grudges ?? {}) };
  out.trust = { ...(state.trust ?? {}) };
  out.door = state.door ? { ...state.door } : null;
  out.today = copyMap(state.today);
  if (state.rig) out.rig = { rolls: [...(state.rig.rolls ?? [])], chances: [...(state.rig.chances ?? [])] };
  return out;
}
