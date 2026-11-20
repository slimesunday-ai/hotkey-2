// THE DOCK (ui-3 leg 2, demo/run/dock.js): the three things in front of you (1 to 3) and the six verbs that never move,
// renumber or vanish (Shop B, Rob R, Bins X, Travel T, Home H, Sleep Z). Checked over every choice point of fourteen
// scripted players: the verbs are always the same six in the same order; every choice the rules offer can be reached
// from the dock (what you wear at the crib is the You panel's); on the street the cards are the dealt options in the
// rules' order; a verb with nothing it can do says why.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, newRun, view, step } from '../src/run/index.mjs';
import { POLICIES, decide } from '../src/run/policies.mjs';
import { fullEnergy } from '../src/run/rules.mjs';
import { dockOf, placeOf, VERBS } from '../demo/run/dock.js';

const cfg = RUN_CONFIG;
const DAYS = 4;
const PLAYERS = [
  ['park', POLICIES.park, {}],
  ['mixed', { ...POLICIES.mixed(120), buy: true }, {}],
  ['dealer', POLICIES.dealer(120, 4), {}],
  ['earl', { ...POLICIES.homeFirst(120), defend: 'guard', race: true, buy: true }, { bed: true }],
  ['walker', POLICIES.walker(90, 'play'), {}],
  ['skater', POLICIES.skater(90), { board: true }],
  ['burner', POLICIES.burner(120), {}],
  ['reckless', POLICIES.reckless, {}],
  ['rough', { ...POLICIES.homeAt(120), rough: true }, {}],
  ['lean', { ...POLICIES.park, regular: 'lean' }, {}],
  ['refuse', { ...POLICIES.park, regular: 'lean', door: 'refuse' }, {}],
  // (pot-2: two who cook: Zonked and Disco Coma in turn, lifting every sleeper, the hot plate theirs from the start)
  ['cook', POLICIES.cook(120, 'alternate', { lift: 'always' }), { hotplate: true }],
  ['coma', POLICIES.cook(120, ['tea', 'sticks'], { lift: 'always', parkFirst: true }), { hotplate: true }],
];

function start(seed, kit) {
  const s = newRun({ seed, cfg });
  for (const [k, on] of Object.entries(kit)) if (cfg.things?.[k]) s.things = { ...s.things, [k]: on };
  s.owned = { ...s.owned, ...Object.fromEntries(Object.entries(kit).filter(([k]) => !cfg.things?.[k])) };
  s.energy = fullEnergy(cfg, s);
  return s;
}
/** Every state before a choice of a player to the end of day DAYS. */
function statesOf(seed, policy, kit) {
  let state = start(seed, kit);
  const out = [];
  while (state.day <= DAYS && out.length < 2000) {
    out.push(state);
    state = step(cfg, state, decide(cfg, state, policy)).state;
  }
  return out;
}
// (styles-1: what you fight with is the You panel's, as what you wear is)
// (sixes-1: and how Earl is told to fight: the You panel's and the door card's, as what you fight with)
// (pot-2: the pot's moves are on the dock: what you cook with under Shop, a sleeper's wallet under Rob, and the Cook
// move, the belt and a name for a mix under Cook, the pot's screen)
// (bench-1: the bench's own moves, what stands on the floor spot and the blue man's card, are not on the dock: the bench is
// off on the page (RUN_CONFIG has none of it) until its screens exist; they are the screens' builder's to place)
const OFF_DOCK = new Set(['wear', 'unwear', 'fightWith', 'earlWay', 'floor', 'takeBack']);
const POT_VERB = { making: 'shop', get: 'shop', lift: 'rob', cook: 'cook', belt: 'cook', unbelt: 'cook', name: 'cook' };

test('the verbs are always the same seven, in the same order, and every choice is on the dock', () => {
  let points = 0;
  const kinds = new Set();
  // (pot-2: the pot's moves the players met, each found on the dock, and under which verb)
  const pot = {};
  for (const [name, policy, kit] of PLAYERS) {
    for (const seed of [1, 2, 3]) {
      for (const state of statesOf(seed, policy, kit)) {
        const v = view(cfg, state);
        const d = dockOf({ cfg, v, state });
        points += 1;
        kinds.add(d.kind);
        assert.deepEqual(d.verbs.map(x => `${x.id}:${x.key}`), VERBS.map(x => `${x.id}:${x.key}`), `${name} ${seed}: the verbs`);
        assert.deepEqual(d.cards.map(c => c.n), [1, 2, 3], `${name} ${seed}: three slots`);
        for (const c of v.choices) {
          if (OFF_DOCK.has(c.choice.do) || (c.choice.do === 'buy' && state.owned[c.choice.item])) continue;
          assert.ok(placeOf(d, c.key), `${name} seed ${seed} day ${state.day} ${state.hour}:00 at ${state.place}: "${c.label}" is not on the dock`);
          if (POT_VERB[c.choice.do]) (pot[c.choice.do] ??= new Set()).add(placeOf(d, c.key).verb ?? 'card');
        }
        for (const verb of d.verbs) {
          const can = verb.keys.some(k => v.choices.find(c => c.key === k)?.available);
          if (!can) assert.ok(typeof verb.why === 'string' && verb.why.length, `${name}: ${verb.id} says why it cannot`);
          else assert.equal(verb.why, null);
        }
        if (d.kind === 'street') assert.deepEqual(d.cards.map(c => c.keys[0] ?? null), [0, 1, 2].map(i => v.options[i]?.key ?? null), `${name}: the cards are the dealt options`);
      }
    }
  }
  assert.ok(points > 500, `${points} choice points`);
  for (const k of ['street', 'crib', 'held', 'stop', 'door']) assert.ok(kinds.has(k), `the players met a ${k}`);
  for (const [move, verb] of Object.entries(POT_VERB)) {
    if (move === 'unbelt') continue;
    assert.deepEqual([...(pot[move] ?? [])], [verb], `${move}: met, and under ${verb}`);
  }
});

test('the belt: a bag put on at the crib comes off under Cook; the pot\'s moves are where the pot\'s screen says', () => {
  const s = { ...newRun({ seed: 3, cfg }), things: { hotplate: true }, stash: { zonk: 6 }, belt: { good: 'zonk', n: 1 } };
  const v = view(cfg, s);
  const d = dockOf({ cfg, v, state: s });
  const off = v.choices.find(c => c.choice.do === 'unbelt');
  assert.ok(off, 'the bag on the belt can come off at the crib');
  assert.equal(placeOf(d, off.key).verb, 'cook');
  assert.equal(placeOf(d, off.key).key, 'P');
  const cook = d.verbs.find(x => x.id === 'cook');
  assert.equal(cook.sheet, 'pot', 'Cook opens the pot\'s screen');
  // (away from the crib, Cook says why: at home, and where the hot plate is sold when it is not yours)
  const out = { ...newRun({ seed: 3, cfg }), place: 'park' };
  assert.match(dockOf({ cfg, v: view(cfg, out), state: out }).verbs.find(x => x.id === 'cook').why, /no hot plate: \$30/);
  const out2 = { ...out, things: { hotplate: true } };
  assert.equal(dockOf({ cfg, v: view(cfg, out2), state: out2 }).verbs.find(x => x.id === 'cook').why, 'cook at home (H)');
});

test('Home picks the way home that can be made, before hopping; Travel lists the ways that can be made first', () => {
  const s = { ...newRun({ seed: 3, cfg }), place: 'market', hour: 15, carried: 30, energy: 4 };
  const v = view(cfg, s);
  const d = dockOf({ cfg, v, state: s });
  const home = d.verbs.find(x => x.id === 'home');
  const c = v.choices.find(x => x.key === home.keys[0]);
  assert.equal(c.choice.do, 'subway');
  assert.equal(c.choice.to, 'park');
  assert.equal(c.choice.hop, false);
  const travel = d.verbs.find(x => x.id === 'travel');
  const avail = travel.keys.map(k => v.choices.find(x => x.key === k).available);
  assert.deepEqual(avail, [...avail].sort((a, b) => Number(b) - Number(a)), 'the ways that can be made first');
});

test('at the crib: step out first, the next of the three to own, Cousin Earl; Home says you are home', () => {
  const s = newRun({ seed: 3, cfg });
  const v = view(cfg, s);
  const d = dockOf({ cfg, v, state: s });
  assert.equal(d.kind, 'crib');
  assert.deepEqual(d.cards.map(c => c.role), ['out', 'goal', 'guard']);
  assert.equal(v.choices.find(c => c.key === d.cards[1].keys[0]).choice.item, 'pocket', 'the cheapest first');
  assert.equal(d.verbs.find(x => x.id === 'home').why, 'you are home');
  assert.equal(v.choices.find(c => c.key === d.verbs.find(x => x.id === 'sleep').keys[0]).choice.do, 'sleep');
});
