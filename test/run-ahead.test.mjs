// WHAT'S AHEAD (tree-1; src/run/ahead.mjs, the page's demo/run/ahead.js): every way to fight, every piece of gear,
// every piece for the home, Cousin Earl and every place, once each, drawn from the config itself (a thing added to the
// config shows up with no other change), each with its state (yours, within reach today, something first) for a new run
// and for one in the middle of the game, and the fight numbers it shows the same as the fight cards'.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, withRunConfig, newRun, view, step } from '../src/run/index.mjs';
import { aheadOf, aheadCells, aheadCell, oddsKey, whoFights, fightArms } from '../src/run/ahead.mjs';
import { duelChance, toughnessOf, streetPlaces } from '../src/run/rules.mjs';
import { RIVALS } from '../src/fight/data.mjs';

const cfg = RUN_CONFIG;
const treeOf = (c, s) => view(c, s).ahead;
/** Every node id the branches hold, in their order (a node twice would be counted twice). */
const listed = A => A.branches.flatMap(b => b.groups.flatMap(g => g.nodes));

/** The ids the config says must be in the tree: every punch style, every thing of the shop, every thing of `things` with
 *  a use (`does`), every good, Earl, every place you can work, every route. */
function expected(c) {
  return [
    'arm:hands',
    ...Object.keys(c.styles).map(k => `style:${k}`),
    ...Object.keys(c.shop).map(k => `shop:${k}`),
    ...Object.entries(c.things).filter(([, t]) => t.does).map(([k]) => `thing:${k}`),
    // (pot-1: the goods bought from a connect; what you make and make it with is the Make tree's, the screens' next job)
    ...Object.keys(c.goods).filter(k => !c.goods[k].made && !c.goods[k].making).map(k => `good:${k}`),
    'guard',
    ...Object.entries(c.places).filter(([, p]) => p.jobs).map(([k]) => `place:${k}`),
    ...Object.keys(c.routes).map(k => `route:${k}`),
  ];
}

test('every punch style, piece of gear, home piece, Earl and every place you can work is in the tree exactly once', () => {
  const A = treeOf(cfg, newRun({ seed: 3, cfg }));
  const ids = listed(A);
  for (const id of expected(cfg)) assert.equal(ids.filter(x => x === id).length, 1, `${id} once in the tree`);
  assert.equal(new Set(ids).size, ids.length, 'no node twice');
  // and nothing in it that the config does not hold, but the locked corner (shown locked) and bare hands
  const extra = ids.filter(id => !expected(cfg).includes(id));
  assert.deepEqual(extra, ['place:corner']);
  // (the counts the config gives: three styles, three of the shop, six home pieces and the board, two goods, four places)
  assert.equal(Object.keys(cfg.styles).length, 3);
  assert.equal(ids.filter(id => A.nodes[id].branch === 'home').length, Object.values(cfg.things).filter(t => t.defends).length + 1);
  assert.deepEqual(ids.filter(id => A.nodes[id].kind === 'place' && A.nodes[id].state !== 'later').map(id => A.nodes[id].key).sort(), streetPlaces(cfg).sort());
  // the cosmetic things (no `does`) are the Library's, not the tree's: nothing that does nothing is in it
  for (const [k, t] of Object.entries(cfg.things)) if (!t.does) assert.ok(!ids.includes(`thing:${k}`), `${k} does nothing: not in the tree`);
  // (raid-1) guns are in the run: never in a one-on-one (the fight branch says so), only at your door against the Sixes
  assert.match(A.branches.find(b => b.id === 'fight').quiet, /never in a one-on-one/);
  const fightNodes = A.branches.find(b => b.id === 'fight').groups.flatMap(g => g.nodes);
  assert.ok(!JSON.stringify(fightNodes.map(id => A.nodes[id])).match(/\bgun/i));
});

test('a thing, a style or a place added to the config shows up in the tree with no other change', () => {
  const more = withRunConfig({
    styles: { elbow: { label: 'the elbow', at: 'docks', keeper: 'npc:foreman:docks:2', spot: 'pier', price: 60, does: 'Short and close.' } },
    duel: { you: { elbow: { weapon: 'haymaker', hits: 1.6, label: 'the elbow' } } },
    things: { padlock: { label: 'a padlock', kind: 'home', piece: 'kit:door-locks', desc: 'a padlock', price: 12, at: 'park', keeper: 'npc:neighbour:2', spot: 'yard-sale', inTrailer: 'door', defends: { pct: 60 }, against: ['sneak'], does: 'A little harder to get in', job: 'A sneak gets in 60%, not 75%' } },
    shop: { boots: { label: 'Steel-toe boots', price: 60, does: 'Nothing yet' } },
    goods: { pills: { label: 'pills', pack: 'a bag of pills', at: 'docks', price: 30, sales: 3, perDay: 1 } },
    places: { docks: { connect: { who: 'npc:driver:docks:2', spot: 'pier' } } },
  });
  const A = treeOf(more, newRun({ seed: 3, cfg: more }));
  const ids = listed(A);
  for (const id of expected(more)) assert.equal(ids.filter(x => x === id).length, 1, `${id} once in the tree`);
  for (const id of ['style:elbow', 'thing:padlock', 'shop:boots', 'good:pills']) assert.ok(ids.includes(id), `${id} shows up`);
  assert.equal(A.nodes['thing:padlock'].branch, 'home');
  assert.equal(A.nodes['style:elbow'].where.who.name, 'Rosa');
  assert.ok(A.nodes['place:docks'].got.includes('style:elbow') && A.nodes['place:docks'].got.includes('good:pills'), 'the docks list what is only had there');
});

test('a new run: bare hands yours, the dog sign within reach, the rest a sum to go, the corner locked', () => {
  const s = newRun({ seed: 3, cfg });
  const A = treeOf(cfg, s);
  const N = A.nodes;
  assert.equal(A.have, 20);
  assert.equal(N['arm:hands'].state, 'owned');
  // $20 banked: the $5 sign and a $10 carton are within reach; the $25 deadbolt is $5 to go
  assert.equal(N['thing:dogsign'].state, 'now');
  assert.equal(N['thing:dogsign'].here, false, 'sold in the trailer park, not at the crib');
  assert.equal(N['good:smokes'].state, 'now');
  assert.equal(N['thing:deadbolt'].state, 'later');
  assert.equal(N['thing:deadbolt'].toGo, 5);
  assert.equal(N['thing:deadbolt'].stateText, '$5 to go');
  for (const k of Object.keys(cfg.styles)) assert.equal(N[`style:${k}`].toGo, cfg.styles[k].price - 20);
  assert.equal(N['shop:cutter'].state, 'later');
  assert.equal(N.guard.state, 'later');
  assert.equal(N.guard.toGo, cfg.guard.price - 20);
  // the places: your street is where you are (the crib opens onto it), the rest one ride away, the corner locked
  assert.equal(N['place:park'].here, true);
  for (const p of ['market', 'docks', 'plaza']) assert.equal(N[`place:${p}`].state, 'now');
  assert.equal(N['place:corner'].state, 'later');
  assert.match(N['place:corner'].why, /held by the Sixes/);
  // the next thing: the cheapest within reach
  assert.equal(A.next.id, 'thing:dogsign');
  // where each is had, in the config's words
  assert.equal(N['style:throw'].where.who.name, 'Mr. Haines');
  assert.match(N['style:throw'].where.text, /^Mr\. Haines teaches it by the pier, on the docks\.$/);
  assert.match(N['thing:floorsafe'].where.text, /Mr\. Okafor sells it at his stall, at the Jay St night market/);
  assert.match(N['shop:bed'].where.text, /At your crib, from banked money/);
  // what each opens: the cutter the stick-up and robbing; the board the walk; a good its selling jobs
  assert.deepEqual(N['shop:cutter'].opens.map(o => o.kind).sort(), ['job', 'rob']);
  assert.ok(N['shop:cutter'].opens.some(o => o.id === 'stickup' && o.place === 'market'));
  assert.equal(N['thing:board'].opens[0].kind, 'way');
  assert.deepEqual(N['good:smokes'].opens.map(o => o.id).sort(), ['crowd', 'loosies', 'sell']);
  assert.deepEqual(N['good:discs'].opens.map(o => o.id), ['crowd']);
  // the home's pieces by the visitor they answer (config `against`), in the order the pressure brings them
  const home = A.branches.find(b => b.id === 'home');
  // (raid-1: and the Sixes' raid: the guns and the raid's pieces)
  assert.deepEqual(home.groups.map(g => g.id), ['sneak', 'both', 'crew', 'sixes']);
  assert.ok(home.groups.find(g => g.id === 'sixes').nodes.includes('thing:doorman'));
  assert.deepEqual(home.groups.find(g => g.id === 'crew').nodes, ['thing:doorbar']);
  assert.ok(home.groups.find(g => g.id === 'both').nodes.includes('guard'));
  // the fight's root and its children
  assert.equal(N['arm:hands'].parent, null);
  for (const k of Object.keys(cfg.styles)) assert.equal(N[`style:${k}`].parent, 'arm:hands');
});

test('in the middle of the game: what you own is yours, what is sold here is here now, a connect against you blocks his goods', () => {
  const s0 = newRun({ seed: 3, cfg });
  const s = { ...s0, day: 5, hour: 14, place: 'market', energy: 5, carried: 130, banked: 95, owned: { pocket: true, cutter: true, bed: false },
    styles: { jab: true }, fightWith: 'jab', things: { deadbolt: true, dogsign: true }, goods: { smokes: 3 }, trust: { 'npc:connect:market': -3, 'npc:connect:projects': -3 },
    home: { ...s0.home, guard: null }, books: { ...s0.books, earned: 405 } };
  // ($130 on you: the floor safe, the camera and the board are sold here, and each is within what you carry)
  const A = treeOf(cfg, s);
  const N = A.nodes;
  assert.equal(A.have, 225);
  for (const id of ['arm:hands', 'style:jab', 'shop:cutter', 'shop:pocket', 'thing:deadbolt', 'thing:dogsign', 'good:smokes']) assert.equal(N[id].state, 'owned', id);
  assert.equal(N['style:jab'].stateText, 'yours · fighting with it');
  assert.equal(N['good:smokes'].stateText, '3 on you · 0 at home');
  // sold here at the market, and enough on you: here now, with the rules' own move
  for (const id of ['thing:floorsafe', 'thing:camera', 'thing:board']) {
    assert.equal(N[id].state, 'now', id);
    assert.equal(N[id].here, true, id);
    assert.equal(N[id].choice.available, true, id);
    assert.deepEqual(N[id].choice.choice, { do: 'get', item: N[id].key });
  }
  // had elsewhere and within reach: the throw on the docks, the bed at the crib
  assert.equal(N['style:throw'].state, 'now');
  assert.equal(N['style:throw'].here, false);
  assert.equal(N['shop:bed'].state, 'now');
  // blocked: Teo against you sells no discs; Earl against you takes no stretch
  assert.equal(N['good:discs'].state, 'later');
  assert.match(N['good:discs'].why, /Teo won't sell to you: against you/);
  assert.equal(N.guard.state, 'later');
  assert.match(N.guard.why, /Cousin Earl won't work for you: against you/);
  assert.equal(N['place:market'].here, true);
  // the counts on each branch
  assert.deepEqual(A.branches.find(b => b.id === 'fight').count, { owned: 3, of: 5, word: 'yours' });
  // learning a style here flips it to yours: the rules' own step, the tree again
  const learnAt = { ...s, place: 'docks' };
  const c = view(cfg, learnAt).ahead.nodes['style:throw'].choice;
  assert.equal(c.available, true);
  const after = step(cfg, learnAt, c.choice).state;
  assert.equal(treeOf(cfg, after).nodes['style:throw'].state, 'owned');
});

test('Earl on your step reads as yours, with his days; hurt, he is something first', () => {
  const s0 = newRun({ seed: 3, cfg });
  const on = treeOf(cfg, { ...s0, banked: 200, home: { ...s0.home, guard: { on: true, until: 3 } } }).nodes.guard;
  assert.equal(on.state, 'owned');
  assert.equal(on.stateText, 'on your step through day 3');
  const hurt = treeOf(cfg, { ...s0, banked: 200, home: { ...s0.home, guard: { on: false, hurt: 3 } } }).nodes.guard;
  assert.equal(hurt.state, 'later');
  assert.match(hurt.why, /hurt/);
});

test('the fight numbers: the same sample as the fight cards, against one as tough as most, rested; each arm against each way', () => {
  const s = newRun({ seed: 3, cfg });
  const cells = aheadCells(cfg, s);
  assert.equal(cells.length, fightArms(cfg).length * Object.keys(RIVALS).length);
  assert.deepEqual(fightArms(cfg), ['hands', 'jab', 'haymaker', 'throw', 'cutter']);
  // one cell, against the fight cards' own duelChance at the ordinary toughness
  const who = { id: 'ahead:bigman', name: RIVALS.bigman.name, role: null, style: 'bigman' };
  const plus = cfg.duel.foe.ordinary - toughnessOf(cfg, who);
  assert.equal(aheadCell(cfg, s, 'throw', 'bigman'), duelChance(cfg, s, who, cfg.energy.mattress, plus, { arm: 'throw' }).pct);
  // with some numbers in, the nodes carry them and say the best of it
  const odds = {};
  for (const c of cells.filter(c => c.style === 'bigman' || c.style === 'quick' || c.arm === 'hands' || c.arm === 'haymaker')) odds[c.key] = aheadCell(cfg, s, c.arm, c.style);
  const A = aheadOf(cfg, s, view(cfg, s).choices, odds);
  const big = A.nodes['style:haymaker'].vs.find(x => x.style === 'bigman');
  assert.equal(big.pct, odds[oddsKey(cfg, s, 'haymaker', 'bigman')]);
  assert.equal(big.hands, odds[oddsKey(cfg, s, 'hands', 'bigman')]);
  assert.match(A.nodes['style:haymaker'].short, /^best vs a \w+( \w+)? and a \w+( \w+)?: wins \d+ and \d+ in 10 \(bare hands: \d+ and \d+\)$/);
  assert.equal(A.nodes['style:haymaker'].vs.filter(x => x.best).length, 2);
  // without them, its config words
  assert.equal(aheadOf(cfg, s, []).nodes['style:haymaker'].short, cfg.styles.haymaker.does.split(/[.:]/)[0]);
  // who fights each way, one-on-one: Big Lou the big man, Shaky Dee at your door the quick one
  const W = whoFights(cfg);
  assert.ok(W.bigman.some(x => x.name === 'Big Lou'));
  assert.ok(W.quick.some(x => x.name === 'Shaky Dee'));
});

test('the tree changes no state and is the same for the same state', () => {
  const s = newRun({ seed: 3, cfg });
  const before = JSON.stringify(s);
  const a = JSON.stringify(aheadOf(cfg, s, view(cfg, s).choices));
  const b = JSON.stringify(aheadOf(cfg, s, view(cfg, s).choices));
  assert.equal(a, b);
  assert.equal(JSON.stringify(s), before);
});

test('the panel keeps the arrows while it is open and the game is choosing (dock.js arrowsTo)', async () => {
  const { arrowsTo } = await import('../demo/run/dock.js');
  assert.equal(arrowsTo({ sheet: 'ahead', phase: 'choose' }), 'ahead');
  assert.equal(arrowsTo({ sheet: 'ahead', phase: 'choose', hold: true }), 'dock');
  assert.equal(arrowsTo({ sheet: 'ahead', phase: 'playing' }), null);
});
