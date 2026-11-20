// Routes (RUN.md, "Routes (routes-1)"): a way on foot between the trailer park and the Jay St night market, both directions,
// beside the subway: no fare, energy, and a stop on Fit Street outside DEAD AIR that deals a hand of cards to play or
// pass by; a skateboard to buy, faster and less energy than walking. Routes and stops are data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rng, pick } from '../src/rng.mjs';
import { KINDS, ACTIONS } from '../src/stage.mjs';
import { CITY } from '../src/map.mjs';
import { RUN_CONFIG, withRunConfig, newRun, view, step, checkRunBooks, RUN_STATE_VERSION } from '../src/run/index.mjs';
import { dealHand, cardPool, routesFrom, wayDanger } from '../src/run/rules.mjs';
import { POLICIES, playSeason } from '../src/run/policies.mjs';
import { measureRoutes, judgeRoutes, routesText } from '../src/run/marks.mjs';

const cfg = RUN_CONFIG;
// nobody jumps anyone, the police never stop you: the costs alone
const CALM = withRunConfig({ jump: { basePct: 0, perHourPct: 0, perStepPct: 0 }, police: { perHeat: 0 } });
function at(place, extra = {}, seed = 1, c = cfg) {
  const s = newRun({ seed, cfg: c });
  return { ...s, place, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) } };
}
const carrying = (state, amount) => ({ ...state, carried: amount, books: { ...state.books, earned: state.books.earned + amount } });
const move = (v, pred) => v.choices.find(c => pred(c.choice));
const walkTo = to => c => c.do === 'walk' && c.to === to;
const skateTo = to => c => c.do === 'skate' && c.to === to;
/** Play a list of choices from a state; the events of all of them. */
function run(c, state, choices) {
  const events = [];
  for (const ch of choices) {
    const r = step(c, state, typeof ch === 'function' ? ch(view(c, state)) : ch);
    events.push(...r.events);
    state = r.state;
  }
  return { state, events };
}

test('routes: a way on foot from the trailer park to the Jay St night market costs an energy and two hours, and no fare', () => {
  const s = at('park', { energy: 6 }, 1, CALM);
  const v = view(CALM, s);
  const walk = move(v, walkTo('market'));
  assert.ok(walk.available);
  assert.equal(walk.kind, 'move');
  assert.equal(walk.what, 'route');
  assert.deepEqual([walk.energy, walk.hours, walk.fare, walk.via.map(x => x.stop)], [1, 2, 0, ['fitst']]);
  const out = step(CALM, s, walk.choice);
  // set out (an energy, an hour), then the stop
  assert.equal(out.state.place, 'fitst');
  assert.equal(out.state.energy, 5);
  assert.equal(out.state.hour, s.hour + 1);
  assert.deepEqual(out.events.map(e => e.type), ['walk', 'stop']);
  assert.equal(out.state.route.to, 'market');
  // on: an hour, no energy, at the market; no fare paid
  const on = step(CALM, out.state, { do: 'onward' });
  assert.equal(on.state.place, 'market');
  assert.equal(on.state.route, null);
  assert.equal(on.state.energy, 5);
  assert.equal(on.state.hour, s.hour + 2);
  assert.equal(on.state.books.fares, 0);
  assert.deepEqual(on.events.map(e => e.type), ['onward', 'arrive']);
  assert.ok(checkRunBooks(on.state).ok);
  // and back home the same way, from the market
  const back = run(CALM, on.state, [{ do: 'walk', to: 'park' }, { do: 'onward' }]).state;
  assert.equal(back.place, 'park');
  assert.equal(back.energy, 4);
  // away from home you need enough energy to get back, as on the subway; coming home, an hour's
  assert.match(move(view(CALM, at('park', { energy: 1 }, 1, CALM)), walkTo('market')).why, /energy 2 to get there and back/);
  assert.equal(move(view(CALM, at('market', { energy: 1 }, 1, CALM)), walkTo('park')).available, true);
  assert.equal(move(view(CALM, at('market', { energy: 0 }, 1, CALM)), walkTo('park')).available, false);
});

test('routes: the stop deals a seeded hand, the same for the same state, and only cards that can be played', () => {
  const s = at('park', { energy: 6 });
  const a = step(cfg, s, { do: 'walk', to: 'market' });
  const b = step(cfg, s, { do: 'walk', to: 'market' });
  assert.deepEqual(a.state.route.hand, b.state.route.hand);
  assert.deepEqual(a.events, b.events);
  assert.equal(a.state.route.hand.length, cfg.stops.fitst.hand);
  // the hand is the dice's: other days deal other hands, from what could be dealt
  const hands = new Set();
  for (let day = 1; day <= 12; day++) hands.add(dealHand(cfg, { ...s, day }, 'fitst').join(','));
  assert.ok(hands.size > 1, 'every day the same hand');
  // a sale is only in the pool with a good on you it takes
  assert.ok(!cardPool(cfg, s, 'fitst').some(c => c.id === 'sell'));
  assert.ok(cardPool(cfg, { ...s, goods: { smokes: 2 } }, 'fitst').some(c => c.id === 'sell'));
  // the view shows the hand (odds, pay, energy, an energy's worth) and the way on
  const v = view(cfg, a.state);
  assert.equal(v.place, 'fitst');
  assert.equal(v.block, 'bar');
  assert.equal(v.route.stop, 'fitst');
  assert.equal(v.route.next, 'market');
  assert.deepEqual(v.hand.map(c => c.id), a.state.route.hand);
  for (const c of v.hand) {
    assert.equal(c.energy, 1);
    assert.equal(typeof c.perEnergy, 'number');
    assert.deepEqual(c.choice, { do: 'card', id: c.id });
  }
  assert.deepEqual(v.choices.map(c => c.choice.do), [...a.state.route.hand.map(() => 'card'), 'onward']);
  assert.ok(v.danger.here, 'the stop is ground: its danger is shown');
});

test('routes: a card is an hour and an energy, pays in its range, and is not dealt again there that day', () => {
  const s = { ...at('fitst', { energy: 6 }, 1, CALM), route: { id: 'fitStreet', from: 'park', to: 'market', way: 'foot', stops: ['fitst'], at: 0, hand: ['errand', 'dumpster'] } };
  const r = step(CALM, s, { do: 'card', id: 'errand' });
  const e = r.events.find(x => x.type === 'card');
  assert.equal(e.outcome, 'win');
  assert.ok(e.pay >= 20 && e.pay <= 26, `paid ${e.pay}`);
  assert.equal(e.route, 'fitStreet');
  assert.deepEqual(e.scene, { action: 'carry', spot: 'counter:shop' });
  assert.equal(r.state.energy, 5);
  assert.equal(r.state.hour, s.hour + 1);
  assert.equal(r.state.carried, e.pay);
  assert.deepEqual(r.state.route.hand, ['dumpster']);
  assert.ok(!cardPool(CALM, r.state, 'fitst').some(c => c.id === 'errand'), 'played today');
  assert.ok(checkRunBooks(r.state).ok);
  // the dumpster is the street's bins, drawn on the stop's own supply, refilled in the morning
  const d = step(CALM, r.state, { do: 'card', id: 'dumpster' });
  assert.ok(d.events.some(x => x.type === 'bins' && x.card === 'dumpster'));
  assert.equal(d.state.supply.fitst.bins, cfg.stops.fitst.supply.bins.max - 1);
  const home = run(CALM, d.state, [{ do: 'onward' }, { do: 'walk', to: 'park' }, { do: 'onward' }, { do: 'inside' }, { do: 'sleep' }]).state;
  assert.equal(home.supply.fitst.bins, cfg.stops.fitst.supply.bins.max);
  assert.ok(cardPool(CALM, home, 'fitst').some(c => c.id === 'errand'), 'a new day');
  // a sale on the way uses a good, win or lose
  const sale = step(CALM, { ...s, goods: { smokes: 2 }, route: { ...s.route, hand: ['sell'] }, rig: { chances: [99] } }, { do: 'card', id: 'sell' });
  assert.equal(sale.state.goods.smokes, 1);
  assert.equal(sale.events.find(x => x.type === 'card').outcome, 'fail');
  // with no energy, a card waits and the way on is open (the way was paid setting out)
  const v = view(CALM, { ...s, energy: 0 });
  assert.equal(move(v, c => c.do === 'card').available, false);
  assert.equal(move(v, c => c.do === 'onward').available, true);
  assert.equal(v.stranded, null);
});

test('routes: passing a stop by plays nothing; on foot the leg on is an hour on its ground, where you can be jumped', () => {
  const s = { ...at('fitst', { energy: 4 }), route: { id: 'fitStreet', from: 'market', to: 'park', way: 'foot', stops: ['fitst'], at: 0, hand: ['errand', 'lookout'] } };
  // rigged: the jump roll hits, the contest a scuffle (half)
  const r = step(cfg, { ...carrying(s, 80), rig: { chances: [0], rolls: [40] } }, { do: 'onward' });
  const types = r.events.map(e => e.type);
  assert.deepEqual(types, ['onward', 'jumped', 'arrive']);
  const on = r.events[0];
  assert.deepEqual(on.passed, ['errand', 'lookout']);
  assert.equal(on.scene.ride, 'foot');
  const j = r.events[1];
  assert.equal(j.route, 'fitStreet');
  assert.equal(j.place, 'fitst');
  assert.equal(j.block, 'bar');
  assert.ok(j.taken > 0);
  assert.equal(r.state.energy, 4, 'no energy: the way was paid setting out');
  assert.ok(checkRunBooks(r.state).ok);
  // the chance rolled is the one the view showed for the way on
  const shown = move(view(cfg, carrying(s, 80)), c => c.do === 'onward').danger;
  assert.equal(j.chance, shown.legs[0].jump.chance);
  // a bad one ends the day in the clinic, off the route
  const bad = step(cfg, { ...carrying(s, 80), rig: { chances: [0], rolls: [0] } }, { do: 'onward' }).state;
  assert.equal(bad.place, 'clinic');
  assert.equal(bad.route, null);
});

test('routes: the danger on the way is in the view, and rises with what you carry, cash and goods', () => {
  const at$ = n => carrying(at('market', { energy: 5, hoursThere: 2 }), n);
  const walk = n => move(view(cfg, at$(n)), walkTo('park')).danger;
  const [none, some, more] = [walk(0), walk(60), walk(200)];
  assert.ok(none.jump.chance < some.jump.chance && some.jump.chance < more.jump.chance);
  assert.ok(some.jump.takes.bad < more.jump.takes.bad);
  // the hour you set out from the market rolls the market, as the subway's leaving hour does; then Fit Street's ground
  assert.deepEqual(more.legs.map(l => [l.from, l.rolls]), [['market', true], ['fitst', true]]);
  assert.ok(more.legs[1].jump.chance < more.legs[0].jump.chance, 'the street is quieter than the market');
  assert.equal(more.atStake.cash, 200);
  assert.match(more.text, /jumped/);
  // goods on you: what a jump on the way would take of them
  const g = move(view(cfg, { ...at$(60), goods: { discs: 4 } }), walkTo('park')).danger;
  assert.deepEqual(g.jump.takesGoods.bad, { discs: 4 });
  assert.equal(g.atStake.worth, 4 * 7);
  // from the quiet trailer park, the setting out rolls nothing
  const out = move(view(cfg, at('park', { energy: 6 })), walkTo('market')).danger;
  assert.deepEqual(out.legs.map(l => [l.from, l.rolls]), [['park', false], ['fitst', true]]);
  // the meter's numbers are wayDanger's, the rules' own
  assert.deepEqual(wayDanger(cfg, at$(60), 'foot', [{ from: 'market', to: 'fitst' }, { from: 'fitst', to: 'park' }]).jump, walk(60).jump);
});

test('routes: the skateboard is bought at the Jay St night market, and goes the way in one hour for no energy, rolling nothing between', () => {
  const v0 = view(cfg, at('market', { energy: 5 }));
  const sk = move(v0, skateTo('park'));
  assert.equal(sk.available, false);
  assert.match(sk.why, /skateboard \(Mr\. Okafor sells one at the Jay St night market, \$100\)/);
  const buy = v0.errands.find(x => x.item === 'board');
  assert.deepEqual([buy.kind, buy.price, buy.keeper.name, buy.spot], ['ride', 100, 'Mr. Okafor', 'stall:6']);
  const got = step(cfg, carrying(at('market', { energy: 5 }), 120), { do: 'get', item: 'board' });
  assert.equal(got.state.things.board, true);
  assert.equal(got.state.carried, 20);
  assert.ok(checkRunBooks(got.state).ok);
  assert.deepEqual(view(cfg, got.state).owned, { pocket: false, cutter: false, bed: false }, 'not one of the three');
  const v = view(cfg, got.state);
  const ride = move(v, skateTo('park'));
  assert.ok(ride.available);
  assert.deepEqual([ride.energy, ride.hours], [0, 1]);
  assert.equal(ride.danger.legs[1].rolls, false, 'nobody catches you between the stops');
  const r = run(cfg, { ...got.state, rig: { chances: [99, 99] } }, [{ do: 'skate', to: 'park' }, { do: 'onward' }]);
  assert.equal(r.state.place, 'park');
  assert.equal(r.state.energy, 5);
  assert.equal(r.state.hour, got.state.hour + 1);
  assert.ok(r.events.filter(e => e.scene?.ride).every(e => e.scene.ride === 'skate'));
  // faster and less energy than walking
  assert.ok(ride.energy < move(v, walkTo('park')).energy && ride.hours < move(v, walkTo('park')).hours);
  // you still need energy to push off
  assert.equal(move(view(cfg, { ...got.state, energy: 0 }), skateTo('park')).available, false);
});

test('routes: every dollar accounted for and every event staged, a random walker on the routes with and without the board', () => {
  const seen = new Set();
  for (const seed of [1, 2, 3, 4]) {
    let s = newRun({ seed, cfg });
    if (seed > 2) s.things = { board: true };
    s.owned = { ...s.owned, cutter: seed % 2 === 0 };
    const r = rng(seed, 'routes-monkey');
    for (let i = 0; i < 600; i++) {
      const v = view(cfg, s);
      const legal = v.choices.filter(c => c.available);
      assert.ok(legal.length, `no legal choice at ${s.place}`);
      const way = legal.find(c => c.what === 'route');
      const c = way && r() < 0.6 ? way.choice : pick(r, legal).choice;
      const choice = c.do === 'out' ? { ...c, take: Math.min(s.banked, 4) } : c;
      const out = step(cfg, s, choice);
      for (const e of out.events) {
        assert.ok(e.scene && (e.scene.kind || e.scene.action || e.scene.ride || e.scene.notice), `${e.type}: a scene`);
        if (e.scene.kind) assert.ok(KINDS[e.scene.kind], `unknown kind ${e.scene.kind}`);
        if (e.scene.action) assert.ok(ACTIONS.includes(e.scene.action), `unknown action ${e.scene.action}`);
        if (e.scene.ride) assert.ok(['subway', 'foot', 'skate'].includes(e.scene.ride));
        if (e.block) assert.ok(CITY.blocks[e.block], `unknown block ${e.block}`);
        if (e.route) seen.add(e.type);
      }
      s = out.state;
      assert.ok(checkRunBooks(s).ok, `books off at step ${i}`);
      assert.ok(!s.route === !cfg.stops[s.place], `on a route only at a stop: ${s.place}`);
    }
  }
  for (const type of ['stop', 'card', 'onward', 'arrive']) assert.ok(seen.has(type), `no ${type} on a route: ${[...seen]}`);
});

test('routes: an older saved state (version 5) loads, on no route, and can walk', () => {
  assert.ok(RUN_STATE_VERSION >= 6); // (7 since home-1: a version-5 state still loads)
  const v5 = { ...at('park', { energy: 6 }), v: 5 };
  delete v5.route;
  const v = view(cfg, v5);
  assert.equal(v.route, null);
  assert.ok(move(v, walkTo('market')).available);
  const r = run(cfg, v5, [{ do: 'walk', to: 'market' }, { do: 'onward' }]);
  assert.equal(r.state.place, 'market');
  assert.ok(checkRunBooks(r.state).ok);
});

test('routes: a route and its stops are data: another stop on the way, a route of its own, a locked end', () => {
  // a second stop, after Fit Street, on the market's side: passed in order, and in reverse coming back
  const ELM = { label: 'the corner of Jay St', where: 'on Jay St', block: 'market', spot: 'kerb', tier: 'street', hand: 1,
    cards: { flyers: { label: 'Hand out flyers', with: 'a promoter', odds: 100, base: [5, 6], scene: { win: { action: 'hand_off' } } } } };
  const two = withRunConfig({ stops: { jay: ELM }, routes: { fitStreet: { stops: ['fitst', 'jay'] } } }, CALM);
  assert.deepEqual(routesFrom(two, 'park')[0].stops, ['fitst', 'jay']);
  assert.deepEqual(routesFrom(two, 'market')[0].stops, ['jay', 'fitst']);
  const there = run(two, at('park', { energy: 6 }, 1, two), [{ do: 'walk', to: 'market' }, { do: 'onward' }]).state;
  assert.equal(there.place, 'jay');
  assert.deepEqual(there.route.hand, ['flyers']);
  assert.equal(move(view(two, at('park', { energy: 6 }, 1, two)), walkTo('market')).hours, 3);
  // a route to a locked place is shown, locked
  const corner = withRunConfig({ routes: { toCorner: { label: 'the walk to the corner', between: ['park', 'corner'], stops: [] } } });
  const c = move(view(corner, at('park', { energy: 6 }, 1, corner)), walkTo('corner'));
  assert.equal(c.available, false);
  assert.equal(c.why, 'held by the Sixes');
  assert.equal(c.locked, true);
  // the real game has the one route
  assert.deepEqual(Object.keys(cfg.routes), ['fitStreet']);
});

test('routes: the stop is real ground: a block of the city map that lies between the park\'s and the market\'s', () => {
  const table = JSON.parse(readFileSync(new URL('../demo/stage/places.json', import.meta.url), 'utf8')).places;
  for (const [id, s] of Object.entries(cfg.stops)) {
    assert.ok(CITY.blocks[s.block], `${id}: no block ${s.block}`);
    assert.ok(CITY.blocks[s.block].spots.includes(s.spot) || table[s.block]?.spots?.[s.spot], `${id}: no spot ${s.spot}`);
    for (const [rid, r] of Object.entries(cfg.routes).filter(([, x]) => x.stops.includes(id))) {
      const [a, b] = r.between.map(p => table[cfg.places[p].block].at);
      const p = table[s.block].at;
      // between: nearer each end than the ends are to each other, and close to the straight line from one to the other
      const d = (u, w) => Math.hypot(u[0] - w[0], u[1] - w[1]);
      const off = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / d(a, b);
      assert.ok(d(a, p) < d(a, b) && d(b, p) < d(a, b), `${rid}: ${id} is not between its ends`);
      assert.ok(off < 10, `${rid}: ${id} is ${off.toFixed(1)} m off the line`);
    }
  }
});

test('routes: the scripted walkers and skaters play the routes, the same seed giving the same season', () => {
  const a = playSeason(cfg, { seed: 5, policy: POLICIES.walker(90, 'play') });
  const b = playSeason(cfg, { seed: 5, policy: POLICIES.walker(90, 'play') });
  assert.deepEqual(a.takes, b.takes);
  assert.ok(a.tally.walks > 0);
  assert.ok(checkRunBooks(a.state).ok);
  const sk = playSeason(cfg, { seed: 5, policy: POLICIES.skater(90), kit: { board: true } });
  assert.equal(sk.state.things.board, true);
  assert.ok(sk.tally.walks > 0);
  // a player who never walks never sets foot on the route
  assert.equal(playSeason(cfg, { seed: 5, policy: POLICIES.homeAt(90) }).tally.walks, 0);
  const marks = judgeRoutes(measureRoutes(cfg, { seeds: 3, stops: [90], carries: [1, 2] }));
  assert.deepEqual(marks.map(m => m.n), ['R1', 'R2', 'R3', 'R4']);
  for (const m of marks) assert.equal(typeof m.pass, 'boolean');
  assert.match(routesText(marks), /Walking is a real choice/);
});
