// The game played one step at a time, for the page (SPEC section 24). Nothing here uses Node, so the same engine that
// plays the bot seasons runs inside the browser.
//
// Three ways to sit:
//   watch   bots play every seat
//   play    a human picks every move for one seat, from the same view and menu an AI seat gets
//   coach   a bot plays the human's seat; each night the human picks its skills, its stance and one chip
//
// A session is always waiting on one thing (`pending()`), and `step(input)` answers it:
//   { kind: 'sheet', sheet, previews }   the night's level-up sheet (and before hour 0)      → step({ sheet })
//   { kind: 'move', view }               play: this hour's view and menu for the human's seat → step({ reply })
//   { kind: 'hour', view? }              watch and coach: nothing to answer                   → step()
//   { kind: 'over', final, winner }
// `step` returns the feed lines it added (the hour, then a night and the next day's forecast when the day ended).

import { CONFIG } from './config.mjs';
import { CITY } from './map.mjs';
import { createGame, advance, levelUpSheet } from './season.mjs';
import { buildLineup, seatIndex } from './lineups.mjs';
import { hourContext } from './resolve.mjs';
import { setPolice } from './npc.mjs';
import { buildView } from './view.mjs';
import { contestOdds } from './contest.mjs';
import { agentsIn, netWorth } from './state.mjs';
import { botReply } from './bots.mjs';
import { isSealed, sealedCopy } from './stage.mjs';

export const MODES = Object.freeze(['watch', 'play', 'coach']);

/** The seats a human is offered first: the ones with the most to do (SPEC 24.10). Any seat can be asked for. */
export const HUMAN_SEATS = Object.freeze(['dealer', 'robber', 'smuggler', 'cook']);

export function createSession({ seed = 1, mode = 'watch', seat = 'dealer', cfg = CONFIG, map = CITY, saved = null } = {}) {
  if (!MODES.includes(mode)) throw new Error(`no such mode: ${mode}`);
  const lineup = buildLineup('default', cfg);
  const index = mode === 'watch' ? null : seatIndex(cfg, seat);
  // The human's seat is a player among locals (SPEC section 23). In `play` the engine asks for its move the way it
  // asks an AI seat; in `coach` the class's bot plays it.
  if (index !== null) Object.assign(lineup[index], { kind: mode === 'play' ? 'ai' : 'bot', player: true, owner: true, model: mode === 'play' ? 'human' : null });
  // (a saved session carries on from its own state: everything a season needs is in the state and the feed)
  const game = saved ? { cfg, map, state: saved.state, feed: saved.feed, nights: saved.nights } : createGame({ seed, cfg, map, lineup });
  const you = index === null ? null : game.state.order[index];

  /** The view the engine will build for this agent this hour. Reading it changes nothing. */
  function viewOf(id) {
    const ctx = hourContext({ cfg, map, state: game.state });
    setPolice(ctx);
    return buildView(ctx, game.state.agents[id]);
  }

  function pending() {
    const { state } = game;
    // (winner is the engine's rule: the richest owner's agent. `rank` is where the human's seat came among all ten.)
    if (state.phase === 'over') return { kind: 'over', final: state.final, winner: state.winner, you, rank: state.final.find(r => r.id === you)?.rank ?? null, top: state.final[0].id };
    if (state.phase === 'pre' || state.phase === 'night') {
      const agent = state.agents[you];
      const sheet = levelUpSheet(game, agent);
      return { kind: 'sheet', sheet, previews: Object.fromEntries(sheet.canBuy.map(s => [s.skill, skillPreview(game, agent, s.skill)])) };
    }
    if (mode === 'play') return { kind: 'move', view: viewOf(you) };
    return { kind: 'hour', ...(you ? { view: viewOf(you) } : {}) };
  }

  /**
   * Answer what the session is waiting on and play on to the next thing it waits on.
   *   input.sheet   the filled-in level-up sheet (left out: the class's build order spends the points)
   *   input.reply   play: { move: <menu id or move>, accept: [...], say, message, confessional }
   */
  async function step(input = {}) {
    const { state } = game;
    const before = game.feed.length;
    if (state.phase === 'over') return { lines: [], pending: pending() };
    if (state.phase === 'pre' || state.phase === 'night') {
      // the sheet, then the day begins and stops before its first hour
      await advance(game, { pauseNights: true, sheets: you && input.sheet ? { [you]: input.sheet } : {}, untilHour: state.t });
      return { lines: game.feed.slice(before), pending: pending() };
    }
    const seats = {
      decide: async asks => Object.fromEntries(asks.map(a => [a.agentId, a.agentId === you ? input.reply ?? {} : {}])),
      // a human keeps no journal: the night screen is theirs to read, not to write
      journal: async asks => Object.fromEntries(asks.map(a => [a.agentId, { lines: [], ask: null }])),
    };
    await advance(game, { seats, pauseNights: true, untilHour: state.t + 1 });
    return { lines: game.feed.slice(before), pending: pending() };
  }

  /** Play: let the seat's own bot take this hour (an "auto" button, and a human who has walked away). */
  async function auto() {
    if (mode !== 'play' || game.state.phase !== 'day') return step();
    const ctx = hourContext({ cfg, map, state: game.state });
    setPolice(ctx);
    const agent = game.state.agents[you];
    const pick = botReply(ctx, agent, buildView(ctx, agent));
    return step({ reply: { move: pick.move, accept: pick.accept } });
  }

  /** The session as plain data, safe to JSON.stringify between any two steps. `restoreSession` carries on from it. */
  function save() {
    return { v: 1, seed, mode, seat, state: game.state, feed: game.feed, nights: game.nights };
  }

  return { game, mode, you, viewOf, pending, step, auto, save };
}

/** Carry on a saved session (after a page reload, say) from exactly where it stopped. */
export function restoreSession(saved, { cfg = CONFIG, map = CITY } = {}) {
  if (saved?.v !== 1 || !saved.state || !Array.isArray(saved.feed)) throw new Error('not a saved session');
  const copy = structuredClone(saved);
  return createSession({ seed: copy.seed, mode: copy.mode, seat: copy.seat, cfg, map, saved: copy });
}

/**
 * What one seat may see of an hour: the events it took part in or stood on the block for. Watching shows the whole
 * line; playing and coaching show this (SPEC 24.5).
 */
export function witnessed(line, id) {
  const out = [];
  for (const e of line.events ?? []) {
    if (Object.values(e.who ?? {}).includes(id)) out.push(e);
    // someone who only stood near it: private business reaches them sealed (who, where, and nothing else)
    else if (Object.values(e.lists ?? {}).some(list => Array.isArray(list) && list.includes(id))) out.push(isSealed(e) ? sealedCopy(e) : e);
  }
  return out;
}

/**
 * What one more level of a skill does to this agent's real odds right now: [{ label, before, after }], in percent.
 * Empty for a skill that doesn't move a contest (its own text says what it does).
 */
export function skillPreview(game, agent, skill) {
  const { cfg, state } = game;
  const up = structuredClone(agent);
  up.skills[skill] = (up.skills[skill] ?? 0) + 1;
  const others = agentsIn(state).filter(a => a.id !== agent.id);
  const out = [];
  const line = (label, kind, attackers, defenders) => {
    const before = contestOdds(cfg, state, kind, attackers[0], defenders[0]).P;
    const after = contestOdds(cfg, state, kind, attackers[1], defenders[1]).P;
    if (before !== after) out.push({ label, before, after });
  };
  // against the richest of the others: the one most worth going for
  const rich = others.slice().sort((a, b) => netWorth(state, b) - netWorth(state, a) || a.seat - b.seat)[0];
  if (rich) {
    if (agent.cls === 'robber') line(`rob ${rich.name}`, 'rob', [agent, up], [rich, rich]);
    line(`fight ${rich.name}`, 'fight', [agent, up], [rich, rich]);
  }
  // and when the nearest robber comes for you
  const robber = others.find(a => a.cls === 'robber');
  if (robber && agent.cls !== 'robber') line(`${robber.name} robbing you`, 'rob', [robber, robber], [agent, up]);
  return out;
}
