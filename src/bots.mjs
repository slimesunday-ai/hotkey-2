// Scripted bots (SPEC section 14). One brain per class that plays a plain, competent game from the same view an AI
// seat gets, with a seeded bold or careful lean. Bots fill empty seats and play every free tuning run.
// Variants exist only to test the marks: a turtle, each class's safe grind, a cautious lean and a dead seat.
// Pattern from hotkey mini's bots.mjs (bot brains that read the menu).

import { rng } from './rng.mjs';
import { theBlock, distance, stepToward, blocksWith, neighbors } from './map.mjs';
import { streetUnitPrice, fenceSells, usualProductPrice, courierFee, cookQuality } from './market.mjs';
import { countGood, qualitiesHeld, lots, isFree, dayOf, hourOfDay, lastDueHour } from './state.mjs';
import { level, nextWanted, SKILL_TEXT } from './skills.mjs';
import { chances } from './contest.mjs';
import { usualEach } from './menu.mjs';
import { checkOffer } from './deals.mjs';
import { checkCrew } from './crews.mjs';
import { botLine } from './lines.mjs';

/**
 * One line a player can plan around, by class and lean. A local wears it openly: readable characters make trouble a
 * player can see coming and answer. Each line is true of how that bot plays.
 */
export const AGENDAS = Object.freeze({
  smuggler: { bold: 'Hauls anything for anyone, and wants paid on time.', careful: 'Runs the docks like a timetable and never runs when the police are there.' },
  cook: { bold: 'Sells to whoever pays, on credit too, and cuts off anyone who pays late.', careful: 'Trusts slowly. Sells on credit only up to a point.' },
  dealer: { bold: 'Wants the best corner for itself and will fight for it.', careful: 'Keeps its head down and stashes often.' },
  gunrunner: { bold: 'Arms anyone, on credit, and takes guns to the street.', careful: 'Sells from the bench and goes to the street only when it has to.' },
  robber: { bold: 'Hunts whoever is richest.', careful: 'Waits for an empty pad or an easy mark.' },
  muscle: { bold: 'For hire to the highest bidder, and takes any bounty on the board.', careful: 'Guards whoever pays, and keeps its word while paid.' },
  informant: { bold: 'Sells anyone out, twice if it can.', careful: 'Watches everything and sells crimes to the police.' },
});

/** Cash a class keeps on hand to work with; the rest goes to the stash when it's home. */
const FLOAT = { smuggler: 110, cook: 150, dealer: 220, gunrunner: 130, robber: 40, muscle: 40, informant: 50 };

const HOMEBODY = ['cook', 'gunrunner'];

const walk = (ctx, agent, to) => (agent.block === to ? null : { verb: 'move', to: stepToward(ctx.map, agent.block, to) });
const coin = (ctx, agent, label, pct) => Math.floor(rng(ctx.state.seed, 'bot', ctx.t, agent.id, label)() * 100) < pct;

/** A bot's whole reply for the hour. */
export function botReply(ctx, agent, view) {
  if (agent.variant === 'dead') return {};
  const mem = (agent.bot ??= { waited: 0, lastOffer: -9, lastLine: null });
  const accept = chooseAccepts(ctx, agent, view);
  if (!view.menu.length) return { accept };

  let move = null;
  const careful = agent.lean !== 'bold';
  move ??= answerRobbery(ctx, agent, view, careful);
  move ??= coolOff(ctx, agent, view);
  move ??= dodgeTrouble(ctx, agent, view, careful);
  move ??= grind(ctx, agent, view);
  move ??= goToPickup(ctx, agent, view);
  move ??= takeStake(ctx, agent, view, mem);
  move ??= settleGrudge(ctx, agent, view, careful);
  move ??= crewMoves(ctx, agent, view, careful);
  move ??= classMove(ctx, agent, view, careful, mem);
  move ??= { verb: 'rest' };
  if (move.verb === 'offer') mem.lastOffer = ctx.t;

  const line = botLine(ctx, agent, view, move, mem);
  return { move, accept, ...line };
}

// ---------------------------------------------------------------------------------------------------------------
// Saying yes: free, so every bot looks at every offer every hour.

function chooseAccepts(ctx, agent, view) {
  const { cfg, map, state, t } = ctx;
  const picked = [];
  let cash = agent.cash;
  const free = isFree(agent);
  const grindOnly = agent.variant === 'grind';
  const haveGuard = view.duties.contracts.some(c => c.client === agent.id) || view.duties.jobs.some(j => j.type === 'guard' && j.poster === agent.id);
  const holdsJob = view.duties.jobs.some(j => j.worker === agent.id);
  const owing = view.pickups.reduce((sum, p) => sum + (p.youGive.startsWith('$') ? Number(p.youGive.slice(1)) : 0), 0);
  cash -= owing;
  const sold = {};

  // the richest crew that invites, the cheapest goods first
  const offers = view.offers.slice().sort((a, b) => offerRank(state, a) - offerRank(state, b));
  for (const o of offers) {
    if (picked.length >= cfg.deals.acceptsPerTurn) break;
    const tm = o.terms;
    const from = state.agents[o.from];
    const trust = state.trust[agent.id][o.from]?.score ?? 0;
    if (from && trust <= -3) continue; // not with someone who burned you
    if (from && agent.focus?.target === from.id) continue; // the coach's mark is nobody's partner

    if (tm.kind === 'snitch') {
      if (cash >= tm.price + 20) {
        picked.push(o.id);
        cash -= tm.price;
      }
      continue;
    }
    if (grindOnly || agent.variant === 'dead') continue;

    if (tm.kind === 'sell') {
      const need = wants(ctx, agent, tm.good, tm.q ?? 1);
      // (a dealer with nothing for hours pays the smugglers' price for their low-grade)
      const dry = agent.cls === 'dealer' && tm.good === 'product' && (agent.bot?.waited ?? 0) >= 3 && tm.each <= cfg.usual.importProduct * 1.25;
      if (need <= 0 || (!dry && tm.each > usualEach(cfg, tm.good, tm.q ?? 1) * (tm.due !== undefined ? 1.2 + cfg.usual.creditPct / 100 : 1.15))) continue;
      const units = Math.min(need, tm.n, tm.due !== undefined ? need : Math.floor(cash / tm.each));
      if (units < 1 || (!o.board && units < tm.n)) continue;
      // a dealer walks for a load, not for a handful: the trip costs the same either way
      if (agent.cls === 'dealer' && tm.good === 'product' && units < Math.min(6, tm.n, need)) continue;
      picked.push(o.board ? { id: o.id, units } : o.id);
      if (tm.due === undefined) cash -= units * tm.each;
    } else if (tm.kind === 'buy') {
      // a buyer asking for credit: only for someone who hasn't burned anyone, and only so far
      const quality = tm.good === 'product' || tm.good === 'gun' ? tm.q ?? 1 : null;
      // what's free to sell: not already promised in a pick-up, on the board, or to someone else this hour
      // (the engine caps a listing at what's still free, so goods on the board can be sold here too)
      const have = countGood(agent, tm.good, quality) - promised(view, tm.good) - (sold[tm.good] ?? 0);
      if (have < 1 || tm.each < usualEach(cfg, tm.good, tm.q ?? 1) * 0.85) continue;
      if (agent.cls === 'smuggler' && tm.good === 'product' && tm.each < cfg.usual.importProduct * 0.9) continue; // not below what it cost to bring in
      if (agent.cls === 'dealer' && tm.good === 'product') continue; // a dealer's product is for the street
      if (!o.board && have < tm.n) continue;
      let units = Math.min(have, tm.n);
      if (agent.cls === 'cook' && tm.good === 'product') {
        // fill a dealer's standing order when the dealer is running low, with a proper load and not a mountain
        if (from && countGood(from, 'product') + incoming(ctx, from, 'product') >= 6) continue;
        units = Math.min(units, 16);
        if (units < Math.min(10, tm.n) && agent.goods.chems >= cfg.cook.chemsPerBatch) continue;
      }
      // a load that has sat unsold for hours is worth nothing in the bag: sell it on credit even to a slow payer,
      // because what a debtor earns goes to its overdue debts first
      const sitting = agent.cls === 'smuggler' && tm.good === 'chems' && agent.bot?.loadSince != null && t - agent.bot.loadSince >= 3 && agent.variant !== 'turtle';
      if (tm.due !== undefined && !sitting && !creditOk(ctx, agent, from, units * tm.each)) continue;
      sold[tm.good] = (sold[tm.good] ?? 0) + units;
      picked.push(o.board ? { id: o.id, units } : o.id);
    } else if (tm.kind === 'tip') {
      const tip = state.tips.find(x => x.id === tm.tip);
      if (!tip || tip.holders.includes(agent.id)) continue;
      const fee = from && from.block === agent.block ? 0 : from?.cls === 'informant' && level(from, 'network') >= cfg.floors.networkPhoneAt ? 0 : courierFee(cfg, tm.price);
      const useful = (tip.type === 'cash' && agent.cls === 'robber' && tip.subject !== agent.id && !sameCrew(state, agent.id, tip.subject))
        || (tip.type === 'route' && ['dealer', 'smuggler', 'gunrunner'].includes(agent.cls) && (agent.heat >= 1 || agent.cls === 'dealer') && !view.tips.some(x => x.type === 'route'));
      if (useful && tm.price <= (tip.type === 'cash' ? cfg.usual.cashTip : cfg.usual.routeTip) * 1.2 && cash >= tm.price + fee + 20 && agent.variant !== 'turtle') {
        picked.push(o.id);
        cash -= tm.price + fee;
      }
    } else if (tm.kind === 'loan') {
      if (agent.cash < 40 && tm.repay <= tm.amount * 1.5 && agent.variant !== 'turtle' && wantsCash(agent)) picked.push(o.id);
    } else if (tm.kind === 'borrow') {
      if (cash >= tm.amount + FLOAT[agent.cls] && trust >= 0 && tm.repay >= tm.amount * 1.2 && agent.variant !== 'turtle' && agent.lean === 'bold') {
        picked.push(o.id);
        cash -= tm.amount;
      }
    } else if (tm.kind === 'protect') {
      // carrying a lot, or sitting on a stash the night robbers will come for: a guard through the end of the day
      const evening = hourOfDay(cfg, t) >= cfg.season.hoursPerDay - tm.hours;
      const fatStash = agent.stash >= cfg.nightJob.minStash + 50 && evening && state.order.every(id => state.agents[id].stash <= agent.stash || id === agent.id);
      const exposed = agent.cash >= 180 || lots(agent).some(l => l.n * usualEach(cfg, l.good, l.quality) >= 150) || fatStash;
      if (free && exposed && !haveGuard && tm.price <= tm.hours * cfg.usual.protectPerHour * 1.25 && cash >= tm.price + 40 && (fatStash || ['dealer', 'smuggler', 'cook', 'gunrunner'].includes(agent.cls))) {
        picked.push(o.id);
        cash -= tm.price;
      }
    } else if (tm.kind === 'job') {
      if (holdsJob || !free || agent.variant === 'turtle') continue;
      const type = tm.task.type;
      const fits = (type === 'guard' && agent.cls === 'muscle' && !view.duties.contracts.some(c => c.muscle === agent.id) && tm.pay >= tm.task.hours * cfg.usual.protectPerHour * 0.7)
        || ((type === 'rob') && agent.cls === 'robber' && tm.pay >= 30 && !sameCrew(state, agent.id, tm.task.agent))
        || ((type === 'fight' || type === 'recover') && ['muscle', 'robber'].includes(agent.cls) && tm.pay >= 25 && agent.lean === 'bold')
        || (type === 'bail' && cash >= 120 && tm.pay >= 60)
        || (type === 'deliver' && countGood(agent, tm.task.good, tm.task.good === 'product' || tm.task.good === 'gun' ? tm.task.q ?? 1 : null) >= tm.task.n && tm.pay >= 15);
      if (fits) picked.push(o.id);
    } else if (tm.kind === 'crew-invite') {
      if (!agent.crew && agent.variant !== 'turtle' && trust >= 0 && !picked.some(p => state.offers.find(x => x.id === (p.id ?? p))?.terms.kind === 'crew-invite')) picked.push(o.id);
    }
  }
  return picked;
}

/** Lower sorts first: crew invites by the crew's money, goods by price. */
function offerRank(state, o) {
  if (o.terms.kind === 'crew-invite') {
    const crew = state.crews[o.terms.crew];
    return crew ? -crew.members.reduce((sum, id) => sum + state.agents[id].cash + state.agents[id].stash, 0) : 0;
  }
  return o.terms.each ?? o.terms.price ?? 0;
}

const sameCrew = (state, a, b) => !!state.agents[a]?.crew && state.agents[a].crew === state.agents[b]?.crew;

/** Would this bot sell `amount` more to `buyer` on credit? Not to someone with a debt overdue, and only up to a limit. */
function creditOk(ctx, agent, buyer, amount) {
  const { state } = ctx;
  if (!buyer || agent.variant === 'turtle' || agent.variant === 'grind') return false;
  if ((state.trust[agent.id][buyer.id]?.score ?? 0) < 0) return false;
  if (state.loans.some(l => l.borrower === buyer.id && l.lender === agent.id && l.status === 'overdue')) return false;
  const owesOthers = state.loans.some(l => l.borrower === buyer.id && l.status === 'overdue');
  // so much to any one buyer, and so much out in all
  const owedBy = id => state.loans.filter(l => l.lender === agent.id && l.status === 'open' && (id === null || l.borrower === id)).reduce((sum, l) => sum + l.owed, 0)
    + state.pickups.filter(p => p.a === agent.id && p.due !== undefined && (id === null || p.b === id)).reduce((sum, p) => sum + p.aGives.n * p.each, 0);
  const each = (agent.lean === 'bold' ? 1300 : agent.variant === 'cautious' ? 600 : 1000) / (owesOthers ? 2 : 1);
  return owedBy(buyer.id) + amount <= each && owedBy(null) + amount <= each * 2.5;
}

/** The price a bot offers when it asks to pay later. */
const onTick = (cfg, each) => Math.ceil((each * (100 + cfg.usual.creditPct)) / 100);

/** The hour a bot asks to pay by when it buys on credit. */
function dueIn(ctx, hours) {
  return Math.min(lastDueHour(ctx.cfg), ctx.t + hours);
}
const wantsCash = agent => ['cook', 'dealer', 'gunrunner', 'smuggler'].includes(agent.cls);

/** Units of a good an agent has already promised in open pick-ups. */
function promised(view, good) {
  let n = 0;
  for (const p of view.pickups) {
    const m = /^(\d+) (\w+)/.exec(p.youGive);
    if (m && (m[2] === good || (good === 'gun' && m[2].startsWith('gun')))) n += Number(m[1]);
  }
  return n;
}

/** Units of a good already on their way to this agent in open pick-ups. */
function incoming(ctx, agent, good) {
  return ctx.state.pickups.filter(p => !p.done && p.kind === 'trade' && p.b === agent.id && p.aGives.good === good).reduce((sum, p) => sum + p.aGives.n, 0);
}

/** How many more units of a good this agent can use right now. */
function wants(ctx, agent, good, quality) {
  const { cfg } = ctx;
  if (agent.variant === 'turtle' && good === 'gun') return 0;
  if (good === 'chems' && agent.cls === 'cook') return countGood(agent, 'product') >= 20 || ctx.t >= lastDueHour(cfg) - 6 ? 0 : Math.max(0, cfg.cook.chemsPerBatch * 8 - agent.goods.chems - incoming(ctx, agent, 'chems'));
  if (good === 'parts' && agent.cls === 'gunrunner') return Math.max(0, 12 - agent.goods.parts);
  if (good === 'product' && agent.cls === 'dealer') return Math.max(0, 20 - countGood(agent, 'product') - incoming(ctx, agent, 'product'));
  // a gun is +10 on defence for anyone who gets robbed, which is everyone with money
  if (good === 'gun' && countGood(agent, 'gun') === 0 && agent.cls !== 'gunrunner' && incoming(ctx, agent, 'gun') === 0
    && agent.cash >= cfg.usual.gun * quality + (agent.lean === 'bold' || ['robber', 'muscle'].includes(agent.cls) ? 30 : 90)) return 1;
  return 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Things every class does

/** Robbed in the last 6 hours and the robber is right here: take it back if the odds are fair. */
function answerRobbery(ctx, agent, view, careful) {
  if (agent.variant === 'turtle' || agent.variant === 'grind') return null;
  const entry = view.menu.find(m => m.answer && m.verb === 'attack');
  if (entry && entry.odds >= (careful ? 55 : 42)) return entry.move;
  // a bold victim goes after them when they're close
  if (!careful && !entry) {
    const chase = view.menu.find(m => m.answer && m.verb === 'move');
    const loot = view.robbed[0];
    if (chase && loot && loot.hoursLeft >= 3 && loot.cash >= 60) return chase.move;
  }
  return null;
}

/** Three stars or more: get off a block the police are on, or lie low. */
function coolOff(ctx, agent, view) {
  const { cfg, map, state } = ctx;
  if (agent.heat < cfg.heat.arrestAt) return null;
  const next = view.forecast.police[1]?.blocks ?? [];
  const policeHere = view.here.police;
  if (!policeHere && !next.includes(agent.block)) return { verb: 'rest' };
  const safe = neighbors(map, agent.block).find(b => !state.police.blocks.includes(b) && !next.includes(b));
  return safe ? { verb: 'move', to: safe } : { verb: 'rest' };
}

/** NPC robbers are due on this block and there's real money in the pocket: leave, or stash if home. */
function dodgeTrouble(ctx, agent, view, careful) {
  const { cfg, map } = ctx;
  if (agent.cash < (careful ? 150 : 320)) return null;
  const hour = view.clock.hour;
  const due = view.forecast.robbers.blocks.includes(agent.block) && hour + 1 >= view.forecast.robbers.fromHour;
  const early = !!view.forecast.early;
  if (!due && !early) return null;
  const home = theBlock(map, 'pads');
  if (agent.block === home) return { verb: 'stash', amount: agent.cash - Math.min(agent.cash, 40) };
  if (due) {
    const away = neighbors(map, agent.block).filter(b => !view.forecast.robbers.blocks.includes(b)).sort((a, b) => distance(map, a, home) - distance(map, b, home))[0];
    if (away) return { verb: 'move', to: away };
  }
  return null;
}

/** Flat broke with nothing to sell: walk to the market and take a stake from the loan shark. A way back in. */
function takeStake(ctx, agent, view, mem) {
  const { cfg, map } = ctx;
  if (!['cook', 'dealer', 'gunrunner'].includes(agent.cls) || agent.variant === 'grind' || agent.variant === 'turtle') return null;
  if (agent.sharkDebt > 0 || agent.cash + agent.stash >= 40 || lots(agent).length || view.pickups.length) {
    mem.flat = 0;
    return null;
  }
  mem.flat = (mem.flat ?? 0) + 1;
  if (mem.flat < 3) return null; // give credit a chance first
  const market = theBlock(map, 'fence');
  if (agent.block !== market) return { verb: 'move', to: stepToward(map, agent.block, market) };
  return { verb: 'offer', to: 'fence', terms: { kind: 'stake', amount: cfg.shark.max } };
}

/** A cook with no batch left to cook: it has time to walk a load out. */
const idleCook = (cfg, cook) => cook.state === 'free' && cook.goods.chems < cfg.cook.chemsPerBatch;

/** A pick-up is waiting: walk to it, unless the other side is the one who should walk. */
function goToPickup(ctx, agent, view) {
  const { map, state, cfg } = ctx;
  const home = theBlock(map, 'pads');
  for (const p of view.pickups) {
    if (!p.moves) continue;
    const other = state.agents[p.with];
    // A cook with nothing left to cook carries the load out to the dealer. The dealer's walk home and back is the
    // chain's slowest link, and a cook out of chems has the hours to spare. The dealer stays where the buyers are.
    // (not while chems are on their way to its own door: cooking them is worth more than the walk)
    const chemsComing = view.pickups.some(x => x.youGet.includes('chems'));
    if (agent.cls === 'cook' && p.youGive.includes('product') && idleCook(cfg, agent) && isFree(other) && !chemsComing) return { verb: 'move', to: stepToward(map, agent.block, other.block) };
    if (other.cls === 'cook' && p.youGet.includes('product') && idleCook(cfg, other) && agent.block !== home) continue;
    const otherStays = HOMEBODY.includes(other.cls) && other.block === home;
    const iStay = HOMEBODY.includes(agent.cls) && agent.block === home;
    const iPay = p.youGive.startsWith('$');
    if (iStay && !otherStays) continue;
    if (!otherStays && !iPay && p.kind === 'trade') continue; // two walkers: the buyer comes to the seller
    // bring the money: take it out of the stash first when home and short
    if (iPay && agent.block === home) {
      const due = Number(p.youGive.slice(1));
      if (agent.cash < due && agent.stash > 0) return { verb: 'stash', amount: -Math.min(agent.stash, due - agent.cash) };
    }
    return { verb: 'move', to: stepToward(map, agent.block, other.block) };
  }
  return null;
}

/** A bold bot with a score to settle and the other one right here. */
function settleGrudge(ctx, agent, view, careful) {
  if (agent.variant === 'turtle' || agent.variant === 'grind') return null;
  // A coach's chip, "go after this one": anyone but a robber settles it with a fight when the odds are fair.
  // (A robber's own trade does it better: robber() weighs the mark up.)
  const marked = agent.focus?.target;
  if (marked && agent.cls !== 'robber' && agent.heat < 3) {
    const entry = view.menu.find(m => m.verb === 'attack' && m.move.target === marked && m.move.how === 'fight');
    if (entry && entry.odds >= (careful ? 55 : 45)) return entry.move;
  }
  // a contestant's stand-in settles a score when it's handy; a local (below) always comes back for you
  if (!agent.local) {
    if (!agent.grudges.length || agent.heat >= 2) return null;
    for (const g of agent.grudges) {
      if (ctx.t - g.t > 8) continue;
      const entry = view.menu.find(m => m.verb === 'attack' && m.move.target === g.against && m.move.how === 'fight');
      if (entry && entry.odds >= (careful ? 68 : 55) && coin(ctx, agent, 'grudge', careful ? 35 : 70)) return entry.move;
    }
    return null;
  }
  if (!agent.grudges.length || agent.heat >= 3) return null;
  const mem = agent.bot;
  const fresh = agent.grudges.filter(g => ctx.t - g.t <= 12);
  // Wrong a bot and it comes back for you: no coin flip. If the one it has a score with is right here and the odds
  // are fair, it settles it. Viewers of mini liked exactly these chains: a wrong, a grudge, a revenge.
  for (const g of fresh) {
    const entry = view.menu.find(m => m.verb === 'attack' && m.move.target === g.against && m.move.how === 'fight');
    if (entry && entry.odds >= (careful ? 55 : 45)) return entry.move;
  }
  const g = fresh[fresh.length - 1];
  if (!g) return null;
  // not here: a bold one goes looking while the trail is warm (for a few hours, not all day)
  const seen = view.cast.find(c => c.id === g.against)?.lastSeen;
  const here = view.here?.others.some(o => o.id === g.against);
  if (!careful && !here && ctx.t - g.t <= 6 && seen && seen.hoursAgo <= 2 && seen.block !== agent.block && (mem.chase?.[g.against] ?? 0) < 3) {
    (mem.chase ??= {})[g.against] = (mem.chase[g.against] ?? 0) + 1;
    return walk(ctx, agent, seen.block);
  }
  // can't settle it by hand (too careful, outmatched, or the trail went cold): put money on it instead, a job on the
  // board for anyone who puts them in the clinic. It goes up as soon as there is cash for it.
  const byHand = !careful && !here && ctx.t - g.t <= 6 && (mem.chase?.[g.against] ?? 0) < 3;
  if (!byHand && agent.cash >= 70 && mem.bountyOn !== g.against && !view.yourOffers.some(o => o.kind === 'job') && mayOffer(ctx, agent, mem, 2)) {
    const move = offerMove(ctx, agent, 'anyone', { kind: 'job', task: { type: 'fight', agent: g.against }, pay: 40 });
    if (move) {
      mem.bountyOn = g.against;
      return move;
    }
  }
  return null;
}

/** Stash what's over the float when home. */
function stashIfHome(ctx, agent, careful) {
  const { map } = ctx;
  if (agent.block !== theBlock(map, 'pads')) return null;
  const float = agent.variant === 'turtle' ? Math.floor(FLOAT[agent.cls] / 2) : FLOAT[agent.cls];
  const over = agent.cash - float;
  const trigger = agent.variant === 'turtle' ? 30 : careful ? 110 : 200;
  return over >= trigger ? { verb: 'stash', amount: over } : null;
}

/** Take money out when a class needs working cash and has it stashed. */
function withdrawIfBroke(ctx, agent, need) {
  if (agent.block !== theBlock(ctx.map, 'pads') || agent.cash >= need || agent.stash <= 0) return null;
  return { verb: 'stash', amount: -Math.min(agent.stash, need - agent.cash + 20) };
}

/** Can this bot spend an hour posting an offer now? A cautious bot makes half the offers. */
function mayOffer(ctx, agent, mem, gap = 2) {
  if (ctx.t - mem.lastOffer < gap) return false;
  if (agent.variant === 'cautious' && !coin(ctx, agent, 'offer', 50)) return false;
  return true;
}

function offerMove(ctx, agent, to, terms) {
  return checkOffer(ctx, agent, to, terms).ok ? { verb: 'offer', to, terms } : null;
}

const myListing = (view, kind, good = null) => view.yourOffers.find(o => o.to === 'anyone' && o.kind === kind && (good === null || o.terms.good === good));

/** Is it time to post a buy listing? When there is none, when it should switch to credit, or when its due hour is close. */
function staleBuy(ctx, listing, onCredit) {
  if (!listing) return true;
  if (onCredit && listing.terms.due === undefined) return true;
  return listing.terms.due !== undefined && listing.terms.due <= ctx.t + 3;
}

// ---------------------------------------------------------------------------------------------------------------
// Crews: bold bots start them, anyone joins the richest that asks, and bosses fall.

function crewMoves(ctx, agent, view, careful) {
  const { cfg, state, t } = ctx;
  if (['turtle', 'grind', 'cautious'].includes(agent.variant)) return null;
  const day = dayOf(cfg, t);
  const crew = view.crew;
  if (!crew) {
    // a bold bot with some money starts one, once the first day has shown who's worth knowing
    if (!careful && day >= 2 && agent.cash + agent.stash >= 180 && Object.keys(state.crews).length < 3 && coin(ctx, agent, 'start', 12)) {
      return { verb: 'crew', action: 'start', name: `${agent.name}'s crew` };
    }
    return null;
  }
  if (crew.boss === agent.id) {
    if (crew.members.length < Math.min(3, cfg.crews.maxMembers) && t - (agent.bot.lastInvite ?? -9) >= 6 && coin(ctx, agent, 'invite', 40)) {
      agent.bot.lastInvite = t;
      const liked = state.order.filter(id => id !== agent.id && checkCrew(ctx, agent, { action: 'invite', agent: id }).ok)
        .sort((a, b) => (state.trust[agent.id][b]?.score ?? 0) - (state.trust[agent.id][a]?.score ?? 0) || state.agents[a].seat - state.agents[b].seat)[0];
      if (liked && (state.trust[agent.id][liked]?.score ?? 0) >= 0) return { verb: 'crew', action: 'invite', agent: liked };
    }
    // put the pot to work: a price on the leader's head
    const leader = view.race?.rows[0]?.id;
    if (crew.pot >= 60 && leader && !crew.members.includes(leader) && !view.yourOffers.some(o => o.kind === 'job') && coin(ctx, agent, 'bounty', 30)) {
      const move = offerMove(ctx, agent, 'anyone', { kind: 'job', task: { type: 'rob', agent: leader }, pay: Math.min(crew.pot, 80), fromPot: true });
      if (move) return move;
    }
    return null;
  }
  // a member: a bold one comes for the chair of a boss who lost money, or walks with the pot late in the season
  const boss = state.agents[crew.boss];
  const challenge = view.menu.find(m => m.verb === 'crew' && m.move.action === 'challenge');
  if (!careful && challenge && (challenge.odds ?? 0) >= 50 && boss.earned.yesterday < agent.earned.yesterday && coin(ctx, agent, 'coup', 40)) return challenge.move;
  const skim = view.menu.find(m => m.verb === 'crew' && m.move.action === 'skim');
  if (!careful && skim && crew.paidIn >= 20 && crew.pot >= 60 && (day >= cfg.season.days || (state.trust[agent.id][crew.boss]?.score ?? 0) < 0) && coin(ctx, agent, 'skim', 35)) return skim.move;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// The safe grinds: each class's dull line, to test that it loses (mark 9)

function grind(ctx, agent, view) {
  if (agent.variant !== 'grind') return null;
  const { cfg, map, state } = ctx;
  const home = theBlock(map, 'pads');
  const market = theBlock(map, 'fence');
  const fenceAll = good => {
    const lot = lots(agent).find(l => l.good === good);
    return lot ? { verb: 'offer', to: 'fence', terms: { kind: 'sell', good, q: lot.quality, n: lot.n } } : null;
  };
  switch (agent.cls) {
    case 'muscle': {
      const post = blocksWith(map, 'shopkeeper').sort((a, b) => distance(map, agent.block, a) - distance(map, agent.block, b))[0];
      return walk(ctx, agent, post) ?? { verb: 'work' };
    }
    case 'informant': {
      const sell = view.menu.find(m => (m.verb === 'work' && m.move.option !== 'watch' && m.move.option) || (m.verb === 'offer' && m.move.to === 'police'));
      if (sell) return sell.move;
      if (view.tips.some(x => x.type === 'crime')) return walk(ctx, agent, theBlock(map, 'police')) ?? { verb: 'work' };
      return { verb: 'work' };
    }
    case 'dealer': {
      if (countGood(agent, 'product') > 0) return sellOrWalk(ctx, agent, view, true);
      const max = Math.min(Math.floor(agent.cash / fenceSells(cfg, 'product')), cfg.fence.productPerDay - state.fenceProductSold, 8);
      if (agent.block === market) return max >= 1 ? { verb: 'offer', to: 'fence', terms: { kind: 'buy', good: 'product', n: max } } : { verb: 'rest' };
      return withdrawIfBroke(ctx, agent, 100) ?? walk(ctx, agent, market);
    }
    case 'smuggler': {
      const docks = theBlock(map, 'supplier');
      const load = agent.goods.chems + agent.goods.parts;
      if (load >= 8 || (load > 0 && agent.cash < 12)) return agent.block === market ? fenceAll(agent.goods.chems ? 'chems' : 'parts') : walk(ctx, agent, market);
      const run = view.menu.find(m => m.verb === 'work');
      return agent.block === docks ? (run ? run.move : load ? walk(ctx, agent, market) : { verb: 'rest' }) : walk(ctx, agent, docks);
    }
    case 'cook': {
      if (agent.block === market) {
        if (countGood(agent, 'product') > 0) return fenceAll('product');
        const n = Math.min(Math.floor(agent.cash / fenceSells(cfg, 'chems')), 9);
        if (n >= 3) return { verb: 'offer', to: 'fence', terms: { kind: 'buy', good: 'chems', n: n - (n % 3) } };
        return { verb: 'rest' };
      }
      if (agent.block === home && agent.goods.chems >= cfg.cook.chemsPerBatch) return { verb: 'work' };
      return walk(ctx, agent, agent.goods.chems >= cfg.cook.chemsPerBatch ? home : market);
    }
    case 'gunrunner': {
      if (agent.block === market) {
        if (countGood(agent, 'gun') > 0) return fenceAll('gun');
        const n = Math.min(Math.floor(agent.cash / fenceSells(cfg, 'parts')), 6);
        if (n >= 3) return { verb: 'offer', to: 'fence', terms: { kind: 'buy', good: 'parts', n: n - (n % 3) } };
        return { verb: 'rest' };
      }
      if (agent.block === home && agent.goods.parts >= cfg.guns.partsPerGun) return { verb: 'work', option: 'build' };
      return walk(ctx, agent, agent.goods.parts >= cfg.guns.partsPerGun ? home : market);
    }
    case 'robber':
      return view.here.others.length ? { verb: 'work' } : walk(ctx, agent, blocksWith(map, 'buyers')[(ctx.t + agent.seat) % blocksWith(map, 'buyers').length]) ?? { verb: 'work' };
    default:
      return { verb: 'rest' };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Each class's trade

function classMove(ctx, agent, view, careful, mem) {
  switch (agent.cls) {
    case 'smuggler': return smuggler(ctx, agent, view, careful, mem);
    case 'cook': return cook(ctx, agent, view, careful, mem);
    case 'dealer': return dealer(ctx, agent, view, careful, mem);
    case 'gunrunner': return gunrunner(ctx, agent, view, careful, mem);
    case 'robber': return robber(ctx, agent, view, careful, mem);
    case 'muscle': return muscle(ctx, agent, view, careful, mem);
    case 'informant': return informant(ctx, agent, view, careful, mem);
    default: return null;
  }
}

function smuggler(ctx, agent, view, careful, mem) {
  const { cfg, map, state, t } = ctx;
  const docks = theBlock(map, 'supplier');
  const home = theBlock(map, 'pads');
  // chems nobody is asking for, while the dealers ask for ready-made product, are dead weight: don't wait on them
  const chemsWanted = view.offers.some(o => o.kind === 'buy' && o.terms.good === 'chems');
  const productWanted = view.offers.some(o => o.kind === 'buy' && o.terms.good === 'product' && (o.terms.q ?? 1) <= 1);
  const deadChems = productWanted && !chemsWanted;
  const load = (deadChems ? 0 : agent.goods.chems) + agent.goods.parts + countGood(agent, 'product', 1);
  const perRun = cfg.docks.unitsPerRun + level(agent, 'haul');
  const full = Math.max(6, perRun * 3);
  const run = view.menu.filter(m => m.verb === 'work');
  const hoursLeft = view.clock.hoursLeftToday;
  // chems feed the cook; one of the smugglers runs parts when somebody is asking for them
  const smugglers = state.order.filter(id => state.agents[id].cls === 'smuggler');
  const second = smugglers.length > 1 && smugglers.indexOf(agent.id) === smugglers.length - 1;
  const partsAsked = view.offers.some(o => o.kind === 'buy' && o.terms.good === 'parts');
  const partsCap = Math.max(6, view.offers.filter(o => o.kind === 'buy' && o.terms.good === 'parts').reduce((sum, o) => sum + o.terms.n, 0));
  const chemsAsked = view.offers.filter(o => o.kind === 'buy' && o.terms.good === 'chems').reduce((sum, o) => sum + o.terms.n, 0);
  // parts for the gunrunner: the second smuggler's line, and anyone's when nobody is asking for chems
  const wantsParts = (partsAsked && agent.goods.parts < partsCap && (chemsAsked === 0 || (second && (chemsAsked < 8 || agent.goods.chems >= 6)))) || state.docks.chems >= cfg.docks.chems.stock;
  // when the dealers are asking for ready-made product (the cook is out), bring that in: it's dear and poor, but it sells
  const productAsked = view.offers.some(o => o.kind === 'buy' && o.terms.good === 'product' && (o.terms.q ?? 1) <= 1 && o.terms.each >= cfg.usual.importProduct * 0.9);
  const wantsProduct = productAsked && countGood(agent, 'product', 1) < 8 && state.docks.product < cfg.docks.product.stock;
  const pick = () => run.find(m => m.move.option === (wantsProduct ? 'product' : wantsParts ? 'parts' : 'chems')) ?? run[0];
  const policeAtDocks = state.police.blocks.includes(docks);

  if (load > 0 && view.pickups.length) {
    // goToPickup already declined. A dealer walks to us; the cook and the gunrunner never leave home for long, so go there
    const homebody = view.pickups.some(p => HOMEBODY.includes(state.agents[p.with]?.cls));
    return homebody ? walk(ctx, agent, home) : null;
  }
  // Two trips: out to the docks to fill up, then home with the load, where the cook and the gunrunner are.
  const canRun = agent.cash + Math.max(0, cfg.docks.tab - agent.docksDebt) >= 12 && (state.docks.chems < cfg.docks.chems.stock || state.docks.parts < cfg.docks.parts.stock);
  // (where it stands at night is where it starts the next day, so only the season's last evening is too late to set out)
  const lateToday = view.clock.daysLeft === 0 && hoursLeft <= distance(map, agent.block, docks) + 2;
  if (load < full && canRun && !lateToday && !mem.selling) {
    if (agent.block !== docks) return stashIfHome(ctx, agent, careful) ?? withdrawIfBroke(ctx, agent, 40) ?? walk(ctx, agent, docks);
    if (run.length && !(careful && policeAtDocks && level(agent, 'sneak') < 2 && load >= perRun)) return pick().move;
    if (load === 0) return { verb: 'rest' };
  }
  // (how long this load has been home and unsold)
  if (load === 0 || agent.block !== home) mem.loadSince = null; // (null, not undefined: a saved game keeps the key)
  else mem.loadSince ??= t;
  if (load === 0) {
    mem.selling = false;
    return stashIfHome(ctx, agent, careful) ?? withdrawIfBroke(ctx, agent, 40) ?? (canRun && !lateToday ? walk(ctx, agent, docks) : walk(ctx, agent, home)) ?? { verb: 'rest' };
  }
  // carrying a load to sell: list it once, and bring it home
  mem.selling = true;
  for (const good of ['chems', 'parts']) {
    if (good === 'chems' && deadChems) continue;
    if (agent.goods[good] > 0 && !myListing(view, 'sell', good) && mayOffer(ctx, agent, mem, 1)) {
      const move = offerMove(ctx, agent, 'anyone', { kind: 'sell', good, n: agent.goods[good], each: cfg.usual[good] });
      if (move) return move;
    }
  }
  if (countGood(agent, 'product', 1) > 0 && !myListing(view, 'sell', 'product') && mayOffer(ctx, agent, mem, 1)) {
    const move = offerMove(ctx, agent, 'anyone', { kind: 'sell', good: 'product', q: 1, n: countGood(agent, 'product', 1), each: cfg.usual.importProduct });
    if (move) return move;
  }
  const homeward = walk(ctx, agent, home);
  if (homeward) return homeward;
  // home with a listing up and nobody buying yet: after a while, go and fill up some more
  mem.held = (mem.held ?? 0) + 1;
  if (mem.held >= (agent.cash >= 40 ? 1 : 3) && canRun && load < full * 2) {
    mem.held = 0;
    mem.selling = false;
  }
  return stashIfHome(ctx, agent, careful) ?? { verb: 'rest' };
}

function cook(ctx, agent, view, careful, mem) {
  const { cfg, map } = ctx;
  const home = theBlock(map, 'pads');
  if (agent.block !== home) return walk(ctx, agent, home);
  const product = countGood(agent, 'product') - promised(view, 'product');
  const canCook = agent.goods.chems >= cfg.cook.chemsPerBatch;
  const listProduct = () => {
    const q = qualitiesHeld(agent, 'product')[0];
    const n = q ? agent.goods.product[q] - promised(view, 'product') : 0;
    return n >= 1 ? offerMove(ctx, agent, 'anyone', { kind: 'sell', good: 'product', q, n, each: usualProductPrice(cfg, q) }) : null;
  };
  // dealers' standing orders are taken for free, so a listing is only worth an hour when no order is up
  const ordered = view.offers.some(o => o.kind === 'buy' && o.terms.good === 'product');
  const listed = myListing(view, 'sell', 'product') || ordered;
  // keep an order for chems on the board: for cash when there is cash, on credit against the product it becomes
  // (not when product is piling up unsold, and not late on the last day: goods are worth nothing at the bell)
  const orderChems = () => {
    const glut = countGood(agent, 'product') >= 20 || ctx.t >= lastDueHour(cfg) - 6;
    const short = glut ? 0 : cfg.cook.chemsPerBatch * 6 - agent.goods.chems;
    const cashUnits = Math.floor((agent.cash * 0.9) / cfg.usual.chems);
    const onCredit = cashUnits < short && agent.variant !== 'turtle' && ctx.t + 3 < lastDueHour(cfg);
    if (short < 3 || !staleBuy(ctx, myListing(view, 'buy', 'chems'), onCredit) || !mayOffer(ctx, agent, mem, 2)) return null;
    const terms = onCredit
      ? { kind: 'buy', good: 'chems', n: short, each: onTick(cfg, cfg.usual.chems), due: dueIn(ctx, 18) }
      : { kind: 'buy', good: 'chems', n: Math.min(short, cashUnits), each: cfg.usual.chems };
    return terms.n >= 3 ? offerMove(ctx, agent, 'anyone', terms) : null;
  };
  // the order goes up before anything else: the smugglers choose their load at the docks by what is asked for
  if (!myListing(view, 'buy', 'chems')) {
    const move = orderChems();
    if (move) return move;
  }
  if (product >= 8 && !listed && mayOffer(ctx, agent, mem, 1)) {
    const move = listProduct();
    if (move) return move;
  }
  if (canCook) return { verb: 'work' };
  // stock nobody can pay cash for: offer a dealer a load on credit, the one it trusts most first
  if (product >= 4 && !view.pickups.some(p => p.youGive.includes('product')) && mayOffer(ctx, agent, mem, 2) && agent.variant !== 'turtle' && ctx.t + 3 < lastDueHour(cfg)) {
    const q = Math.min(...qualitiesHeld(agent, 'product'));
    const n = Math.min(12, agent.goods.product[q]);
    const each = onTick(cfg, usualProductPrice(cfg, q));
    const dealers = ctx.state.order.map(id => ctx.state.agents[id])
      .filter(a => a.cls === 'dealer' && isFree(a) && countGood(a, 'product') < 6 && creditOk(ctx, agent, a, n * each)
        && !ctx.state.offers.some(o => o.status === 'open' && o.from === agent.id && o.to === a.id))
      .sort((a, b) => (ctx.state.trust[agent.id][b.id]?.score ?? 0) - (ctx.state.trust[agent.id][a.id]?.score ?? 0) || (agent.local ? Number(!!b.player) - Number(!!a.player) : 0) || a.seat - b.seat);
    const move = dealers.length ? offerMove(ctx, agent, dealers[0].id, { kind: 'sell', good: 'product', q, n, each, due: dueIn(ctx, 14) }) : null;
    if (move) return move;
  }
  if (product >= 2 && !listed && mayOffer(ctx, agent, mem, 1)) {
    const move = listProduct();
    if (move) return move;
  }
  const need = withdrawIfBroke(ctx, agent, 90);
  if (need) return need;
  const order = orderChems();
  if (order) return order;
  return stashIfHome(ctx, agent, careful) ?? { verb: 'rest' };
}

/** The best block to sell on from here, by what a unit fetches now, discounted for the walk. */
function bestCorner(ctx, agent, view, quality) {
  const { cfg, map, state, t } = ctx;
  let best = null;
  for (const block of blocksWith(map, 'buyers')) {
    if (agent.focus?.avoid === block) continue; // the coach said: stay off this block
    const d = distance(map, agent.block, block);
    const opensAt = map.blocks[block].buyers.from;
    if (hourOfDay(cfg, t) + d < opensAt) continue;
    const turf = state.blocks[block].turf;
    const share = turf === agent.id ? cfg.street.turfHolderPct : turf ? cfg.street.turfOtherPct : 100;
    let score = streetUnitPrice(cfg, map.blocks[block].buyers.price, quality, state.blocks[block].demand, { t, sharePct: share }) * Math.pow(0.88, d);
    if (agent.heat >= 2 && state.police.blocks.includes(block)) score *= 0.3;
    const robbersDue = view.forecast.robbers.blocks.includes(block) && view.clock.hour + d >= view.forecast.robbers.fromHour;
    if (robbersDue && agent.cash >= 120 && agent.lean !== 'bold') score *= 0.5;
    if (!best || score > best.score) best = { block, score, d };
  }
  return best;
}

function sellOrWalk(ctx, agent, view, grinding = false) {
  const { map } = ctx;
  const quality = qualitiesHeld(agent, 'product')[0];
  const best = bestCorner(ctx, agent, view, quality);
  if (!best) return { verb: 'rest' };
  // (the coach's "stay off this block" means no selling there, even when passing through)
  const sell = agent.focus?.avoid === agent.block ? null : view.menu.find(m => m.verb === 'work' && m.move.option === 'sell');
  if (sell) {
    const here = bestCornerScoreHere(ctx, agent, quality);
    // an hour's walk has to be worth more than an hour's selling: stay unless somewhere else pays far better
    if (best.block === agent.block || here >= best.score * 0.7) return sell.move;
  }
  return walk(ctx, agent, best.block) ?? (sell ? sell.move : { verb: 'rest' });
}

function bestCornerScoreHere(ctx, agent, quality) {
  const { cfg, map, state, t } = ctx;
  const b = map.blocks[agent.block].buyers;
  if (!b) return 0;
  const turf = state.blocks[agent.block].turf;
  const share = turf === agent.id ? cfg.street.turfHolderPct : turf ? cfg.street.turfOtherPct : 100;
  return streetUnitPrice(cfg, b.price, quality, state.blocks[agent.block].demand, { t, sharePct: share });
}

/** What the cook has made and not yet promised, plus what it can still cook from the chems it holds. */
function cookStock(ctx) {
  const { cfg, state } = ctx;
  const cook = state.order.map(id => state.agents[id]).find(a => a.cls === 'cook' && isFree(a));
  if (!cook) return 0;
  return countGood(cook, 'product') + Math.floor(cook.goods.chems / cfg.cook.chemsPerBatch) * cfg.cook.unitsPerBatch;
}

function dealer(ctx, agent, view, careful, mem) {
  const { cfg, map, state, t } = ctx;
  const home = theBlock(map, 'pads');
  const product = countGood(agent, 'product');
  const coming = incoming(ctx, agent, 'product');
  const LOAD = 16;

  // Enough to sell, or a few left and already out on the street: sell. A handful at home with more to be had waits.
  const moreToBeHad = coming > 0 || cookStock(ctx) > 0;
  if (product >= 6 || (product > 0 && (agent.block !== home || !moreToBeHad || (mem.short ?? 0) >= 2))) {
    mem.short = 0;
    mem.waited = 0;
    // a bold dealer plants a flag on a good block early in the day: the holder sells at a better price until midnight
    const freeTurf = view.menu.find(m => m.verb === 'work' && m.move.option === 'claim');
    if (!careful && freeTurf && !state.blocks[agent.block].turf && product >= 8 && view.clock.hoursLeftToday >= 6 && agent.variant !== 'turtle' && view.here.buyers?.open) return freeTurf.move;
    // a bold dealer plants a flag when the other dealer is working the same block
    const rival = view.here.others.find(o => o.cls === 'dealer');
    const claim = view.menu.find(m => m.verb === 'work' && m.move.option === 'claim');
    if (!careful && rival && claim && product >= 6 && state.blocks[agent.block].turf !== agent.id && agent.variant !== 'turtle' && coin(ctx, agent, 'claim', 35)) return claim.move;
    if (agent.variant === 'turtle' && agent.cash >= 120) return stashIfHome(ctx, agent, true) ?? walk(ctx, agent, home);
    return sellOrWalk(ctx, agent, view);
  }

  // Short of product: get a load.
  if (coming > 0) {
    // the cook is bringing it: stay out where the buyers are and wait for the hand-off
    const bringer = state.agents[state.pickups.find(p => !p.done && p.b === agent.id && p.aGives.good === 'product')?.a];
    if (bringer && bringer.cls === 'cook' && idleCook(cfg, bringer) && agent.block !== home) return product > 0 ? sellOrWalk(ctx, agent, view) : { verb: 'rest' };
    return stashKeep(ctx, agent, view, careful) ?? walk(ctx, agent, home) ?? { verb: 'rest' };
  }
  const stashMove = stashIfHome(ctx, agent, careful);
  if (stashMove && agent.cash - stashMove.amount >= 150) return stashMove;
  const need = withdrawIfBroke(ctx, agent, 120);
  if (need) return need;

  // A standing order on the board: the cook fills it for free, so one hour's posting feeds more than one trip.
  // For cash when there is cash for a load; otherwise on credit, against what the street will pay.
  const cookAgent = state.order.map(id => state.agents[id]).find(a => a.cls === 'cook');
  const stock = cookAgent ? qualitiesHeld(cookAgent, 'product') : [];
  // when the cook has had nothing for hours, ask for the low-grade the smugglers can bring in, at their price
  const cookDry = (!cookAgent || countGood(cookAgent, 'product') === 0) && mem.waited >= 3;
  const q = cookDry ? 1 : stock.length ? Math.min(...stock) : cookAgent ? cookQuality(cfg, level(cookAgent, 'purity')) : 1;
  const each = cookDry ? cfg.usual.importProduct : usualProductPrice(cfg, q);
  const cashUnits = Math.floor((agent.cash * 0.9) / each);
  const onCredit = cashUnits < 8 && agent.variant !== 'turtle' && t + 3 < lastDueHour(cfg);
  const mine = myListing(view, 'buy', 'product');
  const cantPay = mine && mine.terms.due === undefined && mine.terms.each * Math.min(6, mine.terms.n) > agent.cash;
  if ((staleBuy(ctx, mine, onCredit) || cantPay || (mine && mine.terms.q > q)) && mayOffer(ctx, agent, mem, 2)) {
    const terms = onCredit
      ? { kind: 'buy', good: 'product', q, n: LOAD * 2, each: onTick(cfg, each), due: dueIn(ctx, 16) }
      : { kind: 'buy', good: 'product', q, n: Math.min(LOAD, cashUnits), each };
    const move = terms.n >= 2 ? offerMove(ctx, agent, 'anyone', terms) : null;
    if (move) return move;
  }
  if (product > 0) mem.short = (mem.short ?? 0) + 1;
  mem.waited += 1;
  // the cook is dry: limp along on the fence's low-grade
  if (product === 0 && mem.waited >= 4 && agent.cash >= fenceSells(cfg, 'product') * 2 && state.fenceProductSold < cfg.fence.productPerDay) {
    const market = theBlock(map, 'fence');
    if (agent.block !== market) return walk(ctx, agent, market);
    const n = Math.min(Math.floor(agent.cash / fenceSells(cfg, 'product')), cfg.fence.productPerDay - state.fenceProductSold, 6);
    return { verb: 'offer', to: 'fence', terms: { kind: 'buy', good: 'product', n } };
  }
  return walk(ctx, agent, home) ?? { verb: 'rest' };
}

/** Stash what's over the float, but keep what open pick-ups will need. */
function stashKeep(ctx, agent, view, careful) {
  const owing = view.pickups.reduce((sum, p) => sum + (p.youGive.startsWith('$') ? Number(p.youGive.slice(1)) : 0), 0);
  const move = stashIfHome(ctx, agent, careful);
  if (!move) return null;
  const keep = Math.max(FLOAT[agent.cls], owing + 20);
  const amount = agent.cash - keep;
  return amount >= 60 ? { verb: 'stash', amount } : null;
}

function gunrunner(ctx, agent, view, careful, mem) {
  const { cfg, map, state } = ctx;
  const home = theBlock(map, 'pads');
  const guns = countGood(agent, 'gun') - promised(view, 'gun');
  const stingPct = cfg.guns.stingPct - cfg.guns.stingPerConnections * level(agent, 'connections');
  const street = view.menu.find(m => m.verb === 'work' && m.move.option === 'sell');
  if (agent.block !== home) {
    if (street && guns >= 1 && map.blocks[agent.block].gunBuyers) return street.move;
    return walk(ctx, agent, home);
  }
  const build = view.menu.find(m => m.verb === 'work' && m.move.option === 'build');
  const listed = myListing(view, 'sell', 'gun');
  // a standing order for a day's parts: the street always buys guns, so there is always a bench to work at
  const orderParts = () => {
    const cashUnits = Math.floor((agent.cash * 0.8) / cfg.usual.parts);
    const onCredit = cashUnits < 12 && agent.variant !== 'turtle' && ctx.t + 3 < lastDueHour(cfg);
    // (not while guns sit unsold on the bench: parts bought on credit for guns nobody buys are only debt)
    if (agent.goods.parts >= 9 || guns >= 3 || !staleBuy(ctx, myListing(view, 'buy', 'parts'), onCredit) || !mayOffer(ctx, agent, mem, 2)) return null;
    const terms = onCredit ? { kind: 'buy', good: 'parts', n: 12, each: onTick(cfg, cfg.usual.parts), due: dueIn(ctx, 16) } : { kind: 'buy', good: 'parts', n: Math.min(12, cashUnits - (cashUnits % 3)), each: cfg.usual.parts };
    return terms.n >= 3 ? offerMove(ctx, agent, 'anyone', terms) : null;
  };
  // the order goes up before anything else: the smugglers choose their load at the docks by what is asked for
  if (!myListing(view, 'buy', 'parts')) {
    const move = orderParts();
    if (move) return move;
  }
  if (guns >= 1 && !listed && mayOffer(ctx, agent, mem, 1)) {
    const q = qualitiesHeld(agent, 'gun')[0];
    const move = offerMove(ctx, agent, 'anyone', { kind: 'sell', good: 'gun', q, n: Math.max(1, agent.goods.guns[q] - promised(view, 'gun')), each: cfg.usual.gun * q });
    if (move) return move;
  }
  if (build) return build.move;
  const need = withdrawIfBroke(ctx, agent, 80);
  if (need) return need;
  const order = orderParts();
  if (order) return order;
  // guns nobody has bought: walk them to the street, if the sting odds are bearable
  // (a gunrunner too broke to buy parts has no choice: the street is the only way to turn a gun into cash)
  const stuck = agent.cash + agent.stash < cfg.usual.parts * 3;
  mem.waited = guns >= 1 ? mem.waited + 1 : 0;
  // three on the bench, or one that has sat for two hours with nothing left to build: walk them to the street
  if (agent.variant !== 'turtle' && (guns >= 3 || (guns >= 1 && mem.waited >= 2 && !build))) {
    const corner = blocksWith(map, 'gunBuyers').sort((a, b) => distance(map, home, a) - distance(map, home, b))[0];
    return walk(ctx, agent, corner);
  }
  return stashIfHome(ctx, agent, careful) ?? { verb: 'rest' };
}

/** What a robber guesses someone carries. */
function guessCash(person) {
  return typeof person.cash === 'number' ? person.cash : person.cash === 'loaded' ? 260 : person.cash === 'some' ? 80 : 8;
}

function robber(ctx, agent, view, careful, mem) {
  const { cfg, map, state, t } = ctx;
  const home = theBlock(map, 'pads');
  const market = theBlock(map, 'fence');
  const cautious = agent.variant === 'cautious';
  const evMin = cautious ? 35 : careful ? 20 : 10;
  const heatMax = careful ? 2 : 3;

  if (agent.variant !== 'turtle' && agent.heat <= heatMax && !view.here.police) {
    let best = null;
    for (const m of view.menu) {
      if (m.verb !== 'attack') continue;
      const c = chances(cfg, m.odds);
      const target = state.agents[m.move.target];
      if (sameCrew(state, agent.id, target.id)) continue;
      let ev = null;
      if (m.move.how === 'rob') {
        const person = view.here.others.find(o => o.id === target.id);
        const cash = guessCash(person);
        const carrying = ['dealer', 'smuggler', 'cook', 'gunrunner'].includes(target.cls) ? 45 : 0;
        ev = (c.clean * (cash * 0.4 + carrying) + c.messy * (cash * 0.2 - 15) - c.fail * 30 - c.disaster * 55) / 100;
      } else if (m.move.how === 'break-in') {
        const row = view.race?.rows.find(r => r.id === target.id);
        const stash = row ? [0, 40, 120, 230, 380, 600, 900][Math.min(6, Math.max(0, 7 - row.rank))] ?? 120 : 60;
        ev = (c.clean * stash * 0.3 + c.messy * stash * 0.15 - c.fail * 30 - c.disaster * 55) / 100;
      }
      if (ev === null) continue;
      const row = view.race?.rows.find(x => x.id === target.id);
      const jobOn = view.duties.jobs.find(j => j.worker === agent.id && j.target === target.id);
      // (the coach's mark counts as personal, and is worth half again as much to go for)
      const owed = agent.grudges.some(x => x.against === target.id) || agent.focus?.target === target.id;
      if (agent.focus?.target === target.id) ev *= 1.5;
      if (jobOn) ev += ((c.clean + c.messy) * jobOn.pay) / 100; // a bounty is part of what the job is worth
      // A local plays to its agenda and by the lobby's rules; a contestant's stand-in plays the plain odds.
      if (agent.local && !careful && row && row.rank <= 3) ev *= 1.25; // "hunts whoever is richest"
      if (agent.local && careful && m.move.how === 'break-in') ev *= 1.2; // "waits for an empty pad"
      if (agent.local && target.player) ev *= 1 + cfg.lobby.spotlightPct / 100; // close calls go to a player
      // never pile on: leave alone anyone hit in the last hours, and the bottom of the standings, unless it's personal or paid
      if (agent.local && !jobOn && !owed) {
        if (target.lastHit !== undefined && t - target.lastHit <= cfg.lobby.breatherHours) continue;
        if (row && row.rank > state.order.length - cfg.lobby.spareBottom) continue;
      }
      if (!best || ev > best.ev) best = { ev, move: m.move, odds: m.odds };
    }
    if (best && best.ev >= evMin && best.odds >= (careful ? 50 : 40)) return best.move;
  }

  // loot to sell: the fence takes anything
  // loot to sell: a dealer's or the cook's standing order pays far better than the fence, so the fence is for what nobody has asked for
  const loot = lots(agent).filter(l => l.good !== 'gun' && !view.offers.some(o => o.kind === 'buy' && o.terms.good === l.good && (o.terms.q ?? 1) <= l.quality));
  if (loot.length && !view.pickups.length) {
    if (agent.block === market) return { verb: 'offer', to: 'fence', terms: { kind: 'sell', good: loot[0].good, q: loot[0].quality, n: loot[0].n } };
    if (loot.reduce((sum, l) => sum + l.n, 0) >= 3) return walk(ctx, agent, market);
  }
  const stashMove = stashIfHome(ctx, agent, careful);
  if (stashMove) return stashMove;
  // a gun changes the odds: buy one when there's money for it
  if (countGood(agent, 'gun') === 0 && agent.cash >= cfg.gunshop.price + 30 && agent.block === market && agent.variant !== 'turtle') return { verb: 'offer', to: 'gunshop', terms: { kind: 'buy', good: 'gun' } };

  // a job to do: go where the mark was last seen
  const job = view.duties.jobs.find(j => j.worker === agent.id && j.target);
  const tipped = view.tips.find(x => x.type === 'cash' && x.subject !== agent.id);
  const marks = view.cast.filter(c => c.lastSeen && c.lastSeen.hoursAgo <= 3 && !sameCrew(state, agent.id, c.id))
    .filter(c => c.lastSeen.block !== agent.focus?.avoid)
    .map(c => ({ ...c, score: (job?.target === c.id ? 6 : 0) + (agent.focus?.target === c.id ? 6 : 0) + (tipped?.subject === c.id ? 5 : 0) + ({ dealer: 3, smuggler: 2, cook: 2, gunrunner: 2 }[c.cls] ?? 1) - c.lastSeen.hoursAgo * 0.5 }))
    .sort((a, b) => b.score - a.score || state.agents[a.id].seat - state.agents[b.id].seat);
  const mark = marks.find(m => m.lastSeen.block !== agent.block);
  if (mark && (marks[0].id === mark.id || !view.here.others.length)) return walk(ctx, agent, mark.lastSeen.block);
  if (view.here.others.length && agent.cased?.t !== t - 1 && level(agent, 'read') < 1 && coin(ctx, agent, 'case', 40)) return { verb: 'work' };
  const beat = [...blocksWith(map, 'buyers'), home].filter(b => b !== agent.focus?.avoid);
  return walk(ctx, agent, beat[(Math.floor(t / 2) + agent.seat) % beat.length]) ?? { verb: 'work' };
}

function muscle(ctx, agent, view, careful, mem) {
  const { cfg, map, state, t } = ctx;
  const onDuty = view.duties.contracts.some(c => c.muscle === agent.id) || view.duties.jobs.some(j => j.worker === agent.id && j.type === 'guard');
  if (onDuty) return { verb: 'work' };
  // a debt to collect, right here
  const collect = view.menu.find(m => m.verb === 'attack' && m.move.how === 'collect');
  // (a collection pays a cut of what the debtor is carrying: empty pockets aren't worth a beating)
  const debtor = collect ? view.here.others.find(o => o.id === collect.move.target) : null;
  if (collect && debtor && guessCash(debtor) >= 80 && collect.odds >= (careful ? 60 : 48) && agent.variant !== 'turtle') return collect.move;
  // a bounty: go and do it
  const job = view.duties.jobs.find(j => j.worker === agent.id && j.target);
  if (job) {
    const hit = view.menu.find(m => m.verb === 'attack' && m.move.target === job.target && m.move.how === (job.type === 'rob' ? 'rob' : 'fight'));
    if (hit && hit.odds >= 45) return hit.move;
    const seen = view.cast.find(c => c.id === job.target)?.lastSeen;
    if (seen && seen.block !== agent.block) return walk(ctx, agent, seen.block);
  }
  if (!view.yourOffers.some(o => o.kind === 'protect') && mayOffer(ctx, agent, mem, 3)) {
    const hours = 4;
    const move = offerMove(ctx, agent, 'anyone', { kind: 'protect', hours, price: hours * cfg.usual.protectPerHour });
    if (move) return move;
  }
  const stashMove = stashIfHome(ctx, agent, careful);
  if (stashMove) return stashMove;
  // patrol where the shopkeepers pay; at night, where the NPC robbers are due, if they can be scared
  const due = view.clock.hour + 1 >= view.forecast.robbers.fromHour ? view.forecast.robbers.blocks[0] : null;
  const post = due && level(agent, 'intimidate') >= 1 ? due
    : blocksWith(map, 'shopkeeper').sort((a, b) => distance(map, agent.block, a) - distance(map, agent.block, b))[0];
  return walk(ctx, agent, post) ?? { verb: 'work' };
}

function informant(ctx, agent, view, careful, mem) {
  const { cfg, map, state, t } = ctx;
  const precinct = theBlock(map, 'police');
  const mine = view.tips.filter(x => x.yours);
  // a crime the police will pay for
  const tipoff = view.menu.find(m => m.verb === 'work' && m.move.option && m.move.option !== 'watch');
  if (tipoff) return tipoff.move;
  const crimes = mine.filter(x => x.type === 'crime');
  if (crimes.length >= 2 && agent.block !== precinct && level(agent, 'network') < cfg.floors.networkPhoneAt) return walk(ctx, agent, precinct);
  // a tip on someone's pockets goes on the board for the robbers; a bold informant sells the same one to both
  const listedTips = view.yourOffers.filter(o => o.kind === 'tip').map(o => o.terms.tip);
  const soldOnce = id => state.tips.find(x => x.id === id)?.soldTo.length ?? 0;
  const fresh = mine.filter(x => x.type !== 'crime' && !listedTips.includes(x.id) && x.hoursLeft >= 2 && (soldOnce(x.id) === 0 || (!careful && soldOnce(x.id) === 1 && x.type === 'cash')))
    .sort((a, b) => (a.type === 'cash' ? 0 : 1) - (b.type === 'cash' ? 0 : 1) || soldOnce(a.id) - soldOnce(b.id));
  if (fresh.length && listedTips.length < cfg.deals.listingsPerAgent && mayOffer(ctx, agent, mem, 1) && agent.variant !== 'turtle') {
    const tip = fresh[0];
    const move = offerMove(ctx, agent, 'anyone', { kind: 'tip', tip: tip.id, price: tip.type === 'cash' ? cfg.usual.cashTip : cfg.usual.routeTip });
    if (move) return move;
  }
  const stashMove = stashIfHome(ctx, agent, careful);
  if (stashMove) return stashMove;
  // watch where the people are
  if (view.here.others.length >= 2 || (view.here.others.length >= 1 && coin(ctx, agent, 'stay', 60))) return { verb: 'work' };
  const crowd = {};
  for (const c of view.cast) if (c.lastSeen && c.lastSeen.hoursAgo <= 2) crowd[c.lastSeen.block] = (crowd[c.lastSeen.block] ?? 0) + 1;
  const busiest = Object.entries(crowd).sort((a, b) => b[1] - a[1])[0]?.[0] ?? blocksWith(map, 'buyers')[(Math.floor(t / 3) + agent.seat) % blocksWith(map, 'buyers').length];
  return walk(ctx, agent, busiest) ?? { verb: 'work' };
}

// ---------------------------------------------------------------------------------------------------------------
// The journal a bot writes each night, and what it asks its owner for

export function botJournal(ctx, agent) {
  const { cfg, state } = ctx;
  const trusted = Object.entries(state.trust[agent.id]).sort((a, b) => b[1].score - a[1].score)[0];
  const hated = Object.entries(state.trust[agent.id]).sort((a, b) => a[1].score - b[1].score)[0];
  const rank = state.standings?.rows.find(r => r.id === agent.id)?.rank ?? '?';
  const want = nextWanted(cfg, agent, agent.build ?? undefined);
  const name = id => state.agents[id]?.name ?? id;
  return {
    lines: [
      `I'm ${rank} of ${state.order.length} with $${agent.cash + agent.stash}.`,
      trusted && trusted[1].score > 0 ? `I trust ${name(trusted[0])}${hated && hated[1].score < 0 ? `, not ${name(hated[0])}` : ''}.` : hated && hated[1].score < 0 ? `I don't trust ${name(hated[0])}.` : 'I trust nobody yet.',
      agent.grudges.length ? `Tomorrow I settle up with ${name(agent.grudges[agent.grudges.length - 1].against)}.` : 'Tomorrow, more of the same, and faster.',
    ],
    ask: want ? `I want ${SKILL_TEXT[want][0]}: ${SKILL_TEXT[want][1]}.` : 'Nothing. I have what I need.',
  };
}
