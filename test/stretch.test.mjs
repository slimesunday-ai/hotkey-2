// A BODY POSED BY HAND IS NEVER DRAWN STRETCHED (streak-1; demo/fight/puppet/reach.js, rig.js legsInReach): whatever
// pose the page asks for (a fight's fall, a look's sleeper going down, numbers that are not numbers), what is handed to
// the walk shader has every point of the body, as the shader draws it, within a body's reach of its hips.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pose0, packPose, legsInReach, copyPose, TEXELS } from '../demo/fight/puppet/rig.js';
import { reachOf, reachOfBlend, STRETCH, LOG } from '../demo/fight/puppet/reach.js';
import { scriptOf, stageFight } from '../demo/fight/puppet/choreo.js';
import { duelInputs } from '../demo/tools/fight-score.mjs';

const pose = o => Object.assign(pose0(), o);
// (the measure's own cases: each drawn as a streak by the walk shader before streak-1, seen in the browser)
const STREAKS = {
  // a fight: the back foot past the leg's length, so the hips come down level with its ankle (cutter v bigman, seed 3)
  lunge: pose({ fL: [-0.2414, 0, -0.2897], fR: [-0.3346, 0.0409, 0.1976], bx: -0.1 }),
  // a foot lifted past the hips
  kick: pose({ fR: [0.2, 0.45, 0] }),
  // the pelvis dropped onto the feet, legs out ahead (sitting down, going down to sleep)
  sit: pose({ fL: [0.3, 0, 0], fR: [0.3, 0, 0], drop: 0.375, bx: 0.02 }),
};

test('the measure sees the streak in each pose that drew one, and none in the stand', () => {
  assert.ok(reachOf(pose0()).ok, 'the plain stand');
  for (const [name, P] of Object.entries(STREAKS)) {
    const r = reachOfBlend(P);
    assert.ok(!r.ok, `${name}: measured ${r.far} m`);
  }
});

test('handed over, no pose is drawn stretched, and a pose that was fine is handed over number for number', () => {
  for (const [name, P] of Object.entries(STREAKS)) {
    const r = reachOfBlend(legsInReach(P, pose0()));
    assert.ok(r.ok && r.far < STRETCH, `${name}: ${r.far} m (${r.at})`);
  }
  const a = new Float32Array(TEXELS * 4);
  const b = new Float32Array(TEXELS * 4);
  const P = pose({ fL: [0.1, 0.02, -0.1], fR: [-0.15, 0, 0.1], drop: 0.08, bx: 0.03, tx: 0.3 });
  packPose(P, a);
  // (the plain packing of the same pose, by hand)
  const Q = copyPose(P);
  assert.deepEqual(Q, legsInReach(P, pose0()));
  packPose(Q, b);
  assert.deepEqual([...a], [...b]);
});

test('random poses, the wildest a page could ask for, all drawn within reach', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const between = (a, b) => a + (b - a) * rnd();
  for (let k = 0; k < 4000; k++) {
    const P = pose({
      fL: [between(-0.8, 0.8), between(-0.1, 0.9), between(-1.2, 1.2)], fR: [between(-0.8, 0.8), between(-0.1, 0.9), between(-1.2, 1.2)],
      drop: between(-0.1, 0.6), bx: between(-0.3, 0.3), pr: between(-0.6, 0.6), tx: between(-1.5, 1.5), ty: between(-1.5, 1.5),
      rx: between(-3, 3), rz: between(-3, 3), px: between(-0.5, 0.5), py: between(0, 1), pz: between(-0.5, 0.5), mx: between(-1, 1), my: between(-1, 1), mz: between(-1, 1),
    });
    if (k % 97 === 0) P.fL[1] = NaN;
    if (k % 89 === 0) P.drop = Infinity;
    const r = reachOfBlend(legsInReach(P, pose0()));
    assert.ok(r.ok, `pose ${k}: ${r.far} m (${r.at}) ${JSON.stringify(P)}`);
  }
});

test('every fight the page stages is handed over within reach, for every body (1 in 50 frames changed at most)', () => {
  let frames = 0;
  let changed = 0;
  const before = LOG.bad;
  for (const [arm, style, seed] of [['cutter', 'bigman', 3], ['hands', 'brawler', 7], ['haymaker', 'grabber', 2], ['throw', 'quick', 1]]) {
    const script = scriptOf(duelInputs(arm, style), seed);
    const fight = stageFight({ script, ground: { c: [0, 0], r: 1.7 }, cam: [1, 0], seed, firstHurt: 0 });
    for (const F of fight.fighters) {
      for (let t = fight.t0; t <= fight.t1; t += 1 / 30) {
        const P = F.at(t).P;
        const Q = legsInReach(P, pose0());
        frames += 1;
        if (Q.drop !== P.drop || Q.fL.some((v, i) => v !== P.fL[i]) || Q.fR.some((v, i) => v !== P.fR[i])) changed += 1;
        packPose(P, new Float32Array(TEXELS * 4));
      }
    }
  }
  assert.equal(LOG.bad, before, 'a pose handed over was drawn stretched');
  assert.ok(changed / frames < 0.02, `${changed} of ${frames} frames changed`);
});
