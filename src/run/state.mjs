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
// version-7 state's guard, on by the day, reads as paid through the day it is). 9: people remember (memory-1: `marks`,
// id → the mark a person holds of you for a week; `visits`, who is still to come to your door, the earliest due first;
// a version-8 state reads as nobody marked and nobody coming: save.mjs loadRun reads one). 10: styles-1, the punch
// styles you have learned (`styles`, style → true) and what you fight with (`fightWith`: null, unset: the box cutter if
// you own it, else bare hands); a version-9 (or 8) state reads as none learned and unset (save.mjs loadRun)
// 11: sixes-1, the first slice: the Sixes' meter (`sixes`: what you did on their ground still holding it up, the day
// of the last, Dutch's word, what you made there today, the tax waiting, the two waiting by the steps), how Cousin Earl
// is told to fight (`earlWay`: null, unset: config guard.way), the dog's unfed mornings (`home.dog`), and the dog's food
// and the tax in the books (`books.dog`, `books.sixes`); a version-10 state reads as none of it (save.mjs loadRun)
// 12: raid-1, the raid on your home: the rounds you own for each gun (`ammo`, gun → rounds), what you hold at your door
// when the Sixes come (`holdWith`: null, unset: the first gun you own with rounds, else what you fight with), in the
// Sixes' state the push (`streak`, `streakDay`: the days in a row they have taxed you), the raid warned of (`raid`), the
// raids so far (`raids`), the truce after one held (`truce`, its last day) and the night of the last (`raidLast`), and
// the rounds in the books (`books.ammo`), and in `home` the pieces a raid knocked out (`home.out`: piece → its last day
// out, made when needed); a version-11 state reads as none of it (save.mjs loadRun)
export const RUN_STATE_VERSION = 12;

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
    door: null, // { id, name, place, wants }: a regular at your door this morning (memory-1: or `due`, somebody come for another go)
    // (memory-1, RUN.md "People remember") id → { kind, day, place, who, warned }: the mark a person holds of you, a
    // week from `day`; and the visits still to come to your door, one a morning, the earliest due first:
    // [{ kind: 'due' | 'regular', id, name, role, place, due, wants }]
    marks: {},
    visits: [],
    today: {}, // place → { rob, bins, an item from its shop, `pack:good` from its connect: how many times today }
    goods: {}, // good → sales of it on you (config.mjs `goods`): at risk like cash on you
    stash: {}, // good → sales of it left at the crib: safe, like banked cash
    things: {}, // thing → true: the things to wear and for the trailer you own (config.mjs `things`), cosmetic only
    worn: {}, // slot → the thing you have on in it
    // (styles-1) the punch styles learned (config `styles`: style → true), and what you fight with, one-on-one and
    // jumped ('hands', 'cutter' or a style you know; null: the box cutter if you own it, else bare hands)
    styles: {},
    fightWith: null,
    // (sixes-1) the Sixes' meter on the run (rules.mjs sixesStateOf: marks [{ why, text, n, day }], did, word, made,
    // madeDay, taxDay, tax, jump, jumps), and how Earl is told to fight at your door (null: config guard.way)
    sixes: { marks: [], did: null, word: null, made: 0, madeDay: null, taxDay: null, tax: null, jump: null, jumps: [], streak: 0, streakDay: null, raid: null, raids: [], truce: null, raidLast: null },
    earlWay: null,
    // (raid-1) the rounds you own for each gun, and what you hold at your door when the Sixes come (null: rules raid.mjs holdOf)
    ammo: {},
    holdWith: null,
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
    books: { start: cfg.start.cash, earned: 0, jumped: 0, seized: 0, fares: 0, spent: 0, street: 0, door: 0, goods: 0, things: 0, burgled: 0, guard: 0, lessons: 0, dog: 0, sixes: 0, ammo: 0 },
  };
}

const copyMap = m => Object.fromEntries(Object.entries(m ?? {}).map(([k, v]) => [k, v && typeof v === 'object' ? { ...v } : v]));

/** A copy safe to change: the state is small, so each step works on its own copy and never touches its input. */
export function copyRun(state) {
  const out = { ...state, owned: { ...state.owned }, books: { street: 0, door: 0, goods: 0, things: 0, burgled: 0, guard: 0, lessons: 0, dog: 0, sixes: 0, ammo: 0, ...state.books } };
  out.people = copyMap(state.people);
  out.shifts = { ...(state.shifts ?? {}) };
  out.placeHeat = { ...(state.placeHeat ?? {}) };
  out.supply = copyMap(state.supply);
  out.regulars = { ...(state.regulars ?? {}) };
  out.grudges = { ...(state.grudges ?? {}) };
  out.trust = { ...(state.trust ?? {}) };
  out.door = state.door ? { ...state.door } : null;
  out.marks = Object.fromEntries(Object.entries(state.marks ?? {}).map(([k, m]) => [k, { ...m, who: { ...m.who } }]));
  out.visits = (state.visits ?? []).map(x => ({ ...x }));
  out.today = copyMap(state.today);
  out.goods = { ...(state.goods ?? {}) };
  out.stash = { ...(state.stash ?? {}) };
  out.things = { ...(state.things ?? {}) };
  out.worn = { ...(state.worn ?? {}) };
  out.styles = { ...(state.styles ?? {}) };
  out.fightWith = state.fightWith ?? null;
  const sx = state.sixes ?? {};
  out.sixes = { marks: (sx.marks ?? []).map(m => ({ ...m })), did: sx.did ?? null, word: sx.word ?? null, made: sx.made ?? 0, madeDay: sx.madeDay ?? null, taxDay: sx.taxDay ?? null,
    tax: sx.tax ? { ...sx.tax } : null, jump: sx.jump ? { ...sx.jump } : null, jumps: (sx.jumps ?? []).map(j => ({ ...j })),
    streak: sx.streak ?? 0, streakDay: sx.streakDay ?? null, raid: sx.raid ? { ...sx.raid } : null, raids: (sx.raids ?? []).map(r => ({ ...r })), truce: sx.truce ?? null, raidLast: sx.raidLast ?? null };
  out.earlWay = state.earlWay ?? null;
  out.ammo = { ...(state.ammo ?? {}) };
  out.holdWith = state.holdWith ?? null;
  const h = state.home ?? {};
  out.home = { marks: (h.marks ?? []).map(m => ({ ...m })), raid: h.raid ? { ...h.raid, started: h.raid.started ? { ...h.raid.started } : null } : null,
    last: h.last ?? null, guard: h.guard ? { ...h.guard } : null, raids: (h.raids ?? []).map(r => ({ ...r })), ...(h.dog ? { dog: { ...h.dog } } : {}), ...(h.out ? { out: { ...h.out } } : {}) };
  out.route = state.route ? { ...state.route, stops: [...state.route.stops], hand: [...state.route.hand] } : null;
  if (state.rig) out.rig = { rolls: [...(state.rig.rolls ?? [])], chances: [...(state.rig.chances ?? [])] };
  return out;
}
