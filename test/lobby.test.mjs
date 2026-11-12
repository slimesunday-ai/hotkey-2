// The fourth tuning pass's rules and the small lobby (SPEC section 23).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.mjs';
import { createGame, playBotSeason } from '../src/season.mjs';
import { buildLineup, seatIndex } from '../src/lineups.mjs';
import { hourContext } from '../src/resolve.mjs';
import { buildView } from '../src/view.mjs';
import { arrest } from '../src/held.mjs';
import { AGENDAS } from '../src/bots.mjs';
import { checkBooks } from '../src/ledger.mjs';

const lobby = seed => playBotSeason({ seed, lineup: buildLineup('small:dealer,robber') });

test('a small lobby: the named seats are players, everyone else is a local with an agenda', () => {
  const game = createGame({ seed: 3, lineup: buildLineup('small:dealer,robber') });
  const { state } = game;
  const dealer = state.agents[state.order[seatIndex(CONFIG, 'dealer')]];
  const robber = state.agents[state.order[seatIndex(CONFIG, 'robber')]];
  assert.deepEqual(state.players, [dealer.id, robber.id]);
  for (const id of state.order) {
    const a = state.agents[id];
    assert.equal(a.player, id === dealer.id || id === robber.id);
    assert.equal(a.local, !a.player);
    if (a.local) assert.equal(a.agenda, AGENDAS[a.cls][a.lean], `${a.name} wears its agenda`);
  }
  // a player sees each local's agenda in the cast list, and nothing of the kind for the other player
  const view = buildView(hourContext({ cfg: game.cfg, map: game.map, state }), dealer);
  for (const c of view.cast) {
    if (c.id === robber.id) assert.equal(c.known, undefined);
    else assert.equal(c.known, state.agents[c.id].agenda);
  }
});

test('a season with no players has no locals: bots are contestants', () => {
  const { state } = createGame({ seed: 3 });
  assert.deepEqual(state.players, []);
  for (const id of state.order) assert.equal(state.agents[id].local, false);
});

test('a small lobby is won by the richest player, even when a local ends richer', () => {
  let localRicher = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const { state } = lobby(seed);
    const winner = state.final.find(r => r.id === state.winner);
    assert.equal(winner.player, true, `seed ${seed}: the winner is a player`);
    const bestPlayer = state.final.filter(r => r.player).sort((a, b) => a.rank - b.rank)[0];
    assert.equal(state.winner, bestPlayer.id);
    if (state.final[0].player === false) localRicher += 1;
    assert.equal(checkBooks(state).ok, true, `seed ${seed}: the books balance`);
  }
  assert.ok(localRicher >= 1, 'the test covers a season where a local ended richer');
});

test('a local has no confessional booth; a player does', () => {
  const { state } = lobby(2);
  for (const id of state.order) {
    const a = state.agents[id];
    if (a.local) assert.equal(a.confessionals.length, 0, `${a.name} is a local`);
  }
  assert.ok(state.players.some(id => state.agents[id].confessionals.length > 0));
});

test('the house bounty: from day 2, each noon, the Sixes put $75 on the leader, as a job on the board', () => {
  const game = playBotSeason({ seed: 4 });
  const posted = [];
  for (const line of game.feed) {
    for (const e of line.events ?? []) if (e.kind === 'job:posted' && e.data?.house) posted.push({ day: line.day, ...e });
  }
  assert.deepEqual(posted.map(p => p.day), [2, 3, 4, 5]);
  for (const p of posted) {
    assert.equal(p.who.poster, 'npc:rival1');
    assert.equal(p.data.pay, CONFIG.houseBounty.pay);
    assert.equal(p.data.task.type, 'rob');
    // the leader as the day began
    const night = game.nights[p.day - 2];
    assert.equal(p.data.task.agent, night.standings[0].id);
    assert.equal(p.data.to, 'anyone');
  }
  assert.equal(checkBooks(game.state).ok, true);
});

test('a sting is a short hold: one hour, no fine, nothing else seized, heat unchanged', () => {
  const game = createGame({ seed: 1 });
  const { state } = game;
  const gunrunner = state.agents[state.order[seatIndex(CONFIG, 'gunrunner')]];
  gunrunner.cash = 300;
  gunrunner.heat = 2;
  gunrunner.goods.product = { 2: 4 };
  const ctx = hourContext({ cfg: game.cfg, map: game.map, state });
  arrest(ctx, gunrunner, { why: 'a police sting', scene: false, light: CONFIG.guns.stingHours });
  assert.equal(gunrunner.state, 'jail');
  // the rest of the hour it was caught in, and one hour in the cell
  assert.equal(gunrunner.until - state.t, 1 + CONFIG.guns.stingHours);
  assert.equal(gunrunner.cash, 300);
  assert.equal(gunrunner.heat, 2);
  assert.deepEqual(gunrunner.goods.product, { 2: 4 });
});

test('a turf holder sells at a better price than an open block, and others on its block at a worse one', () => {
  assert.ok(CONFIG.street.turfHolderPct > 100);
  assert.ok(CONFIG.street.turfOtherPct < 100);
});
