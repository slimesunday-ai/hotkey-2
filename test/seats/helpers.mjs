// Shared helpers for the seat-layer and command-line tests (not a test file itself).
// Nothing here touches the network or a real key: the key files are temp files holding a made-up word, and every
// fetch is a stub or a fake's.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGame } from '../../src/season.mjs';
import { buildLineup } from '../../src/lineups.mjs';
import { hourContext, resolveHour } from '../../src/resolve.mjs';
import { setPolice } from '../../src/npc.mjs';
import { buildView } from '../../src/view.mjs';
import { botReply } from '../../src/bots.mjs';

/** A temp folder under the system's temp folder, removed when the test ends. */
export function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hotkey2-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** The made-up word the fake key files hold. Built at run time, so no scanner reads it as a key. */
export const KEY_WORD = ['test', 'only', 'not', 'a', 'key'].join('-');

/** A key file for the live-transport tests. */
export function fakeKeyFile(dir, name = 'key') {
  const file = path.join(dir, name);
  fs.writeFileSync(file, KEY_WORD);
  return file;
}

/** A chat completion body, as OpenRouter returns one. */
export const completion = (content, { cost = 0.001, finish = 'stop', inT = 1000, outT = 50 } = {}) => ({
  id: 'gen-test', model: 'test-model', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: finish }],
  usage: { prompt_tokens: inT, completion_tokens: outT, total_tokens: inT + outT, cost },
});

/** A fetch that answers from a list in order (or from a function), and keeps what it was asked. */
export function stubFetch(answers) {
  const seen = [];
  const f = async (url, init = {}) => {
    const asked = { url: String(url), method: init.method ?? 'GET', headers: new Headers(init.headers), body: init.body };
    seen.push(asked);
    const a = typeof answers === 'function' ? answers(asked) : answers.shift();
    if (!a) throw new Error('stub fetch: no answer left');
    if (a.throws) throw new Error(a.throws);
    return new Response(JSON.stringify(a.body), { status: a.status ?? 200 });
  };
  f.seen = seen;
  return f;
}

/** A reply as a model would write it. */
export const replyText = (move, more = {}) => JSON.stringify({ move, accept: [], say: null, message: null, confessional: 'test', ...more });

/** Moves a manualClock forward in steps until the promise settles, then returns its value. */
export async function drive(promise, clock, step = 1000, max = 2000) {
  let settled = false;
  const p = promise.finally(() => {
    settled = true;
  });
  for (let i = 0; i < max && !settled; i++) await clock.advance(step);
  return p;
}

/** The context and every agent's view for the hour a game is about to play. */
export function viewsOf(game) {
  const ctx = hourContext({ cfg: game.cfg, map: game.map, state: game.state });
  setPolice(ctx);
  return { ctx, views: Object.fromEntries(game.state.order.map(id => [id, buildView(ctx, game.state.agents[id])])) };
}

/**
 * A bot season played up to hour `hours`, with every hour's views kept: a supply of real views (offers, pick-ups,
 * robberies, crews, jail) for the parser and the prompt to be tested on. `replies(game, views, ctx)` can replace
 * the bots' replies.
 */
export function playedViews({ seed = 1, hours = 24, lineup = 'default', replies = null } = {}) {
  const game = createGame({ seed, lineup: buildLineup(lineup) });
  const all = [];
  while (game.state.t < hours && game.state.phase === 'day') {
    const { ctx, views } = viewsOf(game);
    all.push(...Object.values(views));
    const played = replies ? replies(game, views, ctx) : Object.fromEntries(game.state.order.map(id => [id, botReply(ctx, game.state.agents[id], views[id])]));
    resolveHour({ cfg: game.cfg, map: game.map, state: game.state, replies: played });
  }
  return { game, views: all };
}
