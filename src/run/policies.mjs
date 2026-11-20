// Simple scripted players for measuring the marks (scripts/run-marks.mjs). Each reads only the view (and the state
// it can see), picks one of its choices, and the real engine plays it. A policy:
//   where: 'park' (the trailer park only), or the place it rides out to from the park: 'market', or (batch-1) any
//          other place one ride from the park, 'docks' or 'plaza', played as the market is (everything said below of
//          "the market" is said of that place)
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
//   GOODS (RUN.md, "Goods, the connect and errands"): a crime policy buys a pack from the connect of a place it plays
//     (the trailer park only: the park's; the market only: the market's; both places: both), when it has fewer than
//     `restock` sales of that good (on you and at home) and the cash on it (leaving the fare); it takes the pack's price
//     out of the crib when it means to buy in the park. A sale counts at its expected pay less what the sale cost.
//   sell: false never buys a pack, so never sells (a selling job is only dealt with goods on you)
//   sell: 'lean' (the dealer) takes a selling option whenever it is dealt one, before anything else
//   carry: on a market trip, take out at most this many sales of each good (default 2: the crowd buys twice a day);
//     the rest stay at the crib, safe (a carton bought on the way out is left home first, for nothing)
//   ROUTES (RUN.md, "Routes"): walk: 'both' | 'out' | 'home' goes those ways on foot along the route (no fare), the
//     subway otherwise; skate: true goes every way on the board once it owns one. stops: at a stop, 'play' ('home')
//     plays the best card of the hand on the way home, 'out' on the way out (at most cardsOut, default 1), 'all' every
//     card it can; a card counts at what it pays an energy less what an hour there could cost (the view's danger),
//     and only above cardMin (default $8, the trailer park's odd job). Otherwise it passes them all by.
//   eat: buys the day's sandwich in the park (or wherever the place's food is) at the last hour, and works one more
//   FEAR (memory-1, RUN.md "People remember"): fear: true leans on its own street and uses fear: in the trailer park
//     it takes first what fear makes sure (a debt from somebody who gives way), then the best-paying crime there, but
//     none that could start a fight while anybody there is afraid of it (a fight lost breaks every fear there), and no
//     robbing at home; after a trip, the same, else the odd job. A regular at the door is given what they ask (the
//     burner shuts it). Somebody come for another go is fought when the card says it wins at least fightAt in 100
//     (default 55), else paid off (fought when it cannot pay). homeCap: true also never takes a crime at home that would
//     take the pressure there to the warning (measured beside it: RUN.md "People remember").
// Options go away as the day's people are worked (RUN.md, "People"); the safe one is always dealt first, so a policy
// picks from whatever is left and, with a place worked dry, takes the safe one (test/run-people.test.mjs).

import { view } from './view.mjs';
import { step } from './step.mjs';
import { newRun } from './state.mjs';
import { fullEnergy, heatHere, doneToday, ITEMS, goodsWorth, pressureOf, sixesOf } from './rules.mjs';
import { holdsOf, holdOf, raidChance, roundsOf } from './raid.mjs';

const NEVER = Infinity;
// (bigman-1) A FIGHT IT MOSTLY LOSES IS PASSED BY: a policy with `fightMin` never takes a job whose going wrong is a
// fight the card says it wins less than this many times in 100, with what it fights with (with `pickArm`, the best thing
// it owns: it changes to it first). Of the people the card offers it to (who is driving this hour, and any other free
// driver), it takes the one it beats most often; never one that, lost, leaves no energy for the ride home; and it counts
// a fight it can win in what the job is worth. Read off the card only: the same odds the player is shown. (The heat it
// weighs, heatMax, is a failure's worst: the docks' lift +2, a fight lost; won, +1.)
export const FIGHT_MIN = 30;
const homeAt = stopAt => ({ where: 'market', crime: true, heatMax: 2, stopAt, heatHome: 3 });
const mixed = stopAt => ({ ...homeAt(stopAt), mixed: true });
const docks = stopAt => ({ ...homeAt(stopAt), where: 'docks', fightMin: FIGHT_MIN });
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
  // goods: both places, home at $X, as `mixed`; the dealer buys at both connects, carries more, and sells first
  dealer: (stopAt, carry = 2) => ({ ...mixed(stopAt), sell: 'lean', restock: 2 * carry, carry }),
  noSell: stopAt => ({ ...mixed(stopAt), sell: false }),
  // routes (RUN.md, "Routes"): the market, home at $X, as homeAt; on foot (`walk`: 'both', 'out' or 'home', the
  // subway the other way), passing every stop or playing them (`stops`: 'play' on the way home, 'all' every card it
  // can, 'out' on the way out); the skater goes every way on the board, when it owns one
  walker: (stopAt, stops = null, walk = 'both') => ({ ...homeAt(stopAt), walk, ...(stops ? { stops } : {}) }),
  skater: (stopAt, stops = 'play') => ({ ...homeAt(stopAt), skate: true, stops }),
  // home pressure (RUN.md, "Home pressure"): the quiet one plays both places but only the safe jobs (odd jobs, the
  // stall): nothing that brings pressure on at home. The others are `mixed` (both places, crime at home too) with one
  // way of meeting an attempt: `defend` 'guard' hires the guard (a stretch, paid up front) on the morning an attempt is
  // due, and with `guardWhen: 'worth'` only when what an attempt stands to take is more than his price (the deadbolt and
  // the floor safe are owned from the start, as a kit); `race` heads home on a notice by the quickest way in time; the
  // plain `mixed` ignores it all. `carryAll` takes everything banked out every time it steps out (never leaves it home).
  quiet: stopAt => ({ ...mixed(stopAt), crime: false }),
  defender: (stopAt, defend = 'guard') => ({ ...mixed(stopAt), defend }),
  racer: stopAt => ({ ...mixed(stopAt), race: true }),
  carrier: stopAt => ({ ...mixed(stopAt), carryAll: true }),
  // the one who brings pressure on and is away too: both places, the trailer park's crimes first, then the market
  homeFirst: stopAt => ({ ...mixed(stopAt), parkFirst: true }),
  // (memory-1) the shark that leans on its own street and uses fear: the burner, the park's debt first, then the market
  shark: stopAt => ({ ...mixed(stopAt), trust: 'burner', parkFirst: true, fear: true, fightAt: 55 }),
  // (and the same keeping its lane under the warning: never a crime at home that would take the pressure there to it)
  sharkQuiet: stopAt => ({ ...mixed(stopAt), trust: 'burner', parkFirst: true, fear: true, fightAt: 55, homeCap: true }),
  // (batch-1) the new places, each as the market's homeAt player at its own place: careful (heat 2 at most, home at
  // heat 3), heat-blind (as `reckless`, but home at $X), and honest (the safe job only). (bigman-1: the careful docks
  // player passes a lift whose fight it mostly loses, `fightMin`; the heat-blind one lifts blind, as built)
  docks,
  plaza: stopAt => ({ ...homeAt(stopAt), where: 'plaza' }),
  docksBlind: stopAt => ({ ...homeAt(stopAt), where: 'docks', heatMax: 9, heatHome: 9 }),
  plazaBlind: stopAt => ({ ...homeAt(stopAt), where: 'plaza', heatMax: 9, heatHome: 9 }),
  docksHonest: stopAt => ({ ...homeAt(stopAt), where: 'docks', crime: false }),
  plazaHonest: stopAt => ({ ...homeAt(stopAt), where: 'plaza', crime: false }),
  // (styles-1) THE ONE WHO LEARNS A STYLE: as homeFirst (the trailer park's crimes first, then the market), it learns
  // the punch styles of `learn` (true: every one) where they are taught once it carries the price and the fare home
  // (quick hands at the market: the answer to the trailer park's two quick ones), and before every fight it can see
  // coming (a card whose going wrong is a fight, the fight at its door, an hour where it can be jumped) it fights with
  // what the card says wins most (`pickArm`)
  styled: stopAt => ({ ...mixed(stopAt), parkFirst: true, learn: ['jab'], pickArm: true }),
  styledAll: stopAt => ({ ...mixed(stopAt), parkFirst: true, learn: true, pickArm: true }),
  // (bigman-1) THE DOCKS PLAYER WHO LEARNS THE THROW: the careful docks player, who learns the throw from Mr. Haines as
  // soon as it carries the price and the fare home, and before every fight it can see coming fights with what the card
  // says wins most: with the throw Big Lou's fight is one it can win, so it lifts from both trucks
  docksThrow: stopAt => ({ ...docks(stopAt), learn: ['throw'], pickArm: true }),
  // (sixes-1, RUN.md "The first slice") THE SLICE'S PLAYERS. The pressured home-first player answering a warning by laying
  // low (no crime at home while one stands), and telling Earl the way the door card says wins most when he is on; the
  // market's crime player who pays Dutch the tax, and the same who refuses it (and so meets two of the Sixes by the
  // steps). The pieces themselves are a kit (owned from the start), as the deadbolt and the floor safe are in H3.
  layLow: stopAt => ({ ...mixed(stopAt), parkFirst: true, layLow: true, pickWay: true }),
  taxPayer: stopAt => ({ ...mixed(stopAt), tax: 'pay' }),
  taxRefuser: stopAt => ({ ...mixed(stopAt), tax: 'refuse' }),
  // (second pass, mark S6) the market's player who works the market and another place by turns, a day each
  split: (stopAt, other = 'docks') => ({ ...homeAt(stopAt), alternate: ['market', other], ...(other === 'docks' ? { fightMin: FIGHT_MIN } : {}) }),
  // (raid-1, RUN.md "The raid on your home (raid-1)") THE WAYS TO PLAY THE SIXES, all of them the market's crime player
  // (`mixed`, home at stopAt). `armed` refuses the tax and meets the raid at home with a gun (a kit: owned from the start,
  // with its rounds), holding whatever the raid card says wins most, and buys rounds where they are sold when it runs
  // low; `handsOnly` refuses and meets it with what it fights with and its pieces (a kit), hiring Cousin Earl the morning
  // a raid is due; `moved` works other ground (the plaza) while the Sixes are at `moveAt` or more, their market otherwise.
  // The payer is `taxPayer`, above.
  armed: stopAt => ({ ...mixed(stopAt), tax: 'refuse', hold: 'best', restock: true }),
  handsOnly: stopAt => ({ ...mixed(stopAt), tax: 'refuse', hold: 'best', earlRaid: true }),
  moved: (stopAt, other = 'plaza', at = 5) => ({ ...mixed(stopAt), moveAt: at, moveTo: other }),
});

// an option's worth: its expected pay, less what one sale of its good cost (a sale uses one, win or lose)
const ev = o => (o.odds / 100) * ((o.pay[0] + o.pay[1]) / 2) - (o.uses?.cost ?? 0);

/** The places whose connects a policy buys from: the places it plays. */
function buysAt(policy) {
  if (!policy.crime || policy.sell === false) return [];
  if (policy.buyAt) return policy.buyAt;
  if (policy.mixed || policy.marketOnce) return ['park', awayOf(policy)];
  return [policy.where];
}
/** The place the policy rides out to from the park: its `where`, or the market for a park-only policy. */
const awayOf = policy => (policy.where && policy.where !== 'park' ? policy.where : 'market');
/**
 * A good worth buying: at a place the policy plays, what a sale of it beats an hour of that place's safe job by (its
 * odds × its pay there, less what a sale cost, less the safe job's pay) is more than one bad jump could take there:
 * the whole pack where people jump you, nothing where nobody does. (Measured, RUN.md: the market's dear discs, carried
 * through its jumps, lost every player who bought them money; the park's cheap cartons paid.)
 */
function worthSelling(cfg, v, policy, good) {
  const g = (v.goods ?? []).find(x => x.good === good);
  const mean = r => (r[0] + r[1]) / 2;
  // (not a second good for the same buyers: with a cheaper one to be had from a connect the policy buys from, sold at
  // the same job, the dearer pack is only more to lose. Measured 2026-11-14 with discs at $26: the two-place players
  // bought discs on top of their cartons and mark 12 fell from +12% to +7%.)
  const cheaper = !!g && (v.goods ?? []).some(h => h.good !== good && h.perSale < g.perSale
    && (v.connects ?? []).some(c => c.good === h.good && c.sells && buysAt(policy).includes(c.place))
    && h.sellsAt.some(s => buysAt(policy).includes(s.place) && g.sellsAt.some(t => t.place === s.place && t.job === s.job)));
  if (cheaper) return false;
  return !!g && g.sellsAt.some(s => {
    if (!buysAt(policy).includes(s.place)) return false;
    const jobs = cfg.places[s.place].jobs;
    const safe = Object.values(jobs).find(j => j.safe);
    const atStake = cfg.tiers[cfg.places[s.place].tier]?.jump ? g.price : 0;
    return (jobs[s.job].odds / 100) * mean(s.pay) - g.perSale - mean(safe.pay) > atStake;
  });
}
/** A pack the policy wants from the connect where it stands (no hour), or null. */
function packNow(cfg, v, state, policy) {
  const c = (v.connects ?? []).find(x => x.here && x.available);
  if (!c || !buysAt(policy).includes(state.place) || !worthSelling(cfg, v, policy, c.good)) return null;
  const have = (state.goods?.[c.good] ?? 0) + (state.stash?.[c.good] ?? 0);
  if (have >= (policy.restock ?? 1)) return null;
  // away from home, keep the fare, and buy only with an hour left to sell in before the ride
  const away = !cfg.places[state.place].door;
  if (away && state.energy < cfg.energy.perHour * 2 + (policy.spentAt ?? 1)) return null;
  return state.carried >= c.price + (away ? cfg.subway.fare : 0) ? { do: 'pack', good: c.good } : null;
}
/** Goods to take out for a market trip: up to `carry` sales of each (the crowd buys twice a day); the rest stay home. */
const tripGoods = (state, policy) => Object.fromEntries(Object.entries(state.stash ?? {}).map(([g, n]) => [g, Math.min(n, policy.carry ?? 2)]));
/** The price of the market's pack, if the policy means to buy one there on arriving (0: it does not). */
function marketPack(cfg, v, state, policy) {
  const c = (v.connects ?? []).find(x => x.place === awayOf(policy));
  if (!c || !c.sells || !buysAt(policy).includes(awayOf(policy)) || !worthSelling(cfg, v, policy, c.good)) return 0;
  return (state.goods?.[c.good] ?? 0) + (state.stash?.[c.good] ?? 0) < (policy.restock ?? 1) ? c.price : 0;
}
/**
 * What to take out of the crib for packs on the way (0: none wanted, or none affordable): the park's, bought on
 * stepping out, and, going to the market, the market's, bought on arrival.
 */
function packCash(cfg, v, state, policy, fare, { market = false } = {}) {
  let take = 0;
  for (const place of market ? ['park', awayOf(policy)] : ['park']) {
    if (!buysAt(policy).includes(place)) continue;
    const c = (v.connects ?? []).find(x => x.place === place);
    if (!c || !c.sells || !worthSelling(cfg, v, policy, c.good)) continue;
    const have = (state.goods?.[c.good] ?? 0) + (state.stash?.[c.good] ?? 0);
    if (have < (policy.restock ?? 1) && state.banked >= take + c.price + fare) take += c.price;
  }
  return take;
}
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

/** (bigman-1) An option's worth with its fight: what it pays when it works, or goes wrong and the fight is won. */
const evFight = (o, policy) => (o.fight ? ((o.odds + ((100 - o.odds) * fightOdds(o.fight, policy)) / 100) / 100) * ((o.pay[0] + o.pay[1]) / 2) - (o.uses?.cost ?? 0) : ev(o));
/** (bigman-1) A fight's odds as the card says them, with what the policy would fight with: the one it fights with, or with `pickArm` the best it owns. */
const fightOdds = (f, policy) => (policy.pickArm ? Math.max(f.pct, ...Object.values(f.byArm ?? {})) : f.pct);
/**
 * (bigman-1) An option as a `fightMin` policy takes it: one whose going wrong is no fight as it is; else done to whoever
 * of its targets the card says it beats most often (the choice names them when it is not the dealt one), and only if
 * that is at least fightMin in 100, and a fight lost (the card's "lost: energy −2") would still leave `keep` energy (the
 * ride home: lost with none left is a night on the street, robbed); null: passed by.
 */
function fightable(o, policy, energy, keep) {
  if (!o.fight) return o;
  if (energy - o.energy - (o.fight.costs?.lose ?? 0) < keep) return null;
  const who = (o.targets ?? []).filter(t => t.fight);
  const best = who.length ? who.reduce((a, b) => (fightOdds(b.fight, policy) > fightOdds(a.fight, policy) ? b : a)) : { id: o.who?.id, fight: o.fight };
  if (fightOdds(best.fight, policy) < policy.fightMin) return null;
  return best.id === o.who?.id ? o : { ...o, fight: best.fight, choice: { ...o.choice, who: best.id } };
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
  if (policy.fightMin) {
    const keep = cfg && state && !cfg.places[state.place]?.door ? cfg.energy.perHour : 0;
    opts = opts.map(o => fightable(o, policy, v.energy, keep)).filter(Boolean);
  }
  if (policy.sell === 'lean') {
    const sales = opts.filter(o => o.uses && heat + o.failHeat <= policy.heatMax);
    if (sales.length) return choiceOf(sales.reduce((a, b) => (ev(b) > ev(a) ? b : a)), policy);
  }
  let pick = opts[0];
  // (bigman-1: a fightMin policy counts a fight it can win as the card does: gone wrong and the fight won, it still pays)
  const worth = policy.fightMin ? o => evFight(o, policy) : ev;
  if (policy.crime) for (const o of opts) if (worth(o) > worth(pick) && heat + o.failHeat <= policy.heatMax) pick = o;
  let rob = robHere && policy.crime && !policy.robPlan ? v.moves.find(m => m.what === 'rob' && m.available) : null;
  if (rob && kind && (rob.tellRisk?.pct || state.day <= (policy.buildDays ?? 0))) rob = null;
  if (rob && (!pick || ev(rob) > worth(pick)) && heat + rob.winHeat <= policy.heatMax) return rob.choice;
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

/** The day's food where you stand, if the policy eats and it would buy one more hour. */
function eatNow(v, state, policy) {
  if (!policy.eat) return null;
  const food = v.moves.find(m => m.what === 'shop' && m.available && m.choice.do === 'shop');
  return food && state.carried >= food.price ? food.choice : null;
}

// ── routes (RUN.md, "Routes") ──────────────────────────────────────────────────────────────────────────────────────
/** The way the policy goes to a place along a route, if it goes this way at all: the board when it skates and owns one, else on foot. */
function wayFor(state, policy, to) {
  const out = to !== 'park';
  if (policy.skate && state.things?.board) return 'skate';
  if (policy.walk === 'both' || policy.walk === (out ? 'out' : 'home')) return 'walk';
  return null;
}
/** That way's move, if the view has it open (else the policy takes the subway). */
function wayMove(v, state, policy, to) {
  const d = wayFor(state, policy, to);
  return d ? v.moves.find(m => m.what === 'route' && m.choice.do === d && m.choice.to === to && m.available)?.choice ?? null : null;
}
/**
 * At a stop: play the best card of the hand (by what it pays an energy on average) or go on. 'all' plays every card
 * it can; 'home' (and 'play') only on the way home, where the energy left would otherwise go to the trailer park's
 * odd jobs or a short second trip (both worth less an energy than a card), and only a card worth more than `cardMin`
 * an energy; 'out' only on the way out. A card whose failure would push the heat on you over heatMax is passed by.
 */
function atStop(cfg, state, v, policy) {
  const home = state.route.to === 'park';
  const mode = policy.stops === 'play' ? 'home' : policy.stops;
  const wants = mode === 'all' || (mode === 'home' && home) || (mode === 'out' && !home);
  // what an hour here could cost you, read off the danger the view shows for it (a bad one takes it all, and the clinic)
  const j = v.danger.here ? v.danger.thisHour.jump : null;
  const risk = j ? (j.bad * j.takes.bad + j.scuffle * j.takes.scuffle) / 100 : 0;
  const worth = c => c.perEnergy - (mode === 'all' ? 0 : risk);
  // (on the way out, at most cardsOut cards: the energy is the market's)
  const played = state.hoursThere; // (the hours spent at this stop this time: the cards played)
  const room = mode === 'all' || home || played < (policy.cardsOut ?? 1);
  const cards = wants && room ? v.hand.filter(c => c.available && worth(c) > (mode === 'all' ? 0 : policy.cardMin ?? 8) && v.heat + c.failHeat <= (policy.heatMax ?? 9)) : [];
  if (cards.length) return cards.reduce((a, b) => (worth(b) > worth(a) ? b : a)).choice;
  return { do: 'onward' };
}

// ── home pressure (RUN.md, "Home pressure") ────────────────────────────────────────────────────────────────────────
/**
 * The racer, away with a notice up: the quickest way home that gets there in time (paying the fare when it can), when
 * what it would save is worth the hours: what the attempt would take with nobody home (the view's odds, the guard
 * first) less what it would take met at the door (their clean win all of it, a scuffle the scuffle's), against the
 * hours it has left, worked at home instead of here (what the safe job here pays over the trailer park's odd job).
 * Not when its own trip ends in time anyway.
 */
function raceHome(cfg, state, v, policy) {
  if (!policy.race || !v.home?.notice) return null;
  const ways = v.home.notice.ways.filter(w => w.inTime);
  if (!ways.length) return null;
  const best = Math.min(...ways.map(w => w.hours));
  const quick = ways.filter(w => w.hours === best);
  const way = quick.find(w => !w.choice.hop && w.available) ?? quick[0];
  // home in time anyway (the energy left is an hour or so of work, then the way home): no need to cut the trip short
  if (Math.max(0, state.energy - (policy.spentAt ?? 1)) + way.hours <= v.home.notice.hoursLeft) return null;
  const o = v.home.odds;
  const held = o.away.guard ? (100 - o.away.guard.beatenPct) / 100 : 0;
  const away = (1 - held) * (o.away.pct / 100) * o.stake.takes;
  const door = (1 - held) * ((o.door.bands.clean / 100) * o.stake.takes + (o.door.bands.messy / 100) * o.stake.scuffle);
  const safe = v.options.find(x => x.safe);
  // (the hours left are worked at home instead: what an hour of the safe job here pays over the trailer park's odd job)
  const mean = r => (r[0] + r[1]) / 2;
  const over = Math.max(0, (safe ? mean(safe.pay) : 0) - mean(cfg.places.park.jobs.odd.pay));
  return away - door > Math.max(0, state.energy - way.hours) * over ? way.choice : null;
}
/**
 * The guard defender at the crib: hires him (a stretch, paid up front) on the morning an attempt is due, unless he is on
 * through today already. `guardWhen: 'worth'` hires only when what stands to be lost is more than his price: the share
 * of the bank an attempt would take, times the chance they get in with the defences owned (the view's odds, away).
 */
/**
 * (raid-1) The raid: `hold: 'best'`, with a raid warned of, what the card says wins most among what it could hold (no
 * hour); `earlRaid`, at the crib the day it is due, Earl hired for the night when he is free and it can pay; `restock`,
 * at a gun's seller, a box of rounds when it has under a box left and carries the price (and the fare home).
 */
function raidNow(cfg, state, v, policy) {
  if (!cfg.sixesRaid || state.route) return null;
  const due = state.sixes?.raid ?? null;
  if (policy.hold === 'best' && due && !(state.place === 'clinic' || state.place === 'jail')) {
    const can = holdsOf(cfg, state);
    if (can.length > 1) {
      const best = can.map(h => [h, raidChance(cfg, state, { hold: h }).pct]).reduce((a, b) => (b[1] > a[1] ? b : a));
      if (best[0] !== holdOf(cfg, state) && v.choices.some(c => c.choice.do === 'holdWith' && c.choice.with === best[0] && c.available)) return { do: 'holdWith', with: best[0] };
    }
  }
  if (policy.earlRaid && due && due.day === state.day && state.place === 'crib') {
    const g = v.home?.defences?.guard;
    if (g?.choice && g.moveAvailable && !g.on) return g.choice;
  }
  if (policy.restock) {
    const m = v.choices.find(c => c.choice.do === 'ammo' && c.available && roundsOf(state, c.choice.item) < (c.n ?? 0) && state.carried >= c.price + cfg.subway.fare);
    if (m) return m.choice;
  }
  return null;
}

function guardNow(v, policy) {
  if (policy.defend !== 'guard') return null;
  const g = v.home?.defences?.guard;
  if (!g?.choice || !g.moveAvailable || g.on || !v.home.warning?.today) return null;
  if (policy.guardWhen === 'worth') {
    const o = v.home.odds;
    if ((o.stake.takes * o.away.pct) / 100 <= g.price) return null;
  }
  return g.choice;
}

// ── fear (memory-1, RUN.md "People remember") ──────────────────────────────────────────────────────────────────────
/**
 * The fear player's crime in the trailer park: what fear makes sure there (a debt from somebody who gives way); else the
 * best-paying crime, but none that could start a fight while anybody there is afraid of it (a fight lost breaks every
 * fear there). With `homeCap`, none that would take the pressure at home to the warning. Nothing: null.
 */
function fearJob(cfg, v, state, policy) {
  const P = v.pressure;
  const fits = o => !P || !policy.homeCap || P.value + Math.max(o.pressure?.ifWin ?? 0, o.pressure?.ifFail ?? 0) < P.warnAt;
  const opts = v.options.filter(o => o.available && !o.safe && fits(o));
  const sure = opts.find(o => o.fear?.sure);
  if (sure) return sure.choice;
  const here = (v.marks ?? []).some(m => m.fear && m.place === state.place);
  const pool = here ? opts.filter(o => !o.fight) : opts;
  return pool.length ? pool.reduce((a, b) => (ev(b) > ev(a) ? b : a)).choice : null;
}
/** Who is at your door, as the fear player answers: a regular is given what they ask; somebody come due, fought or paid. */
function fearDoor(v, state, policy) {
  const d = v.door;
  if (!d?.due) return state.banked >= d.wants ? { do: 'give' } : { do: 'refuse' };
  const pct = d.fight?.pct ?? 0;
  return pct >= (policy.fightAt ?? 55) || state.banked < d.wants ? { do: 'refuse' } : { do: 'give' };
}

/**
 * (styles-1) What it fights with, for the choice it is about to make: a card whose going wrong is a fight, the fight at
 * its door, or else the jump it can meet this hour: the thing it owns the card says wins most. A change of it first
 * (no hour); null: keep it.
 */
function armFor(v, choice) {
  const arms = v.fight?.arms ?? [];
  if (arms.length < 2) return null;
  let by = null;
  if (choice?.do === 'job') {
    // (bigman-1: done to another of its targets, that one's fight)
    const o = v.options.find(x => x.id === choice.id);
    by = ((choice.who ? o?.targets?.find(t => t.id === choice.who)?.fight : null) ?? o?.fight)?.byArm ?? null;
  }
  else if (choice?.do === 'refuse') by = v.choices.find(c => c.choice.do === 'refuse')?.fight?.byArm ?? null;
  by ??= v.danger?.here ? v.danger.thisHour?.jump?.fight?.byArm ?? null : null;
  if (!by) return null;
  const best = Object.keys(by).reduce((a, b) => (by[b] > by[a] ? b : a));
  return best !== v.fight.arm && by[best] > by[v.fight.arm] ? { do: 'fightWith', with: best } : null;
}
/** (styles-1) A punch style taught where it stands, not yet known, when it carries the price and the fare home. */
function learnNow(cfg, v, state, want = true) {
  const m = v.moves.find(x => x.what === 'learn' && x.available && (want === true || want.includes(x.style)));
  return m && state.carried >= m.price + (cfg.places[state.place]?.door ? 0 : cfg.subway.fare) ? m.choice : null;
}

/** The policy's next choice from what the view shows. */
export function decide(cfg, state, given0, v = view(cfg, state)) {
  // (second pass, mark S6: `alternate`, the places it works by turns, one a day: day 1 the first, day 2 the second…)
  // (woken where it slept rough, it works there that day)
  let given = given0.alternate ? { ...given0, where: given0.alternate.includes(state.place) ? state.place : given0.alternate[(state.day - 1) % given0.alternate.length] } : given0;
  // (raid-1: `moveAt`, the Sixes that high or more: their market is left for `moveTo` (out on a trip, it finishes it where it is))
  if (given.moveAt != null && cfg.sixes && (sixesOf(cfg, state)?.value ?? 0) >= given.moveAt) given = { ...given, where: cfg.places[state.place]?.tier && state.place !== 'park' && !state.route ? state.place : given.moveTo };
  // (raid-1: a raid warned of: what to hold, Earl for the night, rounds where they are sold)
  const r = raidNow(cfg, state, v, given);
  if (r) return r;
  const c = decide0(cfg, state, given, v);
  if (given.learn && c?.do !== 'learn' && !state.route) {
    const l = learnNow(cfg, v, state, given.learn);
    if (l) return l;
  }
  if (given.pickArm) return armFor(v, c) ?? c;
  return c;
}

/**
 * (sixes-1) Dutch waiting by the steps: the policy's `tax` ('pay' or 'refuse'); unset, it pays when it carries the
 * price (the default: refusing is a choice to fight), else refuses.
 */
function taxNow(state, v, policy) {
  const t = state.sixes?.tax;
  if (!t) return null;
  const pay = v.choices.find(c => c.choice.do === 'tax' && c.choice.pay);
  const want = policy.tax ?? 'pay';
  return want === 'pay' && pay?.available ? pay.choice : { do: 'tax', pay: false };
}

function decide0(cfg, state, given, v) {
  // (sixes-1: the tax first, whatever else)
  const tax = taxNow(state, v, given);
  if (tax) return tax;
  // (sixes-1: `pickWay`, Earl on the step: told the way the door card says wins most, no hour)
  if (given.pickWay && v.earl?.on) {
    const best = v.earl.ways.filter(w => w.win != null).reduce((a, b) => (b.win > (a?.win ?? -1) ? b : a), null);
    if (best && !best.chosen && best.available) return best.choice;
  }
  // (sixes-1: `layLow`, warned of an attempt: no crime at home until it has come or been called off; the market only)
  if (given.layLow && v.home?.warning && state.place === 'park') {
    const low = { ...given, parkFirst: false };
    if (low.where === 'park' || !low.mixed) return v.options.find(o => o.safe && o.available)?.choice ?? { do: 'inside' };
    given = low;
  }
  // the farmer: odd jobs in the trailer park for its first days, then the burner
  const policy = given.trust === 'farm' && state.day <= (given.farmDays ?? 0) ? { ...given, where: 'park', crime: false, mixed: false } : given;
  if (state.route) return (policy.race && v.home?.notice ? { do: 'onward' } : null) ?? atStop(cfg, state, v, policy);
  const race = state.place !== 'park' && state.place !== 'crib' ? raceHome(cfg, state, v, policy) : null;
  if (race) return race;
  // (the place it rides out to: the market, or a batch-1 place)
  const away = awayOf(policy);
  // (a walker or skater pays no fare out: it takes none from the crib)
  const fare = wayFor(state, policy, away) ? 0 : cfg.subway.fare;
  const fareHome = wayFor(state, policy, 'park') ? 0 : cfg.subway.fare;
  const where = policy.marketOnce && !Object.keys(policy.marketOnce).every(k => state.owned[k]) ? 'park' : policy.where;
  const marketHeat = heatHere(cfg, state, away);
  const goMarket = where === away && where !== 'park' && state.energy >= (policy.minOut ?? 3) && marketHeat < policy.heatHome;
  const parkHere = where === 'park' || (policy.mixed && !goMarket);
  const hour = cfg.energy.perHour;
  switch (state.place) {
    case 'clinic':
    case 'jail':
      return { do: 'morning' };
    case 'crib': {
      if (state.door && policy.fear) return fearDoor(v, state, policy);
      if (state.door) return policy.door !== 'refuse' && state.banked >= state.door.wants ? { do: 'give' } : { do: 'refuse' };
      const guard = guardNow(v, policy);
      if (guard) return guard;
      if (policy.buy) for (const item of ITEMS) if (v.shop.find(s => s.item === item).available) return { do: 'buy', item };
      if (goMarket) return { do: 'out', take: policy.carryAll ? state.banked : Math.min(fare + packCash(cfg, v, state, policy, fare, { market: true }), state.banked), goods: tripGoods(state, policy) };
      if (parkHere && state.energy >= hour) return { do: 'out', take: policy.carryAll ? state.banked : packCash(cfg, v, state, policy, 0) };
      return { do: 'sleep' };
    }
    case 'park': {
      const pack = packNow(cfg, v, state, policy);
      if (pack) return pack;
      // police about with heat on you here: bank what you carry first (going inside costs no hour)
      if (parkHere && !policy.carryAll && state.carried > 0 && v.danger.here && v.danger.thisHour.stop.chance > 0) return { do: 'inside' };
      if (parkHere && policy.fear) {
        // (fear: at home only what fear makes sure, else the odd job; never anything that brings the lane to the door)
        if (state.energy < hour) return { do: 'inside' };
        return fearJob(cfg, v, state, policy) ?? v.options.find(o => o.safe && o.available)?.choice ?? { do: 'inside' };
      }
      if (parkHere) {
        if (state.energy < hour) return eatNow(v, state, policy) ?? { do: 'inside' };
        // the last hour here (then inside, where nothing rolls): a robbery, if you have the cutter
        if (state.energy === hour && !policy.robPlan) return robNow(cfg, v, state, policy, 'inside') ?? bestJob(v, policy, v.heat, { rob: false, cfg, state });
        return (policy.robPlan ? planned(v, state, policy) : null) ?? bestJob(v, policy, v.heat, { rob: false, cfg, state });
      }
      if (policy.parkFirst && goMarket && state.energy > (policy.minOut ?? 3)) {
        // both places' people: the park's crimes first (nobody jumps you here), then the market
        const c = policy.fear ? fearJob(cfg, v, state, policy) : bestJob(v, policy, v.heat, { rob: false, cfg, state });
        if (c?.do === 'job' && !v.options.find(o => o.id === c.id)?.safe) return c;
      }
      // bank what you brought home first (beyond the fare and a market pack's price, taken out for the trip)
      if (!goMarket || (!policy.carryAll && state.carried > fare + marketPack(cfg, v, state, policy))) return { do: 'inside' };
      // more goods on you than the trip can sell (a carton just bought): leave the rest at the crib first (no hour)
      if (Object.keys(state.goods ?? {}).some(g => state.goods[g] > (policy.carry ?? 2))) return { do: 'inside' };
      return (policy.robPlan ? planned(v, state, policy) : null) ?? wayMove(v, state, policy, away) ?? { do: 'subway', to: away, hop: state.carried < cfg.subway.fare };
    }
    case away: {
      const pack = packNow(cfg, v, state, policy);
      if (pack) return pack;
      const spent = state.energy <= (policy.spentAt ?? 1);
      if (spent && policy.rough) return state.energy >= hour ? bestJob(v, policy, v.heat, { cfg, state }) : { do: 'rough' };
      if (spent && policy.drink) {
        const drink = v.moves.find(m => m.what === 'shop' && m.available && m.item === 'drink');
        if (drink && state.carried >= drink.price + fareHome) return drink.choice;
      }
      if (state.energy < hour) return v.moves.find(m => m.choice.do === 'shop' && m.available)?.choice ?? { do: 'rough' };
      if (spent || state.carried >= policy.stopAt || v.heat >= policy.heatHome) {
        // on the way out (an energy left for the ride): a robbery, the last thing done here
        const rob = state.energy > hour ? robNow(cfg, v, state, policy, 'ride') : null;
        return rob ?? wayMove(v, state, policy, 'park') ?? { do: 'subway', to: 'park', hop: state.carried < cfg.subway.fare };
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
  // a kit's things (the skateboard) are owned as things, the rest as the three
  for (const [k, on] of Object.entries(kit)) if (cfg.things?.[k]) state.things = { ...state.things, [k]: on };
  state.owned = { ...state.owned, ...Object.fromEntries(Object.entries(kit).filter(([k]) => !cfg.things?.[k] && k !== 'ammo')) };
  // (raid-1: a kit's rounds, gun → rounds, owned from the start as its things are)
  if (kit.ammo) state.ammo = { ...kit.ammo };
  state.energy = fullEnergy(cfg, state);
  const takes = [];
  const tally = { jumped: 0, bad: 0, scuffle: 0, stopped: 0, earned: 0, lost: 0, trips: 0, robbed: 0, rough: 0, door: 0, fights: 0, robs: 0, bins: 0, drinks: 0, packs: 0, sales: 0, goodsLost: 0, goodsSeized: 0, walks: 0, cards: 0, cardPay: 0, footLost: 0, footGoods: 0, footJumped: 0,
    // home pressure: warnings, attempts (met at the door, settled by the guard, taken), what they took, the guard's wages,
    // the races home on a notice; and per run, the days of each (H4, H6)
    warnings: 0, raids: 0, raidsDoor: 0, raidsGuard: 0, raidsTaken: 0, burgled: 0, guardPaid: 0, alarms: 0, raced: 0, pressureSum: 0, warnDays: [], raidDays: [],
    // (sixes-1) the crews and the sneaks apart (attempts, what each took), the door fights with a crew and those lost, Earl
    // down in one; the Sixes: the tax paid, refused, their two by the steps and those seen off
    crews: 0, sneaks: 0, burgledCrew: 0, burgledSneak: 0, crewFights: 0, crewLost: 0, earlDown: 0, taxPaid: 0, taxRefused: 0, sixesJumps: 0, sixesWon: 0, dogFood: 0,
    // (raid-1) the Sixes' raids: warned, met at home and held (or lost), out; what they took (cash, and goods at cost);
    // rounds fired and their cost; guns lost; heat from gunfire; days of truce
    sixesRaids: 0, sixesRaidsHome: 0, sixesRaidsWon: 0, sixesRaidsOut: 0, sixesRaidTaken: 0, roundsFired: 0, roundsCost: 0, gunsLost: 0, gunHeat: 0, raidWarnings: 0 };
  // what got banked, plus what was spent at the crib on the three things (food, the door and the guard's wages count
  // against it), and the goods in hand at what they cost (a pack is money turned into stock: it counts against the day
  // only when the stock is lost, or sold for less)
  const stock = s => goodsWorth(cfg, s.goods ?? {}) + goodsWorth(cfg, s.stash ?? {});
  // (styles-1: a lesson counts against the day it was bought, as the guard's wages do: a cost of the trade, not a thing kept)
  // (sixes-1: the dog's food and the Sixes' tax count against the day, as the guard's wages do)
  // (raid-1: rounds bought count against the day, as the dog's food does)
  const kept = s => s.banked + s.books.spent - (s.books.street ?? 0) - (s.books.door ?? 0) - (s.books.goods ?? 0) - (s.books.guard ?? 0) - (s.books.lessons ?? 0) - (s.books.dog ?? 0) - (s.books.sixes ?? 0) - (s.books.ammo ?? 0) + stock(s);
  let dayStart = kept(state);
  let steps = 0;
  const last = until ? maxDays : days;
  while (state.day <= last && !(until && until(state))) {
    const v = view(cfg, state);
    const choice = decide(cfg, state, policy, v);
    if (policy.race && v.home?.notice && !state.route && choice === raceHome(cfg, state, v, policy)) tally.raced += 1;
    const { state: next, events } = step(cfg, state, choice);
    for (const e of events) {
      if (e.type === 'jumped') {
        tally.jumped += 1;
        if (e.outcome === 'clean') tally.bad += 1;
        if (e.outcome === 'messy') tally.scuffle += 1;
      }
      if (e.type === 'stopped') tally.stopped += 1;
      if ((e.type === 'ride' || e.type === 'arrive') && e.place === awayOf(policy)) tally.trips += 1;
      // routes: the ways set out on, the cards played and what they paid, and what was lost on a route's ground
      // (jumped or stopped at a stop or on a leg on from one: cash, and goods at what they cost)
      if (e.type === 'walk') tally.walks += 1;
      if (e.type === 'card' || (e.type === 'bins' && e.card)) {
        tally.cards += 1;
        tally.cardPay += e.pay ?? 0;
      }
      if (e.route && (e.type === 'jumped' || e.type === 'stopped')) {
        const goods = goodsWorth(cfg, e.goodsTaken ?? e.goodsSeized ?? {});
        tally.footLost += (e.taken ?? e.seized ?? 0) + goods;
        tally.footGoods += goods;
        if (e.type === 'jumped') tally.footJumped += 1;
      }
      if (e.type === 'robbed') tally.robbed += 1;
      if (e.type === 'rough') tally.rough += 1;
      if (e.type === 'door') tally.door += 1;
      if (e.type === 'fight') tally.fights += 1;
      if (e.type === 'rob') tally.robs += 1;
      if (e.type === 'bins') tally.bins += 1;
      if (e.type === 'shop') tally.drinks += 1;
      if (e.type === 'pack') tally.packs += 1;
      if (e.type === 'job' && e.goods) tally.sales += 1;
      for (const n of Object.values(e.goodsTaken ?? {})) tally.goodsLost += n;
      for (const n of Object.values(e.goodsSeized ?? {})) tally.goodsSeized += n;
      if (e.type === 'casing') { tally.warnings += 1; tally.warnDays.push(e.day); }
      if (e.type === 'alarm') {
        tally.alarms += 1;
      }
      if (e.type === 'raid' && e.kind !== 'sixes') { // (raid-1: the Sixes' raid is tallied apart, below: these are home pressure's)
        tally.raids += 1;
        tally.raidDays.push(e.day);
        if (e.fight) tally.raidsDoor += 1;
        if (e.how === 'guard') tally.raidsGuard += 1;
        if (e.taken) tally.raidsTaken += 1;
        tally.burgled += e.taken;
        if (e.kind === 'crew') {
          tally.crews += 1;
          tally.burgledCrew += e.taken;
          if (e.duel) {
            tally.crewFights += 1;
            if (e.duel.result !== 'won') tally.crewLost += 1;
            if (e.duel.earl?.down) tally.earlDown += 1;
          }
        } else {
          tally.sneaks += 1;
          tally.burgledSneak += e.taken;
        }
      }
      if (e.type === 'sixes' && e.what === 'paid') tally.taxPaid += e.amount;
      if (e.type === 'sixes' && e.what === 'refused') tally.taxRefused += 1;
      if (e.type === 'jumped' && e.sixes) {
        tally.sixesJumps += 1;
        if (e.duel?.result === 'won') tally.sixesWon += 1;
      }
      if (e.type === 'dogFed') tally.dogFood += e.paid ?? 0;
      if (e.type === 'sixes' && e.what === 'raidWarned') tally.raidWarnings += 1;
      if (e.type === 'raid' && e.kind === 'sixes') {
        tally.sixesRaids += 1;
        tally.sixesRaidTaken += (e.taken ?? 0) + goodsWorth(cfg, e.goodsTaken ?? {});
        if (e.home) tally.sixesRaidsHome += 1;
        else tally.sixesRaidsOut += 1;
        if (e.home && e.fight?.result === 'won') tally.sixesRaidsWon += 1;
        if (e.fight?.spent) {
          tally.roundsFired += e.fight.spent;
          const A = cfg.things[e.duel.gun]?.ammo;
          if (A) tally.roundsCost += (e.fight.spent * A.price) / A.n;
        }
        if (e.lostGun) tally.gunsLost += 1;
        tally.gunHeat += e.heat ?? 0;
      }
      if (e.type === 'guard') tally.guardPaid += e.paid ?? 0;
    }
    if (next.day !== state.day) {
      tally.pressureSum += pressureOf(cfg, next)?.value ?? 0;
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
