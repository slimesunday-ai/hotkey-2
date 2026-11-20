// Goods, the connect and errands (RUN.md, "Goods, the connect and errands"): a selling job needs goods bought by the
// pack from a place's connect; goods on you are at risk, goods at the crib are safe; errands cost money and no hour;
// things to wear and for the trailer are owned and worn; an older saved state loads with none of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, withRunConfig, newRun, view, step, checkRunBooks, deal } from '../src/run/index.mjs';
import { jumpBand, connectOf, goodsFor } from '../src/run/rules.mjs';
import { POLICIES, playSeason } from '../src/run/policies.mjs';

const cfg = RUN_CONFIG;
const CALM = withRunConfig({ jump: { basePct: 0, perHourPct: 0, perStepPct: 0 }, police: { perHeat: 0 } });
const EARL = 'npc:connect:projects';
const TEO = 'npc:connect:market';

function at(place, extra = {}, seed = 1, c = cfg) {
  const s = newRun({ seed, cfg: c });
  return { ...s, place, energy: 6, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) }, books: { ...s.books, ...(extra.books ?? {}) } };
}
const carrying = (state, amount) => ({ ...state, carried: amount, books: { ...state.books, earned: state.books.earned + amount } });
const move = (v, what, extra = {}) => v.choices.find(c => c.choice.do === what && Object.entries(extra).every(([k, x]) => c.choice[k] === x));
/** A state at `place` whose hour deals job `id`. */
function dealtAt(c, place, id, extra = {}) {
  for (let hour = 12; hour < 120; hour++) {
    const s = at(place, { ...extra, hour }, 1, c);
    if (deal(c, s).some(j => j.id === id)) return s;
  }
  throw new Error(`${id} never dealt at ${place}`);
}
/** A contest roll that lands in `band` at strength P. */
const rollFor = (P, band) => [...Array(100).keys()].find(r => jumpBand(cfg, P, r) === band);

test('goods: with none of a good a selling job takes, it is not dealt, and the view says why and where to buy', () => {
  for (let hour = 12; hour < 60; hour++) {
    assert.ok(!deal(cfg, at('park', { hour })).some(j => j.id === 'loosies'));
    assert.ok(!deal(cfg, at('market', { hour })).some(j => j.id === 'crowd'));
  }
  const v = view(cfg, at('market'));
  const crowd = v.selling.jobs.find(j => j.job === 'crowd');
  assert.equal(crowd.dealt, false);
  assert.match(crowd.text, /Sell to the crowd is not dealt: you carry nothing it takes\. Teo sells bootleg films on disc at the Jay St night market; Cousin Earl sells loose cigarettes in the trailer park\./);
  // with some on you it is dealt, says what it uses and what is left after; it pays what that good pays there
  const s = dealtAt(cfg, 'market', 'crowd', { goods: { smokes: 3 } });
  const o = view(cfg, s).options.find(x => x.id === 'crowd');
  assert.deepEqual([o.uses.good, o.uses.n, o.uses.carried, o.uses.left, o.uses.cost], ['smokes', 1, 3, 2, 2]);
  assert.deepEqual(o.pay, cfg.jobs.market.crowd.goodsPay.smokes);
  // a good left at home does not count: the view says it is at home
  const home = view(cfg, at('park', { stash: { smokes: 4 } })).selling;
  assert.match(home.text, /You left 4 loose cigarettes at home\./);
});

test('goods: carrying what a selling job takes, it is dealt every hour while a buyer is left (never left to the dice)', () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (let hour = 12; hour < 40; hour++) {
      assert.ok(deal(cfg, at('park', { hour, goods: { smokes: 3 } }, seed)).some(j => j.id === 'loosies'), `park, seed ${seed}, hour ${hour}`);
      const market = deal(cfg, at('market', { hour, goods: { smokes: 3 } }, seed));
      assert.ok(market.some(j => j.id === 'crowd'), `market, seed ${seed}, hour ${hour}`);
      assert.equal(market.length, 3); // still the safe one and two more
    }
  }
  // the park's only buyer worked today: nobody to sell to, so it is not dealt
  const dee = cfg.places.park.people.find(p => p.role === 'buyer').id;
  assert.ok(!deal(cfg, at('park', { goods: { smokes: 3 }, people: { [dee]: { mood: 'friendly', out: true, job: 'loosies' } } })).some(j => j.id === 'loosies'));
});

test('goods: buying a pack costs money and no hour; the connect is dealt with (trust), and caps a day', () => {
  const s = carrying(at('park'), 25);
  const v = view(cfg, s);
  const c = v.connects.find(x => x.place === 'park');
  assert.deepEqual([c.who.id, c.good, c.price, c.sales, c.sells, c.here], [EARL, 'smokes', 10, 5, true, true]);
  const { state, events } = step(cfg, s, move(v, 'pack').choice);
  assert.equal(state.hour, s.hour);
  assert.equal(state.energy, s.energy);
  assert.equal(state.carried, 15);
  assert.equal(state.goods.smokes, 5);
  assert.equal(state.books.goods, 10);
  assert.ok(checkRunBooks(state).ok);
  const e = events[0];
  assert.deepEqual([e.type, e.who.id, e.at, e.good, e.price, e.sales, e.carried, e.left], ['pack', EARL, 'park', 'smokes', 10, 5, 5, 1]);
  assert.equal(e.trust.to, 1);
  assert.match(e.text, /^You bought a carton of cigarettes from Cousin Earl for \$10: 5 sales of loose cigarettes\. 5 on you\.$/);
  // two a day from one connect, then no more until morning
  const two = step(cfg, state, { do: 'pack', good: 'smokes' }).state;
  assert.match(move(view(cfg, two), 'pack').why, /has sold you 2 today/);
  assert.throws(() => step(cfg, two, { do: 'pack', good: 'smokes' }), /has sold you 2 today/);
  // short of the price: says so, and where the cash is
  assert.match(move(view(cfg, carrying(at('park'), 4)), 'pack').why, /you carry \$4: a pack is \$10; step inside for cash/);
  // keep the first day playable: $20 banked buys a carton before any work
  assert.ok(newRun().banked >= cfg.goods.smokes.price);
});

test('goods: the connect will not sell against you, and sells cheaper with you', () => {
  const against = carrying(at('park', { trust: { [EARL]: -3 } }), 30);
  const m = move(view(cfg, against), 'pack');
  assert.equal(m.available, false);
  assert.match(m.why, /Cousin Earl won't sell to you: against you, 2 days/);
  assert.equal(view(cfg, against).connects.find(x => x.place === 'park').sells, false);
  assert.throws(() => step(cfg, against, { do: 'pack', good: 'smokes' }), /won't sell to you/);
  const withYou = carrying(at('market', { trust: { [TEO]: 2 } }), 80);
  const c = connectOf(cfg, withYou, 'market');
  assert.equal(c.price, cfg.goods.discs.price - Math.round(cfg.goods.discs.price * cfg.connect.withOffPct / 100));
  const { state, events } = step(cfg, withYou, { do: 'pack', good: 'discs' });
  assert.equal(state.carried, 80 - c.price);
  assert.equal(events[0].off, c.basePrice - c.price);
  assert.match(events[0].text, /off: with you/);
});

test('goods: a sale uses one, win or lose (one that goes wrong is lost), and says what is left', () => {
  const s = dealtAt(CALM, 'market', 'crowd', { goods: { smokes: 2, discs: 1 } });
  // the dealt good is the best margin; a choice may name another it takes
  assert.equal(deal(CALM, s).find(j => j.id === 'crowd').good, 'smokes');
  const win = step(CALM, { ...s, rig: { chances: [0] } }, { do: 'job', id: 'crowd' });
  const ev = win.events.find(e => e.type === 'job');
  assert.equal(ev.outcome, 'win');
  assert.deepEqual(ev.goods, { good: 'smokes', label: 'loose cigarettes', used: 1, left: 1, home: 0 });
  assert.ok(ev.pay >= CALM.jobs.market.crowd.goodsPay.smokes[0]);
  assert.match(ev.text, /1 left on you\.$/);
  const fail = step(CALM, { ...s, rig: { chances: [99] } }, { do: 'job', id: 'crowd', good: 'discs' });
  const fe = fail.events.find(e => e.type === 'job');
  assert.equal(fe.outcome, 'fail');
  assert.equal(fail.state.goods.discs, undefined);
  assert.equal(fail.state.goods.smokes, 2);
  assert.match(fe.text, /and the bootleg films on disc went with it\..*No bootleg films on disc left on you\./);
  assert.throws(() => step(CALM, s, { do: 'job', id: 'crowd', good: 'pills' }), /you carry no pills/);
  // the last one sold: the job is no longer dealt
  const out = { ...win.state, goods: {} };
  assert.equal(goodsFor(CALM, out, CALM.jobs.market.crowd).length, 0);
});

test('goods: a jump takes goods on you like cash (all, or half; the pocket hides only cash); a stop takes all, heat after, the connect against you', () => {
  // the market's leaving hour: the jump rolls (rigged), then the contest
  const base = carrying(at('market', { goods: { smokes: 4, discs: 2 }, owned: { pocket: true }, hoursThere: 2 }), 40);
  const d = view(cfg, base).danger.thisHour;
  assert.deepEqual(d.jump.takesGoods, { bad: { smokes: 4, discs: 2 }, scuffle: { smokes: 2, discs: 1 } });
  assert.match(view(cfg, base).atRisk.text, /a bad one takes \$20 and 4 sales of loose cigarettes and 2 sales of bootleg films on disc/);
  for (const [band, left] of [['messy', { smokes: 2, discs: 1 }], ['clean', {}]]) {
    const s = { ...base, rig: { chances: [0], rolls: [rollFor(d.jump.strength, band)] } };
    const { state, events } = step(cfg, s, { do: 'job', id: deal(cfg, s)[0].id });
    const j = events.find(e => e.type === 'jumped');
    assert.equal(j.outcome, band);
    assert.deepEqual(j.goodsLeft, left);
    assert.deepEqual(state.goods, left);
    assert.match(j.text, /sales of loose cigarettes/);
    assert.ok(checkRunBooks(state).ok);
  }
  // a stop: heat 4 at the market, the stall (sure), the stop rolls first
  const hot = carrying(at('market', { heat: 4, goods: { smokes: 3 }, stash: { smokes: 5 } }), 30);
  assert.equal(view(cfg, hot).danger.thisHour.stop.heatAfter, cfg.heat.afterJail + cfg.connect.stopHeat);
  const { state, events } = step(cfg, { ...hot, rig: { chances: [0] } }, { do: 'job', id: deal(cfg, hot)[0].id });
  const st = events.find(e => e.type === 'stopped');
  assert.deepEqual(st.goodsSeized, { smokes: 3 });
  assert.equal(st.heatAfter, 2);
  assert.equal(state.heat, 2);
  assert.deepEqual(state.goods, {});
  assert.deepEqual(state.stash, { smokes: 5 }, 'what is at the crib is safe');
  assert.equal(st.trust.who.id, EARL);
  assert.equal(st.trust.band, 'against');
  assert.match(st.text, /seized \$\d+ and 3 sales of loose cigarettes\. Carrying: your heat after jail is 2\./);
  // the next morning Earl will not sell to you
  const next = step(cfg, state, { do: 'morning' }).state;
  assert.equal(connectOf(cfg, next, 'park').sells, false);
  // a stop with nothing on you: heat after jail as ever
  const clean = step(cfg, { ...carrying(at('market', { heat: 4 }), 30), rig: { chances: [0] } }, { do: 'job', id: 'stall' });
  assert.equal(clean.state.heat, cfg.heat.afterJail);
});

test('goods: at the crib they are safe; going inside leaves them, stepping out takes them (all, or as many as you say)', () => {
  const s = at('park', { goods: { smokes: 4, discs: 1 } });
  const inside = step(cfg, s, { do: 'inside' });
  assert.deepEqual(inside.state.goods, {});
  assert.deepEqual(inside.state.stash, { smokes: 4, discs: 1 });
  assert.match(inside.events[0].text, /You left 4 sales of loose cigarettes and 1 sale of bootleg films on disc at home\./);
  const v = view(cfg, inside.state);
  assert.deepEqual(move(v, 'out').takeGoods, { smokes: { min: 0, max: 4, default: 4 }, discs: { min: 0, max: 1, default: 1 } });
  assert.deepEqual(v.goods.map(g => [g.good, g.carried, g.home]), [['smokes', 0, 4], ['discs', 0, 1]]);
  const all = step(cfg, inside.state, { do: 'out', take: 0 }).state;
  assert.deepEqual([all.goods, all.stash], [{ smokes: 4, discs: 1 }, {}]);
  const some = step(cfg, inside.state, { do: 'out', take: 0, goods: { smokes: 2 } });
  assert.deepEqual([some.state.goods, some.state.stash], [{ smokes: 2 }, { smokes: 2, discs: 1 }]);
  assert.deepEqual(some.events[0].tookGoods, { smokes: 2 });
  assert.throws(() => step(cfg, inside.state, { do: 'out', take: 0, goods: { smokes: 9 } }), /can't take 9 of smokes/);
});

test('errands: food costs money and no hour, a day cap that resets in the morning; it says who and where', () => {
  const s = carrying(at('park', { energy: 2 }), 9);
  const v = view(cfg, s);
  const e = v.errands.find(x => x.item === 'sandwich');
  assert.deepEqual([e.place, e.kind, e.price, e.perDay, e.left, e.keeper.name, e.spot, e.available], ['park', 'food', 4, 1, 1, 'Gloria', 'kitchen-window', true]);
  const { state, events } = step(cfg, s, { do: 'shop', item: 'sandwich' });
  assert.deepEqual([state.hour, state.energy, state.carried], [s.hour, 3, 5]);
  assert.deepEqual([events[0].type, events[0].keeper.name, events[0].spot, events[0].left, events[0].used], ['shop', 'Gloria', 'kitchen-window', 0, true]);
  assert.match(events[0].text, /^You bought a chopped cheese for \$4 from Gloria: energy \+1\. No more today\.$/);
  const after = view(cfg, state);
  assert.match(move(after, 'shop').why, /1 a day: had today's/);
  assert.equal(after.errands.find(x => x.item === 'sandwich').left, 0);
  const morning = step(cfg, step(cfg, state, { do: 'inside' }).state, { do: 'sleep' }).state;
  assert.equal(view(cfg, morning).errands.find(x => x.item === 'sandwich').left, 1);
  // the market's food is the drink, kept by Mrs. Bao; every place's errands are in the view, the corner's not for sale
  const drink = after.errands.find(x => x.item === 'drink');
  assert.deepEqual([drink.place, drink.keeper.name, drink.here], ['market', 'Mrs. Bao', false]);
  assert.ok(after.errands.filter(x => x.place === 'corner').every(x => !x.buyable && /not sold yet: held by the Sixes/.test(x.why)));
});

test('things: bought for money and no hour, owned for the run; clothes go on if the slot is free, on and off at the crib', () => {
  const s = carrying(at('market'), 40);
  const a = step(cfg, s, { do: 'get', item: 'bowling' });
  assert.deepEqual([a.state.hour, a.state.carried, a.state.things, a.state.worn], [s.hour, 28, { bowling: true }, { top: 'bowling' }]);
  assert.deepEqual([a.events[0].type, a.events[0].keeper.name, a.events[0].slot, a.events[0].worn], ['thing', 'Mrs. Kowalski', 'top', true]);
  assert.equal(move(view(cfg, a.state), 'get', { item: 'bowling' }).why, 'owned');
  assert.ok(checkRunBooks(a.state).ok);
  // at the crib: take it off, put it on (nothing changes but the slot)
  const home = { ...a.state, place: 'crib', carried: 0, banked: a.state.banked + a.state.carried };
  const offV = view(cfg, home);
  const off = step(cfg, home, move(offV, 'unwear').choice);
  assert.deepEqual(off.state.worn, {});
  assert.equal(off.events[0].type, 'unwear');
  const on = step(cfg, off.state, { do: 'wear', item: 'bowling' });
  assert.deepEqual(on.state.worn, { top: 'bowling' });
  assert.equal(view(cfg, on.state).things.text, 'Wearing a Neon Row Silk shirt.');
  assert.deepEqual({ ...on.state, worn: null, books: null }, { ...home, worn: null, books: null }, 'nothing else moved');
  // a thing for the trailer: owned, with its spot in the trailer
  const lamp = step(cfg, carrying(at('park'), 8), { do: 'get', item: 'lavalamp' }).state;
  assert.deepEqual(view(cfg, lamp).things.trailer, [{ item: 'lavalamp', label: 'a lava lamp', inTrailer: 'by-the-mattress' }]);
});

test('goods: an older saved state (version 4) loads with no goods and nothing owned beyond what it had', () => {
  const v4 = { ...at('park'), v: 4, owned: { pocket: true, cutter: false, bed: false } };
  for (const k of ['goods', 'stash', 'things', 'worn']) delete v4[k];
  delete v4.books.goods;
  delete v4.books.things;
  const v = view(cfg, v4);
  assert.ok(v.goods.every(g => g.carried === 0 && g.home === 0));
  assert.deepEqual([v.things.owned, v.things.worn], [[], {}]);
  assert.ok(!v.options.some(o => o.uses));
  assert.deepEqual(v.owned, { pocket: true, cutter: false, bed: false });
  const r = step(cfg, carrying(v4, 10), { do: 'pack', good: 'smokes' });
  assert.equal(r.state.goods.smokes, 5);
  assert.ok(checkRunBooks(r.state).ok);
});

test('goods: same seed, same run, for the dealer; it buys, sells and loses goods over a season', () => {
  const a = playSeason(cfg, { seed: 7, policy: POLICIES.dealer(120) });
  const b = playSeason(cfg, { seed: 7, policy: POLICIES.dealer(120) });
  assert.deepEqual(a.state, b.state);
  assert.deepEqual(a.takes, b.takes);
  assert.ok(checkRunBooks(a.state).ok);
  let packs = 0, sales = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const r = playSeason(cfg, { seed, policy: POLICIES.dealer(120) });
    packs += r.tally.packs;
    sales += r.tally.sales;
  }
  assert.ok(packs > 0 && sales > packs, `${packs} packs, ${sales} sales`);
  // the non-selling player never buys a pack
  assert.equal(playSeason(cfg, { seed: 7, policy: POLICIES.noSell(120) }).tally.packs, 0);
});
