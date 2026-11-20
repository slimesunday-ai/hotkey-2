// batch-1 (RUN.md, "Food: one cap a day", "Low Tide Docks", "Glasswall Plaza", the walk's barber and sneaker wall):
// the day's one count of food, the two new places as data with their one-ride links, the two cards, and the players.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, withRunConfig, newRun, view, step, checkRunBooks } from '../src/run/index.mjs';
import { foodToday } from '../src/run/rules.mjs';

const cfg = RUN_CONFIG;
function at(place, extra = {}, seed = 1, c = cfg) {
  const s = newRun({ seed, cfg: c });
  return { ...s, place, energy: 6, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) }, books: { ...s.books, ...(extra.books ?? {}) } };
}
const carrying = (state, amount) => ({ ...state, carried: amount, books: { ...state.books, earned: state.books.earned + amount } });
const move = (v, what, extra = {}) => v.choices.find(c => c.choice.do === what && Object.entries(extra).every(([k, x]) => c.choice[k] === x));

// THREE FOODS IN THE PARK (the measurement the cap is for: uncapped, a park player who eats banked as much as the market)
const food = (item, label, price, keeper, spot) => ({ item, label, kind: 'food', price, does: 'Energy +1: one more hour', perDay: 1, gives: { energy: 1 }, keeper, spot });
const MORE = withRunConfig({ places: { park: { shop: [...RUN_CONFIG.places.park.shop, food('coffee', 'A coffee', 3, 'npc:neighbour', 'x'), food('deli', 'A deli roll', 4, 'npc:neighbour:2', 'y')] } } });

test('food: one count a day across every food and drink, the number in the config', () => {
  assert.equal(cfg.food.perDay, 2);
  let s = carrying(at('park', { energy: 1 }, 1, MORE), 20);
  assert.deepEqual(foodToday(MORE, s), { eaten: 0, perDay: 2, left: 2, full: false, text: '0 of 2 today' });
  s = step(MORE, s, { do: 'shop', item: 'sandwich' }).state;
  const second = step(MORE, s, { do: 'shop', item: 'coffee' });
  s = second.state;
  assert.equal(s.energy, 3);
  // the second food says the day is done; the third food is refused, whichever spot sells it, with the line saying why
  assert.match(second.events[0].text, /You have eaten all you can today\.$/);
  assert.deepEqual(second.events[0].food, { eaten: 2, perDay: 2, left: 0, full: true });
  const v = view(MORE, s);
  const deli = move(v, 'shop', { item: 'deli' });
  assert.equal(deli.available, false);
  assert.equal(deli.why, 'you have eaten all you can today');
  assert.match(deli.label, /\(you have eaten all you can today\)$/);
  assert.equal(v.food.full, true);
  assert.equal(v.shopHere.find(x => x.item === 'deli').food, true);
  assert.equal(v.errands.find(x => x.item === 'drink').why, 'you have eaten all you can today'); // the market's drink too
  assert.throws(() => step(MORE, s, { do: 'shop', item: 'deli' }), /eaten all you can today/);
  assert.ok(checkRunBooks(s).ok);
  // across places: the sandwich in the park and the drink at the market are the day's two
  let t = carrying(at('park', { energy: 1 }), 20);
  t = step(cfg, t, { do: 'shop', item: 'sandwich' }).state;
  t = { ...t, place: 'market', energy: 1 };
  t = step(cfg, t, { do: 'shop', item: 'drink' }).state;
  assert.equal(foodToday(cfg, t).full, true);
  // the morning resets it
  const home = step(cfg, { ...t, place: 'park' }, { do: 'inside' }).state;
  const morning = step(cfg, home, { do: 'sleep' }).state;
  assert.deepEqual(foodToday(cfg, morning), { eaten: 0, perDay: 2, left: 2, full: false, text: '0 of 2 today' });
});

// ── LOW TIDE DOCKS (RUN.md "Low Tide Docks") ──────────────────────────────────────────────────────────────────────────
test('docks: the mean tier, a shift and a box off a semi, two foremen and two drivers, no connect and no good', () => {
  const d = cfg.places.docks;
  assert.equal(d.label, 'Low Tide Docks');
  assert.equal(d.block, 'docks');
  assert.equal(d.tier, 'mean');
  assert.deepEqual(d.jobs.shift.pay, [30, 39]);
  assert.equal(d.jobs.shift.safe, true);
  // (bigman-1, with a fight won heating +1: odds 60, $84–141, drivers 62; RUN.md "Low Tide Docks")
  assert.deepEqual([d.jobs.lift.odds, d.jobs.lift.pay, d.jobs.lift.failHeat, d.jobs.lift.wonHeat, d.jobs.lift.trust.fail, d.jobs.lift.fight], [60, [84, 141], 2, 1, -2, 'fail']);
  assert.deepEqual(d.people.map(p => `${p.name}:${p.role}`), ['Mr. Haines:foreman', 'Rosa:foreman', 'Big Lou:driver', 'Nadia Petrakis:driver']);
  assert.equal(d.connect, undefined);
  assert.ok(!Object.values(cfg.goods).some(g => g.at === 'docks'), 'no good is bought on the docks');
  assert.ok(!Object.values(d.jobs).some(j => j.goods), 'no selling job on the docks');
  assert.deepEqual(d.shop, []);
  assert.equal(cfg.duel.foe.base.driver, 62);
});

test('docks: one ride from the trailer park and only from there; on the line', () => {
  assert.deepEqual(cfg.places.docks.links, { park: { via: 'subway' } });
  assert.ok(cfg.places.park.links.docks);
  assert.ok(cfg.subwayStops.includes('docks'));
  const v = view(cfg, carrying(at('park'), 10));
  const ride = move(v, 'subway', { to: 'docks', hop: false });
  assert.ok(ride.available, ride.why);
  const there = step(cfg, v && carrying(at('park'), 10), { do: 'subway', to: 'docks', hop: false });
  assert.equal(there.state.place, 'docks');
  assert.deepEqual([there.state.energy, there.state.carried], [5, 8]);
  const back = view(cfg, there.state);
  assert.deepEqual(back.choices.filter(c => c.choice.do === 'subway').map(c => c.choice.to), ['park', 'park']);
});

test('docks: a box off the semi gone wrong is a fight with the driver; a won fight pays, a lost one costs 2 energy', () => {
  const seen = { won: 0, lost: 0 };
  for (let hour = 12; hour < 60 && (!seen.won || !seen.lost); hour++) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = at('docks', { hour }, seed);
      const v = view(cfg, s);
      const o = v.options.find(x => x.id === 'lift');
      if (!o) continue;
      assert.match(o.ifFail, /a fight: you win about \d+ in 10/);
      const out = step(cfg, s, o.choice);
      const e = out.events.find(x => x.type === 'job');
      if (e.outcome !== 'fail') continue;
      assert.ok(e.duel, 'a failed lift is a fight');
      if (e.duel.result === 'won') { seen.won++; assert.ok(e.pay >= 96 && e.pay <= 162); assert.equal(out.state.energy, s.energy - 1 - 1); }
      else { seen.lost++; assert.equal(e.pay, 0); assert.equal(out.state.energy, s.energy - 1 - 2); }
      assert.ok(checkRunBooks(out.state).ok);
    }
  }
  assert.ok(seen.won && seen.lost, JSON.stringify(seen));
});

// ── GLASSWALL PLAZA (RUN.md "Glasswall Plaza") ───────────────────────────────────────────────────────────────────────
test('plaza: its own tier where the police are the danger; flyers, a wallet, a phone; office people; one ride from home', () => {
  const p = cfg.places.plaza;
  assert.deepEqual([p.label, p.block, p.tier], ['Glasswall Plaza', 'uptown', 'watched']);
  assert.deepEqual(cfg.tiers.watched, { pay: 1.5, jump: 0.25, strength: 0, patrol: true, police: 2, cool: 2, roughPct: 50 });
  assert.deepEqual([p.jobs.flyers.safe, p.jobs.flyers.pay], [true, [15, 20]]);
  assert.deepEqual([p.jobs.wallet.odds, p.jobs.wallet.pay, p.jobs.wallet.failHeat], [55, [45, 75], 1]);
  assert.deepEqual([p.jobs.phone.odds, p.jobs.phone.pay, p.jobs.phone.winHeat, p.jobs.phone.failHeat], [45, [60, 90], 1, 2]);
  assert.ok(!Object.values(p.jobs).some(j => j.fight), 'nobody on the plaza fights you: a job gone wrong brings the police');
  assert.deepEqual(p.people.map(x => x.name), ['Vic Amato', 'a man in a lanyard', 'a woman on two phones', 'a man with a coffee']);
  assert.deepEqual(p.links, { park: { via: 'subway' } });
  assert.ok(cfg.places.park.links.plaza.late && cfg.subwayStops.includes('plaza'));
  // patrolled whatever its heat; a stop twice as likely as the market's at the same heat; a quarter of its jumping
  const s = { ...at('plaza', { heat: 3, hoursThere: 2 }), carried: 50, books: { ...at('plaza').books, earned: 50 } };
  const v = view(cfg, s);
  assert.equal(v.danger.oneMore.stop.chance, 40);
  assert.equal(view(cfg, { ...s, place: 'market' }).danger.oneMore.stop.chance, 20);
  assert.equal(v.danger.thisHour.jump.chance, Math.round((4 + 4 * 2 + 5) * 0.25));
  assert.match(v.places.find(x => x.place === 'plaza').text, /the police patrol it|police about/);
});

test('players: the docks and plaza players play whole seasons there, one ride from home', async () => {
  const { POLICIES, playSeason } = await import('../src/run/policies.mjs');
  for (const name of ['docks', 'plaza', 'docksBlind', 'plazaBlind', 'docksHonest', 'plazaHonest']) {
    const where = name.startsWith('docks') ? 'docks' : 'plaza';
    let seen = 0;
    for (const seed of [1, 2, 3]) {
      const r = playSeason(cfg, { seed, policy: POLICIES[name](120) });
      assert.equal(r.takes.length, 6);
      assert.ok(checkRunBooks(r.state).ok);
      seen += r.tally.trips;
    }
    assert.ok(seen > 0, `${name} rode to ${where}`);
  }
});

// ── THE WALK'S TWO NEW CARDS (RUN.md "Two cards on the walk") ─────────────────────────────────────────────────────────
const onStop = (hand, extra = {}) => ({ ...at('fitst', { energy: 6, ...extra }), route: { id: 'fitStreet', from: 'market', to: 'park', way: 'foot', stops: ['fitst'], at: 0, hand } });
test('cards: the barber, an hour and an energy for your own heat −1, said as −1; dealt only with heat to cool', async () => {
  const { cardPool } = await import('../src/run/rules.mjs');
  assert.ok(!cardPool(cfg, at('fitst', { heat: 0 }), 'fitst').some(c => c.id === 'barber'));
  assert.ok(cardPool(cfg, at('fitst', { heat: 2 }), 'fitst').some(c => c.id === 'barber'));
  const s = onStop(['barber'], { heat: 3 });
  const card = view(cfg, s).hand.find(c => c.id === 'barber');
  assert.deepEqual([card.odds, card.sure, card.ifWin, card.perEnergy], [100, true, 'heat −1', 0]);
  const out = step(cfg, s, { do: 'card', id: 'barber' });
  assert.deepEqual([out.state.heat, out.state.energy, out.state.hour], [2, 5, s.hour + 1]);
  const e = out.events.find(x => x.type === 'card');
  assert.equal(e.text, 'Get a cut at FRESH CUTZ, a new face for the police: heat −1.');
  assert.doesNotMatch(e.text, /\+-/);
  assert.ok(checkRunBooks(out.state).ok);
  // once a day there
  assert.ok(!cardPool(cfg, { ...out.state, route: null }, 'fitst').some(c => c.id === 'barber'));
});

test('cards: the barber is a shop on the walk, beside the hand whenever you have heat and never one of the three dealt', async () => {
  const { dealHand, cardPool } = await import('../src/run/rules.mjs');
  const n = cfg.stops.fitst.hand;
  for (let day = 1; day <= 12; day++) {
    const hot = at('fitst', { heat: 2, day });
    const cool = at('fitst', { heat: 0, day });
    const h = dealHand(cfg, hot, 'fitst');
    assert.ok(h.includes('barber'));
    assert.ok(!dealHand(cfg, cool, 'fitst').includes('barber'));
    // the three dealt are the same three with heat or without: the barber took nobody's place
    assert.deepEqual(h.filter(id => id !== 'barber'), dealHand(cfg, cool, 'fitst'));
    assert.equal(h.length - 1, Math.min(n, cardPool(cfg, hot, 'fitst').length - 1));
  }
  const s = onStop(['errand', 'barber'], { heat: 3 });
  const hand = view(cfg, s).hand;
  assert.deepEqual([hand.find(c => c.id === 'barber').beside, hand.find(c => c.id === 'errand').beside], [true, false]);
});

test('cards: the sneaker wall at DROP, 50% for $40–60, heat +1 on a fail; pays less an energy than the market\'s stall', async () => {
  const { cardPerEnergy, perEnergy } = await import('../src/run/marks.mjs');
  const { deal } = await import('../src/run/rules.mjs');
  const c = cfg.stops.fitst.cards.drop;
  assert.deepEqual([c.odds, c.pay, c.failHeat], [50, [40, 60], 1]);
  const fail = step(cfg, { ...onStop(['drop']), rig: { chances: [99] } }, { do: 'card', id: 'drop' });
  assert.deepEqual([fail.state.heat, fail.events.find(x => x.type === 'card').outcome], [1, 'fail']);
  const win = step(cfg, { ...onStop(['drop']), rig: { chances: [0] } }, { do: 'card', id: 'drop' });
  assert.ok(win.state.carried >= 40 && win.state.carried <= 60);
  assert.ok(cardPerEnergy(cfg, 'fitst', 'drop', { n: 400 }) < perEnergy(cfg, 'market', (q, s) => ({ do: 'job', id: deal(q, s)[0].id }), { n: 400 }));
});
