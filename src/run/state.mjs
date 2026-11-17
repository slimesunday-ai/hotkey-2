// The run's state: plain JSON, no functions, no generator state. Every draw comes from rng(seed, purpose, day,
// hour...), so the same seed and the same choices always give the same game, and a saved game loads and goes on.

import { RUN_CONFIG } from './config.mjs';
import { fullSupply } from './rules.mjs';

// 2: today's people (a version-1 state reads as nobody dealt with yet). 3: the places' heat and supply, regulars,
// grudges, someone at the door, what you did at each place today (a version-2 state reads as all of it at rest).
// 4: trust, one number per person kept across nights (a version-3 state reads as everyone neutral; a grudge it holds
// runs out as it would have). 5: goods on you and at the crib, things owned and worn (a version-4 state reads as
// none of either, and nothing owned beyond the three things it had). 6: where you are on a route (`route`: a
// version-5 state reads as on none, at its place; the stops' supply reads as full). 7: home pressure (`home`: what
// you did at home still holding it up, an attempt due, the last one, the guard; a version-6 state reads as calm, nothing
// due, nobody on the step). 8: the guard is hired by the stretch (`home.guard.until`, the last day he is paid for; a
// version-7 state's guard, on by the day, reads as paid through the day it is)
export const RUN_STATE_VERSION = 8;

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
    today: {}, // place → { rob, bins, an item from its shop, `pack:good` from its connect: how many times today }
    goods: {}, // good → sales of it on you (config.mjs `goods`): at risk like cash on you
    stash: {}, // good → sales of it left at the crib: safe, like banked cash
    things: {}, // thing → true: the things to wear and for the trailer you own (config.mjs `things`), cosmetic only
    worn: {}, // slot → the thing you have on in it
    // on a route between two places (RUN.md, "Routes"): { id, from, to, way, stops, at, hand }, `place` then the stop
    // you are at, `at` its index in `stops` and `hand` the cards it dealt you still to play; null at a place
    route: null,
    // home pressure (RUN.md, "Home pressure"): `marks` [{ why, text, n, day, who }] what you did on the home's street
    // still holding the pressure up (oldest first, fading); `raid` the attempt you were warned of ({ who, day, hour,
    // warned, started: null | { at, by } }); `last` the day of the last attempt; `guard` { on, until: the last day of his
    // stretch, hurt: the last day he is off }; `raids` what happened at each one ({ day, who, how, outcome, taken })
    home: { marks: [], raid: null, last: null, guard: null, raids: [] },
    // every dollar: start + earned − jumped − seized − fares − spent − burgled = carried + banked (`burgled`: taken from
    // what was banked by an attempt on your crib). `street`, `door`, `goods` and
    // `things` are the parts of `spent` that went on the street (a drink, a sandwich), to a regular at your door, on
    // packs from a connect, and on things to wear or for the trailer.
    books: { start: cfg.start.cash, earned: 0, jumped: 0, seized: 0, fares: 0, spent: 0, street: 0, door: 0, goods: 0, things: 0, burgled: 0, guard: 0 },
  };
}

const copyMap = m => Object.fromEntries(Object.entries(m ?? {}).map(([k, v]) => [k, v && typeof v === 'object' ? { ...v } : v]));

/** A copy safe to change: the state is small, so each step works on its own copy and never touches its input. */
export function copyRun(state) {
  const out = { ...state, owned: { ...state.owned }, books: { street: 0, door: 0, goods: 0, things: 0, burgled: 0, guard: 0, ...state.books } };
  out.people = copyMap(state.people);
  out.shifts = { ...(state.shifts ?? {}) };
  out.placeHeat = { ...(state.placeHeat ?? {}) };
  out.supply = copyMap(state.supply);
  out.regulars = { ...(state.regulars ?? {}) };
  out.grudges = { ...(state.grudges ?? {}) };
  out.trust = { ...(state.trust ?? {}) };
  out.door = state.door ? { ...state.door } : null;
  out.today = copyMap(state.today);
  out.goods = { ...(state.goods ?? {}) };
  out.stash = { ...(state.stash ?? {}) };
  out.things = { ...(state.things ?? {}) };
  out.worn = { ...(state.worn ?? {}) };
  const h = state.home ?? {};
  out.home = { marks: (h.marks ?? []).map(m => ({ ...m })), raid: h.raid ? { ...h.raid, started: h.raid.started ? { ...h.raid.started } : null } : null,
    last: h.last ?? null, guard: h.guard ? { ...h.guard } : null, raids: (h.raids ?? []).map(r => ({ ...r })) };
  out.route = state.route ? { ...state.route, stops: [...state.route.stops], hand: [...state.route.hand] } : null;
  if (state.rig) out.rig = { rolls: [...(state.rig.rolls ?? [])], chances: [...(state.rig.chances ?? [])] };
  return out;
}
