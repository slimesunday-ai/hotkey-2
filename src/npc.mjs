// NPCs and the trouble director (SPEC section 9).
// The trouble is deterministic per seed and announced in advance, so agents can plan and viewers feel it coming
// (RimWorld's storyteller, not dice out of nowhere). At noon each day the game publishes the forecast.
// Wealth makes you a target: NPC robbers pick the richest carrier and the rival crew picks the top earner's block.

import { rng } from './rng.mjs';
import { blockIds, blocksWith, theBlock } from './map.mjs';
import { demandAfterHour, FULL_DEMAND } from './market.mjs';
import { take, tell } from './ledger.mjs';
import { agentsIn, agentsOn, isFree, dayOf, hourOfDay } from './state.mjs';
import { level, xpRisk, xpBeating } from './skills.mjs';
import { rollContest, guardsOf } from './contest.mjs';
import { toClinic, arrest } from './held.mjs';
import { rollSummary, policeOn, officerOn } from './work.mjs';
import { emit } from './stage.mjs';
import { RIVAL_CREW_NAME, NPC_ROBBERS_NAME } from './cast.mjs';

/** A weighted pick: `weights` is { key: weight }. Deterministic for the same generator. */
function pickWeighted(r, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let x = r() * total;
  for (const [key, w] of entries) {
    x -= w;
    if (x < 0) return key;
  }
  return entries[entries.length - 1][0];
}

/** Draw the day's forecast: the police schedule, where the NPC robbers work tonight, where the rival crew pushes. */
export function drawForecast(cfg, map, state, day) {
  const H = cfg.season.hoursPerDay;
  const r = rng(state.seed, 'forecast', day);
  const blocks = blockIds(map);
  const bias = blocksWith(map, 'policeBias')[0] ?? null;
  const station = theBlock(map, 'police');

  // Police: two units in two-hour stints, drawn toward yesterday's hottest blocks. One is always uptown until 18:00.
  const schedule = [];
  for (let unit = 0; unit < cfg.police.units; unit++) {
    const hours = [];
    let at = null;
    for (let h = 0; h < H; h++) {
      if (unit === 0 && bias && h < cfg.police.uptownUntil) {
        hours.push(bias);
        continue;
      }
      if (h % 2 === 0 || at === null || (map.blocks[at].noPoliceFrom !== undefined && h >= map.blocks[at].noPoliceFrom)) {
        const weights = {};
        for (const b of blocks) {
          if (map.blocks[b].noPoliceFrom !== undefined && h >= map.blocks[b].noPoliceFrom) continue;
          weights[b] = 1 + 2 * state.blocks[b].crimesYesterday + (b === station ? 1 : 0);
        }
        at = pickWeighted(r, weights);
      }
      hours.push(at);
    }
    schedule.push(hours);
  }

  // NPC robbers: from 20:00 on their home block; from day 3, a second block where the most money was made yesterday.
  const earnedOn = {};
  for (const a of agentsIn(state)) for (const [b, n] of Object.entries(a.earned.byBlockYesterday)) earnedOn[b] = (earnedOn[b] ?? 0) + n;
  const robberBlocks = [blocksWith(map, 'robberHome')[0] ?? blocks[0]];
  if (day >= cfg.npcRobbers.twoBlocksFromDay) {
    const second = blocks.filter(b => b !== robberBlocks[0] && map.blocks[b].buyers).sort((a, b) => (earnedOn[b] ?? 0) - (earnedOn[a] ?? 0) || blocks.indexOf(a) - blocks.indexOf(b))[0];
    if (second) robberBlocks.push(second);
  }

  // The rival crew: from day 2, one push, onto the block where yesterday's top earner made the most.
  let rival = null;
  if (day >= cfg.rivalCrew.fromDay) {
    const turf = blocksWith(map, 'rivalTurf');
    const top = agentsIn(state).slice().sort((a, b) => b.earned.yesterday - a.earned.yesterday || a.seat - b.seat)[0];
    const best = Object.entries(top?.earned.byBlockYesterday ?? {}).filter(([b]) => turf.includes(b)).sort((a, b) => b[1] - a[1])[0];
    const block = best ? best[0] : turf[Math.floor(r() * turf.length)];
    rival = { hour: 2 + Math.floor(r() * (H - 4)), block };
  }

  return { day, police: schedule, robbers: { fromHour: cfg.npcRobbers.fromHour, blocks: robberBlocks }, rival };
}

/** Start of a day: publish the forecast. */
export function startDay(ctx, day) {
  const { cfg, map, state } = ctx;
  state.forecast = drawForecast(cfg, map, state, day);
  state.police.schedule = state.forecast.police;
  emit(ctx, 'forecast', { data: { day, robbers: state.forecast.robbers, rival: state.forecast.rival } });
  houseBounty(ctx, day);
}

/**
 * The house bounty (as in hotkey mini): each noon the rival crew puts a price on the leader's head, a paid job on the
 * board that anyone can take. Wealth draws fire with a face on it, and a city of careful players still has a reason
 * to move against the one in front. The money is the house's: it comes into the city only if someone earns it.
 */
function houseBounty(ctx, day) {
  const { cfg, state, t } = ctx;
  const leader = state.standings?.rows[0]?.id;
  if (day < cfg.houseBounty.fromDay || !leader) return;
  const pay = cfg.houseBounty.pay;
  const offer = {
    id: `o${++state.ids.o}`, from: 'npc:rival1', to: 'anyone', terms: { kind: 'job', task: { type: 'rob', agent: leader }, pay }, t, visibleAt: t,
    expires: day * cfg.season.hoursPerDay, status: 'open', held: pay, house: true,
  };
  state.books.in['house bounty'] = (state.books.in['house bounty'] ?? 0) + pay;
  state.offers.push(offer);
  emit(ctx, 'job:posted', { block: state.npcs['npc:rival1'].block, who: { poster: 'npc:rival1' }, data: { offer: offer.id, task: offer.terms.task, pay, to: 'anyone', house: true }, big: true });
  tell(state, leader, t, `${RIVAL_CREW_NAME} have put ${pay} on your head: a job on the board for anyone who robs you today.`);
}

/** Where the police are at hour `t`. */
export function setPolice(ctx) {
  const { cfg, state, t } = ctx;
  const h = hourOfDay(cfg, t);
  state.police.blocks = state.police.schedule.map(unit => unit[h]);
}

/** The police schedule an agent can see: the next 3 hours, 6 with Street Sense, the rest of the day with a route tip. */
export function policeAhead(cfg, state, t, hours) {
  const H = cfg.season.hoursPerDay;
  const h = hourOfDay(cfg, t);
  const out = [];
  for (let i = 0; i < hours && h + i < H; i++) out.push({ hour: cfg.season.firstHour + h + i, blocks: state.police.schedule.map(unit => unit[h + i]) });
  return out;
}

/** Step 2: anyone with 3 or more stars standing where the police are is arrested. */
export function policeArrests(ctx) {
  const { cfg, state } = ctx;
  for (const agent of agentsIn(state)) {
    if (!isFree(agent) || agent.heat < cfg.heat.arrestAt || !policeOn(state, agent.block)) continue;
    arrest(ctx, agent, { officer: officerOn(state, agent.block), why: 'too hot' });
  }
}

/** The day's trouble strength multiplier: last call is worse. */
const troublePct = (cfg, day) => (day >= cfg.season.lastCallDay ? cfg.season.lastCallTroublePct : 100);

/** A stand-in defender or attacker for an NPC in a contest. */
const npcSide = (id, name, block) => ({ id, name, block, state: 'free', crew: null, skills: {}, goods: { chems: 0, parts: 0, product: {}, guns: {} } });

/** Step 8: NPC robbers, the rival crew, angry buyers. */
export function npcTrouble(ctx) {
  const { cfg, map, state, t } = ctx;
  const day = dayOf(cfg, t);
  const h = hourOfDay(cfg, t);

  // ---- NPC robbers: tonight's blocks, plus anywhere the quiet-street rule sent them
  const robberBlocks = new Set(h >= state.forecast.robbers.fromHour ? state.forecast.robbers.blocks : []);
  for (const early of state.early) {
    if (early.t !== t) continue;
    // sent to wherever the most cash is being carried right now
    const cashOn = {};
    for (const a of agentsIn(state)) if (isFree(a)) cashOn[a.block] = (cashOn[a.block] ?? 0) + a.cash;
    const block = Object.entries(cashOn).sort((a, b) => b[1] - a[1] || blockIds(map).indexOf(a[0]) - blockIds(map).indexOf(b[0]))[0];
    if (block && block[1] >= cfg.quietMinCash) robberBlocks.add(block[0]);
  }
  state.early = state.early.filter(e => e.t > t);
  const strength = Math.floor(((cfg.npcRobbers.strength + cfg.npcRobbers.perDay * day) * troublePct(cfg, day)) / 100);
  // two scores a night and they go home; a hit the quiet-street rule sent always lands
  state.robberHits ??= { day: 0, n: 0 };
  if (state.robberHits.day !== day) state.robberHits = { day, n: 0 };
  for (const block of robberBlocks) {
    const sent = !(h >= state.forecast.robbers.fromHour && state.forecast.robbers.blocks.includes(block));
    if (!sent && state.robberHits.n >= cfg.npcRobbers.hitsPerNight) continue;
    if (robbersHit(ctx, block, strength) && !sent) state.robberHits.n += 1;
  }

  // ---- the rival crew's push
  const rival = state.forecast.rival;
  if (rival && rival.hour === h) rivalPush(ctx, rival.block, Math.floor(((cfg.rivalCrew.strength + cfg.rivalCrew.perDay * day) * troublePct(cfg, day)) / 100));

  // ---- angry buyers: the same face, back about the bad batch
  for (const angry of state.angry.filter(a => a.t <= t)) {
    const dealer = state.agents[angry.dealer];
    state.buyers[angry.buyer].angryAt = null;
    if (!isFree(dealer)) continue;
    const buyer = npcSide(angry.buyer, state.npcs[angry.buyer].name, dealer.block);
    const roll = rollContest(cfg, state, 'npc', null, dealer, { t, strength: cfg.street.angryStrength, attackerKey: angry.buyer });
    ctx.rolls.push({ kind: 'an angry buyer', attacker: angry.buyer, defender: dealer.id, ...rollSummary(roll) });
    for (const d of roll.decidedBy) ctx.decided.push({ ...d, what: 'saw off an angry buyer' });
    for (const g of guardsOf(state, dealer)) xpRisk(cfg, g, 'a guard job that got tested');
    ctx.tally.npcHits += 1;
    if (roll.won) {
      const lost = take(state, dealer, Math.floor((dealer.cash * cfg.street.angryCashPct) / 100), 'angry buyers');
      xpBeating(cfg, dealer);
      emit(ctx, 'npc:angry:lose', { block: dealer.block, who: { buyer: buyer.id, dealer: dealer.id }, data: { lost, roll: rollSummary(roll) } });
      tell(state, dealer.id, t, `${buyer.name} came back angry about the bad batch, put you down and took $${lost}.`);
      toClinic(ctx, dealer, cfg.street.angryClinicHours);
    } else {
      emit(ctx, 'npc:angry:win', { block: dealer.block, who: { buyer: buyer.id, dealer: dealer.id }, data: { roll: rollSummary(roll) } });
      tell(state, dealer.id, t, `${buyer.name} came back angry about the bad batch. You saw them off.`);
    }
  }
  state.angry = state.angry.filter(a => a.t > t);
}

function robbersHit(ctx, block, strength) {
  const { cfg, state, t } = ctx;
  const who = { robber1: 'npc:robber1', robber2: 'npc:robber2' };
  // the richest carrier on the block; Stealth makes you 10% less tempting per level
  const rank = list => list.filter(a => a.cash > 0 && a.safeHour !== t)
    .map(a => ({ a, weight: a.cash * (100 - cfg.skills.stealthRobberPct * level(a, 'stealth')) }))
    .sort((x, y) => y.weight - x.weight || x.a.seat - y.a.seat);
  let targets = rank(agentsOn(state, block));
  // nobody worth robbing on their block: they work the streets next to it
  if (!targets.length) {
    targets = rank(ctx.map.blocks[block].links.flatMap(link => agentsOn(state, link)));
    if (targets.length) block = targets[0].a.block;
  }
  if (!targets.length) {
    emit(ctx, 'npc:robbers:prowl', { block, who, data: {} });
    return false;
  }
  const target = targets[0].a;
  // a patrolling muscle can scare them off
  for (const id of ctx.patrols[block] ?? []) {
    const muscle = state.agents[id];
    if (!isFree(muscle)) continue;
    const pct = cfg.npcRobbers.intimidatePct * level(muscle, 'intimidate');
    if (Math.floor(ctx.rand('scare', block, id)() * 100) < pct) {
      xpRisk(cfg, muscle, 'scaring off NPC trouble');
      ctx.decided.push({ agent: muscle.id, skill: 'intimidate', value: pct, without: 'a robbery', side: 'd', what: `scared ${NPC_ROBBERS_NAME} off the ${block}` });
      ctx.tally.npcHits += 1;
      emit(ctx, 'npc:robbers:scared', { block, who: { ...who, muscle: muscle.id }, data: { saved: target.id } });
      tell(state, target.id, t, `${NPC_ROBBERS_NAME} came for you at the ${block}. ${muscle.name}'s patrol scared them off.`);
      return true;
    }
  }
  const roll = rollContest(cfg, state, 'npc', null, target, { t, strength, attackerKey: 'npc:robbers' });
  ctx.rolls.push({ kind: NPC_ROBBERS_NAME, attacker: 'npc:robber1', defender: target.id, ...rollSummary(roll) });
  for (const d of roll.decidedBy) ctx.decided.push({ ...d, what: `held off ${NPC_ROBBERS_NAME}` });
  for (const g of guardsOf(state, target)) xpRisk(cfg, g, 'a guard job that got tested');
  ctx.tally.npcHits += 1;
  if (roll.won) {
    const clean = roll.outcome === 'clean';
    const lost = take(state, target, Math.floor((target.cash * (clean ? cfg.npcRobbers.cleanCashPct : cfg.npcRobbers.messyCashPct)) / 100), 'npc robbers');
    xpBeating(cfg, target);
    target.stats.robbedBy += 1;
    emit(ctx, clean ? 'npc:robbers:clean' : 'npc:robbers:messy', { block, who: { ...who, target: target.id }, data: { lost, roll: rollSummary(roll) } });
    tell(state, target.id, t, `${NPC_ROBBERS_NAME} hit you at the ${block} and took $${lost}.`);
    if (clean) toClinic(ctx, target, 1);
  } else {
    emit(ctx, 'npc:robbers:fail', { block, who: { ...who, target: target.id }, data: { roll: rollSummary(roll) } });
    tell(state, target.id, t, `${NPC_ROBBERS_NAME} came for you at the ${block}. You saw them off.`);
  }
  return true;
}

function rivalPush(ctx, block, strength) {
  const { cfg, state, t } = ctx;
  const here = state.blocks[block];
  const who = { rival1: 'npc:rival1', rival2: 'npc:rival2', rival3: 'npc:rival3' };
  const marks = agentsOn(state, block).filter(a => a.cls === 'dealer' || a.cls === 'smuggler');
  emit(ctx, 'npc:rival:push', { block, who, data: { strength } });
  let heldOff = false;
  for (const agent of marks) {
    const holder = here.turf === agent.id;
    // pay the toll, or fight: a turf holder always fights for the corner, and so does anyone who can't pay
    if (!holder && agent.cash >= cfg.rivalCrew.toll) {
      const paid = take(state, agent, cfg.rivalCrew.toll, 'rival crew');
      ctx.tally.npcHits += 1;
      emit(ctx, 'npc:rival:toll', { block, who: { ...who, agent: agent.id }, data: { paid } });
      tell(state, agent.id, t, `${RIVAL_CREW_NAME} pushed onto the ${block}. You paid their $${paid} toll.`);
      continue;
    }
    const roll = rollContest(cfg, state, 'npc', null, agent, { t, strength, attackerKey: 'npc:rival' });
    ctx.rolls.push({ kind: RIVAL_CREW_NAME, attacker: 'npc:rival1', defender: agent.id, ...rollSummary(roll) });
    for (const d of roll.decidedBy) ctx.decided.push({ ...d, what: `stood up to ${RIVAL_CREW_NAME}` });
    for (const g of guardsOf(state, agent)) xpRisk(cfg, g, 'a guard job that got tested');
    if (agent.cls === 'dealer') xpRisk(cfg, agent, 'a turf fight');
    ctx.tally.npcHits += 1;
    if (roll.won) {
      xpBeating(cfg, agent);
      emit(ctx, 'npc:rival:lose', { block, who: { ...who, agent: agent.id }, data: { roll: rollSummary(roll), lostTurf: holder } });
      tell(state, agent.id, t, `${RIVAL_CREW_NAME} pushed onto the ${block} and put you down${holder ? '. The corner is theirs until midnight' : ''}.`);
      if (holder) here.turf = null;
      toClinic(ctx, agent, 1);
    } else {
      if (holder) heldOff = true;
      emit(ctx, 'npc:rival:win', { block, who: { ...who, agent: agent.id }, data: { roll: rollSummary(roll) } });
      tell(state, agent.id, t, `${RIVAL_CREW_NAME} pushed onto the ${block}. You sent them home.`);
    }
  }
  if (!heldOff && ctx.map.blocks[block].buyers && (here.turf === null || !marks.some(a => a.id === here.turf))) here.turf = 'rival';
}

/**
 * The street never goes quiet (D25). After 2 hours in a row with no big beat, the next NPC trouble comes early: it's
 * announced now, everyone sees it in their next view, and it lands next hour wherever the most cash is carried.
 */
export function quietStreet(ctx) {
  const { cfg, state, t } = ctx;
  if (ctx.beats > 0) {
    state.quiet = 0;
    state.lastBeat = t;
    return;
  }
  state.quiet += 1;
  const lastHour = hourOfDay(cfg, t) === cfg.season.hoursPerDay - 1;
  if (state.quiet >= cfg.quietHours && !state.early.length && !lastHour && t >= cfg.quietFromHour) {
    state.early.push({ t: t + 1 });
    emit(ctx, 'forecast:early', { data: { at: t + 1, who: NPC_ROBBERS_NAME } });
    for (const a of agentsIn(state)) tell(state, a.id, t, `Word on the street: ${NPC_ROBBERS_NAME} are out early, coming next hour for whoever is carrying the most cash.`);
  }
}

/** End of the hour on the street: demand creeps back, and regulars nobody served get hungrier. */
export function streetHour(ctx) {
  const { cfg, map, state, t } = ctx;
  for (const block of blocksWith(map, 'buyers')) {
    const here = state.blocks[block];
    here.demand = demandAfterHour(cfg, here.demand ?? FULL_DEMAND);
    const open = hourOfDay(cfg, t) >= map.blocks[block].buyers.from;
    for (const id of state.regulars[block]) {
      const b = state.buyers[id];
      if (b.lastBoughtT === t) continue;
      if (open && here.soldThisHour === 0) b.craving = Math.min(3, b.craving + 1);
    }
    here.soldThisHour = 0;
  }
}

/** The NPCs a renderer should show on every block this hour, each by name and spot (D42). */
export function npcPresence(ctx) {
  const { cfg, map, state, t } = ctx;
  const h = hourOfDay(cfg, t);
  const out = {};
  const put = (block, entry) => (out[block] ??= []).push(entry);
  for (const block of blocksWith(map, 'buyers')) {
    if (h < map.blocks[block].buyers.from) continue;
    for (const id of state.regulars[block]) {
      const b = state.buyers[id];
      const bought = b.lastBoughtT === t;
      put(block, { id, role: 'buyer', spot: 'street', action: bought ? 'approach' : b.craving >= 2 ? 'crave' : 'idle', craving: b.craving, ...(bought ? { boughtFrom: b.lastBoughtFrom } : {}), ...(b.angryAt ? { angryAt: b.angryAt } : {}) });
    }
  }
  state.police.blocks.forEach((block, i) => {
    const next = state.police.schedule[i]?.[h + 1] ?? null;
    put(block, { id: `npc:police${i + 1}`, role: 'police', spot: 'street', action: 'patrol', ...(next && next !== block ? { headingTo: next } : {}) });
  });
  for (const npc of Object.values(state.npcs)) {
    if (['fence', 'gunshop', 'supplier', 'shopkeeper'].includes(npc.role) && npc.block) put(npc.block, { id: npc.id, role: npc.role, spot: npc.spot, action: 'idle' });
  }
  if (h >= state.forecast.robbers.fromHour) for (const block of state.forecast.robbers.blocks) for (const id of ['npc:robber1', 'npc:robber2']) put(block, { id, role: 'npcRobber', spot: 'street', action: 'lean' });
  const rival = state.forecast.rival;
  if (rival && h >= rival.hour) for (const id of ['npc:rival1', 'npc:rival2', 'npc:rival3']) put(rival.block, { id, role: 'rival', spot: 'street', action: 'lookout' });
  else for (const id of ['npc:rival1', 'npc:rival2', 'npc:rival3']) put(state.npcs[id].block, { id, role: 'rival', spot: 'street', action: 'lean' });
  return out;
}
