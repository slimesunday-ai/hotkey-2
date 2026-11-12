// A season: 5 days of 12 hours, with a night between each (SPEC section 4).
// The season is a small state machine kept in state.phase, so it can stop for an owner at any night and carry on
// from exactly where it stopped: 'pre' (owners spend their starting points), 'day', 'night' (waiting for owners),
// 'over'. Everything it needs is in the state and the feed, both plain JSON.

import { CONFIG } from './config.mjs';
import { CITY } from './map.mjs';
import { rng } from './rng.mjs';
import { createSeason, dayOf, hourOfDay, totalHours, agentsIn, isFree } from './state.mjs';
import { hourContext, resolveHour, blankTally } from './resolve.mjs';
import { startDay, setPolice } from './npc.mjs';
import { runNight, levelUpDefaults, finalBell } from './night.mjs';
import { buildView } from './view.mjs';
import { chooseFromMenu } from './menu.mjs';
import { botReply, botJournal, AGENDAS } from './bots.mjs';
import { buyable, buySkill, spendDefault, SKILL_TEXT } from './skills.mjs';

export const NOTE_MAX = 200;

/** Start a game: the state, an empty feed, and (when there are no owners) hour 0 ready to play. */
export function createGame({ seed = 1, cfg = CONFIG, map = CITY, lineup = null, run = null } = {}) {
  const state = createSeason({ seed, cfg, map, lineup, run });
  // bots get a lean by seed unless the lineup set one
  for (const agent of agentsIn(state)) {
    if (agent.kind === 'bot' && !agent.lean) agent.lean = rng(seed, 'lean', agent.id)() < 0.5 ? 'bold' : 'careful';
  }
  // every bot has a one-line agenda a player can plan around; a local wears it where a player wears a persona
  for (const agent of agentsIn(state)) {
    if (agent.kind !== 'bot' && !agent.local) continue;
    if (!agent.lean) agent.lean = rng(seed, 'lean', agent.id)() < 0.5 ? 'bold' : 'careful';
    agent.agenda = AGENDAS[agent.cls]?.[agent.lean === 'bold' ? 'bold' : 'careful'] ?? null;
    if (agent.local && !agent.persona) agent.persona = agent.agenda ?? '';
  }
  const game = { cfg, map, state, feed: [], nights: [] };
  state.phase = agentsIn(state).some(a => a.owner) ? 'pre' : 'day';
  if (state.phase === 'day') beginDay(game, 1);
  return game;
}

function beginDay(game, day) {
  const ctx = hourContext({ cfg: game.cfg, map: game.map, state: game.state });
  startDay(ctx, day);
  game.feed.push({ type: 'forecast', day, t: game.state.t, forecast: game.state.forecast, events: ctx.events });
}

/** What an owner can do tonight: unspent points, the skills it can buy, the agent's ask, and an empty note. */
export function levelUpSheet(game, agent) {
  const { cfg, state } = game;
  const journal = agent.journals[agent.journals.length - 1] ?? null;
  return {
    seat: agent.id, name: agent.name, cls: agent.cls,
    night: state.phase === 'pre' ? 0 : dayOf(cfg, state.t - 1),
    points: agent.points,
    skills: agent.skills,
    canBuy: buyable(cfg, agent).map(skill => ({ skill, name: SKILL_TEXT[skill][0], does: SKILL_TEXT[skill][1], level: agent.skills[skill] })),
    ask: journal?.ask ?? null,
    journal: journal?.lines ?? null,
    buy: [], // fill in: skill ids, one per point, in order
    note: '', // fill in: one note to your agent, up to 200 characters. It reads it as you talking, never as an order.
    // a coach's levers, for a seat a bot plays (an AI seat reads the note instead):
    stance: agent.kind === 'bot' ? agent.lean : null, // 'bold' or 'careful'
    focus: agent.kind === 'bot' ? agent.focus : null, // { target: agentId } to go after someone, { avoid: blockId } to stay off a block, or null
  };
}

/** Apply an owner's filled-in sheet. Unknown skills and extra points are ignored; unspent points wait. */
export function applyLevelUp(game, agent, sheet) {
  const { cfg } = game;
  const bought = [];
  for (const skill of Array.isArray(sheet?.buy) ? sheet.buy : []) if (buySkill(cfg, agent, skill)) bought.push(skill);
  const note = typeof sheet?.note === 'string' ? sheet.note.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX) : '';
  agent.note = note || null;
  const out = { id: agent.id, skills: bought, note: agent.note };
  // the coach's stance and chip only steer a seat a bot plays
  if (agent.kind === 'bot') {
    if (sheet?.stance === 'bold' || sheet?.stance === 'careful') agent.lean = sheet.stance;
    const f = sheet?.focus;
    const others = game.state.order.filter(id => id !== agent.id);
    agent.focus = f && others.includes(f.target) ? { target: f.target } : f && game.map.blocks[f.avoid] ? { avoid: f.avoid } : null;
    out.stance = agent.lean;
    out.focus = agent.focus;
  }
  return out;
}

/**
 * Carry the season on until it's over, or until it has to stop for an owner.
 *   seats.decide(asks)     → for AI seats: [{ agentId, view }] in, { agentId: reply } out (may be async)
 *   seats.journal(asks)    → for AI seats: [{ agentId, view }] in, { agentId: { lines, ask } } out
 *   pauseNights            → stop after every night (and before hour 0) when a seat has an owner
 *   sheets                 → { agentId: filledSheet } when resuming from a pause
 * Returns 'over' or 'paused'.
 */
export async function advance(game, { seats = null, pauseNights = false, sheets = null, onHour = null, onNight = null, untilHour = null } = {}) {
  const { cfg, map, state } = game;
  const total = totalHours(cfg);
  const owners = agentsIn(state).filter(a => a.owner);

  // coming back from a pause: owners' sheets, then the day begins
  if (state.phase === 'pre' || state.phase === 'night') {
    if (pauseNights && owners.length && !sheets) return 'paused';
    const bought = [];
    for (const agent of owners) bought.push(sheets?.[agent.id] ? applyLevelUp(game, agent, sheets[agent.id]) : { id: agent.id, skills: spendDefault(cfg, agent, agent.build ?? undefined), note: null });
    const day = state.phase === 'pre' ? 1 : dayOf(cfg, state.t);
    if (owners.length) game.feed.push({ type: 'levelup', day: day - 1, t: state.t, owners: true, bought });
    state.phase = 'day';
    beginDay(game, day);
  }

  while (state.phase === 'day') {
    if (untilHour !== null && state.t >= untilHour) return 'paused';
    const ctx = hourContext({ cfg, map, state });
    setPolice(ctx);
    const replies = {};
    const asks = [];
    for (const agent of agentsIn(state)) {
      const view = buildView(ctx, agent);
      if (agent.kind === 'ai' && seats?.decide) asks.push({ agentId: agent.id, view });
      else replies[agent.id] = botReply(ctx, agent, view);
    }
    if (asks.length) {
      const answered = await seats.decide(asks);
      for (const { agentId, view } of asks) {
        const agent = state.agents[agentId];
        const reply = answered?.[agentId] ?? answered?.get?.(agentId) ?? {};
        const move = chooseFromMenu(view.menu, reply.move);
        // A seat whose model fails three hours running is played by its class's bot until the model answers again,
        // so one broken or absent seat can't stall the city for the other nine. (Held seats have no move to make.)
        const failed = reply.failed === true || (view.menu.length > 0 && !move);
        agent.failStreak = failed ? (agent.failStreak ?? 0) + 1 : 0;
        if (failed && agent.failStreak >= cfg.takeover.afterHours) {
          if (!agent.standIn) {
            agent.standIn = true;
            game.feed.push({ type: 'takeover', t: state.t, agent: agentId, on: true });
          }
          const stand = botReply(ctx, agent, view);
          replies[agentId] = { move: stand.move, accept: stand.accept }; // it plays the seat; it doesn't speak for it
          continue;
        }
        if (agent.standIn && !failed) {
          agent.standIn = false;
          game.feed.push({ type: 'takeover', t: state.t, agent: agentId, on: false });
        }
        replies[agentId] = { ...reply, move };
      }
    }
    const line = resolveHour({ cfg, map, state, replies });
    line.type = 'hour';
    game.feed.push(line);
    if (onHour) await onHour(line, game);

    if (hourOfDay(cfg, state.t) !== 0) continue;
    const day = dayOf(cfg, state.t - 1);
    const nightCtx = hourContext({ cfg, map, state, t: state.t - 1 });
    if (state.t >= total) {
      await journals(game, nightCtx, seats, day);
      const final = finalBell(nightCtx);
      game.feed.push({ type: 'final', day, t: state.t, final, events: nightCtx.events, journals: lastJournals(state) });
      if (onNight) await onNight(game.feed[game.feed.length - 1], game);
      return 'over';
    }
    const night = runNight(nightCtx, day);
    await journals(game, nightCtx, seats, day);
    night.bought = levelUpDefaults(cfg, state);
    game.nights.push(night);
    game.feed.push({ type: 'night', day, t: state.t, ...night, events: nightCtx.events, decided: nightCtx.decided, journals: lastJournals(state) });
    if (onNight) await onNight(game.feed[game.feed.length - 1], game);
    state.phase = 'night';
    if (pauseNights && owners.length) return 'paused';
    // nobody to wait for: owners' seats spend down their build order and the next day begins
    const bought = owners.map(agent => ({ id: agent.id, skills: spendDefault(cfg, agent, agent.build ?? undefined), note: null }));
    if (owners.length) game.feed.push({ type: 'levelup', day, t: state.t, owners: true, bought });
    state.phase = 'day';
    beginDay(game, day + 1);
  }
  return state.phase === 'over' ? 'over' : 'paused';
}

/** Every agent writes its journal: three lines and what it wants from its owner (D62). */
async function journals(game, ctx, seats, day) {
  const { state } = game;
  const asks = [];
  for (const agent of agentsIn(state)) {
    if (agent.variant === 'dead') continue;
    if (agent.kind === 'ai' && seats?.journal) asks.push({ agentId: agent.id, view: buildView({ ...ctx, t: state.t }, agent) });
    else agent.journals.push({ day, ...botJournal(ctx, agent) });
  }
  if (asks.length) {
    const answered = await seats.journal(asks);
    for (const { agentId } of asks) {
      const j = answered?.[agentId] ?? answered?.get?.(agentId) ?? null;
      const lines = Array.isArray(j?.lines) ? j.lines.filter(l => typeof l === 'string').slice(0, 3).map(l => l.slice(0, 200)) : [];
      state.agents[agentId].journals.push({ day, lines, ask: typeof j?.ask === 'string' ? j.ask.slice(0, 160) : null });
    }
  }
}

const lastJournals = state => Object.fromEntries(agentsIn(state).filter(a => a.journals.length).map(a => [a.id, a.journals[a.journals.length - 1]]));

/** Play a whole season with bots in every seat that isn't given an AI. Returns the finished game. */
export async function playSeason(options = {}) {
  const game = createGame(options);
  const result = await advance(game, { seats: options.seats ?? null, onHour: options.onHour ?? null, onNight: options.onNight ?? null });
  if (result !== 'over') throw new Error(`the season stopped at hour ${game.state.t} (${result})`);
  return game;
}

/** The same, with no promises: bots only. For the tuning runs, where speed matters. */
export function playBotSeason({ seed = 1, cfg = CONFIG, map = CITY, lineup = null } = {}) {
  const game = createGame({ seed, cfg, map, lineup });
  const { state } = game;
  const total = totalHours(cfg);
  while (state.t < total) {
    const ctx = hourContext({ cfg, map, state });
    setPolice(ctx);
    const replies = {};
    for (const agent of agentsIn(state)) replies[agent.id] = botReply(ctx, agent, buildView(ctx, agent));
    const line = resolveHour({ cfg, map, state, replies });
    line.type = 'hour';
    game.feed.push(line);
    if (hourOfDay(cfg, state.t) !== 0) continue;
    const day = dayOf(cfg, state.t - 1);
    const nightCtx = hourContext({ cfg, map, state, t: state.t - 1 });
    for (const agent of agentsIn(state)) if (agent.variant !== 'dead') agent.journals.push({ day, ...botJournal(nightCtx, agent) });
    if (state.t >= total) {
      const final = finalBell(nightCtx);
      game.feed.push({ type: 'final', day, t: state.t, final, events: nightCtx.events, journals: lastJournals(state) });
      break;
    }
    const night = runNight(nightCtx, day);
    night.bought = levelUpDefaults(cfg, state, { includeOwners: true });
    game.nights.push(night);
    game.feed.push({ type: 'night', day, t: state.t, ...night, events: nightCtx.events, decided: nightCtx.decided, journals: lastJournals(state) });
    beginDay(game, day + 1);
  }
  return game;
}

export { blankTally, isFree };
