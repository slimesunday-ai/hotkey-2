// One whole fake ai10 season (SPEC section 18): every seat is an AI seat, the fake model answers for $0, and the
// prompt, the transports, the parser and the season loop all run for all 60 hours and 5 nights.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance } from '../../src/season.mjs';
import { buildLineup } from '../../src/lineups.mjs';
import { CONFIG } from '../../src/config.mjs';
import { totalHours } from '../../src/state.mjs';
import { checkBooks } from '../../src/ledger.mjs';
import { seasonStats } from '../../src/stats.mjs';
import { createAiSeats } from '../../src/seats/ai.mjs';
import { botBrain, menuChoice } from '../../src/seats/fake-brain.mjs';
import { ai10Template } from '../../src/seats/defaults.mjs';
import { chooseFromMenu } from '../../src/menu.mjs';
import { PRICES } from '../../src/seats/anthropic.mjs';
import { playedViews } from './helpers.mjs';

/** A fake ai10 season on the template's cast. `brain: false` plays the hash-picking fake in place of the bots. */
async function fakeSeason(seed, { brain = true } = {}) {
  const cast = ai10Template();
  const lineup = buildLineup('ai10').map((s, i) => ({ ...s, model: cast[i].model, persona: cast[i].persona }));
  const game = createGame({ seed, lineup });
  const records = [];
  const seats = createAiSeats({
    seats: game.state.order.map((agentId, i) => ({ agentId, model: cast[i].model, api: cast[i].api, ...(cast[i].effort ? { effort: cast[i].effort } : {}) })),
    transport: 'fake', concurrency: 10, fakeBrain: brain ? botBrain(game) : null, onTurn: r => records.push(r),
  });
  const result = await advance(game, { seats });
  await seats.close();
  return { game, seats, records, result };
}

test('a whole fake ai10 season: 0 failed turns, every reply parses, and the season is a real one', async () => {
  const { game, seats, records, result } = await fakeSeason(1);
  assert.equal(result, 'over');
  assert.equal(game.state.phase, 'over');
  const hours = totalHours(CONFIG);
  const turns = records.filter(r => r.kind === 'turn');
  const journals = records.filter(r => r.kind === 'journal');
  assert.equal(turns.length, 10 * hours);
  assert.equal(journals.length, 10 * CONFIG.season.days);
  // 0 failed turns, and every reply parsed
  assert.deepEqual(seats.failed, { turns: 0, journals: 0, skipped: 0 });
  for (const r of records) {
    assert.equal(r.ok, true, `${r.agentId} t=${r.t} ${r.kind}: ${r.why}`);
    assert.equal(r.parsed, true);
    assert.equal(r.tries, 1);
    assert.ok(r.prompt.system < 8000 && r.prompt.user > 0);
  }
  assert.equal(game.feed.filter(l => l.type === 'takeover').length, 0, 'no seat failed, so no bot took one over');
  // every hour's ten moves came from an AI reply and were legal: nothing the engine had to refuse as malformed
  const hourLines = game.feed.filter(l => l.type === 'hour');
  assert.equal(hourLines.length, hours);
  // the season is a real one: the books balance, deals closed, people were robbed, people spoke
  assert.ok(checkBooks(game.state).ok);
  const stats = seasonStats(game);
  assert.ok(stats.tradesPerDay >= 2, `${stats.tradesPerDay} trades a day`);
  assert.ok(stats.robsPerDay.reduce((a, b) => a + b, 0) >= 3, `robberies by day: ${stats.robsPerDay}`);
  const said = hourLines.flatMap(l => Object.values(l.agents)).filter(a => a.say).length;
  const confessed = hourLines.flatMap(l => Object.values(l.agents)).filter(a => a.confessional).length;
  assert.ok(said >= 30, `${said} lines said out loud`);
  assert.ok(confessed >= 400, `${confessed} confessionals`);
  // both fakes ran, Claude seats were priced, and nothing else cost anything
  const claudeModels = Object.keys(PRICES);
  for (const [model, m] of Object.entries(seats.perModel)) {
    assert.equal(m.failed + m.skipped + m.cutoffs, 0, model);
    assert.equal(m.cost > 0, claudeModels.includes(model), `${model}: $${m.cost}`);
  }
  assert.equal(seats.spend.calls, records.length);
});

test('journals have three lines and an ask, and the next day\'s prompt shows them back', async () => {
  const { game, records } = await fakeSeason(2);
  for (const id of game.state.order) {
    const journals = game.state.agents[id].journals;
    assert.equal(journals.length, CONFIG.season.days, id);
    for (const j of journals) {
      assert.equal(j.lines.length, 3, `${id} night ${j.day}`);
      assert.ok(j.lines.every(l => typeof l === 'string' && l.length > 0 && l.length <= 200));
      assert.ok(typeof j.ask === 'string' && j.ask.length > 0 && j.ask.length <= 160);
    }
  }
  const night1 = records.find(r => r.kind === 'journal');
  assert.deepEqual(Object.keys(night1.reply).sort(), ['ask', 'lines']);
  assert.equal(game.feed.filter(l => l.type === 'night').length, CONFIG.season.days - 1);
  assert.ok(game.feed.find(l => l.type === 'night').journals[game.state.order[0]].ask);
});

test('a fake season is deterministic: the same seed gives the same bytes, a different seed a different season', async () => {
  const bytes = s => JSON.stringify({ state: s.game.state, feed: s.game.feed });
  const [a, b, c] = [await fakeSeason(3), await fakeSeason(3), await fakeSeason(4)];
  assert.equal(bytes(a), bytes(b));
  assert.notEqual(bytes(a), bytes(c));
  // the model's side too: the same prompts got the same raw replies
  assert.deepEqual(a.records.map(r => [r.agentId, r.t, r.kind, r.raw, r.prompt]), b.records.map(r => [r.agentId, r.t, r.kind, r.raw, r.prompt]));
});

test('the hash-picking fake (no bot brain) also plays a whole season with 0 failed turns', async () => {
  const { game, seats, result } = await fakeSeason(5, { brain: false });
  assert.equal(result, 'over');
  assert.deepEqual(seats.failed, { turns: 0, journals: 0, skipped: 0 });
  assert.ok(checkBooks(game.state).ok);
});

test("the bots' own moves come back out of the menu: almost all exactly, the rest as the nearest line", () => {
  const counts = { exact: 0, near: 0, off: 0 };
  for (const seed of [1, 2, 3]) {
    const { game } = playedViews({
      seed, hours: 12,
      replies: (g, views, ctx) => Object.fromEntries(g.state.order.map(id => {
        const brain = botBrain(g, counts);
        const r = brain({ agentId: id, view: views[id], kind: 'turn' });
        // what the season would do with it
        return [id, { ...r, move: r.move ? chooseFromMenu(views[id].menu, r.move) : null }];
      })),
    });
    assert.ok(checkBooks(game.state).ok);
  }
  const all = counts.exact + counts.near + counts.off;
  assert.ok(counts.exact / all > 0.9, JSON.stringify(counts));
  assert.ok(counts.off / all < 0.03, JSON.stringify(counts));
  // a plain `work` is the first work line; a move with no line of its kind is nothing
  const menu = [{ id: 'm1', verb: 'rest', move: { verb: 'rest' } }, { id: 'm2', verb: 'work', move: { verb: 'work', option: 'cook' } }];
  assert.deepEqual(menuChoice(menu, { verb: 'work' }), { choice: { id: 'm2' }, exact: true });
  assert.deepEqual(menuChoice(menu, { verb: 'rest' }), { choice: { id: 'm1' }, exact: true });
  assert.equal(menuChoice(menu, { verb: 'stash', amount: 40 }), null);
});
