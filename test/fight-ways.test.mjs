// THE FIGHT'S WAYS IN AND ITS FRAME CHECK (demo/fight/ways.js, frame.js, place.js WAYS): nobody of a fight is put down
// in the picture; they walk in from where the camera cannot see, and the page's check catches anyone who comes on or
// goes off inside the picture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, LEVELS, FOES, TICK } from '../src/fight/data.mjs';
import { SITES, arenaOn, arenaAt, centerFromStairs } from '../demo/fight/place.js';
import { waysOn, pickWays, pointBack, startOn, wayLength, aside } from '../demo/fight/ways.js';
import { lockView, bodyIn, inView, viewOf, createFrameCheck, footprint, quietBox, ASPECT } from '../demo/fight/frame.js';

/** A site on the city: its arena, its ways, the Lock's pictures with the player anywhere in it (a half-metre inside its edges, every metre). */
function laid(site) {
  const A = arenaOn(site);
  const ways = waysOn(site.ways, ARENA.entries, A.world);
  const pictures = [];
  for (let x = 0.5; x <= ARENA.w - 0.5; x += 1) for (let y = 0.5; y <= ARENA.h - 0.5; y += 1) {
    const [wx, wz] = A.world(x, y);
    pictures.push(lockView([wx, 0, wz]));
  }
  return { site, A, ways, pictures, seenAnywhere: (x, z) => pictures.some(v => bodyIn(v, x, 0, z)) };
}
const LAID = Object.values(SITES).map(laid);
const { A, ways } = LAID.find(L => L.site.id === 'elm');

test('the picture is the Lock at 1280 by 800: the player in its middle, the edges where camera.js puts them', () => {
  const [px, pz] = A.world(...ARENA.start);
  const v = lockView([px, 0, pz]);
  assert.equal(ASPECT, 1.6);
  // (24 m up, 64° down, from the east: the camera 11.7 m east of the player)
  assert.ok(Math.abs(v.eye[0] - (px + 11.7)) < 0.1 && Math.abs(v.eye[2] - pz) < 1e-6, String(v.eye));
  assert.ok(bodyIn(v, px, 0, pz), 'the player is in it');
  const F = footprint(v, 0);
  // (on the ground it reaches about 9.5 m toward the camera and 15.5 m away, wider at the far side)
  const xs = F.map(p => p[0] - px);
  assert.ok(Math.max(...xs) > 9 && Math.max(...xs) < 10.5, String(xs));
  assert.ok(Math.min(...xs) < -15 && Math.min(...xs) > -16.5, String(xs));
  // (a body 3 m past the near edge, or 25 m off to the side, is out of it)
  assert.equal(bodyIn(v, px + 13, 0, pz), false);
  assert.equal(bodyIn(v, px, 0, pz + 25), false);
  // (the same frame from a camera's own world matrix as the page reads it)
  const f = v.fwd, u = v.up, r = v.right;
  const m = [r[0], r[1], r[2], 0, u[0], u[1], u[2], 0, -f[0], -f[1], -f[2], 0, v.eye[0], v.eye[1], v.eye[2], 1];
  const w = viewOf({ m, fov: 42 });
  for (const p of [[px, 1, pz], [px + 9, 1, pz + 8], [px - 14, 1, pz - 18], [px + 12, 1, pz]]) assert.equal(inView(w, p, 0.5), inView(v, p, 0.5));
});

test('at every site, every entry a level uses has a way in, and every way ends at its entry', () => {
  const used = new Set(Object.values(LEVELS).flatMap(L => L.waves.map(w => w[2])));
  for (const { site, A, ways } of LAID) for (const e of used) assert.ok(ways.some(W => W.entry === e), `${site.id}: entry ${e} has a way`);
  for (const { A, ways } of LAID) for (const W of ways) {
    const [ex, ez] = A.world(...ARENA.entries[W.entry]);
    const end = W.path[W.path.length - 1];
    assert.ok(Math.hypot(end[0] - ex, end[1] - ez) < 1e-9, `${W.from}: ends at entry ${W.entry}`);
    assert.ok(wayLength(W.path) > 8, `${W.from}: a walk, not a step`);
    assert.ok(W.from.length > 5, 'said in words');
  }
});

test("at every site, every way's far end is out of every picture the camera can show with the player anywhere in the arena", () => {
  for (const { site, ways, seenAnywhere } of LAID) for (const W of ways) {
    const [x, z] = W.path[0];
    assert.equal(seenAnywhere(x, z), false, `${site.id}: ${W.from} starts at ${x}, ${z}, in a picture`);
    // (and so is a step further on: they come into the picture walking, never at their far end)
    const [x1, z1] = pointBack(W.path, wayLength(W.path) - 1);
    assert.equal(seenAnywhere(x1, z1), false, `${site.id}: ${W.from}: a metre on is in a picture`);
  }
});

test('ELM ST is where fight-1 laid it off the stairs, to the centimetre; the dead mall is the default and the scout\'s lot', () => {
  const c = centerFromStairs(SITES.elm.stairs.top, SITES.elm.stairs.dir);
  assert.ok(Math.hypot(c[0] - SITES.elm.center[0], c[1] - SITES.elm.center[1]) < 0.01, String(c));
  const E = arenaOn(SITES.elm);
  // (fight-1's: the exit 1.3 m in front of the top nosing, x along the flight's top, y off the stairs)
  assert.deepEqual(E.world(...ARENA.exit).map(v => +v.toFixed(2)), [-189.15, -41.3]);
  assert.deepEqual(arenaAt(SITES.elm).posts, ARENA.posts, 'the rules\' arena at ELM ST is fight-1\'s');
  const M = arenaOn(SITES.mall);
  assert.deepEqual(M.box, [-233.5, 70.5, -221.5, 90.5]);
});

test("the cover: inside the arena, clear of the start, the way out and every entry's way in, and among the rules' posts", () => {
  for (const site of Object.values(SITES)) {
    const R = arenaAt(site);
    for (const c of (site.cover ?? []).filter(q => q.post)) assert.ok(R.posts.includes(c.post), `${site.id}: ${c.says} is a post`);
    for (const [x0, y0, x1, y1] of R.posts) {
      assert.ok(x0 >= -0.5 && y0 >= -0.5 && x1 <= ARENA.w + 0.5 && y1 <= ARENA.h + 0.5, `${site.id}: post ${[x0, y0, x1, y1]} in the arena`);
      const near = ([x, y], r) => x > x0 - r && x < x1 + r && y > y0 - r && y < y1 + r;
      assert.ok(!near(ARENA.start, 1.2) && !near(ARENA.exit, ARENA.exitR + 0.5), `${site.id}: post ${[x0, y0, x1, y1]} by the start or the way out`);
      for (const e of ARENA.entries) assert.ok(!near(e, 1.2), `${site.id}: post ${[x0, y0, x1, y1]} by entry ${e}`);
    }
  }
  // (sparse: the dead mall's cover is under a tenth of the lot)
  const area = SITES.mall.cover.filter(c => c.post).reduce((s, c) => s + (c.post[2] - c.post[0]) * (c.post[3] - c.post[1]), 0);
  assert.ok(area < 0.1 * ARENA.w * ARENA.h, `${area} m²`);
});

test('the quiet zone holds every picture of the fight: nobody outside it can be seen, so nobody need be hidden there', () => {
  for (const { A, pictures } of LAID) {
    const Q = quietBox(A.corners, 0, 3);
    for (const v of pictures) for (const [x, z] of footprint(v, 0)) assert.ok(x > Q[0] && x < Q[2] && z > Q[1] && z < Q[3], `${x}, ${z} outside the quiet zone`);
  }
  const Q = quietBox(A.corners, 0, 3);
  // (and it is the streets round the fight, not the town: under 70 m a side)
  assert.ok(Q[2] - Q[0] < 70 && Q[3] - Q[1] < 80, String(Q));
});

test('a way, metre by metre: its length, a point back from its end, and the way they walk there', () => {
  const path = [[0, 0], [0, 10], [5, 10]];
  assert.equal(wayLength(path), 15);
  assert.deepEqual(pointBack(path, 0), [5, 10, 1, 0]);
  assert.deepEqual(pointBack(path, 2), [3, 10, 1, 0]);
  assert.deepEqual(pointBack(path, 7), [0, 8, 0, 1]);
  assert.deepEqual(pointBack(path, 99), [0, 0, 0, 1]);
  // (moved aside, to the walker's right, all but its end)
  const side = aside(path, 0.5);
  assert.deepEqual(side[side.length - 1], [5, 10]);
  assert.ok(Math.abs(side[0][0] + 0.5) < 1e-9 && side[0][1] === 0, String(side[0]), 'walking +z, the right hand is −x');
});

test('who takes which way: seeded by the fight, not its rolls; the same seed the same; two on one entry not one clump', () => {
  for (const [id, L] of Object.entries(LEVELS)) {
    const P = pickWays(L.waves, ways, 7);
    assert.deepEqual(pickWays(L.waves, ways, 7), P, `${id}: the same seed, the same ways`);
    P.forEach((p, k) => {
      assert.equal(p.id, `f${k + 1}`, 'the rules number them in their order (sim.mjs spawn)');
      assert.equal(p.entry, L.waves[k][2]);
      assert.equal(ways[p.way].entry, p.entry);
    });
    // (a level's people who come to the same entry close together come by other ways, or apart)
    for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) {
      if (P[a].entry !== P[b].entry || Math.abs(P[a].t - P[b].t) > 3) continue;
      const near = Math.hypot(P[a].path[0][0] - P[b].path[0][0], P[a].path[0][1] - P[b].path[0][1]);
      assert.ok(P[a].way !== P[b].way || near > 0.05, `${id}: ${P[a].id} and ${P[b].id} one clump`);
    }
  }
  const seeds = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(s => pickWays(LEVELS.real.waves, ways, s).map(p => p.way).join(',')));
  assert.ok(seeds.size > 1, 'other seeds, other ways');
});

test('a walker starts as late as it can, out of the picture, and is at its entry on the tick the rules bring it in', () => {
  const path = [[0, -40], [0, 0]];
  // (the picture sees the last 10 m of the way: z > −10)
  const seen = (x, z) => z > -10;
  // (too early: 30 m to go at 2.5 m/s is 12 s; with 20 s left it waits)
  assert.equal(startOn(path, 20, 2.5, seen, { ahead: 3 }), null);
  // (5.6 s left: 14 m back, 11 m back is still unseen: waits)
  assert.equal(startOn(path, 5.6, 2.5, seen, { ahead: 3 }), null);
  // (5 s left: 12.5 m back, 9.5 m back would be seen: it starts now, at 12.5 m, unseen, at its pace)
  const r = startOn(path, 5, 2.5, seen, { ahead: 3 });
  assert.ok(r && Math.abs(r.s - 12.5) < 1e-9 && r.v === 2.5 && !seen(...pointBack(path, r.s)), JSON.stringify(r));
  // (late, the camera came round: the nearest unseen point further back, a little quicker)
  const late = startOn(path, 2, 2.5, seen, { ahead: 3 });
  assert.ok(late.s >= 10 && !seen(...pointBack(path, late.s)) && late.v > 2.5, JSON.stringify(late));
  // (then, at the page's ticks, it walks the way at that pace and stands at the entry when its time is up)
  const s = t => r.v * Math.max(0, 5 - t);
  assert.deepEqual(pointBack(path, s(5)).slice(0, 2), [0, 0]);
  assert.ok(Math.abs(s(5 - TICK) - 2.5 * TICK) < 1e-9);
});

test("at every site the first of each level walk in from out of the picture within the round's short wait", () => {
  for (const { site, A, ways } of LAID) {
    const [px, pz] = A.world(...ARENA.start);
    const v = lockView([px, 0, pz]);
    const seen = (x, z) => inView(v, [x, 0.95, z], 1.8);
    for (const [id, L] of Object.entries(LEVELS)) {
      for (const seed of [1, 2, 3, 4, 5]) {
        for (const p of pickWays(L.waves, ways, seed).filter(q => q.t < 4)) {
          let b = 0;
          for (let q = 0; q <= wayLength(p.path); q += 0.5) if (seen(...pointBack(p.path, q))) b = q + 0.5;
          const wait = (b + 3.5) / FOES[p.kind].speed - p.t;
          assert.ok(wait < 6, `${site.id} ${id}/${seed}: ${p.id} (${p.kind}, ${p.from}) needs ${wait.toFixed(1)} s`);
        }
      }
    }
  }
});

test('the frame check: on or off in the picture is a fault; out of it, under a cut, or where nobody can see, it is not', () => {
  const v = lockView([0, 0, 0]);
  const C = createFrameCheck();
  const at = (id, x, z, on = true) => ({ id, on, x, y: 0, z });
  assert.deepEqual(C.step([at('you', 0, 0)], v), [], 'the first frame is what there is');
  // (one added in the picture)
  assert.equal(C.step([at('you', 0, 0), at('a', 2, 2)], v)[0]?.what, 'came on');
  // (one added out of it, then walking in: fine)
  assert.deepEqual(C.step([at('you', 0, 0), at('a', 2, 2), at('b', 20, 0)], v), []);
  assert.deepEqual(C.step([at('you', 0, 0), at('a', 2, 2), at('b', 19.95, 0)], v), []);
  // (one hidden in the picture, one taken off in it, one moved at once)
  const f = C.step([at('you', 0, 0), at('a', 2, 2, false), at('b', 5, 0)], v).map(q => q.what).sort();
  assert.deepEqual(f, ['was moved at once', 'went off']);
  assert.deepEqual(C.step([at('you', 0, 0)], v).map(q => q.what), ['went off'], 'a taken off the stage in the picture');
  // (under a cut: nothing counts)
  assert.deepEqual(C.step([at('you', 5, 5), at('c', 1, 1)], v, { cut: true }), []);
  // (where nobody can see, it is let by, and said)
  assert.deepEqual(C.step([at('you', 5, 5), at('c', 1, 1), at('d', -2, 1)], v, { hidden: (x, y, z) => x < 0 }), []);
  assert.equal(C.hiddenOnes.length, 1);
  assert.equal(C.faults.length, 4);
  assert.ok(C.seen > 0);
});

test("the round plays at the dead mall as it did at ELM ST: each preset's wins backing away while firing, within a few in 60", async () => {
  const { runFight, PRESETS, kite } = await import('../src/fight/index.mjs');
  const wins = (site, id, level) => {
    let w = 0;
    for (let s = 1; s <= 60; s++) if (runFight({ build: PRESETS[id], level, seed: s, policy: kite, arena: arenaAt(SITES[site]) }).over.result === 'won') w += 1;
    return w;
  };
  for (const [id, level] of [['starter', 'real'], ['pistol', 'real'], ['pistolVest', 'real'], ['full', 'real'], ['full', 'hard']]) {
    const [e, m] = [wins('elm', id, level), wins('mall', id, level)];
    assert.ok(Math.abs(e - m) <= 6, `${id} at ${level}: ELM ST ${e} of 60, the dead mall ${m}`);
  }
});
