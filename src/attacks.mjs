// The `attack` verb: rob, break in, fight, collect (SPEC sections 7b and 8).
// Attacks resolve before anyone moves (D64), so a target picked from the menu is still there.
// A stash is never immune (D44): with the owner out a break-in is a quiet contest, with the owner home it's a fight
// at the door. Every victim gets an answer (D16): for 6 hours they can win back what's left.

import { theBlock } from './map.mjs';
import { usualProductPrice } from './market.mjs';
import { transfer, trustMark, grudge, tell } from './ledger.mjs';
import { nextId, isFree, lots, addGood, removeGood, countGood, bestGun, nameOf } from './state.mjs';
import { level, xpRisk, xpBeating } from './skills.mjs';
import { contestOdds, rollContest, guardsOf, tipOn } from './contest.mjs';
import { recordCrime, makeTip, CRIME_TIP_HOURS } from './tips.mjs';
import { jobDeed, burnSource, endContractBadly, goodsText } from './deals.mjs';
import { potAt } from './crews.mjs';
import { toClinic, arrest, addHeat } from './held.mjs';
import { rollSummary } from './work.mjs';
import { emit } from './stage.mjs';

export const ATTACKS = Object.freeze(['rob', 'fight', 'collect', 'break-in']);

const no = why => ({ ok: false, why });
const yes = (extra = {}) => ({ ok: true, ...extra });

/** The overdue loan `agent` could collect from `target`: its own, or (for a muscle) the biggest one anyone holds. */
export function collectable(state, agent, target) {
  const overdue = state.loans.filter(l => l.status === 'overdue' && l.borrower === target.id && l.owed > 0);
  const own = overdue.find(l => l.lender === agent.id);
  if (own) return own;
  if (agent.cls !== 'muscle') return null;
  return overdue.filter(l => l.lender !== agent.id).sort((a, b) => b.owed - a.owed)[0] ?? null;
}

/** Is `how` on `target` a legal attack right now? Returns the contest kind and its odds, for the menu. */
export function checkAttack(ctx, agent, move) {
  const { cfg, map, state, t } = ctx;
  const target = state.agents[move.target];
  if (!ATTACKS.includes(move.how)) return no('attack is rob, fight, collect or break-in');
  if (!target || target.id === agent.id) return no('no such target');
  if (move.how !== 'break-in' && target.safeHour === t) return no(`${target.name} can't be touched this hour`);

  if (move.how === 'break-in') {
    if (agent.cls !== 'robber') return no('only a robber breaks into a pad');
    if (agent.block !== theBlock(map, 'pads')) return no('pads are in the projects');
    const home = isFree(target) && target.block === agent.block;
    const kind = home ? 'door' : 'breakin';
    return yes({ kind, home, odds: contestOdds(cfg, state, kind, agent, target, { t, defenderBlock: agent.block }) });
  }
  if (!isFree(target) || target.block !== agent.block) return no(`${target.name} isn't on your block`);
  if (move.how === 'collect') {
    const loan = collectable(state, agent, target);
    if (!loan) return no(`${target.name} has no overdue debt you can collect`);
    return yes({ kind: 'collect', loan, odds: contestOdds(cfg, state, 'collect', agent, target, { t }) });
  }
  const kind = move.how === 'rob' ? 'rob' : 'fight';
  return yes({ kind, odds: contestOdds(cfg, state, kind, agent, target, { t }) });
}

/** The lot a clean robbery takes: the most valuable one the target carries, at usual prices. One gun counts as a lot. */
export function biggestLot(cfg, agent) {
  let best = null;
  for (const lot of lots(agent)) {
    const each = lot.good === 'chems' ? cfg.usual.chems : lot.good === 'parts' ? cfg.usual.parts : lot.good === 'gun' ? cfg.usual.gun * lot.quality : usualProductPrice(cfg, lot.quality);
    const n = lot.good === 'gun' ? 1 : lot.n;
    const value = each * n;
    if (!best || value > best.value) best = { good: lot.good, quality: lot.quality, n, value };
  }
  return best;
}

/** Was this a betrayal? A guard turning on its client, or one crewmate on another. Ends a contract the hard way. */
function betrayalOf(ctx, attacker, target) {
  const { state } = ctx;
  let betrayed = false;
  for (const c of state.contracts) {
    if (c.active && c.muscle === attacker.id && c.client === target.id) {
      endContractBadly(ctx, c, 'turned on you');
      betrayed = true;
    }
  }
  if (attacker.crew && attacker.crew === target.crew) {
    attacker.stats.betrayals += 1;
    ctx.tally.betrayals += 1;
    betrayed = true;
  }
  return betrayed;
}

/** A guard whose client was attacked has had its job tested: that's the muscle's risk XP. */
function testGuards(ctx, target, block) {
  for (const g of guardsOf(ctx.state, target, block)) xpRisk(ctx.cfg, g, 'a guard job that got tested');
}

function logRoll(ctx, kind, attacker, target, roll) {
  ctx.rolls.push({ kind, attacker: attacker.id, defender: target.id, ...rollSummary(roll) });
  for (const d of roll.decidedBy) ctx.decided.push({ ...d, what: `${kind}: ${roll.outcome} instead of ${d.without}` });
}

/** A disaster for the attacker: shot if the target is armed, otherwise arrested, unless Getaway saves it. */
function disaster(ctx, attacker, target, kinds, block, extra = {}) {
  const { cfg, state, t } = ctx;
  if (target && bestGun(target) > 0 && kinds.shot) {
    toClinic(ctx, attacker, cfg.rob.disasterClinic);
    emit(ctx, kinds.shot, { block, who: { robber: attacker.id, target: target.id, owner: target.id }, data: extra });
    return 'shot';
  }
  const getawayPct = cfg.rob.getawayPct * level(attacker, 'getaway');
  const roll = Math.floor(ctx.rand('getaway', attacker.id)() * 100);
  if (roll < getawayPct) {
    addHeat(cfg, attacker, cfg.rob.failHeat);
    ctx.decided.push({ agent: attacker.id, skill: 'getaway', value: getawayPct, without: 'arrest', side: 'a', what: 'turned an arrest into a getaway' });
    emit(ctx, kinds.getaway, { block, who: { robber: attacker.id, target: target?.id, owner: target?.id }, data: extra });
    return 'getaway';
  }
  const officer = 'npc:police1';
  const result = arrest(ctx, attacker, { officer, why: 'caught in the act', scene: false });
  emit(ctx, kinds.arrest, { block, who: { robber: attacker.id, target: target?.id, owner: target?.id, officer }, data: { ...extra, ...result } });
  return 'arrest';
}

/** Do the attack. Returns { ok, why } or { ok, text, outcome }. */
export function doAttack(ctx, agent, move) {
  const check = checkAttack(ctx, agent, move);
  if (!check.ok) return check;
  const target = ctx.state.agents[move.target];
  agent.stats.troubleStarted += 1;
  if (move.how === 'rob') return rob(ctx, agent, target);
  if (move.how === 'fight') return fight(ctx, agent, target);
  if (move.how === 'collect') return collect(ctx, agent, target, check.loan);
  return breakIn(ctx, agent, target, check.home);
}

function rob(ctx, robber, target) {
  const { cfg, state, t } = ctx;
  const block = robber.block;
  const armed = bestGun(robber) > 0;
  const tip = tipOn(state, robber, target, t);
  robber.stats.robAttempts += 1;
  ctx.tally.robAttempts += 1;
  if (robber.cls === 'robber' && (target.cash >= 20 || lots(target).length)) xpRisk(cfg, robber, 'a robbery');
  testGuards(ctx, target, block);
  const betrayed = betrayalOf(ctx, robber, target);
  const roll = rollContest(cfg, state, 'rob', robber, target, { t });
  logRoll(ctx, 'rob', robber, target, roll);
  const data = { roll: rollSummary(roll), armed, betrayed };

  if (roll.won) {
    const clean = roll.outcome === 'clean';
    const cash = Math.floor((target.cash * (clean ? cfg.rob.cleanCashPct : cfg.rob.messyCashPct)) / 100);
    transfer(state, target, robber, cash, { income: true });
    let lot = null;
    if (clean) {
      lot = biggestLot(cfg, target);
      if (lot) {
        removeGood(target, lot.good, lot.n, lot.quality);
        addGood(robber, lot.good, lot.n, lot.quality);
      }
    }
    state.loot.push({ id: nextId(state, 'e'), victim: target.id, robber: robber.id, t, until: t + cfg.rob.recoverHours, cash, lot, known: true, done: false });
    addHeat(cfg, robber, cfg.rob.heat);
    recordCrime(ctx, { by: robber.id, victim: target.id, block, what: `robbed ${target.name}` });
    robber.stats.robWins += 1;
    target.stats.robbedBy += 1;
    ctx.tally.robWins += 1;
    xpBeating(cfg, target);
    trustMark(state, cfg, target.id, robber.id, -3, 'robbed you', t);
    grudge(state, target, robber.id, 'robbed you', t);
    if (tip && !tip.burned) {
      tip.burned = true;
      burnSource(ctx, tip, target, robber);
    }
    toClinic(ctx, target, clean ? cfg.rob.cleanTargetClinic : cfg.rob.messyClinic);
    if (!clean) toClinic(ctx, robber, cfg.rob.messyClinic);
    const took = `$${cash}${lot ? ' and ' + goodsText(lot.good, lot.n, lot.quality) : ''}`;
    emit(ctx, clean ? (armed ? 'rob:clean:armed' : 'rob:clean') : 'rob:messy', { block, who: { robber: robber.id, target: target.id }, data: { ...data, cash, lot } });
    tell(state, target.id, t, `${robber.name} robbed you at the ${block}: ${took}. You have 6 hours to get it back.`);
    if (cash > 0 || lot) jobDeed(ctx, 'rob', robber, { target: target.id }); // a bounty pays for a robbery that took something
    return yes({ outcome: roll.outcome, text: `robbed ${target.name} of ${took}`, roll });
  }

  xpBeating(cfg, robber);
  trustMark(state, cfg, target.id, robber.id, -2, 'tried to rob you', t);
  grudge(state, target, robber.id, 'tried to rob you', t);
  tell(state, target.id, t, `${robber.name} tried to rob you at the ${block} and failed.`);
  if (roll.outcome === 'fail') {
    addHeat(cfg, robber, cfg.rob.failHeat);
    toClinic(ctx, robber, cfg.rob.failClinic);
    emit(ctx, 'rob:fail', { block, who: { robber: robber.id, target: target.id }, data });
    return yes({ outcome: 'fail', text: `tried to rob ${target.name} and took a beating`, roll });
  }
  const how = disaster(ctx, robber, target, { shot: 'rob:disaster:shot', getaway: 'rob:disaster:getaway', arrest: 'rob:disaster:arrest' }, block, data);
  return yes({ outcome: 'disaster', text: `tried to rob ${target.name}: ${how === 'shot' ? 'got shot' : how === 'getaway' ? 'it went wrong, but got away' : 'arrested on the spot'}`, roll });
}

function fight(ctx, attacker, target) {
  const { cfg, state, t } = ctx;
  const block = attacker.block;
  attacker.stats.fights += 1;
  ctx.tally.fights += 1;
  testGuards(ctx, target, block);
  const betrayed = betrayalOf(ctx, attacker, target);
  const roll = rollContest(cfg, state, 'fight', attacker, target, { t });
  logRoll(ctx, 'fight', attacker, target, roll);
  const data = { roll: rollSummary(roll), betrayed };
  trustMark(state, cfg, target.id, attacker.id, -2, 'came at you', t);

  if (roll.won) {
    xpBeating(cfg, target);
    grudge(state, target, attacker.id, 'beat you', t);
    emit(ctx, roll.outcome === 'clean' ? 'fight:clean' : 'fight:messy', { block, who: { attacker: attacker.id, target: target.id }, data });
    const back = takeBack(ctx, attacker, target);
    toClinic(ctx, target, roll.outcome === 'clean' ? cfg.fight.loserClinic : cfg.fight.messyClinic);
    if (roll.outcome === 'messy') toClinic(ctx, attacker, cfg.fight.messyClinic);
    tell(state, target.id, t, `${attacker.name} beat you at the ${block}.`);
    jobDeed(ctx, 'fight', attacker, { target: target.id });
    return yes({ outcome: roll.outcome, text: `beat ${target.name}${back ? ' and took back ' + back : ''}`, roll });
  }
  xpBeating(cfg, attacker);
  if (roll.outcome === 'fail') {
    toClinic(ctx, attacker, cfg.fight.failClinic);
    emit(ctx, 'fight:fail', { block, who: { attacker: attacker.id, target: target.id }, data });
  } else {
    attacker.heat = Math.min(cfg.heat.max, attacker.heat + cfg.fight.disasterHeat);
    toClinic(ctx, attacker, cfg.fight.disasterClinic);
    emit(ctx, 'fight:disaster', { block, who: { attacker: attacker.id, target: target.id }, data });
  }
  tell(state, target.id, t, `${attacker.name} came at you at the ${block} and lost.`);
  return yes({ outcome: roll.outcome, text: `went for ${target.name} and lost`, roll });
}

/**
 * Getting it back: the winner of a fight takes back whatever is left of what the loser stole in the last 6 hours,
 * from the winner itself or from whoever the winner holds a recover job for. Returns it in words, or null.
 */
function takeBack(ctx, winner, robber) {
  const { cfg, state, t } = ctx;
  const jobFor = state.jobs.filter(j => j.status === 'taken' && j.worker === winner.id && j.task.type === 'recover').map(j => j.poster);
  const mine = state.loot.filter(l => !l.done && l.until > t && l.robber === robber.id && (l.victim === winner.id || jobFor.includes(l.victim)));
  if (!mine.length) return null;
  const parts = [];
  for (const loot of mine) {
    const victim = state.agents[loot.victim];
    const job = loot.victim === winner.id ? null : state.jobs.find(j => j.status === 'taken' && j.worker === winner.id && j.task.type === 'recover' && j.poster === loot.victim);
    const cash = Math.min(loot.cash, robber.cash);
    let fee = 0;
    if (cash > 0) {
      robber.cash -= cash;
      fee = job ? Math.floor((cash * (job.sharePct ?? 0)) / 100) : 0;
      victim.cash += cash - fee;
      winner.cash += fee;
    }
    let goods = null;
    if (loot.lot) {
      const quality = loot.lot.good === 'product' || loot.lot.good === 'gun' ? loot.lot.quality : null;
      const n = Math.min(loot.lot.n, countGood(robber, loot.lot.good, quality));
      if (n > 0) {
        removeGood(robber, loot.lot.good, n, loot.lot.quality);
        addGood(victim, loot.lot.good, n, loot.lot.quality);
        goods = goodsText(loot.lot.good, n, loot.lot.quality);
      }
    }
    loot.done = true;
    const what = [cash > 0 ? `$${cash}` : null, goods].filter(Boolean).join(' and ') || 'nothing: it was already gone';
    parts.push(what);
    ctx.tally.recoveries += 1;
    emit(ctx, 'loot:back', { block: winner.block, who: { victim: winner.id, robber: robber.id }, data: { for: victim.id, cash, goods, fee } });
    if (victim.id !== winner.id) {
      tell(state, victim.id, t, `${winner.name} got back ${what} from ${robber.name}.`);
      jobDeed(ctx, 'recover', winner, { target: victim.id });
    }
    trustMark(state, cfg, victim.id, robber.id, 0, 'you got it back', t);
  }
  return parts.join('; ');
}

function collect(ctx, collector, debtor, loan) {
  const { cfg, map, state, t } = ctx;
  const block = collector.block;
  const lender = state.agents[loan.lender];
  ctx.tally.collections += 1;
  if (collector.cls === 'muscle') xpRisk(cfg, collector, 'a collection');
  testGuards(ctx, debtor, block);
  const roll = rollContest(cfg, state, 'collect', collector, debtor, { t });
  logRoll(ctx, 'collect', collector, debtor, roll);
  if (roll.won) {
    // the cash on them, and the stash too when they're home
    const home = debtor.block === theBlock(map, 'pads');
    let got = Math.min(debtor.cash, loan.owed);
    debtor.cash -= got;
    if (home && got < loan.owed) {
      const more = Math.min(debtor.stash, loan.owed - got);
      debtor.stash -= more;
      got += more;
    }
    loan.owed -= got;
    if (loan.owed === 0) loan.status = 'collected';
    const fee = collector.id === lender.id ? 0 : Math.floor((got * cfg.collectFeePct) / 100);
    collector.cash += fee;
    lender.cash += got - fee;
    xpBeating(cfg, debtor);
    trustMark(state, cfg, debtor.id, collector.id, -2, 'collected from you', t);
    if (collector.id !== lender.id) trustMark(state, cfg, lender.id, collector.id, +1, 'collected your debt', t);
    if (roll.outcome === 'messy') {
      toClinic(ctx, collector, cfg.fight.messyClinic);
      toClinic(ctx, debtor, cfg.fight.messyClinic);
    }
    emit(ctx, 'collect:win', { block, who: { collector: collector.id, debtor: debtor.id }, data: { roll: rollSummary(roll), got, fee, lender: lender.id, left: loan.owed } });
    tell(state, debtor.id, t, `${collector.name} collected $${got} of what you owe ${lender.name}.`);
    if (collector.id !== lender.id) tell(state, lender.id, t, `${collector.name} collected $${got} from ${debtor.name}; $${got - fee} is yours.`);
    return yes({ outcome: roll.outcome, text: `collected $${got} from ${debtor.name}`, roll });
  }
  xpBeating(cfg, collector);
  toClinic(ctx, collector, roll.outcome === 'fail' ? cfg.fight.failClinic : cfg.fight.disasterClinic);
  emit(ctx, 'collect:lose', { block, who: { collector: collector.id, debtor: debtor.id }, data: { roll: rollSummary(roll) } });
  return yes({ outcome: roll.outcome, text: `tried to collect from ${debtor.name} and lost`, roll });
}

function breakIn(ctx, robber, owner, home) {
  const { cfg, state, t } = ctx;
  const block = robber.block;
  const kind = home ? 'door' : 'breakin';
  robber.stats.breakIns += 1;
  ctx.tally.breakIns += 1;
  if (owner.stash >= 20 || home) xpRisk(cfg, robber, 'a break-in');
  const guards = guardsOf(state, owner, block).filter(g => g.id !== robber.id);
  testGuards(ctx, owner, block);
  const betrayed = betrayalOf(ctx, robber, owner);
  const roll = rollContest(cfg, state, kind, robber, owner, { t, defenderBlock: block });
  logRoll(ctx, home ? 'break-in at the door' : 'break-in', robber, owner, roll);
  const data = { roll: rollSummary(roll), home, betrayed };
  const spot = `door:${owner.id}`;
  const known = home || guards.length > 0;

  if (roll.won) {
    const clean = roll.outcome === 'clean';
    const pct = clean ? cfg.breakIn.cleanStashPct : cfg.breakIn.messyStashPct;
    let cash = Math.floor((owner.stash * pct) / 100);
    owner.stash -= cash;
    const crew = potAt(state, owner);
    let fromPot = 0;
    if (crew) {
      fromPot = Math.floor((crew.pot * pct) / 100);
      crew.pot -= fromPot;
    }
    cash += fromPot;
    robber.cash += cash;
    state.loot.push({ id: nextId(state, 'e'), victim: owner.id, robber: robber.id, t, until: t + cfg.rob.recoverHours, cash, lot: null, known, done: false, breakIn: true, block });
    addHeat(cfg, robber, cfg.rob.heat);
    const crime = recordCrime(ctx, { by: robber.id, victim: known ? owner.id : null, block, what: `broke into ${owner.name}'s pad` });
    state.loot[state.loot.length - 1].crime = crime.id;
    owner.stats.robbedBy += 1;
    if (home) {
      xpBeating(cfg, owner);
      toClinic(ctx, owner, clean ? cfg.rob.cleanTargetClinic : cfg.rob.messyClinic);
      if (!clean) toClinic(ctx, robber, cfg.rob.messyClinic);
    }
    emit(ctx, `${kind}:${roll.outcome}`, { block, spot, who: { robber: robber.id, owner: owner.id }, data: { ...data, cash, fromPot } });
    if (known) discover(ctx, owner, state.loot[state.loot.length - 1], guards[0]?.name ?? null);
    if (cash > 0) jobDeed(ctx, 'rob', robber, { target: owner.id });
    return yes({ outcome: roll.outcome, text: `broke into ${owner.name}'s pad and took $${cash}`, roll });
  }

  xpBeating(cfg, robber);
  if (known) {
    trustMark(state, cfg, owner.id, robber.id, -2, 'tried to break into your pad', t);
    grudge(state, owner, robber.id, 'tried to break into your pad', t);
    tell(state, owner.id, t, `${robber.name} tried to break into your pad and failed.`);
  }
  if (roll.outcome === 'fail') {
    addHeat(cfg, robber, cfg.rob.failHeat);
    toClinic(ctx, robber, cfg.rob.failClinic);
    emit(ctx, `${kind}:fail`, { block, spot, who: { robber: robber.id, owner: owner.id }, data });
    return yes({ outcome: 'fail', text: `tried ${owner.name}'s pad and got hurt`, roll });
  }
  const kinds = home
    ? { shot: 'door:disaster:shot', getaway: 'door:disaster:getaway', arrest: 'door:disaster:arrest' }
    : { shot: null, getaway: 'breakin:getaway', arrest: 'breakin:disaster' };
  const how = disaster(ctx, robber, home ? owner : null, kinds, block, data);
  return yes({ outcome: 'disaster', text: `tried ${owner.name}'s pad: ${how === 'shot' ? 'got shot' : how === 'getaway' ? 'it went wrong, but got away' : 'arrested'}`, roll });
}

/** The owner learns of a break-in: who, how much, a crime tip to sell, and 6 hours from now to get it back. */
function discover(ctx, owner, loot, toldBy = null) {
  const { cfg, state, t } = ctx;
  const robber = state.agents[loot.robber];
  loot.known = true;
  loot.until = t + cfg.rob.recoverHours;
  if (!state.tips.some(tip => tip.type === 'crime' && tip.crime === loot.crime && tip.madeBy === owner.id)) {
    makeTip(state, t, { type: 'crime', subject: robber.id, by: owner.id, hours: CRIME_TIP_HOURS, data: { what: `broke into ${owner.name}'s pad`, block: loot.block }, crime: loot.crime });
  }
  trustMark(state, cfg, owner.id, robber.id, -3, 'broke into your pad', t);
  grudge(state, owner, robber.id, 'broke into your pad', t);
  tell(state, owner.id, t, `${toldBy ? toldBy + ' saw it: ' : ''}${robber.name} broke into your pad and took $${loot.cash}. You have 6 hours to get it back.`);
}

/** Owners who have just come home find out about break-ins they didn't see. */
export function discoverBreakIns(ctx) {
  const { map, state } = ctx;
  const home = theBlock(map, 'pads');
  for (const loot of state.loot) {
    if (loot.known || loot.done || !loot.breakIn) continue;
    const owner = state.agents[loot.victim];
    if (isFree(owner) && owner.block === home) discover(ctx, owner, loot);
  }
}

/** What's still out there for an agent to get back, with where the robber is: the top of a victim's view. */
export function lootOut(state, agent, t) {
  return state.loot.filter(l => l.victim === agent.id && l.known && !l.done && l.until > t).map(l => {
    const robber = state.agents[l.robber];
    return {
      robber: robber.id, robberBlock: isFree(robber) ? robber.block : robber.state, hoursLeft: l.until - t, cash: l.cash,
      goods: l.lot ? goodsText(l.lot.good, l.lot.n, l.lot.quality) : null,
    };
  });
}
