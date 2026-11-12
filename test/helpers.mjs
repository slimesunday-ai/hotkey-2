// Shared test helpers: a season in a known state, an hour played with given moves, and a monkey that plays any
// legal menu entry, to shake out crashes.
import { CONFIG, withConfig } from '../src/config.mjs';
import { CITY } from '../src/map.mjs';
import { rng } from '../src/rng.mjs';
import { createSeason, addGood } from '../src/state.mjs';
import { hourContext, resolveHour } from '../src/resolve.mjs';
import { startDay, setPolice } from '../src/npc.mjs';
import { buildView } from '../src/view.mjs';
import { chooseFromMenu } from '../src/menu.mjs';

/** A season ready to play hour 0: forecast drawn. `police` pins where the two units stand all day (or null for none). */
export function newSeason({ seed = 1, cfg = CONFIG, map = CITY, lineup = null, police = undefined, shield = false } = {}) {
  const state = createSeason({ seed, cfg, map, lineup });
  const ctx = hourContext({ cfg, map, state, t: 0 });
  startDay(ctx, 1);
  if (police !== undefined) pinPolice(cfg, state, police);
  // tests start past the season's first-hour shield unless they ask for it
  if (!shield) for (const id of state.order) state.agents[id].safeHour = -1;
  return { cfg, map, state };
}

/** Put both police units on fixed blocks all day (`['precinct', 'precinct']`), or nowhere (`null`). */
export function pinPolice(cfg, state, blocks) {
  const H = cfg.season.hoursPerDay;
  state.police.schedule = (blocks ?? ['nowhere', 'nowhere']).map(b => Array.from({ length: H }, () => b));
  state.forecast.police = state.police.schedule;
}

/** A config with the quiet-street rule switched off, so a test's quiet hours stay quiet. */
export const QUIET = withConfig({ quietFromHour: 9999 });

/** Set what an agent holds in cash and stash, and tell the books, so the hourly conservation check still holds. */
export function fund(state, agent, { cash = agent.cash, stash = agent.stash } = {}) {
  state.books.start += cash - agent.cash + (stash - agent.stash);
  agent.cash = cash;
  agent.stash = stash;
}

/** The first agent of a class (or the nth). */
export function seat(state, cls, n = 0) {
  return state.order.map(id => state.agents[id]).filter(a => a.cls === cls)[n];
}

/** Play one hour with the given moves: `{ a1: { move: {...}, accept: [...] } }`. Returns the feed line. */
export function play(game, replies = {}) {
  return resolveHour({ cfg: game.cfg, map: game.map, state: game.state, replies });
}

/** The context for the hour about to be played, for checks and views. */
export function ctxOf(game) {
  const ctx = hourContext({ cfg: game.cfg, map: game.map, state: game.state });
  setPolice(ctx);
  return ctx;
}

export function viewOf(game, agent) {
  return buildView(ctxOf(game), agent);
}

export { addGood };

/** A monkey: every agent picks a random entry from its menu, accepts random offers and says something. */
export function monkeyReplies(game, salt = 'monkey') {
  const { state } = game;
  const ctx = ctxOf(game);
  const replies = {};
  for (const id of state.order) {
    const agent = state.agents[id];
    const view = buildView(ctx, agent);
    const r = rng(state.seed, salt, state.t, id);
    const reply = {};
    if (view.menu.length) {
      const entry = view.menu[Math.floor(r() * view.menu.length)];
      reply.move = chooseFromMenu(view.menu, { id: entry.id });
    }
    if (view.offers.length && r() < 0.5) reply.accept = [view.offers[Math.floor(r() * view.offers.length)].id];
    if (r() < 0.2) reply.say = { text: `hour ${state.t} from ${agent.name}` };
    if (r() < 0.1) reply.message = { to: state.order[Math.floor(r() * state.order.length)], text: 'you around?' };
    if (r() < 0.3) reply.confessional = `${agent.name} thinking out loud at hour ${state.t}`;
    replies[id] = reply;
  }
  return replies;
}
