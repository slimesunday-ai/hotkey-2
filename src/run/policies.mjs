// Simple scripted players for measuring the marks (scripts/run-marks.mjs). Each reads only the view (and the state
// it can see), picks one of its choices, and the real engine plays it. A policy:
//   where: 'park' (the trailer park only) or 'market'
//   crime: take the dealt option with the best expected pay (false: always the safe one); with the box cutter,
//          robbing somebody passing counts among them, weighed by the heat it leaves when it works
//   heatMax: skip an option whose failure (a robbery: whose success) would push the heat here above this
//   stopAt: head home when carrying this much (Infinity: only when spent)
//   heatHome: head home, and don't go out to the market, when the heat on you there is this or more
//   minOut: go to the market only with this much energy (the ride there, an hour's work, the ride back)
//   spentAt: at the market, this energy or less is spent: head home (1, as the first test's rule had it)
//   buy: buy the three things, in order, whenever they can be afforded
//   marketOnce: { cutter: true } goes to the market only once that thing is owned (the park before it)
//   mixed: when the market is too hot (or there is too little energy for it), work the trailer park instead of
//          sleeping, and after banking a trip, work the park with what energy is left
//   drink: at the market, spent, buy the day's energy drink if it leaves the fare, and work one more hour
//   rough: at the market, spent, stay: work to nothing and sleep rough there
//   bins: dig the bins wherever the safe job would have been taken
//   robPlan: { place: n } rob somebody passing up to n times a day there: at the market on the way out, in the park
//          before riding out (otherwise a crime policy with the cutter robs once a day as its last act at a place:
//          the park's last hour, or the market's way out if even a failure leaves no police stop on the ride)
//   regular: 'lean' sells to a regular whenever dealt; 'avoid' never does (otherwise: by expected pay like anyone)
//   door: 'refuse' always shuts the door on a regular; otherwise give when it can be paid
//   trust: how it plays people's trust (RUN.md, "Trust"); otherwise it ignores trust, as every policy before it did:
//     'neighbour' (the good neighbour): for the first buildDays days only work that wins trust (the safe job, sales);
//       then any option, but never one done where someone against you is about to tell, never one that could turn its
//       person against you, and always to the target who trusts you most (with you: more pay); robs only unwatched
//     'burner': takes the best-paying option it is dealt and ignores trust (refuses a regular at the door)
//     'farm': odd jobs in the trailer park for farmDays days (trust built for nothing), then plays as the burner
// Options go away as the day's people are worked (RUN.md, "People"); the safe one is always dealt first, so a policy
// picks from whatever is left and, with a place worked dry, takes the safe one (test/run-people.test.mjs).

import { view } from './view.mjs';
import { step } from './step.mjs';
import { newRun } from './state.mjs';
import { fullEnergy, heatHere, doneToday, ITEMS } from './rules.mjs';

const NEVER = Infinity;
const homeAt = stopAt => ({ where: 'market', crime: true, heatMax: 2, stopAt, heatHome: 3 });
const mixed = stopAt => ({ ...homeAt(stopAt), mixed: true });
export const POLICIES = Object.freeze({
  park: { where: 'park', crime: true, heatMax: 2 },
  stall: { where: 'market', crime: false, stopAt: NEVER, heatHome: 9 },
  homeAt,
  reckless: { where: 'market', crime: true, heatMax: 9, stopAt: NEVER, heatHome: 9 },
  mixed,
  // trust (RUN.md, "Trust"): both places, home at $X, as `mixed`; only how they treat people differs
  neighbour: stopAt => ({ ...mixed(stopAt), trust: 'neighbour', buildDays: 2 }),
  burner: stopAt => ({ ...mixed(stopAt), trust: 'burner', door: 'refuse' }),
  farm: stopAt => ({ ...mixed(stopAt), trust: 'farm', farmDays: 3, door: 'refuse' }),
});

const ev = o => (o.odds / 100) * ((o.pay[0] + o.pay[1]) / 2);
const regularOf = (v, o) => !!o.who && !!v.people.find(p => p.id === o.who.id)?.regular;

/** The good neighbour's line: what it will do to a person, on a given day (policies above, `trust: 'neighbour'`). */
function neighbourly(cfg, o, day, policy) {
  if (o.safe || !o.trust) return true;
  if (day <= (policy.buildDays ?? 0)) return o.trust.ifWin > 0; // building: only work that wins trust
  if (o.tellRisk?.pct) return false; // someone against you is about to tell
  const best = Math.max(...(o.targets ?? [o.who]).map(t => t?.trust ?? 0));
  return best + Math.min(o.trust.ifWin, o.trust.ifFail) > cfg.trust.against; // never turn anyone against you
}

/** The choice for an option: the dealt person, or, for the good neighbour, the target who trusts you most. */
function choiceOf(o, policy) {
  if (policy.trust !== 'neighbour' || (o.targets ?? []).length < 2) return o.choice;
  const best = o.targets.reduce((a, b) => ((b.trust ?? 0) > (a.trust ?? 0) ? b : a));
  return best.id === o.who?.id ? o.choice : { ...o.choice, who: best.id };
}

function bestJob(v, policy, heat, { rob: robHere = true, cfg = null, state = null } = {}) {
  let opts = v.options.filter(o => o.available);
  if (policy.regular === 'avoid') opts = opts.filter(o => !regularOf(v, o));
  if (policy.regular === 'lean') {
    const reg = opts.find(o => regularOf(v, o));
    if (reg) return reg.choice;
  }
  const kind = policy.trust === 'neighbour' && cfg && state;
  if (kind) opts = opts.filter(o => neighbourly(cfg, o, state.day, policy));
  let pick = opts[0];
  if (policy.crime) for (const o of opts) if (ev(o) > ev(pick) && heat + o.failHeat <= policy.heatMax) pick = o;
  let rob = robHere && policy.crime && !policy.robPlan ? v.moves.find(m => m.what === 'rob' && m.available) : null;
  if (rob && kind && (rob.tellRisk?.pct || state.day <= (policy.buildDays ?? 0))) rob = null;
  if (rob && (!pick || ev(rob) > ev(pick)) && heat + rob.winHeat <= policy.heatMax) return rob.choice;
  if (policy.bins && pick?.safe) {
    const bins = v.moves.find(m => m.what === 'bins' && m.available);
    if (bins) return bins.choice;
  }
  return pick ? choiceOf(pick, policy) : v.moves.find(m => m.what === 'bins' && m.available)?.choice ?? { do: 'inside' };
}

/** A robbery the policy's plan still wants here today (never with a police stop already on this hour). */
function planned(v, state, policy) {
  const n = policy.robPlan?.[state.place] ?? 0;
  if (!n || doneToday(state, state.place, 'rob') >= n) return null;
  if (v.danger.here && v.danger.thisHour.stop.chance > 0) return null;
  return v.moves.find(m => m.what === 'rob' && m.available)?.choice ?? null;
}

/**
 * A robbery as the last thing done at a place (the heat it leaves costs nothing more today): the plan's (robPlan), or,
 * for a crime policy, one a day there. `last` says how you leave: 'inside' (no hour, nothing rolls) or 'ride' (the
 * leaving hour rolls the police: only if even a failure leaves no stop on it).
 */
function robNow(cfg, v, state, policy, last) {
  const rob = v.moves.find(m => m.what === 'rob' && m.available);
  if (!rob) return null;
  if (policy.robPlan) return planned(v, state, policy);
  if (!policy.crime || doneToday(state, state.place, 'rob')) return null;
  if (v.places.find(p => p.here)?.heat) return null; // only where the place is cool (heat carries into tomorrow)
  if (policy.trust === 'neighbour' && (rob.tellRisk?.pct || state.day <= (policy.buildDays ?? 0))) return null; // unwatched only
  if (last === 'ride' && v.heat + rob.failHeat >= cfg.police.from) return null;
  return rob.choice;
}

/** The policy's next choice from what the view shows. */
export function decide(cfg, state, given, v = view(cfg, state)) {
  // the farmer: odd jobs in the trailer park for its first days, then the burner
  const policy = given.trust === 'farm' && state.day <= (given.farmDays ?? 0) ? { ...given, where: 'park', crime: false, mixed: false } : given;
  const fare = cfg.subway.fare;
  const where = policy.marketOnce && !Object.keys(policy.marketOnce).every(k => state.owned[k]) ? 'park' : policy.where;
  const marketHeat = heatHere(cfg, state, 'market');
  const goMarket = where === 'market' && state.energy >= (policy.minOut ?? 3) && marketHeat < policy.heatHome;
  const parkHere = where === 'park' || (policy.mixed && !goMarket);
  const hour = cfg.energy.perHour;
  switch (state.place) {
    case 'clinic':
    case 'jail':
      return { do: 'morning' };
    case 'crib': {
      if (state.door) return policy.door !== 'refuse' && state.banked >= state.door.wants ? { do: 'give' } : { do: 'refuse' };
      if (policy.buy) for (const item of ITEMS) if (v.shop.find(s => s.item === item).available) return { do: 'buy', item };
      if (goMarket) return { do: 'out', take: Math.min(fare, state.banked) };
      if (parkHere && state.energy >= hour) return { do: 'out', take: 0 };
      return { do: 'sleep' };
    }
    case 'park': {
      // police about with heat on you here: bank what you carry first (going inside costs no hour)
      if (parkHere && state.carried > 0 && v.danger.here && v.danger.thisHour.stop.chance > 0) return { do: 'inside' };
      if (parkHere) {
        if (state.energy < hour) return { do: 'inside' };
        // the last hour here (then inside, where nothing rolls): a robbery, if you have the cutter
        if (state.energy === hour && !policy.robPlan) return robNow(cfg, v, state, policy, 'inside') ?? bestJob(v, policy, v.heat, { rob: false, cfg, state });
        return (policy.robPlan ? planned(v, state, policy) : null) ?? bestJob(v, policy, v.heat, { rob: false, cfg, state });
      }
      if (policy.parkFirst && goMarket && state.energy > (policy.minOut ?? 3)) {
        // both places' people: the park's crimes first (nobody jumps you here), then the market
        const c = bestJob(v, policy, v.heat, { rob: false, cfg, state });
        if (c.do === 'job' && !v.options.find(o => o.id === c.id)?.safe) return c;
      }
      if (!goMarket || state.carried > fare) return { do: 'inside' }; // bank what you brought home first
      return (policy.robPlan ? planned(v, state, policy) : null) ?? { do: 'subway', to: 'market', hop: state.carried < fare };
    }
    case 'market': {
      const spent = state.energy <= (policy.spentAt ?? 1);
      if (spent && policy.rough) return state.energy >= hour ? bestJob(v, policy, v.heat, { cfg, state }) : { do: 'rough' };
      if (spent && policy.drink) {
        const drink = v.moves.find(m => m.what === 'shop' && m.available && m.item === 'drink');
        if (drink && state.carried >= drink.price + fare) return drink.choice;
      }
      if (state.energy < hour) return v.moves.find(m => m.choice.do === 'shop' && m.available)?.choice ?? { do: 'rough' };
      if (spent || state.carried >= policy.stopAt || v.heat >= policy.heatHome) {
        // on the way out (an energy left for the ride): a robbery, the last thing done here
        const rob = state.energy > hour ? robNow(cfg, v, state, policy, 'ride') : null;
        return rob ?? { do: 'subway', to: 'park', hop: state.carried < fare };
      }
      return bestJob(v, policy, v.heat, { rob: policy.heatMax >= cfg.heat.max, cfg, state }); // (heat-blind robs by expected pay)
    }
    default:
      throw new Error(`no policy for ${state.place}`);
  }
}

/**
 * Play `days` days of one seed with one policy and one kit (things owned from the start, free). Returns the money
 * banked each day (what came home, less fares, before anything bought at the crib; a drink or what a regular at the
 * door was given counts against it), the troubles, and the end state.
 */
export function playSeason(cfg, { seed, policy, kit = {}, days = 6, until = null, maxDays = 60 }) {
  let state = newRun({ seed, cfg });
  state.owned = { ...state.owned, ...kit };
  state.energy = fullEnergy(cfg, state);
  const takes = [];
  const tally = { jumped: 0, bad: 0, scuffle: 0, stopped: 0, earned: 0, lost: 0, trips: 0, robbed: 0, rough: 0, door: 0, fights: 0, robs: 0, bins: 0, drinks: 0 };
  const kept = s => s.banked + s.books.spent - (s.books.street ?? 0) - (s.books.door ?? 0);
  let dayStart = kept(state);
  let steps = 0;
  const last = until ? maxDays : days;
  while (state.day <= last && !(until && until(state))) {
    const { state: next, events } = step(cfg, state, decide(cfg, state, policy));
    for (const e of events) {
      if (e.type === 'jumped') {
        tally.jumped += 1;
        if (e.outcome === 'clean') tally.bad += 1;
        if (e.outcome === 'messy') tally.scuffle += 1;
      }
      if (e.type === 'stopped') tally.stopped += 1;
      if (e.type === 'ride' && e.place === 'market') tally.trips += 1;
      if (e.type === 'robbed') tally.robbed += 1;
      if (e.type === 'rough') tally.rough += 1;
      if (e.type === 'door') tally.door += 1;
      if (e.type === 'fight') tally.fights += 1;
      if (e.type === 'rob') tally.robs += 1;
      if (e.type === 'bins') tally.bins += 1;
      if (e.type === 'shop') tally.drinks += 1;
    }
    if (next.day !== state.day) {
      const now = kept(next);
      takes.push(now - dayStart);
      dayStart = now;
      steps = 0;
    }
    state = next;
    if (++steps > 500) throw new Error(`policy stuck at day ${state.day}, ${state.place}`);
  }
  tally.earned = state.books.earned;
  tally.lost = state.books.jumped + state.books.seized;
  return { state, takes, tally };
}
