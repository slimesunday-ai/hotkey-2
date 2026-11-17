// THE FIGHT (src/fight/): a test round of THE RUN, a live fight at a subway stop, run headless.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFight, step, runFight, outcome, PRESETS, LEVELS, POLICIES, kite, still, advise, report, TICK, CAP, ARENA } from '../src/fight/index.mjs';
import { rng } from '../src/rng.mjs';

/** A player's hands for a whole fight: a seeded wander, one move a tick. */
function wander(seed, ticks = Math.ceil(CAP / TICK) + 2) {
  const r = rng('fight-test', seed);
  const moves = [];
  let m = { x: 0, y: 0 };
  for (let k = 0; k < ticks; k++) {
    if (k % 20 === 0) m = { x: Math.round((r() * 2 - 1) * 10) / 10, y: Math.round((r() * 1.4 - 0.4) * 10) / 10 };
    moves.push(m);
  }
  return moves;
}
const essence = F => ({ over: F.over, events: F.events, stats: F.stats, people: F.people, loot: F.loot });

test('the same seed and the same moves give the same fight', () => {
  for (const preset of ['starter', 'pistol', 'full']) {
    const moves = wander(7);
    const A = runFight({ build: PRESETS[preset], level: 'real', seed: 11, moves });
    const B = runFight({ build: PRESETS[preset], level: 'real', seed: 11, moves });
    assert.deepEqual(essence(A), essence(B));
    assert.ok(A.over && A.events.length > 20, `${preset}: a whole fight was played`);
    // (step by step, as the page does it, is the same fight too)
    const C = createFight({ build: PRESETS[preset], level: 'real', seed: 11 });
    while (!C.over) step(C, moves[C.tick] ?? { x: 0, y: 0 });
    assert.deepEqual(essence(C), essence(A));
    // (and another seed, or other moves, is another fight)
    assert.notDeepEqual(runFight({ build: PRESETS[preset], level: 'real', seed: 12, moves }).events, A.events);
    assert.notDeepEqual(runFight({ build: PRESETS[preset], level: 'real', seed: 11, moves: wander(8) }).events, A.events);
  }
});

test('a fight is over inside the cap, and every fight ends one of four ways', () => {
  for (const preset of Object.keys(PRESETS)) {
    for (const level of Object.keys(LEVELS)) {
      for (const policy of [still, kite]) {
        const F = runFight({ build: PRESETS[preset], level, seed: 3, policy });
        assert.ok(['won', 'lost', 'left', 'timeout'].includes(F.over.result));
        assert.ok(F.over.t <= CAP + TICK);
        const me = F.people[0];
        assert.ok(me.x >= 0 && me.x <= ARENA.w && me.y >= 0 && me.y <= ARENA.h, 'the player stays in the arena');
      }
    }
  }
});

test("each preset's result is stable: the same, run alone or among others, run after run", () => {
  const sweep = () => Object.keys(PRESETS).map(id => [1, 2, 3, 4, 5].map(seed => {
    const O = outcome(runFight({ build: PRESETS[id], level: 'real', seed, policy: kite }));
    return `${id}/${seed}: ${O.result} ${O.seconds} s, ${O.hp} hp, ${O.dropped}/${O.of}`;
  }));
  const first = sweep();
  const again = sweep();
  assert.deepEqual(again, first);
  // (the last preset alone, after nothing else, is what it was in the sweep)
  const alone = [1, 2, 3, 4, 5].map(seed => {
    const O = outcome(runFight({ build: PRESETS.full, level: 'real', seed, policy: kite }));
    return `full/${seed}: ${O.result} ${O.seconds} s, ${O.hp} hp, ${O.dropped}/${O.of}`;
  });
  assert.deepEqual(alone, first[first.length - 1]);
});

test('better builds do better at the real stop, and backing away while firing beats standing still', () => {
  const wins = (preset, policy) => Array.from({ length: 40 }, (_, k) => runFight({ build: PRESETS[preset], level: 'real', seed: k + 1, policy }).over.result === 'won').filter(Boolean).length;
  const k = Object.fromEntries(['starter', 'pistol', 'pistolVest', 'full'].map(id => [id, wins(id, kite)]));
  assert.ok(k.starter < k.pistol && k.pistol <= k.pistolVest && k.pistolVest <= k.full, JSON.stringify(k));
  assert.ok(k.pistol >= wins('pistol', still) + 8, 'moving matters with a handgun');
});

test('the advice names the right thing: a gun for bare hands', () => {
  const F = runFight({ build: PRESETS.hands, level: 'real', seed: 1, policy: kite });
  assert.equal(F.over.result, 'lost');
  const A = advise(F);
  assert.equal(A.key, 'pistol');
  assert.equal(A.consider, 'consider a gun');
  assert.match(A.line, /^They landed \d+ on you (before you dropped one|and you never dropped one)\. A handgun would have dropped \w+ before they reached you\.$/);
});

test('the advice names the right thing: keep moving, for a handgun that stood still', () => {
  const F = runFight({ build: PRESETS.pistol, level: 'real', seed: 1, policy: still });
  assert.equal(F.over.result, 'lost');
  const A = advise(F);
  assert.equal(A.key, 'move');
  assert.match(A.line, /Backing away while you fire wins \d+ of \d+ like it with what you have\./);
});

test('the advice names the right thing: the missing vest, for the full build that went down at the hard stop', () => {
  const build = { weapon: 'chopper', gear: ['strength', 'shoes'], ally: true };
  const seed = [1, 2, 3, 4, 5, 6, 7, 8].find(s => runFight({ build, level: 'hard', seed: s, policy: kite }).over.result === 'lost');
  assert.ok(seed, 'one of the first seeds is lost');
  const F = runFight({ build, level: 'hard', seed, policy: kite });
  const A = advise(F);
  assert.equal(A.key, 'vest');
  assert.equal(A.consider, 'consider a vest');
  assert.match(A.line, /A stab vest would have taken \d+ of it off\.$/);
});

test('the losing line comes out of the headless fight as text, as on the card', () => {
  const F = runFight({ build: PRESETS.starter, level: 'real', seed: 2, policy: still });
  const R = report(F);
  assert.equal(R.result, 'lost');
  assert.match(R.lines.join(' '), /You wake at your trailer\./);
  assert.match(R.lines[R.lines.length - 1], /^Consider .+\. .+\.$/);
  assert.equal(R.lines[R.lines.length - 1], `${R.advice.consider[0].toUpperCase()}${R.advice.consider.slice(1)}. ${advise(F).line}`);
  const W = runFight({ build: PRESETS.full, level: 'easy', seed: 2, policy: kite });
  const RW = report(W);
  assert.equal(RW.result, 'won');
  assert.match(RW.lines.join(' '), /health left/);
  assert.equal(RW.advice, null);
});
