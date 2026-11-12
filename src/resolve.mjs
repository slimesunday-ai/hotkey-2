// Resolving an hour (SPEC section 10). Deterministic: same seed and same replies, same season, byte for byte.
//
//  1. Releases: whoever's jail or clinic time is up walks out.
//  2. Police arrests, on the blocks people stood on at the start of the hour.
//  3. Guards step toward their clients.
//  4. Attacks, in a seeded shuffled order, before anyone moves (D64).
//  5. Movement. Guards on duty move with their clients.
//  6. Hand-offs, then accepts, offers and listings, stashing, resting, crew actions, loans due.
//  7. Work.
//  8. NPC trouble, guards' pay, talk, the quiet-street rule.
//  9. The hour's feed line.

import { rng, shuffle } from './rng.mjs';
import { neighbors, stepToward, theBlock } from './map.mjs';
import { agentsIn, agentsOn, isFree, dayOf, hourOfDay, netWorth } from './state.mjs';
import { checkBooks, tell } from './ledger.mjs';
import { emit } from './stage.mjs';
import { releases } from './held.mjs';
import { doAttack, discoverBreakIns } from './attacks.mjs';
import { doWork, policeOn } from './work.mjs';
import { postOffer, acceptOffer, settlePickups, expireOffers, settleLoans, payGuards, guardDuties, quitWork } from './deals.mjs';
import { crewMove, joinCrew } from './crews.mjs';
import { spoilTipsOn, dropOldTips } from './tips.mjs';
import { setPolice, policeArrests, npcTrouble, quietStreet, streetHour, npcPresence } from './npc.mjs';
import { rankAgents } from './night.mjs';

export const VERBS = Object.freeze(['move', 'work', 'attack', 'offer', 'stash', 'rest', 'crew', 'quit']);
export const SAY_MAX = 140;
export const MESSAGE_MAX = 200;
export const CONFESSIONAL_MAX = 240;

/** Where on its block an agent stands, as a spot the city knows: its own pad, or the street. */
const spotOf = agent => (agent.spot === 'pad' ? `pad:${agent.id}` : 'street');

const clip = (text, max) => (typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** A fresh tally of what happened in an hour, for the marks. */
export function blankTally() {
  return {
    trades: 0, handoffs: 0, couriered: 0, betrayals: 0, jobsDone: 0, robAttempts: 0, robWins: 0, breakIns: 0, fights: 0, turfFights: 0,
    collections: 0, recoveries: 0, arrests: 0, npcHits: 0, crewsFormed: 0, coups: 0, skims: 0, beats: 0, failedMoves: 0, leadChanges: 0,
  };
}

/** Make the context every rule works in for hour `t`. */
export function hourContext({ cfg, map, state, t = state.t }) {
  const ctx = {
    cfg, map, state, t,
    events: [],
    rolls: [], // every contest rolled this hour, for the "show the engine" switch
    risks: [], // every plain chance rolled this hour (a bust, a blow-up, a sting): { what, agent, chance, roll, hit }
    decided: [], // every roll a skill decided (D31)
    tally: blankTally(),
    beats: 0,
    patrols: {}, // block → muscles patrolling it this hour
    dealing: {}, // block → dealers selling on it this hour
    held: new Set(), // agents sent to the clinic or jail this hour: they lose their move
    results: {},
    rand: (...keys) => rng(state.seed, t, ...keys),
    bystanders: block => agentsOn(state, block).map(a => a.id),
    joinCrew,
  };
  return ctx;
}

/** Tidy a raw reply into the shape the resolver uses. Anything malformed becomes nothing rather than an error. */
export function normalizeReply(reply) {
  const out = { move: null, accept: [], say: null, message: null, confessional: null };
  if (!reply || typeof reply !== 'object') return out;
  if (reply.move && typeof reply.move === 'object' && VERBS.includes(reply.move.verb)) out.move = reply.move;
  if (Array.isArray(reply.accept)) out.accept = reply.accept.filter(a => typeof a === 'string' || (a && typeof a.id === 'string')).slice(0, 3);
  const say = typeof reply.say === 'string' ? { text: reply.say } : reply.say;
  if (say && clip(say.text, SAY_MAX)) out.say = { text: clip(say.text, SAY_MAX), ...(typeof say.to === 'string' ? { to: say.to } : {}) };
  if (reply.message && typeof reply.message.to === 'string' && clip(reply.message.text, MESSAGE_MAX)) out.message = { to: reply.message.to, text: clip(reply.message.text, MESSAGE_MAX) };
  if (clip(reply.confessional, CONFESSIONAL_MAX)) out.confessional = clip(reply.confessional, CONFESSIONAL_MAX);
  return out;
}

/** Note who can see whom: you see someone when you share a block (D65). */
function lookAround(state, t) {
  for (const a of agentsIn(state)) {
    if (!isFree(a)) continue;
    for (const b of agentsOn(state, a.block)) if (b.id !== a.id) state.seen[a.id][b.id] = { block: a.block, t };
  }
}

/**
 * Play hour `state.t`. `replies` is { agentId: reply }. Changes the state, moves it on an hour, and returns the
 * hour's feed line.
 */
export function resolveHour({ cfg, map, state, replies }) {
  const t = state.t;
  const ctx = hourContext({ cfg, map, state, t });
  const acts = {};
  for (const id of state.order) acts[id] = normalizeReply(replies[id]);
  const result = (id, ok, text) => {
    ctx.results[id] = { ...(ctx.results[id] ?? {}), ok, text };
    if (!ok) ctx.tally.failedMoves += 1;
  };
  const can = agent => isFree(agent) && !ctx.held.has(agent.id);
  const startedFree = new Set(agentsIn(state).filter(isFree).map(a => a.id));

  setPolice(ctx);

  // 1. releases
  releases(ctx);
  const acting = new Set(agentsIn(state).filter(isFree).map(a => a.id));

  // 2. police arrests
  policeArrests(ctx);

  // 3. guards step toward their clients
  for (const duty of guardDuties(state)) {
    const { guard, client } = duty;
    if (!can(guard) || !isFree(client) || guard.block === client.block) continue;
    const from = guard.block;
    guard.block = stepToward(map, guard.block, client.block);
    guard.spot = 'street';
    emit(ctx, 'move:guard', { block: guard.block, who: { guard: guard.id, client: client.id }, data: { from, to: guard.block } });
  }
  lookAround(state, t);

  // 4. attacks, before anyone moves
  const attackers = shuffle(rng(state.seed, 'attacks', t), state.order.filter(id => acts[id].move?.verb === 'attack'));
  for (const id of attackers) {
    const agent = state.agents[id];
    if (!acting.has(id) || !can(agent)) continue;
    const r = doAttack(ctx, agent, acts[id].move);
    result(id, r.ok, r.ok ? r.text : `couldn't attack: ${r.why}`);
    if (!r.ok) emit(ctx, 'idle', { block: agent.block, spot: spotOf(agent), who: { agent: id }, data: { why: r.why } });
  }

  // 5. movement
  const before = Object.fromEntries(state.order.map(id => [id, state.agents[id].block]));
  for (const id of state.order) {
    const agent = state.agents[id];
    const move = acts[id].move;
    if (move?.verb !== 'move' || !acting.has(id) || !can(agent)) continue;
    if (!neighbors(map, agent.block).includes(move.to)) {
      result(id, false, `couldn't move: the ${move.to} isn't next to the ${agent.block}`);
      emit(ctx, 'idle', { block: agent.block, spot: spotOf(agent), who: { agent: id }, data: { why: 'bad move' } });
      continue;
    }
    agent.block = move.to;
    agent.spot = 'street';
    result(id, true, `walked to the ${move.to}`);
    emit(ctx, 'move', { block: move.to, who: { mover: id }, data: { from: before[id], to: move.to } });
  }
  // a guard on duty who didn't walk off somewhere else moves with its client
  for (const { guard, client } of guardDuties(state)) {
    if (!can(guard) || !isFree(client) || acts[guard.id].move?.verb === 'move') continue;
    if (before[guard.id] === before[client.id] && guard.block !== client.block) {
      guard.block = client.block;
      guard.spot = 'street';
      emit(ctx, 'move:guard', { block: guard.block, who: { guard: guard.id, client: client.id }, data: { from: before[guard.id], to: guard.block } });
    }
  }
  lookAround(state, t);
  discoverBreakIns(ctx);

  // 6. hand-offs, then saying yes, then everything else that isn't work
  settlePickups(ctx);
  const accepters = shuffle(rng(state.seed, 'accepts', t), state.order.filter(id => acts[id].accept.length));
  for (const id of accepters) {
    const agent = state.agents[id];
    // an agent in jail or the clinic can still say yes by phone; the goods wait for it
    for (const entry of acts[id].accept) {
      const r = acceptOffer(ctx, agent, entry);
      (ctx.results[id] ??= { ok: true, text: '' }).accepts = [...(ctx.results[id].accepts ?? []), r.ok ? r.text : `couldn't accept: ${r.why}`];
    }
  }
  for (const id of state.order) {
    const agent = state.agents[id];
    const move = acts[id].move;
    if (!move || !acting.has(id) || !can(agent) || ['attack', 'move', 'work'].includes(move.verb)) continue;
    let r;
    if (move.verb === 'offer') {
      r = postOffer(ctx, agent, move.to, move.terms);
    } else if (move.verb === 'stash') {
      r = stash(ctx, agent, move.amount);
    } else if (move.verb === 'rest') {
      const cooled = agent.heat > 0 && !policeOn(state, agent.block);
      if (cooled) agent.heat = Math.max(0, agent.heat - cfg.heat.restDrop);
      emit(ctx, 'rest', { block: agent.block, spot: agent.block === theBlock(map, 'pads') ? `pad:${id}` : 'street', who: { agent: id }, data: { heat: agent.heat } });
      r = { ok: true, text: cooled ? `lay low: heat down to ${agent.heat}` : agent.heat > 0 ? "lay low, but the police are on the block: the heat didn't drop" : 'rested' };
    } else if (move.verb === 'crew') {
      r = crewMove(ctx, agent, move);
    } else if (move.verb === 'quit') {
      r = quitWork(ctx, agent, move.id);
    }
    result(id, r.ok, r.ok ? r.text : `couldn't ${move.verb}: ${r.why}`);
    if (!r.ok) emit(ctx, 'idle', { block: agent.block, spot: spotOf(agent), who: { agent: id }, data: { why: r.why } });
  }
  expireOffers(ctx);
  settleLoans(ctx);

  // 7. work
  for (const id of state.order) {
    const agent = state.agents[id];
    const move = acts[id].move;
    if (move?.verb === 'work' && agent.cls === 'dealer' && (move.option ?? 'sell') === 'sell' && acting.has(id) && can(agent)) (ctx.dealing[agent.block] ??= []).push(id);
  }
  const workers = shuffle(rng(state.seed, 'work', t), state.order.filter(id => acts[id].move?.verb === 'work'));
  for (const id of workers) {
    const agent = state.agents[id];
    if (!acting.has(id) || !can(agent)) continue;
    const r = doWork(ctx, agent, acts[id].move.option ?? null);
    result(id, r.ok, r.ok ? r.text : `couldn't work: ${r.why}`);
    if (!r.ok) emit(ctx, 'work:none', { block: agent.block, spot: spotOf(agent), who: { agent: id }, data: { why: r.why } });
  }

  // anyone free who did nothing at all stands idle; anyone held sits it out. Nobody is ever frozen.
  for (const id of state.order) {
    const agent = state.agents[id];
    if (ctx.results[id]?.text !== undefined && ctx.results[id].text !== '') continue;
    if (!startedFree.has(id) && !acting.has(id)) {
      ctx.results[id] = { ...(ctx.results[id] ?? {}), ok: true, text: agent.state === 'jail' ? 'sat in a cell' : 'lay in the clinic' };
      emit(ctx, agent.state === 'jail' ? 'held:jail' : 'held:clinic', { block: null, spot: agent.state === 'jail' ? 'cell' : 'bed', who: { agent: id }, data: { until: agent.until } });
    } else if (ctx.held.has(id) || !isFree(agent)) {
      ctx.results[id] = { ...(ctx.results[id] ?? {}), ok: true, text: agent.state === 'jail' ? 'was taken to jail before it could act' : 'was taken to the clinic before it could act' };
    } else {
      ctx.results[id] = { ...(ctx.results[id] ?? {}), ok: !acts[id].move, text: acts[id].move ? "couldn't do that" : 'stood around' };
      if (acts[id].move) ctx.tally.failedMoves += 1;
      agent.stats.idle += 1;
      emit(ctx, 'idle', { block: agent.block, spot: spotOf(agent), who: { agent: id }, data: {} });
    }
  }

  // 8. NPC trouble, then pay for guards who stayed, then talk
  npcTrouble(ctx);
  // who is on guard as the day ends: they are still at their post when the night robbers come (src/night.mjs)
  if (hourOfDay(cfg, t) === cfg.season.hoursPerDay - 1) {
    state.nightGuards = {};
    for (const { guard, client } of guardDuties(state)) {
      if (isFree(guard) && isFree(client) && guard.block === client.block) (state.nightGuards[client.id] ??= []).push(guard.id);
    }
  }
  payGuards(ctx);
  talk(ctx, acts);
  streetHour(ctx);
  dropOldTips(state, t + 1);
  state.loot = state.loot.filter(l => !l.done && (l.until > t || !l.known));

  // a new leader is a big beat, once there's real money in it
  const ranked = rankAgents(state);
  const top = ranked[0];
  if (top.worth >= cfg.start.cash + 50 && state.leader !== top.id && (ranked[1] === undefined || top.worth > ranked[1].worth)) {
    const old = state.leader;
    state.leader = top.id;
    if (old) {
      ctx.tally.leadChanges += 1;
      emit(ctx, 'lead', { data: { leader: top.id, was: old } });
    }
  }

  quietStreet(ctx);
  ctx.tally.beats = ctx.beats;
  // whoever's time is up walks out now, so they have a full menu next hour
  releases(ctx, t + 1);

  const books = checkBooks(state);
  if (!books.ok) throw new Error(`the books don't balance at hour ${t}: expected $${books.expected}, the city holds $${books.actual}${books.negative.length ? `; negative: ${books.negative.join(', ')}` : ''}`);

  // 9. the feed line
  const line = {
    t,
    day: dayOf(cfg, t),
    hour: cfg.season.firstHour + hourOfDay(cfg, t),
    police: state.police.blocks.slice(),
    agents: Object.fromEntries(state.order.map(id => {
      const a = state.agents[id];
      return [id, {
        move: acts[id].move, ...ctx.results[id], block: isFree(a) ? a.block : a.state, state: a.state, cash: a.cash, stash: a.stash, heat: a.heat, worth: netWorth(state, a),
        ...(acts[id].say ? { say: acts[id].say } : {}), ...(acts[id].message ? { message: acts[id].message } : {}), ...(acts[id].confessional ? { confessional: acts[id].confessional } : {}),
      }];
    })),
    events: ctx.events,
    rolls: ctx.rolls,
    risks: ctx.risks,
    decided: ctx.decided,
    npcs: npcPresence(ctx),
    tally: ctx.tally,
  };
  state.t = t + 1;
  return line;
}

/** The `stash` verb: at your pad, put cash in, or (a negative amount) take it out. */
function stash(ctx, agent, amount) {
  const { map, state } = ctx;
  if (agent.block !== theBlock(map, 'pads')) return { ok: false, why: 'your stash is at your pad, in the projects' };
  if (!Number.isInteger(amount) || amount === 0) return { ok: false, why: 'stash a whole number of dollars' };
  if (amount > 0) {
    const put = Math.min(amount, agent.cash);
    if (put === 0) return { ok: false, why: 'you have no cash on you to stash' };
    agent.cash -= put;
    agent.stash += put;
    agent.spot = 'pad';
    spoilTipsOn(state, agent.id);
    emit(ctx, 'stash', { block: agent.block, spot: `pad:${agent.id}`, who: { agent: agent.id }, data: { put } });
    return { ok: true, text: `stashed $${put}` };
  }
  const out = Math.min(-amount, agent.stash);
  if (out === 0) return { ok: false, why: 'your stash is empty' };
  agent.stash -= out;
  agent.cash += out;
  agent.spot = 'pad';
  emit(ctx, 'stash', { block: agent.block, spot: `pad:${agent.id}`, who: { agent: agent.id }, data: { took: out } });
  return { ok: true, text: `took $${out} out of the stash` };
}

/** What was said and sent this hour. Heard next hour by everyone on the block; a message reaches one agent. */
function talk(ctx, acts) {
  const { state, t } = ctx;
  for (const id of state.order) {
    const agent = state.agents[id];
    const { say, message, confessional } = acts[id];
    if (confessional) {
      agent.confessionals.push({ t, text: confessional });
      if (agent.confessionals.length > 12) agent.confessionals.shift();
    }
    if (say && isFree(agent)) {
      const listener = say.to && state.agents[say.to] && isFree(state.agents[say.to]) && state.agents[say.to].block === agent.block ? say.to : null;
      for (const other of agentsOn(state, agent.block)) {
        if (other.id !== id) state.inbox[other.id].heard.push({ t, from: id, text: say.text, ...(listener ? { to: listener } : {}) });
      }
      agent.said.push({ t, text: say.text });
      if (agent.said.length > 4) agent.said.shift();
      emit(ctx, listener ? 'say' : 'say:block', { block: agent.block, spot: agent.spot === 'pad' ? `pad:${id}` : 'street', who: { speaker: id, listener }, say: { text: say.text, ...(listener ? { to: listener } : {}) } });
    }
    if (message && state.agents[message.to] && message.to !== id) {
      state.inbox[message.to].messages.push({ t, from: id, to: message.to, text: message.text });
      state.inbox[id].messages.push({ t, from: id, to: message.to, text: message.text });
      emit(ctx, 'message', { block: isFree(agent) ? agent.block : null, who: { sender: id, receiver: message.to }, say: { text: message.text, to: message.to } });
    }
  }
  for (const id of state.order) {
    const box = state.inbox[id];
    box.heard = box.heard.filter(h => h.t >= t - 1);
    if (box.messages.length > 8) box.messages = box.messages.slice(-8);
    box.happened = box.happened.filter(h => h.t >= t - 3);
  }
}
