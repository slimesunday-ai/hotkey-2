// The night (SPEC section 4): no moves. Rent, night trouble, heat cools, XP turns into points, the standings are
// published, and the next day's forecast is drawn. Journals and owners' level-ups are run by the season around this.

import { blocksWith } from './map.mjs';
import { FULL_DEMAND, rentOn } from './market.mjs';
import { tell, trustMark } from './ledger.mjs';
import { agentsIn, netWorth, dayOf } from './state.mjs';
import { level, xpToPoints, spendDefault, xpRisk } from './skills.mjs';
import { rollContest, guardsOf } from './contest.mjs';
import { snitchSells } from './tips.mjs';
import { closeDayHolds } from './deals.mjs';
import { potAt } from './crews.mjs';
import { emit } from './stage.mjs';

/** Rough brackets for the public standings: everyone sees rank and roughly how rich, never the exact number (D65). */
export const BRACKETS = Object.freeze([
  [0, 'broke'], [50, 'under $150'], [150, '$150 to $300'], [300, '$300 to $500'], [500, '$500 to $800'], [800, '$800 to $1,200'], [1200, 'over $1,200'],
]);

export function bracketOf(worth) {
  let label = BRACKETS[0][1];
  for (const [min, text] of BRACKETS) if (worth >= min) label = text;
  return label;
}

/** Everyone ranked by net worth; a tie goes to the bigger stash, then the seat. */
export function rankAgents(state) {
  return agentsIn(state)
    .map(a => ({ id: a.id, worth: netWorth(state, a), stash: a.stash }))
    .sort((x, y) => y.worth - x.worth || y.stash - x.stash || state.agents[x.id].seat - state.agents[y.id].seat)
    .map((row, i) => ({ ...row, rank: i + 1, bracket: bracketOf(row.worth) }));
}

/**
 * Run the night after day `day` (1..4). Returns what happened, for the feed and the episode page.
 * It ends with the points granted but not yet spent: the season spends them (default builds, or the owner's file).
 */
export function runNight(ctx, day) {
  const { cfg, map, state, t } = ctx;
  const night = { day, rent: [], evicted: [], snitch: [], points: [], standings: null };

  // the snitch sells what wasn't hushed
  // the game holds nothing overnight: job pay and guard pay go back before the rent is due
  closeDayHolds(ctx);
  night.snitch = snitchSells(ctx);
  for (const s of night.snitch) emit(ctx, 'snitch:sold', { data: s });

  // rent: from the stash, then the pocket. Short means evicted for the night.
  const rent = rentOn(cfg, day);
  for (const agent of agentsIn(state)) {
    agent.evicted = false;
    if (agent.stash + agent.cash >= rent) {
      const fromStash = Math.min(agent.stash, rent);
      agent.stash -= fromStash;
      agent.cash -= rent - fromStash;
      state.books.out.rent = (state.books.out.rent ?? 0) + rent;
      night.rent.push({ id: agent.id, paid: rent });
      emit(ctx, 'night:sleep', { block: agent.block, spot: `pad:${agent.id}`, who: { agent: agent.id }, data: { rent } });
      continue;
    }
    agent.evicted = true;
    // out on the street: night robbers take 30% of the stash unless Stealth hides it
    const savePct = cfg.rent.evictSavePerStealth * level(agent, 'stealth');
    const saved = Math.floor(ctx.rand('evicted', agent.id, day)() * 100) < savePct;
    let lost = 0;
    if (!saved) {
      lost = Math.floor((agent.stash * cfg.rent.evictStashPct) / 100);
      agent.stash -= lost;
      if (lost > 0) state.books.out['night robbers'] = (state.books.out['night robbers'] ?? 0) + lost;
    } else if (savePct > 0) {
      ctx.decided.push({ agent: agent.id, skill: 'stealth', value: savePct, without: 'robbed', side: 'd', what: 'kept the stash hidden while evicted' });
    }
    night.evicted.push({ id: agent.id, rent, lost, saved });
    emit(ctx, 'night:evicted', { block: agent.block, spot: `door:${agent.id}`, who: { agent: agent.id }, data: { rent, lost } });
    if (lost > 0) emit(ctx, 'night:robbed', { block: agent.block, spot: `door:${agent.id}`, who: { agent: agent.id, owner: agent.id, robber1: 'npc:robber1', robber2: 'npc:robber2' }, data: { lost } });
    tell(state, agent.id, t, `You couldn't make the $${rent} rent and spent the night on the street${lost ? `. Night robbers took $${lost} from your stash` : ''}.`);
  }
  emit(ctx, 'rent', { data: { rent, evicted: night.evicted.map(e => e.id) } });

  // the night job: the NPC robbers go for the fattest stash. A guard hired for the night stands in the way.
  night.job = nightJob(ctx, day);

  // heat cools a star
  for (const agent of agentsIn(state)) agent.heat = Math.max(0, agent.heat - cfg.heat.nightDrop);

  // XP turns into points; the bottom three get one more ("hungry")
  const ranked = rankAgents(state);
  const hungry = ranked.slice(-cfg.xp.hungrySeats).map(r => r.id);
  for (const agent of agentsIn(state)) {
    const xpLog = agent.xpLog.slice();
    let points = xpToPoints(cfg, agent);
    if (hungry.includes(agent.id) && points < 3) {
      agent.points += cfg.xp.hungryPoints;
      agent.pointsEarned += cfg.xp.hungryPoints;
      points += cfg.xp.hungryPoints;
    }
    night.points.push({ id: agent.id, points, hungry: hungry.includes(agent.id), from: xpLog });
  }

  // the standings: rank and a rough bracket, for everyone (D65)
  night.standings = ranked.map(r => ({ id: r.id, rank: r.rank, bracket: r.bracket, worth: r.worth }));
  state.standings = { day, rows: night.standings.map(({ id, rank, bracket }) => ({ id, rank, bracket })) };
  emit(ctx, 'standings', { data: { day, rows: night.standings } });

  // a new day: the docks restock, corners are up for grabs again, the street is hungry
  state.docks = { chems: 0, parts: 0, product: 0 };
  state.fenceProductSold = 0;
  for (const [id, block] of Object.entries(state.blocks)) {
    block.turf = null;
    block.crimesYesterday = block.crimes;
    block.crimes = 0;
    block.soldThisHour = 0;
    if (map.blocks[id].buyers) block.demand = FULL_DEMAND;
  }
  for (const block of blocksWith(map, 'buyers')) for (const id of state.regulars[block]) state.buyers[id].craving = 1;
  for (const agent of agentsIn(state)) {
    agent.earned.yesterday = agent.earned.today;
    agent.earned.byBlockYesterday = agent.earned.byBlock;
    agent.earned.today = 0;
    agent.earned.byBlock = {};
    agent.snitchedToday = false;
  }
  state.early = [];
  return night;
}

/**
 * Every night the NPC robbers break into the pad with the most in its stash (D24, D44: wealth makes you a target, and
 * a stash is never immune). Anyone still on a guard job or contract for the owner, and standing in the projects, is
 * in their way; so is the owner's Stealth. Everyone knows it's coming: it is in every day's forecast.
 */
function nightJob(ctx, day) {
  const { cfg, map, state, t } = ctx;
  const n = cfg.nightJob;
  // a boss's pad holds the crew pot too, so it counts, and it's taken from
  const potOf = a => potAt(state, a)?.pot ?? 0;
  const target = agentsIn(state).filter(a => a.stash + potOf(a) >= n.minStash).sort((a, b) => b.stash + potOf(b) - (a.stash + potOf(a)) || a.seat - b.seat)[0];
  if (!target) return null;
  const home = Object.keys(map.blocks).find(b => map.blocks[b].pads);
  // whoever was guarding the owner as the day ended is still at the door
  const guards = (state.nightGuards?.[target.id] ?? []).map(id => state.agents[id]).filter(g => g.state === 'free');
  let strength = n.strength + n.perDay * day;
  for (const g of guards) strength -= g.cls === 'muscle' ? cfg.contest.bodyguard * level(g, 'bodyguard') + cfg.contest.bodyguardToughness * Math.max(1, level(g, 'toughness')) : cfg.contest.hiredGuardToughness * Math.max(1, level(g, 'toughness'));
  const roll = rollContest(cfg, state, 'breakin', null, target, { t, strength, attackerKey: 'npc:night', defenderBlock: home });
  ctx.rolls.push({ kind: 'the night job', attacker: 'npc:robber1', defender: target.id, P: roll.P, roll: roll.roll, outcome: roll.outcome, why: roll.why, decidedBy: roll.decidedBy });
  for (const d of roll.decidedBy) ctx.decided.push({ ...d, what: 'kept the night robbers out of the stash' });
  for (const g of guards) xpRisk(cfg, g, 'a guard job that got tested');
  const rollData = { P: roll.P, roll: roll.roll, outcome: roll.outcome, why: roll.why, decidedBy: roll.decidedBy };
  if (!roll.won) {
    emit(ctx, 'night:job:off', { block: home, spot: `door:${target.id}`, who: { agent: target.id, owner: target.id, guard: guards[0]?.id, robber1: 'npc:robber1', robber2: 'npc:robber2' }, data: { roll: rollData, guards: guards.map(g => g.id) } });
    tell(state, target.id, t, `The Dunn brothers tried your pad in the night${guards.length ? ' and ' + guards[0].name + ' saw them off' : ' and got nowhere'}.`);
    for (const g of guards) trustMark(state, cfg, target.id, g.id, +1, 'kept your stash safe', t);
    return { target: target.id, lost: 0, guards: guards.map(g => g.id), outcome: roll.outcome };
  }
  const pct = roll.outcome === 'clean' ? n.cleanStashPct : n.messyStashPct;
  const fromStash = Math.floor((target.stash * pct) / 100);
  const fromPot = Math.floor((potOf(target) * pct) / 100);
  target.stash -= fromStash;
  if (fromPot > 0) potAt(state, target).pot -= fromPot;
  const lost = fromStash + fromPot;
  if (lost > 0) state.books.out['night robbers'] = (state.books.out['night robbers'] ?? 0) + lost;
  emit(ctx, 'night:job', { block: home, spot: `door:${target.id}`, who: { agent: target.id, owner: target.id, robber1: 'npc:robber1', robber2: 'npc:robber2' }, data: { lost, roll: rollData, guards: guards.map(g => g.id) } });
  tell(state, target.id, t, `The Dunn brothers broke into your pad in the night and took ${lost} from your stash. A guard for the night would have been in their way.`);
  return { target: target.id, lost, guards: guards.map(g => g.id), outcome: roll.outcome };
}

/** Spend the points of every seat without an owner, down its build order. Returns what each bought. */
export function levelUpDefaults(cfg, state, { includeOwners = false } = {}) {
  const bought = [];
  for (const agent of agentsIn(state)) {
    if (agent.owner && !includeOwners) continue;
    const skills = spendDefault(cfg, agent, agent.build ?? undefined);
    if (skills.length) bought.push({ id: agent.id, skills });
  }
  return bought;
}

/** The final bell: crew pots are split evenly among the members still in, then everyone is ranked. */
export function finalBell(ctx) {
  const { cfg, state, t } = ctx;
  // nothing stays hidden at the bell: held pay goes back, and what players owe each other is settled from what they have
  closeDayHolds(ctx);
  for (const loan of state.loans) {
    if (loan.status !== 'open' && loan.status !== 'overdue') continue;
    const borrower = state.agents[loan.borrower];
    const lender = state.agents[loan.lender];
    let paid = Math.min(borrower.cash, loan.owed);
    borrower.cash -= paid;
    const fromStash = Math.min(borrower.stash, loan.owed - paid);
    borrower.stash -= fromStash;
    paid += fromStash;
    lender.stash += paid;
    loan.owed -= paid;
    if (loan.owed === 0) loan.status = 'repaid';
  }
  for (const crew of Object.values(state.crews)) {
    if (crew.pot <= 0 || crew.members.length === 0) continue;
    const share = Math.floor(crew.pot / crew.members.length);
    for (const id of crew.members) state.agents[id].stash += share;
    state.agents[crew.boss].stash += crew.pot - share * crew.members.length; // the odd dollars stay with the chair
    crew.split = share;
    crew.pot = 0;
  }
  const ranked = rankAgents(state);
  state.phase = 'over';
  state.final = ranked.map(r => ({ id: r.id, rank: r.rank, worth: r.worth, stash: r.stash, player: !!state.agents[r.id].player }));
  // in a small lobby the season is won by the richest owner's agent; the locals are the city, not the contestants
  state.winner = (state.final.find(r => r.player) ?? state.final[0]).id;
  emit(ctx, 'final', { data: { rows: state.final, day: dayOf(cfg, t) } });
  return state.final;
}
