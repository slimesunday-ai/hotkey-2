// HANDING THINGS OVER (anim-1; demo/stage/hands/): a deal is staged from data, and what a check fails on is measured
// here without a browser: at a hand-over the two fists are at one point, whatever the two bodies' sizes and whichever
// way their line lies to the camera; every thing has exactly one holder at every frame and is at that hand; nobody's
// feet move; nothing is longer than its budget, and something readable has happened in the first half second.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pose0, fk, toWorld } from '../demo/fight/puppet/rig.js';
import { stageDeal, DEALS, STAND, STAND_CLOSE } from '../demo/stage/hands/deals.js';
import { measureHands, throughOf } from '../demo/stage/hands/moves.js';
import { offOf, boxOf, KINDS, kitKind, handHeld } from '../demo/stage/hands/things.js';

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Two who deal, as the stage stands them (perform.js openYaws): on a line at `bearing`, facing the side of it the camera is on, toed in. */
function pair(sa, sb, bearing = Math.PI / 2, cam = [0, 30], stand = STAND) {
  const D = stand * (sa + sb);
  const u = [Math.sin(bearing), Math.cos(bearing)];
  const [A, B] = [[(-u[0] * D) / 2, (-u[1] * D) / 2], [(u[0] * D) / 2, (u[1] * D) / 2]];
  const p = -u[1] * cam[0] + u[0] * cam[1] >= 0 ? [-u[1], u[0]] : [u[1], -u[0]];
  const face = Math.atan2(p[0], p[1]);
  const sg = Math.sign(wrap(Math.atan2(u[0], u[1]) - face)) || 1;
  return { people: { buyer: { x: A[0], z: A[1], yaw: face + 0.14 * sg, scale: sa }, seller: { x: B[0], z: B[1], yaw: face - 0.14 * sg, scale: sb } }, cam };
}
const SIZES = [[1, 1], [0.9, 1.25], [1.25, 0.9], [1.1, 1.25], [0.9, 0.9], [1.25, 1.25]];
const BINS = { rim: [0, 0.9, 0.5], inside: [0, 0.6, 0.78] };
const digger = seen => ({ people: { you: { x: 0, z: 0, yaw: 0, scale: 1 }, ...(seen ? { neighbour: { x: 2.4, z: -2.4, yaw: -0.8, scale: 1.1 } } : {}) }, cam: [8, 0] });
/** Every frame of a staged deal. */
function* frames(T, step = 1 / 60) {
  for (let t = T.t0; t <= T.t1 + 1e-9; t += step) yield [t, T.at(t)];
}

test('the money and the carton change hands with the two fists at one point, at every size and whichever way the two stand to the camera', () => {
  for (const [sa, sb] of SIZES) for (const bearing of [Math.PI / 2, 0, 2.2, -1.1]) {
    const T = stageDeal('buy', { ...pair(sa, sb, bearing), goods: 'carton' });
    const M = measureHands(T);
    assert.deepEqual(M.faults, [], `sizes ${sa}, ${sb}, bearing ${bearing}`);
    assert.equal(M.meets.length, 2);
    for (const m of M.meets) assert.ok(m.apart <= 0.03 && m.offPoint <= 0.03, `${m.thing}: fists ${m.apart} m apart at sizes ${sa}, ${sb}, bearing ${bearing}`);
    assert.deepEqual(M.meets.map(m => m.thing), ['cash', 'goods']);
  }
});

test('nothing floats: at every frame each thing has one holder, is at that hand when held, and never jumps', () => {
  const cases = [...SIZES.map(([sa, sb]) => stageDeal('buy', { ...pair(sa, sb), goods: 'carton' })), stageDeal('pay', pair(1, 1.25)),
    ...['little', 'find'].flatMap(find => [null, 'cold', 'away'].map(seen => stageDeal('bins', { ...digger(seen), find, seen, ...BINS })))];
  for (const T of cases) {
    const M = measureHands(T);
    assert.equal(M.lost, 0);
    assert.equal(M.nan, 0);
    // (a hand's reach from the middle of whoever holds it: half the shoulders, the arm, and the sway of a hand-over)
    assert.ok(M.far <= 0.85, `a thing ${M.far} of a body's size from its holder`);
    assert.ok(M.jump <= 0.16, `a thing moved ${M.jump} m in one frame`);
    for (const [t, S] of frames(T)) for (const [id, X] of Object.entries(S.things)) {
      const [who, where] = X.holder.split(':');
      assert.ok(who && where, `${id} has no holder at ${t.toFixed(2)}`);
      if (where !== 'L' && where !== 'R') continue;
      const B = S.bodies[who];
      const f = fk(B.P);
      const fist = toWorld((where === 'L' ? f.fistL : f.fistR).map(v => v * B.scale), B.x, B.y, B.z, B.yaw);
      // (at the fist: drawn beside it, on the side away from the body, by its own offset and no more)
      assert.ok(dist(fist, X.fist) < 1e-6, `${id} is not in ${who}'s ${where} hand at ${t.toFixed(2)}`);
      assert.ok(dist(fist, X.at) <= offOf(X.kind) + 1e-6, `${id} is drawn ${dist(fist, X.at).toFixed(2)} m from the hand that holds it`);
    }
  }
});

test('the purchase is told in order: asked, the money out and over, put away, the goods out and over, looked at, tucked away', () => {
  const T = stageDeal('buy', { ...pair(1, 1.15), goods: 'carton' });
  const seq = id => {
    const out = [];
    for (const [, S] of frames(T)) if (out[out.length - 1] !== S.things[id].holder) out.push(S.things[id].holder);
    return out;
  };
  const hand = /:(L|R)$/;
  const [cash, goods] = [seq('cash'), seq('goods')];
  assert.equal(cash.length, 4);
  assert.equal(cash[0], 'buyer:pocket');
  assert.match(cash[1], /^buyer:(L|R)$/);
  assert.match(cash[2], /^seller:(L|R)$/);
  assert.equal(cash[3], 'seller:pocket');
  assert.equal(goods.length, 4);
  assert.equal(goods[0], 'seller:store');
  assert.match(goods[1], hand);
  assert.match(goods[2], /^buyer:(L|R)$/);
  assert.equal(goods[3], 'buyer:tucked');
  // (the money is over before the goods are)
  assert.ok(T.gives[0].thing === 'cash' && T.gives[0].t < T.gives[1].t);
  // (each is SEEN in the hand before it goes: out of the pocket or the store a quarter second or more before the hand-over)
  for (const g of T.gives) {
    let since = null;
    for (const [t, S] of frames(T)) if (S.things[g.thing].holder.startsWith(`${g.from}:`) && hand.test(S.things[g.thing].holder)) { since = t; break; }
    assert.ok(g.t - since >= 0.25, `${g.thing} was in the hand ${(g.t - since).toFixed(2)} s before it was handed over`);
  }
});

test('nobody slides: the feet and the root of everyone in a deal stay where they were stood', () => {
  const P0 = pose0();
  for (const T of [stageDeal('buy', { ...pair(0.9, 1.25), goods: 'carton' }), stageDeal('bins', { ...digger('cold'), find: 'find', seen: 'cold', ...BINS })]) {
    const first = T.at(T.t0);
    for (const [, S] of frames(T)) for (const [id, B] of Object.entries(S.bodies)) {
      assert.deepEqual([B.x, B.z, B.yaw], [first.bodies[id].x, first.bodies[id].z, first.bodies[id].yaw]);
      assert.deepEqual([B.P.fL, B.P.fR, B.P.px, B.P.pz, B.P.mx, B.P.mz, B.P.sx, B.P.sz], [P0.fL, P0.fR, 0, 0, 0, 0, 0, 0]);
    }
  }
});

test('nothing held goes through anybody: no thing in a torso or a head at any frame, at every size and from every side', () => {
  // (the owner, of the first purchase: "the object passes through his body and comes out the other side": the
  // carton was tucked across the chest to the far arm. A thing's own box as it is drawn, against every body's two)
  for (const [sa, sb] of SIZES) for (const cam of [[0, 30], [0, 9], [0, -9]]) for (const deal of ['buy', 'pay']) {
    const M = measureHands(stageDeal(deal, { ...pair(sa, sb, Math.PI / 2, cam), goods: 'carton' }));
    assert.deepEqual(M.through, [], `${deal}, sizes ${sa} and ${sb}, the camera at ${cam}`);
  }
  for (const find of ['nothing', 'little', 'find']) for (const seen of [null, 'cold', 'away']) for (const cam of [[8, 0], [0, -9], [0, 9], [-8, 0]]) {
    const M = measureHands(stageDeal('bins', { ...digger(seen), cam, find, seen, ...BINS }));
    assert.deepEqual(M.through, [], `the dig (${find}, ${seen}), the camera at ${cam}`);
  }
  // (and the measure does see it: a carton held at the middle of a chest, and one across a face)
  const B = stageDeal('pay', pair(1, 1)).at(0).bodies.buyer;
  const at = (x, y, z) => toWorld([x, y, z], B.x, B.y, B.z, B.yaw);
  assert.equal(throughOf({ kind: 'carton', at: at(0, 0.7, -0.2), dir: toWorld([0, 0, 1], 0, 0, 0, B.yaw), up: [0, 1, 0], scale: 1 }, B), 'torso');
  assert.equal(throughOf({ kind: 'carton', at: at(0.2, 1.3, -0.2), dir: toWorld([0, 0, 1], 0, 0, 0, B.yaw), up: [0, 1, 0], scale: 1 }, B), 'head');
  assert.equal(throughOf({ kind: 'carton', at: at(0.75, 0.7, 0.2), dir: toWorld([0, 0, 1], 0, 0, 0, B.yaw), up: [0, 1, 0], scale: 1 }, B), null);
  // (every thing has a size, a box and a place beside the hand)
  // (a big piece on the ground is no held thing: it has no place beside a hand)
  for (const k of Object.keys(KINDS)) if (!KINDS[k].ground) assert.ok(KINDS[k].size > 0 && offOf(k) > 0 && boxOf(k)[1] - boxOf(k)[0] <= 0.3, `${k} is drawn ${(boxOf(k)[1] - boxOf(k)[0]).toFixed(2)} m across`);
});

test('the two heads never touch: a hand-over is a sway of the hips and a glance, the head kept level', () => {
  // (each head's nearest reach toward the other along the line between them: its eight corners, turned and leant
  // as the pose has it. Coarse, and on the safe side: the head is taken as leaning about its own middle)
  for (const [sa, sb] of SIZES) {
    const T = stageDeal('buy', { ...pair(sa, sb), goods: 'carton' });
    let least = 9;
    for (const [, S] of frames(T)) {
      const reach = {};
      for (const [id, B] of Object.entries(S.bodies)) {
        const f = fk(B.P);
        const roll = Math.atan2(f.crown[0] - f.headC[0], f.crown[1] - f.headC[1]);
        const turn = B.P.hy + B.P.ty;
        reach[id] = [];
        for (const sx of [-0.5, 0.5]) for (const sz of [-0.35, 0.45]) for (const sy of [-0.4, 0.4]) reach[id].push(toWorld([(f.headC[0] + sx * Math.cos(turn) + sz * Math.sin(turn) + sy * Math.sin(roll)) * B.scale, 0, (f.headC[2] + sz * Math.cos(turn) - sx * Math.sin(turn)) * B.scale], B.x, 0, B.z, B.yaw));
      }
      // (along the line from the buyer to the seller)
      const [b, s] = [S.bodies.buyer, S.bodies.seller];
      const n = Math.hypot(s.x - b.x, s.z - b.z);
      const along = p => ((p[0] - b.x) * (s.x - b.x) + (p[2] - b.z) * (s.z - b.z)) / n;
      least = Math.min(least, Math.min(...reach.seller.map(along)) - Math.max(...reach.buyer.map(along)));
    }
    assert.ok(least >= 0.02, `sizes ${sa}, ${sb}: the heads come within ${least.toFixed(3)} m`);
  }
});

test('the pace: each deal inside its budget, and something to read in the first half second', () => {
  const moved = T => {
    const [a, b] = [T.at(T.t0), T.at(T.t0 + 0.5)];
    return Math.max(...Object.keys(a.bodies).map(id => {
      const [f0, f1] = [fk(a.bodies[id].P), fk(b.bodies[id].P)];
      return Math.max(dist(f0.fistL, f1.fistL), dist(f0.fistR, f1.fistR), dist(f0.headC, f1.headC) * 2);
    }));
  };
  const most = { buy: 3.2, pay: 2.2, refused: 1.7 };
  for (const name of ['buy', 'pay', 'refused']) {
    const T = stageDeal(name, { ...pair(1, 1.2), goods: 'carton' });
    assert.ok(T.t1 - T.t0 <= most[name], `${name} is ${(T.t1 - T.t0).toFixed(2)} s`);
    assert.ok(moved(T) >= 0.2, `${name}: nothing has moved 0.2 m by the first half second`);
    assert.deepEqual(measureHands(T).faults, []);
  }
  for (const find of ['nothing', 'little', 'find']) for (const seen of [null, 'cold', 'away']) {
    const T = stageDeal('bins', { ...digger(seen), find, seen, ...BINS });
    const len = T.t1 - T.t0;
    assert.ok(len <= (seen ? 4.8 : 4.0) && len >= 3, `the dig (${find}, ${seen}) is ${len.toFixed(2)} s`);
    assert.ok(moved(T) >= 0.2);
    assert.deepEqual(measureHands(T).faults, []);
  }
});

test('the three ends of a dig are three different things to see, and who saw looks two different ways', () => {
  const end = (find, seen = null) => {
    const T = stageDeal('bins', { ...digger(seen), find, seen, ...BINS });
    const holders = [];
    let widest = 0;
    let highest = 0;
    let turned = 0;
    for (const [, S] of frames(T)) {
      const X = S.things.found;
      if (X && holders[holders.length - 1] !== X.holder) holders.push(X.holder);
      const f = fk(S.bodies.you.P);
      widest = Math.max(widest, Math.abs(f.fistL[0] - f.fistR[0]));
      highest = Math.max(highest, f.fistL[1], f.fistR[1]);
      if (S.bodies.neighbour) turned = Math.max(turned, Math.abs(S.bodies.neighbour.P.ty) + Math.abs(S.bodies.neighbour.P.hy));
    }
    return { T, holders, widest, highest, turned };
  };
  const [none, little, find] = [end('nothing'), end('little'), end('find')];
  // nothing: no thing at all, and the arms thrown wide (past both edges of a metre of head)
  assert.deepEqual(none.holders, []);
  assert.ok(none.widest > 1.2, `empty arms ${none.widest.toFixed(2)} m wide`);
  // a little: out of the bin into a hand, and into the pocket; never held high
  assert.equal(little.holders[0], 'bin:in');
  assert.match(little.holders[1], /^you:(L|R)$/);
  assert.equal(little.holders[2], 'you:pocket');
  assert.ok(little.highest < 0.95);
  // a find: held up over the shoulder, then tucked away
  assert.match(find.holders[1], /^you:(L|R)$/);
  assert.equal(find.holders[2], 'you:tucked');
  assert.ok(find.highest > 1.0, `the find held up to ${find.highest.toFixed(2)} m`);
  // who saw: turns their back either way, and only the one who is with you puts a hand up to their neck
  const [cold, away] = [end('find', 'cold'), end('find', 'away')];
  assert.ok(cold.turned > 0.8 && away.turned > 0.8);
  const neck = R => Math.max(...[...frames(R.T)].map(([, S]) => Math.max(fk(S.bodies.neighbour.P).fistL[1], fk(S.bodies.neighbour.P).fistR[1])));
  assert.ok(neck(away) > 0.95 && neck(cold) < 0.9);
});

test('a new deal is a few lines of data: paying somebody their cut, and its change handed back', () => {
  // (not one of DEALS: written here as a builder would write the next one)
  const cut = {
    things: { cash: { kind: 'cash', in: 'buyer:pocket' }, change: { kind: 'coins', in: 'seller:pocket' } },
    moves: [['fetch', 'buyer', 'cash'], ['give', 'buyer', 'seller', 'cash'], ['pocket', 'seller', 'cash'], ['fetch', 'seller', 'change'], ['give', 'seller', 'buyer', 'change'], ['pocket', 'buyer', 'change'], ['settle', 'buyer'], ['settle', 'seller']],
  };
  const T = stageDeal(cut, pair(1.25, 0.9));
  const M = measureHands(T);
  assert.deepEqual(M.faults, []);
  assert.equal(M.meets.length, 2);
  assert.ok(M.apart <= 0.03);
  assert.ok(M.length <= 3.6);
  assert.ok(Object.keys(DEALS).includes('buy') && Object.keys(DEALS).includes('bins'));
});

// ── stage 2: a cigarette sold and smoked; a piece for the trailer, held or too big to hold ──────────────────────────────
const HELD_PIECES = ['door-locks', 'dog-sign', 'lava-lamp'];
const BIG_PIECES = ['box-fan', 'fish-tank', 'safe-small', 'dog-bed', 'beanbag'];
const STAGE2 = [['sell', { paid: true }], ['sell', { paid: false }], ...HELD_PIECES.map(p => ['buy', { goods: kitKind(p) }]), ...BIG_PIECES.map(p => ['buyBig', { goods: kitKind(p) }])];

test('stage 2: the sale, the pieces held and the pieces on the ground: one holder each, never through anybody, at every size and from every side', () => {
  for (const [name, told] of STAGE2) for (const [sa, sb] of SIZES) for (const bearing of [Math.PI / 2, 0, 2.2, -1.1]) for (const cam of [[0, 30], [0, -9]]) {
    const T = stageDeal(name, { ...pair(sa, sb, bearing, cam), ...told });
    const M = measureHands(T);
    const what = `${name} ${JSON.stringify(told)}, sizes ${sa} and ${sb}, bearing ${bearing}, the camera at ${cam}`;
    assert.deepEqual(M.faults, [], what);
    assert.equal(M.lost + M.nan, 0, what);
    assert.ok(M.jump <= 0.16 && M.far <= 0.85, `${what}: jump ${M.jump}, far ${M.far}`);
    for (const m of M.meets) assert.ok(m.apart <= 0.03, `${what}: ${m.thing} handed over ${m.apart} m apart`);
  }
});

test('stage 2: the two heads never touch in a sale or a big purchase', () => {
  for (const [name, told] of [['sell', { paid: true }], ['sell', { paid: false }], ['buyBig', { goods: kitKind('box-fan') }], ['buyBig', { goods: kitKind('fish-tank') }]]) for (const [sa, sb] of SIZES) {
    const T = stageDeal(name, { ...pair(sa, sb), ...told });
    let least = 9;
    for (const [, S] of frames(T)) {
      const reach = {};
      for (const [id, B] of Object.entries(S.bodies)) {
        const f = fk(B.P);
        const roll = Math.atan2(f.crown[0] - f.headC[0], f.crown[1] - f.headC[1]);
        const turn = B.P.hy + B.P.ty;
        reach[id] = [];
        for (const sx of [-0.5, 0.5]) for (const sz of [-0.35, 0.45]) for (const sy of [-0.4, 0.4]) reach[id].push(toWorld([(f.headC[0] + sx * Math.cos(turn) + sz * Math.sin(turn) + sy * Math.sin(roll)) * B.scale, 0, (f.headC[2] + sz * Math.cos(turn) - sx * Math.sin(turn)) * B.scale], B.x, 0, B.z, B.yaw));
      }
      const [b, s] = [S.bodies.buyer, S.bodies.seller];
      const n = Math.hypot(s.x - b.x, s.z - b.z);
      const along = p => ((p[0] - b.x) * (s.x - b.x) + (p[2] - b.z) * (s.z - b.z)) / n;
      least = Math.min(least, Math.min(...reach.seller.map(along)) - Math.max(...reach.buyer.map(along)));
    }
    assert.ok(least >= 0.02, `${name} ${JSON.stringify(told)}, sizes ${sa}, ${sb}: the heads come within ${least.toFixed(3)} m`);
  }
});

test('a sale: over, to his lips, paid (or not), and the player let go inside 3 s while the buyer lights it, smokes it and flicks the end away', () => {
  for (const paid of [true, false]) {
    const T = stageDeal('sell', { ...pair(1, 1.15), paid });
    const seq = id => {
      const out = [];
      for (const [, S] of frames(T)) if (out[out.length - 1] !== S.things[id].holder) out.push(S.things[id].holder);
      return out;
    };
    const smoke = seq('smoke');
    assert.equal(smoke[0], 'seller:pocket');
    assert.match(smoke[1], /^seller:(L|R)$/);
    assert.match(smoke[2], /^buyer:(L|R)$/);
    assert.equal(smoke[3], 'buyer:mouth');
    assert.match(smoke[4], /^buyer:(L|R)$/);
    assert.deepEqual(smoke.slice(5), ['air:flick', 'ground:butt', 'ground:out']);
    assert.deepEqual(seq('cash'), paid ? ['buyer:pocket', seq('cash')[1], seq('cash')[2], 'seller:pocket'] : ['buyer:pocket']);
    // (the player's part is done inside the sale's 3 s, and the first thing is out by half a second)
    assert.equal(T.back.who[0], 'seller');
    assert.ok(T.back.t - T.t0 <= 3.0, `the player is let go ${(T.back.t - T.t0).toFixed(2)} s in`);
    const out = [...frames(T)].find(([, S]) => S.things.smoke.show)?.[0];
    assert.ok(out - T.t0 <= 0.3, `the cigarette is first seen ${out} s in`);
    // (he USES it after: lit as the player is let go (not paying, while you throw up your hands), smoke off him more
    // than once, and it ends on the ground)
    const lit = [...frames(T)].find(([, S]) => S.things.smoke.lit > 0.5)?.[0];
    assert.ok(lit > T.back.t - 0.8, `lit at ${lit}`);
    const puffs = new Set([...frames(T)].flatMap(([, S]) => S.fx.filter(F => F.kind === 'puff').map(F => F.i)));
    assert.ok(puffs.size >= 3, `${puffs.size} breaths of smoke`);
    assert.ok([...frames(T)].some(([, S]) => S.fx.some(F => F.kind === 'flame')), 'no flame');
    assert.ok(T.t1 - T.back.t >= 2.5 && T.t1 - T.back.t <= 4.5, `he smokes ${(T.t1 - T.back.t).toFixed(2)} s after`);
  }
});

test('a piece for the trailer: one hand carries the chain and locks, a box fan never leaves the ground and is seen in front of the two of them', () => {
  assert.ok(handHeld('door-locks') && handHeld('dog-sign') && !handHeld('box-fan') && !handHeld('safe-small') && !handHeld('fish-tank'));
  const T = stageDeal('buyBig', { ...pair(1, 1.1), goods: kitKind('box-fan') });
  const holders = [];
  for (const [, S] of frames(T)) if (holders[holders.length - 1] !== S.things.piece.holder) holders.push(S.things.piece.holder);
  assert.deepEqual(holders, ['seller:store', 'ground:slide', 'ground:stowed']);
  assert.ok(T.t1 - T.t0 <= 3.8, `a big purchase is ${(T.t1 - T.t0).toFixed(2)} s`);
  // (when the money passes, it stands in front of the gap between them, out from under both heads)
  const g = T.gives[0];
  const S = T.at(g.t);
  const [b, s] = [S.bodies.buyer, S.bodies.seller];
  const mid = [(b.x + s.x) / 2, (b.z + s.z) / 2];
  const face = [Math.sin(b.yaw) + Math.sin(s.yaw), Math.cos(b.yaw) + Math.cos(s.yaw)];
  const P = S.things.piece.at;
  const ahead = ((P[0] - mid[0]) * face[0] + (P[2] - mid[1]) * face[1]) / Math.hypot(...face);
  assert.ok(Math.hypot(P[0] - mid[0], P[2] - mid[1]) - ahead < 0.05 && ahead > 0.5, `the piece is ${ahead.toFixed(2)} m ahead of the gap when the money passes`);
  // (and it ends behind the buyer, where he put it away)
  const end = T.at(T.t1).things.piece.at;
  const back = ((end[0] - b.x) * Math.sin(b.yaw) + (end[2] - b.z) * Math.cos(b.yaw));
  assert.ok(back < -0.3, `put away ${back.toFixed(2)} m in front of the buyer`);
});

// ── stage 2 of the hands: the rest of the transactions ─────────────────────────────────────────────────────────────────
const REST = [['sellDisc', { paid: true }], ['sellDisc', { paid: false }], ['buyUse', { goods: 'sandwich' }], ['buyUse', { goods: 'can' }], ['stickup', { win: true }], ['stickup', { win: false }],
  ['lesson', { style: 'jab' }], ['lesson', { style: 'haymaker' }], ['lesson', { style: 'throw' }], ['haircut', {}], ['pay', { count: true }], ['refused', {}],
  ['buyBig', { goods: kitKind('cctv-camera') }], ['buyBig', { goods: kitKind('door-bar') }], ['lift', { felt: false, stand: STAND_CLOSE }], ['lift', { felt: true, stand: STAND_CLOSE }],
  // (hands-2: a thing to wear, put on there and then, each slot; and kept, its slot already worn)
  ...['hat', 'eyewear', 'top', 'bottom', 'shoes', 'acc'].map(slot => ['buyWear', { goods: `wear:${slot}`, slot, on: true }]), ['buyWear', { goods: 'wear:hat', slot: 'hat', on: false }]];

test('stage 2: every other deal: one holder each, at the hand that holds it, never through anybody, inside its time, at every size and from every side', () => {
  const most = { sellDisc: 3.5, buyUse: 3.9, stickup: 3.4, lesson: 3.8, haircut: 3.8, pay: 2.6, refused: 1.8, buyBig: 3.8, lift: 2.0, buyWear: 3.9 };
  for (const [name, told] of REST) for (const [sa, sb] of SIZES) for (const bearing of [Math.PI / 2, 0, 2.2, -1.1]) for (const cam of [[0, 30], [0, -9]]) {
    const T = stageDeal(name, { ...pair(sa, sb, bearing, cam, told.stand ?? STAND), ...told });
    const M = measureHands(T);
    const what = `${name} ${JSON.stringify(told)}, sizes ${sa} and ${sb}, bearing ${bearing}, the camera at ${cam}`;
    assert.deepEqual(M.faults, [], what);
    assert.equal(M.lost + M.nan, 0, what);
    assert.ok(M.jump <= 0.16 && M.far <= 0.85, `${what}: jump ${M.jump}, far ${M.far}`);
    for (const m of M.meets) assert.ok(m.apart <= 0.03, `${what}: ${m.thing} handed over ${m.apart} m apart`);
    assert.ok((T.back ? T.back.t : T.t1) - T.t0 <= most[name], `${what}: ${((T.back ? T.back.t : T.t1) - T.t0).toFixed(2)} s`);
  }
});

test('stage 2: what each one is seen to do: the food eaten down, the wallet taken (or taken back), the cutter shown and away, the money to the right hand', () => {
  const seq = (T, id) => {
    const out = [];
    for (const [, S] of frames(T)) if (out[out.length - 1] !== S.things[id].holder) out.push(S.things[id].holder);
    return out;
  };
  const eat = stageDeal('buyUse', { ...pair(1, 1.1), goods: 'sandwich' });
  assert.ok(eat.at(eat.t1).things.goods.burn >= 0.55, 'the sandwich is not eaten down');
  assert.equal(seq(eat, 'goods').filter(h => h === 'buyer:mouth').length, 2);
  const took = seq(stageDeal('lift', { ...pair(1, 1, Math.PI / 2, [0, 30], STAND_CLOSE), felt: false }), 'wallet');
  assert.deepEqual(took.map(h => h.replace(/:(L|R)$/, ':hand')), ['seller:pocket', 'buyer:hand', 'buyer:pocket']);
  const felt = seq(stageDeal('lift', { ...pair(1, 1, Math.PI / 2, [0, 30], STAND_CLOSE), felt: true }), 'wallet');
  assert.deepEqual(felt.map(h => h.replace(/:(L|R)$/, ':hand')), ['seller:pocket', 'buyer:hand', 'seller:hand', 'seller:pocket']);
  const up = stageDeal('stickup', { ...pair(1, 1.1), win: true });
  assert.deepEqual(seq(up, 'cash').map(h => h.replace(/:(L|R)$/, ':hand')), ['seller:store', 'seller:hand', 'buyer:hand', 'buyer:pocket']);
  assert.equal(seq(up, 'cutter').at(-1), 'buyer:pocket');
  // (the stall's keeper's hands go up beside her head while the cutter is out)
  assert.ok([...frames(up)].some(([, S]) => fk(S.bodies.seller.P).fistL[1] > 0.95 && fk(S.bodies.seller.P).fistR[1] > 0.95));
  // (a lesson: the teacher's punch and then the student's, each out in front)
  const les = stageDeal('lesson', { ...pair(1, 1.1), style: 'jab' });
  const reach = id => Math.max(...[...frames(les)].map(([, S]) => Math.max(fk(S.bodies[id].P).fistL[2], fk(S.bodies[id].P).fistR[2])));
  assert.ok(reach('seller') > 0.35 && reach('buyer') > 0.35);
  // (the barber's: hair falls)
  assert.ok([...frames(stageDeal('haircut', pair(1, 1.1)))].some(([, S]) => S.fx.some(F => F.kind === 'hair')));
});

test('hands-2: a thing to wear is put on where it was bought: handed over, to where it goes on him, and from that moment he wears it', () => {
  for (const slot of ['hat', 'top', 'shoes']) {
    const T = stageDeal('buyWear', { ...pair(1, 1), goods: `wear:${slot}`, slot, on: true });
    const seen = [];
    for (const [, S] of frames(T)) if (seen[seen.length - 1] !== S.things.goods.holder) seen.push(S.things.goods.holder);
    assert.deepEqual(seen.map(h => h.replace(/:(L|R)$/, ':hand')), ['seller:store', 'seller:hand', 'buyer:hand', 'buyer:worn'], slot);
    assert.equal(T.dresses.length, 1, slot);
    // (put on when it leaves the hand: the figure is dressed at the very moment the thing is no longer drawn)
    const off = T.at(T.dresses[0].t + 1e-6).things.goods;
    assert.ok(!off.show && off.holder === 'buyer:worn', `${slot}: ${off.holder} shown ${off.show}`);
    assert.equal(T.dresses[0].who, 'buyer');
  }
  // (its slot already worn: kept, tucked away, and nothing put on)
  const kept = stageDeal('buyWear', { ...pair(1, 1), goods: 'wear:hat', slot: 'hat', on: false });
  assert.equal(kept.dresses.length, 0);
});

test('hands-2: a pair off the sneaker wall: a hand to the wall, the pair seen beside the head, a look back, tucked away (or put back, seen)', () => {
  for (const s of [0.9, 1, 1.25]) for (const yaw of [0, 1.2, Math.PI, -2]) for (const cam of [[0, 30], [20, -10]]) for (const caught of [false, true]) {
    const u = [Math.sin(yaw), Math.cos(yaw)];
    const face = [u[0] * 0.5 * s, u[1] * 0.5 * s];
    const T = stageDeal('swipe', { people: { you: { x: 0, z: 0, yaw, scale: s } }, cam, caught, rim: [face[0] - u[0] * 0.05, 0.95 * s, face[1] - u[1] * 0.05], inside: [face[0] + u[0] * 0.04, 0.95 * s, face[1] + u[1] * 0.04] });
    const M = measureHands(T);
    const what = `size ${s}, heading ${yaw}, the camera at ${cam}${caught ? ', caught' : ''}`;
    assert.deepEqual(M.faults, [], what);
    assert.ok(M.jump <= 0.16 && M.far <= 0.85 && M.lost + M.nan === 0, what);
    assert.ok(T.t1 - T.t0 <= (caught ? 3.0 : 2.4), `${what}: ${(T.t1 - T.t0).toFixed(2)} s`);
    const seen = [];
    for (const [, S] of frames(T)) if (seen[seen.length - 1] !== S.things.pair.holder) seen.push(S.things.pair.holder);
    assert.deepEqual(seen.map(h => h.replace(/:(L|R)$/, ':hand')), caught ? ['bin:in', 'you:hand', 'bin:in'] : ['bin:in', 'you:hand', 'you:tucked'], what);
  }
});

test('hands-2: a stick-up gone wrong lands on him: knocked back a metre and more, backing off, a shout; never further than is free; the won one as it was', () => {
  for (const [sa, sb] of SIZES) for (const bearing of [Math.PI / 2, 0, 2.2, -1.1]) for (const room of [1.9, 1.0, 0.5]) {
    const T = stageDeal('stickup', { ...pair(sa, sb, bearing), win: false, room });
    const [a, b] = [T.at(T.t0).bodies.buyer, T.at(T.t1).bodies.buyer];
    const moved = Math.hypot(b.x - a.x, b.z - a.z);
    const what = `sizes ${sa} and ${sb}, bearing ${bearing}, ${room} m free`;
    assert.ok(moved <= room + 1e-6, `${what}: pushed ${moved.toFixed(2)} m`);
    if (room >= 1.9) assert.ok(moved >= 1.0, `${what}: pushed only ${moved.toFixed(2)} m`);
    // (away from her, not past her)
    const s = T.at(T.t0).bodies.seller;
    assert.ok(Math.hypot(b.x - s.x, b.z - s.z) > Math.hypot(a.x - s.x, a.z - s.z), what);
    assert.equal(T.shouts.length, 1, what);
    assert.equal(T.at(T.t1).things.cutter.holder.replace(/:(L|R)$/, ''), 'buyer:pocket', what);
    assert.ok(T.t1 - T.t0 <= 3.0, `${what}: ${(T.t1 - T.t0).toFixed(2)} s`);
  }
  const W = stageDeal('stickup', { ...pair(1, 1), win: true });
  assert.equal(W.shouts.length, 0);
  assert.deepEqual([W.at(W.t1).bodies.buyer.x, W.at(W.t1).bodies.buyer.z], [W.at(W.t0).bodies.buyer.x, W.at(W.t0).bodies.buyer.z]);
});
