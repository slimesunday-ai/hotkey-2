import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.mjs';
import { CITY } from '../src/map.mjs';
import { createGame, advance, playBotSeason, levelUpSheet } from '../src/season.mjs';
import { buildLineup, seatIndex } from '../src/lineups.mjs';
import { checkBooks } from '../src/ledger.mjs';
import { totalHours, netWorth } from '../src/state.mjs';
import { newSeason, play, monkeyReplies, seat } from './helpers.mjs';
import { hourContext } from '../src/resolve.mjs';
import { runNight, levelUpDefaults, finalBell } from '../src/night.mjs';
import { startDay } from '../src/npc.mjs';

const bytes = game => JSON.stringify({ state: game.state, feed: game.feed });

test('same seed, same season, byte for byte', () => {
  const a = playBotSeason({ seed: 7 });
  const b = playBotSeason({ seed: 7 });
  assert.equal(bytes(a), bytes(b));
  const c = playBotSeason({ seed: 8 });
  assert.notEqual(bytes(a), bytes(c));
});

test('a bot season plays all 60 hours, ends with a winner, and the books balance', () => {
  const game = playBotSeason({ seed: 3 });
  assert.equal(game.state.t, totalHours(CONFIG));
  assert.equal(game.state.phase, 'over');
  assert.equal(game.state.final.length, 10);
  assert.equal(game.state.final[0].rank, 1);
  assert.ok(checkBooks(game.state).ok);
  assert.equal(game.feed.filter(l => l.type === 'hour').length, 60);
  assert.equal(game.feed.filter(l => l.type === 'night').length, 4);
  // the final ranking is by net worth, ties to the bigger stash
  for (let i = 1; i < game.state.final.length; i++) assert.ok(game.state.final[i - 1].worth >= game.state.final[i].worth);
});

test('monkeys: seasons of random legal moves never crash and the books balance every hour', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const game = newSeason({ seed });
    const { cfg, map, state } = game;
    while (state.t < totalHours(cfg)) {
      play(game, monkeyReplies(game)); // resolveHour throws when the books don't balance
      if (state.t % cfg.season.hoursPerDay !== 0) continue;
      const ctx = hourContext({ cfg, map, state, t: state.t - 1 });
      const day = state.t / cfg.season.hoursPerDay;
      if (state.t < totalHours(cfg)) {
        runNight(ctx, day);
        levelUpDefaults(cfg, state);
        startDay(ctx, day + 1);
      } else finalBell(ctx);
      assert.ok(checkBooks(state).ok, `seed ${seed}, after night ${day}`);
    }
    assert.equal(state.final.length, 10);
  }
});

test('every lineup plays a whole season', () => {
  for (const name of ['default', 'cautious', 'turtle:dealer', 'grind:muscle', 'grind:cook', 'dead:cook', 'dead:robber#2']) {
    const game = playBotSeason({ seed: 11, lineup: buildLineup(name) });
    assert.equal(game.state.phase, 'over', name);
  }
  const dead = playBotSeason({ seed: 11, lineup: buildLineup('dead:cook') });
  const cook = dead.state.agents[`a${seatIndex(CONFIG, 'cook') + 1}`];
  assert.equal(cook.stats.worked, 0);
  assert.equal(cook.stats.offersMade, 0, 'a dead seat never offers');
  assert.equal(cook.confessionals.length, 0, 'or speaks');
});

test('pausing every night and resuming gives the same season as playing straight through', async () => {
  const lineup = () => {
    const seats = buildLineup('default');
    seats[seatIndex(CONFIG, 'dealer')].owner = true;
    return seats;
  };
  // straight through: the owner's seat spends its points down the build order
  const straight = createGame({ seed: 5, lineup: lineup() });
  assert.equal(await advance(straight, {}), 'over');

  // paused: stop before hour 0 and after every night, save, load, and hand back a sheet that buys the same skills
  let paused = createGame({ seed: 5, lineup: lineup() });
  let stops = 0;
  let result = await advance(paused, { pauseNights: true });
  while (result === 'paused') {
    stops += 1;
    paused = JSON.parse(JSON.stringify({ cfg: paused.cfg, map: paused.map, state: paused.state, feed: paused.feed, nights: paused.nights })); // a round trip through disk
    const owner = Object.values(paused.state.agents).find(a => a.owner);
    const sheet = levelUpSheet(paused, owner);
    assert.equal(sheet.points, owner.points);
    // buy what the default build would have bought
    const probe = structuredClone(owner);
    const { spendDefault } = await import('../src/skills.mjs');
    sheet.buy = spendDefault(paused.cfg, probe);
    result = await advance(paused, { pauseNights: true, sheets: { [owner.id]: sheet } });
  }
  assert.equal(result, 'over');
  assert.equal(stops, 5, 'one stop before hour 0 and one after each of the four nights');
  assert.deepEqual(paused.state.final, straight.state.final);
  assert.equal(JSON.stringify(paused.state.agents), JSON.stringify(straight.state.agents));
});

test("an owner's note reaches the agent's next view, clipped to 200 characters", async () => {
  const seats = buildLineup('default');
  seats[seatIndex(CONFIG, 'cook')].owner = true;
  const game = createGame({ seed: 2, lineup: seats });
  assert.equal(await advance(game, { pauseNights: true }), 'paused');
  const owner = Object.values(game.state.agents).find(a => a.owner);
  assert.equal(owner.points, CONFIG.start.points, 'the owner spends the starting points at the pause before hour 0');
  const sheet = levelUpSheet(game, owner);
  sheet.buy = ['purity', 'purity', 'purity'];
  sheet.note = 'Sell to both dealers. '.repeat(20);
  await advance(game, { pauseNights: true, sheets: { [owner.id]: sheet }, untilHour: 1 });
  assert.equal(owner.skills.purity, 2, 'only as many as it has points for');
  assert.equal(owner.note.length <= 200, true);
  const { buildView } = await import('../src/view.mjs');
  const { setPolice } = await import('../src/npc.mjs');
  const ctx = hourContext({ cfg: game.cfg, map: game.map, state: game.state });
  setPolice(ctx);
  assert.equal(buildView(ctx, owner).note, owner.note);
});

test('the map is data: the engine plays on a bigger map of two districts joined by a bridge', () => {
  const map = structuredClone(CITY);
  map.id = 'two-districts';
  map.blocks.uptown.links.push('bridge');
  map.blocks.bridge = { name: 'the bridge', district: 'downtown', cityPlace: 'plaza', links: ['uptown', 'eastside'], spots: ['street'] };
  map.blocks.eastside = { name: 'the east side', district: 'east', cityPlace: 'park', links: ['bridge', 'yards'], buyers: { price: 'bar', from: 0 }, shopkeeper: true, spots: ['street', 'counter:shop'] };
  map.blocks.yards = { name: 'the yards', district: 'east', cityPlace: 'docks', links: ['eastside'], buyers: { price: 'corner', from: 0 }, spots: ['street'] };
  const game = playBotSeason({ seed: 4, map });
  assert.equal(game.state.phase, 'over');
  assert.ok(checkBooks(game.state).ok);
});

test('net worth counts cash, stash and an even share of the crew pot, less what is owed to the clinic and the docks', () => {
  const { state } = newSeason({ seed: 1 });
  const a = seat(state, 'dealer');
  const b = seat(state, 'cook');
  a.cash = 40;
  a.stash = 60;
  a.clinicDebt = 15;
  state.crews.k1 = { id: 'k1', name: 'x', boss: a.id, members: [a.id, b.id], cut: 10, pot: 51, paidIn: {} };
  a.crew = 'k1';
  b.crew = 'k1';
  assert.equal(netWorth(state, a), 40 + 60 - 15 + 25);
});

test('a stand-in bot takes over a seat whose model fails three hours running, and hands it back', async () => {
  const seats = buildLineup('default');
  const cookSeat = seatIndex(CONFIG, 'cook');
  seats[cookSeat].kind = 'ai';
  const game = createGame({ seed: 3, lineup: seats });
  const cook = game.state.agents[`a${cookSeat + 1}`];
  let broken = true;
  const ai = {
    decide: async asks => Object.fromEntries(asks.map(({ agentId, view }) => [agentId, broken ? { failed: true, move: { id: view.menu[0]?.id } } : { move: { id: view.menu.find(m => m.verb === 'rest').id }, confessional: 'I am back.' }])),
    journal: async asks => Object.fromEntries(asks.map(({ agentId }) => [agentId, { lines: ['a', 'b', 'c'], ask: 'nothing' }])),
  };
  await advance(game, { seats: ai, untilHour: 8 });
  const on = game.feed.find(l => l.type === 'takeover');
  assert.deepEqual({ t: on.t, agent: on.agent, on: on.on }, { t: CONFIG.takeover.afterHours - 1, agent: cook.id, on: true });
  assert.ok(cook.stats.worked > 0, 'the stand-in cooked');
  assert.equal(cook.confessionals.length, 0, 'and did not speak for the seat');
  broken = false;
  await advance(game, { seats: ai, untilHour: 10 });
  assert.ok(game.feed.some(l => l.type === 'takeover' && l.on === false), 'handed back when the model answered');
  assert.equal(cook.confessionals.length, 2);
});
