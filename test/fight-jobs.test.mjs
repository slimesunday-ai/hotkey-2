// THE FIGHTS' ADDITIONS (fight-3, src/fight/): every weapon a job of its own. The Doorman's cone and throw back, the
// Long-eye up close and far, the three punch styles, the run's opponents' styles, Cousin Earl's ways, no gun in a
// one-on-one, "built", the small street fights, and the advice that knows them. Headless and seeded.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFight, step, runFight, kite, advise, upgrades, startDuel, runDuel, brawl,
  WEAPONS, GEAR, YOU, RIVALS, EARL_WAYS, WAYS_OFFERED, STREET, YARD, ARENA, LEVELS, PUNCHES, LONG_GUNS, ARMS, rivalFoe, levelOf, buildName, presetOf, PRESETS,
} from '../src/fight/index.mjs';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// (clear of the bus shelter, the arena's one post, and of the stairs)
const SPOT = [3, 3];

/**
 * A stop fight with you at SPOT holding `weapon` and the people of `foes` ([dx, dy] from you each, heavies) standing
 * there, in and still (they wait a long while before their first blow): the next shot is yours, at once.
 */
function standoff(weapon, foes, seed) {
  const F = createFight({ build: { weapon, gear: [] }, level: `test-${foes.length}`, seed, waves: foes.map(() => [0, 'heavy', 0]) });
  step(F, { x: 0, y: 0 });
  const me = F.people[0];
  [me.x, me.y] = SPOT;
  me.cd = 0;
  F.people.filter(p => p.side === 'foe').forEach((p, k) => {
    [p.x, p.y] = [SPOT[0] + foes[k][0], SPOT[1] + foes[k][1]];
    p.in = true;
    p.cd = 99;
    p.speed = 0;
  });
  return F;
}
/** Steps until your next shot: → its event, the fight. */
function nextShot(F) {
  const from = F.events.length;
  for (let k = 0; k < 60 && !F.over; k++) {
    step(F, { x: 0, y: 0 });
    const e = F.events.slice(from).find(q => q.type === 'shot' && q.id === 'you');
    if (e) return e;
  }
  return null;
}

test('the Doorman: one shell takes everyone in its cone up close, each hit on its own; nobody outside it', () => {
  const W = WEAPONS.doorman;
  assert.equal(W.name, 'Doorman');
  assert.ok(W.cone === 22 && W.mag === 2 && W.range === 7);
  let both = 0;
  for (let seed = 1; seed <= 60; seed++) {
    // (A straight ahead at 2 m, B 17° off it at 2 m: both in the cone; C square to your side: out of it)
    const F = standoff('doorman', [[2, 0], [2, 0.6], [0, 2.2]], seed);
    const e = nextShot(F);
    assert.ok(e, 'the Doorman fired');
    assert.equal(e.cone, 22);
    const [A, B, C] = F.people.filter(p => p.side === 'foe');
    assert.ok(!e.spread.includes(C.id), 'nobody outside the cone is hit');
    assert.equal(e.to, A.id, 'aimed at the nearest');
    if (e.spread.includes(A.id) && e.spread.includes(B.id)) both += 1;
    // (each hit in the event's spread is a hit on that one, at full damage this close)
    const hits = F.events.filter(q => q.type === 'hit' && q.by === 'you');
    assert.deepEqual(hits.map(h => h.id).sort(), [...e.spread].sort());
    for (const h of hits) assert.ok(h.dmg >= W.dmg[0] && h.dmg <= W.dmg[1], `full damage up close: ${h.dmg}`);
  }
  assert.ok(both >= 30, `both in the cone hit by the one shell in ${both} of 60`);
  // (a pellets count kept: people hit, all shells)
  const F = standoff('doorman', [[2, 0], [2, 0.6]], 3);
  nextShot(F);
  assert.equal(F.stats.pellets, F.events.find(q => q.type === 'shot').spread.length);
});

test('the Doorman throws them back a metre up close; further off it does less and throws less', () => {
  let near = 0;
  let far = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const F = standoff('doorman', [[2, 0]], seed);
    const e = nextShot(F);
    if (!e.hit) continue;
    near += 1;
    const A = F.people.find(p => p.side === 'foe');
    // (from 2 m to 3 m off: thrown back the Doorman's full metre, less the tick's walk)
    assert.ok(dist(A, F.people[0]) > 2.85, `thrown back up close: ${dist(A, F.people[0]).toFixed(2)} m`);
    const G = standoff('doorman', [[6, 0]], seed);
    const g = nextShot(G);
    if (!g.hit) continue;
    far += 1;
    const B = G.people.find(p => p.side === 'foe');
    const hit = G.events.find(q => q.type === 'hit' && q.by === 'you');
    // (at 6 m: 1 − 0.8 × 3.5 / 4.5 of it, a little over a third)
    assert.ok(hit.dmg <= Math.round(WEAPONS.doorman.dmg[1] * 0.38), `less damage far off: ${hit.dmg}`);
    assert.ok(dist(B, G.people[0]) < 6.5, `thrown back less far off: ${dist(B, G.people[0]).toFixed(2)} m`);
  }
  assert.ok(near > 25 && far > 15, `${near} near hits, ${far} far ones`);
});

test('the Long-eye: one hard shot, slow; with one of them on top of it, it misses far more', () => {
  const W = WEAPONS.longeye;
  assert.equal(W.name, 'Long-eye');
  assert.ok(W.range === 20 && W.rate < 1 && W.dmg[0] >= 36);
  const rate = dx => {
    let hit = 0;
    for (let seed = 1; seed <= 200; seed++) if (nextShot(standoff('longeye', [[dx, 0]], seed)).hit) hit += 1;
    return hit / 200;
  };
  const close = rate(1.2);
  const far = rate(15);
  // (close: 0.94 × 0.55 ≈ 0.52; far, across the street: 0.84)
  assert.ok(close < 0.65 && far > 0.72, `close ${close}, far ${far}`);
  // (one hit drops a shooter or a runner most of the time: 36 to 46 against their 38 and 26)
  const F = standoff('longeye', [[12, 0]], 2);
  for (let k = 0; k < 4; k++) nextShot(F);
  for (const h of F.events.filter(q => q.type === 'hit' && q.by === 'you')) assert.ok(h.dmg >= 36 && h.dmg <= 46);
  // (and it comes slowly: shots at least 1/rate × 0.92 apart)
  const ts = F.events.filter(q => q.type === 'shot' && q.id === 'you').map(q => q.t);
  for (let k = 1; k < ts.length; k++) assert.ok(ts[k] - ts[k - 1] >= (1 / W.rate) * 0.92 - 0.04, `${ts[k] - ts[k - 1]} s apart`);
});

test('a long gun picks up only its share of a dropped pack of rounds; the panel offers both long guns', () => {
  assert.deepEqual(LONG_GUNS, ['doorman', 'longeye']);
  assert.ok(ARMS.includes('doorman') && ARMS.includes('longeye') && !ARMS.includes('pipe'), 'the tire iron is Earl\'s alone');
  for (const g of LONG_GUNS) {
    let seen = 0;
    for (let seed = 1; seed <= 30 && !seen; seed++) {
      const F = runFight({ build: { weapon: g, gear: [] }, level: 'real', seed, policy: kite });
      for (const e of F.events.filter(q => q.type === 'pickup' && q.loot.kind === 'rounds')) {
        seen += 1;
        assert.equal(e.text, `+${Math.max(1, Math.round(e.loot.amount * WEAPONS[g].pick))} rounds`);
      }
    }
    assert.ok(seen, `${g}: a pack picked up`);
  }
});

// ── ONE-ON-ONES: the punch styles and the run's opponents' styles ──────────────────────────────────────────────
const ARENA1 = { w: 8, h: 6, gap: 1.8 };
const duel = (weapon, foe, o = {}) => ({ you: { weapon, hp: 80, max: 100, hits: 1.8, ...o }, foe: { id: 'them', name: 'them', ...foe }, cap: 20, hit: 0.45, arena: ARENA1 });
const share = (weapon, style, n = 200) => {
  let won = 0;
  for (let s = 1; s <= n; s++) if (runDuel(duel(weapon, rivalFoe(style)), s).over.result === 'won') won += 1;
  return won / n;
};

test('no gun in a one-on-one: the sim refuses one on either side', () => {
  for (const g of ['pistol', 'chopper', 'doorman', 'longeye']) {
    assert.throws(() => startDuel(duel(g, rivalFoe('brawler')), 1), /no gun in a one-on-one/);
    assert.throws(() => startDuel(duel('hands', rivalFoe('brawler', { weapon: g })), 1), /no gun in a one-on-one/);
  }
  assert.doesNotThrow(() => startDuel(duel('knuckles', rivalFoe('knife')), 1));
});

test("the plain brawler is the run's opponent as he was: the same fight, tick for tick", () => {
  const old = { weapon: 'fists', hp: 55, speed: 3.2, hits: 2 };
  for (let s = 1; s <= 25; s++) {
    for (const w of ['hands', 'blade']) {
      const a = runDuel(duel(w, old), s);
      const b = runDuel(duel(w, rivalFoe('brawler')), s);
      assert.deepEqual(b.events, a.events);
    }
  }
  assert.deepEqual(Object.keys(RIVALS), ['brawler', 'bigman', 'quick', 'knife', 'grabber']);
  for (const R of Object.values(RIVALS)) assert.ok(R.says.length > 8 && WEAPONS[R.weapon] && WEAPONS[R.weapon].kind === 'melee', R.name);
  assert.throws(() => rivalFoe('nobody'), /no style/);
  assert.equal(rivalFoe('bigman', { hp: 85 }).hp, 85);
});

test('quick hands: light blows, coming fast; the quick one is their man, the big man is not', () => {
  assert.deepEqual(PUNCHES, ['jab', 'haymaker', 'throw']);
  assert.equal(WEAPONS.jab.name, 'quick hands');
  const F = runDuel(duel('jab', rivalFoe('brawler')), 4);
  const G = runDuel(duel('hands', rivalFoe('brawler')), 4);
  const pace = X => X.stats.swings / X.over.t;
  assert.ok(pace(F) > pace(G), `quick hands throw more a second: ${pace(F).toFixed(2)} vs bare hands ${pace(G).toFixed(2)}`);
  for (const h of F.events.filter(e => e.type === 'hit' && e.by === 'you')) assert.ok(h.dmg <= Math.round(8 * 1.8));
  assert.ok(share('jab', 'quick') > share('throw', 'quick') + 0.15, 'against the quick one, quick hands beat the throw');
  assert.ok(share('jab', 'bigman') < share('throw', 'bigman') - 0.15, 'against the big man, quick hands are no good');
});

test('the haymaker: seen coming (it lands less often), and it hits like a truck; the answer to the grabber', () => {
  const W = WEAPONS.haymaker;
  assert.equal(W.land, 0.85);
  let thrown = 0;
  let landed = 0;
  let plain = [0, 0];
  for (let s = 1; s <= 120; s++) {
    const F = runDuel(duel('haymaker', rivalFoe('brawler')), s);
    thrown += F.stats.swings;
    landed += F.stats.swingsHit;
    for (const h of F.events.filter(e => e.type === 'hit' && e.by === 'you')) assert.ok(h.dmg >= Math.round(18 * 1.8) && h.dmg <= Math.round(24 * 1.8), `a haymaker: ${h.dmg}`);
    const G = runDuel(duel('hands', rivalFoe('brawler')), s);
    plain = [plain[0] + G.stats.swings, plain[1] + G.stats.swingsHit];
  }
  assert.ok(landed / thrown < plain[1] / plain[0], `lands ${(landed / thrown).toFixed(2)} of those thrown, bare hands ${(plain[1] / plain[0]).toFixed(2)}`);
  assert.ok(share('haymaker', 'grabber') > share('jab', 'grabber') + 0.2, 'hit the grabber before he gets hold');
});

test('the throw: a throw that lands puts them down (they neither hit nor move) and you stay up; the ground ignores soak', () => {
  const W = WEAPONS.throw;
  assert.ok(W.hold === 1.6 && W.holdSelf === false && W.slam);
  let checked = 0;
  for (let s = 1; s <= 30 && checked < 5; s++) {
    const F = startDuel(duel('throw', rivalFoe('bigman')), s);
    const me = F.people[0];
    const foe = F.people[1];
    while (!F.over) {
      const n = F.events.length;
      step(F, brawl(F));
      const h = F.events.slice(n).find(e => e.type === 'hit' && e.by === 'you');
      if (!h || F.over) continue;
      checked += 1;
      // (the big man soaks 7 off a blow; the throw's slam is the ground's: 7 to 10 × 1.8, all of it)
      assert.ok(h.dmg >= Math.round(7 * 1.8), `unsoaked: ${h.dmg}`);
      assert.ok(foe.pin > 1.5 && foe.reel > 1.5, 'down for the hold');
      assert.equal(me.pin, 0, 'you stay on your feet');
      // (held: he does not move and does not swing while it lasts)
      const [x, y] = [foe.x, foe.y];
      const swings = F.events.filter(e => e.type === 'swing' && e.id === 'them').length;
      for (let k = 0; k < 30 && !F.over; k++) step(F, brawl(F));
      if (!F.over) {
        assert.ok(Math.hypot(foe.x - x, foe.y - y) < 0.6, 'held where he fell (only pushed, never walking)');
        assert.equal(F.events.filter(e => e.type === 'swing' && e.id === 'them').length, swings, 'no blow from the ground');
      }
      break;
    }
  }
  assert.ok(checked >= 3, `${checked} throws watched`);
  assert.ok(share('throw', 'bigman') > share('jab', 'bigman') + 0.15, 'the throw is the answer to the big man');
});

test('the big man soaks every blow and barely staggers; the quick one twists out of a hold; the knife carries a blade', () => {
  // (bare hands on the big man: 5 to 8 × 1.8, less his 7: from 2 to 7, never below 1)
  const F = runDuel(duel('hands', rivalFoe('bigman')), 3);
  const hits = F.events.filter(e => e.type === 'hit' && e.by === 'you');
  assert.ok(hits.length && hits.every(h => h.dmg >= 1 && h.dmg <= Math.round(8 * 1.8) - 7), hits.map(h => h.dmg).join());
  const B = startDuel(duel('hands', rivalFoe('bigman')), 3);
  assert.equal(B.people[1].stagger, RIVALS.bigman.reel);
  assert.equal(B.people[1].heft, RIVALS.bigman.heft);
  // (the quick one takes 0.3 of a throw's hold)
  let held = null;
  for (let s = 1; s <= 20 && held === null; s++) {
    const Q = startDuel(duel('throw', rivalFoe('quick')), s);
    while (!Q.over && held === null) {
      const n = Q.events.length;
      step(Q, brawl(Q));
      if (Q.events.slice(n).some(e => e.type === 'hit' && e.by === 'you') && !Q.over) held = Q.people[1].pin;
    }
  }
  assert.ok(held !== null && Math.abs(held - 1.6 * 0.3) < 0.05, `the quick one held ${held} s`);
  assert.equal(rivalFoe('knife').weapon, 'blade');
  assert.ok(share('blade', 'knife') > share('hands', 'knife'), 'match a blade with a blade');
});

test('the grabber: his grab holds you, so you cannot hit back, and neither of you moves while it lasts', () => {
  let seen = 0;
  for (let s = 1; s <= 30 && seen < 3; s++) {
    const F = startDuel(duel('hands', rivalFoe('grabber')), s);
    const me = F.people[0];
    const foe = F.people[1];
    while (!F.over) {
      const n = F.events.length;
      step(F, brawl(F));
      if (F.over || !F.events.slice(n).some(e => e.type === 'hit' && e.by === 'them')) continue;
      seen += 1;
      assert.ok(me.pin > 0.9 && me.reel > 0.9, 'you are held');
      assert.ok(foe.pin > 0.9, 'and so is he, holding on');
      const mine = F.events.filter(e => e.type === 'swing' && e.id === 'you').length;
      const [x, y] = [me.x, me.y];
      for (let k = 0; k < 25 && !F.over; k++) step(F, brawl(F));
      assert.equal(F.events.filter(e => e.type === 'swing' && e.id === 'you').length, mine, 'no blow of yours while held');
      assert.ok(Math.hypot(me.x - x, me.y - y) < 0.05, 'you did not move');
      break;
    }
  }
  assert.ok(seen >= 2, `${seen} grabs watched`);
});

// ── COUSIN EARL'S WAYS ────────────────────────────────────────────────────────────────────────────────────────
const withEarl = (weapon, earl) => ({ weapon, gear: [], ally: true, ...(earl ? { earl } : {}) });
/**
 * A scene for Earl: you at SPOT, Earl beside you, told `earl`, and the people of `foes` ([kind, dx, dy] from you) in and
 * standing still; one tick, so he chooses whom he goes for (`target`) and where he means to stand (`goal`).
 */
function earlScene(earl, foes, seed = 1) {
  const F = createFight({ build: withEarl('hands', earl), level: `earl-${foes.length}`, seed, waves: foes.map(([kind]) => [0, kind, 0]) });
  step(F, { x: 0, y: 0 });
  const [me, E] = F.people;
  [me.x, me.y] = SPOT;
  [E.x, E.y] = [SPOT[0] - 1.4, SPOT[1] + 0.6];
  const them = F.people.filter(p => p.side === 'foe');
  them.forEach((p, k) => {
    [p.x, p.y] = [SPOT[0] + foes[k][1], SPOT[1] + foes[k][2]];
    p.in = true;
    p.cd = 99;
    p.speed = 0;
  });
  step(F, { x: 0, y: 0 });
  return { F, me, E, them };
}
const goalOff = ({ E, me }) => Math.hypot(E.goal[0] - me.x, E.goal[1] - me.y);

test("Earl's ways: at your side is his old way, the same fight; the other three are told, and named on the build", () => {
  assert.deepEqual(Object.keys(EARL_WAYS), ['side', 'front', 'hunt', 'block']);
  assert.deepEqual(WAYS_OFFERED, ['front', 'hunt', 'block']);
  for (const s of [1, 2, 3]) {
    const a = runFight({ build: withEarl('pistol'), level: 'real', seed: s, policy: kite });
    const b = runFight({ build: withEarl('pistol', 'side'), level: 'real', seed: s, policy: kite });
    assert.deepEqual(b.events, a.events);
    assert.deepEqual(b.build, a.build);
  }
  const fights = WAYS_OFFERED.map(w => JSON.stringify(runFight({ build: withEarl('blade', w), level: 'raid', seed: 2, policy: kite }).events));
  assert.equal(new Set(fights).size, 3, 'each way is another fight');
  assert.throws(() => createFight({ build: withEarl('blade', 'dance'), level: 'real', seed: 1 }), /no way dance/);
  assert.equal(buildName(withEarl('pistol', 'hunt')), 'six-shot + Cousin Earl (goes hunting)');
  assert.equal(presetOf({ ...PRESETS.full, earl: 'block' }), null, 'a preset with Earl told another way is your own build');
  assert.equal(presetOf({ ...PRESETS.full, earl: 'side' }), 'full');
});

test('Earl out in front: he stands a step in front of you toward the nearest who walks up to hit', () => {
  // (a shooter nearest of all, a heavy at 4 m, a runner at 5: the heavy is the one, a step in front of you toward him)
  const S = earlScene('front', [['shooter', 3, 0], ['heavy', 0, 4], ['runner', 5, 0]]);
  assert.equal(S.E.target, S.them[1].id, 'the nearest who hits, not the shooter');
  assert.ok(Math.abs(goalOff(S) - 1.2) < 0.01, `a step in front of you: ${goalOff(S).toFixed(2)} m`);
  assert.ok(S.E.goal[1] > S.me.y + 1.1, 'toward him');
  // (nobody who hits: back at your shoulder)
  const T = earlScene('front', [['shooter', 6, 4]]);
  assert.equal(T.E.target, null);
});

test('Earl goes hunting: the ones who shoot first, wherever they are; then the one furthest from you', () => {
  const S = earlScene('hunt', [['heavy', 1.5, 1], ['shooter', 14, 7]]);
  assert.equal(S.E.target, S.them[1].id, 'the shooter across the lot, not the heavy at your elbow');
  const T = earlScene('hunt', [['heavy', 1.5, 1], ['runner', 9, 6]]);
  assert.equal(T.E.target, T.them[1].id, 'no shooter: the one furthest from you');
  // (hunting wins the corner far more often than at your side, the box cutter: run70's study, 88% against 41)
  const wins = earl => Array.from({ length: 60 }, (_, k) => runFight({ build: withEarl('blade', earl), level: 'corner', seed: k + 1, policy: kite }).over.result === 'won').filter(Boolean).length;
  assert.ok(wins('hunt') > wins('side') + 10, `the box cutter in the corner: hunting ${wins('hunt')} of 60, at your side ${wins('side')}`);
});

test('Earl one at a time: with two or more coming he stands between you and the second nearest, and fights him', () => {
  const S = earlScene('block', [['heavy', 0, 3], ['heavy', 4, 0], ['runner', 6, 5]]);
  assert.equal(S.E.target, S.them[1].id, 'the second nearest');
  assert.ok(Math.abs(goalOff(S) - 1.5) < 0.01 && S.E.goal[0] > S.me.x + 1.4, `a step and a half out toward him: ${goalOff(S).toFixed(2)} m`);
  const T = earlScene('block', [['heavy', 0, 3]]);
  assert.equal(T.E.target, T.them[0].id, 'one alone: the nearest');
  // (and he stays on his feet more than at your side: run70's raid, the six-shot, 14% down against 43%)
  const down = earl => Array.from({ length: 80 }, (_, k) => runFight({ build: withEarl('pistol', earl), level: 'raid', seed: k + 1, policy: kite }).stats.allyDown).filter(Boolean).length;
  assert.ok(down('block') < down('side'), `Earl down, one at a time ${down('block')} of 80, at your side ${down('side')}`);
});

// ── BUILT, THE STREET FIGHTS, THE ADVICE ────────────────────────────────────────────────────────────────────
test('"built", the gym\'s mark: +10 health and fists and blades a tenth harder; guns no harder', () => {
  assert.equal(GEAR.strength.health, 10);
  assert.equal(GEAR.strength.hits, 1.1);
  const F = createFight({ build: { weapon: 'blade', gear: ['strength'] }, level: 'real', seed: 1 });
  assert.equal(F.people[0].max, YOU.hp + 10);
  assert.equal(F.people[0].hits, 1.1);
  const G = runFight({ build: { weapon: 'blade', gear: ['strength'] }, level: 'easy', seed: 2, policy: kite });
  for (const h of G.events.filter(e => e.type === 'hit' && e.by === 'you')) assert.ok(h.dmg <= Math.round(15 * 1.1));
  // (a gun hits as hard built or not: the same shots, the same damage)
  const a = runFight({ build: { weapon: 'longeye', gear: [] }, level: 'easy', seed: 4, policy: kite }).events.filter(e => e.type === 'hit' && e.by === 'you').map(e => e.dmg);
  const b = runFight({ build: { weapon: 'longeye', gear: ['strength'] }, level: 'easy', seed: 4, policy: kite }).events.filter(e => e.type === 'hit' && e.by === 'you').map(e => e.dmg);
  assert.deepEqual(b.slice(0, 3), a.slice(0, 3));
});

test('the small street fights: jumped, the corner, a raid (and the Sixes in your yard, a first look) play to their end', () => {
  assert.deepEqual(Object.keys(STREET), ['jumped', 'corner', 'raid', 'sixes1', 'sixes4']);
  for (const [id, L] of Object.entries(STREET)) {
    assert.equal(levelOf(id), L);
    const F = runFight({ build: { weapon: 'pistol', gear: [], ally: true, earl: 'front' }, level: id, seed: 1, policy: kite });
    assert.ok(['won', 'lost', 'left', 'timeout'].includes(F.over.result), id);
    assert.equal(F.stats.foes, L.waves.length);
    assert.equal(F.arena, L.ground === 'yard' ? YARD : ARENA);
    assert.notEqual(F.over.result, 'left', 'nobody walks out of a street fight');
  }
  assert.equal(levelOf('real'), LEVELS.real);
  assert.equal(levelOf('nowhere'), null);
  assert.deepEqual(STREET.jumped.waves.map(w => w[1]), ['heavy', 'runner']);
});

test('the advice knows the new guns and Earl\'s ways: what to try, and the line for each', () => {
  assert.deepEqual(upgrades({ weapon: 'hands', gear: [], ally: false }).map(u => u.key).slice(0, 3), ['pistol', 'doorman', 'longeye']);
  assert.deepEqual(upgrades({ weapon: 'longeye', gear: ['vest', 'strength', 'shoes'], ally: true }).map(u => u.key), ['pistol', 'chopper', 'doorman', 'earl-front', 'earl-hunt', 'earl-block']);
  assert.deepEqual(upgrades({ weapon: 'pistol', gear: ['vest', 'strength', 'shoes'], ally: true, earl: 'hunt' }).map(u => u.key).filter(k => k.startsWith('earl')), ['earl-front', 'earl-block']);
  // (a lost raid with bare hands: each new thing's own line)
  const F = [1, 2, 3, 4, 5, 6].map(s => runFight({ build: { weapon: 'hands', gear: [], ally: true, earl: 'side' }, level: 'raid', seed: s, policy: kite })).find(X => X.over.result === 'lost');
  assert.ok(F, 'a raid lost');
  const say = key => advise(F, { seeds: 6, only: [key] });
  const D = say('doorman');
  assert.equal(D.consider, 'consider the Doorman');
  assert.match(D.line, /^They (rushed you: \w+ of them on you at once|walked up to you[^.]*)\. A shell of the Doorman hits every one of them in front of you up close[^.]*\.$/);
  assert.match(say('longeye').line, /The Long-eye drops one of them in a shot or two from far off/);
  const G = [1, 2, 3, 4, 5, 6].map(s => runFight({ build: { weapon: 'blade', gear: [], ally: true, earl: 'side' }, level: 'corner', seed: s, policy: kite })).find(X => X.over.result === 'lost');
  assert.equal(advise(G, { seeds: 6, only: ['earl-front'] }).consider, 'consider Earl out in front');
  assert.match(advise(G, { seeds: 6, only: ['earl-hunt'] }).line, /^Their shooters put \d+ of the \d+ in you from the back\. Told to go hunting, Cousin Earl goes after the ones who shoot\.$/);
  assert.match(advise(G, { seeds: 6, only: ['earl-block'] }).line, /Told one at a time, Cousin Earl keeps the second one off you/);
  // (what wins most is what is named, among them all)
  const A = advise(G, { seeds: 10 });
  assert.equal(A.key, Object.keys(A.scores).reduce((a, b) => (A.scores[b] > A.scores[a] + 1e-9 ? b : a)));
});
