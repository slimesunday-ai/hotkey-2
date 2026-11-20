// THE POT'S PEOPLE WEAR IT (pot-3; demo/stage/looks/under.js, demo/run/scenes.js, demo/run/acted.js, the deals of
// demo/stage/hands/deals.js): measured without a browser. The rules' look channels name the stage's looks; a person
// under something stays at the place it took them, and the stage is handed who is under what; a bag sold is taken there
// and then and the buyer does not walk off; a sleeper's wallet is lifted down on your heels beside him, with your hand at
// his pocket on the ground; and every pose of both deals is drawn within a body's reach (reach.js: no streak).
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG } from '../src/run/index.mjs';
import { lookOf, wantOf } from '../demo/stage/looks/under.js';
import { lineOf } from '../demo/run/scenes.js';
import { scenesOf } from '../demo/run/acted.js';
import { stageDeal } from '../demo/stage/hands/deals.js';
import { measureHands } from '../demo/stage/hands/moves.js';
import { reachOfBlend, STRETCH } from '../demo/fight/puppet/reach.js';
import { fk, toWorld, legsInReach, pose0 } from '../demo/fight/puppet/rig.js';
import { LOOKS } from '../demo/stage/looks/index.js';

const E = RUN_CONFIG.make.effects;
const row = (effect, from = 100, until = 103) => ({ effect, look: E[effect].look ? { ...E[effect].look } : null, from, until, bad: !!E[effect].bad, lifted: false });

test('each effect the pot has names a look of the stage: asleep is Zonked, dancing Disco Rash with its crowd, the Pukes the Pukes', () => {
  assert.equal(lookOf(E.asleep.look), 'zonk');
  assert.equal(lookOf(E.dancing.look), 'disco');
  assert.equal(lookOf(E.pukes.look), 'pukes');
  for (const k of ['zonk', 'disco', 'pukes']) assert.ok(LOOKS[k], k);
  assert.deepEqual(wantOf([row('asleep')]), { main: 'zonk', pukes: false, crowd: false });
  assert.deepEqual(wantOf([row('dancing')]), { main: 'disco', pukes: false, crowd: true });
  // (a dirty batch: the Pukes ride along with what the bag does)
  assert.deepEqual(wantOf([row('pukes', 100, 101), row('asleep')]), { main: 'zonk', pukes: true, crowd: false });
  assert.equal(wantOf([]), null);
});

test('the tape (lowres) is the city\'s vhs skin in the board\'s variant B, and nothing of it jerks', () => {
  assert.deepEqual(LOOKS.lowres.skin, { skin: 'vhs', burst: 0.9, static: 0.6, band: 0.4, wash: 0.4, grain: 2 });
  assert.equal(LOOKS.lowres.jerk, undefined);
  assert.ok(!/low res/i.test(LOOKS.lowres.says.replace(/^lowres/, '')), 'no name is made up for it');
});

test('somebody under something stays at the place it took them, not off for the day; the stage is handed their rows', () => {
  const dee = 'npc:buyer:projects:1';
  const people = [{ id: dee, role: 'buyer', mood: 'friendly', outToday: true, place: 'park' }];
  const under = [{ who: { id: dee }, place: 'park', now: [row('asleep', 2 * 24 + 14, 2 * 24 + 17)], next: [] }];
  const L = lineOf({ t: 1, day: 2, hour: 15, place: 'park', people, under });
  const at = Object.entries(L.npcs).find(([, list]) => list.some(n => n.id === dee));
  assert.equal(at?.[0], 'projects', 'he stays at the trailer park');
  const n = at[1].find(q => q.id === dee);
  assert.equal(n.spot, 'bus:3', 'at the bus stop, where he took it (his spot at 13:00)');
  assert.equal(n.under, true);
  assert.deepEqual(L.under.map(u => [u.id, u.place, u.rows.map(r => r.effect)]), [[dee, 'park', ['asleep']]]);
  // (the same morning without it: a buyer served walks home with it, as before)
  const L0 = lineOf({ t: 1, day: 2, hour: 15, place: 'park', people });
  assert.notEqual(L0.npcs.projects?.find(q => q.id === dee)?.spot, 'bus:3');
  assert.deepEqual(L0.under, []);
});

test('a bag sold is handed over and taken there and then, and the buyer stays; a sleeper\'s wallet is the sleeper\'s own lift', () => {
  const sale = (job, won) => scenesOf([{ type: 'job', job, place: job === 'crowd' ? 'market' : 'park', outcome: won ? 'win' : 'fail', who: { id: 'npc:buyer:projects:1' }, goods: { good: 'zonk', made: true, product: 'zonk' }, ...(won ? { dose: { who: 'npc:buyer:projects:1' } } : {}) }]).events[0];
  for (const job of ['loosies', 'crowd']) for (const won of [true, false]) {
    const steps = sale(job, won).stage.steps;
    const deal = steps.find(s => s.perform)?.perform;
    assert.equal(deal?.deal, 'sellBag', `${job} ${won}`);
    assert.equal(deal.goods, 'bag-zonk');
    assert.equal(deal.paid, won);
    assert.ok(!steps.some(s => s.actor === 'npc:buyer:projects:1' && s.action === 'walk'), 'the buyer does not walk off');
  }
  // (a carton's cigarette is still a cigarette)
  const smoke = scenesOf([{ type: 'job', job: 'loosies', place: 'park', outcome: 'win', who: { id: 'npc:buyer:projects:1' }, goods: { good: 'smokes' } }]).events[0];
  assert.equal(smoke.stage.steps.find(s => s.perform)?.perform.deal, 'sell');
  const lift = scenesOf([{ type: 'lift', place: 'park', who: { id: 'npc:buyer:projects:1' } }]).events[0];
  assert.deepEqual(lift.stage.steps.map(s => [s.actor, s.action, s.perform?.deal ?? null]), [['a1', 'walk', null], ['a1', 'hand_off', 'liftSleeper']]);
});

/** Every frame of a staged deal. */
function* frames(T, step = 1 / 60) {
  for (let t = T.t0; t <= T.t1 + 1e-9; t += step) yield [t, T.at(t)];
}
const ALL = () => {
  const out = [];
  // the bag, at the sizes the cast has
  for (const [sa, sb] of [[1, 1], [0.9, 1.25], [1.25, 0.9]]) for (const paid of [true, false]) {
    const D = 0.72 * (sa + sb);
    out.push(['sellBag', stageDeal('sellBag', { people: { buyer: { x: -D / 2, z: 0, yaw: 0.14, scale: sa }, seller: { x: D / 2, z: 0, yaw: -0.14, scale: sb } }, cam: [0, 30], goods: 'bag-zonk', paid })]);
  }
  // the sleeper's wallet: his pocket on the ground in front of you, 0.44 m of your size away
  for (const s of [0.9, 1, 1.25]) for (const y of [0.18, 0.26, 0.32]) out.push(['liftSleeper', stageDeal('liftSleeper', { people: { you: { x: 0, z: -0.44 * s, yaw: 0, scale: s } }, cam: [0, 30], pocket: [0.05, y, 0] }), { s, pocket: [0.05, y, 0] }]);
  return out;
};

test('both deals: nothing lost, nothing floats, and every pose is drawn within a body\'s reach (no streak)', () => {
  for (const [name, T] of ALL()) {
    const M = measureHands(T);
    assert.deepEqual(M.faults, [], name);
    assert.equal(M.lost, 0, name);
    for (const [t, S] of frames(T, 1 / 30)) for (const [id, B] of Object.entries(S.bodies)) {
      const r = reachOfBlend(legsInReach(B.P, pose0()));
      assert.ok(r.far <= STRETCH, `${name} ${id} at ${t.toFixed(2)}: ${r.at} ${r.far.toFixed(2)} m from the hips`);
    }
  }
});

test('the sleeper\'s wallet: down on his heels, the hand at the pocket on the ground, up again with it in the hand', () => {
  for (const [name, T, o] of ALL()) {
    if (name !== 'liftSleeper') continue;
    let near = Infinity;
    let low = 0;
    let inHand = false;
    for (const [, S] of frames(T)) {
      const B = S.bodies.you;
      const f = fk(B.P);
      const side = S.things.wallet.holder;
      for (const fist of [f.fistL, f.fistR]) near = Math.min(near, Math.hypot(...toWorld(fist.map(v => v * B.scale), B.x, B.y, B.z, B.yaw).map((v, k) => v - o.pocket[k])));
      low = Math.max(low, B.P.drop);
      if (/^you:[LR]$/.test(side)) inHand = true;
    }
    assert.ok(near <= 0.12, `size ${o.s}, pocket ${o.pocket[1]} m up: the nearest hand ${near.toFixed(2)} m from it`);
    assert.ok(low >= 0.2, 'down on his heels');
    assert.ok(inHand, 'the wallet in his hand');
    const end = T.at(T.t1);
    assert.equal(end.things.wallet.holder.split(':')[1], 'pocket', 'and in his pocket at the end');
    assert.ok(T.t1 - T.t0 <= 3.6, `${(T.t1 - T.t0).toFixed(2)} s`);
  }
});
